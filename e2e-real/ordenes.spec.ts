import { test, expect, type Page } from '@playwright/test';

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
  await page.getByRole('combobox', { name: 'Empresa' }).selectOption({ label: nombre });
  await expect(page.getByRole('combobox', { name: 'Empresa' })).toHaveValue(/\d+/);
}

const filaCon = (page: Page, cantidad: string) => page.locator('tbody tr').filter({ has: page.getByRole('cell', { name: new RegExp(`^${cantidad} `) }) });

test('pedido entre empresas: pedir, completar con stock del proveedor, aprobar y borrar', async ({ page }) => {
  test.setTimeout(120_000);
  const bruto = String(600 + (Date.now() % 97));
  const orden = 'OC-E2E-' + Date.now().toString().slice(-6);
  await ingresar(page);

  // 1. La productora tiene café oro en su instalación pública.
  await comoEmpresa(page, PRODUCTORA);
  await page.goto('/v2/stock/entregas/nueva');
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

  // 5. Limpieza: borrar la orden (exportadora) y la entrega (productora).
  page.once('dialog', (d) => void d.accept());
  await page.locator('tbody tr').filter({ hasText: orden }).first().getByRole('button', { name: new RegExp(`^Borrar la orden`) }).click();
  await expect(page.locator('tbody tr').filter({ hasText: orden })).toHaveCount(0);
  await comoEmpresa(page, PRODUCTORA);
  await page.goto('/v2/stock/todo');
  await page.getByRole('combobox', { name: 'Instalación' }).selectOption({ label: 'Centro de acopio — Bodega Demo' });
  page.once('dialog', (d) => void d.accept());
  await filaCon(page, bruto).first().getByRole('button', { name: 'Borrar entrega' }).click();
  await expect(filaCon(page, bruto)).toHaveCount(0);
});
