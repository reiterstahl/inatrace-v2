import { test, expect } from './ayudas';

/**
 * Ninguna pantalla puede ser más ancha que la ventana: en un celular eso hace que el navegador aleje
 * la página entera. Pasó con tablas anchas cuyos textos ocultos (sr-only, posición absoluta) se salían
 * del contenedor con scroll horizontal.
 */
const PANTALLAS = ['', 'productores', 'stock/entregas', 'stock/todo?inst=11', 'stock/procesamiento', 'stock/procesamiento/nueva?accion=21&inst=11', 'stock/pagos', 'stock/pagos?vista=masivos', 'stock/trazabilidad/310', 'stock/ordenes', 'stock/ordenes?vista=recibidas', 'stock/ordenes/cliente', 'stock/ordenes/812/aprobar', 'stock/pagos/nuevo?orden=812'];

test('ninguna pantalla es más ancha que la ventana', async ({ page }) => {
  await page.goto('ingreso');
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
  for (const ruta of PANTALLAS) {
    await page.goto(ruta);
    await expect(page.locator('main h1').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    const medidas = await page.evaluate(() => ({ ventana: document.documentElement.clientWidth, documento: document.documentElement.scrollWidth, visible: window.innerWidth }));
    expect(medidas.documento, `ancho del documento en /${ruta}`).toBeLessThanOrEqual(medidas.ventana);
    expect(medidas.visible, `zoom de la ventana en /${ruta}`).toBe(medidas.ventana);
  }
});
