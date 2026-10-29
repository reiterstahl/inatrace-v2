import { describe, expect, it } from 'vitest';
import type { ApiFacility, ApiProcessingAction } from '@/api/gen/types.gen';
import { accionesParaInstalacion, armarPedidoCliente, itemNuevo, loteDeItem, pedidoClienteNuevo, sinErroresPedido, validarPedidoCliente, type FormPedidoCliente } from './pedidoCliente';

const tostado = { id: 3, name: 'Café tostado 340 g', measurementUnitType: { label: 'bolsas' } };
const accion = { id: 7, type: 'SHIPMENT', finalProductAction: true, inputFinalProduct: tostado, outputFinalProduct: tostado } as ApiProcessingAction;
const otra = { id: 8, type: 'SHIPMENT', finalProductAction: true, inputFinalProduct: { id: 4, name: 'Otro' } } as ApiProcessingAction;
const bodega = { id: 11, name: 'Bodega', facilityFinalProducts: [{ id: 3 }] } as ApiFacility;

function completo(): FormPedidoCliente {
  return {
    ...pedidoClienteNuevo(),
    numero: ' OC-77 ',
    cliente: { id: 5, name: 'Tostaduría' },
    instalacion: bodega,
    entrega: '2026-12-01',
    items: [{ ...itemNuevo(), accion, proveedor: { id: 6, name: 'Acopio' }, cantidad: 20, precio: 9.5, moneda: 'usd' }],
  };
}

describe('pedido de un cliente', () => {
  it('solo los productos finales que maneja la instalación', () => {
    expect(accionesParaInstalacion([accion, otra], bodega)).toEqual([accion]);
    expect(accionesParaInstalacion([accion, otra], null)).toEqual([]);
  });

  it('obligatorios del pedido y de cada ítem', () => {
    const vacio = validarPedidoCliente(pedidoClienteNuevo());
    expect(vacio).toMatchObject({ numero: 'requerido', cliente: 'requerido', instalacion: 'requerido', entrega: 'requerido' });
    expect(Object.values(vacio.porItem)[0]).toEqual({ accion: 'requerido', proveedor: 'requerido', cantidad: 'requerido', precio: 'requerido', moneda: 'requerido' });
    expect(validarPedidoCliente({ ...completo(), items: [] }).items).toBe('sin_items');
    const f = completo();
    expect(validarPedidoCliente({ ...f, items: [{ ...f.items[0]!, cantidad: 0, precio: -1 }] }).porItem[f.items[0]!.clave]).toEqual({ cantidad: 'positivo', precio: 'rango' });
    expect(sinErroresPedido(validarPedidoCliente(f))).toBe(true);
  });

  it('lote de cada ítem como la versión actual', () => {
    const f = completo();
    expect(loteDeItem(f.numero, f.items[0]!)).toBe('OC-77 (Café tostado 340 g, 20 bolsas)');
    expect(loteDeItem('', f.items[0]!)).toBe('');
  });

  it('armado: una orden general por ítem, sin entradas, para el cliente', () => {
    const p = armarPedidoCliente(completo(), { usuario: 9, hoy: '2026-10-29' });
    expect(p).toMatchObject({ orderId: 'OC-77', deliveryDeadline: '2026-12-01', facility: { id: 11 }, customer: { id: 5 }, requiredOrganic: false });
    expect(p.items).toHaveLength(1);
    expect(p.items![0]).toMatchObject({
      orderType: 'GENERAL_ORDER', creatorId: 9, deliveryTime: '2026-12-01', productionDate: '2026-10-29', finalProduct: { id: 3 },
      facility: { id: 11 }, quoteFacility: { id: 6 }, consumerCompanyCustomer: { id: 5 }, totalQuantity: 20, pricePerUnitForEndCustomer: 9.5,
      currencyForEndCustomer: 'USD', processingOrder: { processingAction: { id: 7 }, initiatorUserId: 9, inputTransactions: [] },
    });
  });
});
