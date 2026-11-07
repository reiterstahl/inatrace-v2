import { test, expect, type Page } from '@playwright/test';
import { aceptarAviso } from '../e2e/avisos';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

// PNG de 1×1: el backend procesa la imagen para generar sus tamaños.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
}

async function comoEmpresa(page: Page, nombre: string) {
  await page.getByRole('combobox', { name: 'Empresa' }).selectOption({ label: nombre });
  await expect(page.getByRole('combobox', { name: 'Empresa' })).toHaveValue(/\d+/);
}

test('producto: crear con foto y origen, editar, verlo en solo lectura desde otra empresa y borrar', async ({ page }) => {
  test.setTimeout(120_000);
  const nombre = 'Producto E2E ' + Date.now().toString().slice(-6);
  await ingresar(page);
  await comoEmpresa(page, 'Empresa Demo GIZ');

  // 1. Alta.
  await page.goto('/v2/productos/nuevo');
  await page.getByRole('textbox', { name: /^Nombre/ }).first().fill(nombre);
  await page.getByRole('combobox', { name: /^Cadena de valor/ }).selectOption({ index: 1 });
  await page.getByRole('textbox', { name: 'Descripción', exact: true }).fill('Producto de prueba de la v2.');
  await page.getByLabel('Foto del producto').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Cambiar foto')).toBeVisible();
  await page.getByRole('textbox', { name: /^Descripción del origen/ }).fill('Huehuetenango.');
  await page.getByRole('application', { name: 'Mapa de los lugares de origen' }).click({ position: { x: 220, y: 140 } });
  await page.getByRole('listitem', { name: 'Lugar 1' }).getByRole('textbox', { name: /^Nombre del lugar/ }).fill('Finca de prueba');
  await page.getByRole('textbox', { name: /^Cómo se produce/ }).fill('Lavado.');
  await page.getByRole('textbox', { name: /^Políticas laborales/ }).fill('Pago justo.');
  await page.getByRole('textbox', { name: /^Producción sostenible/ }).fill('Bajo sombra.');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/productos\/\d+$/);
  const id = page.url().split('/').pop();
  await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible();
  // La foto se ve (ruta autenticada de imágenes).
  const foto = await page.getByRole('img', { name: `Foto de ${nombre}` }).getAttribute('src');
  expect((await page.request.get(foto!)).status()).toBe(200);

  // 2. Edición: lo que no está en la ficha se conserva (el backend reescribe todo lo que recibe).
  await page.getByRole('textbox', { name: /^Huella de carbono/ }).fill('0,9 kg');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Producto guardado.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: /^Huella de carbono/ })).toHaveValue('0,9 kg');
  await expect(page.getByRole('listitem', { name: 'Lugar 1' }).getByRole('textbox', { name: /^Nombre del lugar/ })).toHaveValue('Finca de prueba');
  const desdeApi = (await (await page.request.get(`/api/product/${id}`)).json()).data;
  expect(desdeApi.associatedCompanies.some((a: { type: string }) => a.type === 'OWNER')).toBe(true);

  // 3. El producto 1 de la productora, visto desde la exportadora asociada: solo lectura.
  await comoEmpresa(page, 'Exportadora Demo (v2)');
  await page.goto('/v2/productos/1');
  await expect(page.getByText('Solo la empresa dueña puede modificarlo.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar' })).toHaveCount(0);

  // 4. Limpieza: borrar el producto de prueba.
  await comoEmpresa(page, 'Empresa Demo GIZ');
  await page.goto(`/v2/productos/${id}`);
  await aceptarAviso(page);
  await page.getByRole('button', { name: 'Borrar producto' }).click();
  await expect(page).toHaveURL(/productos$/);
  expect((await (await page.request.get(`/api/product/${id}`)).json()).status).not.toBe('OK');
});
