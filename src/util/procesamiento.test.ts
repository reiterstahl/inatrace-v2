import { describe, expect, it } from 'vitest';
import type { ApiFacility, ApiProcessingAction, ApiStockOrder } from '@/api/gen/types.gen';
import {
  accionesDeInstalacion,
  armarOrden,
  convertir,
  rangoEsperado,
  repartirEnSacos,
  sinErrores,
  totalEntrada,
  unidadesDeAccion,
  validar,
  type FormProcesamiento,
  type Salida,
} from './procesamiento';

const kg = { id: 2, code: 'KG', label: 'kg', weight: 1 };
const saco60 = { id: 3, code: 'BAG_60', label: 'Saco (60 kg)', weight: 60 };
const pergamino = { id: 4, name: 'Pergamino', measurementUnitType: kg };
const oro = { id: 5, name: 'Oro', measurementUnitType: kg };

const trillado: ApiProcessingAction = {
  id: 2, name: 'Trillado', type: 'PROCESSING', prefix: 'TR', estimatedOutputQuantityPerUnit: 0.8,
  inputSemiProduct: pergamino, outputSemiProducts: [oro], supportedFacilities: [], requiredEvidenceFields: [],
};
const bodega: ApiFacility = { id: 6, name: 'Bodega', facilitySemiProductList: [pergamino, oro] };

describe('qué acciones ofrece cada instalación', () => {
  it('solo las que procesan algo que la instalación maneja, sin envíos, respetando las instalaciones admitidas', () => {
    const otra: ApiFacility = { id: 9, facilitySemiProductList: [oro] };
    const acciones: ApiProcessingAction[] = [
      trillado,
      { ...trillado, id: 3, type: 'SHIPMENT' },
      { ...trillado, id: 4, supportedFacilities: [{ id: 99 }] },
      { ...trillado, id: 5, type: 'TRANSFER', inputSemiProduct: oro },
    ];
    expect(accionesDeInstalacion(acciones, bodega).map((a) => a.id)).toEqual([2, 5]);
    expect(accionesDeInstalacion(acciones, otra).map((a) => a.id)).toEqual([5]);
  });

  it('procesamiento final sale como producto final; procesamiento, como semiproductos', () => {
    const final = { id: 1, name: 'Saco exportación', measurementUnitType: saco60 };
    expect(unidadesDeAccion({ ...trillado, type: 'FINAL_PROCESSING', outputFinalProduct: final })).toMatchObject({ salidaFinal: final, salidasSemi: [] });
    expect(unidadesDeAccion(trillado)).toMatchObject({ entrada: pergamino, salidaFinal: null, salidasSemi: [oro] });
  });
});

describe('cantidades', () => {
  it('convierte por el peso de cada unidad', () => {
    expect(convertir(2, saco60, kg)).toBe(120);
    expect(convertir(120, kg, saco60)).toBe(2);
  });

  it('rango esperado del trillado: 80 % ±20 %, sin pasar de lo que entra', () => {
    expect(rangoEsperado(trillado, 1000)).toEqual({ desde: 640, hasta: 960 });
    expect(rangoEsperado({ ...trillado, estimatedOutputQuantityPerUnit: 1 }, 100)).toEqual({ desde: 80, hasta: 100 });
    expect(rangoEsperado({ ...trillado, type: 'TRANSFER' }, 1000)).toBeNull();
  });

  it('reparte en sacos de como máximo el peso indicado', () => {
    expect(repartirEnSacos(130, 60)).toEqual([{ numero: 1, cantidad: 60 }, { numero: 2, cantidad: 60 }, { numero: 3, cantidad: 10 }]);
    expect(repartirEnSacos(0, 60)).toEqual([]);
  });
});

const lote = (id: number, disponible: number, extra: Partial<ApiStockOrder> = {}): ApiStockOrder => ({ id, availableQuantity: disponible, semiProduct: pergamino, measureUnitType: kg, ...extra });
const salida = (c: Partial<Salida> = {}): Salida => ({ clave: 's1', semiproducto: 5, productoFinal: null, instalacion: bodega, cantidad: 400, lote: 'TR-001', sacos: null, campos: {}, ...c });
const form = (c: Partial<FormProcesamiento> = {}): FormProcesamiento => ({
  accion: trillado, instalacionEntrada: bodega, fecha: '2026-10-26', existentes: [],
  selecciones: [{ orden: lote(1, 300), cantidad: 300 }, { orden: lote(2, 300), cantidad: 200 }],
  salidas: [salida()], requeridos: [], otros: [], comentarios: '', ...c,
});
const ctx = { unidadDe: () => kg, unidadEntrada: kg };

describe('validación', () => {
  it('una orden completa no tiene errores', () => {
    expect(totalEntrada(form())).toBe(500);
    expect(sinErrores(validar(form(), ctx))).toBe(true);
  });

  it('pide entrada, salida, lote e instalación; no deja sacar más de lo que entra', () => {
    const e = validar(form({ selecciones: [], salidas: [salida({ lote: ' ', instalacion: null, cantidad: 600 })] }), ctx);
    expect(e.generales).toEqual(expect.arrayContaining(['sin_entrada', 'salida_mayor']));
    expect(e.salidas.s1).toMatchObject({ lote: 'requerido', instalacion: 'requerido' });
  });

  it('no deja tomar más de lo disponible de un lote', () => {
    expect(validar(form({ selecciones: [{ orden: lote(1, 100), cantidad: 150 }] }), ctx).generales).toContain('cantidad_entrada');
  });

  it('los sacos tienen que cubrir la cantidad', () => {
    const e = validar(form({ salidas: [salida({ cantidad: 130, sacos: [{ numero: 1, cantidad: 60 }, { numero: 2, cantidad: 60 }] })] }), ctx);
    expect(e.salidas.s1?.sacos).toBe('sacos_no_alcanzan');
  });

  it('los campos de evidencia obligatorios se piden en cada salida', () => {
    const accion = { ...trillado, requiredEvidenceFields: [{ id: 7, fieldName: 'humedad', type: 'NUMBER' as const, mandatory: true }] };
    expect(validar(form({ accion }), ctx).salidas.s1?.campos).toEqual({ humedad: 'requerido' });
  });
});

describe('armado para la API', () => {
  const base = { empresa: 1, usuario: 7, unidadDe: () => kg, nuevoId: () => 'grupo-1' };

  it('procesamiento: una transacción por lote elegido y la salida con lo común', () => {
    const o = armarOrden(form({ comentarios: 'humedad 11 %' }), base);
    expect(o.processingAction).toEqual({ id: 2 });
    expect(o.inputTransactions).toEqual([
      expect.objectContaining({ isProcessing: true, status: 'EXECUTED', inputQuantity: 300, outputQuantity: 300, sourceStockOrder: expect.objectContaining({ id: 1 }) }),
      expect.objectContaining({ inputQuantity: 200, sourceStockOrder: expect.objectContaining({ id: 2 }) }),
    ]);
    expect(o.targetStockOrders).toEqual([
      expect.objectContaining({ orderType: 'PROCESSING_ORDER', internalLotNumber: 'TR-001', totalQuantity: 400, facility: { id: 6 }, semiProduct: { id: 5 }, comments: 'humedad 11 %', fulfilledQuantity: 0, availableQuantity: 0 }),
    ]);
  });

  it('reempaque: una orden por saco, unidas por el mismo origen', () => {
    const o = armarOrden(form({ salidas: [salida({ cantidad: 130, sacos: [{ numero: 1, cantidad: 60 }, { numero: 2, cantidad: 70 }] })] }), base);
    expect(o.targetStockOrders).toHaveLength(2);
    expect(o.targetStockOrders![1]).toMatchObject({ sacNumber: 2, totalQuantity: 70, repackedOriginStockOrderId: 'grupo-1', internalLotNumber: 'TR-001' });
  });

  it('traslado: un lote de salida por cada lote trasladado, numerado', () => {
    const traslado = { ...trillado, type: 'TRANSFER' as const };
    const o = armarOrden(form({ accion: traslado, selecciones: [{ orden: lote(1, 300), cantidad: 300 }, { orden: lote(2, 50), cantidad: 50 }], salidas: [salida({ lote: 'TL-9', cantidad: null })] }), base);
    expect(o.inputTransactions!.every((t) => t.isProcessing === false)).toBe(true);
    expect(o.targetStockOrders).toEqual([
      expect.objectContaining({ orderType: 'TRANSFER_ORDER', internalLotNumber: 'TL-9/1', totalQuantity: 300, semiProduct: { id: 4 } }),
      expect.objectContaining({ internalLotNumber: 'TL-9/2', totalQuantity: 50 }),
    ]);
  });

  it('campos de evidencia con el tipo de valor correcto', () => {
    const accion = { ...trillado, requiredEvidenceFields: [{ id: 7, fieldName: 'humedad', type: 'NUMBER' as const }, { id: 8, fieldName: 'catador', type: 'STRING' as const }] };
    const o = armarOrden(form({ accion, salidas: [salida({ campos: { humedad: '11.5', catador: 'Equipo' } })] }), base);
    expect(o.targetStockOrders![0]!.requiredEvidenceFieldValues).toEqual([
      { evidenceFieldId: 7, evidenceFieldName: 'humedad', numericValue: 11.5 },
      { evidenceFieldId: 8, evidenceFieldName: 'catador', stringValue: 'Equipo' },
    ]);
  });
});

describe('editar: orden guardada → formulario', () => {
  it('agrupa los sacos reempacados en una salida y recupera lote, cantidad y comentarios', async () => {
    const { formularioDesdeOrden } = await import('./procesamiento');
    const comunes = { facility: bodega, semiProduct: oro, comments: 'ok', repackedOriginStockOrderId: 'g1' };
    const f = formularioDesdeOrden(
      {
        id: 50, processingDate: '2026-10-20', inputTransactions: [{ id: 9, sourceFacility: bodega, inputQuantity: 200, outputQuantity: 200, status: 'EXECUTED' }],
        targetStockOrders: [{ id: 61, internalLotNumber: 'TR-1/1', sacNumber: 1, totalQuantity: 60, ...comunes }, { id: 62, internalLotNumber: 'TR-1/2', sacNumber: 2, totalQuantity: 40, ...comunes }],
      },
      trillado,
    );
    expect(f.salidas).toHaveLength(1);
    expect(f.salidas[0]).toMatchObject({ lote: 'TR-1', cantidad: 100, origenReempaque: 'g1', sacos: [{ id: 61, numero: 1, cantidad: 60 }, { id: 62, numero: 2, cantidad: 40 }] });
    expect(f).toMatchObject({ fecha: '2026-10-20', comentarios: 'ok', instalacionEntrada: bodega });
    expect(totalEntrada(f)).toBe(200);
  });
});

describe('pedido a otra empresa (envío)', () => {
  const proveedor: ApiFacility = { id: 6, name: 'Bodega del proveedor', company: { id: 1 } };
  const destino: ApiFacility = { id: 7, name: 'Bodega propia', company: { id: 2 } };
  const envio: ApiProcessingAction = { ...trillado, id: 5, type: 'SHIPMENT', prefix: 'PO', inputSemiProduct: oro, outputSemiProducts: [oro] };
  const pedido = (c: Partial<FormProcesamiento> = {}): FormProcesamiento =>
    form({ accion: envio, instalacionEntrada: proveedor, selecciones: [], salidas: [salida({ semiproducto: 5, instalacion: destino, cantidad: 1000, lote: 'PO-1', entrega: '2026-11-15', numeroOrden: 'OC-77' })], ...c });

  it('se crea sin entradas, pero con proveedor, cantidad y fecha de entrega', () => {
    expect(sinErrores(validar(pedido(), ctx))).toBe(true);
    const e = validar(pedido({ instalacionEntrada: null, salidas: [salida({ cantidad: null, entrega: undefined })] }), ctx);
    expect(e.generales).toContain('sin_proveedor');
    expect(e.salidas.s1).toMatchObject({ cantidad: 'requerido', entrega: 'requerido' });
  });

  it('el proveedor no puede mandar más de lo pedido', () => {
    expect(validar(pedido({ selecciones: [{ orden: lote(9, 2000, { semiProduct: oro }), cantidad: 1200 }] }), ctx).generales).toContain('entrada_mayor_que_pedido');
  });

  it('armado: orden general en la bodega propia, apuntando al proveedor; lo que manda el proveedor queda pendiente', () => {
    const o = armarOrden(pedido({ selecciones: [{ orden: lote(9, 2000, { semiProduct: oro }), cantidad: 400 }] }), { empresa: 1, usuario: 7, unidadDe: () => kg });
    expect(o.targetStockOrders).toEqual([
      expect.objectContaining({ orderType: 'GENERAL_ORDER', facility: { id: 7 }, quoteFacility: { id: 6 }, totalQuantity: 1000, deliveryTime: '2026-11-15', orderId: 'OC-77', fulfilledQuantity: 0 }),
    ]);
    expect(o.inputTransactions).toEqual([expect.objectContaining({ status: 'PENDING', isProcessing: false, inputQuantity: 400 })]);
  });

  it('al editar, el proveedor sale de la orden aunque todavía no haya transacciones', async () => {
    const { formularioDesdeOrden } = await import('./procesamiento');
    const f = formularioDesdeOrden({ id: 3, inputTransactions: [], targetStockOrders: [{ id: 30, quoteFacility: proveedor, facility: destino, semiProduct: oro, totalQuantity: 1000, deliveryTime: '2026-11-15', orderId: 'OC-77', internalLotNumber: 'PO-1' }] }, envio);
    expect(f.instalacionEntrada).toBe(proveedor);
    expect(f.salidas[0]).toMatchObject({ entrega: '2026-11-15', numeroOrden: 'OC-77', cantidad: 1000 });
  });
});
