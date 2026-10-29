import { describe, expect, it } from 'vitest';
import type { ApiStockOrder } from '@/api/gen/types.gen';
import { armarPago, armarPagoAEmpresa, armarPagoMasivo, destinatario, pagaDeMas, pagoMasivoNuevo, pagoAEmpresaNuevo, pagoNuevo, puedePagarse, puedePagarseOrden, sinErroresMasivo, tiposDePago, totalMasivo, validarPago, validarPagoMasivo } from './pago';

const productor = { id: 1, name: 'Ana', surname: 'Mora', bank: { accountNumber: '' } };
const acopiador = { id: 2, name: 'Julio', surname: 'Tzul', bank: { accountNumber: 'GT-123' } };
const entrega = (c: Partial<ApiStockOrder> = {}): ApiStockOrder => ({
  id: 10, orderType: 'PURCHASE_ORDER', cost: 550, balance: 350, currency: 'USD', preferredWayOfPayment: 'CASH', producerUserCustomer: productor, identifier: 'PT-Mora', ...c,
});
const doc = { id: 5, storageKey: 'k', name: 'recibo.pdf' };

describe('pago de una entrega', () => {
  it('solo se paga una compra con precio', () => {
    expect(puedePagarse(entrega())).toBe(true);
    expect(puedePagarse(entrega({ priceDeterminedLater: true, cost: undefined }))).toBe(false);
    expect(puedePagarse(entrega({ orderType: 'PROCESSING_ORDER' }))).toBe(false);
  });

  it('valores por defecto como la versión actual', () => {
    expect(pagoNuevo(entrega())).toMatchObject({ proposito: 'FIRST_INSTALLMENT', tipo: 'CASH', monto: 350, moneda: 'USD', tipoComprobante: 'RECEIPT' });
    // Vía acopiador: transferencia por defecto y el comprobante se elige.
    expect(pagoNuevo(entrega({ preferredWayOfPayment: 'CASH_VIA_COLLECTOR', representativeOfProducerUserCustomer: acopiador }))).toMatchObject({ tipo: 'BANK_TRANSFER', tipoComprobante: '' });
    expect(pagoNuevo(entrega({ balance: 0 })).monto).toBeNull();
  });

  it('efectivo vía acopiador solo con acopiador', () => {
    expect(tiposDePago(false)).not.toContain('CASH_VIA_COLLECTOR');
    expect(tiposDePago(true)).toContain('CASH_VIA_COLLECTOR');
  });

  it('el pago base exige el documento; pagar de más solo se avisa', () => {
    const f = pagoNuevo(entrega());
    expect(validarPago(f)).toEqual({ documento: 'documento_pago_base' });
    expect(validarPago({ ...f, proposito: 'ADVANCE_PAYMENT' })).toEqual({});
    expect(validarPago({ ...f, documento: doc, monto: -1 })).toEqual({ monto: 'rango' });
    expect(pagaDeMas({ ...f, monto: 400 }, entrega())).toBe(true);
  });

  it('armado: destinatario y entrega por id, sin confirmar', () => {
    const p = armarPago({ ...pagoNuevo(entrega()), documento: doc, recibo: ' R-1 ' }, entrega(), 1);
    expect(p).toMatchObject({ stockOrder: { id: 10 }, payingCompany: { id: 1 }, recipientType: 'USER_CUSTOMER', recipientUserCustomer: { id: 1 }, amount: 350, currency: 'USD', receiptNumber: 'R-1', receiptDocument: doc, paymentStatus: 'UNCONFIRMED' });
  });
});

describe('pago a otra empresa por una orden', () => {
  const orden = { id: 9, orderType: 'GENERAL_ORDER', quoteCompany: { id: 50, name: 'La Vecina' } } as ApiStockOrder;
  it('solo órdenes pedidas a otra empresa', () => {
    expect(puedePagarseOrden(orden)).toBe(true);
    expect(puedePagarseOrden({ ...orden, quoteCompany: undefined })).toBe(false);
    expect(puedePagarseOrden({ ...orden, orderType: 'PURCHASE_ORDER' })).toBe(false);
  });
  it('transferencia con recibo; sin monto por defecto; el pago base sigue pidiendo documento', () => {
    const f = pagoAEmpresaNuevo(orden);
    expect(f).toMatchObject({ tipo: 'BANK_TRANSFER', tipoComprobante: 'RECEIPT', monto: null, proposito: '' });
    expect(validarPago({ ...f, proposito: 'FIRST_INSTALLMENT', monto: 10, moneda: 'USD' }).documento).toBe('documento_pago_base');
    expect(validarPago({ ...f, proposito: 'INVOICE_PAYMENT', monto: 10, moneda: 'USD' })).toEqual({});
  });
  it('armado: a la empresa proveedora', () => {
    const p = armarPagoAEmpresa({ ...pagoAEmpresaNuevo(orden), proposito: 'INVOICE_PAYMENT', monto: 120, moneda: 'usd' }, orden, 1);
    expect(p).toMatchObject({ recipientType: 'COMPANY', recipientCompany: { id: 50 }, payingCompany: { id: 1 }, stockOrder: { id: 9 }, paymentType: 'BANK_TRANSFER', currency: 'USD', paymentStatus: 'UNCONFIRMED' });
    expect(p.recipientUserCustomer).toBeUndefined();
  });
});

describe('pago masivo', () => {
  it('se transfiere al acopiador si la entrega se paga vía acopiador', () => {
    expect(destinatario(entrega()).persona?.id).toBe(1);
    expect(destinatario(entrega({ preferredWayOfPayment: 'CASH_VIA_COLLECTOR', representativeOfProducerUserCustomer: acopiador })).persona?.id).toBe(2);
  });

  it('cada entrega con su saldo; las de precio a definir quedan fuera', () => {
    const f = pagoMasivoNuevo([entrega(), entrega({ id: 11, balance: 100 }), entrega({ id: 12, priceDeterminedLater: true })]);
    expect(f.filas.map((x) => [x.entrega.id, x.monto])).toEqual([[10, 350], [11, 100]]);
    expect(totalMasivo(f)).toBe(450);
  });

  it('no se puede transferir a quien no tiene cuenta; pide descripción y recibo; una sola moneda', () => {
    const f = pagoMasivoNuevo([entrega(), entrega({ id: 11, currency: 'GTQ' })]);
    const e = validarPagoMasivo(f);
    expect(e.generales).toEqual(expect.arrayContaining(['sin_cuenta', 'monedas_distintas']));
    expect(e).toMatchObject({ descripcion: 'requerido', recibo: 'requerido' });
    const conCuenta = pagoMasivoNuevo([entrega({ preferredWayOfPayment: 'CASH_VIA_COLLECTOR', representativeOfProducerUserCustomer: acopiador })]);
    expect(sinErroresMasivo(validarPagoMasivo({ ...conCuenta, descripcion: 'Octubre', recibo: 'L-1' }))).toBe(true);
    expect(validarPagoMasivo({ ...conCuenta, descripcion: 'x', recibo: 'y', costoAdicional: 10 }).descripcionCosto).toBe('requerido');
  });

  it('armado: transferencias sin confirmar y la lista de documentos siempre presente', () => {
    const f = { ...pagoMasivoNuevo([entrega()]), descripcion: 'Octubre', recibo: 'L-1' };
    const p = armarPagoMasivo(f, 1, 'USD');
    expect(p).toMatchObject({ payingCompany: { id: 1 }, paymentDescription: 'Octubre', receiptNumber: 'L-1', totalAmount: 350, currency: 'USD', additionalProofs: [] });
    expect(p.payments).toEqual([expect.objectContaining({ paymentType: 'BANK_TRANSFER', amount: 350, stockOrder: { id: 10 }, paymentStatus: 'UNCONFIRMED' })]);
  });
});
