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

// Un PNG de 1×1 para el logo.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test('empresa: la ficha guarda sobre lo que ya tenía y los usuarios no quedan sin administración', async ({ page }) => {
  test.setTimeout(90_000);
  await ingresar(page);
  const ficha = async () => (await (await page.request.get('/api/company/profile/1')).json()).data;
  const original = await ficha();

  try {
    await page.goto('/v2/empresa');
    await expect(page.getByRole('heading', { level: 1, name: 'Empresa Demo GIZ' })).toBeVisible();
    const entrevista = 'Entrevista E2E ' + Date.now().toString().slice(-6);
    await page.getByRole('textbox', { name: 'Entrevista' }).fill(entrevista);
    // Con H26 el backend guarda la gerencia.
    await page.getByRole('textbox', { name: 'Gerencia' }).fill('Gerencia E2E');
    // La demo no tiene logo, teléfono ni moneda, que la ficha exige.
    if (!original.phone) await page.getByRole('textbox', { name: /^Teléfono de contacto/ }).fill('+506 2222 0000');
    if (!original.currency) await page.getByRole('combobox', { name: /^Moneda base/ }).selectOption({ index: 1 });
    if (!original.logo) await page.getByLabel('Logo', { exact: true }).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('img', { name: 'Logo' })).toBeVisible();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Empresa guardada.')).toBeVisible();

    const guardada = await ficha();
    expect(guardada.interview).toBe(entrevista);
    expect(guardada.manager).toBe('Gerencia E2E');
    // Lo que la ficha no tocó sigue igual (el backend reemplaza todo lo que recibe).
    expect(guardada.name).toBe(original.name);
    expect(guardada.headquarters).toEqual(original.headquarters);
    const ids = (l: { id: number }[]) => l.map((x) => x.id).sort((a, b) => a - b);
    // Los mismos documentos (actualizados, no recreados); el backend no garantiza el orden.
    expect(ids(guardada.documents)).toEqual(ids(original.documents));
    expect(guardada.valueChains.map((c: { id: number }) => c.id)).toEqual(original.valueChains.map((c: { id: number }) => c.id));
    expect(guardada.users.map((u: { id: number }) => u.id)).toEqual(original.users.map((u: { id: number }) => u.id));
    expect(guardada.allowBeycoIntegration).toBe(original.allowBeycoIntegration);

    // Usuarios: la única persona con administración no puede perder el rol.
    await page.getByRole('link', { name: 'Usuarios' }).click();
    const yo = page.getByRole('listitem', { name: 'Admin INATrace' });
    await expect(yo).toContainText('admin@inatrace.local');
    await page.getByRole('combobox', { name: 'Rol de Admin INATrace' }).selectOption({ label: 'Gerencia' });
    await expect(page.getByText('No se puede: es la única persona con rol de administración.', { exact: false })).toBeVisible();
    // La búsqueda va contra las cuentas de la instancia y no ofrece a quien ya está en la empresa.
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('admin');
    await expect(page.getByText('No hay cuentas que coincidan (o ya están en la empresa).')).toBeVisible();
  } finally {
    // Deja la ficha como estaba (sin usuarios: esos no se tocan por esta ruta).
    const { users: _u, actions: _a, companyRoles: _c, supportsCollectors: _s, ...resto } = original;
    const r = await (await page.request.put('/api/company/profile', { data: resto })).json();
    expect(r.status).toBe('OK');
  }
});
