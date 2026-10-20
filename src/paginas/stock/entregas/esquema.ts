import type { FieldErrors, Resolver } from 'react-hook-form';
import type { ApiFacility, ApiPurchaseOrder, ApiStockOrder, ApiUserCustomer } from '@/api/gen/types.gen';
import { costo, identificadorEntrega, pesoNeto, problemas } from '@/util/entrega';
import { fechaEntrega } from '@/util/formato';

/** Monedas frecuentes en las instalaciones de INATrace, para sugerir al escribir. */
export const MONEDAS = ['USD', 'EUR', 'GTQ', 'HNL', 'NIO', 'CRC', 'MXN', 'COP', 'PEN', 'RWF', 'UGX', 'KES', 'ETB'];

export const FORMAS_PAGO = ['CASH', 'CASH_VIA_COLLECTOR', 'UNKNOWN', 'BANK_TRANSFER', 'CHEQUE', 'OFFSETTING'] as const;
export type FormaPago = (typeof FORMAS_PAGO)[number];

/** Formas de pago que ofrece la interfaz actual según haya acopiador o no. */
export function formasPagoPosibles(conAcopiador: boolean, actual?: string): FormaPago[] {
  const lista = FORMAS_PAGO.filter((f) => (f === 'CASH_VIA_COLLECTOR' ? conAcopiador : f === 'UNKNOWN' ? !conAcopiador : true));
  // Una entrega vieja puede tener una forma que hoy no se ofrecería: se conserva.
  if (actual && FORMAS_PAGO.includes(actual as FormaPago) && !lista.includes(actual as FormaPago)) lista.push(actual as FormaPago);
  return lista;
}

export type SiNo = '' | 'si' | 'no';

export type FormEntrega = {
  instalacion: number | null;
  productor: ApiUserCustomer | null;
  acopiador: ApiUserCustomer | null;
  parcelas: number[];
  fecha: string;
  semiproducto: number | null;
  registradoPor: number | null;
  bruto: number | null;
  tara: number | null;
  descuentoPeso: number | null;
  precio: number | null;
  descuentoPrecio: number | null;
  precioDespues: boolean;
  moneda: string;
  organico: SiNo;
  mujeres: SiNo;
  formaPago: '' | FormaPago;
  comentarios: string;
};

/** Valor de un selector numérico: vacío o null → null (Number(null) sería 0). */
export const aNumeroONulo = (v: unknown): number | null => (v === '' || v === null || v === undefined ? null : Number(v));

/** Texto de un campo numérico → número (acepta coma decimal); vacío → null; basura → NaN. */
export const aDecimal = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  return s === '' ? null : /^-?\d*\.?\d+$|^-?\d+\.$/.test(s) ? Number(s) : NaN;
};

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const siNo = (b?: boolean | null): SiNo => (b === true ? 'si' : b === false ? 'no' : '');

export function aFormulario(
  e: ApiStockOrder | null,
  defecto: { instalacion?: number | null; registradoPor?: number | null; moneda?: string; semiproducto?: number | null; productor?: ApiUserCustomer | null },
): FormEntrega {
  return {
    instalacion: e?.facility?.id ?? defecto.instalacion ?? null,
    productor: e?.producerUserCustomer ?? defecto.productor ?? null,
    acopiador: e?.representativeOfProducerUserCustomer ?? null,
    parcelas: (e?.plots ?? []).map((p) => p.id!).filter(Boolean),
    fecha: (e ? fechaEntrega(e).slice(0, 10) : '') || hoy(),
    semiproducto: e?.semiProduct?.id ?? defecto.semiproducto ?? null,
    registradoPor: e?.creatorId ?? defecto.registradoPor ?? null,
    bruto: e?.totalGrossQuantity ?? null,
    tara: e?.tare ?? null,
    descuentoPeso: e?.damagedWeightDeduction ?? null,
    precio: e?.pricePerUnit ?? null,
    descuentoPrecio: e?.damagedPriceDeduction ?? null,
    precioDespues: !!e?.priceDeterminedLater,
    moneda: e?.currency ?? defecto.moneda ?? '',
    organico: siNo(e?.organic),
    mujeres: siNo(e?.womenShare),
    formaPago: (e?.preferredWayOfPayment as FormaPago | undefined) ?? '',
    comentarios: e?.comments ?? '',
  };
}

type Errores = Partial<Record<keyof FormEntrega, string>>;

/**
 * Reglas de la interfaz actual. Lo que la instalación activa en sus opciones (orgánico, café de
 * mujeres, tara, descuentos) solo se exige si la instalación lo usa.
 */
export function validar(f: FormEntrega, inst: ApiFacility | undefined): Errores {
  const e: Errores = {};
  const requerido = (c: keyof FormEntrega, vacio: boolean) => vacio && (e[c] = 'requerido');
  requerido('instalacion', f.instalacion === null);
  requerido('productor', !f.productor?.id);
  requerido('fecha', !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha));
  requerido('semiproducto', f.semiproducto === null);
  requerido('registradoPor', f.registradoPor === null);
  requerido('moneda', !f.moneda.trim());
  requerido('formaPago', !f.formaPago);
  if (inst?.displayOrganic) requerido('organico', !f.organico);
  if (inst?.displayWomenOnly) requerido('mujeres', !f.mujeres);
  if (inst?.displayTare) requerido('tara', f.tara === null);
  if (inst?.displayWeightDeductionDamage) requerido('descuentoPeso', f.descuentoPeso === null);
  if (inst?.displayPriceDeductionDamage && !f.precioDespues) requerido('descuentoPrecio', f.descuentoPrecio === null);

  const numeros: (keyof FormEntrega)[] = ['bruto', 'tara', 'descuentoPeso', 'precio', 'descuentoPrecio'];
  for (const c of numeros) {
    const v = f[c] as number | null;
    if (v === null) continue;
    if (Number.isNaN(v)) e[c] = 'numero';
    else if (v < 0) e[c] = 'rango';
  }
  if (f.bruto === null) e.bruto = 'requerido';
  else if (!e.bruto && f.bruto <= 0) e.bruto = 'positivo';
  if (!f.precioDespues && f.precio === null) e.precio = 'requerido';

  const datos = { bruto: f.bruto, tara: f.tara, descuentoPeso: f.descuentoPeso, precio: f.precio, descuentoPrecio: f.descuentoPrecio, precioDespues: f.precioDespues };
  for (const p of problemas(datos)) {
    const campo = p === 'tara_mayor_que_bruto' ? 'tara' : p === 'descuento_peso_mayor_que_neto' ? 'descuentoPeso' : 'descuentoPrecio';
    e[campo] ??= p;
  }
  return e;
}

export function resolverEntrega(instalacion: () => ApiFacility | undefined): Resolver<FormEntrega> {
  return (valores) => {
    const errores = validar(valores, instalacion());
    const lista = Object.entries(errores) as [keyof FormEntrega, string][];
    if (lista.length === 0) return { values: valores, errors: {} };
    return {
      values: {},
      errors: Object.fromEntries(lista.map(([c, m]) => [c, { type: 'validate', message: m }])) as FieldErrors<FormEntrega>,
    };
  };
}

/**
 * Formulario → objeto para createOrUpdateStockOrder. Al editar se parte de la entrega original
 * (como la interfaz actual, que manda el objeto completo); al crear, con el identificador y las
 * cantidades que pone la interfaz actual. Los totales, el costo y el saldo los recalcula el backend.
 */
export function aApi(f: FormEntrega, original: ApiStockOrder | null): ApiStockOrder {
  const neto = pesoNeto({ bruto: f.bruto, tara: f.tara, descuentoPeso: f.descuentoPeso }) ?? 0;
  const base: ApiStockOrder = original
    ? { ...original }
    : {
        orderType: 'PURCHASE_ORDER',
        identifier: identificadorEntrega(f.productor?.surname ?? '', f.fecha),
        totalQuantity: neto,
        fulfilledQuantity: neto,
        availableQuantity: neto,
      };
  const cambioProductor = original && original.producerUserCustomer?.id !== f.productor?.id;
  return {
    ...base,
    facility: { id: f.instalacion! },
    producerUserCustomer: { id: f.productor!.id } as ApiUserCustomer,
    representativeOfProducerUserCustomer: f.acopiador?.id ? ({ id: f.acopiador.id } as ApiUserCustomer) : undefined,
    plots: f.parcelas.map((id) => ({ id })),
    productionDate: f.fecha,
    semiProduct: { id: f.semiproducto! } as ApiStockOrder['semiProduct'],
    creatorId: f.registradoPor!,
    totalGrossQuantity: f.bruto!,
    tare: f.tara ?? undefined,
    damagedWeightDeduction: f.descuentoPeso ?? undefined,
    pricePerUnit: f.precioDespues ? undefined : (f.precio ?? undefined),
    damagedPriceDeduction: f.precioDespues ? undefined : (f.descuentoPrecio ?? undefined),
    priceDeterminedLater: f.precioDespues,
    currency: f.moneda.trim().toUpperCase(),
    organic: f.organico === '' ? undefined : f.organico === 'si',
    womenShare: f.mujeres === 'si',
    preferredWayOfPayment: f.formaPago || undefined,
    comments: f.comentarios.trim() || undefined,
    // Cambiar de productor en una entrega vieja: el identificador sigue al nuevo apellido.
    ...(cambioProductor ? { identifier: identificadorEntrega(f.productor?.surname ?? '', f.fecha) } : {}),
  };
}

// ---------- Entrega masiva: datos comunes + una fila por productor ----------

export type FilaMasiva = Pick<FormEntrega, 'productor' | 'semiproducto' | 'bruto' | 'tara' | 'descuentoPeso' | 'precio' | 'descuentoPrecio' | 'organico' | 'mujeres'>;
export type FormMasiva = Pick<FormEntrega, 'instalacion' | 'fecha' | 'registradoPor' | 'moneda' | 'formaPago' | 'acopiador'> & { filas: FilaMasiva[] };

const CAMPOS_FILA: (keyof FilaMasiva)[] = ['productor', 'semiproducto', 'bruto', 'tara', 'descuentoPeso', 'precio', 'descuentoPrecio', 'organico', 'mujeres'];

export const filaVacia = (semiproducto: number | null = null): FilaMasiva => ({
  productor: null, semiproducto, bruto: null, tara: null, descuentoPeso: null, precio: null, descuentoPrecio: null, organico: '', mujeres: '',
});

export function masivaVacia(defecto: Parameters<typeof aFormulario>[1]): FormMasiva {
  const { instalacion, fecha, registradoPor, moneda, formaPago, acopiador } = aFormulario(null, defecto);
  return { instalacion, fecha, registradoPor, moneda, formaPago, acopiador, filas: [filaVacia(defecto.semiproducto ?? null)] };
}

/** Cada fila se valida como una entrega suelta: mismas reglas, mismos mensajes. */
export function validarMasiva(f: FormMasiva, inst: ApiFacility | undefined) {
  const comunes: Errores = {};
  const filas: Partial<Record<keyof FilaMasiva, string>>[] = [];
  f.filas.forEach((fila, i) => {
    const e = validar({ ...f, ...fila, parcelas: [], precioDespues: false, comentarios: '' }, inst);
    const deFila: Partial<Record<keyof FilaMasiva, string>> = {};
    for (const [c, m] of Object.entries(e) as [keyof FormEntrega, string][]) {
      if ((CAMPOS_FILA as string[]).includes(c)) deFila[c as keyof FilaMasiva] = m;
      else comunes[c] ??= m;
    }
    filas[i] = deFila;
  });
  return { comunes, filas };
}

export function resolverMasiva(instalacion: () => ApiFacility | undefined): Resolver<FormMasiva> {
  return (valores) => {
    const { comunes, filas } = validarMasiva(valores, instalacion());
    const conErrores = Object.keys(comunes).length > 0 || filas.some((x) => Object.keys(x).length > 0);
    if (!conErrores) return { values: valores, errors: {} };
    const a = (m: string) => ({ type: 'validate', message: m });
    const errors: Record<string, unknown> = Object.fromEntries(Object.entries(comunes).map(([c, m]) => [c, a(m)]));
    errors.filas = filas.map((x) => (Object.keys(x).length ? Object.fromEntries(Object.entries(x).map(([c, m]) => [c, a(m!)])) : undefined));
    return { values: {}, errors: errors as FieldErrors<FormMasiva> };
  };
}

/** Formulario masivo → createPurchaseOrderBulk, con lo que pone la interfaz actual en cada fila. */
export function aApiMasiva(f: FormMasiva): ApiPurchaseOrder {
  return {
    facility: { id: f.instalacion! },
    productionDate: f.fecha,
    creatorId: f.registradoPor!,
    currency: f.moneda.trim().toUpperCase(),
    preferredWayOfPayment: f.formaPago || undefined,
    representativeOfProducerUserCustomer: f.acopiador?.id ? ({ id: f.acopiador.id } as ApiUserCustomer) : undefined,
    farmers: f.filas.map((x) => {
      const datos = { bruto: x.bruto, tara: x.tara, descuentoPeso: x.descuentoPeso, precio: x.precio, descuentoPrecio: x.descuentoPrecio };
      const neto = pesoNeto(datos) ?? 0;
      const pago = costo(datos) ?? undefined;
      return {
        identifier: identificadorEntrega(x.productor?.surname ?? '', f.fecha),
        producerUserCustomer: { id: x.productor!.id } as ApiUserCustomer,
        semiProduct: { id: x.semiproducto! } as ApiStockOrder['semiProduct'],
        totalGrossQuantity: x.bruto!,
        tare: x.tara ?? undefined,
        damagedWeightDeduction: x.descuentoPeso ?? undefined,
        totalQuantity: neto,
        fulfilledQuantity: neto,
        availableQuantity: neto,
        pricePerUnit: x.precio ?? undefined,
        damagedPriceDeduction: x.descuentoPrecio ?? undefined,
        organic: x.organico === '' ? undefined : x.organico === 'si',
        womenShare: x.mujeres === 'si',
        cost: pago,
        balance: pago,
      };
    }),
  };
}
