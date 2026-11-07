import { test, expect, type Page } from '@playwright/test';
import { aceptarAviso } from '../e2e/avisos';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

/** Fila de una tabla con una celda que empieza exactamente con esa cantidad (no "1421" ni un lote con esos dígitos). */
const filaCon = (page: Page, cantidad: string) => page.locator('tbody tr').filter({ has: page.getByRole('cell', { name: new RegExp(`^${cantidad} `) }) });

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
}

/**
 * Necesita la acción "Trillado (demo)" (pergamino → oro/verde) que crea
 * scripts/sembrar-procesamiento.mjs en la copia aislada.
 */
test.describe('procesamiento contra el backend real', () => {
  test.beforeEach(async ({ page }) => ingresar(page));

  test('entrega → trillado → trazabilidad → editar → borrar', async ({ page }) => {
    const bruto = String(400 + (Date.now() % 97)); // cantidad única para reconocer el lote en las listas
    const lote = 'E2E-' + Date.now().toString().slice(-6);

    // 1. Entrega de café pergamino.
    await page.goto('/v2/stock/entregas/nueva');
    const buscador = page.getByRole('combobox', { name: /^Productor/ });
    await buscador.fill('a');
    await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible();
    await buscador.press('Enter');
    await page.getByRole('combobox', { name: /^Semiproducto/ }).selectOption({ label: 'Café pergamino' });
    await page.getByRole('textbox', { name: /^Peso bruto/ }).fill(bruto);
    await page.getByRole('textbox', { name: /^Precio por unidad/ }).fill('2');
    await page.getByRole('combobox', { name: /^Moneda/ }).fill('USD');
    await page.getByRole('combobox', { name: /^Forma de pago/ }).selectOption({ label: 'Efectivo' });
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Entregas', exact: true })).toBeVisible();

    // 2. Trillado desde la pestaña de procesamiento.
    await page.goto('/v2/stock/procesamiento');
    await page.getByRole('link', { name: /Trillado/ }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: /Trillado/ })).toBeVisible();
    await expect(page.getByText('Hay cambios sin guardar.')).toHaveCount(0);
    const filaEntrada = filaCon(page, bruto).first();
    await filaEntrada.getByRole('checkbox').check();
    await expect(page.getByRole('complementary')).toContainText(bruto);

    const salida = page.getByRole('group', { name: 'Salida 1' });
    await salida.getByRole('textbox', { name: /^Cantidad/ }).fill('300');
    await salida.getByRole('textbox', { name: /^Número de lote interno/ }).fill(lote);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();

    // 3. El lote nuevo aparece en el stock de la instalación.
    await expect(page).toHaveURL(/stock\/todo\?inst=/);
    const filaLote = page.locator('tbody tr').filter({ hasText: lote }).first();
    await expect(filaLote).toBeVisible();
    await expect(filaLote).toContainText('Procesamiento');

    // 4. Su trazabilidad: el paso de trillado y la entrega de origen.
    await filaLote.getByRole('link', { name: 'Ver trazabilidad' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Trazabilidad' })).toBeVisible();
    await expect(page.getByText(/1 entrega de productor/)).toBeVisible();

    // 5. Editar: otra cantidad de salida.
    await page.goBack();
    await page.locator('tbody tr').filter({ hasText: lote }).first().getByRole('link', { name: 'Editar el procesamiento' }).click();
    await expect(page.getByText('Ya incluidos en esta orden')).toBeVisible();
    await page.getByRole('group', { name: 'Salida 1' }).getByRole('textbox', { name: /^Cantidad/ }).fill('320');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page).toHaveURL(/stock\/todo\?inst=/);
    await expect(page.locator('tbody tr').filter({ hasText: lote }).first()).toContainText('320');

    // 6. Borrar el procesamiento: sus lotes de salida desaparecen.
    // (Que la entrega vuelva a quedar disponible depende del backend: el de inatrace-enhanced todavía no
    // devuelve la cantidad al borrar, ver H19 en sus hallazgos; el original de AgStack sí, desde 1a8cc83.)
    await aceptarAviso(page);
    await page.locator('tbody tr').filter({ hasText: lote }).first().getByRole('button', { name: 'Borrar el procesamiento' }).click();
    await expect(page.locator('tbody tr').filter({ hasText: lote })).toHaveCount(0);

    // 7. Limpieza: borrar la entrega.
    await page.goto('/v2/stock/todo');
    await page.getByRole('combobox', { name: 'Instalación' }).selectOption({ index: 1 });
    await aceptarAviso(page);
    await filaCon(page, bruto).first().getByRole('button', { name: 'Borrar entrega' }).click();
    await expect(filaCon(page, bruto)).toHaveCount(0);
  });

  test('generar QR: el lote muestra el QR de la versión actual y abre la vitrina', async ({ page, context }) => {
    const bruto = String(200 + (Date.now() % 89));
    const lote = 'QR-E2E-' + Date.now().toString().slice(-6);

    // Entrega de café oro/verde, que es lo que toma "Generar QR (demo)".
    await page.goto('/v2/stock/entregas/nueva');
    const buscador = page.getByRole('combobox', { name: /^Productor/ });
    await buscador.fill('a');
    await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible();
    await buscador.press('Enter');
    await page.getByRole('combobox', { name: /^Semiproducto/ }).selectOption({ label: 'Café oro/verde' });
    await page.getByRole('textbox', { name: /^Peso bruto/ }).fill(bruto);
    await page.getByRole('textbox', { name: /^Precio por unidad/ }).fill('3');
    await page.getByRole('combobox', { name: /^Moneda/ }).fill('USD');
    await page.getByRole('combobox', { name: /^Forma de pago/ }).selectOption({ label: 'Efectivo' });
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Entregas', exact: true })).toBeVisible();

    await page.goto('/v2/stock/procesamiento');
    await page.getByRole('link', { name: /Generar QR/ }).first().click();
    await filaCon(page, bruto).first().getByRole('checkbox').check();
    const salida = page.getByRole('group', { name: 'Salida 1' });
    // Al generar un QR sale exactamente lo que entra.
    await expect(salida.getByRole('textbox', { name: /^Cantidad/ })).toHaveValue(bruto);
    await salida.getByRole('textbox', { name: /^Número de lote interno/ }).fill(lote);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page).toHaveURL(/stock\/todo\?inst=/);

    const fila = page.locator('tbody tr').filter({ hasText: lote }).first();
    await fila.getByRole('link', { name: 'Ver el código QR' }).click();
    await expect(page.getByRole('heading', { name: 'Código QR del lote' })).toBeVisible();
    await expect(page.getByRole('img', { name: `Código QR del lote ${lote}` })).toBeVisible();
    // Misma forma que la versión actual: /{idioma}/q-cd/{etiqueta}/{código}.
    await expect(page.getByText(/\/(es|en)\/q-cd\/[0-9a-f]{32}\/[0-9a-f-]{36}$/)).toBeVisible();

    const [vitrina] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Ver la vitrina' }).click()]);
    await vitrina.waitForLoadState();
    await expect(vitrina).toHaveURL(/\/v2\/p-cd\/[0-9a-f]{32}\/[0-9a-f-]{36}/);
    await vitrina.close();

    // Limpieza: borrar el procesamiento y la entrega.
    await page.goBack();
    await aceptarAviso(page);
    await page.locator('tbody tr').filter({ hasText: lote }).first().getByRole('button', { name: 'Borrar el procesamiento' }).click();
    await expect(page.locator('tbody tr').filter({ hasText: lote })).toHaveCount(0);
    await aceptarAviso(page);
    await filaCon(page, bruto).first().getByRole('button', { name: 'Borrar entrega' }).click();
    await expect(filaCon(page, bruto)).toHaveCount(0);
  });
});
