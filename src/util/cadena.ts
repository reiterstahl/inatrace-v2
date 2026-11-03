import type { ApiValueChain } from '@/api/gen/types.gen';

/** Listas de catálogo que configura una cadena de valor (el backend las guarda por id). */
export const LISTAS_CADENA = ['facilityTypes', 'measureUnitTypes', 'processingEvidenceTypes', 'processingEvidenceFields', 'semiProducts'] as const;
export type ListaCadena = (typeof LISTAS_CADENA)[number];

export type FormCadena = { nombre: string; descripcion: string; tipoProducto: string } & Record<ListaCadena, number[]>;
export type ErroresCadena = Partial<Record<'nombre' | 'descripcion' | 'tipoProducto', 'requerido'>>;

export function formDesdeCadena(c?: ApiValueChain): FormCadena {
  const ids = (l?: { id?: number }[]) => (l ?? []).map((x) => x.id!).filter(Boolean);
  return {
    nombre: c?.name ?? '',
    descripcion: c?.description ?? '',
    tipoProducto: c?.productType?.id ? String(c.productType.id) : '',
    facilityTypes: ids(c?.facilityTypes),
    measureUnitTypes: ids(c?.measureUnitTypes),
    processingEvidenceTypes: ids(c?.processingEvidenceTypes),
    processingEvidenceFields: ids(c?.processingEvidenceFields),
    semiProducts: ids(c?.semiProducts),
  };
}

/** Como la versión actual: nombre, descripción y tipo de producto obligatorios; las listas, no. */
export function validarCadena(f: FormCadena): ErroresCadena {
  const e: ErroresCadena = {};
  if (!f.nombre.trim()) e.nombre = 'requerido';
  if (!f.descripcion.trim()) e.descripcion = 'requerido';
  if (!f.tipoProducto) e.tipoProducto = 'requerido';
  return e;
}

/**
 * Cadena a guardar, sobre la original: el backend reemplaza nombre y descripción, cambia las listas
 * que llegan (por id) y exige el tipo de producto.
 */
export function armarCadena(original: ApiValueChain | undefined, f: FormCadena): ApiValueChain {
  const porId = (l: number[]) => l.map((id) => ({ id }));
  return {
    ...original,
    name: f.nombre.trim(),
    description: f.descripcion.trim(),
    productType: { id: Number(f.tipoProducto) },
    facilityTypes: porId(f.facilityTypes) as ApiValueChain['facilityTypes'],
    measureUnitTypes: porId(f.measureUnitTypes) as ApiValueChain['measureUnitTypes'],
    processingEvidenceTypes: porId(f.processingEvidenceTypes) as ApiValueChain['processingEvidenceTypes'],
    processingEvidenceFields: porId(f.processingEvidenceFields),
    semiProducts: porId(f.semiProducts),
  };
}

/**
 * Qué puede hacer cada rol, como el backend: la del sistema todo; la regional solo crear (editar,
 * activar, desactivar y borrar se le niegan). Una cadena desactivada no se edita.
 */
export function permisosCadena(rol: string | undefined, c?: Pick<ApiValueChain, 'valueChainStatus'>) {
  const sistema = rol === 'SYSTEM_ADMIN';
  return {
    crear: sistema || rol === 'REGIONAL_ADMIN',
    editar: sistema && c?.valueChainStatus !== 'DISABLED',
    activar: sistema && c?.valueChainStatus === 'DISABLED',
    desactivar: sistema && c?.valueChainStatus === 'ENABLED',
    borrar: sistema,
  };
}
