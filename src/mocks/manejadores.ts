import { http, HttpResponse, delay } from 'msw';
import type { ApiUserGet } from '@/api/gen/types.gen';
import { ETIQUETA_DEMO, QR_DEMO, etiqueta, qr } from './datos/vitrina';

/**
 * Respuestas simuladas con la misma forma que el backend ({ status, data }).
 * Ingreso de prueba: demo@inatrace.local / demo1234.
 */
const ok = <T,>(data?: T) => HttpResponse.json({ status: 'OK', data });
const error = (http: number, status: string, errorMessage: string) => HttpResponse.json({ status, errorMessage }, { status: http });

const CLAVE_SESION = 'simulado.sesion';
const conSesion = () => sessionStorage.getItem(CLAVE_SESION) === '1';

let usuario: ApiUserGet = { id: 7, email: 'demo@inatrace.local', name: 'Ana', surname: 'Demo', status: 'ACTIVE', role: 'USER', language: 'ES' };

// Imagen de relleno generada al vuelo: así el modo simulado no depende de internet.
function imagen(clave: string) {
  const tonos: Record<string, [string, string]> = {
    'portada-fondo': ['#1f3527', '#3f6b4a'],
    cabecera: ['#2f5d3a', '#4f7d55'],
  };
  const [a, b] = tonos[clave] ?? ['#8a6a4a', '#c4a27a'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><path d="M0 470 C200 380 340 520 520 430 S760 380 800 420 V600 H0Z" fill="#000" opacity=".12"/></svg>`;
  return new HttpResponse(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
}

export const manejadores = [
  // ---------- Vitrina pública ----------
  http.get('/api/public/product/label/:uid', async ({ params }) => {
    await delay(250);
    return params.uid === ETIQUETA_DEMO ? ok(etiqueta) : error(404, 'NOT_FOUND', 'Label not found');
  }),
  http.get('/api/public/stock-order/:qrTag', async ({ params }) => {
    await delay(200);
    return params.qrTag === QR_DEMO ? ok(qr) : error(404, 'NOT_FOUND', 'QR tag not found');
  }),
  http.post('/api/public/product/label/feedback/:uid', async () => {
    await delay(400);
    return ok();
  }),
  http.get('/api/public/document/:clave', ({ params }) => imagen(String(params.clave))),

  // ---------- Sesión ----------
  http.post('/api/user/login', async ({ request }) => {
    await delay(300);
    const { username, password } = (await request.json()) as { username: string; password: string };
    if (username === 'demo@inatrace.local' && password === 'demo1234') {
      sessionStorage.setItem(CLAVE_SESION, '1');
      return ok();
    }
    return error(401, 'AUTH_ERROR', 'Invalid credentials');
  }),
  http.post('/api/user/logout', () => {
    sessionStorage.removeItem(CLAVE_SESION);
    return ok();
  }),
  http.post('/api/user/refresh_authentication', () => (conSesion() ? ok() : error(401, 'AUTH_ERROR', 'Invalid or expired refresh token'))),
  http.get('/api/user/profile', () => (conSesion() ? ok(usuario) : error(401, 'UNAUTHORIZED', 'Unauthorized'))),
  http.put('/api/user/profile', async ({ request }) => {
    if (!conSesion()) return error(401, 'UNAUTHORIZED', 'Unauthorized');
    usuario = { ...usuario, ...((await request.json()) as Partial<ApiUserGet>) };
    return ok(usuario);
  }),
];
