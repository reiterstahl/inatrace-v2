import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';

async function ingresar(page: Page, destino = 'productos') {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('productos (modo simulado)', () => {
  test('lista, búsqueda y edición del producto propio', async ({ page }) => {
    await ingresar(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Productos' })).toBeVisible();
    await expect(page.getByText('2 productos')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('vecina');
    await expect(page.getByText('1 producto', { exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('');
    await page.getByRole('link', { name: 'Café Flor de la Sierra' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Café Flor de la Sierra' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Descripción del origen/ })).toHaveValue(/Huehuetenango/);
    await expect(page.getByRole('listitem', { name: 'Lugar 2' })).toBeVisible();
    await page.getByRole('textbox', { name: /^Nombre/ }).first().fill('Café Flor de la Sierra, lote especial');
    await page.getByRole('textbox', { name: /^Empaque sostenible/ }).fill('x'.repeat(1001));
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Máximo 1000 caracteres.')).toBeVisible();
    await page.getByRole('textbox', { name: /^Empaque sostenible/ }).fill('Bolsas compostables.');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Producto guardado.')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Café Flor de la Sierra, lote especial' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Empaque sostenible/ })).toHaveValue('Bolsas compostables.');
  });

  test('un producto de otra empresa se ve pero no se edita', async ({ page }) => {
    await ingresar(page, 'productos/2');
    await expect(page.getByRole('heading', { level: 1, name: 'Tueste La Vecina' })).toBeVisible();
    await expect(page.getByText('Solo la empresa dueña puede modificarlo.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Descripción$/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Borrar producto' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Guardar' })).toHaveCount(0);
  });

  test('crear un producto: obligatorios, foto, cadena y un lugar de origen en el mapa', async ({ page }) => {
    await ingresar(page, 'productos/nuevo');
    await expect(page.getByRole('heading', { level: 1, name: 'Nuevo producto' })).toBeVisible();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Revisa los campos marcados.')).toBeVisible();
    await expect(page.getByText('Agrega al menos un lugar de origen en el mapa.')).toBeVisible();

    await page.getByRole('textbox', { name: /^Nombre/ }).first().fill('Miel de la Sierra');
    await page.getByRole('combobox', { name: /^Cadena de valor/ }).selectOption({ label: 'Café' });
    await page.getByRole('textbox', { name: 'Descripción', exact: true }).fill('Miel de flor de café.');
    await page.getByLabel('Foto del producto').setInputFiles({ name: 'miel.png', mimeType: 'image/png', buffer: Buffer.from('89504e47', 'hex') });
    await expect(page.getByRole('button', { name: 'Cambiar foto' }).or(page.getByText('Cambiar foto'))).toBeVisible();
    await page.getByRole('textbox', { name: /^Descripción del origen/ }).fill('Colmenas entre cafetales.');
    // Un lugar de origen tocando el mapa.
    const mapa = page.getByRole('application', { name: 'Mapa de los lugares de origen' });
    await mapa.click({ position: { x: 200, y: 150 } });
    const lugar = page.getByRole('listitem', { name: 'Lugar 1' });
    await expect(lugar).toBeVisible();
    await lugar.getByRole('textbox', { name: /^Nombre del lugar/ }).fill('Apiario norte');
    await page.getByRole('textbox', { name: /^Cómo se produce/ }).fill('Cosecha manual.');
    await page.getByRole('textbox', { name: /^Políticas laborales/ }).fill('Pago justo.');
    await page.getByRole('textbox', { name: /^Producción sostenible/ }).fill('Sin pesticidas.');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page).toHaveURL(/productos\/\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Miel de la Sierra' })).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Lugar 1' }).getByRole('textbox', { name: /^Nombre del lugar/ })).toHaveValue('Apiario norte');
  });
});
