import { test, expect } from './ayudas';

test.describe('portal y sesión', () => {
  test('sin sesión manda a ingresar y vuelve a donde iba', async ({ page }) => {
    await page.goto('perfil');
    await expect(page).toHaveURL(/\/ingreso\?volver=/);
    await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
    await page.getByLabel('Contraseña').fill('mala');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByText('El correo o la contraseña no son correctos.')).toBeVisible();
    await page.getByLabel('Contraseña').fill('demo1234');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByRole('heading', { name: 'Mi perfil' })).toBeVisible();
  });

  test('inicio, edición del perfil y salida', async ({ page }) => {
    await page.goto('ingreso');
    await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
    await page.getByLabel('Contraseña').fill('demo1234');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible();
    // Vitrina, productores y stock ya están en la v2; productos, en parte (la ficha).
    await expect(page.getByText('En la nueva versión', { exact: true })).toHaveCount(3);
    await expect(page.getByText('En parte en la nueva versión', { exact: true })).toHaveCount(1);

    await page.getByRole('link', { name: 'Mi perfil' }).click();
    await page.getByLabel('Apellido').fill('Prueba');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Cambios guardados')).toBeVisible();

    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/ingreso/);
  });
});
