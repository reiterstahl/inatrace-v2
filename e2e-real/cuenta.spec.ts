import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Ciclo completo de una cuenta nueva contra el backend real, con los correos que el backend manda a
 * MailHog (MAILHOG_URL, por ejemplo http://IP-del-contenedor:8025). Deja la cuenta desactivada.
 */
const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '', MAILHOG_URL: mailhog = '' } = process.env;

/** El código del último correo a esa dirección cuyo enlace contiene `ruta` (por ejemplo «confirm-email/»). */
async function codigoDelCorreo(request: APIRequestContext, correo: string, ruta: string, anteriores: string[] = []): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const r = await request.get(`${mailhog}/api/v2/search?kind=to&query=${encodeURIComponent(correo)}`);
    const items = (await r.json()).items as { Content: { Body: string } }[];
    for (const m of items) {
      // Quoted-printable: se quitan los cortes suaves y se decodifica «=3D».
      const cuerpo = m.Content.Body.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
      const codigo = cuerpo.match(new RegExp(`${ruta}([A-Za-z0-9_-]+)`))?.[1];
      if (codigo && !anteriores.includes(codigo)) return codigo;
    }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  throw new Error(`No llegó el correo con ${ruta} a ${correo}`);
}

async function restablecer(page: Page, codigo: string, nueva: string) {
  await page.goto(`/v2/reset-password/${codigo}`);
  await page.getByLabel('Contraseña nueva').fill(nueva);
  await page.getByLabel('Repite la contraseña').fill(nueva);
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
}

test('cuenta: registrarse, confirmar, restablecer sin activar y, ya activa, entrar', async ({ page, request, browser }) => {
  test.skip(!mailhog, 'Falta MAILHOG_URL');
  test.setTimeout(150_000);
  const sufijo = Date.now().toString().slice(-6);
  const correo = `e2e-cuenta-${sufijo}@inatrace.local`;

  // Registro desde la pantalla de ingreso.
  await page.goto('/v2/ingreso');
  await page.getByRole('link', { name: 'Crear una cuenta' }).click();
  await page.getByRole('textbox', { name: 'Nombre' }).fill('E2E');
  await page.getByRole('textbox', { name: 'Apellido' }).fill(`Cuenta ${sufijo}`);
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(`Primera-${sufijo}`);
  await page.getByLabel('Repite la contraseña').fill(`Primera-${sufijo}`);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();

  // Confirmar con el enlace del correo; el mismo enlace no sirve dos veces.
  const confirmar = await codigoDelCorreo(request, correo, 'confirm-email/');
  await page.goto(`/v2/confirm-email/${confirmar}`);
  await expect(page.getByText(/Tu correo quedó confirmado/)).toBeVisible();
  await page.goto(`/v2/confirm-email/${confirmar}`);
  await expect(page.getByText('El enlace no es válido o ya se usó. Pide uno nuevo.')).toBeVisible();

  // Restablecer antes de que la activen: cambia la contraseña pero no abre sesión.
  const pedir = async () => {
    await page.goto('/v2/olvide-clave');
    await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(correo);
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByText(/te enviamos un enlace para elegir una contraseña nueva/)).toBeVisible();
  };
  await pedir();
  const primero = await codigoDelCorreo(request, correo, 'reset-password/');
  await restablecer(page, primero, `Segunda-${sufijo}`);
  await expect(page.getByText(/Tu contraseña cambió. Podrás ingresar con ella cuando la administración/)).toBeVisible();

  // La administración la activa; ahora restablecer abre la sesión y entra al portal.
  const admin = await browser.newContext();
  const api = admin.request;
  await api.post('/api/user/login', { data: { username: usuario, password: clave } });
  const [cuenta] = (await (await api.get(`/api/user/admin/list?query=${encodeURIComponent(correo)}`)).json()).data.items;
  expect(cuenta.status).toBe('CONFIRMED_EMAIL');
  expect((await (await api.post('/api/user/admin/execute/ACTIVATE_USER', { data: { id: cuenta.id } })).json()).status).toBe('OK');

  try {
    await pedir();
    const segundo = await codigoDelCorreo(request, correo, 'reset-password/', [primero]);
    await restablecer(page, segundo, `Tercera-${sufijo}`);
    await expect(page.getByRole('heading', { name: /^Hola, E2E/ })).toBeVisible();
  } finally {
    await api.post('/api/user/admin/execute/DEACTIVATE_USER', { data: { id: cuenta.id } });
    await admin.close();
  }
});
