import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { addProductKnowledgeBlog, deleteProductKnowledgeBlog, getProductKnowledgeBlog, getProductKnowledgeBlogs, updateProductKnowledgeBlog } from './gen/sdk.gen';
import type { ApiKnowledgeBlog } from './gen/types.gen';
import type { Tema } from '@/util/conocimiento';
import { desenvolver } from './respuesta';

export const POR_PAGINA_CONOCIMIENTO = 20;

export const conocimiento = {
  /** Entradas de un producto, las más nuevas primero (el backend solo ordena por id o por tema). */
  lista: (producto: number, f: { tema?: Tema; pagina: number }) =>
    queryOptions({
      queryKey: ['conocimiento', producto, f],
      queryFn: () =>
        desenvolver(
          getProductKnowledgeBlogs({
            path: { productId: producto },
            query: { type: f.tema, sortBy: 'id', sort: 'DESC', limit: POR_PAGINA_CONOCIMIENTO, offset: (f.pagina - 1) * POR_PAGINA_CONOCIMIENTO },
          }),
        ),
      placeholderData: keepPreviousData,
    }),

  /** Entrada completa (la lista no trae resumen, contenido ni documentos). */
  entrada: (id: number) =>
    queryOptions({
      queryKey: ['conocimiento', 'entrada', id],
      queryFn: () => desenvolver(getProductKnowledgeBlog({ path: { id } })),
      staleTime: 0,
    }),
};

export function useGuardarEntrada(producto: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: ApiKnowledgeBlog) => {
      if (e.id) await desenvolver(updateProductKnowledgeBlog({ body: e }));
      else await desenvolver(addProductKnowledgeBlog({ path: { productId: producto }, body: e }));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['conocimiento'] }),
  });
}

/** Borra una entrada (ruta agregada en el backend del contrato con H25). */
export function useBorrarEntrada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => desenvolver(deleteProductKnowledgeBlog({ path: { id } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['conocimiento'] }),
  });
}
