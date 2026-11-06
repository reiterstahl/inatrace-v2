import { test, expect, type Page } from '@playwright/test';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '', DEMO_ETIQUETA: etiqueta = '', DEMO_QR: qr = '' } = process.env;
const VITRINA = `/v2/p-cd/${etiqueta}/${qr}`;

/** Junta las violaciones de la política de seguridad (CSP) y los errores de la página. */
function vigilar(page: Page) {
  const problemas: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) problemas.push(m.text()); });
  page.on('pageerror', (e) => problemas.push(e.message));
  return problemas;
}

test.beforeAll(() => {
  if (!usuario || !clave || !etiqueta || !qr) throw new Error('Faltan variables: ver e2e-real/README.md');
});

test('vitrina con datos reales, en español y sin violaciones de CSP', async ({ page }) => {
  const problemas = vigilar(page);
  await page.goto(VITRINA);
  await expect(page.getByRole('heading', { level: 1, name: 'Café de Guatemala — Origen Demo' })).toBeVisible();
  await page.getByRole('link', { name: /Ver el recorrido/ }).click();
  // El paso viene traducido por el backend según la cabecera "language".
  await expect(page.getByText('Generar código QR')).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/real-recorrido.png', fullPage: true });
  expect(problemas).toEqual([]);
});

test('precios y opinión contra el backend', async ({ page }) => {
  await page.goto(VITRINA + '/fair-prices');
  // 1,85 USD/lb → 5; Fairtrade 1,40 → 4; pagado 5,40 → 6.
  for (const v of ['$5', '$4', '$6']) await expect(page.getByText(v, { exact: true })).toBeVisible();
  await page.goto(VITRINA + '/feedback');
  await page.getByLabel('Tu comentario').fill('Prueba automática de la v2 contra el backend real.');
  await page.getByLabel(/Acepto que se traten mis datos/).check();
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByRole('heading', { name: '¡Gracias!' })).toBeVisible();
});

test('la sesión iniciada en la v2 vale en la interfaz actual', async ({ page }) => {
  test.skip(!!process.env.ANGULAR_RETIRADO, 'La interfaz actual se retiró (fase 6)');
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();

  await page.goto('/home');
  await page.waitForLoadState('networkidle');
  await expect(page).not.toHaveURL(/login/);
  await page.screenshot({ path: 'test-results/real-anterior-con-sesion.png' });

  // Y de vuelta: la v2 sigue con la sesión.
  await page.goto('/v2/perfil');
  await expect(page.getByRole('heading', { name: 'Mi perfil' })).toBeVisible();
});

test('la sesión iniciada en la interfaz actual vale en la v2', async ({ page }) => {
  test.skip(!!process.env.ANGULAR_RETIRADO, 'La interfaz actual se retiró (fase 6)');
  // Se ingresa por la API, igual que hace la interfaz actual (deja las mismas cookies).
  const r = await page.request.post('/api/user/login', { data: { username: usuario, password: clave } });
  expect(r.ok()).toBe(true);
  await page.goto('/v2/perfil');
  await expect(page.getByRole('heading', { name: 'Mi perfil' })).toBeVisible();
  await expect(page.getByLabel('Correo')).toHaveValue(usuario);
});

test('sin sesión, la v2 manda a ingresar', async ({ page }) => {
  await page.goto('/v2/perfil');
  await expect(page).toHaveURL(/\/v2\/ingreso\?volver=/);
});

test('un QR impreso registra la visita en el backend y abre la vitrina', async ({ page }) => {
  const respuesta = page.waitForResponse((r) => r.url().endsWith('/api/public/logRequest'));
  await page.goto(`/v2/q-cd/${etiqueta}/${qr}`);
  const r = await respuesta;
  expect(r.ok()).toBe(true);
  expect((await r.json()).status).toBe('OK'); // el backend aceptó el token
  await expect(page).toHaveURL(new RegExp(`/v2/p-cd/${etiqueta}/${qr}$`));
});
