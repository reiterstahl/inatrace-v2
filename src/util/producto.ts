/**
 * Ficha de un producto, portada de product-label de la versión actual (modo producto) y alineada
 * con ProductService del backend:
 *  - obligatorios como en la versión actual: nombre, descripción, foto, texto y al menos un punto
 *    de origen, producción (proceso), políticas laborales y producción sostenible;
 *  - producción sostenible y empaque hasta 1000 caracteres; el idioma es obligatorio (la base no
 *    acepta un producto sin él);
 *  - el backend reescribe el producto completo con lo que recibe: al guardar se parte del producto
 *    tal como vino y se cambian solo los campos de la ficha (lección de H16);
 *  - edita la empresa dueña; las demás empresas asociadas solo lo ven, como en la versión actual.
 */
import type { ApiDocument, ApiLocation, ApiProduct } from '@/api/gen/types.gen';

export type Idioma = NonNullable<NonNullable<ApiProduct['settings']>['language']>;
export const IDIOMAS: Idioma[] = ['ES', 'EN', 'DE', 'RW'];

export type PuntoOrigen = { clave: string; nombre: string; lat: number | null; lng: number | null; productores: number | null };

export type FormProducto = {
  nombre: string;
  descripcion: string;
  foto: ApiDocument | null;
  origenTexto: string;
  puntos: PuntoOrigen[];
  produccion: string;
  politicasLaborales: string;
  sostenibleProduccion: string;
  sostenibleEmpaque: string;
  huellaCo2: string;
  idioma: Idioma | '';
  gdpr: string;
  privacidad: string;
  terminos: string;
};

export type Seccion = 'datos' | 'origen' | 'proceso' | 'responsabilidad' | 'sostenibilidad' | 'ajustes';
export const SECCIONES: Seccion[] = ['datos', 'origen', 'proceso', 'responsabilidad', 'sostenibilidad', 'ajustes'];

let contador = 0;
export const puntoNuevo = (lng: number | null = null, lat: number | null = null): PuntoOrigen => ({ clave: `p${++contador}`, nombre: '', lat, lng, productores: null });

export function formDesdeProducto(p: ConFicha | null): FormProducto {
  return {
    nombre: p?.name ?? '',
    descripcion: p?.description ?? '',
    foto: p?.photo ?? null,
    origenTexto: p?.origin?.text ?? '',
    puntos: (p?.origin?.locations ?? []).map((l) => ({ ...puntoNuevo(l.longitude ?? null, l.latitude ?? null), nombre: l.pinName ?? '', productores: l.numberOfFarmers ?? null })),
    produccion: p?.process?.production ?? '',
    politicasLaborales: p?.responsibility?.laborPolicies ?? '',
    sostenibleProduccion: p?.sustainability?.production ?? '',
    sostenibleEmpaque: p?.sustainability?.packaging ?? '',
    huellaCo2: p?.sustainability?.co2Footprint ?? '',
    idioma: p?.settings?.language ?? '',
    gdpr: p?.settings?.gdprText ?? '',
    privacidad: p?.settings?.privacyPolicyText ?? '',
    terminos: p?.settings?.termsOfUseText ?? '',
  };
}

type Campo = Exclude<keyof FormProducto, 'puntos'>;
export type ErroresProducto = Partial<Record<Campo, string>> & { puntos: Record<string, Partial<Record<'lat' | 'lng' | 'productores', string>>>; sinPuntos?: string };

/** Sección de cada campo, para marcar en el índice dónde hay errores. */
export const SECCION_DE: Record<Campo | 'puntos', Seccion> = {
  nombre: 'datos', descripcion: 'datos', foto: 'datos',
  origenTexto: 'origen', puntos: 'origen',
  produccion: 'proceso', politicasLaborales: 'responsabilidad',
  sostenibleProduccion: 'sostenibilidad', sostenibleEmpaque: 'sostenibilidad', huellaCo2: 'sostenibilidad',
  idioma: 'ajustes', gdpr: 'ajustes', privacidad: 'ajustes', terminos: 'ajustes',
};

export function validarProducto(f: FormProducto): ErroresProducto {
  const e: ErroresProducto = { puntos: {} };
  if (!f.nombre.trim()) e.nombre = 'requerido';
  if (!f.descripcion.trim()) e.descripcion = 'requerido';
  if (!f.foto) e.foto = 'requerido';
  if (!f.origenTexto.trim()) e.origenTexto = 'requerido';
  if (!f.puntos.length) e.sinPuntos = 'sin_puntos';
  for (const p of f.puntos) {
    const ep: Partial<Record<'lat' | 'lng' | 'productores', string>> = {};
    if (p.lat === null || Number.isNaN(p.lat)) ep.lat = 'requerido';
    else if (p.lat < -90 || p.lat > 90) ep.lat = 'latitud';
    if (p.lng === null || Number.isNaN(p.lng)) ep.lng = 'requerido';
    else if (p.lng < -180 || p.lng > 180) ep.lng = 'longitud';
    if (p.productores !== null && (Number.isNaN(p.productores) || p.productores < 0 || !Number.isInteger(p.productores))) ep.productores = 'entero';
    if (Object.keys(ep).length) e.puntos[p.clave] = ep;
  }
  if (!f.produccion.trim()) e.produccion = 'requerido';
  if (!f.politicasLaborales.trim()) e.politicasLaborales = 'requerido';
  if (!f.sostenibleProduccion.trim()) e.sostenibleProduccion = 'requerido';
  else if (f.sostenibleProduccion.trim().length > 1000) e.sostenibleProduccion = 'largo_1000';
  if (f.sostenibleEmpaque.trim().length > 1000) e.sostenibleEmpaque = 'largo_1000';
  // La base no admite un producto sin idioma (la versión actual siempre lo manda).
  if (!f.idioma) e.idioma = 'requerido';
  return e;
}

export const sinErroresProducto = (e: ErroresProducto) => Object.keys(e).filter((k) => k !== 'puntos').length === 0 && Object.keys(e.puntos).length === 0;

/** Secciones con algún error, para el índice. */
export function seccionesConError(e: ErroresProducto): Set<Seccion> {
  const s = new Set<Seccion>();
  for (const k of Object.keys(e) as (keyof ErroresProducto)[]) {
    if (k === 'puntos') {
      if (Object.keys(e.puntos).length) s.add('origen');
    } else if (k === 'sinPuntos') s.add('origen');
    else s.add(SECCION_DE[k]);
  }
  return s;
}

const opcional = (s: string) => s.trim() || undefined;

/** Lo que comparten un producto y el contenido de una etiqueta (la ficha). */
export type ConFicha = Pick<ApiProduct, 'name' | 'description' | 'photo' | 'origin' | 'process' | 'responsibility' | 'sustainability' | 'settings'>;

/**
 * Ficha a guardar sobre lo que vino (producto o contenido de una etiqueta): se conserva todo lo demás
 * (empresas asociadas, etiquetas, vitrina, recorrido…) y solo se reemplaza lo de la ficha.
 */
export function armarContenido<T extends ConFicha>(f: FormProducto, base: T): T {
  const ubicaciones: ApiLocation[] = f.puntos.map((p, i) => ({
    ...(base.origin?.locations?.[i] ?? {}),
    pinName: opcional(p.nombre),
    latitude: p.lat!,
    longitude: p.lng!,
    numberOfFarmers: p.productores ?? undefined,
  }));
  return {
    ...base,
    name: f.nombre.trim(),
    description: f.descripcion.trim(),
    photo: f.foto ?? undefined,
    origin: { ...(base.origin ?? {}), text: f.origenTexto.trim(), locations: ubicaciones },
    process: { ...(base.process ?? {}), production: f.produccion.trim() },
    responsibility: { ...(base.responsibility ?? {}), laborPolicies: f.politicasLaborales.trim() },
    sustainability: { ...(base.sustainability ?? {}), production: f.sostenibleProduccion.trim(), packaging: opcional(f.sostenibleEmpaque), co2Footprint: opcional(f.huellaCo2) },
    settings: { ...(base.settings ?? {}), language: f.idioma || undefined, gdprText: opcional(f.gdpr), privacyPolicyText: opcional(f.privacidad), termsOfUseText: opcional(f.terminos) },
  };
}

/** Producto a guardar. Al editar se parte del original completo (lección de H16). */
export function armarProducto(f: FormProducto, original: ApiProduct | null, alta?: { empresa: number; cadena: number }): ApiProduct {
  const base: ApiProduct = original ?? { name: '', company: { id: alta!.empresa } as ApiProduct['company'], valueChain: { id: alta!.cadena } as ApiProduct['valueChain'], dataSharingAgreements: [] };
  return armarContenido(f, base);
}

/** La empresa elegida es dueña del producto (puede editarlo y borrarlo). */
export const esDuena = (p: ApiProduct, empresa: number) => (p.associatedCompanies ?? []).some((a) => a.type === 'OWNER' && a.company?.id === empresa);
