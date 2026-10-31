import { test, expect } from './ayudas';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function ingresar(page: Page, destino: string) {
  await page.goto('ingreso?volver=' + encodeURIComponent('/' + destino));
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('lotes, opiniones y estadísticas de una etiqueta (modo simulado)', () => {
  test('lotes: crear con autenticidad y origen, buscar, validar fechas y borrar', async ({ page }) => {
    await ingresar(page, 'productos/1/etiquetas/11/lotes');
    await expect(page.getByRole('heading', { level: 2, name: 'Tienda en línea' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Lotes' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('2 lotes')).toBeVisible();

    await page.getByRole('button', { name: 'Nuevo lote' }).click();
    const form = page.getByRole('group', { name: 'Nuevo lote' });
    await form.getByRole('checkbox', { name: /^Verificar autenticidad/ }).check();
    await form.getByRole('checkbox', { name: /^Rastrear origen/ }).check();
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(form.getByText('Este campo es obligatorio.')).toBeVisible();
    await expect(form.getByText('Indica al menos una de las dos fechas.').first()).toBeVisible();
    await expect(form.getByText('Agrega al menos un lugar en el mapa.')).toBeVisible();
    await form.getByRole('textbox', { name: 'Número de lote' }).fill('FS-2026');
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(form.getByText('Solo letras sin tilde ni ñ y números, sin espacios ni guiones.')).toBeVisible();
    await form.getByRole('textbox', { name: 'Número de lote' }).fill('FS202603');
    await form.getByLabel('Fecha de producción', { exact: true }).fill('2026-10-01');
    await form.getByRole('button', { name: 'Usar los lugares del producto' }).click();
    await expect(form.getByRole('listitem', { name: 'Lugar 2' })).toBeVisible();
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Se guardó el lote FS202603.')).toBeVisible();
    const nuevo = page.getByRole('listitem', { name: 'Lote FS202603' });
    await expect(nuevo).toContainText('Producido el 2026-10-01');
    await expect(nuevo).toContainText('Origen: 2 lugares');

    await page.getByRole('searchbox', { name: 'Buscar' }).fill('FS202602');
    await expect(page.getByText('1 lote', { exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('');

    await nuevo.getByRole('button', { name: 'Editar' }).click();
    const edicion = page.getByRole('group', { name: 'Editar lote' });
    await edicion.getByLabel('Fecha de vencimiento', { exact: true }).fill('2026-09-01');
    await edicion.getByRole('button', { name: 'Guardar' }).click();
    await expect(edicion.getByText('El vencimiento no puede ser anterior a la producción.')).toBeVisible();
    await edicion.getByRole('button', { name: 'Cancelar' }).click();

    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar el lote FS202603' }).click();
    await expect(page.getByText('Se borró el lote FS202603.')).toBeVisible();
    await expect(page.getByText('2 lotes')).toBeVisible();
  });

  test('opiniones: filtrar, ver el consentimiento, exportar solo correos con permiso y borrar', async ({ page }) => {
    await ingresar(page, 'productos/1/etiquetas/11/opiniones');
    await expect(page.getByText('3 opiniones')).toBeVisible();
    const lucia = page.getByRole('listitem').filter({ hasText: 'lucia@example.com' });
    await expect(lucia).toContainText('Con consentimiento');
    await expect(lucia).toContainText('34 años · Femenino · Sabor: Mejor');
    await page.getByRole('button', { name: 'Queja' }).click();
    await expect(page.getByText('1 opinión', { exact: true })).toBeVisible();
    await expect(page.getByText('La bolsa llegó abierta.')).toBeVisible();
    await page.getByRole('button', { name: 'Todas' }).click();

    const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar correos' }).click()]);
    const csv = await readFile((await descarga.path())!, 'utf8');
    expect(csv).toBe('email\nlucia@example.com\n');

    page.once('dialog', (d) => void d.accept());
    await page.getByRole('listitem').filter({ hasText: 'La bolsa llegó abierta.' }).getByRole('button', { name: 'Borrar la opinión' }).click();
    await expect(page.getByText('Se borró la opinión.')).toBeVisible();
    await expect(page.getByText('2 opiniones')).toBeVisible();
  });

  test('estadísticas: visitas por país, mapa y verificaciones', async ({ page }) => {
    await ingresar(page, 'productos/1/etiquetas/11/estadisticas');
    await expect(page.getByLabel('128 visitas')).toBeVisible();
    const paises = page.getByRole('list', { name: 'Visitas por país' });
    await expect(paises.getByRole('listitem').first()).toContainText('Guatemala');
    await expect(page.getByRole('img', { name: 'Mapa de las visitas' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Verificación de autenticidad' })).toContainText('Total10');
    // Desde las estadísticas se vuelve al contenido de la etiqueta.
    await page.getByRole('link', { name: 'Contenido' }).click();
    await expect(page.getByRole('textbox', { name: 'Nombre de la etiqueta' })).toHaveValue('Tienda en línea');
  });
});
