import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createOrUpdateValueChain, deleteValueChain, disableValueChain, enableValueChain, getFacilityTypeList, getMeasureUnitTypeList,
  getProcessingEvidenceFieldList, getProcessingEvidenceTypeList, getProductTypes, getSemiProductList, getValueChain, getValueChainList,
} from './gen/sdk.gen';
import type { ApiValueChain } from './gen/types.gen';
import { POR_PAGINA } from './productores';
import { desenvolver } from './respuesta';

type Idioma = 'ES' | 'EN' | 'DE' | 'RW';
export type FiltroCadenas = { texto: string; estado?: 'ENABLED' | 'DISABLED'; pagina: number };
const MUCHOS = { limit: 500 };

export const cadenas = {
  lista: (f: FiltroCadenas) =>
    queryOptions({
      queryKey: ['cadenas', 'lista', f],
      queryFn: () => desenvolver(getValueChainList({ query: { name: f.texto.trim() || undefined, valueChainStatus: f.estado, limit: POR_PAGINA, offset: (f.pagina - 1) * POR_PAGINA, sortBy: 'name', sort: 'ASC' } })),
      placeholderData: keepPreviousData,
    }),

  /**
   * Completa y fresca: se edita sobre ella. Los nombres llegan en el idioma de la interfaz (el cliente
   * manda la cabecera `language`); el idioma va en la clave para no mezclar.
   */
  detalle: (id: number, idioma: Idioma) =>
    queryOptions({
      queryKey: ['cadenas', 'detalle', id, idioma],
      queryFn: () => desenvolver(getValueChain({ path: { id } })),
      staleTime: 0,
    }),

  /** Los catálogos que una cadena puede usar, en el idioma de la interfaz. */
  catalogos: (idioma: Idioma) =>
    queryOptions({
      queryKey: ['catalogo', 'para-cadenas', idioma],
      queryFn: async () => {
        const [tiposProducto, instalaciones, unidades, evidencias, campos, semiproductos] = await Promise.all([
          desenvolver(getProductTypes()),
          desenvolver(getFacilityTypeList({ query: MUCHOS })),
          desenvolver(getMeasureUnitTypeList({ query: MUCHOS })),
          desenvolver(getProcessingEvidenceTypeList({ query: MUCHOS })),
          desenvolver(getProcessingEvidenceFieldList({ query: MUCHOS })),
          desenvolver(getSemiProductList({ query: MUCHOS })),
        ]);
        const op = (l: { id?: number; name?: string; label?: string }[] | undefined) => (l ?? []).map((x) => ({ id: x.id!, nombre: x.label || x.name || `#${x.id}` }));
        return {
          tiposProducto: op(tiposProducto.items),
          facilityTypes: op(instalaciones.items),
          measureUnitTypes: op(unidades.items),
          processingEvidenceTypes: op(evidencias.items),
          processingEvidenceFields: op(campos.items),
          semiProducts: op(semiproductos.items),
        };
      },
      staleTime: 10 * 60_000,
    }),
};

function useAlCambiar() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['cadenas'] });
    // Las listas de cadenas activas de la ficha de empresa y de productos.
    void qc.invalidateQueries({ queryKey: ['catalogo', 'cadenas-activas'] });
  };
}

export function useGuardarCadena() {
  const alCambiar = useAlCambiar();
  return useMutation({
    mutationFn: async (c: ApiValueChain) => (await desenvolver(createOrUpdateValueChain({ body: c }))).id!,
    onSuccess: alCambiar,
  });
}

export function useEstadoCadena() {
  const alCambiar = useAlCambiar();
  return useMutation({
    mutationFn: ({ id, activar }: { id: number; activar: boolean }) => desenvolver(activar ? enableValueChain({ path: { id } }) : disableValueChain({ path: { id } })),
    onSuccess: alCambiar,
  });
}

/** El backend no borra una cadena en uso (sin H30 falla por la clave foránea con un 500). */
export function useBorrarCadena() {
  const alCambiar = useAlCambiar();
  return useMutation({
    mutationFn: (id: number) => desenvolver(deleteValueChain({ path: { id } })),
    onSuccess: alCambiar,
  });
}
