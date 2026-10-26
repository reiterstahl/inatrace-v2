import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createOrUpdateProcessingOrder,
  deleteProcessingOrder,
  getAvailableStockForStockUnitInFacility,
  getProcessingAction,
  getStockOrderProcessingOrder,
  listFacilitiesByCompany,
  listProcessingActionsByCompany,
  listProcessingEvidenceTypesByValueChains,
} from './gen/sdk.gen';
import type { ApiProcessingAction, ApiProcessingOrder, ApiStockOrder } from './gen/types.gen';
import { desenvolver } from './respuesta';

export type FiltroDisponible = {
  desde?: string;
  hasta?: string;
  lote?: string;
  mujeres?: boolean;
  organico?: boolean;
};

/**
 * Lotes que se pueden usar como entrada, con las mismas exclusiones que la interfaz actual:
 * para generar un QR, solo los que todavía no tienen; si la acción saca un producto final, no se
 * mezclan lotes con QR de otro producto final.
 */
export function filtrarDisponibles(lotes: ApiStockOrder[], accion: ApiProcessingAction): ApiStockOrder[] {
  if (accion.type === 'GENERATE_QR_CODE') return lotes.filter((o) => !o.qrCodeTag);
  const final = accion.outputFinalProduct;
  if (final) return lotes.filter((o) => !o.qrCodeTag || o.qrCodeTagFinalProduct?.id === final.id);
  return lotes;
}

export const procesamiento = {
  acciones: (empresa: number) =>
    queryOptions({
      queryKey: ['procesamiento', 'acciones', empresa],
      queryFn: async () => (await desenvolver(listProcessingActionsByCompany({ path: { id: empresa }, query: { limit: 500 } }))).items ?? [],
      staleTime: 10 * 60_000,
    }),

  accion: (id: number) =>
    queryOptions({
      queryKey: ['procesamiento', 'accion', id],
      queryFn: () => desenvolver(getProcessingAction({ path: { id } })),
      staleTime: 10 * 60_000,
    }),

  /** Instalaciones de la empresa que manejan un semiproducto o un producto final. */
  instalacionesPara: (empresa: number, producto: { semi?: number | null; final?: number | null }) =>
    queryOptions({
      queryKey: ['instalaciones', empresa, 'para', producto.semi ?? null, producto.final ?? null],
      queryFn: async () =>
        (await desenvolver(listFacilitiesByCompany({ path: { id: empresa }, query: { semiProductId: producto.semi ?? undefined, finalProductId: producto.final ?? undefined, limit: 500 } }))).items ?? [],
      enabled: !!(producto.semi || producto.final),
      staleTime: 10 * 60_000,
    }),

  disponible: (instalacion: number, accion: ApiProcessingAction, f: FiltroDisponible) =>
    queryOptions({
      queryKey: ['procesamiento', 'disponible', instalacion, accion.id, f],
      queryFn: async () => {
        const r = await desenvolver(
          getAvailableStockForStockUnitInFacility({
            path: { facilityId: instalacion },
            query: {
              limit: 500,
              semiProductId: accion.inputSemiProduct?.id,
              finalProductId: accion.inputFinalProduct?.id,
              isWomenShare: f.mujeres,
              organicOnly: f.organico,
              internalLotName: f.lote?.trim() || undefined,
              productionDateStart: f.desde || undefined,
              productionDateEnd: f.hasta || undefined,
            },
          }),
        );
        return filtrarDisponibles(r.items ?? [], accion);
      },
    }),

  /** La orden de procesamiento que produjo un lote (para editarla desde ese lote). */
  deLote: (idLote: number) =>
    queryOptions({
      queryKey: ['procesamiento', 'orden', idLote],
      queryFn: () => desenvolver(getStockOrderProcessingOrder({ path: { id: idLote } })),
    }),

  tiposEvidencia: (cadenas: number[]) =>
    queryOptions({
      queryKey: ['procesamiento', 'tipos-evidencia', cadenas],
      queryFn: async () => (await desenvolver(listProcessingEvidenceTypesByValueChains({ query: { valueChainIds: cadenas, limit: 500 } }))).items ?? [],
      enabled: cadenas.length > 0,
      staleTime: 30 * 60_000,
    }),
};

export function useGuardarProcesamiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (o: ApiProcessingOrder) => desenvolver(createOrUpdateProcessingOrder({ body: o })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock'] });
      void qc.invalidateQueries({ queryKey: ['entregas'] });
      void qc.invalidateQueries({ queryKey: ['procesamiento', 'disponible'] });
      void qc.invalidateQueries({ queryKey: ['procesamiento', 'orden'] });
    },
  });
}

export function useBorrarProcesamiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => desenvolver(deleteProcessingOrder({ path: { id } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock'] });
      void qc.invalidateQueries({ queryKey: ['entregas'] });
      void qc.invalidateQueries({ queryKey: ['procesamiento'] });
    },
  });
}
