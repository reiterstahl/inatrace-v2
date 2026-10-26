/**
 * Reglas de los pagos a productores, portadas de la interfaz actual (stock-payments) y alineadas con
 * PaymentService del backend:
 *  - un pago se crea para una entrega con precio (no "a definir");
 *  - una vez creado no se edita: solo se puede confirmar (y la confirmación no se deshace) o borrar;
 *  - el pago base (FIRST_INSTALLMENT) exige el documento de respaldo, salvo dentro de un pago masivo;
 *  - el backend toma productor, acopiador, empresa que paga y forma de pago preferida de la entrega,
 *    e ignora el "monto pagado al acopiador" (lo guarda en 0): cuenta solo el monto.
 */
import type { ApiActivityProof, ApiBulkPayment, ApiDocument, ApiPayment, ApiStockOrder, ApiUserCustomer } from '@/api/gen/types.gen';

export type TipoPago = NonNullable<ApiPayment['paymentType']>;
export type Proposito = NonNullable<ApiPayment['paymentPurposeType']>;
export type TipoComprobante = NonNullable<ApiPayment['receiptDocumentType']>;

export const PROPOSITOS: Proposito[] = ['FIRST_INSTALLMENT', 'ADVANCE_PAYMENT', 'SECOND_INSTALLMENT', 'WOMEN_PREMIUM', 'INVOICE_PAYMENT'];

/** Tipos de pago que ofrece la versión actual: "efectivo vía acopiador" solo si la entrega tiene acopiador. */
export function tiposDePago(conAcopiador: boolean): TipoPago[] {
  return conAcopiador ? ['CASH', 'BANK_TRANSFER', 'CASH_VIA_COLLECTOR', 'CHEQUE', 'OFFSETTING'] : ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OFFSETTING'];
}

/** Una entrega se puede pagar si es una compra con precio. */
export const puedePagarse = (e: ApiStockOrder) => e.orderType === 'PURCHASE_ORDER' && !e.priceDeterminedLater && typeof e.cost === 'number';

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------- Pago de una entrega ----------

export type FormPago = {
  fecha: string;
  proposito: Proposito | '';
  tipo: TipoPago | '';
  monto: number | null;
  moneda: string;
  recibo: string;
  tipoComprobante: TipoComprobante | '';
  documento: ApiDocument | null;
};

export function pagoNuevo(e: ApiStockOrder): FormPago {
  const conAcopiador = !!e.representativeOfProducerUserCustomer?.id;
  const preferida = e.preferredWayOfPayment;
  // Como la versión actual: si se paga vía acopiador, por defecto es una transferencia.
  const tipo: TipoPago | '' =
    preferida === 'CASH_VIA_COLLECTOR' ? 'BANK_TRANSFER' : preferida && (tiposDePago(conAcopiador) as string[]).includes(preferida) ? (preferida as TipoPago) : '';
  return {
    fecha: hoy(),
    proposito: 'FIRST_INSTALLMENT',
    tipo,
    monto: (e.balance ?? 0) > 0 ? Number(e.balance!.toFixed(2)) : null,
    moneda: e.currency ?? '',
    recibo: '',
    // Sin acopiador, el comprobante es siempre un recibo; con acopiador puede ser también la hoja de compra.
    tipoComprobante: conAcopiador ? '' : 'RECEIPT',
    documento: null,
  };
}

export type ErroresPago = Partial<Record<keyof FormPago, string>>;

export function validarPago(f: FormPago): ErroresPago {
  const e: ErroresPago = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) e.fecha = 'requerido';
  if (!f.proposito) e.proposito = 'requerido';
  if (!f.tipo) e.tipo = 'requerido';
  if (f.monto === null) e.monto = 'requerido';
  else if (Number.isNaN(f.monto)) e.monto = 'numero';
  else if (f.monto < 0) e.monto = 'rango';
  if (!f.moneda.trim()) e.moneda = 'requerido';
  if (f.proposito === 'FIRST_INSTALLMENT' && !f.documento) e.documento = 'documento_pago_base';
  return e;
}

/** Pagar más que el saldo no es un error (el backend lo acepta), pero se avisa. */
export const pagaDeMas = (f: FormPago, e: ApiStockOrder) => f.monto !== null && typeof e.balance === 'number' && f.monto > e.balance + 1e-9;

export function armarPago(f: FormPago, e: ApiStockOrder, empresa: number): ApiPayment {
  return {
    stockOrder: { id: e.id } as ApiStockOrder,
    payingCompany: { id: empresa } as ApiPayment['payingCompany'],
    recipientType: 'USER_CUSTOMER',
    recipientUserCustomer: e.producerUserCustomer ? ({ id: e.producerUserCustomer.id } as ApiUserCustomer) : undefined,
    representativeOfRecipientUserCustomer: e.representativeOfProducerUserCustomer ? ({ id: e.representativeOfProducerUserCustomer.id } as ApiUserCustomer) : undefined,
    preferredWayOfPayment: e.preferredWayOfPayment,
    formalCreationTime: f.fecha,
    paymentPurposeType: f.proposito || undefined,
    paymentType: f.tipo || undefined,
    amount: f.monto ?? undefined,
    currency: f.moneda.trim().toUpperCase(),
    receiptNumber: f.recibo.trim() || undefined,
    receiptDocumentType: f.tipoComprobante || undefined,
    receiptDocument: f.documento ?? undefined,
    paymentStatus: 'UNCONFIRMED',
  };
}

// ---------- Pago masivo (transferencia bancaria por lotes) ----------

/** A quién se le transfiere: al acopiador si la entrega se paga vía acopiador, si no al productor. */
export function destinatario(e: ApiStockOrder): { persona: ApiUserCustomer | undefined; esAcopiador: boolean } {
  const viaAcopiador = e.preferredWayOfPayment === 'CASH_VIA_COLLECTOR' && !!e.representativeOfProducerUserCustomer;
  return { persona: viaAcopiador ? e.representativeOfProducerUserCustomer : e.producerUserCustomer, esAcopiador: viaAcopiador };
}

export const tieneCuenta = (p?: ApiUserCustomer) => !!p?.bank?.accountNumber?.trim();

/** Tipos de documento adicional de un pago masivo (los mismos que ofrece la versión actual). */
export const TIPOS_DOCUMENTO_MASIVO = ['PAYMENT_PROOF', 'PAYMENT_LIST', 'PAYMENT_ORDER_APPROVED', 'PURCHASE_SHEET', 'PURCHASE_SHEET_BANK_TRANSFER', 'PURCHASE_SHEET_COLLECTOR', 'RECEIPT', 'RECEIPT_BANK_TRANSFER', 'RECEIPT_COLLECTOR'] as const;

export type FilaMasivo = { entrega: ApiStockOrder; monto: number | null };

export type FormPagoMasivo = {
  fecha: string;
  proposito: Proposito | '';
  descripcion: string;
  recibo: string;
  costoAdicional: number | null;
  descripcionCosto: string;
  documentos: { tipo: (typeof TIPOS_DOCUMENTO_MASIVO)[number]; fecha: string; documento: ApiDocument }[];
  filas: FilaMasivo[];
};

export function pagoMasivoNuevo(entregas: ApiStockOrder[]): FormPagoMasivo {
  return {
    fecha: hoy(),
    proposito: 'FIRST_INSTALLMENT',
    descripcion: '',
    recibo: '',
    costoAdicional: null,
    descripcionCosto: '',
    documentos: [],
    filas: entregas.filter(puedePagarse).map((entrega) => ({ entrega, monto: (entrega.balance ?? 0) > 0 ? Number(entrega.balance!.toFixed(2)) : 0 })),
  };
}

export type ErroresMasivo = { generales: string[]; filas: Record<number, string> } & Partial<Record<'fecha' | 'proposito' | 'descripcion' | 'recibo' | 'costoAdicional' | 'descripcionCosto', string>>;

export function validarPagoMasivo(f: FormPagoMasivo): ErroresMasivo {
  const e: ErroresMasivo = { generales: [], filas: {} };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) e.fecha = 'requerido';
  if (!f.proposito) e.proposito = 'requerido';
  if (!f.descripcion.trim()) e.descripcion = 'requerido';
  if (!f.recibo.trim()) e.recibo = 'requerido';
  if (f.costoAdicional !== null) {
    if (Number.isNaN(f.costoAdicional)) e.costoAdicional = 'numero';
    else if (f.costoAdicional < 0) e.costoAdicional = 'rango';
    else if (!f.descripcionCosto.trim()) e.descripcionCosto = 'requerido';
  }
  if (f.filas.length === 0) e.generales.push('sin_entregas');
  for (const x of f.filas) {
    if (x.monto === null) e.filas[x.entrega.id!] = 'requerido';
    else if (Number.isNaN(x.monto)) e.filas[x.entrega.id!] = 'numero';
    else if (x.monto < 0) e.filas[x.entrega.id!] = 'rango';
  }
  // Un pago masivo lleva una sola moneda.
  if (new Set(f.filas.map((x) => x.entrega.currency ?? '')).size > 1) e.generales.push('monedas_distintas');
  // Como la versión actual: no se puede mandar una transferencia a quien no tiene cuenta.
  if (f.filas.some((x) => !tieneCuenta(destinatario(x.entrega).persona))) e.generales.push('sin_cuenta');
  return e;
}

export const sinErroresMasivo = (e: ErroresMasivo) =>
  e.generales.length === 0 && Object.keys(e.filas).length === 0 && !Object.entries(e).some(([k, v]) => k !== 'generales' && k !== 'filas' && v);

/** Moneda del pago masivo: la de la empresa, o la de las entregas si la empresa no tiene una definida. */
export const monedaMasivo = (f: FormPagoMasivo, deEmpresa?: string | null) => deEmpresa || f.filas[0]?.entrega.currency || '';

export const totalMasivo = (f: FormPagoMasivo) => f.filas.reduce((s, x) => s + (typeof x.monto === 'number' && Number.isFinite(x.monto) ? x.monto : 0), 0);

export function armarPagoMasivo(f: FormPagoMasivo, empresa: number, moneda: string): ApiBulkPayment {
  return {
    payingCompany: { id: empresa } as ApiBulkPayment['payingCompany'],
    formalCreationTime: f.fecha,
    paymentPurposeType: f.proposito || undefined,
    paymentDescription: f.descripcion.trim(),
    receiptNumber: f.recibo.trim(),
    currency: moneda,
    totalAmount: totalMasivo(f),
    additionalCost: f.costoAdicional ?? undefined,
    additionalCostDescription: f.costoAdicional !== null ? f.descripcionCosto.trim() : undefined,
    // Siempre una lista: el backend la recorre sin comprobar si viene.
    additionalProofs: f.documentos.map((d) => ({ type: d.tipo, formalCreationDate: d.fecha, document: d.documento }) as ApiActivityProof),
    payments: f.filas.map((x) => ({
      stockOrder: { id: x.entrega.id } as ApiStockOrder,
      payingCompany: { id: empresa } as ApiPayment['payingCompany'],
      recipientType: 'USER_CUSTOMER',
      recipientUserCustomer: x.entrega.producerUserCustomer ? ({ id: x.entrega.producerUserCustomer.id } as ApiUserCustomer) : undefined,
      representativeOfRecipientUserCustomer: x.entrega.representativeOfProducerUserCustomer ? ({ id: x.entrega.representativeOfProducerUserCustomer.id } as ApiUserCustomer) : undefined,
      preferredWayOfPayment: x.entrega.preferredWayOfPayment,
      formalCreationTime: f.fecha,
      paymentPurposeType: f.proposito || undefined,
      paymentType: 'BANK_TRANSFER',
      amount: x.monto ?? 0,
      currency: moneda,
      receiptNumber: f.recibo.trim(),
      paymentStatus: 'UNCONFIRMED',
    })),
  };
}
