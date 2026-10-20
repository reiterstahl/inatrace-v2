import { useId, type ReactNode } from 'react';
import { useFormContext, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { aDecimal, aNumeroONulo } from './esquema';

/** Ruta del campo: "bruto" en una entrega, "filas.2.bruto" en la masiva. */
type Campo = string;

export const CONTROL =
  'w-full rounded-lg border border-linea-fuerte bg-superficie px-3.5 text-tinta placeholder:text-tinta-3 transition-colors ' +
  'focus:border-marca focus:outline-none focus:ring-3 focus:ring-marca/15 aria-[invalid=true]:border-mal disabled:bg-superficie-2 disabled:text-tinta-2';

export function useErrorEntrega() {
  const { t } = useTranslation();
  const { formState, getFieldState } = useFormContext<FieldValues>();
  return (c: Campo) => {
    const e = getFieldState(c, formState).error;
    return e?.message ? t(`stock.errores.${e.message}`, { defaultValue: t('stock.errores.invalido') }) : undefined;
  };
}

function Envoltura({ id, etiqueta, requerido, error, ayuda, className, children }: { id: string; etiqueta: ReactNode; requerido?: boolean; error?: string; ayuda?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={clsx('grid content-start gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-tinta-2">
        {etiqueta}
        {requerido && <span className="text-mal" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error ? <p id={id + '-e'} role="alert" className="text-sm text-mal">{error}</p> : ayuda ? <p id={id + '-a'} className="text-sm text-tinta-3">{ayuda}</p> : null}
    </div>
  );
}

/** Texto, fecha o número decimal (acepta coma). Con `unidad`, la muestra a la derecha. */
export function CampoE({
  nombre,
  etiqueta,
  requerido,
  ayuda,
  decimal,
  unidad,
  className,
  ...resto
}: { nombre: Campo; etiqueta: ReactNode; requerido?: boolean; ayuda?: ReactNode; decimal?: boolean; unidad?: string; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'>) {
  const id = useId();
  const { register } = useFormContext<FieldValues>();
  const error = useErrorEntrega()(nombre);
  const control = (
    <input
      id={id}
      className={clsx(unidad ? 'h-full min-w-0 flex-1 bg-transparent px-3.5 text-tinta outline-none' : clsx(CONTROL, 'h-11'), decimal && 'text-right tabular-nums')}
      aria-invalid={!!error}
      aria-required={requerido}
      aria-describedby={error ? id + '-e' : ayuda ? id + '-a' : undefined}
      {...(decimal ? { inputMode: 'decimal' as const, autoComplete: 'off' } : {})}
      {...register(nombre, decimal ? { setValueAs: aDecimal } : undefined)}
      {...resto}
    />
  );
  return (
    <Envoltura id={id} etiqueta={etiqueta} requerido={requerido} error={error} ayuda={ayuda} className={className}>
      {unidad ? (
        <span
          className="flex h-11 overflow-hidden rounded-lg border border-linea-fuerte bg-superficie transition-colors focus-within:border-marca focus-within:ring-3 focus-within:ring-marca/15 has-[[aria-invalid=true]]:border-mal"
        >
          {control}
          <span className="grid shrink-0 place-items-center border-l border-linea bg-superficie-2 px-3 text-sm whitespace-nowrap text-tinta-2" aria-hidden="true">{unidad}</span>
        </span>
      ) : (
        control
      )}
    </Envoltura>
  );
}

export function SelectorE({ nombre, etiqueta, requerido, ayuda, comoNumero, className, disabled, children }: { nombre: Campo; etiqueta: ReactNode; requerido?: boolean; ayuda?: ReactNode; comoNumero?: boolean; className?: string; disabled?: boolean; children: ReactNode }) {
  const id = useId();
  const { register } = useFormContext<FieldValues>();
  const error = useErrorEntrega()(nombre);
  return (
    <Envoltura id={id} etiqueta={etiqueta} requerido={requerido} error={error} ayuda={ayuda} className={className}>
      <select id={id} disabled={disabled} className={clsx(CONTROL, 'h-11')} aria-invalid={!!error} aria-required={requerido} aria-describedby={error ? id + '-e' : ayuda ? id + '-a' : undefined} {...register(nombre, comoNumero ? { setValueAs: aNumeroONulo } : undefined)}>
        {children}
      </select>
    </Envoltura>
  );
}

/** Sí / No como dos botones de opción (más rápido que un selector al cargar muchas entregas). */
export function SiNoE({ nombre, etiqueta, requerido }: { nombre: Campo; etiqueta: ReactNode; requerido?: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  const { register } = useFormContext<FieldValues>();
  const error = useErrorEntrega()(nombre);
  return (
    <fieldset className="grid content-start gap-1.5" aria-invalid={!!error} aria-describedby={error ? id + '-e' : undefined}>
      <legend className="mb-1.5 text-sm font-semibold text-tinta-2">
        {etiqueta}
        {requerido && <span className="text-mal" aria-hidden="true"> *</span>}
      </legend>
      <div className="inline-flex w-fit rounded-lg bg-superficie-2 p-1">
        {(['si', 'no'] as const).map((v) => (
          <label key={v} className="cursor-pointer">
            <input type="radio" value={v} className="peer sr-only" {...register(nombre)} />
            <span className="inline-flex h-9 min-w-16 items-center justify-center rounded-md px-3 text-sm font-semibold text-tinta-2 peer-checked:bg-superficie peer-checked:text-tinta peer-checked:shadow-suave peer-focus-visible:ring-3 peer-focus-visible:ring-marca/30">
              {t(`comun.${v}`)}
            </span>
          </label>
        ))}
      </div>
      {error && <p id={id + '-e'} role="alert" className="text-sm text-mal">{error}</p>}
    </fieldset>
  );
}

export function Bloque({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={clsx('rounded-caja border border-linea bg-superficie p-5 shadow-suave sm:p-6', className)}>
      <h2 id={id} className="mb-5 font-titulo text-xl font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}
