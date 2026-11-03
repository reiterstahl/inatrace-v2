import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';

async function ingresar(page: Page, destino: string, rol?: string) {
  if (rol) await page.addInitScript((r) => sessionStorage.setItem('simulado.rol', r), rol);
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('administración (modo simulado)', () => {
  test('sin rol de administración no hay entrada ni pantalla', async ({ page }) => {
    await ingresar(page, 'administracion');
    await expect(page.getByText('Esta sección es solo para la administración del sistema o regional.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Administración' })).toHaveCount(0);
  });

  test('empresas: filtrar, activar, desactivar y fusionar', async ({ page }) => {
    await ingresar(page, '', 'SYSTEM_ADMIN');
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Administración' }).click();
    await expect(page).toHaveURL(/administracion\/empresas$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Administración' })).toBeVisible();
    const lista = page.getByRole('listitem');
    await expect(lista).toHaveCount(4);

    // El backend busca por el comienzo del nombre.
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('coop');
    await expect(lista).toHaveCount(2);
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('');
    await page.getByRole('combobox', { name: 'Estado' }).selectOption({ label: 'Registrada' });
    await expect(lista).toHaveCount(1);
    await page.getByRole('combobox', { name: 'Estado' }).selectOption({ label: 'Todos' });

    page.on('dialog', (d) => void d.accept());
    const exportadora = page.getByRole('listitem', { name: 'Exportadora del Norte' });
    await expect(exportadora).toContainText('Registrada');
    await page.getByRole('button', { name: 'Activar Exportadora del Norte', exact: true }).click();
    await expect(page.getByText('Exportadora del Norte quedó activa.')).toBeVisible();
    await expect(exportadora).toContainText('Activa');
    await expect(page.getByRole('button', { name: 'Activar Exportadora del Norte', exact: true })).toHaveCount(0);

    // Fusionar: solo hacia empresas activas y nunca a la misma.
    await page.getByRole('button', { name: 'Fusionar Cooperativa La Vecina con otra empresa' }).click();
    const destino = page.getByRole('combobox', { name: 'Empresa de destino' });
    await expect(destino.getByRole('option')).toHaveText(['Elegir una empresa activa', 'Cooperativa Flor de la Sierra', 'Exportadora del Norte']);
    await destino.selectOption({ label: 'Exportadora del Norte' });
    await page.getByRole('listitem', { name: 'Cooperativa La Vecina' }).getByRole('button', { name: 'Fusionar', exact: true }).click();
    await expect(page.getByText('Las personas de Cooperativa La Vecina pasaron a Exportadora del Norte; Cooperativa La Vecina quedó desactivada.')).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Cooperativa La Vecina' })).toContainText('Desactivada');

    await page.getByRole('button', { name: 'Desactivar Exportadora del Norte' }).click();
    await expect(page.getByText('Exportadora del Norte quedó desactivada.')).toBeVisible();
  });

  test('crear una empresa y abrirla para completar la ficha', async ({ page }) => {
    await ingresar(page, 'administracion/empresas', 'SYSTEM_ADMIN');
    await page.getByRole('button', { name: 'Nueva empresa' }).click();
    await page.getByRole('button', { name: 'Crear y abrir' }).click();
    await expect(page.getByText('Escribe el nombre de la empresa.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Nombre' }).fill('Beneficio Las Nubes');
    await page.getByRole('button', { name: 'Crear y abrir' }).click();
    await expect(page).toHaveURL(/\/empresa$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Beneficio Las Nubes' })).toBeVisible();
    // Queda elegida arriba, junto a las empresas de la persona.
    await expect(page.getByRole('combobox', { name: 'Empresa' })).toHaveValue(/\d+/);
    await expect(page.getByRole('combobox', { name: 'Empresa' }).locator('option:checked')).toHaveText('Beneficio Las Nubes');

    await page.goto('administracion/empresas');
    await expect(page.getByRole('listitem', { name: 'Beneficio Las Nubes' })).toContainText('Registrada');
  });

  test('abrir otra empresa desde la lista', async ({ page }) => {
    await ingresar(page, 'administracion/empresas', 'SYSTEM_ADMIN');
    await page.getByRole('button', { name: 'Abrir Tostaduría Central' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tostaduría Central' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Tostaduría Central' })).toBeVisible();
  });

  test('la regional solo activa: sin crear, desactivar ni fusionar', async ({ page }) => {
    await ingresar(page, 'administracion/empresas', 'REGIONAL_ADMIN');
    await expect(page.getByText('Las empresas de tu región.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nueva empresa' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Desactivar|^Fusionar/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Activar Tostaduría Central', exact: true })).toBeVisible();
  });
});
