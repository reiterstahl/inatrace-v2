import { test, expect, type Page } from '@playwright/test';
import { aceptarAvisos } from '../e2e/avisos';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
}

/**
 * Deja una empresa desactivada por corrida (el backend no borra empresas). Quien la crea queda
 * inscrito en ella, así que también aparece en su selector de empresas.
 */
test('administración: crear una empresa, abrirla, buscarla, desactivarla y fusionar', async ({ page }) => {
  test.setTimeout(90_000);
  await ingresar(page);
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Administración' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Administración' })).toBeVisible();
  // Cada corrida suma empresas de prueba: se busca para no depender de la primera página.
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('Empresa Demo GIZ');
  await expect(page.getByRole('listitem', { name: 'Empresa Demo GIZ' })).toContainText('Activa');
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('');

  const nombre = 'E2E Admin ' + Date.now().toString().slice(-6);
  await page.getByRole('button', { name: 'Nueva empresa' }).click();
  await page.getByRole('textbox', { name: 'Nombre' }).fill(nombre);
  await page.getByRole('button', { name: 'Crear y abrir' }).click();
  await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible();
  await page.getByRole('button', { name: 'Menú de la cuenta' }).click();
  await expect(page.getByRole('combobox', { name: 'Empresa' }).locator('option:checked')).toHaveText(nombre);
  await page.keyboard.press('Escape');

  await page.goto('/v2/administracion/empresas');
  await page.getByRole('searchbox', { name: 'Buscar' }).fill(nombre);
  const fila = page.getByRole('listitem', { name: nombre });
  await expect(page.getByRole('listitem')).toHaveCount(1);

  // La recién creada solo puede fusionarse hacia una activa (nunca a sí misma).
  await aceptarAvisos(page);
  await page.getByRole('button', { name: `Activar ${nombre}`, exact: true }).click();
  await expect(fila).toContainText('Activa');
  await page.getByRole('button', { name: `Fusionar ${nombre} con otra empresa` }).click();
  await page.getByRole('searchbox', { name: 'Buscar destino' }).fill('Empresa Demo');
  const destino = page.getByRole('combobox', { name: 'Empresa de destino' });
  await expect(destino.getByRole('option', { name: 'Empresa Demo GIZ' })).toBeAttached();
  await expect(destino.getByRole('option', { name: nombre })).toHaveCount(0);
  // Quien la creó ya está en la demo: la fusión no suma a nadie y desactiva la nueva.
  await destino.selectOption({ label: 'Empresa Demo GIZ' });
  await fila.getByRole('button', { name: 'Fusionar', exact: true }).click();
  await expect(page.getByText(`Las personas de ${nombre} pasaron a Empresa Demo GIZ; ${nombre} quedó desactivada.`)).toBeVisible();
  await expect(fila).toContainText('Desactivada');

  await page.getByRole('button', { name: `Activar ${nombre}`, exact: true }).click();
  await expect(fila).toContainText('Activa');
  await page.getByRole('button', { name: `Desactivar ${nombre}` }).click();
  await expect(page.getByText(`${nombre} quedó desactivada.`)).toBeVisible();
  await expect(fila).toContainText('Desactivada');
  const r = await (await page.request.get(`/api/company/admin/list?name=${encodeURIComponent(nombre)}`)).json();
  expect(r.data.items[0].status).toBe('DEACTIVATED');
});
