/**
 * Tablero de la empresa: portada de company-dashboard de la versión actual.
 *  - El backend agrupa por día, semana, mes o año; como la versión actual, la agrupación sale del
 *    largo del rango (menos de 7 días: día; de 30: semana; de ~2,5 años: mes; si no, año).
 *  - Devuelve cada período como `unit` (número de semana o de mes, o el día o el año) y `year`.
 *  - El gráfico muestra hasta 24 períodos (como la versión actual); la tabla, todos.
 */
export type Agrupacion = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
export const MAX_PERIODOS = 24;

const DIA = 24 * 3600 * 1000;

export function agrupacionPara(desde: string, hasta: string): Agrupacion {
  const dias = Math.ceil(Math.abs(Date.parse(hasta) - Date.parse(desde)) / DIA);
  if (Number.isNaN(dias)) return 'MONTH';
  if (dias < 7) return 'DAY';
  if (dias < 30) return 'WEEK';
  if (dias < 905) return 'MONTH';
  return 'YEAR';
}

/** «sem. 43 · 2026», «oct 2026», «2026» o el día tal como llega. */
export function etiquetaPeriodo(unidad: string | undefined, anio: number | undefined, agrupacion: Agrupacion, idioma: string, semana: string): string {
  const u = unidad ?? '';
  if (agrupacion === 'WEEK') return `${semana} ${u} · ${anio ?? ''}`.trim();
  if (agrupacion === 'MONTH') {
    const mes = Number(u);
    if (mes >= 1 && mes <= 12 && anio) return new Intl.DateTimeFormat(idioma, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(anio, mes - 1, 1));
  }
  return u || String(anio ?? '');
}

/** El backend no devuelve los períodos en orden: se ordenan por año y luego por mes, semana o día. */
export function ordenarPeriodos<T extends { unit?: string; year?: number }>(lista: T[]): T[] {
  const num = (u?: string) => (u !== undefined && u !== '' && Number.isFinite(Number(u)) ? Number(u) : null);
  return [...lista].sort((a, b) => {
    const anio = (a.year ?? 0) - (b.year ?? 0);
    if (anio) return anio;
    const x = num(a.unit);
    const y = num(b.unit);
    return x !== null && y !== null ? x - y : String(a.unit ?? '').localeCompare(String(b.unit ?? ''));
  });
}

/** Hoy y la misma fecha dos años antes (el rango inicial de la versión actual), como AAAA-MM-DD. */
export function rangoInicial(hoy = new Date()): { desde: string; hasta: string } {
  const f = (d: Date) => d.toISOString().slice(0, 10);
  const antes = new Date(Date.UTC(hoy.getUTCFullYear() - 2, hoy.getUTCMonth(), hoy.getUTCDate()));
  return { desde: f(antes), hasta: f(hoy) };
}

/** Escala «redonda» para el eje: máximo y paso (1, 2 o 5 × 10ⁿ), con 4 o 5 marcas. */
export function escala(maximo: number): { tope: number; paso: number } {
  if (!(maximo > 0)) return { tope: 1, paso: 0.25 };
  const crudo = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= crudo)!;
  return { tope: Math.ceil(maximo / paso) * paso, paso };
}
