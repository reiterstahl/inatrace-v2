import { test, expect, VITRINA } from './ayudas';

test.describe('vitrina pública', () => {
  test('portada con el nombre del producto y sus secciones', async ({ page }) => {
    await page.goto(VITRINA);
    await expect(page.getByRole('heading', { level: 1, name: 'Café Altos de la Sierra' })).toBeVisible();
    for (const s of ['Recorrido', 'Precios justos', 'Productores', 'Calidad', 'Tu opinión']) {
      await expect(page.getByRole('link', { name: s }).first()).toBeVisible();
    }
    await expect(page).toHaveTitle(/Café Altos de la Sierra/);
  });

  test('recorrido: del escaneo a la cosecha', async ({ page }) => {
    await page.goto(VITRINA);
    await page.getByRole('link', { name: /Ver el recorrido/ }).click();
    await expect(page).toHaveURL(/\/journey$/);
    const pasos = page.getByRole('listitem').filter({ hasText: /Tu escaneo|Exportación|Trillado|Beneficio|Cosecha/ });
    await expect(pasos).toHaveCount(5);
    await expect(page.getByText('Productores de Cooperativa Flor de la Sierra')).toBeVisible();
    await expect(page.getByText('paso 2 de 2 · Ciudad de Guatemala')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Mapa del recorrido' })).toBeAttached();
  });

  test('precios: mismas cifras que la versión actual', async ({ page }) => {
    await page.goto(VITRINA + '/fair-prices');
    await expect(page.getByText(/pedido PED-2026-0142/)).toBeVisible();
    // 1,85 USD/lb → 5 USD/kg; Fairtrade 1,40 USD/lb → 4; pagado 5,20 → 6 (redondeo hacia arriba).
    for (const v of ['$5', '$4', '$6']) await expect(page.getByText(v, { exact: true })).toBeVisible();
    await expect(page.getByText('+17%')).toBeVisible();
    await expect(page.getByText('precio por encima del mercado')).toBeVisible();
  });

  test('calidad y certificados', async ({ page }) => {
    await page.goto(VITRINA + '/quality');
    await expect(page.getByText('86.5 puntos')).toBeVisible();
    await expect(page.getByText('Orgánico')).toBeVisible();
    await expect(page.getByRole('link', { name: /Descargar|certificado/i }).first()).toHaveAttribute('href', '/api/public/document/cert-1');
  });

  test('opinión: pide consentimiento y luego agradece', async ({ page }) => {
    await page.goto(VITRINA + '/feedback');
    await page.getByLabel('Tu comentario').fill('Muy rico, gracias.');
    await page.getByText('Mejor', { exact: true }).click();
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByText('Necesitamos tu consentimiento')).toBeVisible();
    await page.getByLabel(/Acepto que se traten mis datos/).check();
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('heading', { name: '¡Gracias!' })).toBeVisible();
  });

  test('textos legales saneados y enlaces peligrosos descartados', async ({ page }) => {
    await page.goto(VITRINA + '/privacy-policy');
    await expect(page.getByRole('heading', { name: 'Política de privacidad' })).toBeVisible();
    await expect(page.getByText('Solo usamos tu correo para responderte.')).toBeVisible();
    // El enlace "javascript:" cargado en la etiqueta no se muestra; los demás sí.
    await expect(page.getByRole('link', { name: /Instagram/ })).toHaveAttribute('href', 'https://instagram.com/');
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  });

  test('etiqueta inexistente', async ({ page }) => {
    await page.goto('p-cd/no-existe/EMPTY');
    await expect(page.getByRole('heading', { name: 'No encontramos este producto' })).toBeVisible();
  });

  test('cambiar de idioma', async ({ page }) => {
    await page.goto(VITRINA + '/journey');
    await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
    await expect(page.getByRole('heading', { name: 'Product journey' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Product journey' })).toBeVisible();
  });
});
