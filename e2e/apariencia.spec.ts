import type { Page } from '@playwright/test';
import { test, expect, VITRINA } from './ayudas';

async function ingresar(page: Page, destino: string) {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('apariencia y avisos', () => {
  test('la galería de la vitrina se mueve con flechas y puntos, sin barra de desplazamiento', async ({ page }) => {
    await page.goto(VITRINA + '/producers');
    const galeria = page.getByRole('region', { name: 'Conoce a los productores' });
    const puntos = galeria.getByRole('button', { name: /^Ir a la foto/ });
    await expect(puntos).toHaveCount(3);
    await expect(puntos.first()).toHaveAttribute('aria-current', 'true');
    await expect(galeria.getByRole('button', { name: 'Foto anterior' })).toBeDisabled();
    await galeria.getByRole('button', { name: 'Foto siguiente' }).click();
    await expect(puntos.nth(1)).toHaveAttribute('aria-current', 'true');
    await galeria.getByRole('button', { name: 'Ir a la foto 3 de 3' }).click();
    await expect(galeria.getByRole('button', { name: 'Foto siguiente' })).toBeDisabled();
    // Sin la barra del sistema.
    expect(await galeria.locator('ul').evaluate((ul) => getComputedStyle(ul).scrollbarWidth)).toBe('none');
  });

  test('se elige un tema en el perfil, queda guardado y el botón alterna con el último del otro modo', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await ingresar(page, 'perfil');
    await expect(page.getByRole('heading', { name: 'Apariencia' })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(12);
    await page.getByText('Océano', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'oceano');
    await page.getByText('Carbón', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'carbon');
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--marca').trim())).toBe('#ffb549');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'carbon');
    // El botón de la barra vuelve al último claro elegido (Océano) y de ahí a Carbón.
    await page.getByRole('button', { name: 'Tema claro' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'oceano');
    await page.getByRole('button', { name: 'Tema oscuro' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'carbon');
  });

  test('los avisos son propios: Esc y «Cancelar» no borran nada', async ({ page }) => {
    await ingresar(page, 'productos/1');
    const titulo = page.getByRole('heading', { level: 1, name: 'Café Flor de la Sierra' });
    await expect(titulo).toBeVisible();
    let nativo = false;
    page.on('dialog', (d) => {
      nativo = true;
      void d.dismiss();
    });
    await page.getByRole('button', { name: 'Borrar producto' }).click();
    const aviso = page.getByRole('alertdialog');
    await expect(aviso).toBeVisible();
    // Lo delicado empieza con el foco en «Cancelar».
    await expect(aviso.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(aviso).toBeHidden();
    await page.getByRole('button', { name: 'Borrar producto' }).click();
    await aviso.getByRole('button', { name: 'Cancelar' }).click();
    await expect(aviso).toBeHidden();
    await expect(titulo).toBeVisible();
    expect(nativo).toBe(false);
  });
});
