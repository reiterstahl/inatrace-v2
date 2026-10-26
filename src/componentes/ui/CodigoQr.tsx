import { useMemo } from 'react';
import { encode } from 'uqr';

/** Módulos del QR como un único camino SVG (cuadrados de 1×1). */
function trazarQr(valor: string) {
  const { data, size } = encode(valor, { ecc: 'M', border: 1 });
  let d = '';
  data.forEach((fila, y) => fila.forEach((negro, x) => (d += negro ? `M${x} ${y}h1v1h-1z` : '')));
  return { tam: size, camino: d };
}

/** El QR como archivo SVG independiente (para descargar e imprimir en otro programa). */
export function svgQr(valor: string, color = '#000'): string {
  const { tam, camino } = trazarQr(valor);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tam} ${tam}" width="${tam * 10}" height="${tam * 10}" shape-rendering="crispEdges"><rect width="${tam}" height="${tam}" fill="#fff"/><path d="${camino}" fill="${color}"/></svg>`;
}

/** Código QR en SVG (dibujado acá, sin insertar HTML), escalable y nítido al imprimir. */
export function CodigoQr({ valor, etiqueta, className = 'size-28' }: { valor: string; etiqueta: string; className?: string }) {
  const { tam, camino } = useMemo(() => trazarQr(valor), [valor]);
  return (
    <svg viewBox={`0 0 ${tam} ${tam}`} className={className} role="img" aria-label={etiqueta} shapeRendering="crispEdges">
      <rect width={tam} height={tam} fill="#fff" />
      <path d={camino} fill="currentColor" />
    </svg>
  );
}
