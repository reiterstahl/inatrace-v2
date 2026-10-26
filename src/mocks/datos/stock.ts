import type { ApiCompanyUser, ApiFacility, ApiSemiProduct, ApiStockOrder } from '@/api/gen/types.gen';
import { costo, pesoNeto } from '@/util/entrega';
import { productoresIniciales } from './productores';

const kg = { id: 2, code: 'WEIGHT_KG', label: 'kg', weight: 1 };
export const semiproductos: ApiSemiProduct[] = [
  { id: 3, name: 'Café cereza', measurementUnitType: kg },
  { id: 4, name: 'Café pergamino', measurementUnitType: kg },
];

/** Dos instalaciones: una con todas las opciones de la versión actual activas y otra sin ninguna. */
export const instalaciones: ApiFacility[] = [
  {
    id: 11, name: 'Beneficio Flor de la Sierra', isCollectionFacility: true,
    displayTare: true, displayOrganic: true, displayWomenOnly: true, displayWeightDeductionDamage: true, displayPriceDeductionDamage: true,
    displayPriceDeterminedLater: true, displayMayInvolveCollectors: true, facilitySemiProductList: semiproductos,
  },
  { id: 12, name: 'Centro de acopio El Mirador', isCollectionFacility: true, facilitySemiProductList: [semiproductos[0]!] },
];

export const usuariosEmpresa: ApiCompanyUser[] = [
  { id: 7, name: 'Ana', surname: 'Demo', email: 'demo@inatrace.local', companyRole: 'COMPANY_ADMIN' },
  { id: 8, name: 'Luis', surname: 'Pérez', email: 'luis@inatrace.local', companyRole: 'COMPANY_USER' },
];

export const acopiadores = [{ id: 201, companyId: 1, type: 'COLLECTOR' as const, name: 'Julio', surname: 'Tzul' }];

/** Lo mismo que recalcula el backend al guardar una orden de compra. */
export function recalcular(o: ApiStockOrder): ApiStockOrder {
  const d = { bruto: o.totalGrossQuantity, tara: o.tare, descuentoPeso: o.damagedWeightDeduction, precio: o.pricePerUnit, descuentoPrecio: o.damagedPriceDeduction, precioDespues: o.priceDeterminedLater };
  const total = pesoNeto(d) ?? 0;
  const c = costo(d);
  const pagado = o.paid ?? 0;
  return {
    ...o,
    totalQuantity: total,
    fulfilledQuantity: total,
    availableQuantity: o.availableQuantity ?? total,
    cost: c ?? undefined,
    balance: c === null ? undefined : c - pagado,
    paid: c === null ? undefined : pagado,
    measureUnitType: semiproductos.find((s) => s.id === o.semiProduct?.id)?.measurementUnitType,
    semiProduct: semiproductos.find((s) => s.id === o.semiProduct?.id) ?? o.semiProduct,
    facility: instalaciones.find((f) => f.id === o.facility?.id) ?? o.facility,
    producerUserCustomer: productoresIniciales.find((p) => p.id === o.producerUserCustomer?.id) ?? o.producerUserCustomer,
    purchaseOrder: true,
  };
}

const [maria, pedro, rosa] = productoresIniciales;
export const entregasIniciales: ApiStockOrder[] = [
  { id: 301, identifier: 'PT-López-2026-10-14', orderType: 'PURCHASE_ORDER', facility: { id: 11 }, producerUserCustomer: { id: maria!.id }, semiProduct: { id: 3 }, productionDate: '2026-10-14', creatorId: 7, totalGrossQuantity: 520, tare: 20, pricePerUnit: 1.1, currency: 'USD', womenShare: true, organic: true, preferredWayOfPayment: 'CASH', plots: [{ id: 1001, plotName: 'La Loma' }], paid: 550 },
  { id: 302, identifier: 'PT-Ajcá-2026-10-15', orderType: 'PURCHASE_ORDER', facility: { id: 11 }, producerUserCustomer: { id: pedro!.id }, semiProduct: { id: 3 }, productionDate: '2026-10-15', creatorId: 8, totalGrossQuantity: 830, tare: 30, damagedWeightDeduction: 10, pricePerUnit: 1.1, damagedPriceDeduction: 0.05, currency: 'USD', womenShare: false, organic: false, preferredWayOfPayment: 'BANK_TRANSFER', paid: 200 },
  { id: 303, identifier: 'PT-Cux-2026-10-16', orderType: 'PURCHASE_ORDER', facility: { id: 12 }, producerUserCustomer: { id: rosa!.id }, semiProduct: { id: 3 }, productionDate: '2026-10-16', creatorId: 7, totalGrossQuantity: 300, pricePerUnit: 1.15, currency: 'USD', womenShare: true, preferredWayOfPayment: 'CASH' },
  { id: 304, identifier: 'PT-López-2026-10-18', orderType: 'PURCHASE_ORDER', facility: { id: 11 }, producerUserCustomer: { id: maria!.id }, semiProduct: { id: 4 }, productionDate: '2026-10-18', creatorId: 7, totalGrossQuantity: 120, tare: 2, priceDeterminedLater: true, currency: 'USD', womenShare: true, organic: true, preferredWayOfPayment: 'CHEQUE' },
].map((o) => recalcular(o as ApiStockOrder));

/** Un lote ya procesado, para la vista de stock y la trazabilidad del modo simulado. */
export const loteProcesado: ApiStockOrder = recalcular({
  id: 310, internalLotNumber: 'LOTE-FS-001', orderType: 'PROCESSING_ORDER', facility: { id: 11 },
  semiProduct: { id: 4 }, productionDate: '2026-10-17', totalGrossQuantity: 450,
} as ApiStockOrder);

/** Historia agregada simulada: para un lote procesado, el paso de despulpado y las entregas que lo alimentaron. */
export function historiaDe(id: number): import('@/api/gen/types.gen').ApiStockOrderHistory | null {
  const todas = [...entregasIniciales, loteProcesado];
  const orden = todas.find((o) => o.id === id);
  if (!orden) return null;
  if (orden.orderType === 'PROCESSING_ORDER') {
    const origen = entregasIniciales.filter((e) => e.facility?.id === orden.facility?.id && e.semiProduct?.id === 3);
    return {
      stockOrder: orden,
      outputTransactions: [],
      timelineItems: [
        {
          depth: 0,
          processingOrder: {
            id: 900,
            processingDate: '2026-10-17',
            processingAction: { id: 1, name: 'Despulpado y secado', publicTimelineLabel: 'Despulpado y secado', publicTimelineIconType: 'LEAF', type: 'PROCESSING' },
            targetStockOrders: [orden],
          },
        },
        { depth: 1, purchaseOrders: origen },
      ],
    };
  }
  return { stockOrder: orden, outputTransactions: [], timelineItems: [{ purchaseOrders: [orden] }] };
}

/** Agrupa órdenes por lote/compra, como el listado agrupado del backend. */
export function agrupar(ordenes: ApiStockOrder[]): import('@/api/gen/types.gen').ApiGroupStockOrder[] {
  const grupos = new Map<string, import('@/api/gen/types.gen').ApiGroupStockOrder>();
  for (const o of ordenes) {
    const clave = `${o.internalLotNumber ?? ''}|${o.orderType}|${o.semiProduct?.id ?? ''}`;
    const g = grupos.get(clave);
    if (g) {
      g.groupedIds!.push(o.id!);
      g.totalQuantity = (g.totalQuantity ?? 0) + (o.totalQuantity ?? 0);
      g.availableQuantity = (g.availableQuantity ?? 0) + (o.availableQuantity ?? 0);
    } else {
      grupos.set(clave, {
        groupedIds: [o.id!], internalLotNumber: o.internalLotNumber, orderType: o.orderType, productionDate: o.productionDate,
        semiProductName: o.semiProduct?.name, unitLabel: o.measureUnitType?.label, totalQuantity: o.totalQuantity ?? 0, availableQuantity: o.availableQuantity ?? 0,
      });
    }
  }
  return [...grupos.values()];
}

// ---------- Procesamiento ----------

const cadena = [{ id: 1, name: 'Café' }];
/** Acciones de procesamiento de la cooperativa simulada. */
export const accionesProcesamiento: import('@/api/gen/types.gen').ApiProcessingAction[] = [
  {
    id: 21, name: 'Despulpado y secado', type: 'PROCESSING', prefix: 'DS', estimatedOutputQuantityPerUnit: 0.2,
    inputSemiProduct: semiproductos[0], outputSemiProducts: [semiproductos[1]!], supportedFacilities: [], valueChains: cadena,
    requiredEvidenceFields: [{ id: 31, fieldName: 'humedad', label: 'Humedad (%)', type: 'NUMBER', mandatory: true }],
    requiredDocumentTypes: [],
  },
  {
    id: 22, name: 'Traslado al beneficio', type: 'TRANSFER', prefix: 'TL',
    inputSemiProduct: semiproductos[1], outputSemiProducts: [semiproductos[1]!], supportedFacilities: [], valueChains: cadena,
    requiredEvidenceFields: [], requiredDocumentTypes: [],
  },
];

export const tiposEvidencia = [
  { id: 41, code: 'RECEIPT', label: 'Recibo' },
  { id: 42, code: 'PHOTO', label: 'Fotografía del lote' },
];
