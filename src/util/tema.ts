import { useCallback, useSyncExternalStore } from 'react';
import { leer, guardar } from './almacen';

type Tema = 'claro' | 'oscuro';
const CLAVE = 'inatrace.tema';
const escuchas = new Set<() => void>();

function actual(): Tema {
  const g = leer(CLAVE);
  if (g === 'claro' || g === 'oscuro') return g;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

export function aplicarTema() {
  document.documentElement.classList.toggle('dark', actual() === 'oscuro');
}

export function useTema(): [Tema, () => void] {
  const tema = useSyncExternalStore(
    (fn) => (escuchas.add(fn), () => escuchas.delete(fn)),
    actual,
  );
  const alternar = useCallback(() => {
    guardar(CLAVE, actual() === 'oscuro' ? 'claro' : 'oscuro');
    aplicarTema();
    escuchas.forEach((fn) => fn());
  }, []);
  return [tema, alternar];
}
