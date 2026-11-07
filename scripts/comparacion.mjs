// Capturas y mediciones de la comparación «antes y después» (docs/ANTES-Y-DESPUES.md).
//
// Necesita una instalación con las dos interfaces detrás del proxy de convivencia (ANGULAR=si y
// QR_A_V2=no, para ver también la vitrina de la versión actual) y datos de ejemplo:
//
//   COMPARACION_URL=http://127.0.0.1:8390 INATRACE_USUARIO=… INATRACE_CLAVE=… \
//   COMPARACION_ETIQUETA=<uuid> COMPARACION_QR=<código> node scripts/comparacion.mjs
//
// Guarda las imágenes en docs/comparacion/ y las mediciones en docs/comparacion/mediciones.json.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.COMPARACION_URL ?? 'http://127.0.0.1:8390';
const { INATRACE_USUARIO: usuario, INATRACE_CLAVE: clave, COMPARACION_ETIQUETA: etiqueta, COMPARACION_QR: qr } = process.env;
const SALIDA = new URL('../docs/comparacion/', import.meta.url);
await mkdir(SALIDA, { recursive: true });

const ESCRITORIO = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
const CELULAR = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/** [nombre, ruta antes, ruta después, opciones]. */
const PARES = [
  ['ingreso', '/es/login', '/v2/ingreso', { sinSesion: true }],
  ['inicio', '/es/home', '/v2/', {}],
  ['productores', '/es/my-farmers', '/v2/productores', {}],
  ['productor', '/es/my-farmers/edit/1', '/v2/productores/1', {}],
  ['entregas', '/es/my-stock/deliveries', '/v2/stock/entregas', {}],
  ['etiqueta', '/es/product-labels/1/labels/1', '/v2/productos/1/etiquetas/1', {}],
  ['cadenas', '/es/value-chains', '/v2/administracion/cadenas', {}],
  ['vitrina-celular', `/es/p-cd/${etiqueta}/${qr}`, `/v2/p-cd/${etiqueta}/${qr}`, { sinSesion: true, celular: true, medir: true }],
  ['productores-celular', '/es/my-farmers', '/v2/productores', { celular: true }],
];

const navegador = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const mediciones = {};

for (const [nombre, antes, despues, o] of PARES) {
  for (const [lado, ruta] of [['antes', antes], ['despues', despues]]) {
    const contexto = await navegador.newContext({ ...(o.celular ? CELULAR : ESCRITORIO), locale: 'es-ES', baseURL: BASE });
    // La sesión es la misma para las dos interfaces: se abre una vez por la API.
    if (!o.sinSesion) await contexto.request.post('/api/user/login', { data: { username: usuario, password: clave } });
    // En la versión actual: el aviso de cookies ya respondido (sin rastreadores, como la v2, para que la
    // medición sea pareja) y la empresa ya elegida, como haría una persona después de la primera visita.
    await contexto.addInitScript(() => {
      for (const k of ['cookieConsentGoogleAnalytics', 'cookieConsentFacebookPixel', 'cookieConsentIntercom', 'cookieConsentRocket']) localStorage.setItem(k, 'false');
      localStorage.setItem('cookieConsent', 'true');
      localStorage.setItem('selectedUserCompany', '1');
    });
    const page = await contexto.newPage();
    await page.goto(ruta, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2500);
    if (o.medir) {
      // Lo que baja el celular para abrir la vitrina: bytes transferidos y cantidad de pedidos.
      mediciones[`${nombre}-${lado}`] = await page.evaluate(() => {
        const r = performance.getEntriesByType('resource');
        const n = performance.getEntriesByType('navigation')[0];
        const bytes = r.reduce((t, x) => t + (x.transferSize || 0), n?.transferSize ?? 0);
        const js = r.filter((x) => x.initiatorType === 'script' || /\.js(\?|$)/.test(x.name)).reduce((t, x) => t + (x.transferSize || 0), 0);
        return { pedidos: r.length + 1, kb: Math.round(bytes / 1024), kbJs: Math.round(js / 1024), cargaMs: Math.round(n?.loadEventEnd ?? 0) };
      });
    }
    await page.screenshot({ path: new URL(`${nombre}-${lado}.png`, SALIDA).pathname });
    console.log('✓', nombre, lado);
    await contexto.close();
  }
}
await writeFile(new URL('mediciones.json', SALIDA), JSON.stringify(mediciones, null, 2) + '\n');
console.log(mediciones);
await navegador.close();
