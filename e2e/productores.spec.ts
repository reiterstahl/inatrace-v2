import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';

async function ingresar(page: Page, destino = 'productores') {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('productores (modo simulado)', () => {
  test('lista, búsqueda y orden', async ({ page }) => {
    await ingresar(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Productores' })).toBeVisible();
    await expect(page.getByText('3 productores en Cooperativa Flor de la Sierra')).toBeVisible();
    await page.getByPlaceholder('Buscar productores…').fill('ros');
    await expect(page).toHaveURL(/q=ros/);
    await expect(page.getByRole('link', { name: /Rosa/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /María/ })).toHaveCount(0);
    // La búsqueda queda en la URL: al recargar sigue aplicada.
    await page.reload();
    await expect(page.getByPlaceholder('Buscar productores…')).toHaveValue('ros');
  });

  test('ficha: validación y guardado', async ({ page }) => {
    await ingresar(page, 'productores/101');
    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible();
    await expect(page.getByText('Hay cambios sin guardar.')).toHaveCount(0);

    const apellido = page.getByRole('textbox', { name: /^Apellido/ });
    await apellido.fill('');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Revisa los campos marcados antes de guardar.')).toBeVisible();
    await expect(page.getByText('Este campo es obligatorio.').first()).toBeVisible();

    await apellido.fill('López Ajcá');
    await page.getByRole('textbox', { name: 'Teléfono' }).fill('+502 5555 9999');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Cambios guardados.')).toBeVisible();
    await expect(page.getByText('Hay cambios sin guardar.')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'María López Ajcá' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Teléfono' })).toHaveValue('+502 5555 9999');
  });

  test('la dirección cambia según el país', async ({ page }) => {
    await ingresar(page, 'productores/nuevo');
    const pais = page.getByRole('combobox', { name: /^País/ });
    await pais.selectOption({ label: 'Rwanda' });
    for (const c of ['Aldea', 'Celda', 'Sector']) await expect(page.getByRole('textbox', { name: new RegExp('^' + c) })).toBeVisible();
    await pais.selectOption({ label: 'Honduras' });
    await expect(page.getByRole('textbox', { name: /^Municipio/ })).toBeVisible();
    await pais.selectOption({ label: 'Guatemala' });
    await expect(page.getByRole('textbox', { name: /^Ciudad o municipio/ })).toBeVisible();
  });

  test('crear, ver en la lista y borrar', async ({ page }) => {
    await ingresar(page, 'productores/nuevo');
    await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Juana');
    await page.getByRole('textbox', { name: /^Apellido/ }).fill('Tzul');
    await page.getByText('Mujer', { exact: true }).click();
    await page.getByRole('combobox', { name: /^País/ }).selectOption({ label: 'Guatemala' });
    await page.getByRole('textbox', { name: /^Ciudad o municipio/ }).fill('Totonicapán');
    await page.getByRole('textbox', { name: /^Departamento o estado/ }).fill('Totonicapán');
    await page.getByRole('combobox', { name: 'Agregar cultivo' }).selectOption({ label: 'Cacao' });
    await page.getByRole('textbox', { name: 'Superficie cultivada total' }).fill('1,25');
    // Con lista de sugerencias (datalist), el campo de unidad es un combobox.
    await page.getByRole('combobox', { name: 'Unidad de superficie' }).fill('ha');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL(/\/v2\/productores\/\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Juana Tzul' })).toBeVisible();

    await page.getByRole('link', { name: 'Productores' }).first().click();
    await expect(page.getByText('4 productores en Cooperativa Flor de la Sierra')).toBeVisible();
    await page.getByRole('link', { name: /Juana/ }).first().click();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText('3 productores en Cooperativa Flor de la Sierra')).toBeVisible();
  });

  test('vista de mapa', async ({ page }) => {
    await ingresar(page, 'productores');
    await page.getByRole('button', { name: 'Mapa' }).click();
    await expect(page).toHaveURL(/vista=mapa/);
    await expect(page.getByRole('img', { name: 'Parcelas de la empresa' })).toBeAttached();
    await expect(page.getByText('2 parcelas con polígono.', { exact: false })).toBeVisible();
  });

  test('recolectores: lista, ficha sin finca ni parcelas, crear y borrar', async ({ page }) => {
    await ingresar(page, 'productores/recolectores');
    await expect(page.getByRole('link', { name: 'Recolectores' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('listitem', { name: 'Julio Tzul' })).toBeVisible();
    // Los productores no aparecen entre los recolectores.
    await expect(page.getByText('1 recolector de', { exact: false })).toBeVisible();

    await page.getByRole('link', { name: 'Nuevo recolector' }).click();
    await expect(page.getByRole('heading', { name: 'Parcelas' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Finca' })).toHaveCount(0);
    await expect(page.getByText('Recolecta para', { exact: false })).toBeVisible();
    await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Marcos');
    await page.getByRole('textbox', { name: /^Apellido/ }).fill('Ixcoy');
    await page.getByText('Hombre', { exact: true }).click();
    await page.getByRole('combobox', { name: /^País/ }).selectOption({ label: 'Guatemala' });
    await page.getByRole('textbox', { name: /^Ciudad o municipio/ }).fill('Chiantla');
    await page.getByRole('textbox', { name: /^Departamento o estado/ }).fill('Huehuetenango');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL(/\/v2\/productores\/recolectores\/\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Marcos Ixcoy' })).toBeVisible();

    await page.getByRole('link', { name: 'Recolectores' }).first().click();
    await expect(page.getByRole('listitem', { name: 'Marcos Ixcoy' })).toBeVisible();
    // Y no se mezcla con los productores.
    await page.getByRole('link', { name: 'Productores', exact: true }).last().click();
    await expect(page.getByText('Marcos', { exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Recolectores' }).first().click();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: /^Eliminar a Marcos Ixcoy|^Borrar.*Marcos Ixcoy/ }).click();
    await expect(page.getByText('Se eliminó a Marcos Ixcoy.')).toBeVisible();
  });
});
