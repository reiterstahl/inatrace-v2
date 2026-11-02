import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';

async function ingresar(page: Page, destino: string) {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('mi empresa (modo simulado)', () => {
  test('ficha: validar, sumar cadena, certificación y video, guardar y que persista', async ({ page }) => {
    await ingresar(page, 'empresa');
    await expect(page.getByRole('heading', { level: 1, name: 'Cooperativa Flor de la Sierra' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ficha' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: 'Empresa', exact: true })).toHaveClass(/text-marca/);

    await page.getByRole('textbox', { name: 'Correo de contacto' }).fill('sin-arroba');
    await page.getByRole('textbox', { name: 'Abreviatura' }).fill('AB');
    await page.getByRole('button', { name: 'Agregar certificación' }).click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Revisa los campos marcados.')).toBeVisible();
    await expect(page.getByText('Escribe un correo válido.')).toBeVisible();
    await expect(page.getByText('De 3 a 6 caracteres.', { exact: true }).last()).toBeVisible();
    const cert = page.getByRole('group', { name: 'Certificación 1' });
    await expect(cert.getByText('Este campo es obligatorio.')).toHaveCount(2);

    await page.getByRole('textbox', { name: 'Correo de contacto' }).fill('contacto@flordelasierra.example');
    await page.getByRole('textbox', { name: 'Abreviatura' }).fill('FLOR');
    await cert.getByRole('textbox', { name: 'Descripción' }).fill('Comercio justo');
    await cert.getByLabel('Certificado').setInputFiles({ name: 'fairtrade.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await expect(cert.getByText('fairtrade.pdf')).toBeVisible();
    await page.getByRole('combobox', { name: 'Agregar una cadena de valor' }).selectOption({ label: 'Cacao' });
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await page.getByRole('combobox', { name: /^Moneda base/ }).selectOption({ label: 'GTQ · Quetzal' });
    await page.getByRole('button', { name: 'Agregar video' }).click();
    const video = page.getByRole('group', { name: 'Video 2' });
    await video.getByRole('textbox', { name: /^Descripción/ }).fill('Beneficio húmedo');
    await video.getByRole('textbox', { name: /^Enlace del video/ }).fill('https://youtu.be/beneficio');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Empresa guardada.')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Abreviatura' })).toHaveValue('FLOR');
    await expect(page.getByRole('list', { name: /^Cadenas de valor/ })).toContainText('Cacao');
    await expect(page.getByRole('group', { name: 'Video 2' }).getByRole('textbox', { name: /^Enlace del video/ })).toHaveValue('https://youtu.be/beneficio');
    await expect(page.getByRole('group', { name: 'Certificación 1' }).getByText('fairtrade.pdf')).toBeVisible();
    // Quitar una cadena avisa que el procesamiento deja de funcionar.
    page.once('dialog', (d) => void d.dismiss());
    await page.getByRole('button', { name: 'Quitar la cadena Cacao' }).click();
    await expect(page.getByRole('list', { name: /^Cadenas de valor/ })).toContainText('Cacao');
  });

  test('usuarios: la administración de la empresa los ve sin poder cambiarlos', async ({ page }) => {
    await ingresar(page, 'empresa/usuarios');
    await expect(page.getByRole('listitem', { name: 'Ana Demo' })).toContainText('Administración');
    await expect(page.getByRole('listitem', { name: 'Luis Pérez' })).toContainText('Usuario/a');
    await expect(page.getByRole('heading', { name: 'Sumar una persona' })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Rol de Luis Pérez' })).toHaveCount(0);
  });

  test('usuarios: la administración del sistema cambia roles, suma y quita, sin dejar la empresa sin administración', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('simulado.rol', 'SYSTEM_ADMIN'));
    await ingresar(page, 'empresa/usuarios');
    await page.getByRole('combobox', { name: 'Rol de Ana Demo' }).selectOption({ label: 'Gerencia' });
    await expect(page.getByText('No se puede: es la única persona con rol de administración.', { exact: false })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Rol de Ana Demo' })).toHaveValue('COMPANY_ADMIN');

    await page.getByRole('combobox', { name: 'Rol de Luis Pérez' }).selectOption({ label: 'Contabilidad' });
    await expect(page.getByText('Luis Pérez ahora tiene el rol Contabilidad.')).toBeVisible();

    await page.getByRole('searchbox', { name: 'Buscar' }).fill('chávez');
    await expect(page.getByRole('list', { name: 'Cuentas encontradas' }).getByRole('listitem')).toHaveCount(2);
    await page.getByRole('combobox', { name: 'Rol', exact: true }).selectOption({ label: 'Administración' });
    await page.getByRole('button', { name: 'Sumar a Rosa Chávez' }).click();
    await expect(page.getByText('Se sumó a Rosa Chávez.')).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Rosa Chávez' })).toBeVisible();

    // Con otra persona en administración, Ana ya puede cambiar de rol.
    await page.getByRole('combobox', { name: 'Rol de Ana Demo' }).selectOption({ label: 'Gerencia' });
    await expect(page.getByText('Ana Demo ahora tiene el rol Gerencia.')).toBeVisible();

    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Quitar a Luis Pérez' }).click();
    await expect(page.getByText('Se quitó a Luis Pérez de la empresa.')).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Luis Pérez' })).toHaveCount(0);
  });

  test('instalaciones: no se borra una con movimientos, se desactiva y se vuelve a activar', async ({ page }) => {
    await ingresar(page, 'empresa/instalaciones');
    await expect(page.getByRole('link', { name: 'Instalaciones' })).toHaveAttribute('aria-current', 'page');
    const beneficio = page.getByRole('listitem', { name: 'Beneficio Flor de la Sierra' });
    await expect(beneficio).toContainText('Beneficio húmedo · Huehuetenango, Guatemala');
    await expect(beneficio).toContainText('Acopio');
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar Beneficio Flor de la Sierra' }).click();
    await expect(page.getByText('Cannot delete a facility that has stock orders')).toBeVisible();

    const mirador = page.getByRole('listitem', { name: 'Centro de acopio El Mirador' });
    page.once('dialog', (d) => void d.accept());
    await mirador.getByRole('button', { name: 'Desactivar' }).click();
    await expect(page.getByText('Se desactivó «Centro de acopio El Mirador».')).toBeVisible();
    await expect(mirador).toContainText('Desactivada');
    await mirador.getByRole('button', { name: 'Activar' }).click();
    await expect(page.getByText('Se activó «Centro de acopio El Mirador».')).toBeVisible();
    await expect(mirador).not.toContainText('Desactivada');
  });

  test('instalaciones: crear con nombre en un idioma, ubicación en el mapa, uso y productos; editar y borrar', async ({ page }) => {
    await ingresar(page, 'empresa/instalaciones');
    await page.getByRole('link', { name: 'Nueva instalación' }).click();
    // La empresa tiene una sola cadena: viene elegida.
    await expect(page.getByRole('list', { name: /^Cadenas de valor/ })).toContainText('Café');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Revisa los campos marcados.')).toBeVisible();
    await expect(page.getByText('Escribe el nombre al menos en un idioma.')).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Este campo es obligatorio.' })).toHaveCount(5);

    await page.getByRole('combobox', { name: 'Tipo de instalación' }).selectOption({ label: 'Bodega' });
    await page.getByRole('textbox', { name: 'Nombre en Español' }).fill('Bodega Norte');
    await page.getByRole('combobox', { name: 'País' }).selectOption({ label: 'Guatemala' });
    await page.getByRole('textbox', { name: 'Ciudad' }).fill('Chiantla');
    await page.getByRole('group', { name: /^¿Se muestra en el mapa público\?/ }).getByLabel('Sí').check();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Este campo es obligatorio.' })).toHaveCount(4);
    await page.getByRole('application', { name: 'Ubicación de la instalación' }).click({ position: { x: 150, y: 120 } });
    await expect(page.getByRole('textbox', { name: /^Latitud/ })).not.toHaveValue('');
    await page.getByRole('group', { name: /^¿Es un centro de acopio\?/ }).getByLabel('No').check();
    await page.getByRole('group', { name: /^¿Vende semiproductos/ }).getByLabel('Sí').check();
    await page.getByRole('checkbox', { name: 'Orgánico' }).check();
    await page.getByRole('combobox', { name: 'Agregar a semiproductos' }).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Agregar a semiproductos' }).click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Se guardó «Bodega Norte».')).toBeVisible();
    const bodega = page.getByRole('listitem', { name: 'Bodega Norte' });
    await expect(bodega).toContainText('Bodega · Chiantla, Guatemala');
    await expect(bodega).toContainText('Vende');

    await bodega.getByRole('link', { name: 'Editar' }).click();
    // Los idiomas vacíos tomaron el nombre escrito.
    await expect(page.getByRole('textbox', { name: 'Nombre en Inglés' })).toHaveValue('Bodega Norte');
    await expect(page.getByRole('checkbox', { name: 'Orgánico' })).toBeChecked();
    await page.getByRole('combobox', { name: 'País' }).selectOption({ label: 'Rwanda' });
    await expect(page.getByRole('textbox', { name: 'Aldea' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Ciudad' })).toHaveCount(0);
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Quitar Café', exact: true }).click();
    await expect(page.getByText('Elige primero una cadena de valor.')).toBeVisible();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('link', { name: 'Instalaciones' }).first().click();

    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar Bodega Norte' }).click();
    await expect(page.getByText('Se borró «Bodega Norte».')).toBeVisible();
  });
});
