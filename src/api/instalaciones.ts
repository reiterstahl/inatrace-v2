import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  activateFacility, createOrUpdateFacility, deactivateFacility, deleteFacility, getCompanyValueChains, getFacilityDetail, getFacilityTypeList,
  getFinalProductsForCompany, getSemiProductListByValueChains, listAllFacilitiesByCompany,
} from './gen/sdk.gen';
import type { ApiFacility } from './gen/types.gen';
import { desenvolver } from './respuesta';

export const instalaciones = {
  /** Todas las de la empresa, también las desactivadas (para administrarlas). */
  todas: (empresa: number) =>
    queryOptions({
      queryKey: ['instalaciones', empresa, 'administrar'],
      queryFn: async () => (await desenvolver(listAllFacilitiesByCompany({ path: { id: empresa }, query: { limit: 500, sortBy: 'name', sort: 'ASC' } }))).items ?? [],
    }),

  /** Con traducciones, cadenas, semiproductos y productos finales: se edita sobre ella. */
  detalle: (id: number) =>
    queryOptions({
      queryKey: ['instalacion', id],
      queryFn: () => desenvolver(getFacilityDetail({ path: { id } })),
      staleTime: 0,
    }),

  tipos: () =>
    queryOptions({
      queryKey: ['catalogo', 'tipos-instalacion'],
      queryFn: async () => (await desenvolver(getFacilityTypeList({ query: { limit: 500 } }))).items ?? [],
      staleTime: 30 * 60_000,
    }),

  cadenasEmpresa: (empresa: number) =>
    queryOptions({
      queryKey: ['empresa', empresa, 'cadenas'],
      queryFn: async () => (await desenvolver(getCompanyValueChains({ path: { id: empresa }, query: { limit: 500 } }))).items ?? [],
      staleTime: 10 * 60_000,
    }),

  semiproductos: (cadenas: number[]) =>
    queryOptions({
      queryKey: ['catalogo', 'semiproductos', [...cadenas].sort((a, b) => a - b)],
      queryFn: async () => (await desenvolver(getSemiProductListByValueChains({ query: { valueChainIds: cadenas, limit: 500 } }))).items ?? [],
      enabled: cadenas.length > 0,
      staleTime: 10 * 60_000,
    }),

  finalesEmpresa: (empresa: number) =>
    queryOptions({
      queryKey: ['empresa', empresa, 'finales'],
      queryFn: async () => (await desenvolver(getFinalProductsForCompany({ path: { companyId: empresa }, query: { limit: 500 } }))).items ?? [],
      staleTime: 10 * 60_000,
    }),
};

// Las instalaciones aparecen también en stock, procesamiento y órdenes: se refresca todo.
const refrescar = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ['instalaciones'] });
  void qc.invalidateQueries({ queryKey: ['instalacion'] });
};

export function useGuardarInstalacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: ApiFacility) => (await desenvolver(createOrUpdateFacility({ body: i }))).id,
    onSuccess: () => refrescar(qc),
  });
}

export function useEstadoInstalacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activa }: { id: number; activa: boolean }) => desenvolver(activa ? activateFacility({ path: { id } }) : deactivateFacility({ path: { id } })),
    onSuccess: () => refrescar(qc),
  });
}

/** El backend no borra instalaciones con movimientos (entregas, transacciones, pedidos o acciones). */
export function useBorrarInstalacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => desenvolver(deleteFacility({ path: { id } })),
    onSuccess: () => refrescar(qc),
  });
}
