import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { escala } from '@/util/tablero';

export type Serie = { nombre: string; color: string; valores: (number | null)[] };

const ALTO = 240;
const MARGEN = { arriba: 12, derecha: 8, abajo: 36, izquierda: 56 };
const ANCHO_MIN_GRUPO = 28;

/**
 * Barras agrupadas por período (una barra por serie). Sigue la guía de gráficos: barras finas con
 * el extremo de datos redondeado, 2 px de separación entre barras, cuadrícula y ejes discretos,
 * leyenda desde dos series, tooltip con todas las series del período (también con el teclado) y la
 * misma información en una tabla. Un solo eje: medidas de escalas distintas van en gráficos aparte.
 */
export function Barras({ titulo, periodos, series, formato }: { titulo: string; periodos: string[]; series: Serie[]; formato: (n: number) => string }) {
  const { t } = useTranslation();
  const id = useId();
  const [enTabla, setEnTabla] = useState(false);
  const [activo, setActivo] = useState<number | null>(null);
  // Se dibuja en píxeles reales: el ancho del contenedor (o más, con desplazamiento, si no entra).
  const caja = useRef<HTMLDivElement>(null);
  const [disponible, setDisponible] = useState(640);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setDisponible(Math.floor(el.clientWidth));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [enTabla]);
  const ancho = Math.max(disponible, MARGEN.izquierda + MARGEN.derecha + periodos.length * ANCHO_MIN_GRUPO);
  const maximo = Math.max(0, ...series.flatMap((s) => s.valores.map((v) => v ?? 0)));
  const { tope, paso } = useMemo(() => escala(maximo), [maximo]);
  const marcas = useMemo(() => Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso), [tope, paso]);
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const anchoUtil = ancho - MARGEN.izquierda - MARGEN.derecha;
  const grupo = anchoUtil / Math.max(1, periodos.length);
  const barra = Math.max(2, Math.min(18, (grupo * 0.7 - (series.length - 1) * 2) / series.length));
  const y = (v: number) => MARGEN.arriba + altoUtil - (v / tope) * altoUtil;
  // Etiquetas del eje x: las que entran sin chocar.
  const cadaCuanto = Math.max(1, Math.ceil(64 / grupo));

  if (!periodos.length) return <p className="text-sm text-tinta-3">{t('tablero.sin_datos')}</p>;

  return (
    <figure className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {series.length > 1 ? (
          <ul className="flex flex-wrap gap-4 text-sm text-tinta-2" aria-label={t('tablero.leyenda')}>
            {series.map((s) => (
              <li key={s.nombre} className="inline-flex items-center gap-2">
                <span className="size-3 rounded-sm" style={{ background: s.color }} aria-hidden /> {s.nombre}
              </li>
            ))}
          </ul>
        ) : <span />}
        <button type="button" onClick={() => setEnTabla((v) => !v)} aria-pressed={enTabla} className="text-sm font-semibold text-marca hover:underline">
          {enTabla ? t('tablero.ver_grafico') : t('tablero.ver_tabla')}
        </button>
      </div>

      {enTabla ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label={titulo}>
            <thead className="text-left text-tinta-2">
              <tr>
                <th scope="col" className="py-2 pr-4 font-semibold">{t('tablero.periodo')}</th>
                {series.map((s) => <th key={s.nombre} scope="col" className="py-2 pr-4 text-right font-semibold">{s.nombre}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {periodos.map((p, i) => (
                <tr key={p + i}>
                  <th scope="row" className="py-1.5 pr-4 text-left font-normal">{p}</th>
                  {series.map((s) => <td key={s.nombre} className="py-1.5 pr-4 text-right tabular-nums">{s.valores[i] == null ? '—' : formato(s.valores[i]!)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={caja} className="overflow-x-auto" onPointerLeave={() => setActivo(null)}>
          <div className="relative" style={{ width: ancho }}>
          <svg role="img" aria-labelledby={`${id}-t`} viewBox={`0 0 ${ancho} ${ALTO}`} width={ancho} height={ALTO} className="block max-w-none">
            <title id={`${id}-t`}>{titulo}</title>
            {marcas.map((m) => (
              <g key={m}>
                <line x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={y(m)} y2={y(m)} stroke="var(--linea)" strokeWidth={1} />
                <text x={MARGEN.izquierda - 8} y={y(m)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--tinta-2)">{formato(m)}</text>
              </g>
            ))}
            {periodos.map((p, i) => {
              const x0 = MARGEN.izquierda + i * grupo + (grupo - (barra * series.length + 2 * (series.length - 1))) / 2;
              const texto = `${p}: ${series.map((s) => `${s.nombre} ${s.valores[i] == null ? '—' : formato(s.valores[i]!)}`).join(', ')}`;
              return (
                <g
                  key={p + i}
                  tabIndex={0}
                  role="img"
                  aria-label={texto}
                  onPointerEnter={() => setActivo(i)}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo(null)}
                  className="outline-none focus-visible:[&>rect:first-child]:fill-[var(--marca-suave)]"
                >
                  {/* Zona de toque más grande que las barras. */}
                  <rect x={MARGEN.izquierda + i * grupo} y={MARGEN.arriba} width={grupo} height={altoUtil} fill={activo === i ? 'var(--superficie-2)' : 'transparent'} />
                  {series.map((s, j) => {
                    const v = s.valores[i];
                    if (v == null || v <= 0) return null;
                    const x = x0 + j * (barra + 2);
                    const alto = Math.max(1, (v / tope) * altoUtil);
                    const r = Math.min(4, barra / 2, alto);
                    const base = MARGEN.arriba + altoUtil;
                    // Extremo de datos redondeado, base recta sobre el eje.
                    const d = `M${x},${base} V${base - alto + r} Q${x},${base - alto} ${x + r},${base - alto} H${x + barra - r} Q${x + barra},${base - alto} ${x + barra},${base - alto + r} V${base} Z`;
                    return <path key={s.nombre} d={d} fill={s.color} />;
                  })}
                  {i % cadaCuanto === 0 && (
                    <text x={MARGEN.izquierda + i * grupo + grupo / 2} y={ALTO - MARGEN.abajo + 16} textAnchor="middle" fontSize={11} fill="var(--tinta-2)">{p}</text>
                  )}
                </g>
              );
            })}
            <line x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={MARGEN.arriba + altoUtil} y2={MARGEN.arriba + altoUtil} stroke="var(--tinta-3)" strokeWidth={1} />
          </svg>
          {activo !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-2 z-10 grid min-w-36 gap-1 rounded-lg border border-linea bg-superficie px-3 py-2 text-sm shadow-suave"
              style={{ left: Math.min(Math.max(MARGEN.izquierda + activo * grupo + grupo / 2, 80), ancho - 80), transform: 'translateX(-50%)' }}
            >
              <span className="text-xs text-tinta-3">{periodos[activo]}</span>
              {series.map((s) => (
                <span key={s.nombre} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-tinta-2"><span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />{s.nombre}</span>
                  <strong className="tabular-nums">{s.valores[activo] == null ? '—' : formato(s.valores[activo]!)}</strong>
                </span>
              ))}
            </div>
          )}
          </div>
        </div>
      )}
    </figure>
  );
}
