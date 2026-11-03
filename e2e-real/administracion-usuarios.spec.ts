import { test, expect, type Page } from '@playwright/test';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
}

/**
 * Registra una cuenta desechable y la lleva por todos los estados y roles. Deja una cuenta
 * desactivada por corrida (el backend no borra cuentas). Activarla manda un correo de aviso.
 */
test('administración de usuarios: confirmar, activar, roles, datos y desactivar', async ({ page }) => {
  test.setTimeout(90_000);
  const sufijo = Date.now().toString().slice(-6);
  const correo = `e2e-usuario-${sufijo}@inatrace.local`;
  const r = await page.request.post('/api/user/register', { data: { email: correo, password: `E2e-${sufijo}-Clave!`, name: 'E2E', surname: `Cuenta ${sufijo}` } });
  expect((await r.json()).status).toBe('OK');
  const nombre = `E2E Cuenta ${sufijo}`;

  await ingresar(page);
  await page.goto('/v2/administracion/usuarios');
  await page.getByRole('searchbox', { name: 'Buscar' }).fill(correo);
  const fila = page.getByRole('listitem', { name: nombre });
  await expect(fila).toContainText('Sin confirmar');

  page.on('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: `Confirmar el correo de ${nombre}` }).click();
  await expect(fila).toContainText('Correo confirmado');
  await page.getByRole('button', { name: `Activar a ${nombre}`, exact: true }).click();
  await expect(fila).toContainText('Activo');
  await page.getByRole('button', { name: `Hacer a ${nombre} administración regional` }).click();
  await expect(fila).toContainText('Administración regional');
  await page.getByRole('button', { name: `Quitar a ${nombre} la administración regional` }).click();
  await expect(fila).not.toContainText('Administración regional');

  // Ficha: datos y sin empresas.
  await fila.getByRole('link').click();
  await expect(page.getByText('Todavía no está en ninguna empresa.')).toBeVisible();
  const datos = page.getByRole('region', { name: 'Datos' });
  await datos.getByRole('textbox', { name: 'Nombre' }).fill('E2E editada');
  await datos.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { level: 2, name: `E2E editada Cuenta ${sufijo}` })).toBeVisible();
  await page.getByRole('button', { name: `Desactivar a E2E editada Cuenta ${sufijo}` }).click();
  await expect(page.getByText(`La cuenta de E2E editada Cuenta ${sufijo} quedó desactivada.`)).toBeVisible();

  const lista = await (await page.request.get(`/api/user/admin/list?query=${encodeURIComponent(correo)}`)).json();
  expect(lista.data.items[0]).toMatchObject({ name: 'E2E editada', status: 'DEACTIVATED', role: 'USER' });
});

test('administración de usuarios: la ficha muestra las empresas de la persona', async ({ page }) => {
  await ingresar(page);
  await page.goto('/v2/administracion/usuarios');
  await page.getByRole('searchbox', { name: 'Buscar' }).fill(usuario);
  await page.getByRole('listitem').first().getByRole('link').click();
  // El backend responde las empresas aunque el tipo generado no las declare.
  await expect(page.getByRole('region', { name: 'Empresas' }).getByRole('listitem', { name: 'Empresa Demo GIZ' })).toBeVisible();
  // Sobre la propia cuenta no hay acciones.
  await expect(page.getByRole('button', { name: /^Desactivar|^Hacer|^Quitar/ })).toHaveCount(0);
});
