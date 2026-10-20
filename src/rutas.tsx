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
  portal.addChildren([inicio, perfil, productoresRaiz.addChildren([productoresLista, productorNuevo, productoresImportar, productorFicha])]),
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
