import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';

async function ingresar(page: Page, destino = 'stock/pagos') {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('pagos (modo simulado)', () => {
  test('lista: estados y confirmar los elegidos', async ({ page }) => {
    await ingresar(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Pagos' })).toBeVisible();
    await expect(page.getByText('2 pagos')).toBeVisible();
    const pedro = page.getByRole('row', { name: /Pedro Ajcá/ });
    await expect(pedro).toContainText('Sin confirmar');
    await expect(page.getByRole('row', { name: /María López/ })).toContainText('Confirmado');
    // Solo los sin confirmar se pueden elegir.
    await expect(page.getByRole('row', { name: /María López/ }).getByRole('checkbox')).toHaveCount(0);
    await pedro.getByRole('checkbox').check();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Confirmar 1 pago' }).click();
    await expect(pedro).toContainText('Confirmado');
  });

  test('pagar una entrega desde la lista de entregas', async ({ page }) => {
    await ingresar(page, 'stock/entregas');
    await page.getByRole('link', { name: 'Pagar la entrega de Rosa Cux' }).click();
    await expect(page.getByRole('heading', { name: 'Pago a Rosa Cux' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Monto/ })).toHaveValue('345');
    await page.getByRole('combobox', { name: /^Propósito/ }).selectOption({ label: 'Adelanto' });
    await page.getByRole('textbox', { name: /^Monto/ }).fill('100');
    await page.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(page.getByRole('heading', { name: 'Pagos de esta entrega' })).toBeVisible();
    await expect(page.getByText('Debe 245,00 US$')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Pagos de esta entrega' })).toContainText('Adelanto');
  });

  test('pago masivo: quien no tiene cuenta bloquea; sin esa entrega se registra', async ({ page }) => {
    await ingresar(page, 'stock/entregas');
    await page.getByRole('checkbox', { name: /Elegir la entrega de Pedro Ajcá/ }).check();
    await page.getByRole('checkbox', { name: /Elegir la entrega de Rosa Cux/ }).check();
    await page.getByRole('link', { name: 'Pago masivo (2)' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pago masivo' })).toBeVisible();
    await expect(page.getByText('1 destinatario sin cuenta bancaria')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar 2 pagos' })).toBeDisabled();

    await page.getByRole('button', { name: /^Quitar PT-Cux/ }).click();
    await page.getByRole('textbox', { name: 'Descripción', exact: true }).fill('Liquidación octubre');
    await page.getByRole('textbox', { name: /^Número de recibo/ }).fill('L-2026-10');
    await expect(page.getByText('629,50 US$').last()).toBeVisible();
    await page.getByRole('button', { name: 'Registrar 1 pago' }).click();
    await expect(page).toHaveURL(/vista=masivos/);
    await page.getByRole('link').filter({ hasText: /\d{4}|oct/ }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: /Pago masivo de 629,50/ })).toBeVisible();
  });

  test('desde la ficha del productor: sus pagos', async ({ page }) => {
    await ingresar(page, 'productores/101');
    await page.getByRole('link', { name: 'Sus pagos' }).click();
    await expect(page.getByText('Productor: María López')).toBeVisible();
    await expect(page.getByText('1 pago', { exact: true })).toBeVisible();
  });
});
