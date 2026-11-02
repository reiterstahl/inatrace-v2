import { test, expect, type Page } from '@playwright/test';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Empresa' }).selectOption({ label: 'Empresa Demo GIZ' });
}

test('tablero: el backend acepta los filtros de entregas y de rendimiento, y exporta', async ({ page }) => {
  test.setTimeout(90_000);
  await ingresar(page);
  const respuestas: { url: string; status: number }[] = [];
  page.on('response', (r) => { if (r.url().includes('/api/dashboard/')) respuestas.push({ url: r.url(), status: r.status() }); });
  await page.goto('/v2/stock/tablero');

  const entregas = page.getByRole('region', { name: 'Entregas' });
  await expect(entregas.getByText(/^Total: /)).toBeVisible();
  // Con un rango corto el backend agrupa por día y la v2 lo muestra.
  await entregas.getByLabel('Desde', { exact: true }).fill('2026-10-01');
  await entregas.getByLabel('Hasta', { exact: true }).fill('2026-10-05');
  await expect(entregas.getByText(/por día/)).toBeVisible();
  await entregas.getByRole('checkbox', { name: 'Solo orgánico' }).check();
  await expect(entregas.getByText(/^Total: /)).toBeVisible();
  const descarga = page.waitForEvent('download');
  await entregas.getByRole('button', { name: 'Exportar en Excel' }).click();
  expect((await descarga).suggestedFilename()).toBe('entregas.xlsx');

  const rendimiento = page.getByRole('region', { name: 'Rendimiento del procesamiento' });
  await expect(rendimiento.getByRole('combobox', { name: 'Proceso' })).toBeVisible();
  // Con o sin procesos en el rango (la copia aislada puede no tener), sin errores.
  await expect(rendimiento.getByRole('button', { name: 'Ver como tabla' }).first().or(rendimiento.getByText('No hay datos para estos filtros.'))).toBeVisible();
  const csv = page.waitForEvent('download');
  await rendimiento.getByRole('button', { name: 'Exportar en CSV' }).click();
  expect((await csv).suggestedFilename()).toBe('procesamiento.csv');

  // Ninguna llamada al tablero falló.
  expect(respuestas.length).toBeGreaterThan(3);
  expect(respuestas.filter((r) => r.status >= 400)).toEqual([]);
});
