import { useMemo } from 'react';
import { encode } from 'uqr';

/** Código QR en SVG (dibujado acá, sin insertar HTML), escalable y nítido al imprimir. */
export function CodigoQr({ valor, etiqueta, className = 'size-28' }: { valor: string; etiqueta: string; className?: string }) {
  const { tam, camino } = useMemo(() => {
    const { data, size } = encode(valor, { ecc: 'M', border: 1 });
    let d = '';
    data.forEach((fila, y) => fila.forEach((negro, x) => (d += negro ? `M${x} ${y}h1v1h-1z` : '')));
    return { tam: size, camino: d };
  }, [valor]);
  return (
    <svg viewBox={`0 0 ${tam} ${tam}`} className={className} role="img" aria-label={etiqueta} shapeRendering="crispEdges">
      <rect width={tam} height={tam} fill="#fff" />
      <path d={camino} fill="currentColor" />
    </svg>
  );
}
