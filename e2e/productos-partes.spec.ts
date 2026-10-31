import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';

async function ingresar(page: Page, destino: string) {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('partes del producto (modo simulado)', () => {
  test('vitrina y recorrido: colores, pestañas y paradas en el mapa', async ({ page }) => {
    await ingresar(page, 'productos/1/vitrina');
    await expect(page.getByRole('heading', { level: 1, name: 'Café Flor de la Sierra' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Vitrina y recorrido' })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('textbox', { name: 'Color secundario', exact: true }).fill('rojo');
    await page.getByRole('checkbox', { name: 'Calidad', exact: true }).check();
    await page.getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: 'Calidad', exact: true }) }).getByRole('textbox', { name: 'Posición' }).fill('0');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Un color en formato #rrggbb.')).toBeVisible();
    await expect(page.getByText('Un número entero desde 1.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Color secundario', exact: true }).fill('#5dbccf');
    await page.getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: 'Calidad', exact: true }) }).getByRole('textbox', { name: 'Posición' }).fill('2');

    // Recorrido: el producto trae 2 paradas; se agrega una y se sube al segundo lugar.
    await expect(page.getByRole('listitem', { name: 'Parada 2' })).toBeVisible();
    await page.getByRole('application', { name: 'Mapa del recorrido' }).click({ position: { x: 160, y: 120 } });
    await expect(page.getByRole('listitem', { name: 'Parada 3' })).toBeVisible();
    // Las coordenadas de la parada nueva (sin el número de orden).
    const tercera = (await page.getByRole('listitem', { name: 'Parada 3' }).textContent())!.replace(/^\d+/, '');
    await page.getByRole('button', { name: 'Subir la parada 3' }).click();
    await expect(page.getByRole('listitem', { name: 'Parada 2' })).toContainText(tercera);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Producto guardado.')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Color secundario', exact: true })).toHaveValue('#5dbccf');
    await expect(page.getByRole('checkbox', { name: 'Calidad', exact: true })).toBeChecked();
    await expect(page.getByRole('listitem', { name: 'Parada 2' })).toContainText(tercera);
    // La ficha sigue intacta después de guardar la vitrina.
    await page.getByRole('link', { name: 'Ficha' }).click();
    await expect(page.getByRole('textbox', { name: /^Descripción del origen/ })).toHaveValue(/Huehuetenango/);
  });

  test('empresas: una usuaria ve la cadena y carga acuerdos de datos', async ({ page }) => {
    await ingresar(page, 'productos/1/empresas');
    await expect(page.getByRole('region', { name: 'Administración del producto (dueña)' })).toContainText('Cooperativa Flor de la Sierra');
    await expect(page.getByRole('heading', { name: 'Asociar una empresa' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Agregar acuerdo' }).click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Revisa los campos marcados.')).toBeVisible();
    const acuerdo = page.getByRole('listitem', { name: 'Acuerdo 1' });
    await acuerdo.getByRole('textbox', { name: 'Descripción' }).fill('Uso de datos de entregas para la vitrina.');
    await acuerdo.getByLabel('Documento').setInputFiles({ name: 'acuerdo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await expect(acuerdo.getByText('documento.pdf')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Producto guardado.')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('listitem', { name: 'Acuerdo 1' }).getByRole('textbox', { name: 'Descripción' })).toHaveValue('Uso de datos de entregas para la vitrina.');
  });

  test('empresas: la administración asocia y quita empresas, y no deja el producto sin dueña', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('simulado.rol', 'SYSTEM_ADMIN'));
    await ingresar(page, 'productos/1/empresas');
    await expect(page.getByRole('heading', { name: 'Asociar una empresa' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Como' }).selectOption({ label: 'Exportadoras' });
    await page.getByRole('searchbox', { name: 'Empresa' }).fill('norte');
    await page.getByRole('list', { name: 'Empresas encontradas' }).getByRole('button', { name: 'Agregar' }).click();
    await expect(page.getByText('Se agregó a Exportadora del Norte.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Exportadoras' })).toContainText('Exportadora del Norte');

    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Quitar a Exportadora del Norte' }).click();
    await expect(page.getByText('Se quitó a Exportadora del Norte.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Exportadoras' })).toContainText('Ninguna.');

    await page.getByRole('button', { name: 'Quitar a Cooperativa Flor de la Sierra' }).click();
    await expect(page.getByText('El producto tiene que tener al menos una empresa dueña.', { exact: false })).toBeVisible();
  });

  test('productos finales: crear con etiqueta, editar y borrar', async ({ page }) => {
    await ingresar(page, 'productos/1/finales');
    await expect(page.getByRole('listitem', { name: 'Café tostado 340 g' })).toContainText('Etiquetas: Tienda en línea');
    await page.getByRole('button', { name: 'Nuevo producto final' }).click();
    const form = page.getByRole('group', { name: 'Nuevo producto final' });
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(form.getByText('Este campo es obligatorio.').first()).toBeVisible();
    await form.getByRole('textbox', { name: 'Nombre' }).fill('Café molido 500 g');
    await form.getByRole('combobox', { name: 'Unidad de medida' }).selectOption({ label: 'unidad' });
    await form.getByRole('textbox', { name: 'Descripción' }).fill('Molienda media.');
    await form.getByRole('checkbox', { name: 'Tienda en línea' }).check();
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Se guardó «Café molido 500 g».')).toBeVisible();
    const nuevo = page.getByRole('listitem', { name: 'Café molido 500 g' });
    await expect(nuevo).toContainText('unidad · Etiquetas: Tienda en línea');

    await nuevo.getByRole('button', { name: 'Editar' }).click();
    const edicion = page.getByRole('group', { name: 'Editar producto final' });
    await edicion.getByRole('checkbox', { name: 'Tienda en línea' }).uncheck();
    await edicion.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('listitem', { name: 'Café molido 500 g' })).toContainText('Sin etiquetas');

    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar Café molido 500 g' }).click();
    await expect(page.getByText('Se borró «Café molido 500 g».')).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Café molido 500 g' })).toHaveCount(0);
  });

  test('un producto ajeno: las pestañas se ven en solo lectura', async ({ page }) => {
    await ingresar(page, 'productos/2/finales');
    await expect(page.getByText('Solo la empresa dueña puede modificarlo.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo producto final' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Vitrina y recorrido' }).click();
    await expect(page.getByRole('textbox', { name: 'Color primario', exact: true })).toBeDisabled();
    await page.getByRole('link', { name: 'Empresas' }).click();
    await expect(page.getByRole('button', { name: 'Agregar acuerdo' })).toHaveCount(0);
  });
});
