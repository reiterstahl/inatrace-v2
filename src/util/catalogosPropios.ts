import type { ApiCertificationType, ApiConversionFactor, ApiMapLayer } from '@/api/gen/types.gen';

/**
 * Catálogos propios de esta instalación de INATrace (no están en el original): capas de mapa, tipos de
 * certificación y factores de conversión entre semiproductos. Mismas reglas que el backend.
 */
export const TIPOS_CAPA = ['XYZ', 'WMS', 'ARCGIS_REST', 'GEOJSON'] as const;
type TipoCapa = (typeof TIPOS_CAPA)[number];

const esUrl = (v: string) => {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};
/** Número con coma o punto; null si no es número. */
const numero = (v: string) => (v.trim() && Number.isFinite(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : null);

// ---------- Capas de mapa ----------

export type FormCapa = {
  codigo: string; etiqueta: string; tipo: TipoCapa | ''; url: string; capa: string; descripcion: string;
  atribucion: string; opacidad: string; visible: boolean; activa: boolean; orden: string;
};
export type ErroresCapa = Partial<Record<'codigo' | 'etiqueta' | 'tipo' | 'url' | 'capa' | 'opacidad' | 'orden', string>>;

export function formDesdeCapa(c?: ApiMapLayer): FormCapa {
  return {
    codigo: c?.code ?? '', etiqueta: c?.label ?? '', tipo: c?.type ?? '', url: c?.url ?? '', capa: c?.layerName ?? '',
    descripcion: c?.description ?? '', atribucion: c?.attribution ?? '', opacidad: String(c?.opacity ?? 1),
    visible: !!c?.visibleByDefault, activa: c?.enabled ?? true, orden: String(c?.sortOrder ?? 0),
  };
}

/** Como el backend: URL obligatoria, nombre de capa en WMS, plantilla {z}/{x}/{y} en XYZ y opacidad de 0 a 1. */
export function validarCapa(f: FormCapa): ErroresCapa {
  const e: ErroresCapa = {};
  if (!f.codigo.trim()) e.codigo = 'requerido';
  if (!f.etiqueta.trim()) e.etiqueta = 'requerido';
  if (!f.tipo) e.tipo = 'requerido';
  if (!f.url.trim()) e.url = 'requerido';
  else if (!esUrl(f.url)) e.url = 'url';
  else if (f.tipo === 'XYZ' && !['{z}', '{x}', '{y}'].every((p) => f.url.includes(p))) e.url = 'plantilla_xyz';
  if (f.tipo === 'WMS' && !f.capa.trim()) e.capa = 'requerido';
  const o = numero(f.opacidad);
  if (o === null || o < 0 || o > 1) e.opacidad = 'opacidad';
  if (!Number.isInteger(numero(f.orden))) e.orden = 'entero';
  return e;
}

export function armarCapa(original: ApiMapLayer | undefined, f: FormCapa): ApiMapLayer {
  return {
    ...original,
    code: original?.code ?? f.codigo.trim(),
    label: f.etiqueta.trim(),
    type: f.tipo as TipoCapa,
    url: f.url.trim(),
    layerName: f.capa.trim() || undefined,
    description: f.descripcion.trim() || undefined,
    attribution: f.atribucion.trim() || undefined,
    opacity: numero(f.opacidad) ?? 1,
    visibleByDefault: f.visible,
    enabled: f.activa,
    sortOrder: numero(f.orden) ?? 0,
  };
}

// ---------- Tipos de certificación ----------

export type FormCertificacion = { codigo: string; etiqueta: string; descripcion: string; logo: string; activa: boolean; orden: string };
export type ErroresCertificacion = Partial<Record<'codigo' | 'etiqueta' | 'logo' | 'orden', string>>;

export function formDesdeCertificacion(c?: ApiCertificationType): FormCertificacion {
  return { codigo: c?.code ?? '', etiqueta: c?.label ?? '', descripcion: c?.description ?? '', logo: c?.logoUrl ?? '', activa: c?.enabled ?? true, orden: String(c?.sortOrder ?? 0) };
}

export function validarCertificacion(f: FormCertificacion): ErroresCertificacion {
  const e: ErroresCertificacion = {};
  if (!f.codigo.trim()) e.codigo = 'requerido';
  if (!f.etiqueta.trim()) e.etiqueta = 'requerido';
  if (f.logo.trim() && !esUrl(f.logo)) e.logo = 'url';
  if (!Number.isInteger(numero(f.orden))) e.orden = 'entero';
  return e;
}

/** El código no cambia al editar (el backend lo ignora: lo guardan las certificaciones ya cargadas). */
export function armarCertificacion(original: ApiCertificationType | undefined, f: FormCertificacion): ApiCertificationType {
  return {
    ...original,
    code: original?.code ?? f.codigo.trim(),
    label: f.etiqueta.trim(),
    description: f.descripcion.trim() || undefined,
    logoUrl: f.logo.trim() || undefined,
    enabled: f.activa,
    sortOrder: numero(f.orden) ?? 0,
  };
}

// ---------- Factores de conversión ----------

export type FormFactor = { entrada: string; salida: string; factor: string; notas: string; activo: boolean };
export type ErroresFactor = Partial<Record<'entrada' | 'salida' | 'factor', string>>;

export function formDesdeFactor(x?: ApiConversionFactor): FormFactor {
  return {
    entrada: x?.inputSemiProductId ? String(x.inputSemiProductId) : '',
    salida: x?.outputSemiProductId ? String(x.outputSemiProductId) : '',
    factor: x?.factor != null ? String(x.factor) : '',
    notas: x?.notes ?? '',
    activo: x?.enabled ?? true,
  };
}

export function validarFactor(f: FormFactor): ErroresFactor {
  const e: ErroresFactor = {};
  if (!f.entrada) e.entrada = 'requerido';
  if (!f.salida) e.salida = 'requerido';
  else if (f.salida === f.entrada) e.salida = 'mismo';
  const n = numero(f.factor);
  if (n === null || n <= 0) e.factor = 'positivo';
  return e;
}

/** Se conserva la empresa del factor (si es de una): la pantalla edita los generales y los de empresa. */
export function armarFactor(original: ApiConversionFactor | undefined, f: FormFactor): ApiConversionFactor {
  return {
    ...original,
    inputSemiProductId: Number(f.entrada),
    outputSemiProductId: Number(f.salida),
    factor: numero(f.factor)!,
    notes: f.notas.trim() || undefined,
    enabled: f.activo,
  };
}

/** Cuánto sale por cada 100 que entran, para mostrar el factor en palabras. */
export const porCien = (factor: number) => Math.round(factor * 100 * 100) / 100;
