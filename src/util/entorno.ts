/** Configuración de la instalación (public/config.js, reemplazado al arrancar el contenedor). */
type Config = {
  tokenRegistro?: string;
  /** Raíz pública con la que se arman los QR (APP_BASE_URL de la versión actual). Vacío: el origen de la página. */
  urlPublica?: string;
  /** Ruta de los QR impresos (QR_CODE_BASE_PATH de la versión actual). */
  rutaQr?: string;
  /** Autorización de Beyco (BEYCO_AUTH_URL de la versión actual). Vacío: sin Beyco. */
  beycoUrl?: string;
  /** Cliente de INATrace en Beyco (BEYCO_CLIENT_ID de la versión actual). */
  beycoClientId?: string;
  /**
   * Raíz de la interfaz anterior (Angular) mientras conviven: «/» detrás del proxy de convivencia (mismo
   * origen) o su URL. Vacía: se retiró (fase 6) y la v2 no muestra enlaces a ella.
   */
  urlAnterior?: string;
};
export const CONFIG: Config = (window as unknown as { __INATRACE__?: Config }).__INATRACE__ ?? {};

// En desarrollo, sin la configuración del contenedor, vale VITE_URL_ANTERIOR (ver .env.ejemplo).
const raizAnterior = CONFIG.urlAnterior ?? import.meta.env.VITE_URL_ANTERIOR ?? '';
/** ¿Sigue en uso la interfaz anterior? Si no, no se muestran enlaces a ella. */
export const hayAnterior = raizAnterior !== '';
export const enAnterior = (ruta: string) => raizAnterior.replace(/\/$/, '') + ruta;

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
