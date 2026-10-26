/** Raíz de la interfaz actual (Angular). Detrás del proxy de convivencia es el mismo origen. */
export const URL_ANTERIOR = (import.meta.env.VITE_URL_ANTERIOR ?? '').replace(/\/$/, '');
export const enAnterior = (ruta: string) => URL_ANTERIOR + ruta;

/** Configuración de la instalación (public/config.js, reemplazado al arrancar el contenedor). */
type Config = {
  tokenRegistro?: string;
  /** Raíz pública con la que se arman los QR (APP_BASE_URL de la versión actual). Vacío: el origen de la página. */
  urlPublica?: string;
  /** Ruta de los QR impresos (QR_CODE_BASE_PATH de la versión actual). */
  rutaQr?: string;
};
export const CONFIG: Config = (window as unknown as { __INATRACE__?: Config }).__INATRACE__ ?? {};

/**
 * URL que lleva el QR de un lote, igual que la arma la versión actual:
 * {raíz}/{idioma de la etiqueta}/{ruta de QR}/{uuid de la etiqueta}/{código del lote}.
 * Así un QR impreso desde la v2 es idéntico al de la versión actual y registra la visita al escanearse.
 */
export function urlQr(etiqueta: { uuid?: string; language?: string }, codigo: string): string {
  const raiz = (CONFIG.urlPublica || window.location.origin).replace(/\/$/, '');
  const ruta = (CONFIG.rutaQr || 'q-cd').replace(/^\/|\/$/g, '');
  return `${raiz}/${(etiqueta.language ?? 'en').toLowerCase()}/${ruta}/${etiqueta.uuid}/${codigo}`;
}
