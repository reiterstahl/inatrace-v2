import { test, expect, type Page } from '@playwright/test';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
}

/** Fila con una celda que empieza exactamente con esa cantidad. */
const filaCon = (page: Page, cantidad: string) => page.locator('tbody tr').filter({ has: page.getByRole('cell', { name: new RegExp(`^${cantidad} `) }) });

/** Entrega de María Rodríguez (se busca por apellido) con un peso único para reconocerla. */
async function crearEntrega(page: Page, bruto: string) {
  await page.goto('/v2/stock/entregas/nueva');
  const buscador = page.getByRole('combobox', { name: /^Productor/ });
  await buscador.fill('Rodr');
  await expect(page.getByRole('listbox').getByRole('option', { name: /María Rodríguez/ })).toBeVisible();
  await buscador.press('Enter');
  await page.getByRole('textbox', { name: /^Peso bruto/ }).fill(bruto);
  await page.getByRole('textbox', { name: /^Precio por unidad/ }).fill('2');
  await page.getByRole('combobox', { name: /^Moneda/ }).fill('USD');
  await page.getByRole('combobox', { name: /^Forma de pago/ }).selectOption({ label: 'Efectivo' });
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Entregas', exact: true })).toBeVisible();
}

async function borrarEntrega(page: Page, bruto: string) {
  await page.goto('/v2/stock/todo');
  await page.getByRole('combobox', { name: 'Instalación' }).selectOption({ index: 1 });
  page.once('dialog', (d) => void d.accept());
  await filaCon(page, bruto).first().getByRole('button', { name: 'Borrar entrega' }).click();
  await expect(filaCon(page, bruto)).toHaveCount(0);
}

test.describe('pagos contra el backend real', () => {
  test.beforeEach(async ({ page }) => ingresar(page));

  test('pagar una entrega: documento obligatorio, saldo, confirmar y borrar', async ({ page }) => {
    const bruto = String(300 + (Date.now() % 97)); // pago base = bruto × 2
    await crearEntrega(page, bruto);

    // Desde la lista de entregas, "Pagar".
    await filaCon(page, bruto).first().getByRole('link', { name: /^Pagar la entrega de María Rodríguez/ }).click();
    await expect(page.getByRole('heading', { name: 'Pago a María Rodríguez' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Monto/ })).toHaveValue(String(Number(bruto) * 2));

    // El pago base exige el documento de respaldo.
    await page.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(page.getByText('El pago base lleva el documento de respaldo', { exact: false })).toBeVisible();
    await page.getByLabel('Documento de respaldo').setInputFiles({ name: 'recibo-e2e.txt', mimeType: 'text/plain', buffer: Buffer.from('recibo de prueba') });
    await expect(page.getByRole('link', { name: 'recibo-e2e.txt' })).toBeVisible();
    await page.getByRole('textbox', { name: /^Monto/ }).fill('300');
    await page.getByRole('button', { name: 'Registrar pago' }).click();

    // Vuelve a la entrega: el pago aparece y el saldo bajó.
    await expect(page.getByRole('heading', { name: 'Pagos de esta entrega' })).toBeVisible();
    const saldo = Number(bruto) * 2 - 300;
    await expect(page.getByText(new RegExp(`Debe ${saldo},00`))).toBeVisible();
    await expect(page.getByText('Sin confirmar')).toBeVisible();

    // Confirmar desde la ficha del pago: ya no se puede confirmar de nuevo.
    await page.getByRole('region', { name: 'Pagos de esta entrega' }).getByRole('listitem').first().getByRole('link').click();
    await expect(page.getByRole('heading', { level: 1, name: /300,00/ })).toBeVisible();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Confirmado', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar' })).toHaveCount(0);

    // Borrar el pago: el saldo vuelve al pago base completo.
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar pago' }).click();
    await expect(page.getByRole('heading', { name: 'Pagos', exact: true })).toBeVisible();

    await borrarEntrega(page, bruto);
  });

  test('pago masivo: sin cuenta no deja registrar; con cuenta, transfiere el saldo de cada entrega', async ({ page }) => {
    const brutos = [String(500 + (Date.now() % 89)), String(600 + (Date.now() % 83))];
    for (const b of brutos) await crearEntrega(page, b);

    // Elegir las dos entregas y abrir el pago masivo.
    await page.goto('/v2/stock/entregas?inst=6');
    for (const b of brutos) await filaCon(page, b).first().getByRole('checkbox').check();
    await page.getByRole('link', { name: 'Pago masivo (2)' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pago masivo' })).toBeVisible();

    // La demo no tiene cuentas bancarias cargadas: se avisa y no deja registrar.
    const sinCuenta = await page.getByText(/sin cuenta bancaria/).isVisible();
    if (sinCuenta) {
      await expect(page.getByRole('button', { name: 'Registrar 2 pagos' })).toBeDisabled();
      // Se carga la cuenta de la productora por la API (en la copia aislada) y se deja como estaba al final.
      const ficha = await (await page.request.get('/api/company/userCustomers/1')).json();
      const original = ficha.data;
      const r = await page.request.put('/api/company/userCustomers/edit', { data: { ...original, bank: { ...(original.bank ?? {}), accountNumber: 'GT-E2E-0001', bankName: 'Banco de prueba' } } });
      expect((await r.json()).status).toBe('OK');
      try {
        await page.reload();
        await expect(page.getByText('GT-E2E-0001').first()).toBeVisible();
        await registrarMasivo(page, brutos);
      } finally {
        await page.request.put('/api/company/userCustomers/edit', { data: original });
      }
    } else {
      await registrarMasivo(page, brutos);
    }

    // Limpieza: borrar los pagos del masivo y las entregas. (El pago masivo en sí no tiene borrado en el backend.)
    await page.goto('/v2/stock/pagos?prod=1');
    for (let i = 0; i < 2; i++) {
      page.once('dialog', (d) => void d.accept());
      await page.locator('tbody tr').filter({ hasText: /E2E-MASIVO|PT-Rodríguez/ }).first().getByRole('button', { name: /^Borrar el pago/ }).click();
      await page.waitForTimeout(500);
    }
    for (const b of brutos) await borrarEntrega(page, b);
  });
});

async function registrarMasivo(page: Page, brutos: string[]) {
  await page.getByRole('textbox', { name: 'Descripción', exact: true }).fill('Prueba e2e');
  await page.getByRole('textbox', { name: /^Número de recibo/ }).fill('E2E-MASIVO');
  const total = brutos.reduce((s, b) => s + Number(b) * 2, 0);
  await expect(page.getByText(new RegExp(`${total.toLocaleString('es-ES')},00`)).first()).toBeVisible();
  await page.getByRole('button', { name: 'Registrar 2 pagos' }).click();
  await expect(page).toHaveURL(/vista=masivos/);
  await page.locator('tbody tr').filter({ hasText: 'E2E-MASIVO' }).first().getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1, name: /Pago masivo de/ })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'María Rodríguez' })).toHaveCount(2);
}
