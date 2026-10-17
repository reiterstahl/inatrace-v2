import type { ApiBusinessToCustomerSettings, ApiQrTagPublic } from '@/api/gen/types.gen';

/**
 * Cálculo de los gráficos de "Precios justos", portado tal cual de la interfaz actual
 * (b2c-fair-prices.component.ts) para que ambas versiones muestren las mismas cifras.
 * Los precios de referencia (mercado mundial, Fairtrade, promedio regional) se cargan en
 * USD por libra; el precio pagado, en USD por kg.
 */

const LIBRA_A_KG = 0.453592;
const ALTO_GRAFICO = 220;

export type Unidad = 'PER_CONTAINER' | 'PER_KG' | 'PERCENT_VALUE';

export type GraficoProductor = {
  unidad: Unidad;
  porcentaje: boolean;
  mundo: number;
  fairtrade: number;
  producto: number;
  alturas: { mundo: number; fairtrade: number; producto: number };
};

export type GraficoFinca = {
  unidad: Unidad;
  /** Precio promedio pagado en la región si no se vende como este producto. */
  promedio: number;
  /** Texto del aumento: "$123" o "+15%". */
  aumento: string;
  alturas: { promedio: number; aumento: number };
};

const activo = (u?: string): u is Unidad => u === 'PER_CONTAINER' || u === 'PER_KG' || u === 'PERCENT_VALUE';

export function graficoProductor(a: ApiBusinessToCustomerSettings, qr: ApiQrTagPublic | null): GraficoProductor | null {
  const unidad = a.graphicPriceToProducer;
  if (!activo(unidad)) return null;
  const mundial = a.worldMarket ?? 0;
  const ft = a.fairTrade ?? 0;
  const contenedor = a.containerSize ?? 0;
  const pagado = qr?.priceToProducer || a.manualProducerPrice || 0;

  let mundo: number, fairtrade: number, producto: number;
  switch (unidad) {
    case 'PER_CONTAINER':
      mundo = Math.ceil((mundial / LIBRA_A_KG) * contenedor);
      fairtrade = Math.ceil((ft / LIBRA_A_KG) * contenedor);
      producto = Math.ceil(pagado * contenedor);
      break;
    case 'PER_KG':
      mundo = Math.ceil(mundial / LIBRA_A_KG);
      fairtrade = Math.ceil(ft / LIBRA_A_KG);
      producto = Math.ceil(pagado);
      break;
    case 'PERCENT_VALUE':
      mundo = 100;
      fairtrade = Math.round((ft / mundial) * 100);
      producto = Math.round((pagado / (mundial / LIBRA_A_KG)) * 100);
      break;
  }

  // Alturas relativas al mercado mundial, normalizadas para que la barra más alta mida ALTO_GRAFICO.
  const base = 40;
  const h = { mundo: base, fairtrade: (base * fairtrade) / mundo, producto: (base * producto) / mundo };
  const escala = ALTO_GRAFICO / Math.max(h.mundo, h.fairtrade, h.producto);
  return {
    unidad,
    porcentaje: unidad === 'PERCENT_VALUE',
    mundo,
    fairtrade,
    producto,
    alturas: { mundo: h.mundo * escala, fairtrade: h.fairtrade * escala, producto: h.producto * escala },
  };
}

export function graficoFinca(a: ApiBusinessToCustomerSettings, qr: ApiQrTagPublic | null): GraficoFinca | null {
  const unidad = a.graphicFarmGatePrice;
  if (!activo(unidad)) return null;
  const regional = a.averageRegionFarmGatePrice ?? 0;
  const contenedor = a.containerSize ?? 0;
  const enFinca = qr?.priceToFarmer || a.manualFarmGatePrice || 0;

  let promedio: number, delProducto: number, aumento: string;
  switch (unidad) {
    case 'PER_CONTAINER':
      promedio = Math.ceil((regional / LIBRA_A_KG) * contenedor);
      delProducto = enFinca * contenedor;
      aumento = '$' + Math.ceil(delProducto);
      break;
    case 'PER_KG':
      promedio = Math.ceil(regional / LIBRA_A_KG);
      delProducto = enFinca;
      aumento = '$' + Math.ceil(delProducto);
      break;
    case 'PERCENT_VALUE':
      promedio = Math.ceil(regional / LIBRA_A_KG);
      delProducto = (enFinca / promedio) * 100 - 100;
      aumento = '+' + Math.round(delProducto) + '%';
      break;
  }

  // La barra del producto se apila sobre la del promedio: el total mide ALTO_GRAFICO.
  const base = 100;
  const altoProducto = unidad === 'PERCENT_VALUE' ? (base * enFinca) / promedio : (base * delProducto) / promedio;
  const escala = ALTO_GRAFICO / altoProducto;
  const altoPromedio = base * escala;
  return {
    unidad,
    promedio,
    aumento,
    alturas: { promedio: altoPromedio, aumento: altoProducto * escala - altoPromedio },
  };
}
