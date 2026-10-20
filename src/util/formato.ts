/** Dinero con su moneda; si el código no es ISO válido, número y código por separado. */
export function dinero(valor: number | null | undefined, moneda: string | null | undefined, idioma: string): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
  try {
    if (moneda) return new Intl.NumberFormat(idioma, { style: 'currency', currency: moneda, maximumFractionDigits: 2 }).format(valor);
  } catch {
    /* código de moneda no reconocido */
  }
  return `${valor.toLocaleString(idioma, { maximumFractionDigits: 2 })}${moneda ? ' ' + moneda : ''}`;
}

export function cantidad(valor: number | null | undefined, unidad: string | null | undefined, idioma: string): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
  return `${valor.toLocaleString(idioma, { maximumFractionDigits: 2 })}${unidad ? ' ' + unidad : ''}`;
}

/** Nombre de una instalación; si no tiene traducción al idioma activo, el del punto en el mapa o su id. */
export const nombreInstalacion = (f?: { id?: number; name?: string; facilityLocation?: { pinName?: string } } | null) =>
  f ? f.name || f.facilityLocation?.pinName || `#${f.id}` : '—';

/** Fecha de una entrega: la de producción; las cargadas por otras vías pueden traer solo la de entrega. */
export const fechaEntrega = (e: { productionDate?: string; deliveryTime?: string; creationTimestamp?: string }) =>
  e.productionDate || e.deliveryTime || e.creationTimestamp?.slice(0, 10) || '';
