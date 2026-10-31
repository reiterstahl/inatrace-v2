/**
 * Apariencia de la vitrina de un producto (o de una etiqueta) y su recorrido, portados de la sección
 * "B2C settings" y "Product journey" de product-label en la versión actual:
 *  - colores, tipografías e imágenes de portada y encabezado;
 *  - pestañas opcionales (precios justos, productores, calidad, opinión) con su posición;
 *  - gráficos de precios y los precios de referencia con que se calculan;
 *  - el recorrido: puntos en orden que la vitrina une con una línea.
 * El backend reescribe los ajustes completos con lo que recibe (y si no recibe ninguno, pone los de
 * fábrica): se parte siempre de lo que vino y se cambian solo estos campos.
 */
import type { ApiBusinessToCustomerSettings, ApiDocument, ApiProductJourneyMarker, ApiProductSettings } from '@/api/gen/types.gen';

export const COLORES = ['primaryColor', 'secondaryColor', 'tertiaryColor', 'quaternaryColor', 'productTitleColor', 'headingColor', 'textColor'] as const;
export type Color = (typeof COLORES)[number];

export const PESTANAS = ['FairPrices', 'Producers', 'Quality', 'Feedback'] as const;
export type PestanaVitrina = (typeof PESTANAS)[number];

export const IMAGENES = ['landingPageImage', 'landingPageBackgroundImage', 'headerBackgroundImage'] as const;
export type Imagen = (typeof IMAGENES)[number];
export const FUENTES = ['productFont', 'textFont'] as const;
export type Fuente = (typeof FUENTES)[number];

export const GRAFICOS = ['DISABLED', 'PER_CONTAINER', 'PER_KG', 'PERCENT_VALUE'] as const;
export type Grafico = (typeof GRAFICOS)[number];

export const PRECIOS = ['containerSize', 'worldMarket', 'fairTrade', 'manualFarmGatePrice', 'averageRegionFarmGatePrice', 'manualProducerPrice'] as const;
export type Precio = (typeof PRECIOS)[number];

export type PuntoRecorrido = { clave: string; lat: number; lng: number };

export type FormVitrina = {
  colores: Record<Color, string>;
  archivos: Record<Imagen | Fuente, ApiDocument | null>;
  pestanas: Record<PestanaVitrina, { activa: boolean; orden: number | null }>;
  graficoProductor: Grafico;
  graficoFinca: Grafico;
  graficoCalidad: boolean;
  precios: Record<Precio, number | null>;
  /** Texto que acompaña al gráfico de ingreso (settings.incomeIncreaseDescription). */
  transparencia: string;
  recorrido: PuntoRecorrido[];
};

/** Lo que tienen en común un producto y el contenido de una etiqueta. */
export type ConVitrina = { businessToCustomerSettings?: ApiBusinessToCustomerSettings; settings?: ApiProductSettings; journeyMarkers?: ApiProductJourneyMarker[] };

let contador = 0;
export const puntoRecorrido = (lng: number, lat: number): PuntoRecorrido => ({ clave: `r${++contador}`, lng, lat });

/**
 * Color tal como lo acepta un selector de color. El backend guarda por defecto el color del título
 * sin "#" ("25265E"): se normaliza para no perderlo.
 */
export function normalizarColor(c?: string | null): string {
  const v = (c ?? '').trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(v)) return '#' + v.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return ('#' + v.slice(1).split('').map((x) => x + x).join('')).toLowerCase();
  return v;
}

const grafico = (g?: string): Grafico => ((GRAFICOS as readonly string[]).includes(g ?? '') ? (g as Grafico) : 'DISABLED');

export function formDesdeVitrina(o: ConVitrina | null): FormVitrina {
  const b = o?.businessToCustomerSettings ?? {};
  return {
    colores: Object.fromEntries(COLORES.map((c) => [c, normalizarColor(b[c])])) as Record<Color, string>,
    archivos: Object.fromEntries([...IMAGENES, ...FUENTES].map((k) => [k, b[k] ?? null])) as FormVitrina['archivos'],
    pestanas: Object.fromEntries(PESTANAS.map((p) => [p, { activa: !!b[`tab${p}`], orden: b[`order${p}`] ?? null }])) as FormVitrina['pestanas'],
    graficoProductor: grafico(b.graphicPriceToProducer),
    graficoFinca: grafico(b.graphicFarmGatePrice),
    graficoCalidad: !!b.graphicQuality,
    precios: Object.fromEntries(PRECIOS.map((k) => [k, b[k] ?? null])) as Record<Precio, number | null>,
    transparencia: o?.settings?.incomeIncreaseDescription ?? '',
    recorrido: (o?.journeyMarkers ?? []).filter((m) => m.latitude != null && m.longitude != null).map((m) => puntoRecorrido(m.longitude!, m.latitude!)),
  };
}

export type ErroresVitrina = Partial<Record<Color | `orden${PestanaVitrina}` | Precio, string>>;

export function validarVitrina(f: FormVitrina): ErroresVitrina {
  const e: ErroresVitrina = {};
  for (const c of COLORES) if (f.colores[c] && !/^#[0-9a-f]{6}$/i.test(f.colores[c])) e[c] = 'color';
  for (const p of PESTANAS) {
    const { activa, orden } = f.pestanas[p];
    if (activa && orden !== null && (Number.isNaN(orden) || !Number.isInteger(orden) || orden < 1)) e[`orden${p}`] = 'orden';
  }
  for (const k of PRECIOS) {
    const v = f.precios[k];
    if (v !== null && (Number.isNaN(v) || v < 0)) e[k] = 'positivo';
  }
  return e;
}

export function armarVitrina<T extends ConVitrina>(f: FormVitrina, original: T): T {
  const b: ApiBusinessToCustomerSettings = { ...(original.businessToCustomerSettings ?? {}) };
  for (const c of COLORES) b[c] = f.colores[c] || undefined;
  for (const k of [...IMAGENES, ...FUENTES]) b[k] = f.archivos[k] ?? undefined;
  for (const p of PESTANAS) {
    b[`tab${p}`] = f.pestanas[p].activa;
    b[`order${p}`] = f.pestanas[p].orden ?? undefined;
  }
  b.graphicPriceToProducer = f.graficoProductor;
  b.graphicFarmGatePrice = f.graficoFinca;
  b.graphicQuality = f.graficoCalidad;
  for (const k of PRECIOS) b[k] = f.precios[k] ?? undefined;
  return {
    ...original,
    businessToCustomerSettings: b,
    settings: { ...(original.settings ?? {}), incomeIncreaseDescription: f.transparencia.trim() || undefined },
    journeyMarkers: f.recorrido.map((p) => ({ latitude: p.lat, longitude: p.lng })),
  };
}

/** Mueve un punto del recorrido una posición hacia arriba (-1) o hacia abajo (+1). */
export function moverPunto<T>(lista: T[], i: number, paso: -1 | 1): T[] {
  const j = i + paso;
  if (j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  return copia;
}
