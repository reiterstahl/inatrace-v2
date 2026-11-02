/**
 * Instalaciones de la empresa: portada de company-detail-facilities y company-detail-facility-add de
 * la versión actual.
 *  - El backend reemplaza con lo que recibe los datos de la instalación (incluido si está
 *    desactivada) y las traducciones del nombre que no lleguen se borran: se guarda siempre sobre la
 *    instalación tal como llegó.
 *  - El nombre se guarda por idioma y el backend no tiene respaldo: en un idioma sin nombre la
 *    instalación aparece vacía. La versión actual exigía el inglés; la v2 exige al menos uno y
 *    completa los vacíos con el primero que haya (primero el idioma de la interfaz).
 *  - Ubicación como la versión actual: país obligatorio; en Ruanda aldea, celda y sector, en el resto
 *    dirección, ciudad, región y código postal; si se muestra en el mapa, latitud y longitud.
 *  - Al menos una cadena de valor; los semiproductos se eligen entre los de esas cadenas. Como no
 *    dicen de qué cadena son, al quitar una cadena se vacían (igual que en la versión actual).
 */
import type { ApiCountry, ApiFacility, ApiFacilityType, ApiFinalProduct, ApiSemiProduct, ApiValueChain } from '@/api/gen/types.gen';

export const IDIOMAS_NOMBRE = ['ES', 'EN', 'DE', 'RW'] as const;
export type IdiomaNombre = (typeof IDIOMAS_NOMBRE)[number];

export const OPCIONES = [
  'displayMayInvolveCollectors', 'displayOrganic', 'displayWomenOnly', 'displayTare',
  'displayPriceDeductionDamage', 'displayWeightDeductionDamage', 'displayPriceDeterminedLater',
] as const;
export type Opcion = (typeof OPCIONES)[number];

export type FormInstalacion = {
  id?: number;
  tipo: number | null;
  nombres: Record<IdiomaNombre, string>;
  pais: number | null;
  codigoPais: string;
  direccion: string;
  ciudad: string;
  region: string;
  postal: string;
  aldea: string;
  celda: string;
  sector: string;
  visible: boolean | null;
  lat: number | null;
  lng: number | null;
  acopio: boolean | null;
  vende: boolean | null;
  opciones: Record<Opcion, boolean>;
  cadenas: ApiValueChain[];
  semis: ApiSemiProduct[];
  finales: ApiFinalProduct[];
};

export function formDesdeInstalacion(i: ApiFacility | null, cadenasEmpresa: ApiValueChain[] = []): FormInstalacion {
  const l = i?.facilityLocation ?? {};
  const a = l.address ?? {};
  const nombre = (idioma: IdiomaNombre) => i?.translations?.find((t) => t.language === idioma)?.name ?? '';
  return {
    id: i?.id,
    tipo: i?.facilityType?.id ?? null,
    nombres: Object.fromEntries(IDIOMAS_NOMBRE.map((x) => [x, nombre(x)])) as Record<IdiomaNombre, string>,
    pais: a.country?.id ?? null,
    codigoPais: a.country?.code ?? '',
    direccion: a.address ?? '',
    ciudad: a.city ?? '',
    region: a.state ?? '',
    postal: a.zip ?? '',
    aldea: a.village ?? '',
    celda: a.cell ?? '',
    sector: a.sector ?? '',
    visible: l.publiclyVisible ?? null,
    lat: l.latitude ?? null,
    lng: l.longitude ?? null,
    acopio: i ? (i.isCollectionFacility ?? null) : null,
    vende: i ? (i.isPublic ?? null) : null,
    opciones: Object.fromEntries(OPCIONES.map((o) => [o, !!i?.[o]])) as Record<Opcion, boolean>,
    // Como la versión actual: una instalación nueva arranca con la cadena si la empresa tiene una sola.
    cadenas: i ? (i.facilityValueChains ?? []) : cadenasEmpresa.length === 1 ? cadenasEmpresa : [],
    semis: i?.facilitySemiProductList ?? [],
    finales: i?.facilityFinalProducts ?? [],
  };
}

export const esRuanda = (codigoPais: string) => codigoPais === 'RW';

export type ErroresInstalacion = Partial<Record<'tipo' | 'nombre' | 'pais' | 'visible' | 'lat' | 'lng' | 'acopio' | 'vende' | 'cadenas', string>>;

export function validarInstalacion(f: FormInstalacion): ErroresInstalacion {
  const e: ErroresInstalacion = {};
  if (!f.tipo) e.tipo = 'requerido';
  if (!IDIOMAS_NOMBRE.some((x) => f.nombres[x].trim())) e.nombre = 'requerido';
  if (!f.pais) e.pais = 'requerido';
  if (f.visible === null) e.visible = 'requerido';
  if (f.visible) {
    if (f.lat === null || Number.isNaN(f.lat)) e.lat = 'requerido';
    else if (f.lat < -90 || f.lat > 90) e.lat = 'latitud';
    if (f.lng === null || Number.isNaN(f.lng)) e.lng = 'requerido';
    else if (f.lng < -180 || f.lng > 180) e.lng = 'longitud';
  }
  if (f.acopio === null) e.acopio = 'requerido';
  if (f.vende === null) e.vende = 'requerido';
  if (!f.cadenas.length) e.cadenas = 'sin_cadenas';
  return e;
}

/** Los idiomas vacíos toman el primer nombre escrito (antes el de la interfaz). */
export function completarNombres(nombres: Record<IdiomaNombre, string>, idiomaInterfaz: string): Record<IdiomaNombre, string> {
  const orden = [idiomaInterfaz.slice(0, 2).toUpperCase(), ...IDIOMAS_NOMBRE];
  const base = orden.map((x) => nombres[x as IdiomaNombre]?.trim()).find(Boolean) ?? '';
  return Object.fromEntries(IDIOMAS_NOMBRE.map((x) => [x, nombres[x].trim() || base])) as Record<IdiomaNombre, string>;
}

/** Instalación a guardar: la original (si existe) con el formulario encima. */
export function armarInstalacion(
  original: ApiFacility | null,
  f: FormInstalacion,
  c: { empresa: number; idioma: string; paises: ApiCountry[]; tipos: ApiFacilityType[] },
): ApiFacility {
  const idiomaInterfaz = c.idioma;
  const nombres = completarNombres(f.nombres, idiomaInterfaz);
  const ruanda = esRuanda(f.codigoPais);
  const opcional = (s: string) => s.trim() || undefined;
  const l = original?.facilityLocation ?? {};
  return {
    ...(original ?? {}),
    id: original?.id,
    company: original?.company ?? { id: c.empresa },
    // Objetos completos de los catálogos: el backend puede validarlos enteros, no solo el id.
    facilityType: c.tipos.find((t) => t.id === f.tipo) ?? original?.facilityType,
    translations: IDIOMAS_NOMBRE.map((language) => ({ language, name: nombres[language] })),
    name: nombres[(idiomaInterfaz.slice(0, 2).toUpperCase() as IdiomaNombre)] ?? nombres.EN,
    facilityLocation: {
      ...l,
      publiclyVisible: !!f.visible,
      latitude: f.lat ?? undefined,
      longitude: f.lng ?? undefined,
      address: {
        ...(l.address ?? {}),
        country: c.paises.find((p) => p.id === f.pais) ?? l.address?.country,
        address: ruanda ? undefined : opcional(f.direccion),
        city: ruanda ? undefined : opcional(f.ciudad),
        state: ruanda ? undefined : opcional(f.region),
        zip: ruanda ? undefined : opcional(f.postal),
        village: ruanda ? opcional(f.aldea) : undefined,
        cell: ruanda ? opcional(f.celda) : undefined,
        sector: ruanda ? opcional(f.sector) : undefined,
      },
    },
    isCollectionFacility: !!f.acopio,
    isPublic: !!f.vende,
    ...f.opciones,
    deactivated: !!original?.deactivated,
    facilityValueChains: f.cadenas,
    facilitySemiProductList: f.semis,
    facilityFinalProducts: f.finales,
  };
}

/** Nombre para mostrar: el del idioma pedido o, si falta, el primero que haya. */
export const nombreInstalacion = (i: ApiFacility) => i.name?.trim() || i.translations?.find((t) => t.name?.trim())?.name || `#${i.id}`;

/** «Ciudad, País» o «Celda, País», como la lista de la versión actual. */
export function lugarInstalacion(i: ApiFacility): string {
  const a = i.facilityLocation?.address;
  return [a?.cell || a?.city, a?.country?.name].filter(Boolean).join(', ');
}
