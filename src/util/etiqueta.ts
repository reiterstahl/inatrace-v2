/**
 * Etiquetas de un producto (las vitrinas que abre cada QR), portadas del modo "labels" de
 * product-label en la versión actual y alineadas con el backend:
 *  - cada etiqueta tiene su propio contenido, copiado del producto al crearla, y una lista de campos
 *    con su visibilidad: la vitrina pública muestra solo los visibles (ProductApiTools.updateApiProductLabelValues);
 *  - una etiqueta nueva muestra los datos del producto (nombre, foto, descripción, origen y
 *    recorrido) y oculta el resto, como en la versión actual;
 *  - la apariencia se toma del producto y la etiqueta la reemplaza donde tiene valores
 *    (loadBusinessToCustomerSettings); los medios son documentos de las empresas de la cadena.
 */
import type {
  ApiBusinessToCustomerSettings, ApiCompanyDocument, ApiProductLabel, ApiProductLabelCompanyDocument, ApiProductLabelContent, ApiProductLabelField,
  ApiProductLabelValuesExtended,
} from '@/api/gen/types.gen';
import { guardar, leer } from './almacen';

export type SeccionEtiqueta = 'product' | 'process' | 'responsibility' | 'sustainability' | 'settings' | 'company';

/** Campos de una etiqueta en el orden de la versión actual (más el texto de transparencia de precios). */
export const CAMPOS_ETIQUETA: { nombre: string; seccion: SeccionEtiqueta }[] = [
  ...['name', 'photo', 'description', 'origin', 'journeyMarkers'].map((nombre) => ({ nombre, seccion: 'product' as const })),
  { nombre: 'process.production', seccion: 'process' },
  { nombre: 'responsibility.laborPolicies', seccion: 'responsibility' },
  ...['sustainability.production', 'sustainability.packaging', 'sustainability.co2Footprint'].map((nombre) => ({ nombre, seccion: 'sustainability' as const })),
  ...['settings.language', 'settings.gdprText', 'settings.privacyPolicyText', 'settings.termsOfUseText', 'settings.incomeIncreaseDescription'].map((nombre) => ({ nombre, seccion: 'settings' as const })),
  ...['company.name', 'company.logo', 'company.headquarters', 'company.about', 'company.manager', 'company.email', 'company.phone', 'company.webPage', 'company.mediaLinks.facebook', 'company.mediaLinks.instagram', 'company.mediaLinks.twitter', 'company.mediaLinks.youtube', 'company.mediaLinks.other'].map((nombre) => ({ nombre, seccion: 'company' as const })),
];
/** El recorrido no se oculta: la versión actual lo guarda siempre visible. */
export const SIEMPRE_VISIBLE = 'journeyMarkers';
const VISIBLES_AL_CREAR = new Set(['name', 'photo', 'description', 'origin', SIEMPRE_VISIBLE]);

export type Visibles = Record<string, boolean>;

/** Campos de una etiqueta nueva. */
export const camposIniciales = (): ApiProductLabelField[] => CAMPOS_ETIQUETA.map((c) => ({ name: c.nombre, section: c.seccion, visible: VISIBLES_AL_CREAR.has(c.nombre) }));

export function visiblesDesde(etiqueta: ApiProductLabel): Visibles {
  const v: Visibles = Object.fromEntries(CAMPOS_ETIQUETA.map((c) => [c.nombre, false]));
  for (const f of etiqueta.fields ?? []) if (f.name) v[f.name] = !!f.visible;
  v[SIEMPRE_VISIBLE] = true;
  return v;
}

/**
 * Campos a guardar: se respeta el orden que ya tenía la etiqueta (la versión actual permite
 * reordenarlos) y se agregan al final los que falten.
 */
export function armarCampos(visibles: Visibles, originales: ApiProductLabelField[] = []): ApiProductLabelField[] {
  const seccion = new Map(CAMPOS_ETIQUETA.map((c) => [c.nombre, c.seccion]));
  const vistos = new Set<string>();
  const campos: ApiProductLabelField[] = [];
  for (const f of originales) {
    if (!f.name || vistos.has(f.name)) continue;
    vistos.add(f.name);
    campos.push({ ...f, visible: f.name === SIEMPRE_VISIBLE ? true : (visibles[f.name] ?? !!f.visible) });
  }
  for (const c of CAMPOS_ETIQUETA) {
    if (vistos.has(c.nombre)) continue;
    campos.push({ name: c.nombre, section: seccion.get(c.nombre), visible: c.nombre === SIEMPRE_VISIBLE ? true : !!visibles[c.nombre] });
  }
  return campos;
}

/** Valor de un campo por su ruta ("company.mediaLinks.facebook"), como FieldTools.getFieldValue. */
export function valorCampo(objeto: unknown, ruta: string): unknown {
  let v: unknown = objeto;
  for (const parte of ruta.split('.')) {
    if (v === null || typeof v !== 'object') return undefined;
    v = (v as Record<string, unknown>)[parte];
  }
  return v;
}

/** Apariencia de la etiqueta sobre la del producto (los valores vacíos de la etiqueta no cuentan). */
export function aparienciaEfectiva(producto: ApiBusinessToCustomerSettings = {}, etiqueta: ApiBusinessToCustomerSettings = {}): ApiBusinessToCustomerSettings {
  const propios = Object.fromEntries(Object.entries(etiqueta).filter(([k, v]) => v !== null && v !== undefined && v !== '' && k !== 'id'));
  return { ...producto, ...propios };
}

export const MEDIOS = ['VIDEO', 'MEET_THE_FARMER', 'PRODUCTION_RECORD'] as const;
export type CategoriaMedio = (typeof MEDIOS)[number];

/** Solo un video puede acompañar a la etiqueta (la vitrina muestra uno). */
export function validarMedios(medios: ApiProductLabelCompanyDocument[]): string | null {
  return medios.filter((m) => m.category === 'VIDEO' && m.active).length > 1 ? 'un_video' : null;
}

// ---------- Vista previa ----------

/** Lo que muestra la vitrina en una vista previa: la etiqueta y de dónde viene. */
export type VistaPrevia = { producto: number; etiqueta: number; titulo: string; publicada: boolean };
export type EtiquetaVitrina = ApiProductLabelValuesExtended & { vistaPrevia?: VistaPrevia };

const PREFIJO = 'previa-';
const CLAVE = (id: string) => `inatrace.vista-previa.${id}`;
const VIGENCIA = 24 * 60 * 60_000;

/** La vitrina reconoce una vista previa por su identificador (nunca es el uuid de una etiqueta real). */
export const idVistaPrevia = (etiqueta: number) => `${PREFIJO}${etiqueta}`;
export const esVistaPrevia = (uid: string) => uid.startsWith(PREFIJO);

/**
 * Arma lo que la vitrina pública recibiría si la etiqueta estuviera publicada con estos cambios,
 * siguiendo a getProductLabelValuesPublic del backend.
 */
export function armarVistaPrevia(o: {
  etiqueta: ApiProductLabel;
  titulo: string;
  contenido: ApiProductLabelContent;
  visibles: Visibles;
  aparienciaProducto?: ApiBusinessToCustomerSettings;
  medios: ApiProductLabelCompanyDocument[];
  producto: number;
}): EtiquetaVitrina {
  const campos = armarCampos(o.visibles, o.etiqueta.fields);
  const activos = o.medios.filter((m) => m.active).map(({ active: _a, ...d }) => d as ApiCompanyDocument);
  return {
    id: o.etiqueta.id,
    productId: o.producto,
    uuid: idVistaPrevia(o.etiqueta.id!),
    status: o.etiqueta.status,
    title: o.titulo,
    language: o.etiqueta.language,
    fields: campos.filter((c) => c.visible).map((c) => ({ name: c.name, section: c.section, value: valorCampo(o.contenido, c.name!) as Record<string, unknown> })),
    numberOfBatches: 0,
    checkAuthenticityCount: 0,
    traceOriginCount: 0,
    businessToCustomerSettings: aparienciaEfectiva(o.aparienciaProducto, o.contenido.businessToCustomerSettings),
    videoMeetTheFarmers: activos.find((d) => d.category === 'VIDEO'),
    photosMeetTheFarmers: activos.filter((d) => d.category === 'MEET_THE_FARMER'),
    productionRecords: activos.filter((d) => d.category === 'PRODUCTION_RECORD'),
    vistaPrevia: { producto: o.producto, etiqueta: o.etiqueta.id!, titulo: o.titulo, publicada: o.etiqueta.status === 'PUBLISHED' },
  };
}

/** Se guarda en este navegador para que la pestaña nueva de la vista previa la lea. */
export function guardarVistaPrevia(v: EtiquetaVitrina) {
  guardar(CLAVE(v.uuid!), JSON.stringify({ hasta: Date.now() + VIGENCIA, v }));
}

export function leerVistaPrevia(uid: string, ahora = Date.now()): EtiquetaVitrina | null {
  try {
    const g = JSON.parse(leer(CLAVE(uid)) ?? 'null') as { hasta: number; v: EtiquetaVitrina } | null;
    return g && g.hasta > ahora ? g.v : null;
  } catch {
    return null;
  }
}
