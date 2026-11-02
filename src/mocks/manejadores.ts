import { http, HttpResponse, delay } from 'msw';
import type { ApiFacility, ApiCompanyActionRequest, ApiCompanyGet, ApiCompanyUpdate, ApiCompanyUser, ApiFinalProduct, ApiKnowledgeBlog, ApiProduct, ApiProductLabel, ApiProductLabelBatch, ApiProductLabelCompanyDocument, ApiProductLabelContent, ApiProductLabelFeedback, ApiUserGet } from '@/api/gen/types.gen';
import { ETIQUETA_DEMO, QR_DEMO, etiqueta, qr } from './datos/vitrina';
import type { ApiUserCustomer } from '@/api/gen/types.gen';
import { accionesProcesamiento, clientes, instalacionVecina, pagosIniciales, procesosIniciales, productoFinalQr, acopiadores, agrupar, entregasIniciales, historiaDe, instalaciones, loteProcesado, recalcular, semiproductos, tiposEvidencia, usuariosEmpresa } from './datos/stock';
import type { ApiBulkPayment, ApiPayment, ApiProcessingOrder, ApiPurchaseOrder, ApiStockOrder } from '@/api/gen/types.gen';
import { EMPRESA_DEMO, capasMapa, paises, parcelasDe, productoresIniciales, tiposCertificacion, tiposProducto } from './datos/productores';
import { cadenasActivas, cuentasInstancia, fichaEmpresaDemo, instalacionesEmpresa, monedas, tiposInstalacion } from './datos/empresa';
import { conocimientoIniciales, contenidoDe, empresasInstancia, estadisticasDemo, etiquetasIniciales, finalesIniciales, lotesIniciales, mediosEmpresa, opinionesIniciales, productosIniciales, unidadesMedida, type EtiquetaSimulada } from './datos/productos';

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
// Entregas: igual que los productores, en sessionStorage.
const CLAVE_ENTREGAS = 'simulado.entregas';
const leerEntregas = (): ApiStockOrder[] => JSON.parse(sessionStorage.getItem(CLAVE_ENTREGAS) ?? 'null') ?? entregasIniciales;
const guardarEntregas = (l: ApiStockOrder[]) => sessionStorage.setItem(CLAVE_ENTREGAS, JSON.stringify(l));
// Pagos: en sessionStorage; al pagar o borrar se recalcula el saldo de la entrega, como el backend.
const CLAVE_PAGOS = 'simulado.pagos';
const CLAVE_MASIVOS = 'simulado.masivos';
const leerPagos = (): ApiPayment[] => JSON.parse(sessionStorage.getItem(CLAVE_PAGOS) ?? 'null') ?? pagosIniciales;
const guardarPagos = (l: ApiPayment[]) => sessionStorage.setItem(CLAVE_PAGOS, JSON.stringify(l));
const leerMasivos = (): ApiBulkPayment[] => JSON.parse(sessionStorage.getItem(CLAVE_MASIVOS) ?? '[]');
const guardarMasivos = (l: ApiBulkPayment[]) => sessionStorage.setItem(CLAVE_MASIVOS, JSON.stringify(l));

/** Lo pagado de una entrega = suma de sus pagos; el saldo = costo − pagado. */
function recalcularSaldo(idEntrega: number) {
  const pagado = leerPagos().filter((p) => p.stockOrder?.id === idEntrega).reduce((s, p) => s + (p.amount ?? 0), 0);
  guardarEntregas(leerEntregas().map((o) => (o.id === idEntrega && typeof o.cost === 'number' ? { ...o, paid: pagado, balance: o.cost - pagado } : o)));
}

function crearPago(p: ApiPayment, enMasivo = false): ApiPayment | string {
  const entrega = leerEntregas().find((o) => o.id === p.stockOrder?.id) ?? pedidos().find((o) => o.id === p.stockOrder?.id);
  if (!entrega) return 'Not a Purchase or Quote order';
  if (p.recipientType === 'COMPANY' && !p.recipientCompany) return 'Recipient company is required when type is COMPANY';
  if (!enMasivo && p.paymentPurposeType === 'FIRST_INSTALLMENT' && !p.receiptDocument) return 'Receipt document has to be provided';
  if ((p.amount ?? 0) < 0) return 'Total amount paid cannot be negative';
  const nuevo: ApiPayment = {
    ...p,
    id: siguienteId++,
    stockOrder: { id: entrega.id, identifier: entrega.identifier, internalLotNumber: entrega.internalLotNumber, orderType: entrega.orderType },
    recipientUserCustomer: entrega.producerUserCustomer,
    recipientCompany: p.recipientType === 'COMPANY' ? entrega.quoteCompany : undefined,
    representativeOfRecipientUserCustomer: entrega.representativeOfProducerUserCustomer,
    preferredWayOfPayment: entrega.preferredWayOfPayment,
    productionDate: entrega.productionDate,
  };
  guardarPagos([...leerPagos(), nuevo]);
  recalcularSaldo(entrega.id!);
  return nuevo;
}

// Procesamientos hechos en el modo simulado: las órdenes y los lotes que producen.
const CLAVE_PRODUCTOS = 'simulado.productos';
const leerProductos = (): ApiProduct[] => JSON.parse(sessionStorage.getItem(CLAVE_PRODUCTOS) ?? 'null') ?? productosIniciales;
const guardarProductos = (l: ApiProduct[]) => sessionStorage.setItem(CLAVE_PRODUCTOS, JSON.stringify(l));
const CLAVE_ROL = 'simulado.rol';
const CLAVE_INSTALACIONES = 'simulado.instalaciones';
const leerInstalaciones = (): ApiFacility[] => JSON.parse(sessionStorage.getItem(CLAVE_INSTALACIONES) ?? 'null') ?? instalacionesEmpresa;
const guardarInstalaciones = (l: ApiFacility[]) => sessionStorage.setItem(CLAVE_INSTALACIONES, JSON.stringify(l));
const activas = () => leerInstalaciones().filter((f) => !f.deactivated);
const CLAVE_EMPRESA = 'simulado.empresa';
const leerEmpresa = (): ApiCompanyGet => JSON.parse(sessionStorage.getItem(CLAVE_EMPRESA) ?? 'null') ?? fichaEmpresaDemo;
const CLAVE_USUARIOS = 'simulado.usuarios-empresa';
const leerUsuarios = (): ApiCompanyUser[] => JSON.parse(sessionStorage.getItem(CLAVE_USUARIOS) ?? 'null') ?? usuariosEmpresa;
const guardarUsuarios = (l: ApiCompanyUser[]) => sessionStorage.setItem(CLAVE_USUARIOS, JSON.stringify(l));
const esAdministracion = () => ['SYSTEM_ADMIN', 'REGIONAL_ADMIN'].includes(sessionStorage.getItem(CLAVE_ROL) ?? '');
const CLAVE_ETIQUETAS = 'simulado.etiquetas';
const leerEtiquetas = (): EtiquetaSimulada[] => JSON.parse(sessionStorage.getItem(CLAVE_ETIQUETAS) ?? 'null') ?? etiquetasIniciales;
const guardarEtiquetas = (l: EtiquetaSimulada[]) => sessionStorage.setItem(CLAVE_ETIQUETAS, JSON.stringify(l));
const baseEtiqueta = ({ etiqueta: e }: EtiquetaSimulada) => ({ id: e.id, productId: e.productId, uuid: e.uuid, title: e.title, language: e.language, status: e.status });
const etiquetasDe = (producto?: number) => leerEtiquetas().filter((x) => x.etiqueta.productId === producto).map(baseEtiqueta);
const CLAVE_LOTES = 'simulado.lotes';
const leerLotes = (): ApiProductLabelBatch[] => JSON.parse(sessionStorage.getItem(CLAVE_LOTES) ?? 'null') ?? lotesIniciales;
const guardarLotes = (l: ApiProductLabelBatch[]) => sessionStorage.setItem(CLAVE_LOTES, JSON.stringify(l));
const CLAVE_CONOCIMIENTO = 'simulado.conocimiento';
type EntradaSimulada = ApiKnowledgeBlog & { productId: number };
const leerConocimiento = (): EntradaSimulada[] => JSON.parse(sessionStorage.getItem(CLAVE_CONOCIMIENTO) ?? 'null') ?? conocimientoIniciales;
const guardarConocimiento = (l: EntradaSimulada[]) => sessionStorage.setItem(CLAVE_CONOCIMIENTO, JSON.stringify(l));
const CLAVE_OPINIONES = 'simulado.opiniones';
const leerOpiniones = (): ApiProductLabelFeedback[] => JSON.parse(sessionStorage.getItem(CLAVE_OPINIONES) ?? 'null') ?? opinionesIniciales;
/** Página de una lista según limit/offset, como el backend. */
const pagina = <T,>(items: T[], u: URL) => {
  const limit = Number(u.searchParams.get('limit')) || 100, offset = Number(u.searchParams.get('offset')) || 0;
  return ok({ items: items.slice(offset, offset + limit), count: items.length, offset, limit });
};
const CLAVE_FINALES = 'simulado.finales';
const leerFinales = (): ApiFinalProduct[] => JSON.parse(sessionStorage.getItem(CLAVE_FINALES) ?? 'null') ?? finalesIniciales;
const guardarFinales = (l: ApiFinalProduct[]) => sessionStorage.setItem(CLAVE_FINALES, JSON.stringify(l));

const CLAVE_PROCESOS = 'simulado.procesos';
const leerProcesos = (): ApiProcessingOrder[] => JSON.parse(sessionStorage.getItem(CLAVE_PROCESOS) ?? 'null') ?? procesosIniciales;
const guardarProcesos = (l: ApiProcessingOrder[]) => sessionStorage.setItem(CLAVE_PROCESOS, JSON.stringify(l));
const lotesProcesados = () => leerProcesos().flatMap((p) => p.targetStockOrders ?? []).filter((o) => o.orderType !== 'GENERAL_ORDER');
const pedidos = () => leerProcesos().flatMap((p) => p.targetStockOrders ?? []).filter((o) => o.orderType === 'GENERAL_ORDER');
/** Todo el stock: entregas, el lote de ejemplo y lo procesado acá. */
const todoElStock = () => [...leerEntregas(), loteProcesado, ...lotesProcesados()];
const semiDe = (id?: number) => semiproductos.find((x) => x.id === id);

/** Cambia lo disponible de un lote de entrada (entrega guardada o lote procesado). */
function ajustarDisponible(id: number, delta: number) {
  guardarEntregas(leerEntregas().map((o) => (o.id === id ? { ...o, availableQuantity: (o.availableQuantity ?? 0) + delta } : o)));
  guardarProcesos(leerProcesos().map((p) => ({ ...p, targetStockOrders: (p.targetStockOrders ?? []).map((o) => (o.id === id ? { ...o, availableQuantity: (o.availableQuantity ?? 0) + delta } : o)) })));
}

const nombreDe = (o: ApiStockOrder) => `${o.producerUserCustomer?.name ?? ''} ${o.producerUserCustomer?.surname ?? ''}`.toLowerCase();

function listaEntregas(request: Request, filtro: (o: ApiStockOrder) => boolean, pozo = leerEntregas()) {
  const u = new URL(request.url);
  const q = (u.searchParams.get('query') ?? '').toLowerCase();
  const mujeres = u.searchParams.get('isWomenShare');
  const semi = Number(u.searchParams.get('semiProductId')) || null;
  const saldo = u.searchParams.get('isOpenBalanceOnly') === 'true';
  const soloCompras = u.searchParams.get('isPurchaseOrderOnly') === 'true';
  const soloDisponible = u.searchParams.get('availableOnly') === 'true';
  const signo = u.searchParams.get('sort') === 'ASC' ? 1 : -1;
  const campo = u.searchParams.get('sortBy') === 'updateTimestamp' ? 'updateTimestamp' : u.searchParams.get('sortBy') === 'deliveryTime' ? 'deliveryTime' : 'productionDate';
  const todos = pozo
    .filter(filtro)
    .filter((o) => !q || nombreDe(o).includes(q))
    .filter((o) => mujeres === null || String(!!o.womenShare) === mujeres)
    .filter((o) => !semi || o.semiProduct?.id === semi)
    .filter((o) => !saldo || (o.balance ?? 0) > 0)
    .filter((o) => !soloCompras || o.orderType === 'PURCHASE_ORDER')
    .filter((o) => !soloDisponible || (o.availableQuantity ?? 0) > 0)
    .sort((a, b) => String((a as Record<string, unknown>)[campo] ?? '').localeCompare(String((b as Record<string, unknown>)[campo] ?? '')) * signo || ((a.id ?? 0) - (b.id ?? 0)) * signo);
  const desde = Number(u.searchParams.get('offset') ?? 0), cuantos = Number(u.searchParams.get('limit') ?? 20);
  return ok({ items: todos.slice(desde, desde + cuantos), count: todos.length, offset: desde, limit: cuantos });
}

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
  http.get('/api/common/document/:clave', ({ params }) => (conSesion() ? imagen(String(params.clave)) : sinSesion())),
  http.get('/api/common/image/:clave/:tamano?', ({ params }) => (conSesion() ? imagen(String(params.clave)) : sinSesion())),

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
  // El rol se puede cambiar en las pruebas (sessionStorage "simulado.rol") para ver lo de la administración.
  http.get('/api/user/profile', () => (conSesion() ? ok({ ...usuario, role: (sessionStorage.getItem(CLAVE_ROL) as ApiUserGet['role']) ?? usuario.role }) : error(401, 'UNAUTHORIZED', 'Unauthorized'))),
  // ---------- Empresa y catálogos ----------
  http.get('/api/company/profile/:id/name', () => (conSesion() ? ok(EMPRESA_DEMO) : sinSesion())),
  http.get('/api/company/profile/:id', () => (conSesion() ? ok({ ...leerEmpresa(), users: leerUsuarios() }) : sinSesion())),
  http.get('/api/company/profile/:id/users', () => (conSesion() ? ok(leerUsuarios()) : sinSesion())),
  // Como el backend: reemplaza los campos de la ficha; las cadenas solo si llegan; los usuarios van aparte.
  http.put('/api/company/profile', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const { users: _, language: __, ...e } = (await request.json()) as ApiCompanyUpdate;
    const antes = leerEmpresa();
    const valueChains = e.valueChains ? e.valueChains.map((c) => cadenasActivas.find((x) => x.id === c.id) ?? c) : antes.valueChains;
    const currency = monedas.find((m) => m.id === e.currency?.id);
    sessionStorage.setItem(CLAVE_EMPRESA, JSON.stringify({ ...e, id: antes.id, valueChains, currency, documents: (e.documents ?? []).map((d) => ({ ...d, id: d.id ?? siguienteId++ })) }));
    return ok();
  }),
  http.post('/api/company/execute/:accion', async ({ request, params }) => {
    if (!conSesion()) return sinSesion();
    if (!esAdministracion()) return error(401, 'UNAUTHORIZED', "User doesn't have required permission!");
    const a = (await request.json()) as ApiCompanyActionRequest;
    const lista = leerUsuarios();
    if (params.accion === 'ADD_USER_TO_COMPANY') {
      if (lista.some((u) => u.id === a.userId)) return error(400, 'INVALID_REQUEST', 'User already exists');
      const c = cuentasInstancia.find((u) => u.id === a.userId)!;
      guardarUsuarios([...lista, { ...c, companyRole: a.companyUserRole }]);
    } else if (params.accion === 'SET_USER_COMPANY_ROLE') {
      guardarUsuarios(lista.map((u) => (u.id === a.userId ? { ...u, companyRole: a.companyUserRole } : u)));
    } else if (params.accion === 'REMOVE_USER_FROM_COMPANY') {
      guardarUsuarios(lista.filter((u) => u.id !== a.userId));
    }
    return ok();
  }),
  http.get('/api/chain/currency-type/list/enabled', () => paginado(monedas)),
  http.get('/api/chain/value-chain/list', () => paginado(cadenasActivas)),
  http.get('/api/user/admin/list', ({ request }) => {
    const q = (new URL(request.url).searchParams.get('query') ?? '').toLowerCase();
    return paginado(cuentasInstancia.filter((u) => `${u.name} ${u.surname} ${u.email}`.toLowerCase().includes(q)));
  }),
  http.get('/api/company/:id/product-types', () => paginado(tiposProducto)),
  http.get('/api/company/associations/:id', () => paginado([{ id: 7, name: 'Asociación de Caficultores del Norte' }])),
  http.get('/api/common/countries', () => paginado(paises)),
  http.get('/api/chain/certification-type/active', () => ok(tiposCertificacion)),
  http.get('/api/chain/map-layer/active', () => ok(capasMapa)),

  // ---------- Productores ----------
  http.get('/api/company/userCustomers/:companyId/plots', () => (conSesion() ? ok(parcelasDe(leerProductores())) : sinSesion())),
  http.get('/api/company/userCustomers/:companyId/:type', ({ request, params }) => {
    if (!conSesion()) return sinSesion();
    const u = new URL(request.url);
    if (params.type === 'COLLECTOR') return paginado(acopiadores.filter((a) => `${a.name} ${a.surname}`.toLowerCase().includes((u.searchParams.get('query') ?? '').toLowerCase())));
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

  // ---------- Stock: entregas ----------
  http.get('/api/chain/facility/list/collecting/company/:id', () => (conSesion() ? paginado(activas().filter((f) => f.isCollectionFacility)) : sinSesion())),
  http.get('/api/chain/facility/list/company/:id/all', () => (conSesion() ? paginado(leerInstalaciones()) : sinSesion())),
  http.get('/api/chain/facility/list/company/:id', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const semi = Number(new URL(request.url).searchParams.get('semiProductId')) || null;
    return paginado(activas().filter((f) => !semi || (f.facilitySemiProductList ?? []).some((s) => s.id === semi)));
  }),
  http.get('/api/chain/facility/:id/detail', ({ params }) => {
    const f = leerInstalaciones().find((x) => x.id === Number(params.id));
    return f ? ok(f) : error(404, 'NOT_FOUND', 'Not found');
  }),
  http.get('/api/chain/facility/:id', ({ params }) => {
    const f = leerInstalaciones().find((x) => x.id === Number(params.id));
    return f ? ok(f) : error(404, 'NOT_FOUND', 'Not found');
  }),
  // Como el backend: crea o reemplaza todo; el nombre visible es el de la traducción al idioma pedido.
  http.put('/api/chain/facility', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const f = (await request.json()) as ApiFacility;
    const idioma = request.headers.get('language') ?? 'EN';
    const nombre = f.translations?.find((t) => t.language === idioma)?.name ?? '';
    const tipo = tiposInstalacion.find((x) => x.id === f.facilityType?.id);
    const lista = leerInstalaciones();
    const id = f.id ?? siguienteId++;
    const nueva = { ...f, id, name: nombre, facilityType: tipo };
    guardarInstalaciones(f.id ? lista.map((x) => (x.id === f.id ? nueva : x)) : [...lista, nueva]);
    return ok({ id });
  }),
  http.put('/api/chain/facility/:id/:accion', ({ params }) => {
    if (!conSesion()) return sinSesion();
    if (params.accion !== 'activate' && params.accion !== 'deactivate') return error(404, 'NOT_FOUND', 'Not found');
    guardarInstalaciones(leerInstalaciones().map((x) => (x.id === Number(params.id) ? { ...x, deactivated: params.accion === 'deactivate' } : x)));
    return ok();
  }),
  // El beneficio (11) tiene entregas: como el backend, no se deja borrar.
  http.delete('/api/chain/facility/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    if (Number(params.id) === 11) return error(400, 'VALIDATION_ERROR', 'Cannot delete a facility that has stock orders');
    guardarInstalaciones(leerInstalaciones().filter((x) => x.id !== Number(params.id)));
    return ok();
  }),
  http.get('/api/chain/facility-type/list', () => paginado(tiposInstalacion)),
  http.get('/api/company/:id/value-chains', () => (conSesion() ? paginado(leerEmpresa().valueChains ?? []) : sinSesion())),
  http.get('/api/chain/semi-product/list/by-value-chains', () => (conSesion() ? paginado(semiproductos) : sinSesion())),
  http.get('/api/final-product/company/:companyId', () => (conSesion() ? paginado(leerFinales()) : sinSesion())),
  http.get('/api/chain/semi-product/:id', ({ params }) => {
    const s = semiproductos.find((x) => x.id === Number(params.id));
    return s ? ok(s) : error(404, 'NOT_FOUND', 'Not found');
  }),
  // Todo el stock de una instalación: entregas (en sessionStorage) más los lotes ya procesados.
  http.get('/api/chain/stock-order/list/facility/:facilityId', ({ request, params }) => {
    if (!conSesion()) return sinSesion();
    return listaEntregas(request, (o) => o.facility?.id === Number(params.facilityId), todoElStock());
  }),
  http.get('/api/chain/group-stock-order/list/facility/:facilityId', ({ request, params }) => {
    if (!conSesion()) return sinSesion();
    const u = new URL(request.url);
    const semi = Number(u.searchParams.get('semiProductId')) || null;
    const soloCompras = u.searchParams.get('isPurchaseOrderOnly') === 'true';
    const soloDisponible = u.searchParams.get('availableOnly') === 'true';
    const items = agrupar(
      todoElStock()
        .filter((o) => o.facility?.id === Number(params.facilityId))
        .filter((o) => !semi || o.semiProduct?.id === semi)
        .filter((o) => !soloCompras || o.orderType === 'PURCHASE_ORDER')
        .filter((o) => !soloDisponible || (o.availableQuantity ?? 0) > 0),
    );
    const desde = Number(u.searchParams.get('offset') ?? 0), cuantos = Number(u.searchParams.get('limit') ?? 20);
    return ok({ items: items.slice(desde, desde + cuantos), count: items.length, offset: desde, limit: cuantos });
  }),
  http.get('/api/chain/stock-order/:id/aggregated-history', ({ params }) => {
    if (!conSesion()) return sinSesion();
    const proceso = leerProcesos().find((p) => (p.targetStockOrders ?? []).some((o) => o.id === Number(params.id)));
    if (proceso) {
      const lote = proceso.targetStockOrders!.find((o) => o.id === Number(params.id))!;
      const origen = (proceso.inputTransactions ?? []).map((t) => todoElStock().find((o) => o.id === t.sourceStockOrder?.id)).filter(Boolean) as ApiStockOrder[];
      return ok({ stockOrder: lote, outputTransactions: [], timelineItems: [{ depth: 0, processingOrder: proceso }, { depth: 1, purchaseOrders: origen }] });
    }
    const pedido = leerEntregas().find((o) => o.id === Number(params.id));
    const h = pedido ? { stockOrder: pedido, outputTransactions: [], timelineItems: [{ purchaseOrders: [pedido] }] } : historiaDe(Number(params.id));
    return h ? ok(h) : error(404, 'NOT_FOUND', 'Not found');
  }),
  http.get('/api/chain/stock-order/:id/exportGeoData', ({ params }) => {
    const pedido = [...leerEntregas(), loteProcesado].find((o) => o.id === Number(params.id));
    const tiene = (pedido?.plots ?? []).some((p) => p.geoId);
    const cuerpo = tiene ? JSON.stringify({ type: 'FeatureCollection', features: [] }) : '';
    return new HttpResponse(cuerpo, { headers: { 'Content-Type': 'application/geo+json' } });
  }),
  http.get('/api/chain/stock-order/list/company/:companyId', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const productor = Number(new URL(request.url).searchParams.get('farmerId')) || null;
    return listaEntregas(request, (o) => !productor || o.producerUserCustomer?.id === productor);
  }),
  http.get('/api/chain/stock-order/export/deliveries/company/:companyId', () =>
    new HttpResponse(new Blob(['simulado'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } }),
  ),
  http.get('/api/chain/stock-order/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    const o = [...todoElStock(), ...pedidos()].find((x) => x.id === Number(params.id));
    return o ? ok(o) : error(404, 'NOT_FOUND', 'Not found');
  }),
  http.put('/api/chain/stock-order', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const o = (await request.json()) as ApiStockOrder;
    if (!o.producerUserCustomer?.id) return error(400, 'INVALID_REQUEST', 'Producer user customer is required for purchase orders!');
    const lista = leerEntregas();
    const anterior = lista.find((x) => x.id === o.id);
    const guardada = recalcular({ ...o, id: o.id ?? siguienteId++, paid: anterior?.paid, availableQuantity: undefined });
    guardarEntregas(anterior ? lista.map((x) => (x.id === guardada.id ? guardada : x)) : [...lista, guardada]);
    return ok({ id: guardada.id });
  }),
  http.post('/api/chain/stock-order/bulk-purchase', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const p = (await request.json()) as ApiPurchaseOrder;
    const nuevas = (p.farmers ?? []).map((f) =>
      recalcular({ ...f, id: siguienteId++, orderType: 'PURCHASE_ORDER', facility: p.facility, productionDate: p.productionDate, creatorId: p.creatorId, currency: p.currency, preferredWayOfPayment: p.preferredWayOfPayment, representativeOfProducerUserCustomer: p.representativeOfProducerUserCustomer, availableQuantity: undefined }),
    );
    guardarEntregas([...leerEntregas(), ...nuevas]);
    return ok({ ...p, farmers: (p.farmers ?? []).map((f, i) => ({ ...f, id: nuevas[i]!.id })) });
  }),
  http.delete('/api/chain/stock-order/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    guardarEntregas(leerEntregas().filter((x) => x.id !== Number(params.id)));
    return ok();
  }),

  // ---------- Stock: procesamiento ----------
  http.get('/api/chain/processing-action/list/company/:id', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const u = new URL(request.url);
    const tipo = u.searchParams.get('actionType');
    const soloFinales = u.searchParams.get('onlyFinalProducts') === 'true';
    return paginado(accionesProcesamiento.filter((a) => (!tipo || a.type === tipo) && (!soloFinales || (a.inputFinalProduct && a.outputFinalProduct))));
  }),
  http.get('/api/chain/processing-action/:id', ({ params }) => {
    const a = accionesProcesamiento.find((x) => x.id === Number(params.id));
    return a ? ok(a) : error(404, 'NOT_FOUND', 'Not found');
  }),
  // ---------- Productos ----------
  http.get('/api/product/list', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const q = (new URL(request.url).searchParams.get('name') ?? '').toLowerCase();
    return paginado(leerProductos().filter((p) => p.name.toLowerCase().includes(q)).map((p) => ({ id: p.id, name: p.name, photoStorageId: p.photo?.storageKey })));
  }),
  http.get('/api/product/admin/list', () => (conSesion() ? paginado(leerProductos().map((p) => ({ id: p.id, name: p.name, photoStorageId: p.photo?.storageKey }))) : sinSesion())),
  http.get('/api/product/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    const p = leerProductos().find((x) => x.id === Number(params.id));
    return p ? ok({ ...p, labels: etiquetasDe(p.id) }) : error(400, 'INVALID_REQUEST', 'Invalid product id');
  }),
  http.post('/api/product/create', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const p = (await request.json()) as ApiProduct;
    if (!p.company?.id) return error(400, 'INVALID_REQUEST', 'Company ID is required');
    const nuevo: ApiProduct = { ...p, id: siguienteId++, company: EMPRESA_DEMO, valueChain: { id: p.valueChain?.id, name: 'Café' }, associatedCompanies: [{ company: EMPRESA_DEMO, type: 'OWNER' }], labels: [] };
    guardarProductos([...leerProductos(), nuevo]);
    return ok({ id: nuevo.id });
  }),
  http.put('/api/product/', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const p = (await request.json()) as ApiProduct;
    const actual = leerProductos().find((x) => x.id === p.id);
    if (!actual) return error(400, 'INVALID_REQUEST', 'Invalid product id');
    // Como la versión actual: edita la empresa dueña (o la administración).
    if (!esAdministracion() && !(actual.associatedCompanies ?? []).some((a) => a.type === 'OWNER' && a.company?.id === EMPRESA_DEMO.id)) return error(403, 'UNAUTHORIZED', 'Invalid product id or forbidden');
    // Las empresas asociadas solo las cambia la administración; el backend ignora el resto.
    const asociadas = esAdministracion() && p.associatedCompanies
      ? p.associatedCompanies.map((a) => ({ type: a.type, company: empresasInstancia.find((c) => c.id === a.company?.id) ?? { id: a.company?.id } }))
      : actual.associatedCompanies;
    const acuerdos = (p.dataSharingAgreements ?? []).map((d) => ({ ...d, id: d.id ?? siguienteId++ }));
    guardarProductos(leerProductos().map((x) => (x.id === p.id ? { ...p, associatedCompanies: asociadas, dataSharingAgreements: acuerdos } : x)));
    return ok();
  }),
  http.delete('/api/product/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    guardarProductos(leerProductos().filter((x) => x.id !== Number(params.id)));
    // Como el backend con H25: las entradas de la base de conocimiento se borran con el producto.
    guardarConocimiento(leerConocimiento().filter((x) => x.productId !== Number(params.id)));
    return ok();
  }),
  // ---------- Etiquetas ----------
  http.get('/api/product/:id/labels', ({ params }) => (conSesion() ? ok(etiquetasDe(Number(params.id))) : sinSesion())),
  http.post('/api/product/label/create', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const e = (await request.json()) as ApiProductLabel;
    if (!e.language) return error(400, 'VALIDATION_ERROR', 'Label language is required');
    const producto = leerProductos().find((x) => x.id === e.productId);
    if (!producto) return error(400, 'INVALID_REQUEST', 'Invalid product id');
    const id = siguienteId++;
    guardarEtiquetas([...leerEtiquetas(), { etiqueta: { ...e, id, uuid: `etiqueta-${id}`, status: 'UNPUBLISHED' }, contenido: contenidoDe(producto), medios: [] }]);
    return ok({ id });
  }),
  http.get('/api/product/label/content/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    const x = leerEtiquetas().find((y) => y.etiqueta.id === Number(params.id));
    return x ? ok({ ...x.contenido, labelId: x.etiqueta.id }) : error(400, 'INVALID_REQUEST', 'Invalid label id');
  }),
  http.get('/api/product/label/:id/documents', ({ params }) => {
    if (!conSesion()) return sinSesion();
    const x = leerEtiquetas().find((y) => y.etiqueta.id === Number(params.id));
    return x ? ok(mediosEmpresa.map((m) => ({ ...m, active: x.medios.includes(m.id!) }))) : error(400, 'INVALID_REQUEST', 'Invalid label id');
  }),
  http.get('/api/product/label/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    const x = leerEtiquetas().find((y) => y.etiqueta.id === Number(params.id));
    return x ? ok(x.etiqueta) : error(400, 'INVALID_REQUEST', 'Invalid label id');
  }),
  http.put('/api/product/label', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const e = (await request.json()) as ApiProductLabel;
    guardarEtiquetas(leerEtiquetas().map((x) => (x.etiqueta.id === e.id ? { ...x, etiqueta: { ...x.etiqueta, title: e.title, fields: e.fields } } : x)));
    return ok();
  }),
  http.put('/api/product/label/content', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const c = (await request.json()) as ApiProductLabelContent;
    guardarEtiquetas(leerEtiquetas().map((x) => (x.etiqueta.id === c.labelId ? { ...x, contenido: { ...c, company: x.contenido.company } } : x)));
    return ok();
  }),
  http.put('/api/product/label/:id/documents', async ({ request, params }) => {
    if (!conSesion()) return sinSesion();
    const docs = (await request.json()) as ApiProductLabelCompanyDocument[];
    guardarEtiquetas(leerEtiquetas().map((x) => (x.etiqueta.id === Number(params.id) ? { ...x, medios: docs.filter((d) => d.active).map((d) => d.id!) } : x)));
    return ok();
  }),
  http.post('/api/product/label/execute/:accion', async ({ request, params }) => {
    if (!conSesion()) return sinSesion();
    const { id } = (await request.json()) as { id: number };
    const status = params.accion === 'PUBLISH_LABEL' ? 'PUBLISHED' : 'UNPUBLISHED';
    guardarEtiquetas(leerEtiquetas().map((x) => (x.etiqueta.id === id ? { ...x, etiqueta: { ...x.etiqueta, status } } : x)));
    return ok();
  }),
  http.delete('/api/product/label/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    guardarEtiquetas(leerEtiquetas().filter((x) => x.etiqueta.id !== Number(params.id)));
    return ok();
  }),
  // ---------- Base de conocimiento ----------
  http.get('/api/product/knowledgeBlog/list/:productId', ({ request, params }) => {
    if (!conSesion()) return sinSesion();
    const u = new URL(request.url);
    const tipo = u.searchParams.get('type');
    const base = ({ id, type, title, date, youtubeUrl }: EntradaSimulada) => ({ id, type, title, date, youtubeUrl });
    return pagina(leerConocimiento().filter((e) => e.productId === Number(params.productId) && (!tipo || e.type === tipo)).sort((a, b) => b.id! - a.id!).map(base), u);
  }),
  http.get('/api/product/knowledgeBlog/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    const e = leerConocimiento().find((x) => x.id === Number(params.id));
    if (!e) return error(400, 'INVALID_REQUEST', 'Invalid id');
    const { productId: _, ...entrada } = e;
    return ok(entrada);
  }),
  http.post('/api/product/knowledgeBlog/:productId', async ({ request, params }) => {
    if (!conSesion()) return sinSesion();
    const e = (await request.json()) as ApiKnowledgeBlog;
    guardarConocimiento([...leerConocimiento(), { ...e, documents: e.documents ?? [], id: siguienteId++, productId: Number(params.productId) }]);
    return ok();
  }),
  // Como el backend: el tema no cambia y los documentos se reemplazan solo si llegan.
  http.put('/api/product/knowledgeBlog', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const e = (await request.json()) as ApiKnowledgeBlog;
    guardarConocimiento(leerConocimiento().map((x) => (x.id === e.id ? { ...x, title: e.title, summary: e.summary, content: e.content, date: e.date, youtubeUrl: e.youtubeUrl, documents: e.documents ?? x.documents } : x)));
    return ok();
  }),
  http.delete('/api/product/knowledgeBlog/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    guardarConocimiento(leerConocimiento().filter((x) => x.id !== Number(params.id)));
    return ok();
  }),
  // ---------- Lotes, opiniones y estadísticas de una etiqueta ----------
  http.get('/api/product/label/:id/batches', ({ request, params }) => {
    if (!conSesion()) return sinSesion();
    const u = new URL(request.url);
    const numero = (u.searchParams.get('number') ?? '').toLowerCase();
    return pagina(leerLotes().filter((l) => l.labelId === Number(params.id) && (l.number ?? '').toLowerCase().startsWith(numero)).sort((a, b) => b.id! - a.id!), u);
  }),
  http.post('/api/product/label_batch/create', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const l = (await request.json()) as ApiProductLabelBatch;
    const id = siguienteId++;
    guardarLotes([...leerLotes(), { ...l, id }]);
    return ok({ id });
  }),
  http.put('/api/product/label_batch', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const l = (await request.json()) as ApiProductLabelBatch;
    guardarLotes(leerLotes().map((x) => (x.id === l.id ? { ...x, ...l, labelId: x.labelId } : x)));
    return ok();
  }),
  http.delete('/api/product/label_batch/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    guardarLotes(leerLotes().filter((x) => x.id !== Number(params.id)));
    return ok();
  }),
  http.get('/api/product/label/:id/feedback/list', ({ request, params }) => {
    if (!conSesion()) return sinSesion();
    const u = new URL(request.url);
    const tipo = u.searchParams.get('type');
    return pagina(leerOpiniones().filter((o) => o.labelId === Number(params.id) && (!tipo || o.type === tipo)).sort((a, b) => b.id! - a.id!), u);
  }),
  http.delete('/api/product/label/feedback/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    sessionStorage.setItem(CLAVE_OPINIONES, JSON.stringify(leerOpiniones().filter((o) => o.id !== Number(params.id))));
    return ok();
  }),
  http.get('/api/product/label/analytics/:uid', ({ params }) => (conSesion() ? ok(params.uid === 'etiqueta-tienda' ? estadisticasDemo : { visits: 0 }) : sinSesion())),
  http.get('/api/company/list', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const q = (new URL(request.url).searchParams.get('name') ?? '').toLowerCase();
    return paginado(empresasInstancia.filter((c) => c.name.toLowerCase().includes(q)));
  }),
  http.get('/api/company/admin/list', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const q = (new URL(request.url).searchParams.get('name') ?? '').toLowerCase();
    return paginado(empresasInstancia.filter((c) => c.name.toLowerCase().includes(q)));
  }),
  http.get('/api/chain/measure-unit-type/list', () => paginado(unidadesMedida)),
  http.get('/api/product/:producto/finalProduct/list', ({ params }) => (conSesion() ? paginado(leerFinales().filter((f) => f.product?.id === Number(params.producto))) : sinSesion())),
  http.put('/api/product/:producto/finalProduct', async ({ request, params }) => {
    if (!conSesion()) return sinSesion();
    const f = (await request.json()) as ApiFinalProduct;
    if (!f.name || !f.description || !f.measurementUnitType?.id) return error(400, 'INVALID_REQUEST', 'Final product name needs to be provided.');
    const producto = leerProductos().find((x) => x.id === Number(params.producto));
    const completo: ApiFinalProduct = {
      ...f,
      id: f.id ?? siguienteId++,
      product: { id: producto?.id, name: producto?.name ?? '' },
      measurementUnitType: unidadesMedida.find((u) => u.id === f.measurementUnitType?.id),
      labels: (f.labels ?? []).map((l) => (producto?.labels ?? []).find((x) => x.id === l.id) ?? l),
    };
    guardarFinales(f.id ? leerFinales().map((x) => (x.id === f.id ? completo : x)) : [...leerFinales(), completo]);
    return ok({ id: completo.id });
  }),
  http.delete('/api/product/:producto/finalProduct/:final', ({ params }) => {
    if (!conSesion()) return sinSesion();
    guardarFinales(leerFinales().filter((x) => x.id !== Number(params.final)));
    return ok();
  }),
  http.post('/api/common/image', () => ok({ id: siguienteId++, storageKey: 'imagen-' + siguienteId, name: 'foto.jpg', contentType: 'image/jpeg', size: 2048 })),
    http.get('/api/product/:producto/finalProduct/:final/labels', ({ params }) =>
    Number(params.final) === productoFinalQr.id ? ok([{ id: 1, productId: 1, uuid: ETIQUETA_DEMO, title: 'Vitrina de ejemplo', language: 'ES', status: 'PUBLISHED' }]) : ok([]),
  ),
  http.get('/api/chain/processing-evidence-type/list/by-value-chains', () => paginado(tiposEvidencia)),
  http.get('/api/chain/stock-order/list/facility/:facilityId/available', ({ request, params }) => {
    if (!conSesion()) return sinSesion();
    const u = new URL(request.url);
    const semi = Number(u.searchParams.get('semiProductId')) || null;
    const lote = (u.searchParams.get('internalLotName') ?? '').toLowerCase();
    const items = todoElStock().filter(
      (o) => o.facility?.id === Number(params.facilityId) && (!semi || o.semiProduct?.id === semi) && (o.availableQuantity ?? 0) > 0 &&
        (!lote || `${o.identifier ?? ''} ${o.internalLotNumber ?? ''}`.toLowerCase().includes(lote)),
    );
    return paginado(items);
  }),
  http.get('/api/chain/stock-order/:id/processing-order', ({ params }) => {
    if (!conSesion()) return sinSesion();
    const p = leerProcesos().find((x) => (x.targetStockOrders ?? []).some((o) => o.id === Number(params.id)));
    return p ? ok(p) : error(404, 'NOT_FOUND', 'Not found');
  }),
  http.put('/api/chain/processing-order', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const p = (await request.json()) as ApiProcessingOrder;
    const accion = accionesProcesamiento.find((a) => a.id === p.processingAction?.id);
    const esPedido = accion?.type === 'SHIPMENT';
    // Un pedido nace sin entradas: las pone el proveedor después.
    if (!esPedido && !(p.inputTransactions ?? []).length) return error(400, 'INVALID_REQUEST', 'At least one input Transaction has to be provided!');
    const procesos = leerProcesos();
    const anterior = procesos.find((x) => x.id === p.id);
    // Se devuelve lo que la versión anterior tomaba y se descuenta lo nuevo (lo pendiente de un pedido aún no se toma).
    for (const t of anterior?.inputTransactions ?? []) if (t.status !== 'PENDING' || !esPedido) ajustarDisponible(t.sourceStockOrder!.id!, t.outputQuantity ?? 0);
    const transacciones = (p.inputTransactions ?? []).map((t) => ({ ...t, id: t.id ?? siguienteId++, sourceFacility: instalaciones.find((f) => f.id === todoElStock().find((o) => o.id === t.sourceStockOrder?.id)?.facility?.id) }));
    for (const t of transacciones) if (!esPedido || t.status !== 'PENDING') ajustarDisponible(t.sourceStockOrder!.id!, -(t.outputQuantity ?? 0));
    const guardada: ApiProcessingOrder = {
      ...p,
      id: p.id ?? siguienteId++,
      processingAction: accion,
      inputTransactions: transacciones,
      targetStockOrders: (p.targetStockOrders ?? []).map((o) => {
        const id = o.id ?? siguienteId++;
        const semi = semiDe(o.semiProduct?.id);
        const qr = accion?.type === 'GENERATE_QR_CODE' ? { qrCodeTag: o.qrCodeTag ?? crypto.randomUUID(), qrCodeTagFinalProduct: accion.qrCodeForFinalProduct } : {};
        const enLaOrden = esPedido ? (anterior?.targetStockOrders ?? []).find((x) => x.id === id) : undefined;
        const lugar = (x?: { id?: number }) => [...instalaciones, instalacionVecina].find((f) => f.id === x?.id) ?? x;
        const cantidades = esPedido
          ? { fulfilledQuantity: enLaOrden?.fulfilledQuantity ?? 0, availableQuantity: enLaOrden?.availableQuantity ?? 0, quoteFacility: lugar(o.quoteFacility) as ApiStockOrder['quoteFacility'], quoteCompany: (lugar(o.quoteFacility) as ApiStockOrder['quoteFacility'])?.company }
          : { availableQuantity: o.totalQuantity, fulfilledQuantity: o.totalQuantity };
        return { ...o, ...qr, ...cantidades, id, semiProduct: semi ?? o.semiProduct, measureUnitType: semi?.measurementUnitType ?? o.measureUnitType, facility: lugar(o.facility) as ApiStockOrder['facility'], lotPrefix: accion?.prefix };
      }),
    };
    guardarProcesos(anterior ? procesos.map((x) => (x.id === guardada.id ? guardada : x)) : [...procesos, guardada]);
    return ok({ id: guardada.id });
  }),
  http.delete('/api/chain/processing-order/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    const p = leerProcesos().find((x) => x.id === Number(params.id));
    if (!p) return error(404, 'NOT_FOUND', 'Not found');
    for (const t of p.inputTransactions ?? []) if (t.status === 'EXECUTED' || !t.status) ajustarDisponible(t.sourceStockOrder!.id!, t.outputQuantity ?? 0);
    guardarProcesos(leerProcesos().filter((x) => x.id !== p.id));
    return ok();
  }),
  http.post('/api/common/document', async ({ request }) => {
    const archivo = (await request.formData()).get('file');
    const nombre = archivo instanceof File ? archivo.name : 'documento.pdf';
    return ok({ id: siguienteId++, storageKey: 'doc-' + siguienteId, name: nombre, contentType: archivo instanceof File ? archivo.type : 'application/pdf', size: 1024 });
  }),

  // ---------- Stock: órdenes entre empresas ----------
  http.get('/api/chain/stock-order/list/company/:companyId/orders-for-customers', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const u = new URL(request.url);
    const inst = Number(u.searchParams.get('facilityId')) || null;
    const abiertas = u.searchParams.get('openOnly') === 'true';
    return paginado(pedidos().filter((o) => instalaciones.some((f) => f.id === o.facility?.id) && (!inst || o.facility?.id === inst) && (!abiertas || (o.fulfilledQuantity ?? 0) < (o.totalQuantity ?? 0))));
  }),
  http.get('/api/chain/stock-order/list/company/:companyId/quote-orders', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const u = new URL(request.url);
    const inst = Number(u.searchParams.get('facilityId')) || null;
    const abiertas = u.searchParams.get('openOnly') === 'true';
    return paginado(pedidos().filter((o) => instalaciones.some((f) => f.id === o.quoteFacility?.id) && (!inst || o.quoteFacility?.id === inst) && (!abiertas || (o.fulfilledQuantity ?? 0) < (o.totalQuantity ?? 0))));
  }),
  http.get('/api/chain/facility/list/company/:id/available-selling', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const u = new URL(request.url);
    const semi = Number(u.searchParams.get('semiProductId')) || null;
    const final = Number(u.searchParams.get('finalProductId')) || null;
    const vende = (!semi || (instalacionVecina.facilitySemiProductList ?? []).some((x) => x.id === semi)) && (!final || (instalacionVecina.facilityFinalProducts ?? []).some((x) => x.id === final));
    return paginado(vende ? [instalacionVecina] : []);
  }),
  http.get('/api/company/companyCustomers/list/:companyId', () => (conSesion() ? paginado(clientes) : sinSesion())),
  // Pedido de un cliente: cada ítem es un procesamiento de envío sin entradas (como el backend).
  http.post('/api/chain/product-order', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const p = (await request.json()) as import('@/api/gen/types.gen').ApiProductOrder;
    if (!p.orderId?.trim()) return error(400, 'VALIDATION_ERROR', 'Order ID is required');
    if (!p.customer?.id) return error(400, 'VALIDATION_ERROR', 'Customer is required');
    if (!(p.items ?? []).length) return error(400, 'VALIDATION_ERROR', 'At least one Stock order is requried');
    const cliente = clientes.find((c) => c.id === p.customer!.id);
    const nuevos = (p.items ?? []).map((o): ApiProcessingOrder => {
      const accion = accionesProcesamiento.find((a) => a.id === o.processingOrder?.processingAction?.id);
      const quote = [instalacionVecina].find((f) => f.id === o.quoteFacility?.id);
      return {
        id: siguienteId++,
        processingDate: o.productionDate,
        processingAction: accion,
        inputTransactions: [],
        targetStockOrders: [{
          ...o, id: siguienteId++, processingOrder: undefined, consumerCompanyCustomer: cliente, finalProduct: accion?.inputFinalProduct, measureUnitType: accion?.inputFinalProduct?.measurementUnitType,
          facility: instalaciones.find((f) => f.id === o.facility?.id), quoteFacility: quote, quoteCompany: quote?.company,
        }],
      };
    });
    guardarProcesos([...leerProcesos(), ...nuevos]);
    return ok({ id: siguienteId++ });
  }),
  http.get('/api/chain/transaction/list/input/stock-order/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    const p = leerProcesos().find((x) => (x.targetStockOrders ?? []).some((o) => o.id === Number(params.id)));
    return paginado(p?.inputTransactions ?? []);
  }),
  http.put('/api/chain/transaction/:id/:accion', async ({ params, request }) => {
    if (!conSesion()) return sinSesion();
    const id = Number(params.id);
    const aprobar = params.accion === 'approve';
    const cuerpo = aprobar ? null : ((await request.json()) as { rejectComment?: string });
    const tx = leerProcesos().flatMap((p) => p.inputTransactions ?? []).find((t) => t.id === id);
    if (!tx) return error(404, 'NOT_FOUND', 'Not found');
    // Al aprobar, el envío sale del stock del proveedor.
    if (aprobar) ajustarDisponible(tx.sourceStockOrder!.id!, -(tx.outputQuantity ?? 0));
    guardarProcesos(
      leerProcesos().map((p) => {
        if (!(p.inputTransactions ?? []).some((t) => t.id === id)) return p;
        const cantidad = aprobar ? (tx.outputQuantity ?? 0) : 0;
        return {
          ...p,
          inputTransactions: p.inputTransactions!.map((t) => (t.id === id ? { ...t, status: aprobar ? 'EXECUTED' : 'CANCELED', rejectComment: cuerpo?.rejectComment } : t)),
          targetStockOrders: p.targetStockOrders!.map((o) => ({ ...o, fulfilledQuantity: (o.fulfilledQuantity ?? 0) + cantidad, availableQuantity: (o.availableQuantity ?? 0) + cantidad })),
        };
      }),
    );
    return ok();
  }),

  // ---------- Stock: Beyco ----------
  // El código de autorización simulado se cambia por un token; las ofertas enviadas quedan en la sesión.
  http.get('/api/chain/beyco-order/company/:id/token', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const code = new URL(request.url).searchParams.get('authCode');
    return code ? ok({ accessToken: 'token-beyco-simulado', tokenType: 'Bearer', expiresIn: 3600, refreshToken: 'renovar-simulado', scope: ['Offer:Create'] }) : error(400, 'INVALID_REQUEST', 'authCode');
  }),
  http.get('/api/chain/beyco-order/company/:id/token/refresh', () => (conSesion() ? ok({ accessToken: 'token-beyco-renovado', tokenType: 'Bearer', expiresIn: 3600, refreshToken: 'renovar-simulado' }) : sinSesion())),
  http.get('/api/chain/beyco-order/company/:id/fields', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const ids = new URL(request.url).searchParams.getAll('id').map(Number);
    const lotes = todoElStock().filter((o) => ids.includes(o.id!));
    if (!lotes.length) return error(400, 'INVALID_REQUEST', 'Invalid StockOrder ID');
    // Como BeycoOrderService: el puerto sale de la instalación del primer lote; cada lote es un café.
    return ok({
      privacy: 'Public',
      portOfExport: { address: 'Huehuetenango, Huehuetenango', country: 'Guatemala', latitude: 15.3197, longitude: -91.4714 },
      offerCoffees: lotes.map((o) => ({
        coffee: {
          name: o.internalLotNumber,
          harvestAt: (o.productionDate ?? '2026-10-14') + 'T00:00:00Z',
          minScreenSize: 15, maxScreenSize: 16, cuppingScore: 84,
          qualitySegments: [{ type: 'Specialty' }], grades: [{ type: 'ShgShb' }], certificates: [{ type: 'Organic' }],
        },
      })),
    });
  }),
  http.post('/api/chain/beyco-order/company/:id/order', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    if (!request.headers.get('X-Beyco-Token')) return error(400, 'INVALID_REQUEST', 'X-Beyco-Token');
    const oferta = await request.json();
    const enviadas = JSON.parse(sessionStorage.getItem('simulado.beyco') ?? '[]');
    sessionStorage.setItem('simulado.beyco', JSON.stringify([...enviadas, oferta]));
    return ok({ id: 'oferta-simulada-' + (enviadas.length + 1) });
  }),

  // ---------- Stock: pagos ----------
  http.get('/api/chain/payment/list/company/:id', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const u = new URL(request.url);
    const q = (u.searchParams.get('query') ?? '').toLowerCase();
    const forma = u.searchParams.get('preferredWayOfPayment');
    const estado = u.searchParams.get('paymentStatus');
    const productor = Number(u.searchParams.get('farmerId')) || null;
    const signo = u.searchParams.get('sort') === 'ASC' ? 1 : -1;
    const items = leerPagos()
      .filter((p) => !q || `${p.recipientUserCustomer?.name ?? ''} ${p.recipientUserCustomer?.surname ?? ''}`.toLowerCase().includes(q))
      .filter((p) => !forma || p.preferredWayOfPayment === forma)
      .filter((p) => !estado || p.paymentStatus === estado)
      .filter((p) => !productor || p.recipientUserCustomer?.id === productor)
      .sort((a, b) => ((a.id ?? 0) - (b.id ?? 0)) * signo);
    const desde = Number(u.searchParams.get('offset') ?? 0), cuantos = Number(u.searchParams.get('limit') ?? 20);
    return ok({ items: items.slice(desde, desde + cuantos), count: items.length, offset: desde, limit: cuantos });
  }),
  http.get('/api/chain/payment/list/purchase/:id', ({ params }) => (conSesion() ? paginado(leerPagos().filter((p) => p.stockOrder?.id === Number(params.id))) : sinSesion())),
  http.get('/api/chain/payment/list/bulk-payment/company/:id', () => (conSesion() ? paginado([...leerMasivos()].reverse()) : sinSesion())),
  http.get('/api/chain/payment/bulk-payment/:id', ({ params }) => {
    const m = leerMasivos().find((x) => x.id === Number(params.id));
    return m ? ok({ ...m, payments: leerPagos().filter((p) => (m.payments ?? []).some((x) => x.id === p.id)) }) : error(404, 'NOT_FOUND', 'Not found');
  }),
  http.get('/api/chain/payment/export/company/:id', () => new HttpResponse(new Blob(['simulado']), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } })),
  http.get('/api/chain/payment/export/bulk-payment/company/:id', () => new HttpResponse(new Blob(['simulado']), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } })),
  http.get('/api/chain/payment/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    const p = leerPagos().find((x) => x.id === Number(params.id));
    return p ? ok(p) : error(404, 'NOT_FOUND', 'Not found');
  }),
  http.put('/api/chain/payment', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const p = (await request.json()) as ApiPayment;
    if (p.id) {
      // Un pago existente solo pasa a confirmado (como el backend).
      guardarPagos(leerPagos().map((x) => (x.id === p.id && p.paymentStatus === 'CONFIRMED' ? { ...x, paymentStatus: 'CONFIRMED', paymentConfirmedAtTime: new Date().toISOString(), paymentConfirmedByUser: { name: usuario.name, surname: usuario.surname } } : x)));
      return ok({ id: p.id });
    }
    const r = crearPago(p);
    return typeof r === 'string' ? error(400, 'VALIDATION_ERROR', r) : ok({ id: r.id });
  }),
  http.delete('/api/chain/payment/:id', ({ params }) => {
    if (!conSesion()) return sinSesion();
    const p = leerPagos().find((x) => x.id === Number(params.id));
    if (!p) return error(404, 'NOT_FOUND', 'Not found');
    guardarPagos(leerPagos().filter((x) => x.id !== p.id));
    recalcularSaldo(p.stockOrder!.id!);
    return ok();
  }),
  http.post('/api/chain/payment/bulk-payment', async ({ request }) => {
    if (!conSesion()) return sinSesion();
    const m = (await request.json()) as ApiBulkPayment;
    if (!m.paymentDescription) return error(400, 'INVALID_REQUEST', 'Payment description needs to be provided.');
    if (!m.receiptNumber) return error(400, 'INVALID_REQUEST', 'Recipient number is required.');
    if (!m.additionalProofs) return error(500, 'ERROR', 'NullPointerException');
    const creados = (m.payments ?? []).map((p) => crearPago(p, true));
    const mal = creados.find((x) => typeof x === 'string');
    if (mal) return error(400, 'VALIDATION_ERROR', mal as string);
    const guardado = { ...m, id: siguienteId++, createdBy: { name: usuario.name, surname: usuario.surname }, payments: creados as ApiPayment[] };
    guardarMasivos([...leerMasivos(), guardado]);
    return ok({ id: guardado.id });
  }),

  http.put('/api/user/profile', async ({ request }) => {
    if (!conSesion()) return error(401, 'UNAUTHORIZED', 'Unauthorized');
    usuario = { ...usuario, ...((await request.json()) as Partial<ApiUserGet>) };
    return ok(usuario);
  }),
];
