import { useEffect, useSyncExternalStore } from 'react';
import { useQueries, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { consultas } from '@/api/consultas';
import { productores } from '@/api/productores';
import { leer, guardar } from './almacen';

/**
 * Empresa con la que se está trabajando. Como en la interfaz actual, casi todo (productores,
 * stock, pagos) es de una empresa: la elegida se recuerda en este navegador.
 */
const CLAVE = 'inatrace.empresa';
const escuchas = new Set<() => void>();
const elegida = () => Number(leer(CLAVE)) || null;
const suscribir = (fn: () => void) => (escuchas.add(fn), () => void escuchas.delete(fn));

export function elegirEmpresa(id: number) {
  guardar(CLAVE, String(id));
  escuchas.forEach((fn) => fn());
}

export type Empresa = { id: number; nombre: string; administra: boolean };

/**
 * Empresas a las que la persona tiene acceso. La administración del sistema puede abrir además
 * cualquier otra (desde Administración → Empresas): la elegida se suma a la lista.
 */
export function useEmpresas(): { empresas: Empresa[]; cargando: boolean } {
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const idElegido = useSyncExternalStore(suscribir, elegida);
  const ids = yo.companyIds ?? [];
  const esAdminSistema = yo.role === 'SYSTEM_ADMIN' || yo.role === 'REGIONAL_ADMIN';
  const nombres = useQueries({ queries: ids.map((id) => productores.empresa(id)) });
  const todas = useQuery({ ...productores.todasLasEmpresas(), enabled: esAdminSistema && ids.length === 0 });

  const base: Empresa[] =
    esAdminSistema && ids.length === 0
      ? (todas.data?.items ?? []).map((c) => ({ id: c.id!, nombre: c.name ?? `#${c.id}`, administra: true }))
      : ids.map((id, i) => ({ id, nombre: nombres[i]?.data?.name ?? `#${id}`, administra: esAdminSistema || (yo.companyIdsAdmin ?? []).includes(id) }));
  const listas = esAdminSistema && ids.length === 0 ? !todas.isPending : !nombres.some((n) => n.isPending);
  const extra = yo.role === 'SYSTEM_ADMIN' && listas && idElegido && !base.some((e) => e.id === idElegido) ? idElegido : null;
  const nombreExtra = useQuery({ ...productores.empresa(extra ?? 0), enabled: !!extra });
  const empresas = extra && !nombreExtra.isError ? [...base, { id: extra, nombre: nombreExtra.data?.name ?? `#${extra}`, administra: true }] : base;
  return { empresas, cargando: !listas || (!!extra && nombreExtra.isPending) };
}

/** Empresa activa: la elegida si sigue siendo accesible; si no, la primera. */
export function useEmpresaActual(): Empresa | null {
  const id = useSyncExternalStore(suscribir, elegida);
  const { empresas, cargando } = useEmpresas();
  const actual = empresas.find((e) => e.id === id) ?? (cargando && id ? null : empresas[0] ?? null);
  useEffect(() => {
    if (actual && actual.id !== id) guardar(CLAVE, String(actual.id));
  }, [actual, id]);
  return actual;
}
