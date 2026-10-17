import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-marca text-sobre-marca hover:bg-marca-fuerte',
  secundario: 'bg-superficie text-tinta border border-linea-fuerte hover:bg-superficie-2',
  fantasma: 'text-tinta-2 hover:bg-superficie-2 hover:text-tinta',
  peligro: 'bg-superficie text-mal border border-mal/40 hover:bg-mal-suave',
};

export function clasesBoton(variante: Variante = 'primario', chico = false) {
  return clsx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    chico ? 'h-9 px-3 text-sm' : 'h-11 px-5 text-[0.95rem]',
    VARIANTES[variante],
  );
}

export function Boton({
  variante = 'primario',
  chico,
  className,
  children,
  ...resto
}: { variante?: Variante; chico?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={clsx(clasesBoton(variante, chico), className)} {...resto}>
      {children}
    </button>
  );
}
