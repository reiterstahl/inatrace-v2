import { test, expect } from './ayudas';

/**
 * Ninguna pantalla puede ser más ancha que la ventana: en un celular eso hace que el navegador aleje
 * la página entera. Pasó con tablas anchas cuyos textos ocultos (sr-only, posición absoluta) se salían
 * del contenedor con scroll horizontal.
 */
const PANTALLAS = ['', 'productores', 'stock/entregas', 'stock/todo?inst=11', 'stock/procesamiento', 'stock/procesamiento/nueva?accion=21&inst=11', 'stock/pagos', 'stock/tablero', 'stock/pagos?vista=masivos', 'stock/trazabilidad/310', 'stock/ordenes', 'stock/ordenes?vista=recibidas', 'stock/ordenes/cliente', 'stock/ordenes/812/aprobar', 'stock/pagos/nuevo?orden=812', 'stock/beyco/oferta?lotes=310', 'productos', 'productos/1', 'productos/2', 'productos/nuevo', 'productos/1/vitrina', 'productos/1/empresas', 'productos/1/finales', 'productos/1/conocimiento', 'empresa', 'empresa/usuarios', 'empresa/instalaciones', 'empresa/instalaciones/nueva', 'empresa/instalaciones/11', 'empresa/acciones', 'empresa/acciones/nueva', 'empresa/acciones/21', 'empresa/clientes', 'productores/recolectores', 'productores/recolectores/201', 'productos/1/etiquetas', 'productos/1/etiquetas/11', 'productos/1/etiquetas/11/lotes', 'productos/1/etiquetas/11/opiniones', 'productos/1/etiquetas/11/estadisticas'];

test('ninguna pantalla es más ancha que la ventana', async ({ page }) => {
  test.setTimeout(PANTALLAS.length * 6_000); // recorre todas las pantallas en una sola prueba
  await page.goto('ingreso');
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
  for (const ruta of PANTALLAS) {
    await page.goto(ruta);
    await expect(page.locator('main h1').first()).toBeVisible({ timeout: 15_000 }); // primera carga de cada ruta en desarrollo
    await page.waitForLoadState('networkidle');
    const medidas = await page.evaluate(() => ({ ventana: document.documentElement.clientWidth, documento: document.documentElement.scrollWidth, visible: window.innerWidth }));
    expect(medidas.documento, `ancho del documento en /${ruta}`).toBeLessThanOrEqual(medidas.ventana);
    expect(medidas.visible, `zoom de la ventana en /${ruta}`).toBe(medidas.ventana);
  }
});

// La administración tiene una entrada más en la barra.
test('con la administración del sistema tampoco', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('simulado.rol', 'SYSTEM_ADMIN'));
  await page.goto('ingreso');
  await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
  for (const ruta of ['', 'administracion/empresas', 'administracion/usuarios', 'administracion/usuarios/8', 'administracion/cadenas', 'administracion/cadenas/1', 'administracion/cadenas/nueva', 'administracion/catalogos', 'administracion/catalogos?tipo=tipos-evidencia', 'administracion/monedas', 'administracion/ajustes', 'administracion/catalogos?tipo=capas-mapa', 'administracion/catalogos?tipo=factores', 'empresa']) {
    await page.goto(ruta);
    await expect(page.locator('main h1').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    const medidas = await page.evaluate(() => ({ ventana: document.documentElement.clientWidth, documento: document.documentElement.scrollWidth }));
    expect(medidas.documento, `ancho del documento en /${ruta}`).toBeLessThanOrEqual(medidas.ventana);
  }
});
