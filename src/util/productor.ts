import type { ApiAddress, ApiPlot, ApiUserCustomer } from '@/api/gen/types.gen';
import type { Punto } from './geo';

export const nombreCompleto = (p: Pick<ApiUserCustomer, 'name' | 'surname'>) => [p.name, p.surname].filter(Boolean).join(' ').trim();

/** Formato de dirección según el país, igual que la interfaz actual (Ruanda y Honduras tienen el suyo). */
export type FormatoDireccion = 'RW' | 'HN' | 'general';
export const formatoDireccion = (codigoPais?: string | null): FormatoDireccion =>
  codigoPais === 'RW' ? 'RW' : codigoPais === 'HN' ? 'HN' : 'general';

export function ubicacionCorta(a?: ApiAddress | null): string {
  if (!a) return '';
  switch (formatoDireccion(a.country?.code)) {
    case 'RW':
      return [a.village, a.cell, a.sector].filter(Boolean).join(', ');
    case 'HN':
      return [a.hondurasVillage, a.hondurasMunicipality, a.hondurasDepartment].filter(Boolean).join(', ');
    default:
      return [a.city, a.state].filter(Boolean).join(', ');
  }
}

export const puntoDe = (l?: { latitude?: number; longitude?: number } | null): Punto | null =>
  l && typeof l.latitude === 'number' && typeof l.longitude === 'number' ? [l.longitude, l.latitude] : null;

export const coordenadasDe = (p: ApiPlot): Punto[] =>
  (p.coordinates ?? []).filter((c) => typeof c.latitude === 'number' && typeof c.longitude === 'number').map((c) => [c.longitude!, c.latitude!]);
