import { describe, expect, it } from 'vitest';
import { costo, identificadorEntrega, pesoNeto, precioFinal, problemas } from './entrega';

describe('entrega', () => {
  it('peso neto = bruto − tara − descuento por daño', () => {
    expect(pesoNeto({ bruto: 500 })).toBe(500);
    expect(pesoNeto({ bruto: 500, tara: 20 })).toBe(480);
    expect(pesoNeto({ bruto: 500, tara: 20, descuentoPeso: 30 })).toBe(450);
    expect(pesoNeto({})).toBeNull();
  });

  it('costo = (precio − descuento) × neto, como el backend', () => {
    // Entrega real de la demo: 500 kg a 1,10 → 550.
    expect(costo({ bruto: 500, precio: 1.1 })).toBeCloseTo(550, 6);
    expect(costo({ bruto: 500, tara: 20, precio: 1.1, descuentoPrecio: 0.1 })).toBeCloseTo(480, 6);
  });

  it('con precio a definir después no hay costo', () => {
    expect(precioFinal({ precio: 2, precioDespues: true })).toBeNull();
    expect(costo({ bruto: 100, precio: 2, precioDespues: true })).toBeNull();
  });

  it('detecta tara, descuento de peso y de precio imposibles', () => {
    expect(problemas({ bruto: 100, tara: 120 })).toContain('tara_mayor_que_bruto');
    expect(problemas({ bruto: 100, tara: 10, descuentoPeso: 95 })).toContain('descuento_peso_mayor_que_neto');
    expect(problemas({ precio: 1, descuentoPrecio: 1.5 })).toContain('descuento_precio_mayor_que_precio');
    expect(problemas({ bruto: 100, tara: 10, precio: 2, descuentoPrecio: 0.5 })).toEqual([]);
  });

  it('identificador como la interfaz actual', () => {
    expect(identificadorEntrega('López', '2026-10-20')).toBe('PT-López-2026-10-20');
  });
});
