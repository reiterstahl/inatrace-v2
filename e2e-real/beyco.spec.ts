import { test, expect, type Page } from '@playwright/test';
import { completarNombres, ofertaDesdeCampos } from '../src/util/beyco';
import { aceptarAviso } from '../e2e/avisos';
import { elegirEmpresa } from '../e2e/cuenta';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

/**
 * Beyco contra el backend real, sin cuenta de Beyco. Necesita Beyco habilitado en la empresa demo
 * (scripts/sembrar-beyco.mjs, solo en la copia aislada). Se prueba todo lo que no depende de Beyco:
 * el botón, la salida con sus parámetros y el state, la vuelta, que el backend no pueda cambiar el
 * código sin Beyco configurado, y la precarga de la oferta que arma el backend desde el lote.
 */
const BEYCO = 'https://beyco.prueba/oauth/authorize';

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
  await elegirEmpresa(page, 'Empresa Demo GIZ');
}

const filaCon = (page: Page, cantidad: string) => page.locator('tbody tr').filter({ has: page.getByRole('cell', { name: new RegExp(`^${cantidad} `) }) });

test('Beyco: salida y vuelta con state, error limpio sin Beyco, y precarga de la oferta desde el lote', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  // La instalación con Beyco configurado (lo que pondrían BEYCO_AUTH_URL y BEYCO_CLIENT_ID).
  await page.route('**/v2/config.js', (r) =>
    r.fulfill({ contentType: 'application/javascript', body: `window.__INATRACE__ = { tokenRegistro: 'token', urlPublica: '', rutaQr: 'q-cd', beycoUrl: '${BEYCO}', beycoClientId: 'cliente-prueba' };` }),
  );
  let salida: URL | null = null;
  await page.route(`${BEYCO}**`, (r) => {
    salida = new URL(r.request().url());
    // Beyco autoriza y vuelve con el mismo state.
    return r.fulfill({ status: 302, headers: { Location: `${baseURL}/v2/stock/beyco?code=codigo-de-prueba&scope=Offer%3ACreate&state=${salida.searchParams.get('state')}` } });
  });

  const bruto = String(3700 + (Date.now() % 89)); // sobre 3000 kg: no choca con la copia llena
  await ingresar(page);

  // 1. Un lote de café oro en la instalación pública.
  await page.goto('/v2/stock/entregas/nueva');
  await page.getByRole('combobox', { name: /^Instalación/ }).selectOption({ label: 'Centro de acopio — Bodega Demo' }); // hay más de un centro de acopio
  const buscador = page.getByRole('combobox', { name: /^Productor/ });
  await buscador.fill('Rodr');
  await expect(page.getByRole('listbox').getByRole('option', { name: /María Rodríguez/ })).toBeVisible();
  await buscador.press('Enter');
  await page.getByRole('combobox', { name: /^Semiproducto/ }).selectOption({ label: 'Café oro/verde' });
  await page.getByRole('textbox', { name: /^Peso bruto/ }).fill(bruto);
  await page.getByRole('textbox', { name: /^Precio por unidad/ }).fill('2');
  await page.getByRole('combobox', { name: /^Moneda/ }).fill('USD');
  await page.getByRole('combobox', { name: /^Forma de pago/ }).selectOption({ label: 'Efectivo' });
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Entregas', exact: true })).toBeVisible();

  // 2. La precarga que arma el backend desde ese lote.
  await page.goto('/v2/stock/todo');
  await page.getByRole('combobox', { name: 'Instalación' }).selectOption({ label: 'Centro de acopio — Bodega Demo' });
  const fila = filaCon(page, bruto).first();
  await expect(fila).toBeVisible();
  const enlace = await fila.getByRole('link').first().getAttribute('href');
  const id = Number(enlace!.split('/').pop());
  const lote = (await fila.getByRole('link').first().innerText()).trim();
  const respuesta = await page.request.get(`/api/chain/beyco-order/company/1/fields?id=${id}`);
  expect(respuesta.ok()).toBe(true);
  const campos = (await respuesta.json()).data;
  const oferta = ofertaDesdeCampos(campos);
  expect(oferta.cafes).toHaveLength(1);
  // El backend nombra el café con el número interno del lote, que una entrega no tiene: llega vacío
  // y la v2 lo completa con el identificador (completarNombres, probado en las unitarias y simuladas).
  expect(oferta.cafes[0]!.lote).toBe('');
  expect(completarNombres(oferta, [{ identifier: lote }]).cafes[0]!.nombre).toBe(lote);
  expect(oferta.cafes[0]!.cosecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(campos.privacy).toBe('Public');

  // 3. Elegir el lote y salir hacia Beyco.
  const exportar = page.getByRole('button', { name: /^Exportar a Beyco/ });
  await expect(exportar).toBeDisabled();
  await fila.getByRole('checkbox').check();
  await exportar.click();

  // 4. La salida lleva los parámetros de la versión actual y vuelve; sin Beyco el backend no puede dar el token.
  await expect(page.getByText('No se pudo conectar con Beyco')).toBeVisible();
  expect(salida).not.toBeNull();
  const q = salida!.searchParams;
  expect(q.get('responseType')).toBe('code');
  expect(q.get('clientId')).toBe('cliente-prueba');
  expect(q.get('scope')).toBe('Offer:Create');
  expect(q.get('redirectUri')).toBe(`${baseURL}/v2/stock/beyco`);
  expect(q.get('state')).toMatch(/^[0-9a-f-]{36}$/);

  // 5. Limpieza: borrar la entrega.
  await page.goto('/v2/stock/todo');
  await page.getByRole('combobox', { name: 'Instalación' }).selectOption({ label: 'Centro de acopio — Bodega Demo' });
  await aceptarAviso(page);
  await filaCon(page, bruto).first().getByRole('button', { name: 'Borrar entrega' }).click();
  await expect(filaCon(page, bruto)).toHaveCount(0);
});
