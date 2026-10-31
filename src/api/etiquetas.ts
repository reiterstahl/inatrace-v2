import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createProductLabel, deleteProductLabel, executeProductAction, getCompanyDocumentsForProductLabel, getProductLabel, getProductLabelContent,
  getProductLabels, updateCompanyDocumentsForProductLabel, updateProductLabel, updateProductLabelContent,
} from './gen/sdk.gen';
import type { ApiProductLabel, ApiProductLabelCompanyDocument, ApiProductLabelContent } from './gen/types.gen';
import { desenvolver } from './respuesta';
import { camposIniciales } from '@/util/etiqueta';

type Idioma = NonNullable<ApiProductLabel['language']>;

export const etiquetas = {
  lista: (producto: number) =>
    queryOptions({
      queryKey: ['etiquetas', 'producto', producto],
      queryFn: () => desenvolver(getProductLabels({ path: { id: producto } })),
    }),
  etiqueta: (id: number) =>
    queryOptions({
      queryKey: ['etiquetas', id],
      queryFn: () => desenvolver(getProductLabel({ path: { id } })),
    }),
  contenido: (id: number) =>
    queryOptions({
      queryKey: ['etiquetas', id, 'contenido'],
      queryFn: () => desenvolver(getProductLabelContent({ path: { id } })),
    }),
  /** Documentos de las empresas de la cadena que la etiqueta puede mostrar (videos, productores, registros). */
  medios: (id: number) =>
    queryOptions({
      queryKey: ['etiquetas', id, 'medios'],
      queryFn: () => desenvolver(getCompanyDocumentsForProductLabel({ path: { id } })),
    }),
};

function useInvalidar(producto: number) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['etiquetas'] });
    void qc.invalidateQueries({ queryKey: ['productos', producto] });
  };
}

/**
 * Crea la etiqueta con los campos de una nueva (los datos del producto a la vista) y deja su
 * contenido en el idioma elegido, como la versión actual. El backend copia el contenido del
 * producto (con el arreglo H23, también las políticas laborales y los lugares de origen).
 */
export function useCrearEtiqueta(producto: number) {
  const invalidar = useInvalidar(producto);
  return useMutation({
    mutationFn: async ({ titulo, idioma }: { titulo: string; idioma: Idioma }): Promise<number> => {
      const { id } = await desenvolver(createProductLabel({ body: { productId: producto, title: titulo, language: idioma, fields: camposIniciales() } }));
      const contenido = await desenvolver(getProductLabelContent({ path: { id: id! } }));
      if (contenido.settings?.language !== idioma) {
        await desenvolver(updateProductLabelContent({ body: { ...contenido, labelId: id, settings: { ...(contenido.settings ?? {}), language: idioma } } }));
      }
      return id!;
    },
    onSuccess: invalidar,
  });
}

/** Guarda título y visibilidad, contenido y medios (tres llamadas, como la versión actual). */
export function useGuardarEtiqueta(producto: number) {
  const invalidar = useInvalidar(producto);
  return useMutation({
    mutationFn: async ({ etiqueta, contenido, medios }: { etiqueta: ApiProductLabel; contenido: ApiProductLabelContent; medios: ApiProductLabelCompanyDocument[] | null }) => {
      await desenvolver(updateProductLabel({ body: etiqueta }));
      await desenvolver(updateProductLabelContent({ body: { ...contenido, labelId: etiqueta.id } }));
      if (medios) await desenvolver(updateCompanyDocumentsForProductLabel({ path: { id: etiqueta.id! }, body: medios }));
    },
    onSuccess: invalidar,
  });
}

export function usePublicarEtiqueta(producto: number) {
  const invalidar = useInvalidar(producto);
  return useMutation({
    mutationFn: ({ id, publicar }: { id: number; publicar: boolean }) =>
      desenvolver(executeProductAction({ path: { action: publicar ? 'PUBLISH_LABEL' : 'UNPUBLISH_LABEL' }, body: { id } })),
    onSuccess: invalidar,
  });
}

export function useBorrarEtiqueta(producto: number) {
  const invalidar = useInvalidar(producto);
  return useMutation({
    mutationFn: (id: number) => desenvolver(deleteProductLabel({ path: { id } })),
    onSuccess: invalidar,
  });
}
