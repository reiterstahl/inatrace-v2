import { describe, expect, it } from 'vitest';
import type { ApiProduct } from '@/api/gen/types.gen';
import { armarVitrina, formDesdeVitrina, moverPunto, normalizarColor, puntoRecorrido, validarVitrina } from './vitrinaProducto';

const producto: ApiProduct = {
  id: 1,
  name: 'Café',
  settings: { language: 'ES', costBreakdown: true },
  businessToCustomerSettings: { id: 9, primaryColor: '#25265E', productTitleColor: '25265E', tabFairPrices: true, orderFairPrices: 2, tabFeedback: false, graphicPriceToProducer: 'PER_KG', worldMarket: 1.85, productFont: { id: 3, storageKey: 'f', name: 'titulo.woff2' } },
  journeyMarkers: [{ latitude: 15.5, longitude: -91.6 }, { latitude: 14.6, longitude: -90.5 }],
  labels: [{ id: 4, title: 'Tienda' }],
};

describe('vitrina del producto', () => {
  it('normaliza los colores que el backend guarda sin "#"', () => {
    expect(normalizarColor('25265E')).toBe('#25265e');
    expect(normalizarColor('#ABC')).toBe('#aabbcc');
    expect(normalizarColor(undefined)).toBe('');
    const f = formDesdeVitrina(producto);
    expect(f.colores.productTitleColor).toBe('#25265e');
    expect(f.pestanas.FairPrices).toEqual({ activa: true, orden: 2 });
    expect(f.graficoFinca).toBe('DISABLED');
    expect(f.recorrido).toHaveLength(2);
  });

  it('valida colores, posiciones y precios', () => {
    const f = formDesdeVitrina(producto);
    f.colores.textColor = 'rojo';
    f.pestanas.FairPrices.orden = 1.5;
    f.pestanas.Producers = { activa: false, orden: -3 }; // desactivada: no importa
    f.precios.fairTrade = -1;
    expect(validarVitrina(f)).toEqual({ textColor: 'color', ordenFairPrices: 'orden', fairTrade: 'positivo' });
  });

  it('cambia solo los ajustes de la vitrina y conserva el resto del producto', () => {
    const f = formDesdeVitrina(producto);
    f.colores.primaryColor = '#112233';
    f.pestanas.Quality = { activa: true, orden: 3 };
    f.transparencia = '<p>Pagamos 20 % más.</p>';
    f.recorrido = moverPunto(f.recorrido, 1, -1);
    f.recorrido.push(puntoRecorrido(-89.1, 13.7));
    const p = armarVitrina(f, producto);
    expect(p.businessToCustomerSettings).toMatchObject({ id: 9, primaryColor: '#112233', productTitleColor: '#25265e', tabQuality: true, orderQuality: 3, worldMarket: 1.85, productFont: { id: 3, storageKey: 'f', name: 'titulo.woff2' } });
    expect(p.settings).toEqual({ language: 'ES', costBreakdown: true, incomeIncreaseDescription: '<p>Pagamos 20 % más.</p>' });
    expect(p.journeyMarkers).toEqual([{ latitude: 14.6, longitude: -90.5 }, { latitude: 15.5, longitude: -91.6 }, { latitude: 13.7, longitude: -89.1 }]);
    expect(p.labels).toBe(producto.labels);
    expect(p.name).toBe('Café');
  });

  it('mover fuera de los extremos no cambia la lista', () => {
    expect(moverPunto([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moverPunto([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
    expect(moverPunto([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
  });
});
