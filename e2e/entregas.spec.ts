import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';

async function ingresar(page: Page, destino = 'stock/entregas') {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

/** En escritorio la lista es una tabla y en el celular son tarjetas: se mira lo que está a la vista. */
const visible = (page: Page, texto: string | RegExp) => page.getByText(texto).filter({ visible: true }).first();

async function elegirPersona(page: Page, etiqueta: RegExp, texto: string, nombre: string) {
  const buscador = page.getByRole('combobox', { name: etiqueta });
  await buscador.fill(texto);
  await page.getByRole('listbox').getByRole('option', { name: new RegExp(nombre) }).click();
  await expect(page.getByRole('button', { name: `Quitar a ${nombre} y elegir a otra persona` })).toBeVisible();
}

test.describe('entregas (modo simulado)', () => {
  test('lista: estados de pago, filtros en la URL', async ({ page }) => {
    await ingresar(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Entregas' })).toBeVisible();
    await expect(page.getByText('4 entregas')).toBeVisible();
    // Pedro: (830 − 30 − 10) kg × (1,10 − 0,05) = 829,50; pagó 200.
    await expect(visible(page, 'Debe 629,50 US$')).toBeVisible();
    await expect(visible(page, 'Pagada')).toBeVisible();
    await expect(visible(page, 'Sin precio')).toBeVisible();

    await page.getByRole('combobox', { name: 'Instalación' }).selectOption({ label: 'Centro de acopio El Mirador' });
    await expect(page).toHaveURL(/inst=12/);
    await expect(page.getByText('1 entrega', { exact: true })).toBeVisible();

    await page.getByRole('combobox', { name: 'Instalación' }).selectOption({ label: 'Todas las instalaciones' });
    await page.getByRole('checkbox', { name: 'Solo con saldo pendiente' }).check();
    await expect(page.getByText('2 entregas')).toBeVisible();
    await page.getByRole('button', { name: 'De mujeres' }).click();
    await expect(page).toHaveURL(/mujeres=si/);
    await expect(page.getByText('1 entrega', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'De mujeres' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('nueva entrega en una instalación con todas las opciones', async ({ page }) => {
    await ingresar(page, 'stock/entregas/nueva?inst=11');
    await expect(page.getByRole('heading', { level: 1, name: 'Nueva entrega' })).toBeVisible();
    await expect(page.getByText('Hay cambios sin guardar.')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /^Moneda/ })).toHaveValue('USD'); // la de la empresa

    // Lo que la instalación activa es obligatorio.
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Revisa los campos marcados.')).toBeVisible();
    await expect(page.getByRole('group', { name: /^Orgánico/ }).getByRole('alert')).toHaveText('Este campo es obligatorio.');

    await elegirPersona(page, /^Productor/, 'ros', 'Rosa Cux');
    await page.getByRole('checkbox', { name: /El Mirador/ }).check();
    await page.getByRole('textbox', { name: /^Peso bruto/ }).fill('200');
    await page.getByRole('textbox', { name: /^Tara/ }).fill('250');
    await page.getByRole('textbox', { name: /^Tara/ }).blur();
    await expect(page.getByText('La tara no puede ser mayor que el peso bruto.')).toBeVisible();
    await page.getByRole('textbox', { name: /^Tara/ }).fill('5');
    await page.getByRole('textbox', { name: /^Descuento por daño \(peso\)/ }).fill('0');
    await page.getByRole('textbox', { name: /^Precio por unidad/ }).fill('1,2');
    await page.getByRole('textbox', { name: /^Descuento por daño \(precio\)/ }).fill('0');
    await page.getByRole('combobox', { name: /^Forma de pago/ }).selectOption({ label: 'Efectivo' });
    await page.getByRole('group', { name: /^Orgánico/ }).getByText('Sí').click();
    await page.getByRole('group', { name: /^Café de mujeres/ }).getByText('Sí').click();

    const resumen = page.getByRole('complementary');
    await expect(resumen).toContainText('195 kg');
    await expect(resumen).toContainText('234,00 US$');

    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page).toHaveURL(/stock\/entregas\?inst=11/);
    await expect(visible(page, 'Debe 234,00 US$')).toBeVisible();
  });

  test('guardar y registrar otra conserva lo del día', async ({ page }) => {
    await ingresar(page, 'stock/entregas/nueva?inst=12');
    await page.getByRole('textbox', { name: /^Fecha de entrega/ }).fill('2026-10-19');
    await elegirPersona(page, /^Productor/, 'ped', 'Pedro Ajcá');
    await page.getByRole('textbox', { name: /^Peso bruto/ }).fill('100');
    await page.getByRole('textbox', { name: /^Precio por unidad/ }).fill('1');
    await page.getByRole('combobox', { name: /^Forma de pago/ }).selectOption({ label: 'Cheque' });
    await page.getByRole('button', { name: 'Guardar y registrar otra' }).click();
    await expect(page.getByText('Entrega de Pedro Ajcá guardada.', { exact: false })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /^Productor/ })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: /^Peso bruto/ })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: /^Fecha de entrega/ })).toHaveValue('2026-10-19');
    await expect(page.getByRole('combobox', { name: /^Forma de pago/ })).toHaveValue('CHEQUE');
  });

  test('editar una entrega con pagos recalcula el saldo; borrar otra', async ({ page }) => {
    await ingresar(page, 'stock/entregas/302');
    await expect(page.getByRole('heading', { level: 1, name: 'Entrega de Pedro Ajcá' })).toBeVisible();
    await expect(page.getByText('Esta entrega ya tiene pagos registrados.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled(); // sin cambios
    await page.getByRole('textbox', { name: /^Precio por unidad/ }).fill('1,2');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Entrega guardada.')).toBeVisible();
    // 790 kg × (1,20 − 0,05) = 908,50; menos 200 pagados.
    await expect(page.getByText('Debe 708,50 US$')).toBeVisible();

    await page.goto('stock/entregas/303');
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar entrega' }).click();
    // Vuelve a la lista de la instalación de esa entrega, que era la única.
    await expect(page).toHaveURL(/inst=12/);
    await expect(page.getByText('No hay entregas con estos filtros.')).toBeVisible();
  });

  test('entrega masiva con dos productores', async ({ page }) => {
    await ingresar(page, 'stock/entregas/masiva?inst=12');
    await expect(page.getByRole('heading', { level: 1, name: 'Entrega masiva' })).toBeVisible();
    await page.getByRole('combobox', { name: /^Forma de pago/ }).selectOption({ label: 'Efectivo' });

    const primera = page.getByRole('group', { name: 'Entrega 1' });
    await primera.getByRole('combobox', { name: /^Productor/ }).fill('mar');
    await page.getByRole('listbox').getByRole('option', { name: /María López/ }).click();
    await primera.getByRole('textbox', { name: /^Peso bruto/ }).fill('100');
    await primera.getByRole('textbox', { name: /^Precio por unidad/ }).fill('2');

    await page.getByRole('button', { name: 'Agregar productor' }).click();
    const segunda = page.getByRole('group', { name: 'Entrega 2' });
    await expect(segunda.getByRole('combobox', { name: /^Productor/ })).toBeFocused();
    await expect(segunda.getByRole('textbox', { name: /^Precio por unidad/ })).toHaveValue('2'); // repite el precio
    await page.keyboard.type('ros');
    await page.keyboard.press('Enter');
    await segunda.getByRole('textbox', { name: /^Peso bruto/ }).fill('50');

    await expect(page.getByText('300,00 US$').filter({ visible: true }).last()).toBeVisible(); // (100 + 50) × 2
    await page.getByRole('button', { name: 'Guardar 2 entregas' }).click();
    await expect(page.getByText('3 entregas')).toBeVisible(); // 1 que había + 2
  });

  test('desde la ficha del productor: sus entregas y una nueva para él', async ({ page }) => {
    await ingresar(page, 'productores/101');
    await page.getByRole('link', { name: 'Sus entregas' }).click();
    await expect(page.getByText('Productor: María López')).toBeVisible();
    await expect(page.getByText('2 entregas')).toBeVisible();
    await page.getByRole('link', { name: 'Nueva entrega' }).click();
    await expect(page.getByRole('button', { name: 'Quitar a María López y elegir a otra persona' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /La Loma/ })).toBeVisible(); // sus parcelas
    await expect(page.getByText('Hay cambios sin guardar.')).toHaveCount(0);
  });
});
