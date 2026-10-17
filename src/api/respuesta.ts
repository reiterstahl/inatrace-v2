/**
 * Todas las respuestas del backend vienen envueltas: { status, data, errorMessage }.
 * `desenvolver` devuelve solo `data` o lanza un ErrorApi con un motivo claro.
 */

export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    readonly estado: string,
    readonly http: number,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
  get noEncontrado() {
    return this.http === 404 || this.estado === 'NOT_FOUND';
  }
  get sinSesion() {
    return this.http === 401 || this.estado === 'UNAUTHORIZED' || this.estado === 'AUTH_ERROR';
  }
}

type Envoltorio<T> = { status: string; data?: T; errorMessage?: string };
type Resultado<T> = { data?: Envoltorio<T>; error?: unknown; response?: Response };

export async function desenvolver<T>(peticion: Promise<Resultado<T>>): Promise<T> {
  const r = await peticion;
  const http = r.response?.status ?? 0;
  const cuerpo = (r.data ?? r.error) as Envoltorio<T> | undefined;
  if (!r.response?.ok || !cuerpo || cuerpo.status !== 'OK') {
    throw new ErrorApi(cuerpo?.errorMessage || `La API respondió ${http || 'sin conexión'}`, cuerpo?.status ?? 'ERROR', http);
  }
  return cuerpo.data as T;
}

/** URL pública de un documento o imagen guardado en el backend. */
export function urlDocumento(storageKey?: string | null): string | undefined {
  return storageKey ? `/api/public/document/${encodeURIComponent(storageKey)}` : undefined;
}
