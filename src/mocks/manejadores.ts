import { http, HttpResponse, delay } from 'msw';
import type { ApiUserGet } from '@/api/gen/types.gen';
import { ETIQUETA_DEMO, QR_DEMO, etiqueta, qr } from './datos/vitrina';
import type { ApiUserCustomer } from '@/api/gen/types.gen';
import { accionesProcesamiento, clientes, instalacionVecina, pagosIniciales, procesosIniciales, productoFinalQr, acopiadores, agrupar, entregasIniciales, historiaDe, instalaciones, loteProcesado, recalcular, semiproductos, tiposEvidencia, usuariosEmpresa } from './datos/stock';
import type { ApiBulkPayment, ApiPayment, ApiProcessingOrder, ApiPurchaseOrder, ApiStockOrder } from '@/api/gen/types.gen';
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
  http.get('/api/user/profile', () => (conSesion() ? ok(usuario) : error(401, 'UNAUTHORIZED', 'Unauthorized'))),
  // ---------- Empresa y catálogos ----------
  http.get('/api/company/profile/:id/name', () => (conSesion() ? ok(EMPRESA_DEMO) : sinSesion())),
  http.get('/api/company/profile/:id', () => (conSesion() ? ok({ ...EMPRESA_DEMO, allowBeycoIntegration: true, headquarters: { country: paises[0] }, currency: { code: 'USD', label: 'US dollar' } }) : sinSesion())),
  http.get('/api/company/profile/:id/users', () => (conSesion() ? ok(usuariosEmpresa) : sinSesion())),
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
  http.get('/api/chain/facility/list/collecting/company/:id', () => (conSesion() ? paginado(instalaciones) : sinSesion())),
  http.get('/api/chain/facility/list/company/:id', ({ request }) => {
    if (!conSesion()) return sinSesion();
    const semi = Number(new URL(request.url).searchParams.get('semiProductId')) || null;
    return paginado(instalaciones.filter((f) => !semi || (f.facilitySemiProductList ?? []).some((s) => s.id === semi)));
  }),
  http.get('/api/chain/facility/:id', ({ params }) => {
    const f = instalaciones.find((x) => x.id === Number(params.id));
    return f ? ok(f) : error(404, 'NOT_FOUND', 'Not found');
  }),
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
  http.post('/api/common/document', () => ok({ id: siguienteId++, storageKey: 'doc-' + siguienteId, name: 'documento.pdf', contentType: 'application/pdf', size: 1024 })),

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
