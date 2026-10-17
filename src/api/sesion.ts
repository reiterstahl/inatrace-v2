/**
 * Sesión compartida con la interfaz actual.
 *
 * El backend autentica con dos cookies HttpOnly: una de acceso (vida corta) y otra de
 * renovación. Esta app nunca las ve ni las guarda: el navegador las manda solo. Cuando el
 * acceso vence, el backend responde 401; entonces se pide un acceso nuevo una sola vez y se
 * repite la petición. Si la renovación también falla, la sesión terminó.
 */

const RUTA_RENOVAR = '/api/user/refresh_authentication';

// Rutas donde un 401 no significa "sesión vencida": no tiene sentido renovar.
const SIN_RENOVAR = ['/api/user/login', '/api/user/logout', RUTA_RENOVAR, '/api/public/'];

type Escucha = () => void;
const escuchasFin = new Set<Escucha>();

/** Avisa cuando la sesión terminó y no se pudo renovar (para mandar a la pantalla de ingreso). */
export function alTerminarSesion(fn: Escucha): () => void {
  escuchasFin.add(fn);
  return () => escuchasFin.delete(fn);
}

// Si varias peticiones vencen a la vez, todas esperan la misma renovación.
let renovando: Promise<boolean> | null = null;

function renovar(): Promise<boolean> {
  renovando ??= fetch(RUTA_RENOVAR, { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      // Se suelta en la vuelta siguiente para que las peticiones en espera usen este resultado.
      setTimeout(() => (renovando = null), 0);
    });
  return renovando;
}

function ruta(entrada: RequestInfo | URL): string {
  const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  return new URL(url, window.location.origin).pathname;
}

export const fetchConSesion: typeof fetch = async (entrada, opciones) => {
  // El cuerpo de un Request solo se puede leer una vez: se guarda una copia por si hay que repetir.
  const copia = entrada instanceof Request ? entrada.clone() : null;
  const respuesta = await fetch(entrada, { credentials: 'include', ...opciones });

  const p = ruta(entrada);
  if (respuesta.status !== 401 || SIN_RENOVAR.some((s) => p.startsWith(s))) return respuesta;

  if (await renovar()) {
    return fetch(copia ?? entrada, { credentials: 'include', ...opciones });
  }
  escuchasFin.forEach((fn) => fn());
  return respuesta;
};
