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
    await expect(acuerdo.getByText('acuerdo.pdf')).toBeVisible();
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
    await page.getByRole('link', { name: 'Base de conocimiento' }).click();
    await expect(page.getByText('La base de conocimiento la administra la empresa dueña del producto.')).toBeVisible();
  });

  test('base de conocimiento: filtrar por tema, crear con documentos y video, vista previa y editar', async ({ page }) => {
    await ingresar(page, 'productos/1/conocimiento');
    await expect(page.getByRole('link', { name: 'Base de conocimiento' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('3 entradas')).toBeVisible();
    await page.getByRole('group', { name: 'Filtrar por tema' }).getByRole('button', { name: 'Calidad' }).click();
    await expect(page.getByText('1 entrada', { exact: true })).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Catación de la cosecha 2026' })).toContainText('Con video');
    await page.getByRole('group', { name: 'Filtrar por tema' }).getByRole('button', { name: 'Todas' }).click();

    await page.getByRole('button', { name: 'Nueva entrada' }).click();
    const form = page.getByRole('group', { name: 'Nueva entrada' });
    await form.getByRole('textbox', { name: 'Video' }).fill('no es un enlace');
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(form.getByText('Este campo es obligatorio.')).toHaveCount(2);
    await expect(form.getByText('Escribe un enlace válido (https://…).')).toBeVisible();
    await form.getByRole('combobox', { name: 'Tema' }).selectOption({ label: 'Origen' });
    await form.getByRole('textbox', { name: 'Título' }).fill('La finca El Mirador');
    await form.getByLabel('Fecha', { exact: true }).fill('2026-10-20');
    await form.getByRole('textbox', { name: 'Contenido' }).fill('<p>Está a <strong>1.900 m</strong>.</p><script>alert(1)</script>');
    await form.getByRole('textbox', { name: 'Video' }).fill('youtu.be/finca');
    await form.getByLabel('Documentos', { exact: true }).setInputFiles([
      { name: 'mapa.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
      { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('png') },
    ]);
    await expect(form.getByRole('link', { name: 'foto.png' })).toBeVisible();
    await form.getByRole('button', { name: 'Quitar foto.png' }).click();
    await form.getByRole('button', { name: 'Vista previa' }).click();
    const previa = form.getByRole('article', { name: 'Vista previa de la entrada' });
    await expect(previa.getByRole('heading', { name: 'La finca El Mirador' })).toBeVisible();
    await expect(previa.locator('strong')).toHaveText('1.900 m');
    await expect(previa.locator('script')).toHaveCount(0);
    await expect(previa.getByRole('link', { name: 'Ver el video' })).toHaveAttribute('href', 'https://youtu.be/finca');
    await expect(previa.getByRole('link', { name: 'mapa.pdf' })).toBeVisible();
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Se guardó «La finca El Mirador».')).toBeVisible();
    await expect(page.getByText('4 entradas')).toBeVisible();

    await page.getByRole('listitem', { name: 'La finca El Mirador' }).getByRole('button', { name: 'Editar' }).click();
    const edicion = page.getByRole('group', { name: 'Editar entrada' });
    await expect(edicion.getByText('El tema no se puede cambiar después de crear la entrada.')).toBeVisible();
    await expect(edicion.getByRole('textbox', { name: 'Video' })).toHaveValue('https://youtu.be/finca');
    await expect(edicion.getByRole('link', { name: 'mapa.pdf' })).toBeVisible();
    await edicion.getByRole('textbox', { name: 'Título' }).fill('La finca El Mirador, Todos Santos');
    await edicion.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('listitem', { name: 'La finca El Mirador, Todos Santos' })).toContainText('Origen');

    // El backend no borra un producto con entradas (H25): la v2 avisa antes de intentarlo.
    let mensaje = '';
    page.once('dialog', (d) => { mensaje = d.message(); void d.accept(); });
    await page.getByRole('button', { name: 'Borrar producto' }).click();
    await expect.poll(() => mensaje).toContain('tiene 4 entradas en la base de conocimiento');
    await expect(page.getByRole('heading', { level: 1, name: 'Café Flor de la Sierra' })).toBeVisible();
  });
});
