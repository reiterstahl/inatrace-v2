import { test, expect, type Page } from '@playwright/test';
import { aceptarAviso } from '../e2e/avisos';
import { elegirEmpresa } from '../e2e/cuenta';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

/**
 * Órdenes entre dos empresas de la cadena. Necesita lo que siembra scripts/sembrar-ordenes.mjs en la
 * copia aislada: "Exportadora Demo (v2)" como exportadora del producto, con su bodega y una plantilla
 * de pedido, y el usuario de las pruebas inscrito en las dos empresas.
 */
const PRODUCTORA = 'Empresa Demo GIZ';
const EXPORTADORA = 'Exportadora Demo (v2)';

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
}

async function comoEmpresa(page: Page, nombre: string) {
  await elegirEmpresa(page, nombre);
}

const filaCon = (page: Page, cantidad: string) => page.locator('tbody tr').filter({ has: page.getByRole('cell', { name: new RegExp(`^${cantidad} `) }) });

test('pedido entre empresas: pedir, completar con stock del proveedor, aprobar, pagar y borrar', async ({ page }) => {
  test.setTimeout(120_000);
  const bruto = String(3600 + (Date.now() % 97)); // sobre 3000 kg: no choca con la copia llena
  const orden = 'OC-E2E-' + Date.now().toString().slice(-6);
  await ingresar(page);

  // 1. La productora tiene café oro en su instalación pública.
  await comoEmpresa(page, PRODUCTORA);
  await page.goto('/v2/stock/entregas/nueva');
  await page.getByRole('combobox', { name: /^Instalación/ }).selectOption({ label: 'Centro de acopio — Bodega Demo' }); // hay más de un centro de acopio
  const buscador = page.getByRole('combobox', { name: /^Productor/ });
  await buscador.fill('Rodr');
  await expect(page.getByRole('listbox').getByRole('option', { name: /María Rodríguez/ })).toBeVisible();
  await buscador.press('Enter');
  await page.getByRole('combobox', { name: /^Semiproducto/ }).selectOption({ label: 'Café oro/verde' });
  await page.getByRole('textbox', { name: /^Peso bruto/ }).fill(bruto);
  await page.getByRole('textbox', { name: /^Precio por unidad/ }).fill('2');
  await page.getByRole('combobox', { name: /^Moneda/ }).fill('USD');
  await page.getByRole('combobox', { name: /^Forma de pago/ }).selectOption({ label: 'Efectivo' });
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Entregas', exact: true })).toBeVisible();

  // 2. La exportadora le pide 500.
  await comoEmpresa(page, EXPORTADORA);
  await page.goto('/v2/stock/ordenes/nueva');
  await page.getByRole('combobox', { name: 'Instalación que recibe' }).selectOption({ label: 'Bodega de exportación (v2)' });
  await page.getByRole('combobox', { name: 'Plantilla del pedido' }).selectOption({ index: 1 });
  await page.getByRole('button', { name: /Continuar/ }).click();
  await expect(page.getByRole('combobox', { name: /^Proveedor/ })).toHaveValue(/\d+/); // la única vendedora, elegida sola
  const pedido = page.getByRole('group', { name: 'Salida 1' });
  await pedido.getByRole('textbox', { name: /^Cantidad pedida/ }).fill('500');
  await pedido.getByLabel(/^Fecha de entrega/).fill('2026-12-15');
  await pedido.getByRole('textbox', { name: /^Número de orden/ }).fill(orden);
  await pedido.getByRole('textbox', { name: /^Número de lote interno/ }).fill(orden);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/stock\/ordenes/);
  const filaEmitida = page.locator('tbody tr').filter({ hasText: orden }).first();
  await expect(filaEmitida).toContainText('Abierta');

  // 3. La productora la ve en Recibidas y la completa con su stock (se toma solo lo que falta).
  await comoEmpresa(page, PRODUCTORA);
  await page.goto('/v2/stock/ordenes?vista=recibidas');
  await page.getByRole('link', { name: new RegExp(`^Completar la orden ${orden}`) }).click();
  await expect(page.getByText(`Orden de ${EXPORTADORA}`)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Salida 1' }).getByRole('textbox', { name: /^Cantidad pedida/ })).toBeDisabled(); // no cambia lo pedido
  await filaCon(page, bruto).first().getByRole('checkbox').check();
  await expect(filaCon(page, bruto).first().getByRole('textbox')).toHaveValue('500');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/vista=recibidas/);

  // 4. La exportadora aprueba lo enviado: la orden queda cumplida.
  await comoEmpresa(page, EXPORTADORA);
  await page.goto('/v2/stock/ordenes');
  await page.getByRole('link', { name: new RegExp(`^Aprobar o rechazar lo enviado para ${orden}`) }).click();
  await expect(page.getByRole('group', { name: /^Envío del lote/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Confirmar 1 decisión' }).click();
  await expect(page).toHaveURL(/stock\/ordenes/);
  await expect(page.locator('tbody tr').filter({ hasText: orden }).first()).toContainText('Cumplida');

  // 5. La exportadora le paga a la productora por la orden; se ve en Pagos y se borra.
  await page.getByRole('link', { name: new RegExp(`^Pagar la orden ${orden}`) }).click();
  await expect(page.getByRole('heading', { name: `Pago a ${PRODUCTORA}` })).toBeVisible();
  await page.getByRole('combobox', { name: /^Propósito/ }).selectOption({ label: 'Pago de factura' });
  await page.getByRole('textbox', { name: /^Monto/ }).fill('321');
  await page.getByRole('textbox', { name: /^Moneda/ }).fill('USD');
  await page.getByRole('button', { name: 'Registrar pago' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pagos' })).toBeVisible();
  const pago = page.locator('tbody tr').filter({ hasText: orden }).first();
  await expect(pago).toContainText(PRODUCTORA);
  await expect(pago).toContainText(/321/);
  await pago.getByRole('link').first().click();
  await aceptarAviso(page);
  await page.getByRole('button', { name: 'Borrar pago' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pagos' })).toBeVisible();
  await page.goto('/v2/stock/ordenes');

  // 6. Limpieza: borrar la orden (exportadora) y la entrega (productora).
  await aceptarAviso(page);
  await page.locator('tbody tr').filter({ hasText: orden }).first().getByRole('button', { name: new RegExp(`^Borrar la orden`) }).click();
  await expect(page.locator('tbody tr').filter({ hasText: orden })).toHaveCount(0);
  await comoEmpresa(page, PRODUCTORA);
  await page.goto('/v2/stock/todo');
  await page.getByRole('combobox', { name: 'Instalación' }).selectOption({ label: 'Centro de acopio — Bodega Demo' });
  await aceptarAviso(page);
  await filaCon(page, bruto).first().getByRole('button', { name: 'Borrar entrega' }).click();
  await expect(filaCon(page, bruto)).toHaveCount(0);
});

test('pedido de cliente: la exportadora lo crea, la productora lo recibe y se borra', async ({ page }) => {
  test.setTimeout(90_000);
  const numero = 'CLI-E2E-' + Date.now().toString().slice(-6);
  await ingresar(page);

  // 1. La exportadora registra lo que pide su cliente: producto final a la productora.
  await comoEmpresa(page, EXPORTADORA);
  await page.goto('/v2/stock/ordenes/cliente');
  await page.getByRole('textbox', { name: /^Número de orden/ }).fill(numero);
  await page.getByRole('combobox', { name: /^Cliente/ }).selectOption({ label: 'Tostaduría Cliente Demo (v2)' });
  await page.getByRole('combobox', { name: /^Instalación que recibe/ }).selectOption({ label: 'Bodega de exportación (v2)' });
  await page.getByLabel(/^Fecha límite de entrega/).fill('2026-12-20');
  const item = page.getByRole('group', { name: 'Producto 1' });
  await item.getByRole('combobox', { name: /^Producto final/ }).selectOption({ index: 1 });
  // Con más de una vendedora no se elige sola: se pide a la bodega de la productora.
  await item.getByRole('combobox', { name: /^Pedir a/ }).selectOption({ label: 'Empresa Demo GIZ — Centro de acopio — Bodega Demo' });
  await item.getByRole('textbox', { name: /^Cantidad pedida/ }).fill('10');
  await item.getByRole('textbox', { name: /^Precio por unidad al cliente/ }).fill('250');
  await item.getByRole('textbox', { name: /^Moneda/ }).fill('USD');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Órdenes' })).toBeVisible();
  const emitida = page.locator('tbody tr').filter({ hasText: numero }).first();
  await expect(emitida).toContainText('Para Tostaduría Cliente Demo (v2)');
  await expect(emitida).toContainText(PRODUCTORA);
  await expect(emitida).toContainText('Abierta');

  // 2. La productora la ve en Recibidas y puede abrirla para completarla.
  await comoEmpresa(page, PRODUCTORA);
  await page.goto('/v2/stock/ordenes?vista=recibidas');
  await page.getByRole('link', { name: new RegExp(`^Completar la orden ${numero}`) }).click();
  await expect(page.getByText(`Orden de ${EXPORTADORA}`)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Salida 1' }).getByRole('textbox', { name: /^Cantidad pedida/ })).toBeDisabled();

  // 3. Limpieza: la exportadora borra la orden.
  await comoEmpresa(page, EXPORTADORA);
  await page.goto('/v2/stock/ordenes');
  await aceptarAviso(page);
  await page.locator('tbody tr').filter({ hasText: numero }).first().getByRole('button', { name: /^Borrar la orden/ }).click();
  await expect(page.locator('tbody tr').filter({ hasText: numero })).toHaveCount(0);
});
