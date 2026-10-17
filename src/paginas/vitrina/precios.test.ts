import { describe, expect, it } from 'vitest';
import { graficoFinca, graficoProductor } from './precios';

// Referencias en USD/lb: 1,80 mundo y 1,40 Fairtrade; pagado 5 USD/kg; contenedor de 60 kg.
const base = { worldMarket: 1.8, fairTrade: 1.4, containerSize: 60, manualProducerPrice: 5 };

describe('graficoProductor', () => {
  it('no hay gráfico si está deshabilitado o sin configurar', () => {
    expect(graficoProductor({ ...base, graphicPriceToProducer: 'DISABLED' }, null)).toBeNull();
    expect(graficoProductor(base, null)).toBeNull();
  });

  it('por kg: convierte las referencias de libra a kg y redondea hacia arriba', () => {
    const g = graficoProductor({ ...base, graphicPriceToProducer: 'PER_KG' }, null)!;
    expect([g.mundo, g.fairtrade, g.producto]).toEqual([4, 4, 5]); // 1,8/0,4536 = 3,97 → 4
    expect(Math.max(...Object.values(g.alturas))).toBeCloseTo(220);
  });

  it('por contenedor', () => {
    const g = graficoProductor({ ...base, graphicPriceToProducer: 'PER_CONTAINER' }, null)!;
    expect([g.mundo, g.fairtrade, g.producto]).toEqual([239, 186, 300]);
  });

  it('en porcentaje del mercado mundial', () => {
    const g = graficoProductor({ ...base, graphicPriceToProducer: 'PERCENT_VALUE' }, null)!;
    expect(g.porcentaje).toBe(true);
    expect([g.mundo, g.fairtrade, g.producto]).toEqual([100, 78, 126]);
  });

  it('el precio del lote (QR) tiene prioridad sobre el manual', () => {
    const g = graficoProductor({ ...base, graphicPriceToProducer: 'PER_KG' }, { priceToProducer: 7.2 })!;
    expect(g.producto).toBe(8);
  });
});

describe('graficoFinca', () => {
  const finca = { averageRegionFarmGatePrice: 1.2, manualFarmGatePrice: 3.5, containerSize: 60 };

  it('por kg: promedio regional y monto pagado', () => {
    const g = graficoFinca({ ...finca, graphicFarmGatePrice: 'PER_KG' }, null)!;
    expect(g.promedio).toBe(3); // 1,2/0,4536 = 2,65 → 3
    expect(g.aumento).toBe('$4');
    expect(g.alturas.promedio + g.alturas.aumento).toBeCloseTo(220);
  });

  it('en porcentaje: aumento sobre el promedio', () => {
    const g = graficoFinca({ ...finca, graphicFarmGatePrice: 'PERCENT_VALUE' }, null)!;
    expect(g.aumento).toBe('+17%'); // 3,5/3 = 1,1667 → +17 %
  });

  it('deshabilitado', () => {
    expect(graficoFinca({ ...finca, graphicFarmGatePrice: 'DISABLED' }, null)).toBeNull();
  });
});
