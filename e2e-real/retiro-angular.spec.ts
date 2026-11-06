import { test, expect, type Page } from '@playwright/test';

/**
 * Fase 6: con la interfaz actual retirada (ANGULAR=no en el proxy), cada ruta vieja lleva a su
 * equivalente en la v2, y ese destino existe. Solo corre si ANGULAR_RETIRADO=1 (por el proxy).
 */
const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '', ANGULAR_RETIRADO } = process.env;

// [ruta vieja, destino esperado]. Ids de la demo: productor 101, instalación 11, producto 1, etiqueta 11.
const RUTAS: [string, string][] = [
  ['/', '/v2/'], ['/es/login', '/v2/ingreso'], ['/es/home', '/v2/'], ['/es/user-profile', '/v2/perfil'],
  ['/es/register', '/v2/registro'], ['/es/reset-password', '/v2/olvide-clave'], ['/es/reset-password/abc', '/v2/reset-password/abc'],
  ['/es/confirm-email/abc', '/v2/confirm-email/abc'], ['/es/account-activation', '/v2/ingreso'],
  ['/es/settings', '/v2/administracion/catalogos'], ['/es/settings/types', '/v2/administracion/catalogos'],
  ['/es/settings/additional', '/v2/administracion/ajustes'], ['/es/map-layers', '/v2/administracion/catalogos?tipo=capas-mapa'],
  ['/es/certification-types', '/v2/administracion/catalogos?tipo=certificaciones'], ['/es/conversion-factors', '/v2/administracion/catalogos?tipo=factores'],
  ['/es/currencies', '/v2/administracion/monedas'], ['/es/value-chains', '/v2/administracion/cadenas'],
  ['/es/value-chains/new', '/v2/administracion/cadenas/nueva'], ['/es/value-chains/1/value-chain', '/v2/administracion/cadenas/1'],
  ['/es/users', '/v2/administracion/usuarios'], ['/es/users/1', '/v2/administracion/usuarios/1'],
  ['/es/companies', '/v2/administracion/empresas'], ['/es/companies/new', '/v2/administracion/empresas'],
  ['/es/companies/1/company', '/v2/empresa'], ['/es/companies/1/users', '/v2/empresa/usuarios'],
  ['/es/companies/1/facilities', '/v2/empresa/instalaciones'], ['/es/companies/1/facilities/add', '/v2/empresa/instalaciones/nueva'],
  ['/es/companies/1/facilities/11/edit', '/v2/empresa/instalaciones/11'], ['/es/companies/1/processingActions', '/v2/empresa/acciones'],
  ['/es/companies/1/processingActions/new', '/v2/empresa/acciones/nueva'], ['/es/my-customers', '/v2/empresa/clientes'],
  ['/es/my-stock', '/v2/stock/entregas'], ['/es/my-stock/deliveries/tab', '/v2/stock/entregas'],
  ['/es/my-stock/deliveries/facility/11/COLLECTION/new', '/v2/stock/entregas/nueva?inst=11'],
  ['/es/my-stock/deliveries/facility/11/COLLECTION/new-bulk', '/v2/stock/entregas/masiva?inst=11'],
  ['/es/my-stock/processing', '/v2/stock/procesamiento'], ['/es/my-stock/payments', '/v2/stock/pagos'],
  ['/es/my-stock/all-stock', '/v2/stock/todo'], ['/es/my-stock/orders?code=x&state=y', '/v2/stock/beyco?code=x&state=y'],
  ['/es/my-orders', '/v2/stock/ordenes'], ['/es/my-orders/received-orders', '/v2/stock/ordenes?vista=recibidas'],
  ['/es/my-orders/customer-order/add', '/v2/stock/ordenes/cliente'], ['/es/company-dashboard', '/v2/stock/tablero'],
  ['/es/my-farmers', '/v2/productores'], ['/es/my-farmers/add', '/v2/productores/nuevo'],
  ['/es/my-farmers/edit/101', '/v2/productores/101'], ['/es/my-farmers/import', '/v2/productores/importar'],
  ['/es/my-collectors', '/v2/productores/recolectores'], ['/es/my-collectors/add', '/v2/productores/recolectores/nuevo'],
  ['/es/product-labels', '/v2/productos'], ['/es/product-labels/1/product', '/v2/productos/1'],
  ['/es/product-labels/1/stakeholders', '/v2/productos/1/empresas'], ['/es/product-labels/1/final-products', '/v2/productos/1/finales'],
  ['/es/product-labels/1/knowledge-blog', '/v2/productos/1/conocimiento'],
  ['/es/product-labels/1/labels/11/batches', '/v2/productos/1/etiquetas/11/lotes'],
  ['/es/product-labels/1/labels/11/feedback', '/v2/productos/1/etiquetas/11/opiniones'],
  ['/es/product-labels/1/labels/11/statistics', '/v2/productos/1/etiquetas/11/estadisticas'],
  ['/es/s/privacy', '/v2/'], ['/es/blog/1/x/2', '/v2/'], ['/algo-que-no-existe', '/v2/'],
];

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
}

test.describe('retiro de la interfaz actual (ANGULAR=no)', () => {
  test.skip(!ANGULAR_RETIRADO, 'Solo con ANGULAR_RETIRADO=1, contra el proxy de convivencia');

  test('cada ruta vieja redirige a su equivalente', async ({ request }) => {
    for (const [vieja, destino] of RUTAS) {
      const r = await request.get(vieja, { maxRedirects: 0 });
      expect(r.status(), vieja).toBe(302);
      expect(r.headers().location, vieja).toBe(destino);
    }
  });

  test('cada destino existe en la v2', async ({ page }) => {
    test.setTimeout(180_000);
    await ingresar(page);
    for (const destino of [...new Set(RUTAS.map(([, d]) => d))]) {
      // La vuelta de Beyco con un código falso y los enlaces con códigos de prueba no son pantallas normales.
      if (destino.startsWith('/v2/stock/beyco?') || /\/(confirm-email|reset-password)\//.test(destino)) continue;
      // Lo que se comprueba es que la ruta existe (sin el 404 de la v2); los ids de ejemplo pueden no
      // estar en la instalación, y entonces la pantalla muestra su propio aviso.
      // Sin esperar a que la red quede quieta: los mapas siguen bajando teselas.
      await page.goto(destino);
      await expect(page.locator('main, [role=main], h1').first(), destino).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(600);
      await expect(page.getByText('Esta página no existe.'), destino).toHaveCount(0);
    }
  });
});
