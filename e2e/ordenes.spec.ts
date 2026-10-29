import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';

async function ingresar(page: Page, destino = 'stock/ordenes') {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

const fila = (page: Page, orden: string) => page.locator('tbody tr').filter({ hasText: orden });

test.describe('órdenes (modo simulado)', () => {
  test('emitidas: rechazar un envío pide el motivo', async ({ page }) => {
    await ingresar(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Órdenes' })).toBeVisible();
    await expect(fila(page, 'OC-SIM-2')).toContainText('Abierta');
    await page.getByRole('link', { name: /^Aprobar o rechazar lo enviado para OC-SIM-2/ }).click();
    const envio = page.getByRole('group', { name: 'Envío del lote LV-PERG-3' });
    await envio.getByRole('radio', { name: 'Rechazar' }).click();
    await page.getByRole('button', { name: 'Confirmar 1 decisión' }).click();
    await expect(page.getByText('Para rechazar un envío hay que indicar el motivo.')).toBeVisible();
    await envio.getByRole('textbox', { name: /^Motivo del rechazo/ }).fill('Humedad alta');
    await page.getByRole('button', { name: 'Confirmar 1 decisión' }).click();
    await expect(page).toHaveURL(/stock\/ordenes/);
    await expect(fila(page, 'OC-SIM-2')).toContainText('Abierta');
    await page.getByRole('link', { name: /^Aprobar o rechazar lo enviado para OC-SIM-2/ }).click();
    await expect(page.getByText('No hay envíos pendientes de aprobar en esta orden.')).toBeVisible();
  });

  test('emitidas: aprobar suma lo enviado a lo cumplido', async ({ page }) => {
    await ingresar(page, 'stock/ordenes/812/aprobar');
    await page.getByRole('button', { name: 'Confirmar 1 decisión' }).click();
    await expect(page).toHaveURL(/stock\/ordenes/);
    await expect(fila(page, 'OC-SIM-2')).toContainText('80');
    await expect(fila(page, 'OC-SIM-2')).toContainText('Abierta');
  });

  test('recibidas: el proveedor completa con su stock sin cambiar lo pedido', async ({ page }) => {
    await ingresar(page, 'stock/ordenes?vista=recibidas');
    await expect(fila(page, 'OC-VECINA-7')).toContainText('Cooperativa La Vecina');
    await page.getByRole('link', { name: /^Completar la orden OC-VECINA-7/ }).click();
    await expect(page.getByText('Orden de Cooperativa La Vecina')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Salida 1' }).getByRole('textbox', { name: /^Cantidad pedida/ })).toBeDisabled();
    const lote = page.locator('tbody tr').first();
    await lote.getByRole('checkbox').check();
    const tomado = Number((await lote.getByRole('textbox').inputValue()).replace(',', '.'));
    expect(tomado).toBeGreaterThan(0);
    expect(tomado).toBeLessThanOrEqual(200);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page).toHaveURL(/vista=recibidas/);
    await expect(fila(page, 'OC-VECINA-7')).toContainText('Abierta'); // queda pendiente hasta que La Vecina apruebe
  });

  test('pagar una orden emitida a la empresa proveedora', async ({ page }) => {
    await ingresar(page);
    await page.getByRole('link', { name: /^Pagar la orden OC-SIM-2/ }).click();
    await expect(page.getByRole('heading', { name: 'Pago a Cooperativa La Vecina' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /^Tipo de pago/ })).toBeDisabled(); // siempre transferencia
    await page.getByRole('combobox', { name: /^Propósito/ }).selectOption({ label: 'Pago de factura' });
    await page.getByRole('textbox', { name: /^Monto/ }).fill('150');
    await page.getByRole('textbox', { name: /^Moneda/ }).fill('USD');
    await page.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pagos' })).toBeVisible();
    const pago = page.getByRole('row', { name: /Cooperativa La Vecina/ });
    await expect(pago).toContainText('PO-SIM-2');
    await expect(pago).toContainText('Sin confirmar');
  });

  test('nuevo pedido a otra empresa', async ({ page }) => {
    await ingresar(page, 'stock/ordenes/nueva');
    await page.getByRole('combobox', { name: 'Instalación que recibe' }).selectOption({ label: 'Beneficio Flor de la Sierra' });
    await page.getByRole('combobox', { name: 'Plantilla del pedido' }).selectOption({ label: 'Pedido de pergamino' });
    await page.getByRole('button', { name: /Continuar/ }).click();
    await expect(page.getByRole('combobox', { name: /^Proveedor/ })).toHaveValue('99');
    const pedido = page.getByRole('group', { name: 'Salida 1' });
    await pedido.getByRole('textbox', { name: /^Cantidad pedida/ }).fill('300');
    await pedido.getByLabel(/^Fecha de entrega/).fill('2026-12-01');
    await pedido.getByRole('textbox', { name: /^Número de orden/ }).fill('OC-NUEVA-1');
    await pedido.getByRole('textbox', { name: /^Número de lote interno/ }).fill('PO-NUEVA-1');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page).toHaveURL(/stock\/ordenes/);
    await expect(fila(page, 'OC-NUEVA-1')).toContainText('Bodega La Vecina');
    await expect(fila(page, 'OC-NUEVA-1')).toContainText('Abierta');
  });

  test('pedido de cliente: valida y queda como orden emitida al proveedor', async ({ page }) => {
    await ingresar(page, 'stock/ordenes');
    await page.getByRole('link', { name: 'Pedido de cliente' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pedido de cliente' })).toBeVisible();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Revisa los campos marcados.')).toBeVisible();
    await expect(page.getByText('Este campo es obligatorio.').first()).toBeVisible();
    await page.getByRole('textbox', { name: /^Número de orden/ }).fill('CLI-9');
    await page.getByRole('combobox', { name: /^Cliente/ }).selectOption({ label: 'Tostaduría El Grano' });
    await page.getByRole('combobox', { name: /^Instalación que recibe/ }).selectOption({ label: 'Beneficio Flor de la Sierra' });
    await page.getByLabel(/^Fecha límite de entrega/).fill('2026-12-20');
    const item = page.getByRole('group', { name: 'Producto 1' });
    await item.getByRole('combobox', { name: /^Producto final/ }).selectOption({ label: 'Café de la Sierra 340 g' });
    await expect(item.getByRole('combobox', { name: /^Pedir a/ })).toHaveValue('99'); // único proveedor, elegido solo
    await item.getByRole('textbox', { name: /^Cantidad pedida/ }).fill('40');
    await item.getByRole('textbox', { name: /^Precio por unidad al cliente/ }).fill('12,5');
    await item.getByRole('textbox', { name: /^Moneda/ }).fill('USD');
    await expect(item).toContainText('CLI-9 (Café de la Sierra 340 g, 40 kg)');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Órdenes' })).toBeVisible();
    const fila = page.locator('tbody tr').filter({ hasText: 'CLI-9' });
    await expect(fila).toContainText('Tostaduría El Grano');
    await expect(fila).toContainText('Cooperativa La Vecina');
    await expect(fila).toContainText('Abierta');
  });
});
