/**
 * Reglas de las órdenes de procesamiento, portadas de la interfaz actual
 * (stock-processing-order-details y sus componentes de entrada y salida) y alineadas con lo que
 * valida ProcessingOrderService en el backend.
 */
import type {
  ApiDocument,
  ApiFacility,
  ApiMeasureUnitType,
  ApiProcessingAction,
  ApiProcessingEvidenceField,
  ApiProcessingOrder,
  ApiStockOrder,
  ApiStockOrderEvidenceFieldValue,
  ApiStockOrderEvidenceTypeValue,
  ApiTransaction,
} from '@/api/gen/types.gen';

export type TipoAccion = NonNullable<ApiProcessingAction['type']>;

/** Tipos que se manejan en la pestaña de procesamiento. Los envíos (SHIPMENT) son cotizaciones: van con órdenes. */
export const TIPOS_PROCESAMIENTO: TipoAccion[] = ['PROCESSING', 'FINAL_PROCESSING', 'TRANSFER', 'GENERATE_QR_CODE'];

/** Acciones que se pueden iniciar en una instalación: procesan algo que esa instalación maneja. */
export function accionesDeInstalacion(acciones: ApiProcessingAction[], instalacion: ApiFacility): ApiProcessingAction[] {
  return acciones.filter((a) => {
    if (!a.type || !TIPOS_PROCESAMIENTO.includes(a.type)) return false;
    const soportadas = a.supportedFacilities ?? [];
    if (soportadas.length > 0 && !soportadas.some((f) => f.id === instalacion.id)) return false;
    const semi = a.inputSemiProduct?.id;
    const final = a.inputFinalProduct?.id;
    return (
      (!!semi && (instalacion.facilitySemiProductList ?? []).some((s) => s.id === semi)) ||
      (!!final && (instalacion.facilityFinalProducts ?? []).some((f) => f.id === final))
    );
  });
}

/** Qué entra y qué sale según el tipo de acción. */
export function unidadesDeAccion(a: ApiProcessingAction) {
  const conFinal = a.type === 'FINAL_PROCESSING' || ((a.type === 'TRANSFER' || a.type === 'SHIPMENT') && a.finalProductAction);
  const entrada = a.type === 'TRANSFER' && a.finalProductAction ? a.inputFinalProduct : a.inputSemiProduct;
  return {
    entrada: entrada ?? a.inputFinalProduct ?? null,
    salidaFinal: conFinal ? (a.outputFinalProduct ?? null) : null,
    salidasSemi: conFinal ? [] : (a.outputSemiProducts ?? []),
  };
}

/** Solo el procesamiento admite varias salidas; los demás tipos producen un único lote. */
export const variasSalidas = (tipo?: TipoAccion | null) => tipo === 'PROCESSING';

// ---------- Cantidades ----------

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Pasa una cantidad de una unidad a otra usando el peso en kg de cada una (como la interfaz actual). */
export function convertir(cantidad: number, de?: ApiMeasureUnitType | null, a?: ApiMeasureUnitType | null): number {
  if (!de?.weight || !a?.weight) return cantidad;
  return (cantidad * de.weight) / a.weight;
}

/** Rango esperado de salida de un procesamiento: rendimiento estimado ±20 %, sin pasar de lo que entra. */
export function rangoEsperado(accion: ApiProcessingAction, totalEntrada: number): { desde: number; hasta: number } | null {
  if (accion.type !== 'PROCESSING' || !accion.estimatedOutputQuantityPerUnit || !totalEntrada) return null;
  const esperado = totalEntrada * accion.estimatedOutputQuantityPerUnit;
  return { desde: esperado * 0.8, hasta: Math.min(esperado * 1.2, totalEntrada) };
}

/** Reparte una cantidad en sacos de como máximo `maximo` cada uno. */
export function repartirEnSacos(total: number, maximo: number): { numero: number; cantidad: number }[] {
  if (!(total > 0) || !(maximo > 0)) return [];
  const sacos: { numero: number; cantidad: number }[] = [];
  let resto = total;
  for (let i = 1; resto > 1e-9; i++) {
    const c = Math.min(maximo, resto);
    sacos.push({ numero: i, cantidad: Number(c.toFixed(2)) });
    resto -= c;
  }
  return sacos;
}

// ---------- Modelo del formulario ----------

/** Un lote de entrada elegido y cuánto se toma de él. */
export type Seleccion = { orden: ApiStockOrder; cantidad: number };

export type Saco = { numero: number | null; cantidad: number | null; id?: number };

export type Salida = {
  clave: string;
  /** Orden de stock existente (al editar). */
  original?: ApiStockOrder;
  semiproducto: number | null;
  productoFinal: number | null;
  instalacion: ApiFacility | null;
  cantidad: number | null;
  lote: string;
  /** Solo si el semiproducto (o la acción, con productos finales) se reempaca en sacos. */
  sacos: Saco[] | null;
  /** Valores de los campos de evidencia que pide la acción, por nombre de campo. */
  campos: Record<string, string | number | null>;
  /** Pedidos (envío): fecha de entrega pedida y número de orden del comprador. */
  entrega?: string;
  numeroOrden?: string;
  /** Al editar un lote reempacado: el identificador que agrupa sus sacos. */
  origenReempaque?: string;
};

export type DocumentoEvidencia = { tipoId: number; tipoCodigo: string; tipoEtiqueta?: string; obligatorio?: boolean; fecha: string; documento: ApiDocument | null };

export type FormProcesamiento = {
  accion: ApiProcessingAction;
  instalacionEntrada: ApiFacility | null;
  fecha: string;
  /** Transacciones que la orden ya tenía (al editar). */
  existentes: ApiTransaction[];
  selecciones: Seleccion[];
  salidas: Salida[];
  requeridos: DocumentoEvidencia[];
  otros: DocumentoEvidencia[];
  comentarios: string;
};

/** Cuánto entra: lo elegido más lo que ya tenía la orden (sin las transacciones canceladas). */
export function totalEntrada(f: Pick<FormProcesamiento, 'existentes' | 'selecciones'>): number {
  const ya = f.existentes.filter((t) => t.status !== 'CANCELED').reduce((s, t) => s + n(t.outputQuantity ?? t.inputQuantity), 0);
  return ya + f.selecciones.reduce((s, x) => s + n(x.cantidad), 0);
}

/** Total que sale, expresado en la unidad de lo que entra. */
export function totalSalida(salidas: Salida[], unidadDe: (s: Salida) => ApiMeasureUnitType | null | undefined, unidadEntrada?: ApiMeasureUnitType | null): number {
  return salidas.reduce((s, x) => s + convertir(n(x.cantidad), unidadDe(x), unidadEntrada), 0);
}

export const maximoSaco = (accion: ApiProcessingAction, semi?: { repackedOutput?: boolean; maxOutputWeight?: number } | null) =>
  accion.repackedOutputFinalProducts ? (accion.maxOutputWeight ?? null) : semi?.repackedOutput ? (semi.maxOutputWeight ?? null) : null;

// ---------- Validación ----------

export type ErroresProcesamiento = {
  generales: string[];
  salidas: Record<string, Partial<Record<'semiproducto' | 'instalacion' | 'cantidad' | 'lote' | 'sacos' | 'entrega', string>> & { campos?: Record<string, string> }>;
  requeridos: Record<number, string>;
};

export function validar(
  f: FormProcesamiento,
  ctx: { unidadDe: (s: Salida) => ApiMeasureUnitType | null | undefined; unidadEntrada?: ApiMeasureUnitType | null },
): ErroresProcesamiento {
  const e: ErroresProcesamiento = { generales: [], salidas: {}, requeridos: {} };
  const tipo = f.accion.type;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) e.generales.push('fecha');
  const pedido = tipo === 'SHIPMENT';
  // Un pedido se crea sin entradas: las agrega después el proveedor, con su stock.
  if (!pedido && f.existentes.length + f.selecciones.length === 0) e.generales.push('sin_entrada');
  if (pedido && !f.instalacionEntrada) e.generales.push('sin_proveedor');
  if (f.salidas.length === 0) e.generales.push('sin_salida');
  if (f.selecciones.some((s) => !(s.cantidad > 0) || s.cantidad > n(s.orden.availableQuantity) + 1e-9)) e.generales.push('cantidad_entrada');

  const entra = totalEntrada(f);
  const sale = totalSalida(f.salidas, ctx.unidadDe, ctx.unidadEntrada);
  if (!pedido && tipo !== 'TRANSFER' && tipo !== 'GENERATE_QR_CODE' && sale > entra + 1e-6) e.generales.push('salida_mayor');
  // En un pedido, lo que manda el proveedor no puede pasar de lo pedido.
  if (pedido && f.selecciones.length > 0 && entra > sale + 1e-6) e.generales.push('entrada_mayor_que_pedido');

  for (const s of f.salidas) {
    const es: ErroresProcesamiento['salidas'][string] = {};
    if (tipo !== 'FINAL_PROCESSING' && !((tipo === 'TRANSFER' || tipo === 'SHIPMENT') && f.accion.finalProductAction) && s.semiproducto === null) es.semiproducto = 'requerido';
    if (!s.instalacion) es.instalacion = 'requerido';
    if (!s.lote.trim()) es.lote = 'requerido';
    if (pedido && !/^\d{4}-\d{2}-\d{2}$/.test(s.entrega ?? '')) es.entrega = 'requerido';
    if (tipo === 'PROCESSING' || tipo === 'FINAL_PROCESSING' || pedido) {
      if (s.cantidad === null) es.cantidad = 'requerido';
      else if (!(s.cantidad > 0)) es.cantidad = 'positivo';
    }
    if (s.sacos) {
      const suma = s.sacos.reduce((a, x) => a + n(x.cantidad), 0);
      if (s.sacos.some((x) => x.numero === null || x.cantidad === null || !(n(x.cantidad) > 0))) es.sacos = 'sacos_incompletos';
      else if (n(s.cantidad) > suma + 1e-6) es.sacos = 'sacos_no_alcanzan';
    }
    const campos: Record<string, string> = {};
    for (const c of f.accion.requiredEvidenceFields ?? []) {
      const v = s.campos[c.fieldName ?? ''];
      if (c.mandatory && (v === null || v === undefined || v === '')) campos[c.fieldName ?? ''] = 'requerido';
    }
    if (Object.keys(campos).length) es.campos = campos;
    if (Object.keys(es).length) e.salidas[s.clave] = es;
  }

  f.requeridos.forEach((d) => {
    if (d.obligatorio && !d.documento) e.requeridos[d.tipoId] = 'requerido';
  });
  return e;
}

export const sinErrores = (e: ErroresProcesamiento) => e.generales.length === 0 && Object.keys(e.salidas).length === 0 && Object.keys(e.requeridos).length === 0;

// ---------- Armado para la API ----------

function valorCampo(c: ApiProcessingEvidenceField, v: string | number | null | undefined): ApiStockOrderEvidenceFieldValue {
  const base: ApiStockOrderEvidenceFieldValue = { evidenceFieldId: c.id, evidenceFieldName: c.fieldName };
  switch (c.type) {
    case 'NUMBER':
    case 'INTEGER':
    case 'EXCHANGE_RATE':
    case 'PRICE':
      return { ...base, numericValue: v === null || v === undefined || v === '' ? undefined : Number(v) };
    case 'DATE':
    case 'TIMESTAMP':
      return { ...base, dateValue: v ? String(v) : undefined };
    default:
      return { ...base, stringValue: v === null || v === undefined ? undefined : String(v) };
  }
}

const documentos = (l: DocumentoEvidencia[]): ApiStockOrderEvidenceTypeValue[] =>
  l.filter((d) => d.documento?.id).map((d) => ({ evidenceTypeId: d.tipoId, evidenceTypeCode: d.tipoCodigo, date: d.fecha, document: d.documento! }));

/** Quita null y undefined (la interfaz actual borra las claves vacías antes de enviar). */
function sinVacios<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;
}

/**
 * Formulario → ApiProcessingOrder para createOrUpdateProcessingOrder, con la misma forma que arma
 * la interfaz actual:
 *  - una transacción por lote elegido (EXECUTED; isProcessing salvo en traslados),
 *  - en traslados, un lote de salida por cada lote de entrada (`lote/1`, `lote/2`…),
 *  - los lotes reempacados se expanden en una orden por saco, unidas por repackedOriginStockOrderId,
 *  - documentos, comentarios y campos de evidencia en cada orden de salida.
 */
export function armarOrden(
  f: FormProcesamiento,
  ctx: { empresa: number; usuario: number; original?: ApiProcessingOrder | null; unidadDe: (s: Salida) => ApiMeasureUnitType | null | undefined; nuevoId?: () => string },
): ApiProcessingOrder {
  const tipo = f.accion.type;
  const transacciones: ApiTransaction[] = [
    ...f.existentes,
    ...f.selecciones.map((s) => ({
      isProcessing: tipo === 'PROCESSING' || tipo === 'FINAL_PROCESSING' || tipo === 'GENERATE_QR_CODE',
      // En un pedido, lo que manda el proveedor queda pendiente hasta que el comprador lo aprueba.
      company: { id: ctx.empresa } as ApiTransaction['company'],
      initiationUserId: ctx.usuario,
      sourceStockOrder: s.orden,
      status: tipo === 'SHIPMENT' ? ('PENDING' as const) : ('EXECUTED' as const),
      inputQuantity: s.cantidad,
      outputQuantity: s.cantidad,
    })),
  ];

  const requeridos = documentos(f.requeridos);
  const otros = documentos(f.otros);
  const comunes = (s: Salida): Partial<ApiStockOrder> => ({
    requiredEvidenceTypeValues: requeridos,
    otherEvidenceDocuments: otros,
    comments: f.comentarios.trim() || undefined,
    requiredEvidenceFieldValues: (f.accion.requiredEvidenceFields ?? []).map((c) => valorCampo(c, s.campos[c.fieldName ?? ''])),
    fulfilledQuantity: 0,
    availableQuantity: 0,
  });

  const base = (s: Salida): ApiStockOrder =>
    sinVacios({
      ...(s.original ?? {}),
      creatorId: s.original?.creatorId ?? ctx.usuario,
      orderType: s.original?.orderType ?? (tipo === 'TRANSFER' ? 'TRANSFER_ORDER' : tipo === 'SHIPMENT' ? 'GENERAL_ORDER' : 'PROCESSING_ORDER'),
      productionDate: f.fecha,
      facility: s.instalacion ? ({ id: s.instalacion.id } as ApiFacility) : undefined,
      semiProduct: s.semiproducto ? ({ id: s.semiproducto } as ApiStockOrder['semiProduct']) : undefined,
      finalProduct: s.productoFinal ? ({ id: s.productoFinal } as ApiStockOrder['finalProduct']) : undefined,
      measureUnitType: ctx.unidadDe(s) ?? undefined,
      internalLotNumber: s.lote.trim(),
      totalQuantity: s.cantidad ?? undefined,
      ...(tipo === 'SHIPMENT'
        ? { quoteFacility: f.instalacionEntrada ? ({ id: f.instalacionEntrada.id } as ApiFacility) : undefined, deliveryTime: s.entrega, orderId: s.numeroOrden?.trim() || undefined }
        : {}),
      ...comunes(s),
    } as ApiStockOrder);

  let destino: ApiStockOrder[];
  if (tipo === 'TRANSFER') {
    // Un lote de salida por cada lote trasladado, en el mismo orden que las transacciones (así lo
    // exige el backend). Los traslados ya guardados no se editan desde la v2.
    const s = f.salidas[0]!;
    destino = f.selecciones.map((sel, i) =>
      sinVacios({
        ...base(s),
        id: undefined,
        semiProduct: sel.orden.semiProduct ? { id: sel.orden.semiProduct.id } : undefined,
        finalProduct: sel.orden.finalProduct ? { id: sel.orden.finalProduct.id } : undefined,
        measureUnitType: sel.orden.measureUnitType,
        internalLotNumber: `${s.lote.trim()}/${i + 1}`,
        productionDate: sel.orden.productionDate || f.fecha,
        orderType: 'TRANSFER_ORDER',
        totalQuantity: sel.cantidad,
      } as ApiStockOrder),
    );
  } else {
    destino = f.salidas.flatMap((s) => {
      if (!s.sacos) return [base(s)];
      const grupo = s.origenReempaque ?? ctx.nuevoId?.() ?? crypto.randomUUID();
      const { id: _id, totalQuantity: _t, sacNumber: _n, ...resto } = base(s);
      return s.sacos.map((saco) =>
        sinVacios({ ...resto, id: saco.id, sacNumber: saco.numero ?? undefined, totalQuantity: saco.cantidad ?? undefined, repackedOriginStockOrderId: grupo } as ApiStockOrder),
      );
    });
  }

  return sinVacios({
    ...(ctx.original ?? {}),
    processingAction: { id: f.accion.id } as ApiProcessingAction,
    initiatorUserId: ctx.original?.initiatorUserId ?? ctx.usuario,
    processingDate: f.fecha,
    inputTransactions: transacciones,
    targetStockOrders: destino,
  } as ApiProcessingOrder);
}

// ---------- Formulario nuevo y desde una orden guardada ----------

const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

let contador = 0;
export const nuevaClave = () => `s${++contador}`;

export function salidaNueva(accion: ApiProcessingAction): Salida {
  const { salidaFinal, salidasSemi } = unidadesDeAccion(accion);
  const semi = salidasSemi.length === 1 ? salidasSemi[0]! : null;
  return {
    clave: nuevaClave(),
    semiproducto: accion.type === 'TRANSFER' && !accion.finalProductAction ? (accion.inputSemiProduct?.id ?? null) : (semi?.id ?? null),
    productoFinal: salidaFinal?.id ?? null,
    instalacion: null,
    cantidad: null,
    lote: '',
    sacos: maximoSaco(accion, semi) ? [] : null,
    campos: {},
  };
}

function documentosRequeridos(accion: ApiProcessingAction, guardados: ApiStockOrderEvidenceTypeValue[] = []): DocumentoEvidencia[] {
  return (accion.requiredDocumentTypes ?? []).map((tipo) => {
    const g = guardados.find((x) => x.evidenceTypeId === tipo.id);
    return { tipoId: tipo.id!, tipoCodigo: tipo.code, tipoEtiqueta: tipo.label, obligatorio: !!tipo.mandatory, fecha: g?.date?.slice(0, 10) ?? hoyIso(), documento: g?.document ?? null };
  });
}

export function formularioNuevo(accion: ApiProcessingAction, instalacion: ApiFacility | null): FormProcesamiento {
  return { accion, instalacionEntrada: instalacion, fecha: hoyIso(), existentes: [], selecciones: [], salidas: [salidaNueva(accion)], requeridos: documentosRequeridos(accion), otros: [], comentarios: '' };
}

function campos(o: ApiStockOrder): Salida['campos'] {
  return Object.fromEntries((o.requiredEvidenceFieldValues ?? []).map((v) => [v.evidenceFieldName ?? '', v.numericValue ?? v.dateValue ?? v.stringValue ?? (v.booleanValue == null ? null : String(v.booleanValue))]));
}

/**
 * Orden guardada → formulario. Las salidas reempacadas (varias órdenes con el mismo
 * repackedOriginStockOrderId) vuelven a ser una salida con sus sacos.
 */
export function formularioDesdeOrden(orden: ApiProcessingOrder, accion: ApiProcessingAction): FormProcesamiento {
  const destino = orden.targetStockOrders ?? [];
  const primera = destino[0];
  const grupos = new Map<string, ApiStockOrder[]>();
  const salidas: Salida[] = [];
  for (const o of destino) {
    if (o.repackedOriginStockOrderId) {
      const g = grupos.get(o.repackedOriginStockOrderId);
      if (g) g.push(o);
      else {
        grupos.set(o.repackedOriginStockOrderId, [o]);
        salidas.push({ clave: o.repackedOriginStockOrderId, semiproducto: null, productoFinal: null, instalacion: null, cantidad: null, lote: '', sacos: [], campos: {} });
      }
    } else {
      salidas.push({
        clave: nuevaClave(),
        original: o,
        semiproducto: o.semiProduct?.id ?? null,
        productoFinal: o.finalProduct?.id ?? null,
        instalacion: o.facility ?? null,
        cantidad: o.totalQuantity ?? null,
        lote: o.internalLotNumber ?? '',
        sacos: null,
        campos: campos(o),
        entrega: o.deliveryTime?.slice(0, 10),
        numeroOrden: o.orderId ?? o.productOrder?.orderId,
      });
    }
  }
  for (const [origen, lista] of grupos) {
    const i = salidas.findIndex((s) => s.clave === origen);
    const p = lista[0]!;
    const lote = p.internalLotNumber ?? '';
    const barra = lote.lastIndexOf('/');
    salidas[i] = {
      clave: origen,
      origenReempaque: origen,
      semiproducto: p.semiProduct?.id ?? null,
      productoFinal: p.finalProduct?.id ?? null,
      instalacion: p.facility ?? null,
      cantidad: lista.reduce((s, x) => s + n(x.totalQuantity), 0),
      lote: barra > 0 ? lote.slice(0, barra) : lote,
      sacos: lista.map((x) => ({ id: x.id, numero: x.sacNumber ?? null, cantidad: x.totalQuantity ?? null })),
      campos: campos(p),
    };
  }
  return {
    accion,
    // En un pedido, la "entrada" es la instalación del proveedor (quoteFacility), aunque todavía no haya transacciones.
    instalacionEntrada: accion.type === 'SHIPMENT' ? (primera?.quoteFacility ?? null) : (orden.inputTransactions?.[0]?.sourceFacility ?? null),
    fecha: orden.processingDate?.slice(0, 10) ?? primera?.productionDate?.slice(0, 10) ?? hoyIso(),
    existentes: orden.inputTransactions ?? [],
    selecciones: [],
    salidas,
    requeridos: documentosRequeridos(accion, primera?.requiredEvidenceTypeValues),
    otros: (primera?.otherEvidenceDocuments ?? []).map((d) => ({ tipoId: d.evidenceTypeId!, tipoCodigo: d.evidenceTypeCode ?? '', tipoEtiqueta: d.evidenceTypeLabel, fecha: d.date?.slice(0, 10) ?? hoyIso(), documento: d.document ?? null })),
    comentarios: primera?.comments ?? '',
  };
}
