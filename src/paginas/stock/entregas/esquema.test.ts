import { describe, expect, it } from 'vitest';
import type { ApiFacility, ApiStockOrder } from '@/api/gen/types.gen';
import { aApi, aApiMasiva, aDecimal, aFormulario, formasPagoPosibles, validar, validarMasiva, type FormEntrega } from './esquema';

const base = (c: Partial<FormEntrega> = {}): FormEntrega => ({
  ...aFormulario(null, { instalacion: 6, registradoPor: 1, moneda: 'USD', semiproducto: 3 }),
  productor: { id: 9, name: 'Ana', surname: 'Mora' },
  fecha: '2026-10-20',
  bruto: 500,
  precio: 1.1,
  formaPago: 'CASH',
  ...c,
});

describe('aDecimal', () => {
  it('acepta coma decimal, vacío es null y basura es NaN', () => {
    expect(aDecimal('412,5')).toBe(412.5);
    expect(aDecimal(' 2.25 ')).toBe(2.25);
    expect(aDecimal('')).toBeNull();
    expect(aDecimal('12a')).toBeNaN();
  });
});

describe('validar una entrega', () => {
  it('una entrega completa no tiene errores', () => expect(validar(base(), undefined)).toEqual({}));

  it('lo que la instalación activa pasa a ser obligatorio', () => {
    const inst: ApiFacility = { displayTare: true, displayOrganic: true, displayWomenOnly: true, displayWeightDeductionDamage: true, displayPriceDeductionDamage: true };
    expect(validar(base(), inst)).toEqual({ tara: 'requerido', organico: 'requerido', mujeres: 'requerido', descuentoPeso: 'requerido', descuentoPrecio: 'requerido' });
    // Con precio a definir después, el descuento de precio no se pide.
    expect(validar(base({ precioDespues: true, precio: null }), { displayPriceDeductionDamage: true })).toEqual({});
  });

  it('tara mayor que el bruto y descuentos imposibles', () => {
    expect(validar(base({ tara: 600 }), undefined).tara).toBe('tara_mayor_que_bruto');
    expect(validar(base({ tara: 100, descuentoPeso: 450 }), undefined).descuentoPeso).toBe('descuento_peso_mayor_que_neto');
    expect(validar(base({ descuentoPrecio: 2 }), undefined).descuentoPrecio).toBe('descuento_precio_mayor_que_precio');
  });

  it('números: mal escritos, negativos y bruto en cero', () => {
    expect(validar(base({ bruto: NaN }), undefined).bruto).toBe('numero');
    expect(validar(base({ tara: -1 }), undefined).tara).toBe('rango');
    expect(validar(base({ bruto: 0 }), undefined).bruto).toBe('positivo');
  });
});

describe('formas de pago', () => {
  it('efectivo vía acopiador solo con acopiador; desconocida solo sin él', () => {
    expect(formasPagoPosibles(false)).not.toContain('CASH_VIA_COLLECTOR');
    expect(formasPagoPosibles(true)).toContain('CASH_VIA_COLLECTOR');
    expect(formasPagoPosibles(true)).not.toContain('UNKNOWN');
    expect(formasPagoPosibles(true, 'UNKNOWN')).toContain('UNKNOWN'); // la de una entrega vieja se conserva
  });
});

describe('armado para la API', () => {
  it('al crear: identificador y cantidades como la versión actual', () => {
    const o = aApi(base({ tara: 20, parcelas: [4] }), null);
    expect(o).toMatchObject({ orderType: 'PURCHASE_ORDER', identifier: 'PT-Mora-2026-10-20', totalGrossQuantity: 500, tare: 20, totalQuantity: 480, plots: [{ id: 4 }], currency: 'USD', womenShare: false });
  });

  it('al editar parte de la original y no toca el identificador si el productor es el mismo', () => {
    const original: ApiStockOrder = { id: 7, identifier: 'PT-Mora-2026-09-01', orderType: 'PURCHASE_ORDER', producerUserCustomer: { id: 9 }, paid: 100, totalQuantity: 0 };
    const o = aApi(base({ precio: 2 }), original);
    expect(o).toMatchObject({ id: 7, identifier: 'PT-Mora-2026-09-01', paid: 100, pricePerUnit: 2 });
    expect(aApi(base({ productor: { id: 10, surname: 'Solís' } }), original).identifier).toBe('PT-Solís-2026-10-20');
  });

  it('ida y vuelta: una entrega guardada vuelve al formulario igual', () => {
    const f = base({ tara: 5, descuentoPeso: 2, descuentoPrecio: 0.1, organico: 'si', mujeres: 'no', comentarios: 'lote húmedo' });
    const vuelta = aFormulario({ ...aApi(f, null), producerUserCustomer: f.productor! }, {});
    expect(vuelta).toEqual(f);
  });
});

describe('entrega masiva', () => {
  const masiva = {
    instalacion: 6, fecha: '2026-10-20', registradoPor: 1, moneda: 'usd', formaPago: 'CASH' as const, acopiador: null,
    filas: [
      { productor: { id: 1, surname: 'Mora' }, semiproducto: 3, bruto: 101, tara: null, descuentoPeso: null, precio: 3, descuentoPrecio: null, organico: '' as const, mujeres: '' as const },
      { productor: null, semiproducto: 3, bruto: null, tara: null, descuentoPeso: null, precio: 3, descuentoPrecio: null, organico: '' as const, mujeres: 'si' as const },
    ],
  };

  it('los errores quedan en su fila; los comunes, una sola vez', () => {
    const r = validarMasiva({ ...masiva, moneda: '' }, undefined);
    expect(r.comunes).toEqual({ moneda: 'requerido' });
    expect(r.filas).toEqual([{}, { productor: 'requerido', bruto: 'requerido' }]);
  });

  it('cada fila lleva su identificador, neto y pago', () => {
    const p = aApiMasiva({ ...masiva, filas: [masiva.filas[0]!] });
    expect(p.currency).toBe('USD');
    expect(p.farmers).toEqual([expect.objectContaining({ identifier: 'PT-Mora-2026-10-20', totalQuantity: 101, cost: 303, balance: 303, womenShare: false })]);
  });
});
