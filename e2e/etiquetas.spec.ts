import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';
import { aceptarAviso } from './avisos';

async function ingresar(page: Page, destino: string) {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('etiquetas (modo simulado)', () => {
  test('crear una etiqueta, elegir qué se muestra, medios y publicarla', async ({ page }) => {
    await ingresar(page, 'productos/1/etiquetas');
    await expect(page.getByRole('listitem', { name: 'Tienda en línea' })).toContainText('Publicada');
    await page.getByRole('button', { name: 'Nueva etiqueta' }).click();
    const nueva = page.getByRole('group', { name: 'Nueva etiqueta' });
    await nueva.getByRole('button', { name: 'Crear etiqueta' }).click();
    await expect(nueva.getByText('Este campo es obligatorio.')).toBeVisible();
    await nueva.getByRole('textbox', { name: 'Nombre de la etiqueta' }).fill('Feria 2026');
    await nueva.getByRole('combobox', { name: 'Idioma' }).selectOption({ label: 'Inglés' });
    await nueva.getByRole('button', { name: 'Crear etiqueta' }).click();

    // Editor: arranca con el contenido del producto y solo sus datos a la vista.
    await expect(page).toHaveURL(/etiquetas\/\d+$/);
    await expect(page.getByRole('textbox', { name: 'Nombre de la etiqueta' })).toHaveValue('Feria 2026');
    await expect(page.getByText('Sin publicar')).toBeVisible();
    await expect(page.getByRole('combobox', { name: /^Idioma de la vitrina/ })).toHaveValue('EN');
    await expect(page.getByRole('checkbox', { name: 'Mostrar en la vitrina: Nombre', exact: true })).toBeChecked();
    const proceso = page.getByRole('checkbox', { name: 'Mostrar en la vitrina: Cómo se produce' });
    await expect(proceso).not.toBeChecked();
    await proceso.check();
    await page.getByRole('checkbox', { name: 'Mostrar en la vitrina: Sitio web' }).check();
    await page.getByRole('region', { name: 'Datos del producto' }).getByRole('textbox', { name: 'Nombre', exact: true }).fill('Café de feria');

    // Medios: un solo video.
    await page.getByRole('checkbox', { name: 'Visita a la finca' }).check();
    await page.getByRole('checkbox', { name: 'Día de corte' }).check();
    await page.getByRole('checkbox', { name: 'Don Luis' }).check();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Elige un solo video: la vitrina muestra uno.')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Día de corte' }).uncheck();
    // Con cambios sin guardar no se publica.
    await expect(page.getByRole('button', { name: 'Publicar' })).toBeDisabled();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Etiqueta guardada.')).toBeVisible();

    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('La etiqueta está publicada: sus QR abren la vitrina.')).toBeVisible();
    await expect(page.getByText('Publicada', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'Mostrar en la vitrina: Cómo se produce' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Mostrar en la vitrina: Sitio web' })).toBeChecked();
    await expect(page.getByRole('region', { name: 'Datos del producto' }).getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue('Café de feria');
    await expect(page.getByRole('checkbox', { name: 'Visita a la finca' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Don Luis' })).toBeChecked();
    // El contenido de la etiqueta es propio: el producto no cambió.
    await page.getByRole('link', { name: 'Ficha' }).click();
    await expect(page.getByRole('textbox', { name: /^Nombre/ }).first()).toHaveValue('Café Flor de la Sierra');
  });

  test('la vista previa abre la vitrina con los cambios sin guardar', async ({ page, context }) => {
    await ingresar(page, 'productos/1/etiquetas');
    await page.getByRole('link', { name: 'Tienda en línea' }).click();
    await page.getByRole('region', { name: 'Datos del producto' }).getByRole('textbox', { name: 'Nombre', exact: true }).fill('Café de prueba previa');
    await page.getByRole('checkbox', { name: 'Doña Marta' }).uncheck();
    await page.getByRole('checkbox', { name: 'Don Luis' }).check();
    const [previa] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Vista previa' }).click()]);
    await expect(previa).toHaveURL(/\/p-cd\/previa-11\/EMPTY$/);
    await expect(previa.getByRole('status')).toContainText('Vista previa');
    await expect(previa.getByRole('heading', { level: 1, name: 'Café de prueba previa' })).toBeVisible();
    await previa.goto(previa.url() + '/producers');
    await expect(previa.getByText('Don Luis')).toBeVisible();
    await expect(previa.getByText('Doña Marta')).toHaveCount(0);
    // Desde la vista previa no se envían opiniones.
    await previa.goto(previa.url().replace('/producers', '/feedback'));
    await expect(previa.getByText('En la vista previa no se envían opiniones.')).toBeVisible();
    await expect(previa.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    // El editor sigue con los cambios sin guardar.
    await expect(page.getByRole('region', { name: 'Datos del producto' }).getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue('Café de prueba previa');
  });

  test('retirar y borrar una etiqueta', async ({ page }) => {
    await ingresar(page, 'productos/1/etiquetas');
    await page.getByRole('link', { name: 'Tienda en línea' }).click();
    await page.getByRole('button', { name: 'Retirar de la vitrina' }).click();
    await expect(page.getByText('La etiqueta ya no se muestra en la vitrina.')).toBeVisible();
    await aceptarAviso(page);
    await page.getByRole('button', { name: 'Borrar etiqueta' }).click();
    await expect(page).toHaveURL(/productos\/1\/etiquetas$/);
    await expect(page.getByText('Todavía no hay etiquetas.')).toBeVisible();
  });
});
