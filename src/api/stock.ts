import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createOrUpdateStockOrder,
  createPurchaseOrderBulk,
  deleteStockOrder,
  exportDeliveriesByCompany,
  exportGeoData,
  getCompanyUsers,
  getFacility,
  getGroupedStockOrderList,
  getSemiProduct,
  getStockOrder,
  getStockOrderAggregatedHistory,
  getStockOrderListByCompanyId,
  getStockOrderListByFacilityId,
  listCollectingFacilitiesByCompany,
  listFacilitiesByCompany,
} from './gen/sdk.gen';
import type { ApiPurchaseOrder, ApiStockOrder } from './gen/types.gen';
import { desenvolver, descargarBlob } from './respuesta';

export const POR_PAGINA_STOCK = 20;

export type FiltroEntregas = {
  /** Sin instalación: todas las entregas de la empresa (como la versión actual). */
  instalacion?: number;
  texto?: string;
  mujeres?: boolean;
  semiproducto?: number;
  soloSaldo?: boolean;
  pagina: number;
  orden: { campo: 'date' | 'lastChange'; sentido: 'ASC' | 'DESC' };
  /** Solo las de un productor (para su ficha). */
  productor?: number;
};

export type FiltroStock = {
  instalacion?: number;
  semiproducto?: number;
  soloCompras?: boolean;
  soloDisponible?: boolean;
  agrupado: boolean;
  pagina: number;
  orden: { campo: 'date' | 'deliveryTime' | 'updateTimestamp'; sentido: 'ASC' | 'DESC' };
};

export const stock = {
  instalacionesAcopio: (empresa: number) =>
    queryOptions({
      queryKey: ['instalaciones', empresa, 'acopio'],
      queryFn: async () => (await desenvolver(listCollectingFacilitiesByCompany({ path: { id: empresa }, query: { limit: 500 } }))).items ?? [],
      staleTime: 10 * 60_000,
    }),

  /** Todas las instalaciones de la empresa (no solo las de acopio): para la vista de stock. */
  instalaciones: (empresa: number) =>
    queryOptions({
      queryKey: ['instalaciones', empresa, 'todas'],
      queryFn: async () => (await desenvolver(listFacilitiesByCompany({ path: { id: empresa }, query: { limit: 500 } }))).items ?? [],
      staleTime: 10 * 60_000,
    }),

  instalacion: (id: number) =>
    queryOptions({
      queryKey: ['instalacion', id],
      queryFn: () => desenvolver(getFacility({ path: { id } })),
      staleTime: 10 * 60_000,
    }),

  semiproducto: (id: number) =>
    queryOptions({
      queryKey: ['semiproducto', id],
      queryFn: () => desenvolver(getSemiProduct({ path: { id } })),
      staleTime: 30 * 60_000,
    }),

  usuariosEmpresa: (empresa: number) =>
    queryOptions({
      queryKey: ['empresa', empresa, 'usuarios'],
      queryFn: () => desenvolver(getCompanyUsers({ path: { id: empresa } })),
      staleTime: 10 * 60_000,
    }),

  entregas: (empresa: number, f: FiltroEntregas) =>
    queryOptions({
      queryKey: ['entregas', empresa, f],
      queryFn: () => {
        const query = {
          isPurchaseOrderOnly: true,
          query: f.texto?.trim() || undefined,
          isWomenShare: f.mujeres,
          semiProductId: f.semiproducto,
          isOpenBalanceOnly: f.soloSaldo || undefined,
          sortBy: f.orden.campo,
          sort: f.orden.sentido,
          limit: POR_PAGINA_STOCK,
          offset: (f.pagina - 1) * POR_PAGINA_STOCK,
        };
        return f.instalacion
          ? desenvolver(getStockOrderListByFacilityId({ path: { facilityId: f.instalacion }, query }))
          : desenvolver(getStockOrderListByCompanyId({ path: { companyId: empresa }, query: { ...query, farmerId: f.productor } }));
      },
      placeholderData: keepPreviousData,
    }),

  entrega: (id: number) =>
    queryOptions({
      queryKey: ['entrega', id],
      queryFn: () => desenvolver(getStockOrder({ path: { id } })),
    }),

  /** Todo el stock de una instalación (órdenes sueltas). Como la versión actual, exige instalación. */
  ordenes: (f: FiltroStock) =>
    queryOptions({
      queryKey: ['stock', 'ordenes', f],
      queryFn: () =>
        desenvolver(
          getStockOrderListByFacilityId({
            path: { facilityId: f.instalacion! },
            query: {
              semiProductId: f.semiproducto,
              isPurchaseOrderOnly: f.soloCompras || undefined,
              availableOnly: f.soloDisponible || undefined,
              sortBy: f.orden.campo,
              sort: f.orden.sentido,
              limit: POR_PAGINA_STOCK,
              offset: (f.pagina - 1) * POR_PAGINA_STOCK,
            },
          }),
        ),
      enabled: !!f.instalacion,
      placeholderData: keepPreviousData,
    }),

  /** Lo mismo agrupado por lote (como la "vista agrupada" de la versión actual). */
  ordenesAgrupadas: (f: FiltroStock) =>
    queryOptions({
      queryKey: ['stock', 'agrupadas', f],
      queryFn: () =>
        desenvolver(
          getGroupedStockOrderList({
            path: { facilityId: f.instalacion! },
            query: {
              semiProductId: f.semiproducto,
              isPurchaseOrderOnly: f.soloCompras || undefined,
              availableOnly: f.soloDisponible || undefined,
              // El orden se manda entre valores fijos conocidos (el backend lo concatena a la consulta).
              sortBy: f.orden.campo === 'deliveryTime' ? 'deliveryTime' : f.orden.campo === 'updateTimestamp' ? 'updateTimestamp' : 'date',
              sort: f.orden.sentido,
              limit: POR_PAGINA_STOCK,
              offset: (f.pagina - 1) * POR_PAGINA_STOCK,
            },
          }),
        ),
      enabled: !!f.instalacion,
      placeholderData: keepPreviousData,
    }),

  /** Trazabilidad de una orden: línea de tiempo de procesamientos hacia atrás. */
  historia: (id: number) =>
    queryOptions({
      queryKey: ['stock', 'historia', id],
      queryFn: () => desenvolver(getStockOrderAggregatedHistory({ path: { id } })),
    }),
};

/** Quita null y cadenas vacías antes de enviar, como hace la interfaz actual. */
function limpiar<T>(o: T): T {
  if (Array.isArray(o)) return o.map(limpiar) as T;
  if (o && typeof o === 'object') {
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [k, limpiar(v)])) as T;
  }
  return o;
}

export function useGuardarEntrega(empresa: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: ApiStockOrder) => {
      const r = await desenvolver(createOrUpdateStockOrder({ body: limpiar(e) }));
      // La API devuelve solo el id: se trae la entrega completa con lo que calculó el backend.
      return desenvolver(getStockOrder({ path: { id: r.id! } }));
    },
    onSuccess: (guardada) => {
      void qc.invalidateQueries({ queryKey: ['entregas', empresa] });
      if (guardada.id) qc.setQueryData(['entrega', guardada.id], guardada);
    },
  });
}

export function useEntregaMasiva(empresa: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ApiPurchaseOrder) => desenvolver(createPurchaseOrderBulk({ body: limpiar(p) })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['entregas', empresa] }),
  });
}

export function useBorrarEntrega(empresa: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => desenvolver(deleteStockOrder({ path: { id } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['entregas', empresa] });
      void qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export function exportarEntregas(empresa: number) {
  return descargarBlob(exportDeliveriesByCompany({ path: { companyId: empresa }, parseAs: 'blob' }), 'entregas.xlsx');
}

/** Datos geográficos (GeoJSON) de una orden. Devuelve false si la orden no tiene nada que exportar. */
export function exportarGeoDatos(id: number) {
  return descargarBlob(exportGeoData({ path: { id }, parseAs: 'blob' }), `orden-${id}.geojson`);
}
