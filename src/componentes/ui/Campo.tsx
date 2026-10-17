import { clsx } from 'clsx';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const CONTROL =
  'w-full rounded-lg border border-linea-fuerte bg-superficie px-3.5 text-tinta placeholder:text-tinta-3 ' +
  'transition-colors focus:border-marca focus:outline-none focus:ring-3 focus:ring-marca/15 ' +
  'aria-[invalid=true]:border-mal read-only:bg-superficie-2 read-only:text-tinta-2';

type Base = { etiqueta: ReactNode; ayuda?: ReactNode; error?: string | false; className?: string };

function Envoltorio({ id, etiqueta, ayuda, error, className, children }: Base & { id: string; children: ReactNode }) {
  return (
    <div className={clsx('grid gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-tinta-2">
        {etiqueta}
      </label>
      {children}
      {error ? (
        <p id={id + '-error'} className="text-sm text-mal" role="alert">
          {error}
        </p>
      ) : ayuda ? (
        <p id={id + '-ayuda'} className="text-sm text-tinta-3">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}

function aria(id: string, error?: string | false, ayuda?: ReactNode) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? id + '-error' : ayuda ? id + '-ayuda' : undefined,
  } as const;
}

export function Campo({ etiqueta, ayuda, error, className, ...resto }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Envoltorio id={id} etiqueta={etiqueta} ayuda={ayuda} error={error} className={className}>
      <input className={clsx(CONTROL, 'h-11')} {...aria(id, error, ayuda)} {...resto} />
    </Envoltorio>
  );
}

export function Area({ etiqueta, ayuda, error, className, ...resto }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Envoltorio id={id} etiqueta={etiqueta} ayuda={ayuda} error={error} className={className}>
      <textarea className={clsx(CONTROL, 'min-h-28 py-2.5')} {...aria(id, error, ayuda)} {...resto} />
    </Envoltorio>
  );
}

export function Selector({ etiqueta, ayuda, error, className, children, ...resto }: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Envoltorio id={id} etiqueta={etiqueta} ayuda={ayuda} error={error} className={className}>
      <select className={clsx(CONTROL, 'h-11')} {...aria(id, error, ayuda)} {...resto}>
        {children}
      </select>
    </Envoltorio>
  );
}
