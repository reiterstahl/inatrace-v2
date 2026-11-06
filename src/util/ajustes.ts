/**
 * Ajustes globales de la instancia que se editan en Administración → Ajustes. `publico` es lo que el
 * backend devuelve sin sesión (la vitrina lo lee); el enlace de ayuda es solo para el panel.
 */
export const AJUSTES = {
  textoNoPublicada: { clave: 'UNPUBLISHED_PRODUCT_LABEL_TEXT', publico: true },
  enlaceAyudaEtiquetas: { clave: 'PRODUCT_LABELS_HELPER_LINK', publico: false },
} as const;
export type Ajuste = keyof typeof AJUSTES;

/** Como la versión actual: un enlace sin esquema se completa (con https). Vacío queda vacío. */
export function normalizarEnlace(v: string): string {
  const s = v.trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function enlaceValido(v: string): boolean {
  const s = normalizarEnlace(v);
  if (!s) return true;
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Como el backend: activar una moneda lo puede la regional; desactivar y editar ajustes, solo el sistema. */
export function permisosMoneda(rol: string | undefined) {
  return { activar: rol === 'SYSTEM_ADMIN' || rol === 'REGIONAL_ADMIN', desactivar: rol === 'SYSTEM_ADMIN' };
}
export const editaAjustes = (rol: string | undefined) => rol === 'SYSTEM_ADMIN';
