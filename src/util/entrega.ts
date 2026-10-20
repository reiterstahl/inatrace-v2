/**
 * Cálculos de una entrega (orden de compra), con la misma fórmula que el backend
 * (StockOrderService, caso PURCHASE_ORDER):
 *   peso neto = bruto − tara − descuento por daño en peso
 *   costo     = (precio − descuento por daño en precio) × peso neto
 * Son una vista previa: al guardar, los valores definitivos los calcula el backend.
 */

export type DatosEntrega = {
  bruto?: number | null;
  tara?: number | null;
  descuentoPeso?: number | null;
  precio?: number | null;
  descuentoPrecio?: number | null;
  precioDespues?: boolean;
};

const n = (v?: number | null) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function pesoNeto(d: DatosEntrega): number | null {
  if (typeof d.bruto !== 'number' || !Number.isFinite(d.bruto)) return null;
  return d.bruto - n(d.tara) - n(d.descuentoPeso);
}

export function precioFinal(d: DatosEntrega): number | null {
  if (d.precioDespues || typeof d.precio !== 'number' || !Number.isFinite(d.precio)) return null;
  return d.precio - n(d.descuentoPrecio);
}

export function costo(d: DatosEntrega): number | null {
  const neto = pesoNeto(d), precio = precioFinal(d);
  return neto === null || precio === null ? null : precio * neto;
}

export type ProblemaEntrega = 'tara_mayor_que_bruto' | 'descuento_peso_mayor_que_neto' | 'descuento_precio_mayor_que_precio';

/** Las mismas comprobaciones que hace la interfaz actual antes de guardar. */
export function problemas(d: DatosEntrega): ProblemaEntrega[] {
  const p: ProblemaEntrega[] = [];
  if (n(d.tara) > 0 && n(d.bruto) > 0 && n(d.tara) > n(d.bruto)) p.push('tara_mayor_que_bruto');
  const netoSinDescuento = n(d.bruto) - n(d.tara);
  if (n(d.descuentoPeso) > 0 && netoSinDescuento > 0 && n(d.descuentoPeso) > netoSinDescuento) p.push('descuento_peso_mayor_que_neto');
  if (!d.precioDespues && n(d.descuentoPrecio) > 0 && n(d.precio) > 0 && n(d.descuentoPrecio) > n(d.precio)) p.push('descuento_precio_mayor_que_precio');
  return p;
}

/** Identificador que la interfaz actual da a una entrega nueva: PT-{apellido}-{fecha}. */
export const identificadorEntrega = (apellido: string, fecha: string) => `PT-${apellido}-${fecha}`;
