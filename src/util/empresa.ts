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

export function elegirEmpresa(id: number) {
  guardar(CLAVE, String(id));
  escuchas.forEach((fn) => fn());
}

export type Empresa = { id: number; nombre: string; administra: boolean };

/** Empresas a las que la persona tiene acceso. */
export function useEmpresas(): { empresas: Empresa[]; cargando: boolean } {
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const ids = yo.companyIds ?? [];
  const esAdminSistema = yo.role === 'SYSTEM_ADMIN' || yo.role === 'REGIONAL_ADMIN';
  const nombres = useQueries({ queries: ids.map((id) => productores.empresa(id)) });
  const todas = useQuery({ ...productores.todasLasEmpresas(), enabled: esAdminSistema && ids.length === 0 });

  if (esAdminSistema && ids.length === 0) {
    return {
      empresas: (todas.data?.items ?? []).map((c) => ({ id: c.id!, nombre: c.name ?? `#${c.id}`, administra: true })),
      cargando: todas.isPending,
    };
  }
  return {
    empresas: ids.map((id, i) => ({
      id,
      nombre: nombres[i]?.data?.name ?? `#${id}`,
      administra: esAdminSistema || (yo.companyIdsAdmin ?? []).includes(id),
    })),
    cargando: nombres.some((n) => n.isPending),
  };
}

/** Empresa activa: la elegida si sigue siendo accesible; si no, la primera. */
export function useEmpresaActual(): Empresa | null {
  const id = useSyncExternalStore((fn) => (escuchas.add(fn), () => escuchas.delete(fn)), elegida);
  const { empresas } = useEmpresas();
  const actual = empresas.find((e) => e.id === id) ?? empresas[0] ?? null;
  useEffect(() => {
    if (actual && actual.id !== id) guardar(CLAVE, String(actual.id));
  }, [actual, id]);
  return actual;
}
