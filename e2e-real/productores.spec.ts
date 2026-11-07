import { test, expect, type Page } from '@playwright/test';
import { aceptarAviso } from '../e2e/avisos';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
}

test.describe('productores contra el backend real', () => {
  test.beforeEach(async ({ page }) => ingresar(page));

  test('editar un productor guarda y persiste', async ({ page }) => {
    await page.goto('/v2/productores');
    await page.locator('tbody a').first().click();
    await expect(page.getByRole('heading', { level: 2, name: 'Datos personales' })).toBeVisible();
    await expect(page.getByText('Hay cambios sin guardar.')).toHaveCount(0); // recién abierta, sin cambios

    const telefono = page.getByRole('textbox', { name: 'Teléfono' });
    const original = await telefono.inputValue();
    const nuevo = '+502 5555 ' + String(Date.now()).slice(-4);
    await telefono.fill(nuevo);
    await expect(page.getByText('Hay cambios sin guardar.')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar' }).click();

    // La ficha de prueba puede no tener país cargado: se completa si el guardado lo pide.
    if (await page.getByText('Revisa los campos marcados').isVisible().catch(() => false)) {
      await page.getByRole('combobox', { name: /^País/ }).selectOption({ label: 'Guatemala' });
      await page.getByRole('textbox', { name: /^Ciudad o municipio/ }).fill('Huehuetenango');
      await page.getByRole('textbox', { name: /^Departamento o estado/ }).fill('Huehuetenango');
      await page.getByRole('button', { name: 'Guardar' }).click();
    }
    await expect(page.getByText('Cambios guardados.')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Teléfono' })).toHaveValue(nuevo);

    // Se deja como estaba.
    await page.getByRole('textbox', { name: 'Teléfono' }).fill(original);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Cambios guardados.')).toBeVisible();
  });

  test('crear un productor y borrarlo', async ({ page }) => {
    const apellido = 'Prueba-' + Date.now();
    await page.goto('/v2/productores/nuevo');
    await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Automática');
    await page.getByRole('textbox', { name: /^Apellido/ }).fill(apellido);
    await page.getByText('Mujer', { exact: true }).click();
    await page.getByRole('combobox', { name: /^País/ }).selectOption({ label: 'Guatemala' });
    await page.getByRole('textbox', { name: /^Ciudad o municipio/ }).fill('Huehuetenango');
    await page.getByRole('textbox', { name: /^Departamento o estado/ }).fill('Huehuetenango');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL(/\/v2\/productores\/\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: `Automática ${apellido}` })).toBeVisible();

    await aceptarAviso(page);
    await page.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page).toHaveURL(/\/v2\/productores$/);
    await page.getByPlaceholder('Buscar productores…').fill('Automática');
    await expect(page.getByText(apellido)).toHaveCount(0);
  });

  test('dibujar una parcela nueva, guardarla y quitarla', async ({ page }) => {
    const lote = 'Lote de prueba ' + Date.now();
    await page.goto('/v2/productores');
    await page.locator('tbody a').first().click();
    await expect(page.getByRole('heading', { level: 2, name: 'Parcelas' })).toBeVisible(); // ficha cargada
    const nParcelas = await page.getByText(/^Polígono de [\d.,]+ ha/).count();

    await page.getByRole('button', { name: 'Agregar parcela' }).click();
    await page.getByRole('textbox', { name: /^Nombre de la parcela/ }).fill(lote);
    const cultivo = page.getByRole('combobox', { name: /^Cultivo/ });
    test.skip((await cultivo.locator('option').count()) <= 1, 'El productor de prueba no tiene cultivos para elegir.');
    await cultivo.selectOption({ index: 1 });

    const mapa = page.getByRole('application', { name: 'Editor del polígono de la parcela' });
    await mapa.scrollIntoViewIfNeeded(); // fuera de pantalla, la rueda desplazaría la página y no el mapa
    await expect(mapa.locator('canvas')).toBeVisible();
    await page.waitForTimeout(2500); // estilo y teselas
    const caja = (await mapa.boundingBox())!;
    if (await page.getByText('Acércate a la parcela').isVisible()) {
      await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
      for (let i = 0; i < 30 && (await page.getByText('Acércate a la parcela').isVisible()); i++) {
        await page.mouse.wheel(0, -600);
        await page.waitForTimeout(300);
      }
    }
    await expect(page.getByText('Toca el mapa para marcar cada vértice')).toBeVisible();
    // Terra Draw sigue al puntero: se mueve antes de cada toque, como una persona.
    const pt = (fx: number, fy: number) => ({ x: caja.x + caja.width * fx, y: caja.y + caja.height * fy });
    for (const p of [pt(0.4, 0.4), pt(0.6, 0.4), pt(0.6, 0.6), pt(0.4, 0.6), pt(0.4, 0.4)]) {
      await page.mouse.move(p.x, p.y, { steps: 5 });
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(250);
    }
    await expect(page.getByText(/Superficie dibujada: [\d.,]+ ha/)).toBeVisible();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Cambios guardados.')).toBeVisible();

    // Persistió: al recargar está la parcela con su polígono.
    await page.reload();
    await expect(page.getByText(lote)).toBeVisible();
    await expect(page.getByText(/^Polígono de [\d.,]+ ha/)).toHaveCount(nParcelas + 1);

    // Se quita y se guarda: la ficha queda como estaba.
    await aceptarAviso(page);
    await page.getByRole('button', { name: `Quitar parcela ${lote}` }).click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Cambios guardados.')).toBeVisible();
    await page.reload();
    await expect(page.getByText(lote)).toHaveCount(0);
  });
});
