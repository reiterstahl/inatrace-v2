import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';

async function ingresar(page: Page, destino = 'stock/todo') {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('todo el stock (modo simulado)', () => {
  test('exige instalación, lista suelta y agrupada, filtros', async ({ page }) => {
    await ingresar(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Todo el stock' })).toBeVisible();
    await expect(page.getByText('Elegí una instalación para ver su stock.')).toBeVisible();

    await page.getByRole('combobox', { name: 'Instalación' }).selectOption({ label: 'Beneficio Flor de la Sierra' });
    // Beneficio 11: 3 entregas + 1 lote procesado.
    await expect(page.getByText('4 en esta instalación')).toBeVisible();
    await expect(page.getByRole('row', { name: /LOTE-FS-001/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Procesamiento' }).first()).toBeVisible();

    await page.getByRole('checkbox', { name: 'Solo entregas' }).check();
    await expect(page).toHaveURL(/compras=true/);
    await expect(page.getByText('3 en esta instalación')).toBeVisible();
    await expect(page.getByText('LOTE-FS-001')).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Solo entregas' }).uncheck();
    await page.getByRole('button', { name: 'Por lote' }).click();
    await expect(page).toHaveURL(/vista=agrupada/);
    // Las 3 entregas de cereza se agrupan en una fila; el lote procesado en otra.
    await expect(page.getByRole('row', { name: /LOTE-FS-001/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Por lote' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('trazabilidad de un lote procesado: paso de procesamiento y entregas de origen', async ({ page }) => {
    await ingresar(page, 'stock/trazabilidad/310');
    await expect(page.getByRole('heading', { level: 1, name: 'Trazabilidad' })).toBeVisible();
    await expect(page.getByText('LOTE-FS-001').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Despulpado y secado' })).toBeVisible();
    await expect(page.getByText('Origen y procesamiento')).toBeVisible();
    // Las entregas que lo alimentaron, con su productor.
    await expect(page.getByText('María López')).toBeVisible();
  });

  test('desde el stock se llega a la trazabilidad de una entrega', async ({ page }) => {
    await ingresar(page);
    await page.getByRole('combobox', { name: 'Instalación' }).selectOption({ label: 'Centro de acopio El Mirador' });
    await expect(page.getByText('1 en esta instalación')).toBeVisible();
    await page.getByRole('link', { name: 'PT-Cux-2026-10-16' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Trazabilidad' })).toBeVisible();
    await expect(page.getByText('PT-Cux-2026-10-16').first()).toBeVisible();
  });
});
