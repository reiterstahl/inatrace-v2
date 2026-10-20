/** [longitud, latitud] */
export type Punto = [number, number];

const RADIO_TIERRA = 6378137; // metros (WGS84)
const rad = (g: number) => (g * Math.PI) / 180;

/**
 * Superficie de un polígono en metros cuadrados, sobre la esfera (fórmula de Chamberlain y
 * Duquette, la misma que usa Turf). El anillo puede venir abierto o cerrado.
 * Suficiente para mostrar hectáreas aproximadas; no reemplaza una medición catastral.
 */
export function superficieM2(anillo: Punto[]): number {
  const puntos = anillo.length > 1 && anillo[0]![0] === anillo.at(-1)![0] && anillo[0]![1] === anillo.at(-1)![1] ? anillo.slice(0, -1) : anillo;
  if (puntos.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < puntos.length; i++) {
    const [l1, p1] = puntos[i]!;
    const [l2, p2] = puntos[(i + 1) % puntos.length]!;
    total += rad(l2 - l1) * (2 + Math.sin(rad(p1)) + Math.sin(rad(p2)));
  }
  return Math.abs((total * RADIO_TIERRA * RADIO_TIERRA) / 2);
}

export const m2AHectareas = (m2: number) => m2 / 10_000;

/** Cierra el anillo (GeoJSON exige que el último punto repita el primero). */
export function cerrar(anillo: Punto[]): Punto[] {
  if (anillo.length === 0) return anillo;
  const [a, b] = [anillo[0]!, anillo.at(-1)!];
  return a[0] === b[0] && a[1] === b[1] ? anillo : [...anillo, a];
}

/** Abre el anillo (el backend guarda los vértices sin repetir el primero). */
export function abrir(anillo: Punto[]): Punto[] {
  const [a, b] = [anillo[0], anillo.at(-1)];
  return anillo.length > 1 && a && b && a[0] === b[0] && a[1] === b[1] ? anillo.slice(0, -1) : anillo;
}

/** Hectáreas por unidad de superficie conocida. "mz" es la manzana centroamericana (≈ 0,6987 ha). */
const HECTAREAS_POR_UNIDAD: Record<string, number> = { ha: 1, mz: 0.6987, 'm²': 0.0001, m2: 0.0001, acre: 0.404686, ac: 0.404686 };

/** Convierte una superficie a hectáreas; null si la unidad no se conoce. */
export function aHectareas(valor: number, unidad: string): number | null {
  const f = HECTAREAS_POR_UNIDAD[unidad.trim().toLowerCase()];
  return f === undefined || !Number.isFinite(valor) ? null : valor * f;
}

/** ¿La superficie declarada se aparta más de un 20 % de la dibujada? */
export function difiereDeDibujada(declaradaHa: number, dibujadaHa: number, tolerancia = 0.2): boolean {
  return dibujadaHa > 0 && Math.abs(declaradaHa - dibujadaHa) / dibujadaHa > tolerancia;
}
