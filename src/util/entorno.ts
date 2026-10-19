/** Raíz de la interfaz actual (Angular). Detrás del proxy de convivencia es el mismo origen. */
export const URL_ANTERIOR = (import.meta.env.VITE_URL_ANTERIOR ?? '').replace(/\/$/, '');
export const enAnterior = (ruta: string) => URL_ANTERIOR + ruta;

/** Configuración de la instalación (public/config.js, reemplazado al arrancar el contenedor). */
type Config = { tokenRegistro?: string };
export const CONFIG: Config = (window as unknown as { __INATRACE__?: Config }).__INATRACE__ ?? {};
