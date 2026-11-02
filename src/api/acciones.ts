import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createOrUpdateProcessingAction, deleteProcessingAction, getProcessingActionDetail, listProcessingEvidenceFieldsByValueChains,
  listProcessingEvidenceTypesByValueChains,
} from './gen/sdk.gen';
import type { ApiProcessingAction } from './gen/types.gen';
import { desenvolver } from './respuesta';

const ids = (cadenas: number[]) => [...cadenas].sort((a, b) => a - b);

export const acciones = {
  /** Con traducciones, productos, instalaciones y lo que se pide al registrarla: se edita sobre ella. */
  detalle: (id: number) =>
    queryOptions({
      queryKey: ['accion', id],
      queryFn: () => desenvolver(getProcessingActionDetail({ path: { id } })),
      staleTime: 0,
    }),

  camposEvidencia: (cadenas: number[]) =>
    queryOptions({
      queryKey: ['catalogo', 'campos-evidencia', ids(cadenas)],
      queryFn: async () => (await desenvolver(listProcessingEvidenceFieldsByValueChains({ query: { valueChainIds: cadenas, limit: 500 } }))).items ?? [],
      enabled: cadenas.length > 0,
      staleTime: 10 * 60_000,
    }),

  /** Tipos de documento de evidencia (los de tipo DOCUMENT, como la versión actual). */
  documentosEvidencia: (cadenas: number[]) =>
    queryOptions({
      queryKey: ['catalogo', 'documentos-evidencia', ids(cadenas)],
      queryFn: async () => ((await desenvolver(listProcessingEvidenceTypesByValueChains({ query: { valueChainIds: cadenas, limit: 500 } }))).items ?? []).filter((x) => !x.type || x.type === 'DOCUMENT'),
      enabled: cadenas.length > 0,
      staleTime: 10 * 60_000,
    }),
};

// Las acciones también se usan en procesamiento y en los pedidos: se refresca todo.
const refrescar = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ['procesamiento', 'acciones'] });
  void qc.invalidateQueries({ queryKey: ['procesamiento', 'accion'] });
  void qc.invalidateQueries({ queryKey: ['accion'] });
};

export function useGuardarAccion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: ApiProcessingAction) => (await desenvolver(createOrUpdateProcessingAction({ body: a }))).id,
    onSuccess: () => refrescar(qc),
  });
}

/** El backend no puede borrar una acción con procesamientos hechos (falla por la clave foránea). */
export function useBorrarAccion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => desenvolver(deleteProcessingAction({ path: { id } })),
    onSuccess: () => refrescar(qc),
  });
}
