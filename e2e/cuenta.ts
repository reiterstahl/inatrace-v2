import { expect, type Page } from '@playwright/test';

/** La empresa se elige en el menú de la cuenta (detrás del avatar): lo abre, elige y lo cierra. */
export async function elegirEmpresa(page: Page, nombre: string) {
  await page.getByRole('button', { name: 'Menú de la cuenta' }).click();
  const lista = page.getByRole('dialog', { name: 'Menú de la cuenta' }).getByRole('combobox', { name: 'Empresa' });
  await lista.selectOption({ label: nombre });
  await expect(lista.locator('option:checked')).toHaveText(nombre);
  await page.keyboard.press('Escape');
}
