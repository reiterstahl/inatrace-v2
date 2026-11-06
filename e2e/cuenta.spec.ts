import { test, expect } from './ayudas';

test.describe('cuenta (modo simulado)', () => {
  test('registro: validaciones, cuenta repetida y aviso de revisar el correo', async ({ page }) => {
    await page.goto('ingreso');
    await page.getByRole('link', { name: 'Crear una cuenta' }).click();
    await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Este campo es obligatorio.')).toHaveCount(4);
    await expect(page.getByText('Para crear la cuenta tienes que aceptar las condiciones.')).toBeVisible();

    await page.getByRole('textbox', { name: 'Nombre' }).fill('Lucía');
    await page.getByRole('textbox', { name: 'Apellido' }).fill('Tzoc');
    await page.getByRole('textbox', { name: 'Correo electrónico' }).fill('luis@inatrace.local');
    await page.getByLabel('Contraseña', { exact: true }).fill('corta');
    await expect(page.getByText('La contraseña debe tener de 8 a 50 caracteres.')).toBeVisible();
    await page.getByLabel('Contraseña', { exact: true }).fill('una-clave-segura');
    await page.getByLabel('Repite la contraseña').fill('otra-clave-segura');
    await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible();
    await page.getByLabel('Repite la contraseña').fill('una-clave-segura');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Ya hay una cuenta con ese correo.')).toBeVisible();

    await page.getByRole('textbox', { name: 'Correo electrónico' }).fill('lucia@inatrace.local');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
    await expect(page.getByText(/Te enviamos un enlace a lucia@inatrace.local/)).toBeVisible();
  });

  test('confirmar el correo con el enlace (válido y vencido)', async ({ page }) => {
    await page.goto('confirm-email/codigo-valido');
    await expect(page.getByText(/Tu correo quedó confirmado/)).toBeVisible();
    await page.goto('confirm-email/codigo-viejo');
    await expect(page.getByText('El enlace no es válido o ya se usó. Pide uno nuevo.')).toBeVisible();
  });

  test('olvidé mi contraseña: la respuesta no revela si la cuenta existe', async ({ page }) => {
    for (const correo of ['nadie@inatrace.local', 'pedro@inatrace.local']) {
      await page.goto('olvide-clave');
      await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(correo);
      await page.getByRole('button', { name: 'Enviar enlace' }).click();
      await expect(page.getByText(`Si hay una cuenta activa con ${correo}, te enviamos un enlace`, { exact: false })).toBeVisible();
    }
  });

  test('restablecer: sin activar no entra; activa entra al portal', async ({ page }) => {
    await page.goto('reset-password/codigo-valido');
    await page.getByLabel('Contraseña nueva').fill('nueva-clave-segura');
    await page.getByLabel('Repite la contraseña').fill('nueva-clave-segura');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByText(/Tu contraseña cambió. Podrás ingresar con ella cuando la administración/)).toBeVisible();

    await page.goto('reset-password/codigo-vencido');
    await page.getByLabel('Contraseña nueva').fill('nueva-clave-segura');
    await page.getByLabel('Repite la contraseña').fill('nueva-clave-segura');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByText('El enlace no es válido o ya se usó. Pide uno nuevo.')).toBeVisible();

    await page.goto('reset-password/codigo-activa');
    await page.getByLabel('Contraseña nueva').fill('nueva-clave-segura');
    await page.getByLabel('Repite la contraseña').fill('nueva-clave-segura');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
  });
});
