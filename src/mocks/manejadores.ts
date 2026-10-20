import { http, HttpResponse, delay } from 'msw';
import type { ApiUserGet } from '@/api/gen/types.gen';
import { ETIQUETA_DEMO, QR_DEMO, etiqueta, qr } from './datos/vitrina';
import type { ApiUserCustomer } from '@/api/gen/types.gen';
import { EMPRESA_DEMO, capasMapa, paises, parcelasDe, productoresIniciales, tiposCertificacion, tiposProducto } from './datos/productores';

/**
 * Respuestas simuladas con la misma forma que el backend ({ status, data }).
 * Ingreso de prueba: demo@inatrace.local / demo1234.
 */
const ok = <T,>(data?: T) => HttpResponse.json({ status: 'OK', data });
const error = (http: number, status: string, errorMessage: string) => HttpResponse.json({ status, errorMessage }, { status: http });

const CLAVE_SESION = 'simulado.sesion';
const conSesion = () => sessionStorage.getItem(CLAVE_SESION) === '1';

let usuario: ApiUserGet = { id: 7, email: 'demo@inatrace.local', name: 'Ana', surname: 'Demo', status: 'ACTIVE', role: 'USER', language: 'ES', companyIds: [1], companyIdsAdmin: [1] };

// Productores: se guardan en sessionStorage para que sobrevivan a una recarga (como un backend).
const CLAVE_PRODUCTORES = 'simulado.productores';
const leerProductores = (): ApiUserCustomer[] => JSON.parse(sessionStorage.getItem(CLAVE_PRODUCTORES) ?? 'null') ?? productoresIniciales;
const guardarProductores = (l: ApiUserCustomer[]) => sessionStorage.setItem(CLAVE_PRODUCTORES, JSON.stringify(l));
let siguienteId = 500;
const paginado = <T,>(items: T[]) => ok({ items, count: items.length, offset: 0, limit: items.length });
const sinSesion = () => error(401, 'UNAUTHORIZED', 'Unauthorized');

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
  http.post('/api/public/logRequest', async ({ request }) => {
    const b = (await request.json()) as { token?: string };
    // MSW intercepta dentro de la página: la petición no sale a la red. Se anota para las pruebas.
    const anotados = JSON.parse(sessionStorage.getItem('simulado.registros') ?? '[]') as unknown[];
    sessionStorage.setItem('simulado.registros', JSON.stringify([...anotados, b]));
    return b.token === 'token' ? ok() : error(400, 'INVALID_REQUEST', 'Invalid token');
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
  // ---------- Empresa y catálogos ----------
  http.get('/api/company/profile/:id/name', () => (conSesion() ? ok(EMPRESA_DEMO) : sinSesion())),
  http.get('/api/company/profile/:id', () => (conSesion() ? ok({ ...EMPRESA_DEMO, headquarters: { country: paises[0] } }) : sinSesion())),
  http.get('/api/company/:id/product-types', () => paginado(tiposProducto)),
  http.get('/api/company/associations/:id', () => paginado([{ id: 7, name: 'Asociación de Caficultores del Norte' }])),
  http.get('/api/common/countries', () => paginado(paises)),
  http.get('/api/chain/certification-type/active', () => ok(tiposCertificacion)),
  http.get('/api/chain/map-layer/active', () => ok(capasMapa)),

  // ---------- Productores ----------
  http.get('/api/company/userCustomers/:companyId/plots', () => (conSesion() ? ok(parcelasDe(leerProductores())) : sinSesion())),
  http.get('/api/company/userCustomers/:companyId/:type', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const u = new URL(request.url);
    const q = (u.searchParams.get('query') ?? '').toLowerCase();
    const por = u.searchParams.get('searchBy') === 'BY_SURNAME' ? 'surname' : 'name';
    const campo = ({ BY_ID: 'id', BY_SURNAME: 'surname' } as Record<string, 'id' | 'surname'>)[u.searchParams.get('sortBy') ?? ''] ?? 'name';
    const signo = u.searchParams.get('sort') === 'DESC' ? -1 : 1;
    const todos = leerProductores()
      .filter((p) => !q || String(p[por] ?? '').toLowerCase().includes(q))
      .sort((a, b) => (String(a[campo]).localeCompare(String(b[campo]), 'es', { numeric: true })) * signo);
    const desde = Number(u.searchParams.get('offset') ?? 0), cuantos = Number(u.searchParams.get('limit') ?? 20);
    return ok({ items: todos.slice(desde, desde + cuantos), count: todos.length, offset: desde, limit: cuantos });
  }),
  http.get('/api/company/userCustomers/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    const p = leerProductores().find((x) => x.id === Number(params.id));
    return p ? ok(p) : error(404, 'NOT_FOUND', 'Not found');
  }),
  http.post('/api/company/userCustomers/add/:companyId', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const nuevo = { ...((await request.json()) as ApiUserCustomer), id: siguienteId++ };
    nuevo.plots = (nuevo.plots ?? []).map((p) => ({ ...p, id: p.id ?? siguienteId++ }));
    guardarProductores([...leerProductores(), nuevo]);
    return ok(nuevo);
  }),
  http.put('/api/company/userCustomers/edit', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const p = (await request.json()) as ApiUserCustomer;
    p.plots = (p.plots ?? []).map((x) => ({ ...x, id: x.id ?? siguienteId++ }));
    guardarProductores(leerProductores().map((x) => (x.id === p.id ? p : x)));
    return ok(p);
  }),
  http.delete('/api/company/userCustomers/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    guardarProductores(leerProductores().filter((x) => x.id !== Number(params.id)));
    return ok();
  }),

  http.put('/api/user/profile', async ({ request }) => {
    if (!conSesion()) return error(401, 'UNAUTHORIZED', 'Unauthorized');
    usuario = { ...usuario, ...((await request.json()) as Partial<ApiUserGet>) };
    return ok(usuario);
  }),
];
