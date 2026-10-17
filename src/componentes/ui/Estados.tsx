import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Boton } from './Boton';
import { Icono, type NombreIcono } from './Icono';

export function Cargando({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={clsx('grid place-items-center py-16', className)} role="status">
      <span className="size-8 animate-spin rounded-full border-3 border-linea border-t-marca" />
      <span className="sr-only">{t('comun.cargando')}</span>
    </div>
  );
}

const TONOS = {
  ok: 'bg-ok-suave text-ok',
  aviso: 'bg-aviso-suave text-aviso',
  mal: 'bg-mal-suave text-mal',
  info: 'bg-info-suave text-info',
} as const;
const ICONOS: Record<keyof typeof TONOS, NombreIcono> = { ok: 'ok', aviso: 'alerta', mal: 'alerta', info: 'alerta' };

export function Aviso({ tono = 'info', titulo, children }: { tono?: keyof typeof TONOS; titulo?: ReactNode; children?: ReactNode }) {
  return (
    <div className={clsx('flex gap-3 rounded-caja p-4', TONOS[tono])} role={tono === 'mal' ? 'alert' : 'status'}>
      <Icono nombre={ICONOS[tono]} className="mt-0.5 size-5 shrink-0" />
      <div className="text-sm leading-relaxed">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className="text-tinta-2">{children}</div>}
      </div>
    </div>
  );
}

export function EstadoError({ titulo, texto, reintentar }: { titulo?: ReactNode; texto?: ReactNode; reintentar?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-3 px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-mal-suave text-mal">
        <Icono nombre="alerta" className="size-6" />
      </span>
      <h2 className="font-titulo text-2xl">{titulo ?? t('comun.error_titulo')}</h2>
      <p className="text-tinta-2">{texto ?? t('comun.error_texto')}</p>
      {reintentar && (
        <Boton variante="secundario" onClick={reintentar}>
          {t('comun.reintentar')}
        </Boton>
      )}
    </div>
  );
}
