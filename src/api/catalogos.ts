import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createOrUpdate, createOrUpdate1, createOrUpdateFacilityType, createOrUpdateMapLayer, delete1, delete_, deleteMapLayer, getAll, getFactors, getMapLayerList, createOrUpdateMeasurementUnitType, createOrUpdateProcessingEvidenceField, createOrUpdateProcessingEvidenceType,
  createOrUpdateSemiProduct, createProductType, deleteFacilityType, deleteMeasurementUnitType, deleteProcessingEvidenceField,
  deleteProcessingEvidenceType, deleteProductType, deleteSemiProduct, getFacilityTypeList, getMeasureUnitTypeList,
  getProcessingEvidenceFieldList, getProcessingEvidenceTypeList, getProductTypes, getSemiProductList, updateProductType,
} from './gen/sdk.gen';
import type {
  ApiCertificationType, ApiConversionFactor, ApiMapLayer, ApiFacilityType, ApiMeasureUnitType, ApiProcessingEvidenceField, ApiProcessingEvidenceType, ApiProductType, ApiSemiProduct,
} from './gen/types.gen';
import type { Catalogo, ItemCatalogo } from '@/util/catalogos';
import { desenvolver } from './respuesta';

const MUCHOS = { query: { limit: 500 } };

/** La lista completa de cada catálogo (son cortos); incluye las traducciones para editarlas. */
const LISTAS: Record<Catalogo, () => Promise<{ items?: ItemCatalogo[] }>> = {
  semiproductos: () => desenvolver(getSemiProductList(MUCHOS)),
  'tipos-producto': () => desenvolver(getProductTypes()),
  'tipos-instalacion': () => desenvolver(getFacilityTypeList(MUCHOS)),
  unidades: () => desenvolver(getMeasureUnitTypeList(MUCHOS)),
  'tipos-evidencia': () => desenvolver(getProcessingEvidenceTypeList(MUCHOS)),
  'campos-evidencia': () => desenvolver(getProcessingEvidenceFieldList(MUCHOS)),
  'capas-mapa': () => desenvolver(getMapLayerList(MUCHOS)),
  // Estos dos responden la lista sin paginar.
  certificaciones: async () => ({ items: await desenvolver(getAll()) }),
  factores: async () => ({ items: await desenvolver(getFactors()) }),
};

export const catalogos = {
  /** El idioma va en la clave: el backend traduce los nombres con la cabecera `language`. */
  lista: (cat: Catalogo, idioma: string) =>
    queryOptions({
      queryKey: ['catalogo', 'admin', cat, idioma],
      queryFn: async () => (await LISTAS[cat]()).items ?? [],
      staleTime: 0,
    }),
};

const GUARDAR: Record<Catalogo, (x: ItemCatalogo) => Promise<unknown>> = {
  semiproductos: (x) => desenvolver(createOrUpdateSemiProduct({ body: x as ApiSemiProduct })),
  // Los tipos de producto son la excepción: crear y editar van por rutas distintas.
  'tipos-producto': (x) => desenvolver(x.id ? updateProductType({ body: x as ApiProductType }) : createProductType({ body: x as ApiProductType })),
  'tipos-instalacion': (x) => desenvolver(createOrUpdateFacilityType({ body: x as ApiFacilityType })),
  unidades: (x) => desenvolver(createOrUpdateMeasurementUnitType({ body: x as ApiMeasureUnitType })),
  'tipos-evidencia': (x) => desenvolver(createOrUpdateProcessingEvidenceType({ body: x as ApiProcessingEvidenceType })),
  'campos-evidencia': (x) => desenvolver(createOrUpdateProcessingEvidenceField({ body: x as ApiProcessingEvidenceField })),
  'capas-mapa': (x) => desenvolver(createOrUpdateMapLayer({ body: x as ApiMapLayer })),
  certificaciones: (x) => desenvolver(createOrUpdate1({ body: x as ApiCertificationType })),
  factores: (x) => desenvolver(createOrUpdate({ body: x as ApiConversionFactor })),
};

const BORRAR: Record<Catalogo, (id: number) => Promise<unknown>> = {
  semiproductos: (id) => desenvolver(deleteSemiProduct({ path: { id } })),
  // El backend declara `/{id}` pero lee el id de la consulta (@RequestParam; AgStack lo documenta en
  // docs/api-auth-coverage/38-codebooks.md). Va en los dos lugares, como la interfaz actual: así sirve
  // también si algún día lo corrigen.
  'tipos-producto': (id) => desenvolver(deleteProductType({ path: { id }, query: { id } } as unknown as Parameters<typeof deleteProductType>[0])),
  'tipos-instalacion': (id) => desenvolver(deleteFacilityType({ path: { id } })),
  unidades: (id) => desenvolver(deleteMeasurementUnitType({ path: { id } })),
  'tipos-evidencia': (id) => desenvolver(deleteProcessingEvidenceType({ path: { id } })),
  'campos-evidencia': (id) => desenvolver(deleteProcessingEvidenceField({ path: { id } })),
  'capas-mapa': (id) => desenvolver(deleteMapLayer({ path: { id } })),
  certificaciones: (id) => desenvolver(delete1({ path: { id } })),
  factores: (id) => desenvolver(delete_({ path: { id } })),
};

/** Cualquier cambio invalida todos los catálogos: los usan las cadenas, instalaciones, acciones y productos. */
function useAlCambiar() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ['catalogo'] });
}

export function useGuardarItem(cat: Catalogo) {
  const alCambiar = useAlCambiar();
  return useMutation({ mutationFn: (x: ItemCatalogo) => GUARDAR[cat](x), onSuccess: alCambiar });
}

/** El backend no borra lo que está en uso: sin H31 falla con un 500 genérico; con H31, 400 en inglés. */
export function useBorrarItem(cat: Catalogo) {
  const alCambiar = useAlCambiar();
  return useMutation({ mutationFn: (id: number) => BORRAR[cat](id), onSuccess: alCambiar });
}
