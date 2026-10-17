/** Raíz de la interfaz actual (Angular). Detrás del proxy de convivencia es el mismo origen. */
export const URL_ANTERIOR = (import.meta.env.VITE_URL_ANTERIOR ?? '').replace(/\/$/, '');
export const enAnterior = (ruta: string) => URL_ANTERIOR + ruta;
