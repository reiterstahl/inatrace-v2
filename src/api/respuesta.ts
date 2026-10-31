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
/**
 * Documento de una pantalla con sesión (comprobantes, evidencias, fotos en edición). Va por la ruta
 * autenticada: desde 1db6e5f el backend rechaza por la ruta pública las claves que no tienen un
 * alcance público explícito (respondía 400).
 */
export function urlDocumento(storageKey?: string | null): string | undefined {
  return storageKey ? `/api/common/document/${encodeURIComponent(storageKey)}` : undefined;
}

/** Imagen de una pantalla con sesión, en el tamaño que pida la vista (SMALL, MEDIUM, LARGE). */
export function urlImagen(storageKey?: string | null, tamano?: 'SMALL' | 'MEDIUM' | 'LARGE'): string | undefined {
  return storageKey ? `/api/common/image/${encodeURIComponent(storageKey)}${tamano ? '/' + tamano : ''}` : undefined;
}

/** Documento o imagen de la vitrina pública: claves con alcance público que da la propia vitrina. */
export function urlDocumentoPublico(storageKey?: string | null): string | undefined {
  return storageKey ? `/api/public/document/${encodeURIComponent(storageKey)}` : undefined;
}

type RespuestaBlob = { data?: unknown; response?: Response };

/** Descarga un archivo que devuelve el backend (xlsx, geojson…) y lo guarda con el nombre dado. */
export async function descargarBlob(peticion: Promise<RespuestaBlob>, nombre: string): Promise<boolean> {
  const r = await peticion;
  if (!r.response?.ok || !(r.data instanceof Blob)) throw new ErrorApi('No se pudo descargar el archivo.', 'ERROR', r.response?.status ?? 0);
  // Un archivo vacío significa que no había nada para exportar (p. ej. una orden sin datos geográficos).
  if (r.data.size === 0) return false;
  const url = URL.createObjectURL(r.data);
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
