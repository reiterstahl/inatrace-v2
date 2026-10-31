import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { createProduct, deleteProduct, getProduct, listProducts, listProductsAdmin, updateProduct, uploadImage } from './gen/sdk.gen';
import type { ApiProduct } from './gen/types.gen';
import { desenvolver } from './respuesta';

export const POR_PAGINA_PRODUCTOS = 24;

export type FiltroProductos = { nombre?: string; pagina: number; todos?: boolean };

export const productos = {
  /**
   * Productos de las empresas del usuario (dueñas o asociadas). La administración del sistema puede
   * ver todos los de la instancia, como en la versión actual.
   */
  lista: (f: FiltroProductos) =>
    queryOptions({
      queryKey: ['productos', 'lista', f],
      queryFn: () => {
        const query = { name: f.nombre || undefined, sortBy: 'name', sort: 'ASC' as const, limit: POR_PAGINA_PRODUCTOS, offset: (f.pagina - 1) * POR_PAGINA_PRODUCTOS };
        return desenvolver(f.todos ? listProductsAdmin({ query }) : listProducts({ query }));
      },
      placeholderData: keepPreviousData,
    }),

  producto: (id: number) =>
    queryOptions({
      queryKey: ['productos', id],
      queryFn: () => desenvolver(getProduct({ path: { id }, query: { includeLabels: true } })),
    }),
};

export function useGuardarProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: ApiProduct): Promise<number> => {
      if (p.id) {
        await desenvolver(updateProduct({ body: p }));
        return p.id;
      }
      return (await desenvolver(createProduct({ body: p }))).id!;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['productos'] }),
  });
}

export function useBorrarProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => desenvolver(deleteProduct({ path: { id } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['productos'] }),
  });
}

/** Sube una imagen (el backend genera los tamaños que se piden con /image/{clave}/{tamaño}). */
export const subirImagen = (archivo: File) => desenvolver(uploadImage({ body: { file: archivo } }));
