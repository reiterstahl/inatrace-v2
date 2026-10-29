import { QueryClient } from '@tanstack/react-query';
import { Outlet, createRootRouteWithContext, createRoute, createRouter, lazyRouteComponent, redirect } from '@tanstack/react-router';
import { consultas, registrarVisitaQr, QR_VACIO } from '@/api/consultas';
import { CONFIG } from '@/util/entorno';
import i18n from '@/i18n';
import { ErrorApi } from '@/api/respuesta';
import { Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Ingreso } from '@/paginas/acceso/Ingreso';
import { Marco } from '@/paginas/portal/Marco';
import { Inicio } from '@/paginas/portal/Inicio';
import { Perfil } from '@/paginas/portal/Perfil';

import { Vitrina, VitrinaError } from '@/paginas/vitrina/Vitrina';
import { Portada } from '@/paginas/vitrina/Portada';
import { Recorrido } from '@/paginas/vitrina/Recorrido';
import { Precios } from '@/paginas/vitrina/Precios';
import { Productores } from '@/paginas/vitrina/Productores';
import { Calidad } from '@/paginas/vitrina/Calidad';
import { Opinion } from '@/paginas/vitrina/Opinion';
import { Legal } from '@/paginas/vitrina/Legal';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Un 401 o un 404 no se arreglan reintentando.
      retry: (n, e) => !(e instanceof ErrorApi && (e.sinSesion || e.noEncontrado)) && n < 2,
      refetchOnWindowFocus: false,
    },
  },
});

const raiz = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: () => <EstadoError titulo="404" texto="Esta página no existe." />,
});

// ---------- Acceso ----------
const ingreso = createRoute({
  getParentRoute: () => raiz,
  path: 'ingreso',
  validateSearch: (s: Record<string, unknown>): { volver?: string; vencida?: boolean } => ({
    volver: typeof s.volver === 'string' && s.volver.startsWith('/') ? s.volver : undefined,
    vencida: s.vencida === true || s.vencida === 'true' ? true : undefined,
  }),
  component: Ingreso,
});

// ---------- Portal (requiere sesión) ----------
const portal = createRoute({
  getParentRoute: () => raiz,
  id: 'portal',
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(consultas.perfil());
    } catch {
      throw redirect({ to: '/ingreso', search: { volver: location.href } });
    }
  },
  pendingComponent: Cargando,
  component: Marco,
});
const inicio = createRoute({ getParentRoute: () => portal, path: '/', component: Inicio });
const perfil = createRoute({ getParentRoute: () => portal, path: 'perfil', component: Perfil });

// ---------- Productores (fase 2) ----------
type BusquedaProductores = {
  q?: string;
  por?: 'BY_NAME' | 'BY_SURNAME';
  orden?: 'BY_NAME' | 'BY_SURNAME' | 'BY_ID';
  sentido?: 'ASC' | 'DESC';
  pagina?: number;
  vista?: 'lista' | 'mapa';
};
const uno = <T extends string>(v: unknown, permitidos: readonly T[]) => (permitidos.includes(v as T) ? (v as T) : undefined);
const productoresRaiz = createRoute({ getParentRoute: () => portal, path: 'productores' });
const productoresLista = createRoute({
  getParentRoute: () => productoresRaiz,
  path: '/',
  validateSearch: (s: Record<string, unknown>): BusquedaProductores => ({
    q: typeof s.q === 'string' && s.q ? s.q.slice(0, 100) : undefined,
    por: uno(s.por, ['BY_NAME', 'BY_SURNAME'] as const),
    orden: uno(s.orden, ['BY_NAME', 'BY_SURNAME', 'BY_ID'] as const),
    sentido: uno(s.sentido, ['ASC', 'DESC'] as const),
    pagina: Number(s.pagina) > 1 ? Math.floor(Number(s.pagina)) : undefined,
    vista: uno(s.vista, ['lista', 'mapa'] as const),
  }),
  // Las pantallas del portal se bajan al entrar: la vitrina pública no carga formularios ni mapas de edición.
  component: lazyRouteComponent(() => import('@/paginas/productores/Lista'), 'ListaProductores'),
});
const productorNuevo = createRoute({ getParentRoute: () => productoresRaiz, path: 'nuevo', component: lazyRouteComponent(() => import('@/paginas/productores/Ficha'), 'FichaNueva') });
const productoresImportar = createRoute({ getParentRoute: () => productoresRaiz, path: 'importar', component: lazyRouteComponent(() => import('@/paginas/productores/Importar'), 'ImportarProductores') });
const productorFicha = createRoute({ getParentRoute: () => productoresRaiz, path: '$id', component: lazyRouteComponent(() => import('@/paginas/productores/Ficha'), 'FichaExistente') });

// ---------- Stock (fase 3) ----------
type BusquedaEntregas = {
  inst?: number;
  /** Solo las de un productor (se llega desde su ficha). */
  prod?: number;
  q?: string;
  mujeres?: 'si' | 'no';
  semi?: number;
  saldo?: boolean;
  pagina?: number;
  orden?: 'date' | 'lastChange';
  sentido?: 'ASC' | 'DESC';
};
const idPositivo = (v: unknown) => (Number(v) > 0 && Number.isInteger(Number(v)) ? Number(v) : undefined);
const stockRaiz = createRoute({ getParentRoute: () => portal, path: 'stock', component: lazyRouteComponent(() => import('@/paginas/stock/Marco'), 'MarcoStock') });
const stockInicio = createRoute({ getParentRoute: () => stockRaiz, path: '/', beforeLoad: () => { throw redirect({ to: '/stock/entregas', replace: true }); } });
const entregasRaiz = createRoute({ getParentRoute: () => stockRaiz, path: 'entregas' });
const entregasLista = createRoute({
  getParentRoute: () => entregasRaiz,
  path: '/',
  validateSearch: (s: Record<string, unknown>): BusquedaEntregas => ({
    inst: idPositivo(s.inst),
    prod: idPositivo(s.prod),
    q: typeof s.q === 'string' && s.q ? s.q.slice(0, 100) : undefined,
    mujeres: uno(s.mujeres, ['si', 'no'] as const),
    semi: idPositivo(s.semi),
    saldo: s.saldo === true || s.saldo === 'true' ? true : undefined,
    pagina: Number(s.pagina) > 1 ? Math.floor(Number(s.pagina)) : undefined,
    orden: uno(s.orden, ['date', 'lastChange'] as const),
    sentido: uno(s.sentido, ['ASC', 'DESC'] as const),
  }),
  component: lazyRouteComponent(() => import('@/paginas/stock/entregas/Lista'), 'ListaEntregas'),
});
const conInstalacion = (s: Record<string, unknown>): { inst?: number } => ({ inst: idPositivo(s.inst) });
const entregaNueva = createRoute({ getParentRoute: () => entregasRaiz, path: 'nueva', validateSearch: (s: Record<string, unknown>): { inst?: number; productor?: number } => ({ inst: idPositivo(s.inst), productor: idPositivo(s.productor) }), component: lazyRouteComponent(() => import('@/paginas/stock/entregas/Formulario'), 'EntregaNueva') });
const entregaMasiva = createRoute({ getParentRoute: () => entregasRaiz, path: 'masiva', validateSearch: conInstalacion, component: lazyRouteComponent(() => import('@/paginas/stock/entregas/Masiva'), 'EntregaMasiva') });
const entregaFicha = createRoute({ getParentRoute: () => entregasRaiz, path: '$id', component: lazyRouteComponent(() => import('@/paginas/stock/entregas/Formulario'), 'EntregaExistente') });

// ---------- Stock: todo el stock y trazabilidad (fase 3b) ----------
type BusquedaStock = {
  inst?: number;
  semi?: number;
  compras?: boolean;
  disponible?: boolean;
  vista?: 'suelta' | 'agrupada';
  pagina?: number;
  orden?: 'date' | 'deliveryTime' | 'updateTimestamp';
  sentido?: 'ASC' | 'DESC';
};
const stockTodo = createRoute({
  getParentRoute: () => stockRaiz,
  path: 'todo',
  validateSearch: (s: Record<string, unknown>): BusquedaStock => ({
    inst: idPositivo(s.inst),
    semi: idPositivo(s.semi),
    compras: s.compras === true || s.compras === 'true' ? true : undefined,
    disponible: s.disponible === true || s.disponible === 'true' ? true : undefined,
    vista: uno(s.vista, ['suelta', 'agrupada'] as const),
    pagina: Number(s.pagina) > 1 ? Math.floor(Number(s.pagina)) : undefined,
    orden: uno(s.orden, ['date', 'deliveryTime', 'updateTimestamp'] as const),
    sentido: uno(s.sentido, ['ASC', 'DESC'] as const),
  }),
  component: lazyRouteComponent(() => import('@/paginas/stock/todo/Lista'), 'ListaStock'),
});
// ---------- Stock: procesamiento (fase 3c) ----------
const procesamientoRaiz = createRoute({ getParentRoute: () => stockRaiz, path: 'procesamiento' });
const procesamientoInicio = createRoute({ getParentRoute: () => procesamientoRaiz, path: '/', component: lazyRouteComponent(() => import('@/paginas/stock/procesamiento/Inicio'), 'InicioProcesamiento') });
const procesamientoNuevo = createRoute({
  getParentRoute: () => procesamientoRaiz,
  path: 'nueva',
  // destino: en un pedido a otra empresa, la instalación propia que recibe el café.
  validateSearch: (s: Record<string, unknown>): { accion?: number; inst?: number; destino?: number } => ({ accion: idPositivo(s.accion), inst: idPositivo(s.inst), destino: idPositivo(s.destino) }),
  component: lazyRouteComponent(() => import('@/paginas/stock/procesamiento/Orden'), 'ProcesamientoNuevo'),
});
const procesamientoEditar = createRoute({ getParentRoute: () => procesamientoRaiz, path: '$lote', component: lazyRouteComponent(() => import('@/paginas/stock/procesamiento/Orden'), 'ProcesamientoExistente') });

// ---------- Stock: pagos (fase 3d) ----------
type BusquedaPagos = {
  vista?: 'masivos';
  q?: string;
  forma?: 'CASH' | 'CASH_VIA_COLLECTOR' | 'BANK_TRANSFER' | 'CHEQUE' | 'OFFSETTING' | 'UNKNOWN';
  estado?: 'UNCONFIRMED' | 'CONFIRMED';
  desde?: string;
  hasta?: string;
  prod?: number;
  pagina?: number;
  orden?: 'productionDate' | 'id';
  sentido?: 'ASC' | 'DESC';
};
const fechaIso = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const pagosRaiz = createRoute({ getParentRoute: () => stockRaiz, path: 'pagos' });
const pagosLista = createRoute({
  getParentRoute: () => pagosRaiz,
  path: '/',
  validateSearch: (s: Record<string, unknown>): BusquedaPagos => ({
    vista: uno(s.vista, ['masivos'] as const),
    q: typeof s.q === 'string' && s.q ? s.q.slice(0, 100) : undefined,
    forma: uno(s.forma, ['CASH', 'CASH_VIA_COLLECTOR', 'BANK_TRANSFER', 'CHEQUE', 'OFFSETTING', 'UNKNOWN'] as const),
    estado: uno(s.estado, ['UNCONFIRMED', 'CONFIRMED'] as const),
    desde: fechaIso(s.desde),
    hasta: fechaIso(s.hasta),
    prod: idPositivo(s.prod),
    pagina: Number(s.pagina) > 1 ? Math.floor(Number(s.pagina)) : undefined,
    orden: uno(s.orden, ['productionDate', 'id'] as const),
    sentido: uno(s.sentido, ['ASC', 'DESC'] as const),
  }),
  component: lazyRouteComponent(() => import('@/paginas/stock/pagos/Lista'), 'ListaPagos'),
});
const pagoNuevo = createRoute({
  getParentRoute: () => pagosRaiz,
  path: 'nuevo',
  validateSearch: (s: Record<string, unknown>): { entrega?: number; orden?: number } => ({ entrega: idPositivo(s.entrega), orden: idPositivo(s.orden) }),
  component: lazyRouteComponent(() => import('@/paginas/stock/pagos/Pago'), 'PagoNuevo'),
});
const pagoMasivoNuevo = createRoute({
  getParentRoute: () => pagosRaiz,
  path: 'masivo/nuevo',
  validateSearch: (s: Record<string, unknown>): { entregas?: string } => ({
    entregas: typeof s.entregas === 'string' && /^\d+(,\d+)*$/.test(s.entregas) ? s.entregas : typeof s.entregas === 'number' ? String(s.entregas) : undefined,
  }),
  component: lazyRouteComponent(() => import('@/paginas/stock/pagos/Masivo'), 'PagoMasivoNuevo'),
});
const pagoMasivoVer = createRoute({ getParentRoute: () => pagosRaiz, path: 'masivo/$id', component: lazyRouteComponent(() => import('@/paginas/stock/pagos/Masivo'), 'PagoMasivoVer') });
const pagoVer = createRoute({ getParentRoute: () => pagosRaiz, path: '$id', component: lazyRouteComponent(() => import('@/paginas/stock/pagos/Pago'), 'PagoVer') });

// ---------- Stock: órdenes entre empresas (fase 3e) ----------
type BusquedaOrdenes = { vista?: 'recibidas'; inst?: number; semi?: number; cliente?: number; abiertas?: boolean; pagina?: number };
const ordenesRaiz = createRoute({ getParentRoute: () => stockRaiz, path: 'ordenes' });
const ordenesLista = createRoute({
  getParentRoute: () => ordenesRaiz,
  path: '/',
  validateSearch: (s: Record<string, unknown>): BusquedaOrdenes => ({
    vista: uno(s.vista, ['recibidas'] as const),
    inst: idPositivo(s.inst),
    semi: idPositivo(s.semi),
    cliente: idPositivo(s.cliente),
    abiertas: s.abiertas === true || s.abiertas === 'true' ? true : undefined,
    pagina: Number(s.pagina) > 1 ? Math.floor(Number(s.pagina)) : undefined,
  }),
  component: lazyRouteComponent(() => import('@/paginas/stock/ordenes/Lista'), 'ListaOrdenes'),
});
const ordenNueva = createRoute({ getParentRoute: () => ordenesRaiz, path: 'nueva', component: lazyRouteComponent(() => import('@/paginas/stock/ordenes/Nueva'), 'OrdenNueva') });
const pedidoCliente = createRoute({ getParentRoute: () => ordenesRaiz, path: 'cliente', component: lazyRouteComponent(() => import('@/paginas/stock/ordenes/Cliente'), 'PedidoClienteNuevo') });
const ordenAprobar = createRoute({ getParentRoute: () => ordenesRaiz, path: '$id/aprobar', component: lazyRouteComponent(() => import('@/paginas/stock/ordenes/Aprobar'), 'AprobarOrden') });

const stockTrazabilidad = createRoute({
  getParentRoute: () => stockRaiz,
  path: 'trazabilidad/$id',
  component: lazyRouteComponent(() => import('@/paginas/stock/todo/Trazabilidad'), 'Trazabilidad'),
});

// ---------- Vitrina pública (misma URL que la versión actual, bajo /v2) ----------
export const vitrina = createRoute({
  getParentRoute: () => raiz,
  path: 'p-cd/$etiqueta/$qr',
  loader: async ({ context, params }) => {
    const [etiqueta, qr] = await Promise.all([
      context.queryClient.ensureQueryData(consultas.etiqueta(params.etiqueta)),
      context.queryClient.ensureQueryData(consultas.qr(params.qr, i18n.language)),
    ]);
    return { etiqueta, qr };
  },
  pendingComponent: () => <Cargando className="min-h-dvh" />,
  errorComponent: VitrinaError,
  component: Vitrina,
});
// ---------- Entrada desde un QR impreso ----------
// Los QR apuntan a /q-cd/{etiqueta}/{qr} (o /q/{etiqueta} sin lote). Se registra la visita y se
// pasa a la vitrina, como hace la interfaz actual.
const entradaQr = createRoute({
  getParentRoute: () => raiz,
  path: 'q-cd/$etiqueta/$qr',
  beforeLoad: async ({ params }) => {
    await registrarVisitaQr(params.etiqueta, CONFIG.tokenRegistro);
    throw redirect({ to: '/p-cd/$etiqueta/$qr', params, replace: true });
  },
});
const entradaEtiqueta = createRoute({
  getParentRoute: () => raiz,
  path: 'q/$etiqueta',
  beforeLoad: async ({ params }) => {
    await registrarVisitaQr(params.etiqueta, CONFIG.tokenRegistro);
    throw redirect({ to: '/p-cd/$etiqueta/$qr', params: { etiqueta: params.etiqueta, qr: QR_VACIO }, replace: true });
  },
});

// Una ruta por pestaña (declaradas una a una para que los enlaces queden tipados).
const pestana = <P extends string>(path: P, component: () => React.ReactNode) =>
  createRoute({ getParentRoute: () => vitrina, path, component });
const vPortada = pestana('/', Portada);
const vRecorrido = pestana('journey', Recorrido);
const vPrecios = pestana('fair-prices', Precios);
const vProductores = pestana('producers', Productores);
const vCalidad = pestana('quality', Calidad);
const vOpinion = pestana('feedback', Opinion);
const vTerminos = pestana('terms-of-use', () => <Legal tipo="terminos" />);
const vPrivacidad = pestana('privacy-policy', () => <Legal tipo="privacidad" />);

const arbol = raiz.addChildren([
  ingreso,
  entradaQr,
  entradaEtiqueta,
  portal.addChildren([inicio, perfil, productoresRaiz.addChildren([productoresLista, productorNuevo, productoresImportar, productorFicha]),
    stockRaiz.addChildren([stockInicio, entregasRaiz.addChildren([entregasLista, entregaNueva, entregaMasiva, entregaFicha]), stockTodo, procesamientoRaiz.addChildren([procesamientoInicio, procesamientoNuevo, procesamientoEditar]), pagosRaiz.addChildren([pagosLista, pagoNuevo, pagoMasivoNuevo, pagoMasivoVer, pagoVer]), ordenesRaiz.addChildren([ordenesLista, ordenNueva, pedidoCliente, ordenAprobar]), stockTrazabilidad]),
  ]),
  vitrina.addChildren([vPortada, vRecorrido, vPrecios, vProductores, vCalidad, vOpinion, vTerminos, vPrivacidad]),
]);

export const router = createRouter({
  routeTree: arbol,
  basepath: import.meta.env.BASE_URL,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
