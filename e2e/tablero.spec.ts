import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';

async function ingresar(page: Page, destino: string) {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('tablero de stock (modo simulado)', () => {
  test('entregas: gráfico, tooltip, tabla, filtros y exportación', async ({ page }) => {
    await ingresar(page, 'stock/tablero');
    await expect(page.getByRole('link', { name: 'Tablero' })).toHaveClass(/border-marca/);
    const entregas = page.getByRole('region', { name: 'Entregas' });
    await expect(entregas.getByRole('img', { name: 'Entregas por período (kg)' })).toBeVisible();
    // Una sola serie: sin leyenda.
    await expect(entregas.getByRole('list', { name: 'Leyenda' })).toHaveCount(0);
    const total = (await entregas.getByText(/^Total: /).textContent())!;

    // Tooltip con el teclado.
    await entregas.getByRole('img', { name: /^nov.*2025: Cantidad \(kg\)/ }).focus();
    await expect(entregas.getByRole('status')).toContainText('Cantidad (kg)');

    await entregas.getByRole('button', { name: 'Ver como tabla' }).click();
    await expect(entregas.getByRole('table', { name: 'Entregas por período (kg)' }).getByRole('row')).toHaveCount(13);
    await entregas.getByRole('button', { name: 'Ver gráfico' }).click();

    await entregas.getByRole('checkbox', { name: 'Solo orgánico' }).check();
    await expect(entregas.getByText(/^Total: /)).not.toHaveText(total);

    const descarga = page.waitForEvent('download');
    await entregas.getByRole('button', { name: 'Exportar en Excel' }).click();
    expect((await descarga).suggestedFilename()).toBe('entregas.xlsx');
  });

  test('rendimiento: entrada y salida con leyenda, y el porcentaje en su propio gráfico', async ({ page }) => {
    await ingresar(page, 'stock/tablero');
    const rendimiento = page.getByRole('region', { name: 'Rendimiento del procesamiento' });
    await expect(rendimiento.getByRole('combobox', { name: 'Proceso' })).toHaveValue('21');
    await expect(rendimiento.getByRole('list', { name: 'Leyenda' })).toContainText('Entrada (kg)');
    await expect(rendimiento.getByRole('list', { name: 'Leyenda' })).toContainText('Salida (kg)');
    await expect(rendimiento.getByRole('img', { name: 'Rendimiento (salida sobre entrada)' })).toBeVisible();
    // El campo de evidencia del proceso aparece como filtro.
    await expect(rendimiento.getByRole('textbox', { name: 'Humedad (%)' })).toBeVisible();
    const descarga = page.waitForEvent('download');
    await rendimiento.getByRole('button', { name: 'Exportar en PDF' }).click();
    expect((await descarga).suggestedFilename()).toBe('procesamiento.pdf');
  });
});
