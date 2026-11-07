import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Icono } from './Icono';

const menosMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Carrusel con desplazamiento nativo (dedo, rueda, flechas del teclado) y controles propios en vez
 * de la barra de desplazamiento: flechas y un punto por elemento. Sin librerías.
 */
export function Carrusel({ children, etiqueta }: { children: ReactNode; etiqueta: string }) {
  const { t } = useTranslation();
  const pista = useRef<HTMLUListElement>(null);
  const items = Children.toArray(children);
  const total = items.length;
  const [actual, setActual] = useState(0);
  const [bordes, setBordes] = useState({ inicio: true, fin: total <= 1 });

  // El elemento activo es el que quedó alineado a la izquierda (donde se detiene el imán del scroll).
  const medir = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    const margen = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    let cerca = 0;
    let distancia = Infinity;
    [...el.children].forEach((h, k) => {
      const d = Math.abs((h as HTMLElement).offsetLeft - margen - el.scrollLeft);
      if (d < distancia) [cerca, distancia] = [k, d];
    });
    const fin = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    // Al llegar al final, el último visible cuenta como activo aunque no quede alineado.
    setActual(fin ? total - 1 : cerca);
    setBordes({ inicio: el.scrollLeft <= 2, fin });
  }, [total]);

  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    let cuadro = 0;
    const alMover = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(medir);
    };
    medir();
    el.addEventListener('scroll', alMover, { passive: true });
    const obs = new ResizeObserver(alMover);
    obs.observe(el);
    return () => {
      cancelAnimationFrame(cuadro);
      el.removeEventListener('scroll', alMover);
      obs.disconnect();
    };
  }, [medir]);

  const ir = (k: number) => {
    const el = pista.current;
    const destino = el?.children[Math.max(0, Math.min(total - 1, k))] as HTMLElement | undefined;
    if (!el || !destino) return;
    const margen = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    el.scrollTo({ left: destino.offsetLeft - margen, behavior: menosMovimiento() ? 'auto' : 'smooth' });
  };

  const flecha = 'grid size-10 place-items-center rounded-full border border-linea bg-superficie text-tinta shadow-suave transition hover:bg-superficie-2 disabled:pointer-events-none disabled:opacity-35';

  return (
    <div role="region" aria-roledescription={t('vitrina.galeria.carrusel')} aria-label={etiqueta}>
      <ul ref={pista} tabIndex={0} className="relative -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((hijo, k) => (
          <li key={k} aria-roledescription={t('vitrina.galeria.elemento')} aria-label={t('vitrina.galeria.posicion', { n: k + 1, total })} className="w-[78%] shrink-0 snap-start sm:w-[60%]">
            {hijo}
          </li>
        ))}
      </ul>
      {total > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-0.5">
            {items.map((_, k) => (
              <button
                key={k}
                type="button"
                onClick={() => ir(k)}
                aria-label={t('vitrina.galeria.ir', { n: k + 1, total })}
                aria-current={k === actual ? 'true' : undefined}
                className="group grid h-6 place-items-center px-1"
              >
                <span className={clsx('block h-2 rounded-full transition-all duration-300', k === actual ? 'w-6 bg-marca' : 'w-2 bg-linea-fuerte group-hover:bg-tinta-3')} />
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => ir(actual - 1)} disabled={bordes.inicio} aria-label={t('vitrina.galeria.anterior')} className={flecha}>
              <Icono nombre="izquierda" className="size-5" />
            </button>
            <button type="button" onClick={() => ir(actual + 1)} disabled={bordes.fin} aria-label={t('vitrina.galeria.siguiente')} className={flecha}>
              <Icono nombre="derecha" className="size-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
