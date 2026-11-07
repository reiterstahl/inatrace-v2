import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';
import { aceptarAviso } from './avisos';

async function ingresar(page: Page, destino = 'stock/procesamiento') {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

const visible = (page: Page, texto: string | RegExp) => page.getByText(texto).filter({ visible: true }).first();

test.describe('procesamiento (modo simulado)', () => {
  test('cada instalación ofrece las acciones que puede hacer', async ({ page }) => {
    await ingresar(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Procesamiento' })).toBeVisible();
    const beneficio = page.getByRole('listitem').filter({ hasText: 'Beneficio Flor de la Sierra' });
    await expect(beneficio.getByRole('link', { name: /Despulpado y secado/ })).toBeVisible();
    await expect(beneficio.getByRole('link', { name: /Traslado al beneficio/ })).toBeVisible();
    // El Mirador solo tiene café cereza: puede despulpar, no trasladar pergamino.
    const mirador = page.getByRole('listitem').filter({ hasText: 'Centro de acopio El Mirador' });
    await expect(mirador.getByRole('link', { name: /Despulpado/ })).toBeVisible();
    await expect(mirador.getByRole('link', { name: /Traslado/ })).toHaveCount(0);
  });

  test('despulpar: rango esperado, campo obligatorio, guardar, trazabilidad, editar y borrar', async ({ page }) => {
    await ingresar(page);
    await page.getByRole('listitem').filter({ hasText: 'Beneficio Flor de la Sierra' }).getByRole('link', { name: /Despulpado/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Despulpado y secado' })).toBeVisible();
    await expect(page.getByText('Hay cambios sin guardar.')).toHaveCount(0);

    // Entrada: la entrega de María (500 kg de cereza).
    await page.getByRole('checkbox', { name: 'Elegir el lote PT-López-2026-10-14' }).check();
    const resumen = page.getByRole('complementary');
    await expect(resumen).toContainText('500 kg');
    // Rendimiento 20 %: se esperan entre 80 y 120 kg.
    await expect(resumen).toContainText('80 kg a 120 kg');

    const salida = page.getByRole('group', { name: 'Salida 1' });
    await salida.getByRole('textbox', { name: /^Cantidad/ }).fill('150');
    await expect(resumen).toContainText('fuera de ese rango');
    await salida.getByRole('textbox', { name: /^Cantidad/ }).fill('100');
    await expect(resumen).not.toContainText('fuera de ese rango');
    await salida.getByRole('textbox', { name: /^Número de lote interno/ }).fill('DS-01');

    // La humedad es obligatoria en esta acción.
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(salida.getByRole('alert')).toHaveText('Este campo es obligatorio.');
    await salida.getByRole('textbox', { name: /^Humedad/ }).fill('11,5');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect(page).toHaveURL(/stock\/todo\?inst=11/);
    await expect(visible(page, 'DS-01')).toBeVisible();

    // Trazabilidad del lote nuevo.
    await page.getByRole('link', { name: 'DS-01' }).first().click();
    await expect(page.getByRole('heading', { name: 'Despulpado y secado' })).toBeVisible();
    await expect(page.getByText('María López')).toBeVisible();
    await expect(page.getByText(/humedad/i).first()).toBeVisible();

    // Editar: otra cantidad.
    await page.goBack();
    await page.getByRole('row', { name: /DS-01/ }).getByRole('link', { name: 'Editar el procesamiento' }).click();
    await expect(page.getByText('Ya incluidos en esta orden')).toBeVisible();
    await page.getByRole('group', { name: 'Salida 1' }).getByRole('textbox', { name: /^Cantidad/ }).fill('110');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('row', { name: /DS-01/ })).toContainText('110 kg');

    // Borrar: el lote desaparece y la entrega vuelve a estar disponible.
    await aceptarAviso(page);
    await page.getByRole('row', { name: /DS-01/ }).getByRole('button', { name: 'Borrar el procesamiento' }).click();
    await expect(page.getByRole('row', { name: /DS-01/ })).toHaveCount(0);
    await page.goto('stock/procesamiento/nueva?accion=21&inst=11');
    await expect(page.getByRole('checkbox', { name: 'Elegir el lote PT-López-2026-10-14' })).toBeVisible();
  });

  test('trasladar: cada lote entero, numerado desde el lote base', async ({ page }) => {
    await ingresar(page, 'stock/procesamiento/nueva?accion=22&inst=11');
    await expect(page.getByRole('heading', { level: 1, name: 'Traslado al beneficio' })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Elegir todos los lotes' }).check();
    await expect(page.getByText('En un traslado, cada lote se traslada completo.')).toBeVisible();
    await page.getByRole('group', { name: 'Salida 1' }).getByRole('textbox', { name: /^Número de lote/ }).fill('TL-5');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page).toHaveURL(/stock\/todo\?inst=11/);
    await expect(visible(page, 'TL-5/1')).toBeVisible();
    await expect(visible(page, 'TL-5/2')).toBeVisible();
  });

  test('generar QR: el lote nuevo muestra su código, con la URL de la versión actual', async ({ page }) => {
    await ingresar(page, 'stock/procesamiento/nueva?accion=23&inst=11');
    await expect(page.getByRole('heading', { level: 1, name: 'Generar código QR' })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Elegir el lote PT-López-2026-10-18' }).check();
    const salida = page.getByRole('group', { name: 'Salida 1' });
    // Sale exactamente lo que entra (118 kg) y no se puede cambiar.
    await expect(salida.getByRole('textbox', { name: /^Cantidad/ })).toHaveValue('118');
    await expect(salida.getByRole('textbox', { name: /^Cantidad/ })).toBeDisabled();
    await salida.getByRole('textbox', { name: /^Número de lote interno/ }).fill('QR-SIM-1');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect(page).toHaveURL(/stock\/todo\?inst=11/);
    await page.getByRole('row', { name: /QR-SIM-1/ }).getByRole('link', { name: 'Ver el código QR' }).click();
    await expect(page.getByRole('heading', { name: 'Código QR del lote' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Código QR del lote QR-SIM-1' })).toBeVisible();
    await expect(page.getByText(/\/es\/q-cd\/demo\/[0-9a-f-]{36}$/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver la vitrina' })).toHaveAttribute('href', /\/v2\/p-cd\/demo\/[0-9a-f-]{36}$/);
  });
});
