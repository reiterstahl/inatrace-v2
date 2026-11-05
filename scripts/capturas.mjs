// Capturas del README en modo simulado (sin backend). Uso: con `pnpm dev:simulado --port 5199`
// corriendo, `pnpm capturas` (o CAPTURAS_URL=http://localhost:5199/v2/ node scripts/capturas.mjs).
// Las imágenes van a docs/capturas/.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.CAPTURAS_URL ?? 'http://localhost:5199/v2/';
const SALIDA = new URL('../docs/capturas/', import.meta.url);
await mkdir(SALIDA, { recursive: true });

const ESCRITORIO = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
const CELULAR = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/** [archivo, ruta, opciones]: `rol` cambia el rol simulado; `publica` no inicia sesión. */
const CAPTURAS = [
  ['inicio', '', {}],
  ['productores-mapa', 'productores?vista=mapa', { esperar: 2500 }],
  ['productor-parcelas', 'productores/101', { esperar: 2500 }],
  ['entregas', 'stock/entregas', {}],
  ['trazabilidad', 'stock/trazabilidad/310', {}],
  ['tablero', 'stock/tablero', { esperar: 800 }],
  ['tablero-oscuro', 'stock/tablero', { esperar: 800, oscuro: true }],
  ['etiqueta', 'productos/1/etiquetas/11', {}],
  ['administracion', 'administracion/empresas', { rol: 'SYSTEM_ADMIN' }],
  ['vitrina-celular', 'p-cd/demo/QR-DEMO-2026', { celular: true, publica: true, esperar: 1500 }],
  ['entregas-celular', 'stock/entregas', { celular: true }],
];

const navegador = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
for (const [archivo, ruta, o] of CAPTURAS) {
  const contexto = await navegador.newContext({ ...(o.celular ? CELULAR : ESCRITORIO), locale: 'es-ES', colorScheme: o.oscuro ? 'dark' : 'light' });
  const page = await contexto.newPage();
  if (o.rol) await page.addInitScript((r) => sessionStorage.setItem('simulado.rol', r), o.rol);
  if (o.publica) {
    await page.goto(BASE + ruta);
  } else {
    await page.goto(BASE + 'ingreso?volver=' + encodeURIComponent('/' + ruta));
    await page.getByLabel('Correo electrónico').fill('demo@inatrace.local');
    await page.getByLabel('Contraseña').fill('demo1234');
    await page.getByRole('button', { name: 'Ingresar' }).click();
  }
  await page.locator('main h1, h1').first().waitFor({ timeout: 20_000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(o.esperar ?? 400);
  // En escritorio se recorta a la altura del contenido (sin el fondo vacío de abajo).
  const alto = o.celular ? undefined : await page.evaluate(() => Math.ceil(document.querySelector('main')?.getBoundingClientRect().bottom ?? 800));
  await page.screenshot({ path: new URL(`${archivo}.png`, SALIDA).pathname, ...(alto ? { clip: { x: 0, y: 0, width: 1280, height: Math.min(Math.max(alto - 40, 480), 800) } } : {}) });
  console.log('✓', archivo);
  await contexto.close();
}
await navegador.close();
