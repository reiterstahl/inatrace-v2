/**
 * Clientes de la empresa (empresas compradoras de sus pedidos): portada de company-customers de la
 * versión actual.
 *  - Nombre y país obligatorios; correo válido si se escribe; código postal ≤50.
 *  - La dirección sigue el formato del país, como la ficha de un productor (Ruanda y Honduras
 *    tienen el suyo).
 *  - El backend reemplaza la ficha con lo que recibe: se guarda sobre el cliente tal como llegó.
 *  - La sección «SKU prices» de la versión actual no se porta: no se carga ni se guarda.
 */
import type { ApiCompanyCustomer, ApiCountry } from '@/api/gen/types.gen';
import { correoValido } from './fichaEmpresa';
import { formatoDireccion, type FormatoDireccion } from './productor';

export const CAMPOS_DIRECCION: Record<FormatoDireccion, ('address' | 'city' | 'state' | 'zip' | 'village' | 'cell' | 'sector' | 'hondurasFarm' | 'hondurasVillage' | 'hondurasMunicipality' | 'hondurasDepartment')[]> = {
  general: ['address', 'city', 'state', 'zip'],
  RW: ['village', 'cell', 'sector'],
  HN: ['hondurasFarm', 'hondurasVillage', 'hondurasMunicipality', 'hondurasDepartment'],
};
export type CampoDireccion = (typeof CAMPOS_DIRECCION)[FormatoDireccion][number];

export type FormCliente = {
  id?: number;
  nombre: string;
  oficial: string;
  nif: string;
  contacto: string;
  correo: string;
  telefono: string;
  pais: number | null;
  codigoPais: string;
  dir: Record<CampoDireccion, string>;
};

const VACIA = Object.fromEntries(Object.values(CAMPOS_DIRECCION).flat().map((k) => [k, ''])) as Record<CampoDireccion, string>;

export function formDesdeCliente(c: ApiCompanyCustomer | null): FormCliente {
  const l = c?.location ?? {};
  return {
    id: c?.id,
    nombre: c?.name ?? '',
    oficial: c?.officialCompanyName ?? '',
    nif: c?.vatId ?? '',
    contacto: c?.contact ?? '',
    correo: c?.email ?? '',
    telefono: c?.phone ?? '',
    pais: l.country?.id ?? null,
    codigoPais: l.country?.code ?? '',
    dir: Object.fromEntries(Object.keys(VACIA).map((k) => [k, (l as Record<string, unknown>)[k] ?? ''])) as Record<CampoDireccion, string>,
  };
}

export type ErroresCliente = Partial<Record<'nombre' | 'correo' | 'pais' | 'zip', string>>;

export function validarCliente(f: FormCliente): ErroresCliente {
  const e: ErroresCliente = {};
  if (!f.nombre.trim()) e.nombre = 'requerido';
  if (f.correo.trim() && !correoValido(f.correo)) e.correo = 'correo';
  if (!f.pais) e.pais = 'requerido';
  if (formatoDireccion(f.codigoPais) === 'general' && f.dir.zip.trim().length > 50) e.zip = 'largo_50';
  return e;
}

const opcional = (s: string) => s.trim() || undefined;

/** Cliente a guardar: el original con el formulario encima; solo los campos de dirección del país. */
export function armarCliente(original: ApiCompanyCustomer | null, f: FormCliente, empresa: number, paises: ApiCountry[]): ApiCompanyCustomer {
  const campos = CAMPOS_DIRECCION[formatoDireccion(f.codigoPais)];
  const l = original?.location ?? {};
  return {
    ...(original ?? {}),
    id: original?.id,
    companyId: original?.companyId ?? empresa,
    name: f.nombre.trim(),
    officialCompanyName: opcional(f.oficial),
    vatId: opcional(f.nif),
    contact: opcional(f.contacto),
    email: opcional(f.correo),
    phone: opcional(f.telefono),
    location: {
      latitude: l.latitude,
      longitude: l.longitude,
      otherAddress: l.otherAddress,
      country: paises.find((p) => p.id === f.pais) ?? l.country,
      ...Object.fromEntries(campos.map((k) => [k, opcional(f.dir[k])])),
    },
  };
}

/** «Ciudad, País» para la lista. */
export function lugarCliente(c: ApiCompanyCustomer): string {
  const l = c.location;
  const f = formatoDireccion(l?.country?.code);
  const lugar = f === 'RW' ? l?.cell || l?.village : f === 'HN' ? l?.hondurasMunicipality : l?.city;
  return [lugar, l?.country?.name].filter(Boolean).join(', ');
}
