/**
 * Lotes de una etiqueta, opiniones y estadísticas: portados de batches-list, batch-detail-page,
 * product-label-feedback-page y product-label-statistics-page de la versión actual.
 *  - Un lote tiene número (obligatorio; el backend solo acepta letras y números ASCII) y, si se activa la verificación de autenticidad, al menos una
 *    fecha (el vencimiento no puede ser anterior a la producción); si se activa el rastreo de
 *    origen, al menos un lugar.
 *  - Las opiniones se exportan solo con los correos de quienes dieron su consentimiento (la versión
 *    actual exportaba todos).
 *  - Las estadísticas llegan como conteos por país y por punto ("lat:lng").
 */
import type { ApiDocument, ApiLocation, ApiProductLabelBatch, ApiProductLabelFeedback } from '@/api/gen/types.gen';
import { puntoNuevo, type PuntoOrigen } from './producto';

export type FormLote = {
  id?: number;
  numero: string;
  autenticidad: boolean;
  produccion: string;
  vencimiento: string;
  foto: ApiDocument | null;
  origen: boolean;
  lugares: PuntoOrigen[];
};

export const loteVacio = (): FormLote => ({ numero: '', autenticidad: false, produccion: '', vencimiento: '', foto: null, origen: false, lugares: [] });

export function formDesdeLote(l: ApiProductLabelBatch): FormLote {
  return {
    id: l.id,
    numero: l.number ?? '',
    autenticidad: !!l.checkAuthenticity,
    produccion: l.productionDate ?? '',
    vencimiento: l.expiryDate ?? '',
    foto: l.photo ?? null,
    origen: !!l.traceOrigin,
    lugares: (l.locations ?? []).map(lugarDesde),
  };
}

export const lugarDesde = (l: ApiLocation): PuntoOrigen => ({ ...puntoNuevo(l.longitude ?? null, l.latitude ?? null), nombre: l.pinName ?? '', productores: l.numberOfFarmers ?? null });

export type ErroresLote = { numero?: string; fechas?: string; vencimiento?: string; lugares?: string; puntos: Record<string, Partial<Record<'lat' | 'lng' | 'productores', string>>> };

export function validarLote(f: FormLote): ErroresLote {
  const e: ErroresLote = { puntos: {} };
  if (!f.numero.trim()) e.numero = 'requerido';
  else if (!/^[A-Za-z0-9]+$/.test(f.numero.trim())) e.numero = 'alfanumerico';
  if (f.autenticidad && !f.produccion && !f.vencimiento) e.fechas = 'una_fecha';
  if (f.produccion && f.vencimiento && f.vencimiento < f.produccion) e.vencimiento = 'vence_antes';
  if (f.origen) {
    if (!f.lugares.length) e.lugares = 'sin_lugares';
    for (const p of f.lugares) {
      const ep: Partial<Record<'lat' | 'lng' | 'productores', string>> = {};
      if (p.lat === null || Number.isNaN(p.lat) || p.lat < -90 || p.lat > 90) ep.lat = p.lat === null ? 'requerido' : 'latitud';
      if (p.lng === null || Number.isNaN(p.lng) || p.lng < -180 || p.lng > 180) ep.lng = p.lng === null ? 'requerido' : 'longitud';
      if (p.productores !== null && (Number.isNaN(p.productores) || p.productores < 0 || !Number.isInteger(p.productores))) ep.productores = 'entero';
      if (Object.keys(ep).length) e.puntos[p.clave] = ep;
    }
  }
  return e;
}

export const sinErroresLote = (e: ErroresLote) => !e.numero && !e.fechas && !e.vencimiento && !e.lugares && Object.keys(e.puntos).length === 0;

/** Lote a guardar: el backend reemplaza fechas, lugares y opciones con lo que recibe. */
export function armarLote(f: FormLote, etiqueta: number): ApiProductLabelBatch {
  return {
    id: f.id,
    labelId: etiqueta,
    number: f.numero.trim(),
    productionDate: f.produccion || undefined,
    expiryDate: f.vencimiento || undefined,
    photo: f.foto ?? undefined,
    checkAuthenticity: f.autenticidad,
    traceOrigin: f.origen,
    locations: f.lugares.map((p) => ({ latitude: p.lat!, longitude: p.lng!, pinName: p.nombre.trim() || undefined, numberOfFarmers: p.productores ?? undefined })),
  };
}

// ---------- Opiniones ----------

/** CSV con los correos de quienes aceptaron el tratamiento de sus datos (GDPR). */
export function csvCorreos(opiniones: ApiProductLabelFeedback[]): string {
  const correos = [...new Set(opiniones.filter((o) => o.gdprConsent && o.email?.trim()).map((o) => o.email!.trim()))];
  const campo = (s: string) => (/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return ['email', ...correos.map(campo)].join('\n') + '\n';
}

// ---------- Estadísticas ----------

/** Conteos ordenados de mayor a menor. */
export const ordenarConteos = (m: Record<string, number> = {}) => Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/** Puntos de las visitas: el backend los agrupa como "lat:lng". */
export function puntosConteo(m: Record<string, number> = {}): { lat: number; lng: number; n: number }[] {
  return Object.entries(m).flatMap(([k, n]) => {
    const [lat, lng] = k.split(':').map(Number);
    return lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [{ lat, lng, n }] : [];
  });
}
