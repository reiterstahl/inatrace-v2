/**
 * Pedido de un cliente (orden de producto), portado de add-customer-order de la versión actual y
 * alineado con ProductOrderService del backend:
 *  - número de orden, cliente, instalación que recibe y fecha límite son obligatorios;
 *  - al menos un ítem; cada ítem es un producto final (acción de envío de producto final que la
 *    instalación maneja), a quién se le pide, cantidad, precio al cliente y moneda;
 *  - cada ítem se guarda como una orden general con su orden de procesamiento sin entradas: la
 *    completa después el proveedor, como cualquier pedido entre empresas.
 */
import type { ApiCompanyCustomer, ApiFacility, ApiProcessingAction, ApiProductOrder, ApiStockOrder } from '@/api/gen/types.gen';

export type ItemPedido = {
  clave: string;
  accion: ApiProcessingAction | null;
  proveedor: ApiFacility | null;
  cantidad: number | null;
  precio: number | null;
  moneda: string;
};

export type FormPedidoCliente = {
  numero: string;
  cliente: ApiCompanyCustomer | null;
  instalacion: ApiFacility | null;
  entrega: string;
  soloMujeres: boolean;
  soloOrganico: boolean;
  items: ItemPedido[];
};

let contador = 0;
export const itemNuevo = (): ItemPedido => ({ clave: `i${++contador}`, accion: null, proveedor: null, cantidad: null, precio: null, moneda: '' });

export const pedidoClienteNuevo = (): FormPedidoCliente => ({
  numero: '',
  cliente: null,
  instalacion: null,
  entrega: '',
  soloMujeres: false,
  soloOrganico: false,
  items: [itemNuevo()],
});

/** Productos finales que se pueden pedir para una instalación: los que ella maneja. */
export const accionesParaInstalacion = (acciones: ApiProcessingAction[], instalacion: ApiFacility | null) =>
  !instalacion ? [] : acciones.filter((a) => (instalacion.facilityFinalProducts ?? []).some((f) => f.id === a.inputFinalProduct?.id));

type ErrorItem = Partial<Record<'accion' | 'proveedor' | 'cantidad' | 'precio' | 'moneda', string>>;
export type ErroresPedidoCliente = Partial<Record<'numero' | 'cliente' | 'instalacion' | 'entrega' | 'items', string>> & { porItem: Record<string, ErrorItem> };

export function validarPedidoCliente(f: FormPedidoCliente): ErroresPedidoCliente {
  const e: ErroresPedidoCliente = { porItem: {} };
  if (!f.numero.trim()) e.numero = 'requerido';
  if (!f.cliente) e.cliente = 'requerido';
  if (!f.instalacion) e.instalacion = 'requerido';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.entrega)) e.entrega = 'requerido';
  if (!f.items.length) e.items = 'sin_items';
  for (const i of f.items) {
    const ei: ErrorItem = {};
    if (!i.accion) ei.accion = 'requerido';
    if (!i.proveedor) ei.proveedor = 'requerido';
    if (i.cantidad === null) ei.cantidad = 'requerido';
    else if (!(i.cantidad > 0)) ei.cantidad = 'positivo';
    if (i.precio === null) ei.precio = 'requerido';
    else if (Number.isNaN(i.precio) || i.precio < 0) ei.precio = 'rango';
    if (!/^[A-Za-z]{3}$/.test(i.moneda.trim())) ei.moneda = 'requerido';
    if (Object.keys(ei).length) e.porItem[i.clave] = ei;
  }
  return e;
}

export const sinErroresPedido = (e: ErroresPedidoCliente) => Object.keys(e).filter((k) => k !== 'porItem').length === 0 && Object.keys(e.porItem).length === 0;

/** Nombre del lote de cada ítem, como la versión actual: "OC-1 (Café tostado, 20 bolsas)". */
export function loteDeItem(numero: string, i: ItemPedido): string {
  const final = i.accion?.inputFinalProduct;
  if (!numero.trim() || !final || i.cantidad === null) return '';
  return `${numero.trim()} (${final.name}, ${i.cantidad} ${final.measurementUnitType?.label ?? ''})`.replace(' )', ')');
}

export function armarPedidoCliente(f: FormPedidoCliente, ctx: { usuario: number; hoy: string }): ApiProductOrder {
  const instalacion = { id: f.instalacion!.id } as ApiFacility;
  const cliente = { id: f.cliente!.id } as ApiCompanyCustomer;
  return {
    orderId: f.numero.trim(),
    deliveryDeadline: f.entrega,
    requiredWomensOnly: f.soloMujeres,
    requiredOrganic: f.soloOrganico,
    facility: instalacion,
    customer: cliente,
    items: f.items.map(
      (i): ApiStockOrder => ({
        creatorId: ctx.usuario,
        orderType: 'GENERAL_ORDER',
        deliveryTime: f.entrega,
        productionDate: ctx.hoy,
        consumerCompanyCustomer: cliente,
        finalProduct: { id: i.accion!.inputFinalProduct!.id } as ApiStockOrder['finalProduct'],
        facility: instalacion,
        quoteFacility: { id: i.proveedor!.id } as ApiFacility,
        totalQuantity: i.cantidad!,
        fulfilledQuantity: 0,
        availableQuantity: 0,
        pricePerUnitForEndCustomer: i.precio!,
        currencyForEndCustomer: i.moneda.trim().toUpperCase(),
        internalLotNumber: loteDeItem(f.numero, i),
        processingOrder: { processingAction: { id: i.accion!.id } as ApiProcessingAction, initiatorUserId: ctx.usuario, inputTransactions: [] },
      }),
    ),
  };
}
