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
    // Los módulos: cada tarjeta entera es la entrada (la administración solo aparece a quien administra).
    const modulos = page.locator('main section').filter({ has: page.getByRole('heading', { name: 'Módulos' }) }).getByRole('link');
    await expect(modulos).toHaveCount(5);
    await expect(page.getByText('Administración', { exact: true })).toHaveCount(0);
    // La vitrina abre, en otra pestaña, la primera etiqueta publicada.
    const vitrina = page.getByRole('link', { name: /Vitrina pública del producto/ });
    await expect(vitrina).toHaveAttribute('href', /\/p-cd\/etiqueta-tienda\/EMPTY$/);
    await expect(vitrina).toHaveAttribute('target', '_blank');
    await page.getByRole('link', { name: /Productores y parcelas/ }).click();
    await expect(page).toHaveURL(/\/productores$/);

    // Empresa, idioma, tema y perfil están en el menú del avatar.
    await page.getByRole('button', { name: 'Menú de la cuenta' }).click();
    await page.getByRole('link', { name: 'Configurar perfil' }).click();
    await page.getByLabel('Apellido').fill('Prueba');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Cambios guardados')).toBeVisible();

    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/ingreso/);
  });
});
