import { useId, type ReactNode } from 'react';
import { useFormContext, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { FormProductor } from './esquema';

/** Mensaje de error de un campo, traducido (el esquema guarda claves: "requerido", "numero"…). */
export function useErrorDe() {
  const { t } = useTranslation();
  const { formState, getFieldState } = useFormContext<FormProductor>();
  return (campo: FieldPath<FormProductor>) => {
    const e = getFieldState(campo, formState).error;
    return e?.message ? t(`productores.errores.${e.message}`, { defaultValue: t('productores.errores.invalido') }) : undefined;
  };
}

const CONTROL =
  'w-full rounded-lg border border-linea-fuerte bg-superficie px-3.5 text-tinta placeholder:text-tinta-3 transition-colors ' +
  'focus:border-marca focus:outline-none focus:ring-3 focus:ring-marca/15 aria-[invalid=true]:border-mal';

/**
 * Valor de un selector numérico. React Hook Form también llama con null/undefined al registrar
 * el campo, y Number(null) es 0: eso marcaba la ficha como modificada apenas se abría.
 */
export const aNumeroONulo = (v: unknown): number | null => (v === '' || v === null || v === undefined ? null : Number(v));

/** Campo de texto conectado al formulario. */
export function CampoForm({
  nombre,
  etiqueta,
  ayuda,
  requerido,
  className,
  ...resto
}: { nombre: FieldPath<FormProductor>; etiqueta: ReactNode; ayuda?: ReactNode; requerido?: boolean; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'>) {
  const id = useId();
  const { register } = useFormContext<FormProductor>();
  const error = useErrorDe()(nombre);
  return (
    <div className={clsx('grid content-start gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-tinta-2">
        {etiqueta}
        {requerido && <span className="text-mal" aria-hidden="true"> *</span>}
      </label>
      <input id={id} className={clsx(CONTROL, 'h-11')} aria-invalid={!!error} aria-required={requerido} aria-describedby={error ? id + '-e' : ayuda ? id + '-a' : undefined} {...register(nombre)} {...resto} />
      {error ? <p id={id + '-e'} role="alert" className="text-sm text-mal">{error}</p> : ayuda ? <p id={id + '-a'} className="text-sm text-tinta-3">{ayuda}</p> : null}
    </div>
  );
}

export function SelectorForm({
  nombre,
  etiqueta,
  requerido,
  className,
  children,
  comoNumero,
  ayuda,
}: { nombre: FieldPath<FormProductor>; etiqueta: ReactNode; requerido?: boolean; className?: string; children: ReactNode; comoNumero?: boolean; ayuda?: ReactNode }) {
  const id = useId();
  const { register } = useFormContext<FormProductor>();
  const error = useErrorDe()(nombre);
  return (
    <div className={clsx('grid content-start gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-tinta-2">
        {etiqueta}
        {requerido && <span className="text-mal" aria-hidden="true"> *</span>}
      </label>
      <select
        id={id}
        className={clsx(CONTROL, 'h-11')}
        aria-invalid={!!error}
        aria-required={requerido}
        {...register(nombre, comoNumero ? { setValueAs: aNumeroONulo } : undefined)}
      >
        {children}
      </select>
      {error ? <p role="alert" className="text-sm text-mal">{error}</p> : ayuda ? <p className="text-sm text-tinta-3">{ayuda}</p> : null}
    </div>
  );
}

export function Casilla({ nombre, children }: { nombre: FieldPath<FormProductor>; children: ReactNode }) {
  const { register } = useFormContext<FormProductor>();
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--marca)]" {...register(nombre)} />
      <span>{children}</span>
    </label>
  );
}

/** Tarjeta de una sección de la ficha, con ancla para el índice lateral. */
export function Seccion({ id, titulo, descripcion, children, acciones }: { id: string; titulo: string; descripcion?: string; children: ReactNode; acciones?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id + '-t'} className="scroll-mt-24 rounded-caja border border-linea bg-superficie p-5 shadow-suave sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id + '-t'} className="font-titulo text-xl font-semibold">{titulo}</h2>
          {descripcion && <p className="mt-1 text-sm text-tinta-2">{descripcion}</p>}
        </div>
        {acciones}
      </div>
      {children}
    </section>
  );
}
