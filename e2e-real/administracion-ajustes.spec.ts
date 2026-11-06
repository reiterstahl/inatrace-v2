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
 * Solo lectura: activar una moneda hace que el backend consulte un servicio externo sin tiempo límite
 * (H33) y puede dejar el pedido colgado. Activar y desactivar se prueban con datos simulados.
 */
test('monedas: listas de activas y desactivadas y búsqueda, como la API', async ({ page }) => {
  await ingresar(page);
  const api = async (cuales: string, q = '') => (await (await page.request.get(`/api/chain/currency-type/list/${cuales}?limit=500&query=${q}`)).json()).data.count;
  await page.goto('/v2/administracion/monedas');
  await expect(page.getByText(new RegExp(`^${await api('enabled')} monedas?$`))).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('us');
  await expect(page.getByRole('list', { name: 'Activas' }).getByRole('listitem')).toHaveCount(await api('enabled', 'us'));
  await page.getByRole('button', { name: 'Desactivadas' }).click();
  const desactivadas = await api('disabled', 'us');
  if (desactivadas) await expect(page.getByRole('list', { name: 'Desactivadas' }).getByRole('listitem')).toHaveCount(desactivadas);
  else await expect(page.getByText('Ninguna moneda coincide.')).toBeVisible();
});

/** Cambia los dos ajustes, comprueba dónde se usan y deja los valores que había. */
test('ajustes: texto de etiquetas sin publicar en la vitrina y enlace de ayuda en Etiquetas', async ({ page, browser }) => {
  test.setTimeout(90_000);
  await ingresar(page);
  const leer = async (n: string) => (await (await page.request.get(`/api/common/globalSettings/${n}`)).json()).data?.value ?? '';
  const antes = { texto: await leer('UNPUBLISHED_PRODUCT_LABEL_TEXT'), enlace: await leer('PRODUCT_LABELS_HELPER_LINK') };
  const texto = 'E2E: esta etiqueta todavía no está publicada ' + Date.now().toString().slice(-6);

  try {
    await page.goto('/v2/administracion/ajustes');
    await page.getByRole('textbox', { name: 'Texto para el consumidor' }).fill(texto);
    await page.getByRole('textbox', { name: 'Enlace (URL)' }).fill('docs.agstack.org');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Cambios guardados')).toBeVisible();
    expect(await leer('PRODUCT_LABELS_HELPER_LINK')).toBe('https://docs.agstack.org');

    await page.goto('/v2/productos');
    await page.getByRole('link', { name: /Café/ }).first().click();
    await page.getByRole('link', { name: 'Etiquetas' }).click();
    await expect(page.getByRole('link', { name: 'Más información' })).toHaveAttribute('href', 'https://docs.agstack.org');

    // La vitrina, sin sesión: el texto es público; el enlace, no.
    const anonimo = await browser.newContext();
    const vitrina = await anonimo.newPage();
    await vitrina.goto('/v2/p-cd/no-existe-e2e/QR-E2E');
    await expect(vitrina.getByText(texto)).toBeVisible();
    const enlacePublico = await (await vitrina.request.get('/api/public/globalSettings/PRODUCT_LABELS_HELPER_LINK')).json();
    expect(enlacePublico.data?.value ?? null).toBeNull();
    await anonimo.close();
  } finally {
    for (const [n, v, publico] of [['UNPUBLISHED_PRODUCT_LABEL_TEXT', antes.texto, true], ['PRODUCT_LABELS_HELPER_LINK', antes.enlace, false]] as const) {
      await page.request.post(`/api/common/globalSettings/${n}`, { data: { value: v, isPublic: publico } });
    }
  }
});
