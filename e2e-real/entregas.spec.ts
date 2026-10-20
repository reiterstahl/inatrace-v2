import { test, expect, type Page } from '@playwright/test';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
}

test.describe('entregas contra el backend real', () => {
  test.beforeEach(async ({ page }) => ingresar(page));

  test('crear, ver el pago que calcula el backend, editar y borrar', async ({ page }) => {
    await page.goto('/v2/stock/entregas/nueva');
    await expect(page.getByRole('heading', { name: 'Nueva entrega' })).toBeVisible();
    await expect(page.getByText('Hay cambios sin guardar.')).toHaveCount(0); // recién abierta

    // Productor: buscador accesible (flechas + Enter).
    const buscador = page.getByRole('combobox', { name: /^Productor/ });
    await buscador.fill('a');
    const primera = page.getByRole('listbox').getByRole('option').first();
    await expect(primera).toBeVisible();
    const nombre = (await primera.locator('span span').first().textContent())!.trim();
    await buscador.press('Enter');
    await expect(page.getByRole('button', { name: `Quitar a ${nombre} y elegir a otra persona` })).toBeVisible();

    // Una parcela de origen, si tiene.
    const parcela = page.getByRole('group', { name: 'Parcelas de origen' }).getByRole('checkbox').first();
    const conParcela = await parcela.isVisible().catch(() => false);
    if (conParcela) await parcela.check();

    // Cantidad con coma decimal, precio y moneda: la vista previa calcula al vuelo.
    await page.getByRole('textbox', { name: /^Peso bruto/ }).fill('412,5');
    await page.getByRole('textbox', { name: /^Precio por unidad/ }).fill('2');
    await page.getByRole('combobox', { name: /^Moneda/ }).fill('usd');
    await page.getByRole('combobox', { name: /^Forma de pago/ }).selectOption({ label: 'Efectivo' });
    await expect(page.getByRole('complementary')).toContainText('825');

    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Entregas', exact: true })).toBeVisible();

    // La lista la muestra con el pago que calculó el backend.
    await page.getByRole('searchbox').fill(nombre.split(' ')[0]);
    const fila = page.locator('tbody tr').filter({ hasText: nombre }).filter({ hasText: '412,5' }).first();
    await expect(fila).toContainText('825,00');
    await expect(fila).toContainText('Debe');

    // Editar: cambia el precio y el backend recalcula.
    await fila.getByRole('link').click();
    await expect(page.getByRole('heading', { name: `Entrega de ${nombre}` })).toBeVisible();
    if (conParcela) await expect(page.getByRole('group', { name: 'Parcelas de origen' }).getByRole('checkbox', { checked: true })).toHaveCount(1);
    await expect(page.getByRole('combobox', { name: /^Moneda/ })).toHaveValue('USD');
    await page.getByRole('textbox', { name: /^Precio por unidad/ }).fill('2,2');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Entrega guardada.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Debe 907,50')).toBeVisible();

    // Borrar.
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar entrega' }).click();
    await expect(page.getByRole('heading', { name: 'Entregas', exact: true })).toBeVisible();
    await page.getByRole('searchbox').fill(nombre.split(' ')[0]);
    await expect(page.locator('tbody tr').filter({ hasText: '412,5' })).toHaveCount(0);
  });

  test('obligatorios y números mal escritos', async ({ page }) => {
    await page.goto('/v2/stock/entregas/nueva');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Revisa los campos marcados.')).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Este campo es obligatorio.' }).first()).toBeVisible();
    await page.getByRole('textbox', { name: /^Peso bruto/ }).fill('abc');
    await page.getByRole('textbox', { name: /^Peso bruto/ }).blur();
    await expect(page.getByText('Escribe un número.')).toBeVisible();
  });

  test('entrega masiva: dos productores de una vez', async ({ page }) => {
    await page.goto('/v2/stock/entregas/masiva');
    await expect(page.getByRole('heading', { name: 'Entrega masiva' })).toBeVisible();
    await page.getByRole('combobox', { name: /^Moneda/ }).fill('USD');
    await page.getByRole('combobox', { name: /^Forma de pago/ }).selectOption({ label: 'Efectivo' });

    const nombres: string[] = [];
    for (const [i, bruto] of [[0, '101'], [1, '202']] as const) {
      if (i > 0) await page.getByRole('button', { name: 'Agregar productor' }).click();
      const fila = page.getByRole('group', { name: `Entrega ${i + 1}` });
      const buscador = fila.getByRole('combobox', { name: /^Productor/ });
      if (i > 0) await expect(buscador).toBeFocused(); // al agregar, el foco va a la fila nueva
      await buscador.fill('a');
      const opcion = page.getByRole('listbox').getByRole('option').nth(i);
      await expect(opcion).toBeVisible();
      nombres.push((await opcion.locator('span span').first().textContent())!.trim());
      await opcion.click();
      await fila.getByRole('textbox', { name: /^Peso bruto/ }).fill(bruto);
      await fila.getByRole('textbox', { name: /^Precio por unidad/ }).fill('3');
    }
    await expect(page.getByText(/909,00/)).toBeVisible(); // (101 + 202) × 3
    await page.getByRole('button', { name: 'Guardar 2 entregas' }).click();
    await expect(page.getByRole('heading', { name: 'Entregas', exact: true })).toBeVisible();

    for (const [nombre, monto] of [[nombres[0]!, '303,00'], [nombres[1]!, '606,00']]) {
      await page.getByRole('searchbox').fill(nombre.split(' ')[0]!);
      const fila = page.locator('tbody tr').filter({ hasText: nombre }).filter({ hasText: monto }).first();
      await expect(fila).toBeVisible();
      page.once('dialog', (d) => void d.accept());
      await fila.getByRole('button', { name: 'Borrar entrega' }).click();
      await expect(page.locator('tbody tr').filter({ hasText: nombre }).filter({ hasText: monto })).toHaveCount(0);
    }
  });
});
