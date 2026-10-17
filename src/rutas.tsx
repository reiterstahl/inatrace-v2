import { QueryClient } from '@tanstack/react-query';
import { Outlet, createRootRouteWithContext, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { consultas } from '@/api/consultas';
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
  validateSearch: (s: Record<string, unknown>) => ({
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

// ---------- Vitrina pública (misma URL que la versión actual, bajo /v2) ----------
export const vitrina = createRoute({
  getParentRoute: () => raiz,
  path: 'p-cd/$etiqueta/$qr',
  loader: async ({ context, params }) => {
    const [etiqueta, qr] = await Promise.all([
      context.queryClient.ensureQueryData(consultas.etiqueta(params.etiqueta)),
      context.queryClient.ensureQueryData(consultas.qr(params.qr)),
    ]);
    return { etiqueta, qr };
  },
  pendingComponent: () => <Cargando className="min-h-dvh" />,
  errorComponent: VitrinaError,
  component: Vitrina,
});
const hija = (path: string, component: () => React.ReactNode) =>
  createRoute({ getParentRoute: () => vitrina, path, component });

const arbol = raiz.addChildren([
  ingreso,
  portal.addChildren([inicio, perfil]),
  vitrina.addChildren([
    hija('/', Portada),
    hija('journey', Recorrido),
    hija('fair-prices', Precios),
    hija('producers', Productores),
    hija('quality', Calidad),
    hija('feedback', Opinion),
    hija('terms-of-use', () => <Legal tipo="terminos" />),
    hija('privacy-policy', () => <Legal tipo="privacidad" />),
  ]),
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
