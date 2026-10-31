import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createProductLabelBatch, deleteProductLabelBatch, deleteProductLabelFeedback, getProductLabelAnalytics, getProductLabelBatches, listProductLabelFeedbacksForLabel,
  updateProductLabelBatch,
} from './gen/sdk.gen';
import type { ApiProductLabelBatch, ApiProductLabelFeedback } from './gen/types.gen';
import { desenvolver } from './respuesta';

export const POR_PAGINA_LOTES = 20;
export const POR_PAGINA_OPINIONES = 20;
export type TipoOpinion = NonNullable<ApiProductLabelFeedback['type']>;

export const lotes = {
  lista: (etiqueta: number, f: { numero?: string; pagina: number }) =>
    queryOptions({
      queryKey: ['lotes', etiqueta, f],
      queryFn: () =>
        desenvolver(
          getProductLabelBatches({
            path: { id: etiqueta },
            query: { number: f.numero || undefined, sortBy: 'id', sort: 'DESC', limit: POR_PAGINA_LOTES, offset: (f.pagina - 1) * POR_PAGINA_LOTES },
          }),
        ),
      placeholderData: keepPreviousData,
    }),

  /**
   * Opiniones de una etiqueta con los datos que dejó cada consumidor. Van por la ruta con sesión
   * (H24): la pública ya no entrega correo ni respuestas.
   */
  opiniones: (etiqueta: number, f: { tipo?: TipoOpinion; pagina: number; todas?: boolean }) =>
    queryOptions({
      queryKey: ['opiniones', etiqueta, f],
      queryFn: () =>
        desenvolver(
          listProductLabelFeedbacksForLabel({
            path: { id: etiqueta },
            query: f.todas ? { limit: 1000, sort: 'DESC' } : { type: f.tipo, sort: 'DESC', limit: POR_PAGINA_OPINIONES, offset: (f.pagina - 1) * POR_PAGINA_OPINIONES },
          }),
        ),
      placeholderData: keepPreviousData,
    }),

  /** Visitas y verificaciones de una etiqueta (por su uuid), agregadas por el backend. */
  estadisticas: (uuid: string) =>
    queryOptions({
      queryKey: ['estadisticas', uuid],
      queryFn: () => desenvolver(getProductLabelAnalytics({ path: { uid: uuid } })),
    }),
};

export function useGuardarLote(etiqueta: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (l: ApiProductLabelBatch) => {
      if (l.id) await desenvolver(updateProductLabelBatch({ body: l }));
      else await desenvolver(createProductLabelBatch({ body: l }));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lotes', etiqueta] }),
  });
}

export function useBorrarLote(etiqueta: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => desenvolver(deleteProductLabelBatch({ path: { id } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lotes', etiqueta] }),
  });
}

export function useBorrarOpinion(etiqueta: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => desenvolver(deleteProductLabelFeedback({ path: { id } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['opiniones', etiqueta] }),
  });
}
