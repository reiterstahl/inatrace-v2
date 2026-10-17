import type { CSSProperties } from 'react';
import type { ApiBusinessToCustomerSettings } from '@/api/gen/types.gen';

/**
 * Cada producto define sus colores en la interfaz actual (ajustes B2C). La vitrina los respeta,
 * pero nunca a costa de la legibilidad: si un color no tiene contraste suficiente sobre el
 * fondo, se usa el del sistema.
 */

function rgb(hex?: string | null): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminancia([r, g, b]: [number, number, number]) {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

export function contraste(a: string, b: string): number {
  const x = rgb(a), y = rgb(b);
  if (!x || !y) return 1;
  const [l1, l2] = [luminancia(x), luminancia(y)].sort((p, q) => q - p);
  return (l1! + 0.05) / (l2! + 0.05);
}

/** Texto blanco o casi negro, el que mejor se lea sobre `fondo`. */
export function textoSobre(fondo: string): string {
  return contraste(fondo, '#ffffff') >= contraste(fondo, '#1b201d') ? '#ffffff' : '#1b201d';
}

function mezclar(hex: string, con: string, p: number): string {
  const a = rgb(hex)!, b = rgb(con)!;
  return '#' + a.map((v, i) => Math.round(v * (1 - p) + b[i]! * p).toString(16).padStart(2, '0')).join('');
}

const PAPEL = '#f7f5f0';
const valido = (c?: string | null) => (rgb(c) ? (c as string) : undefined);
/** Un color de texto sirve si se lee sobre el papel (4,5:1, el mínimo AA para texto normal). */
const legible = (c?: string | null, minimo = 4.5) => (valido(c) && contraste(c!, PAPEL) >= minimo ? c! : undefined);

export function estiloMarca(a: ApiBusinessToCustomerSettings): CSSProperties {
  const v: Record<string, string> = {};
  const primario = valido(a.primaryColor);
  if (primario) {
    v['--marca'] = primario;
    v['--marca-fuerte'] = mezclar(primario, '#000000', 0.18);
    v['--marca-suave'] = mezclar(primario, '#ffffff', 0.86);
    v['--sobre-marca'] = textoSobre(primario);
    v['--foco'] = primario;
  }
  const secundario = valido(a.secondaryColor);
  if (secundario) {
    v['--acento'] = secundario;
    v['--acento-suave'] = mezclar(secundario, '#ffffff', 0.85);
    v['--sobre-acento'] = textoSobre(secundario);
  }
  const portada = valido(a.tertiaryColor);
  if (portada) {
    v['--portada'] = portada;
    v['--sobre-portada'] = textoSobre(portada);
  }
  const banda = valido(a.quaternaryColor);
  if (banda) v['--banda'] = banda;
  const titulo = legible(a.headingColor, 3); // títulos grandes: alcanza con 3:1
  if (titulo) v['--titulo-vitrina'] = titulo;
  const texto = legible(a.textColor);
  if (texto) v['--tinta'] = texto;
  return v as CSSProperties;
}

/** Color del nombre del producto en la portada: el configurado, si se lee sobre el fondo de la portada. */
export function colorTituloProducto(a: ApiBusinessToCustomerSettings, conImagen: boolean): string | undefined {
  const c = valido(a.productTitleColor);
  const fondo = valido(a.tertiaryColor);
  if (!c) return undefined;
  if (conImagen || !fondo) return c;
  return contraste(c, fondo) >= 3 ? c : undefined;
}
