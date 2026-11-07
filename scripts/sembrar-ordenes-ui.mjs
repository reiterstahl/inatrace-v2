// Órdenes de ejemplo creadas POR LA INTERFAZ de la v2 (los mismos pasos que e2e-real/ordenes.spec.ts,
// sin borrar al final), para que Órdenes emitidas y recibidas no queden vacías:
//   · 6 pedidos de la exportadora a la productora, en distintos estados: abiertos, completados con
//     stock, aprobados (cumplidos) y pagados,
//   · 3 pedidos de clientes de la exportadora.
// Necesita lo de sembrar-ordenes.mjs (exportadora, bodega y plantilla) y la v2 detrás del proxy.
//
// Pensado para la COPIA AISLADA de desarrollo, nunca para una instancia institucional.
// Uso:
//   INATRACE_URL=http://127.0.0.1:8390 INATRACE_USUARIO=… INATRACE_CLAVE=… node scripts/sembrar-ordenes-ui.mjs

import { chromium, expect } from '@playwright/test';

const URL = process.env.INATRACE_URL ?? 'http://127.0.0.1:8390';
const { INATRACE_USUARIO: usuario, INATRACE_CLAVE: clave } = process.env;
if (!usuario || !clave) {
  console.error('Faltan INATRACE_USUARIO e INATRACE_CLAVE.');
  process.exit(1);
}
const PRODUCTORA = 'Empresa Demo GIZ';
const EXPORTADORA = 'Exportadora Demo (v2)';
const BODEGA = 'Centro de acopio — Bodega Demo';
const paso = (t) => console.log('·', t);

const nav = await chromium.launch();
const page = await (await nav.newContext({ baseURL: URL, locale: 'es-CR', viewport: { width: 1366, height: 900 } })).newPage();
page.setDefaultTimeout(20_000);

// Avisos propios: se aceptan solos.
await page.addLocatorHandler(page.locator('dialog.aviso-modal[open]'), async (d) => d.locator('[data-aviso="aceptar"]').click());

async function empresa(nombre) {
  await page.getByRole('button', { name: 'Menú de la cuenta' }).click();
  await page.getByRole('dialog', { name: 'Menú de la cuenta' }).getByRole('combobox', { name: 'Empresa' }).selectOption({ label: nombre });
  await page.keyboard.press('Escape');
}
const filaCon = (cantidad) => page.locator('tbody tr').filter({ has: page.getByRole('cell', { name: new RegExp(`^${cantidad} `) }) });

await page.goto('/v2/ingreso');
await page.getByLabel('Correo electrónico').fill(usuario);
await page.getByLabel('Contraseña').fill(clave);
await page.getByRole('button', { name: 'Ingresar' }).click();
await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
paso('Sesión iniciada');

const base = Number(String(Date.now()).slice(-4));
let hechas = 0;
for (let k = 1; k <= (process.env.SOLO_PRODUCTORA ? 0 : 6); k++) {
  const bruto = String(480 + k * 37 + (base % 7));
  const orden = `OC-2026-${String(base + k).padStart(4, '0')}`;
  try {
    // Lote de café oro en la bodega de la productora.
    await empresa(PRODUCTORA);
    await page.goto('/v2/stock/entregas/nueva');
    await page.getByRole('combobox', { name: /^Instalación/ }).selectOption({ label: BODEGA });
    const buscador = page.getByRole('combobox', { name: /^Productor/ });
    await buscador.fill('a');
    await expect(page.getByRole('listbox').getByRole('option').nth(k)).toBeVisible();
    for (let i = 0; i < k; i++) await buscador.press('ArrowDown');
    await buscador.press('Enter');
    await page.getByRole('combobox', { name: /^Semiproducto/ }).selectOption({ label: 'Café oro/verde' });
    await page.getByRole('textbox', { name: /^Peso bruto/ }).fill(bruto);
    await page.getByRole('textbox', { name: /^Precio por unidad/ }).fill(String(3.9 + k / 10));
    await page.getByRole('combobox', { name: /^Moneda/ }).fill('USD');
    await page.getByRole('combobox', { name: /^Forma de pago/ }).selectOption({ label: 'Transferencia bancaria' }).catch(() => page.getByRole('combobox', { name: /^Forma de pago/ }).selectOption({ index: 1 }));
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Entregas', exact: true })).toBeVisible();

    // La exportadora pide.
    await empresa(EXPORTADORA);
    await page.goto('/v2/stock/ordenes/nueva');
    await page.getByRole('combobox', { name: 'Instalación que recibe' }).selectOption({ label: 'Bodega de exportación (v2)' });
    await page.getByRole('combobox', { name: 'Plantilla del pedido' }).selectOption({ index: 1 });
    await page.getByRole('button', { name: /Continuar/ }).click();
    const proveedor = page.getByRole('combobox', { name: /^Proveedor/ });
    if (!(await proveedor.inputValue())) await proveedor.selectOption({ index: 1 });
    const salida = page.getByRole('group', { name: 'Salida 1' });
    const cantidad = String(Math.min(Number(bruto) - 20, 300 + k * 25));
    await salida.getByRole('textbox', { name: /^Cantidad pedida/ }).fill(cantidad);
    await salida.getByLabel(/^Fecha de entrega/).fill(`2026-12-${String(8 + k * 2).padStart(2, '0')}`);
    await salida.getByRole('textbox', { name: /^Número de orden/ }).fill(orden);
    await salida.getByRole('textbox', { name: /^Número de lote interno/ }).fill(orden);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page).toHaveURL(/stock\/ordenes/);
    let estado = 'abierta';

    if (k >= 3) {
      // La productora la completa con su lote.
      await empresa(PRODUCTORA);
      await page.goto('/v2/stock/ordenes?vista=recibidas');
      await page.getByRole('link', { name: new RegExp(`^Completar la orden ${orden}`) }).click();
      await filaCon(bruto).first().getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Guardar', exact: true }).click();
      await expect(page).toHaveURL(/vista=recibidas/);
      estado = 'completada';
    }
    if (k >= 4) {
      // La exportadora aprueba lo enviado.
      await empresa(EXPORTADORA);
      await page.goto('/v2/stock/ordenes');
      await page.getByRole('link', { name: new RegExp(`^Aprobar o rechazar lo enviado para ${orden}`) }).click();
      await page.getByRole('button', { name: /^Confirmar 1 decisión/ }).click();
      await expect(page).toHaveURL(/stock\/ordenes/);
      estado = 'cumplida';
    }
    if (k >= 5) {
      // Y la paga.
      await page.getByRole('link', { name: new RegExp(`^Pagar la orden ${orden}`) }).click();
      await page.getByRole('combobox', { name: /^Propósito/ }).selectOption({ label: 'Pago de factura' });
      await page.getByRole('textbox', { name: /^Monto/ }).fill(String(Math.round(Number(cantidad) * 4.2)));
      await page.getByRole('textbox', { name: /^Moneda/ }).fill('USD');
      await page.getByRole('button', { name: 'Registrar pago' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Pagos' })).toBeVisible();
      estado = 'pagada';
    }
    hechas++;
    paso(`${orden}: ${estado}`);
  } catch (e) {
    console.log(`  ✗ ${orden}: ${e.message.split('\n')[0]}`);
  }
}

// Pedidos de clientes de la exportadora.
let pedidos = 0;
for (let j = 1; j <= (process.env.SOLO_PRODUCTORA ? 0 : 3); j++) {
  const numero = `CLI-2026-${String(base + j).padStart(4, '0')}`;
  try {
    await empresa(EXPORTADORA);
    await page.goto('/v2/stock/ordenes/cliente');
    await page.getByRole('textbox', { name: /^Número de orden/ }).fill(numero);
    await page.getByRole('combobox', { name: /^Cliente/ }).selectOption({ index: 1 });
    await page.getByRole('combobox', { name: /^Instalación que recibe/ }).selectOption({ label: 'Bodega de exportación (v2)' });
    await page.getByLabel(/^Fecha límite de entrega/).fill(`2027-0${j}-15`);
    const item = page.getByRole('group', { name: 'Producto 1' });
    await item.getByRole('combobox', { name: /^Producto final/ }).selectOption({ index: 1 });
    await item.getByRole('combobox', { name: /^Pedir a/ }).selectOption({ label: `${PRODUCTORA} — ${BODEGA}` });
    await item.getByRole('textbox', { name: /^Cantidad pedida/ }).fill(String(8 + j * 4));
    await item.getByRole('textbox', { name: /^Precio por unidad al cliente/ }).fill(String(240 + j * 15));
    await item.getByRole('textbox', { name: /^Moneda/ }).fill('USD');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Órdenes' })).toBeVisible();
    pedidos++;
    paso(`${numero}: pedido de cliente`);
  } catch (e) {
    console.log(`  ✗ ${numero}: ${e.message.split('\n')[0]}`);
  }
}

// Pedidos de clientes de la productora (así su vista de órdenes emitidas tampoco queda vacía).
for (let j = 1; j <= 3; j++) {
  const numero = `PED-2026-${String(base + j).padStart(4, '0')}`;
  try {
    await empresa(PRODUCTORA);
    await page.goto('/v2/stock/ordenes/cliente');
    await page.getByRole('textbox', { name: /^Número de orden/ }).fill(numero);
    await page.getByRole('combobox', { name: /^Cliente/ }).selectOption({ index: j });
    await page.getByRole('combobox', { name: /^Instalación que recibe/ }).selectOption({ label: BODEGA });
    await page.getByLabel(/^Fecha límite de entrega/).fill(`2027-0${j + 1}-10`);
    const item = page.getByRole('group', { name: 'Producto 1' });
    await item.getByRole('combobox', { name: /^Producto final/ }).selectOption({ index: 1 });
    const pedirA = item.getByRole('combobox', { name: /^Pedir a/ });
    if (!(await pedirA.inputValue())) await pedirA.selectOption({ index: 1 });
    await item.getByRole('textbox', { name: /^Cantidad pedida/ }).fill(String(5 + j * 3));
    await item.getByRole('textbox', { name: /^Precio por unidad al cliente/ }).fill(String(255 + j * 10));
    await item.getByRole('textbox', { name: /^Moneda/ }).fill('USD');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Órdenes' })).toBeVisible();
    pedidos++;
    paso(`${numero}: pedido de cliente de la productora`);
  } catch (e) {
    console.log(`  ✗ ${numero}: ${e.message.split('\n')[0]}`);
  }
}

await nav.close();
console.log(`\n${hechas} pedidos entre empresas y ${pedidos} pedidos de clientes.`);
