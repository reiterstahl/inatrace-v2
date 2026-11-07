import { useCallback, useSyncExternalStore } from 'react';
import { leer, guardar } from './almacen';

/**
 * Imagen de perfil genérica: una semilla en un color. Cada cuenta tiene una por defecto (sale de su
 * id, siempre la misma) y la persona puede elegir otra; la elección se guarda en este navegador
 * (la v2 no cambia el backend). El blanco de la semilla tiene ≥ 4,5:1 sobre todos los colores.
 */
export const SEMILLAS = ['cafe', 'cacao', 'maiz', 'frijol', 'girasol', 'brote'] as const;
export type Semilla = (typeof SEMILLAS)[number];
export const COLORES_AVATAR = {
  tierra: '#7a4a2a',
  hoja: '#2f7d5d',
  mar: '#1d5a8a',
  teja: '#a8452a',
  uva: '#5b3d91',
  laguna: '#23676f',
  vino: '#8e2f52',
  olivo: '#5a6b22',
} as const;
export type ColorAvatar = keyof typeof COLORES_AVATAR;
const COLORES = Object.keys(COLORES_AVATAR) as ColorAvatar[];
export type Avatar = { semilla: Semilla; color: ColorAvatar };

/** Hash FNV-1a: estable entre navegadores para la misma cuenta. */
function hash(texto: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export function avatarPorDefecto(clave: string): Avatar {
  const h = hash(clave || 'inatrace');
  return { semilla: SEMILLAS[h % SEMILLAS.length]!, color: COLORES[(h >>> 8) % COLORES.length]! };
}

export function avatarAlAzar(distinto?: Avatar): Avatar {
  for (;;) {
    const a = { semilla: SEMILLAS[Math.floor(Math.random() * SEMILLAS.length)]!, color: COLORES[Math.floor(Math.random() * COLORES.length)]! };
    if (!distinto || a.semilla !== distinto.semilla || a.color !== distinto.color) return a;
  }
}

const claveDe = (cuenta: string) => `inatrace.avatar.${cuenta}`;
const escuchas = new Set<() => void>();

function leerAvatar(cuenta: string): string {
  const g = leer(claveDe(cuenta));
  if (g) {
    const [s = '', c = ''] = g.split(':');
    if ((SEMILLAS as readonly string[]).includes(s) && c in COLORES_AVATAR) return g;
  }
  const d = avatarPorDefecto(cuenta);
  return `${d.semilla}:${d.color}`;
}

/** [avatar de la cuenta, elegir otro] */
export function useAvatar(cuenta: string): [Avatar, (a: Avatar) => void] {
  const texto = useSyncExternalStore(
    (fn) => (escuchas.add(fn), () => escuchas.delete(fn)),
    () => leerAvatar(cuenta),
  );
  const [semilla, color] = texto.split(':') as [Semilla, ColorAvatar];
  const elegir = useCallback(
    (a: Avatar) => {
      guardar(claveDe(cuenta), `${a.semilla}:${a.color}`);
      escuchas.forEach((fn) => fn());
    },
    [cuenta],
  );
  return [{ semilla, color }, elegir];
}
