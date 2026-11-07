import { useCallback, useSyncExternalStore } from 'react';
import { leer, guardar } from './almacen';
import { TEMAS, TOKENS, temaPorId, type DefTema, type Modo } from './temas';

/**
 * Tema elegido en este navegador. Se guarda el id (los valores de antes, «claro» y «oscuro», son los
 * temas base). Además se recuerda el último claro y el último oscuro: el botón de la barra alterna
 * entre esos dos. Sin elección, sigue al sistema con los temas base.
 */
const CLAVE = 'inatrace.tema';
const ultimo = (modo: Modo) => `inatrace.tema.${modo}`;
const escuchas = new Set<() => void>();

function actual(): DefTema {
  const elegido = temaPorId(leer(CLAVE));
  if (elegido) return elegido;
  const oscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return temaPorId(oscuro ? 'oscuro' : 'claro')!;
}

export function aplicarTema() {
  const t = actual();
  const raiz = document.documentElement;
  raiz.classList.toggle('dark', t.modo === 'oscuro');
  raiz.dataset.tema = t.id;
  // Los colores van en línea sobre <html>: las zonas con .tema-claro (la vitrina) los redefinen.
  for (const k of TOKENS) raiz.style.setProperty(`--${k}`, t.colores[k]);
}

function elegirTema(id: string) {
  const t = temaPorId(id);
  if (!t) return;
  guardar(CLAVE, t.id);
  guardar(ultimo(t.modo), t.id);
  aplicarTema();
  escuchas.forEach((fn) => fn());
}

/** [id del tema, su modo, alternar claro/oscuro, elegir un tema] */
export function useTema(): [string, Modo, () => void, (id: string) => void] {
  const id = useSyncExternalStore(
    (fn) => (escuchas.add(fn), () => escuchas.delete(fn)),
    () => actual().id,
  );
  const modo = temaPorId(id)!.modo;
  const alternar = useCallback(() => {
    const otro: Modo = actual().modo === 'oscuro' ? 'claro' : 'oscuro';
    elegirTema(temaPorId(leer(ultimo(otro)))?.id ?? otro);
  }, []);
  return [id, modo, alternar, elegirTema];
}

export { TEMAS };
