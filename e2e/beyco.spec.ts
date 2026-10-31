import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';

async function ingresar(page: Page, destino: string) {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

/**
 * Beyco en modo simulado: no hay Beyco de verdad, así que la autorización vuelve sola con un
 * código simulado. Se prueba todo lo demás: elegir lotes, el state, el token, la oferta y el envío.
 */
test.describe('Beyco (modo simulado)', () => {
  test('elegir lotes, autorizar, completar la oferta y publicarla', async ({ page }) => {
    await ingresar(page, 'stock/todo?inst=11');
    const exportar = page.getByRole('button', { name: /^Exportar a Beyco/ });
    await expect(exportar).toBeDisabled();
    const filas = page.locator('tbody tr');
    await filas.nth(0).getByRole('checkbox').check();
    await filas.nth(1).getByRole('checkbox').check();
    await expect(exportar).toHaveText(/\(2\)/);
    await exportar.click();

    // Vuelve de la autorización simulada directo a la oferta, con lo que armó el backend.
    // Ida y vuelta con recarga completa de la página: puede tardar más que una navegación interna.
    await expect(page.getByRole('heading', { level: 1, name: 'Oferta en Beyco' })).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/stock\/beyco\/oferta\?lotes=\d+(%2C|,)\d+/);
    const cafe1 = page.getByRole('region', { name: /^Café 1 ·/ });
    const cafe2 = page.getByRole('region', { name: /^Café 2 ·/ });
    // Las entregas llegan sin nombre del backend: la v2 usa el identificador del lote.
    await expect(cafe1.getByRole('textbox', { name: /^Nombre del café/ })).toHaveValue(/\S/);
    await expect(cafe1.getByRole('heading')).not.toHaveText(/·\s*$/);
    await expect(cafe1.getByRole('button', { name: 'Especialidad' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('textbox', { name: /^País de exportación/ })).toHaveValue('Guatemala');

    // Sin completar: avisa y marca lo que falta.
    await page.getByRole('button', { name: 'Publicar en Beyco' }).click();
    await expect(page.getByText('Revisa los campos marcados.')).toBeVisible();

    await page.getByRole('textbox', { name: /^Título/ }).fill('Café de Huehuetenango, cosecha 2026');
    await page.getByLabel(/^Disponible desde/).fill('2026-11-15');
    for (const cafe of [cafe1, cafe2]) {
      await cafe.getByRole('textbox', { name: /^Cantidad/ }).fill('690');
      await cafe.getByRole('textbox', { name: /^Precio\b/ }).first().fill('5,2');
      await cafe.getByRole('combobox', { name: /^Precio por/ }).selectOption('Kg');
      await cafe.getByRole('combobox', { name: /^Moneda/ }).selectOption('Usd');
      await cafe.getByRole('textbox', { name: /^País de origen/ }).fill('Guatemala');
      await cafe.getByRole('combobox', { name: /^Incoterm/ }).selectOption('Fob');
      await cafe.getByRole('combobox', { name: /^Especie/ }).selectOption('Arabica');
      await cafe.getByRole('button', { name: 'Caturra' }).click();
    }
    // Zaranda mínima mayor que la máxima: no se envía.
    await cafe1.getByRole('textbox', { name: /^Zaranda mínima/ }).fill('18');
    await page.getByRole('button', { name: 'Publicar en Beyco' }).click();
    await expect(cafe1.getByText('No puede ser menor que la mínima.')).toBeVisible();
    await cafe1.getByRole('textbox', { name: /^Zaranda mínima/ }).fill('15');

    await page.getByRole('button', { name: 'Publicar en Beyco' }).click();
    await expect(page.getByText('Oferta publicada en Beyco')).toBeVisible();
    const enviada = await page.evaluate(() => JSON.parse(sessionStorage.getItem('simulado.beyco') ?? '[]'));
    expect(enviada).toHaveLength(1);
    expect(enviada[0].offerCoffees).toHaveLength(2);
    expect(enviada[0].offerCoffees[0]).toMatchObject({ price: 5.2, priceUnit: 'Kg', currency: 'Usd', incoterms: 'Fob' });
  });

  test('una vuelta de Beyco con otro state se rechaza', async ({ page }) => {
    await ingresar(page, 'stock/beyco?code=robado&state=ajeno');
    await expect(page.getByText('No se pudo conectar con Beyco')).toBeVisible();
    await expect(page.getByText(/no corresponde a esta sesión/)).toBeVisible();
  });
});
