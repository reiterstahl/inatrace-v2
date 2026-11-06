import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';

async function ingresar(page: Page, destino: string, rol?: string) {
  if (rol) await page.addInitScript((r) => sessionStorage.setItem('simulado.rol', r), rol);
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('administración (modo simulado)', () => {
  test('sin rol de administración no hay entrada ni pantalla', async ({ page }) => {
    await ingresar(page, 'administracion');
    await expect(page.getByText('Esta sección es solo para la administración del sistema o regional.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Administración' })).toHaveCount(0);
  });

  test('empresas: filtrar, activar, desactivar y fusionar', async ({ page }) => {
    await ingresar(page, '', 'SYSTEM_ADMIN');
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Administración' }).click();
    await expect(page).toHaveURL(/administracion\/empresas$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Administración' })).toBeVisible();
    const lista = page.getByRole('listitem');
    await expect(lista).toHaveCount(4);

    // El backend busca por el comienzo del nombre.
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('coop');
    await expect(lista).toHaveCount(2);
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('');
    await page.getByRole('combobox', { name: 'Estado' }).selectOption({ label: 'Registrada' });
    await expect(lista).toHaveCount(1);
    await page.getByRole('combobox', { name: 'Estado' }).selectOption({ label: 'Todos' });

    page.on('dialog', (d) => void d.accept());
    const exportadora = page.getByRole('listitem', { name: 'Exportadora del Norte' });
    await expect(exportadora).toContainText('Registrada');
    await page.getByRole('button', { name: 'Activar Exportadora del Norte', exact: true }).click();
    await expect(page.getByText('Exportadora del Norte quedó activa.')).toBeVisible();
    await expect(exportadora).toContainText('Activa');
    await expect(page.getByRole('button', { name: 'Activar Exportadora del Norte', exact: true })).toHaveCount(0);

    // Fusionar: solo hacia empresas activas y nunca a la misma.
    await page.getByRole('button', { name: 'Fusionar Cooperativa La Vecina con otra empresa' }).click();
    const destino = page.getByRole('combobox', { name: 'Empresa de destino' });
    await expect(destino.getByRole('option')).toHaveText(['Elegir una empresa activa', 'Cooperativa Flor de la Sierra', 'Exportadora del Norte']);
    await destino.selectOption({ label: 'Exportadora del Norte' });
    await page.getByRole('listitem', { name: 'Cooperativa La Vecina' }).getByRole('button', { name: 'Fusionar', exact: true }).click();
    await expect(page.getByText('Las personas de Cooperativa La Vecina pasaron a Exportadora del Norte; Cooperativa La Vecina quedó desactivada.')).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Cooperativa La Vecina' })).toContainText('Desactivada');

    await page.getByRole('button', { name: 'Desactivar Exportadora del Norte' }).click();
    await expect(page.getByText('Exportadora del Norte quedó desactivada.')).toBeVisible();
  });

  test('crear una empresa y abrirla para completar la ficha', async ({ page }) => {
    await ingresar(page, 'administracion/empresas', 'SYSTEM_ADMIN');
    await page.getByRole('button', { name: 'Nueva empresa' }).click();
    await page.getByRole('button', { name: 'Crear y abrir' }).click();
    await expect(page.getByText('Escribe el nombre de la empresa.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Nombre' }).fill('Beneficio Las Nubes');
    await page.getByRole('button', { name: 'Crear y abrir' }).click();
    await expect(page).toHaveURL(/\/empresa$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Beneficio Las Nubes' })).toBeVisible();
    // Queda elegida arriba, junto a las empresas de la persona.
    await expect(page.getByRole('combobox', { name: 'Empresa' })).toHaveValue(/\d+/);
    await expect(page.getByRole('combobox', { name: 'Empresa' }).locator('option:checked')).toHaveText('Beneficio Las Nubes');

    await page.goto('administracion/empresas');
    await expect(page.getByRole('listitem', { name: 'Beneficio Las Nubes' })).toContainText('Registrada');
  });

  test('abrir otra empresa desde la lista', async ({ page }) => {
    await ingresar(page, 'administracion/empresas', 'SYSTEM_ADMIN');
    await page.getByRole('button', { name: 'Abrir Tostaduría Central' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tostaduría Central' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Tostaduría Central' })).toBeVisible();
  });

  test('la regional solo activa: sin crear, desactivar ni fusionar', async ({ page }) => {
    await ingresar(page, 'administracion/empresas', 'REGIONAL_ADMIN');
    await expect(page.getByText('Las empresas de tu región.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nueva empresa' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Desactivar|^Fusionar/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Activar Tostaduría Central', exact: true })).toBeVisible();
  });
});

test.describe('administración de usuarios (modo simulado)', () => {
  test('filtrar, confirmar, activar, cambiar roles y desactivar', async ({ page }) => {
    await ingresar(page, 'administracion/usuarios', 'SYSTEM_ADMIN');
    await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('7 personas')).toBeVisible();
    // Sobre la propia cuenta no hay acciones.
    await expect(page.getByRole('listitem', { name: 'Ana Demo' }).getByRole('button')).toHaveCount(0);

    await page.getByRole('searchbox', { name: 'Buscar' }).fill('chávez');
    await expect(page.getByText('2 personas')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('');
    await page.getByRole('combobox', { name: 'Rol' }).selectOption({ label: 'Administración regional' });
    await expect(page.getByRole('listitem')).toHaveCount(1);
    await page.getByRole('combobox', { name: 'Rol' }).selectOption({ label: 'Todos' });

    page.on('dialog', (d) => void d.accept());
    // Sin confirmar → correo confirmado → activa.
    await page.getByRole('button', { name: 'Confirmar el correo de Pedro Chávez' }).click();
    await expect(page.getByText('El correo de Pedro Chávez quedó confirmado.')).toBeVisible();
    await page.getByRole('button', { name: 'Activar a Pedro Chávez', exact: true }).click();
    await expect(page.getByText('La cuenta de Pedro Chávez quedó activa.')).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Pedro Chávez' })).toContainText('Activo');

    // La administración del sistema no se desactiva sin quitarle antes el rol.
    await page.getByRole('button', { name: 'Hacer a Luis Pérez administración del sistema' }).click();
    await expect(page.getByText('Luis Pérez es ahora administración del sistema.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Desactivar a Luis Pérez' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Quitar a Luis Pérez la administración del sistema' }).click();
    await page.getByRole('button', { name: 'Desactivar a Luis Pérez' }).click();
    await expect(page.getByText('La cuenta de Luis Pérez quedó desactivada.')).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Luis Pérez' })).toContainText('Desactivado');
  });

  test('ficha: editar datos y abrir una de sus empresas', async ({ page }) => {
    await ingresar(page, 'administracion/usuarios', 'SYSTEM_ADMIN');
    await page.getByRole('link', { name: /Rosa Chávez/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Rosa Chávez' })).toBeVisible();
    await expect(page.getByText('Todavía no está en ninguna empresa.')).toBeVisible();
    await page.getByRole('link', { name: 'Usuarios', exact: true }).first().click();

    await page.getByRole('link', { name: /Luis Pérez/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Luis Pérez' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Correo', exact: true })).toHaveValue('luis@inatrace.local');
    const datos = page.getByRole('region', { name: 'Datos' });
    await datos.getByRole('textbox', { name: 'Apellido' }).fill('');
    await datos.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Este campo es obligatorio.')).toBeVisible();
    await datos.getByRole('textbox', { name: 'Apellido' }).fill('Pérez Mora');
    await datos.getByRole('combobox', { name: 'Idioma' }).selectOption({ label: 'English' });
    await datos.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Luis Pérez Mora' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('region', { name: 'Datos' }).getByRole('combobox', { name: 'Idioma' })).toHaveValue('en');

    await page.getByRole('region', { name: 'Empresas' }).getByRole('button', { name: 'Abrir Cooperativa Flor de la Sierra' }).click();
    await expect(page).toHaveURL(/\/empresa\/usuarios$/);
  });

  test('la regional solo confirma y activa', async ({ page }) => {
    await ingresar(page, 'administracion/usuarios', 'REGIONAL_ADMIN');
    // Las desactivadas no le aparecen (como el backend).
    await expect(page.getByRole('listitem', { name: 'Jorge Mora' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Hacer|^Quitar|^Desactivar/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Activar a Marta Solís', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar el correo de Pedro Chávez' })).toBeVisible();
  });
});

test.describe('administración de cadenas de valor (modo simulado)', () => {
  test('crear con su configuración, editar, desactivar y activar', async ({ page }) => {
    await ingresar(page, 'administracion/cadenas', 'SYSTEM_ADMIN');
    await expect(page.getByRole('listitem')).toHaveCount(3);
    await page.getByRole('combobox', { name: 'Estado' }).selectOption({ label: 'Desactivada' });
    await expect(page.getByRole('listitem')).toHaveCount(1);
    await page.getByRole('combobox', { name: 'Estado' }).selectOption({ label: 'Todos' });

    await page.getByRole('link', { name: 'Nueva cadena de valor' }).click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Este campo es obligatorio.')).toHaveCount(3);
    await page.getByRole('textbox', { name: 'Nombre' }).fill('Cardamomo');
    await page.getByRole('textbox', { name: 'Descripción' }).fill('Cardamomo de Alta Verapaz');
    await page.getByRole('combobox', { name: 'Tipo de producto' }).selectOption({ label: 'Café' });
    await page.getByRole('combobox', { name: 'Agregar a semiproductos' }).selectOption({ label: 'Café pergamino' });
    await page.getByRole('button', { name: 'Agregar a semiproductos' }).click();
    await page.getByRole('combobox', { name: 'Agregar a tipos de evidencia de procesamiento' }).selectOption({ label: 'Recibo' });
    await page.getByRole('button', { name: 'Agregar a tipos de evidencia de procesamiento' }).click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Cadena «Cardamomo» guardada.')).toBeVisible();

    await page.getByRole('link', { name: /Cardamomo/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Cardamomo' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Semiproductos' })).toContainText('Café pergamino');
    await page.getByRole('button', { name: 'Quitar Recibo' }).click();
    await expect(page.getByRole('list', { name: 'Tipos de evidencia de procesamiento' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Cadena «Cardamomo» guardada.')).toBeVisible();
    await page.getByRole('link', { name: /Cardamomo/ }).click();
    await expect(page.getByRole('list', { name: 'Tipos de evidencia de procesamiento' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Cadenas de valor', exact: true }).first().click();

    page.on('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Desactivar Cardamomo' }).click();
    await expect(page.getByText('La cadena «Cardamomo» quedó desactivada.')).toBeVisible();
    // Desactivada no se edita.
    await page.getByRole('link', { name: /Cardamomo/ }).click();
    await expect(page.getByText('La cadena está desactivada: actívala para editarla.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Nombre' })).toBeDisabled();
    await page.getByRole('link', { name: 'Cadenas de valor', exact: true }).first().click();
    await page.getByRole('button', { name: 'Activar Cardamomo', exact: true }).click();
    await expect(page.getByText('La cadena «Cardamomo» quedó activa.')).toBeVisible();
  });

  test('borrar: una en uso explica por qué no; una libre se borra', async ({ page }) => {
    await ingresar(page, 'administracion/cadenas', 'SYSTEM_ADMIN');
    page.on('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar Café' }).click();
    await expect(page.getByText(/No se pudo borrar «Café»: probablemente la usan empresas/)).toBeVisible();
    await page.getByRole('button', { name: 'Borrar Miel' }).click();
    await expect(page.getByText('Cadena «Miel» borrada.')).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(2);
  });

  test('la regional crea pero no edita, activa ni borra', async ({ page }) => {
    await ingresar(page, 'administracion/cadenas', 'REGIONAL_ADMIN');
    await expect(page.getByRole('link', { name: 'Nueva cadena de valor' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Desactivar|^Activar|^Borrar/ })).toHaveCount(0);
    await page.getByRole('link', { name: /Cacao/ }).click();
    await expect(page.getByText('Solo la administración del sistema edita cadenas de valor.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar' })).toHaveCount(0);
  });
});

test.describe('administración de catálogos (modo simulado)', () => {
  test('semiproductos: crear con traducciones, editar, borrar; uno en uso se explica', async ({ page }) => {
    await ingresar(page, 'administracion/catalogos', 'SYSTEM_ADMIN');
    await expect(page.getByRole('link', { name: 'Semiproductos' })).toHaveAttribute('aria-current', 'page');
    const lista = page.getByRole('list', { name: 'Semiproductos' });
    await expect(lista.getByRole('listitem')).toHaveCount(2);

    await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
    await page.getByRole('group', { name: 'Español' }).getByRole('textbox', { name: 'Nombre (Español)' }).fill('Café oro');
    await page.getByRole('button', { name: 'Guardar' }).click();
    // El inglés es obligatorio, y la unidad también.
    await expect(page.getByText('Este campo es obligatorio.')).toHaveCount(2);
    await page.getByRole('textbox', { name: 'Nombre (Inglés)' }).fill('Green coffee');
    await page.getByRole('textbox', { name: 'Descripción (Inglés)' }).fill('Hulled coffee');
    await page.getByRole('combobox', { name: 'Unidad de medida' }).selectOption({ label: 'kg' });
    await page.getByText('Se puede comprar al productor').click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    // La lista y el aviso usan el nombre en el idioma de la interfaz.
    await expect(page.getByText('«Café oro» guardado.')).toBeVisible();
    await expect(lista.getByRole('listitem', { name: 'Café oro' })).toContainText('kg');

    await page.getByRole('button', { name: 'Editar Café oro' }).click();
    await expect(page.getByRole('textbox', { name: 'Nombre (Inglés)' })).toHaveValue('Green coffee');
    await expect(page.getByRole('checkbox', { name: 'Se puede comprar al productor' })).toBeChecked();
    await page.getByRole('textbox', { name: 'Nombre (Español)' }).fill('Café oro exportable');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('«Café oro exportable» guardado.')).toBeVisible();

    page.on('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar Café cereza' }).click();
    await expect(page.getByText(/No se pudo borrar «Café cereza»: probablemente está en uso/)).toBeVisible();
    await page.getByRole('button', { name: 'Borrar Café oro exportable' }).click();
    await expect(page.getByText('«Café oro exportable» borrado.')).toBeVisible();
    await expect(lista.getByRole('listitem')).toHaveCount(2);
  });

  test('unidades y campos de evidencia: código, peso, unidad base y tipo', async ({ page }) => {
    await ingresar(page, 'administracion/catalogos?tipo=unidades', 'SYSTEM_ADMIN');
    await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
    await page.getByRole('textbox', { name: 'Código' }).fill('saco 46');
    await page.getByRole('textbox', { name: 'Etiqueta' }).fill('Saco de 46 kg');
    await page.getByRole('textbox', { name: 'Peso en kg' }).fill('abc');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Solo mayúsculas, números y guion bajo.')).toBeVisible();
    await expect(page.getByText('Escribe un número mayor que cero.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Código' }).fill('SACO_46');
    await page.getByRole('textbox', { name: 'Peso en kg' }).fill('46');
    await page.getByRole('combobox', { name: 'Unidad base' }).selectOption({ label: 'kg' });
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('listitem', { name: 'Saco de 46 kg' })).toContainText('SACO_46 · 46 kg');

    await page.getByRole('link', { name: 'Campos de evidencia' }).click();
    await expect(page).toHaveURL(/tipo=campos-evidencia/);
    await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nombre del campo' }).fill('altura');
    // El código se escribe en mayúsculas.
    await expect(page.getByRole('textbox', { name: 'Nombre del campo' })).toHaveValue('ALTURA');
    await page.getByRole('textbox', { name: 'Etiqueta (Inglés)' }).fill('Altitude (m)');
    await page.getByRole('textbox', { name: 'Etiqueta (Español)' }).fill('Altura (m)');
    await page.getByRole('combobox', { name: 'Tipo' }).selectOption({ label: 'Número entero' });
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('listitem', { name: 'Altura (m)' })).toContainText('ALTURA · Número entero');
  });

  test('la regional crea pero ve el resto en solo lectura', async ({ page }) => {
    await ingresar(page, 'administracion/catalogos?tipo=tipos-instalacion', 'REGIONAL_ADMIN');
    await expect(page.getByRole('button', { name: /^Borrar|^Editar/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Ver Beneficio húmedo' }).click();
    await expect(page.getByText('Solo la administración del sistema edita los catálogos.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Etiqueta' })).toBeDisabled();
    await page.getByRole('button', { name: 'Volver' }).click();
    await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
    await page.getByRole('textbox', { name: 'Código' }).fill('SECADORA');
    await page.getByRole('textbox', { name: 'Etiqueta' }).fill('Secadora');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('«Secadora» guardado.')).toBeVisible();
  });
});

test.describe('administración de monedas y ajustes (modo simulado)', () => {
  test('monedas: buscar, activar y desactivar', async ({ page }) => {
    await ingresar(page, 'administracion/monedas', 'SYSTEM_ADMIN');
    const activas = page.getByRole('list', { name: 'Activas' });
    await expect(activas.getByRole('listitem')).toHaveCount(3);
    await page.getByRole('button', { name: 'Desactivadas' }).click();
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('colón');
    await expect(page.getByRole('list', { name: 'Desactivadas' }).getByRole('listitem')).toHaveCount(1);
    await page.getByRole('button', { name: 'Activar CRC' }).click();
    await expect(page.getByText('CRC · Costa Rican colón quedó activa.')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('');
    await page.getByRole('button', { name: 'Activas' }).click();
    await expect(activas.getByRole('listitem')).toHaveCount(4);
    await page.getByRole('button', { name: 'Desactivar EUR' }).click();
    await expect(page.getByText('EUR · Euro quedó desactivada.')).toBeVisible();
    await expect(activas.getByRole('listitem', { name: /^EUR/ })).toHaveCount(0);
  });

  test('la regional activa monedas pero no las desactiva ni edita ajustes', async ({ page }) => {
    await ingresar(page, 'administracion/monedas', 'REGIONAL_ADMIN');
    await expect(page.getByRole('button', { name: /^Desactivar/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Desactivadas' }).click();
    await expect(page.getByRole('button', { name: 'Activar HNL' })).toBeVisible();
    await page.getByRole('link', { name: 'Ajustes' }).click();
    await expect(page.getByText('Solo la administración del sistema edita los ajustes.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Texto para el consumidor' })).toBeDisabled();
  });

  test('ajustes: el texto de etiquetas sin publicar llega a la vitrina y el enlace a Etiquetas', async ({ page }) => {
    await ingresar(page, 'administracion/ajustes', 'SYSTEM_ADMIN');
    await page.getByRole('textbox', { name: 'Texto para el consumidor' }).fill('Este café todavía no tiene su historia publicada. Escríbenos a la cooperativa.');
    await page.getByRole('textbox', { name: 'Enlace (URL)' }).fill('no es un enlace');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Escribe un enlace válido (por ejemplo, https://ejemplo.org/ayuda).')).toBeVisible();
    await page.getByRole('textbox', { name: 'Enlace (URL)' }).fill('docs.ejemplo.org/etiquetas');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Cambios guardados')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Enlace (URL)' })).toHaveValue('https://docs.ejemplo.org/etiquetas');

    await page.goto('productos/1/etiquetas');
    await expect(page.getByRole('link', { name: 'Más información' })).toHaveAttribute('href', 'https://docs.ejemplo.org/etiquetas');

    await page.goto('p-cd/etiqueta-que-no-existe/QR-X');
    await expect(page.getByText('Este café todavía no tiene su historia publicada. Escríbenos a la cooperativa.')).toBeVisible();
  });
});

test.describe('catálogos propios: capas, certificaciones y factores (modo simulado)', () => {
  test('capas de mapa: reglas por tipo, código fijo y borrar', async ({ page }) => {
    await ingresar(page, 'administracion/catalogos?tipo=capas-mapa', 'SYSTEM_ADMIN');
    await expect(page.getByRole('listitem', { name: 'Imagen satelital' })).toContainText('SATELITE · ArcGIS MapServer');
    await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
    await page.getByRole('textbox', { name: 'Código' }).fill('CATASTRO');
    await page.getByRole('textbox', { name: 'Nombre' }).fill('Catastro municipal');
    await page.getByRole('combobox', { name: 'Tipo' }).selectOption({ label: 'Mosaico (XYZ)' });
    await page.getByRole('textbox', { name: 'Dirección (URL)' }).fill('https://tiles.ejemplo.org/{z}/{x}.png');
    await page.getByRole('textbox', { name: 'Opacidad' }).fill('2');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('La plantilla debe tener {z}, {x} y {y}.')).toBeVisible();
    await expect(page.getByText('Un número entre 0 y 1.')).toBeVisible();
    // WMS pide el nombre de la capa.
    await page.getByRole('combobox', { name: 'Tipo' }).selectOption({ label: 'Servicio WMS' });
    await page.getByRole('textbox', { name: 'Dirección (URL)' }).fill('https://mapas.ejemplo.org/wms');
    await page.getByRole('textbox', { name: 'Opacidad' }).fill('0,6');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Este campo es obligatorio.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Nombre de la capa en el servicio' }).fill('catastro:parcelas');
    await page.getByText('Encendida al abrir el mapa').click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('«Catastro municipal» guardado.')).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Catastro municipal' })).toContainText('CATASTRO · Servicio WMS · encendida al abrir');

    await page.getByRole('button', { name: 'Editar Catastro municipal' }).click();
    await expect(page.getByRole('textbox', { name: 'Código' })).toHaveAttribute('readonly', '');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    page.on('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar Catastro municipal' }).click();
    await expect(page.getByText('«Catastro municipal» borrado.')).toBeVisible();
  });

  test('tipos de certificación: uno en uso no se borra; retirar uno', async ({ page }) => {
    await ingresar(page, 'administracion/catalogos?tipo=certificaciones', 'SYSTEM_ADMIN');
    page.on('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar Orgánico' }).click();
    await expect(page.getByText('No se pudo borrar «Orgánico»: hay certificaciones que lo usan. Desmarca «Se ofrece» para retirarlo.')).toBeVisible();
    await page.getByRole('button', { name: 'Editar Comercio justo' }).click();
    await page.getByText('Se ofrece al cargar certificaciones').click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('listitem', { name: 'Comercio justo' })).toContainText('FAIRTRADE · Inactivo');
  });

  test('factores de conversión: entrada distinta de salida y el factor en palabras', async ({ page }) => {
    await ingresar(page, 'administracion/catalogos?tipo=factores', 'SYSTEM_ADMIN');
    await expect(page.getByRole('listitem', { name: 'Café cereza → Café pergamino' })).toContainText('100 → 20');
    await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
    await page.getByRole('combobox', { name: 'Lo que entra' }).selectOption({ label: 'Café pergamino' });
    await page.getByRole('combobox', { name: 'Lo que sale' }).selectOption({ label: 'Café pergamino' });
    await page.getByRole('textbox', { name: 'Factor' }).fill('0');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('No puede ser lo mismo que entra.')).toBeVisible();
    await expect(page.getByText('Un número mayor que cero.')).toBeVisible();
    await page.getByRole('combobox', { name: 'Lo que sale' }).selectOption({ label: 'Café cereza' });
    await page.getByRole('textbox', { name: 'Factor' }).fill('4,8');
    await expect(page.getByText('Por cada 100 que entran, salen 480.')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('listitem', { name: 'Café pergamino → Café cereza' })).toContainText('100 → 480');
  });
});
