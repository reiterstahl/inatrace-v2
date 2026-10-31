import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createOrUpdateFinalProduct, createProduct, deleteFinalProduct, deleteProduct, getFinalProductList, getMeasureUnitTypeList, getProduct,
  listCompanies, listCompaniesAdmin, listProducts, listProductsAdmin, updateProduct, uploadImage,
} from './gen/sdk.gen';
import type { ApiFinalProduct, ApiProduct } from './gen/types.gen';
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

  /** Productos finales del producto (lo que se vende con una o varias de sus etiquetas). */
  finales: (producto: number) =>
    queryOptions({
      queryKey: ['productos', producto, 'finales'],
      queryFn: () => desenvolver(getFinalProductList({ path: { productId: producto }, query: { limit: 500, sortBy: 'name', sort: 'ASC' } })),
    }),

  unidades: () =>
    queryOptions({
      queryKey: ['unidades-medida'],
      queryFn: () => desenvolver(getMeasureUnitTypeList({ query: { limit: 500 } })),
      staleTime: 10 * 60_000,
    }),

  /**
   * Empresas para asociar al producto. Solo la administración del sistema o regional asocia empresas
   * (el backend ignora el cambio para los demás); la del sistema ve todas las de la instancia.
   */
  empresas: (nombre: string, sistema: boolean) =>
    queryOptions({
      queryKey: ['empresas', 'buscar', nombre, sistema],
      queryFn: () => {
        const query = { name: nombre || undefined, limit: 20, sortBy: 'name', sort: 'ASC' as const };
        return desenvolver(sistema ? listCompaniesAdmin({ query }) : listCompanies({ query }));
      },
      placeholderData: keepPreviousData,
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

export function useGuardarFinal(producto: number) {
  const qc = useQueryClient();
  return useMutation({
    // El backend exige la lista de etiquetas (aunque sea vacía).
    mutationFn: (f: ApiFinalProduct) => desenvolver(createOrUpdateFinalProduct({ path: { productId: producto }, body: { ...f, labels: f.labels ?? [] } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['productos', producto, 'finales'] }),
  });
}

export function useBorrarFinal(producto: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => desenvolver(deleteFinalProduct({ path: { productId: producto, finalProductId: id } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['productos', producto, 'finales'] }),
  });
}
