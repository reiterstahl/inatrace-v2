import { useTranslation } from 'react-i18next';
import { urlDocumento } from '@/api/respuesta';
import { Icono } from '@/componentes/ui/Icono';
import { useVitrina } from './datos';
import { Seccion } from './Vitrina';

const REFERENCIA_SCA = 80;

export function Calidad() {
  const d = useVitrina();
  const { t } = useTranslation();
  const puntaje = d.qr?.cuppingScore;
  const certificados = d.qr?.certificates ?? [];

  return (
    <Seccion titulo={t('vitrina.calidad.titulo')}>
      <div className="grid gap-10">
        {d.ajustes.graphicQuality && (
          <section className="rounded-caja border border-linea bg-superficie p-6 shadow-suave">
            <h2 className="text-sm font-semibold tracking-wide text-tinta-3 uppercase">{t('vitrina.calidad.puntaje')}</h2>
            {puntaje ? (
              <>
                <p className="mt-2 font-titulo text-5xl font-semibold text-marca tabular-nums">{t('vitrina.calidad.puntos', { puntos: puntaje })}</p>
                <Escala puntaje={puntaje} />
                <p className="mt-4 text-sm text-tinta-2">{t('vitrina.calidad.explicacion', { producto: d.producto })}</p>
              </>
            ) : (
              <p className="mt-2 text-tinta-2">{t('vitrina.calidad.sin_puntaje')}</p>
            )}
          </section>
        )}

        <dl className="grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="font-titulo text-xl font-semibold">{t('vitrina.calidad.perfil_sabor')}</dt>
            <dd className="mt-1 text-tinta-2">{d.qr?.cuppingFlavour || '—'}</dd>
          </div>
          <div>
            <dt className="font-titulo text-xl font-semibold">{t('vitrina.calidad.perfil_tueste')}</dt>
            <dd className="mt-1 text-tinta-2">{d.qr?.roastingProfile || '—'}</dd>
          </div>
        </dl>

        <section>
          <h2 className="font-titulo text-2xl font-semibold">{t('vitrina.calidad.certificados')}</h2>
          {certificados.length === 0 ? (
            <p className="mt-2 text-tinta-2">{t('vitrina.calidad.sin_certificados')}</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {certificados.map((c, i) => (
                <li key={c.id ?? i} className="flex items-start gap-4 rounded-caja border border-linea bg-superficie p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca-suave text-marca">
                    <Icono nombre="certificado" className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.type}</p>
                    {c.validity && <p className="text-sm text-tinta-3">{t('vitrina.calidad.valido', { fecha: c.validity })}</p>}
                    {c.description && <p className="mt-1 text-sm text-tinta-2">{c.description}</p>}
                  </div>
                  {c.certificate?.storageKey && (
                    <a href={urlDocumento(c.certificate.storageKey)} download={c.certificate.name ?? true} aria-label={`${t('vitrina.calidad.descargar')}: ${c.type ?? ''}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-linea-fuerte px-3 text-sm font-semibold hover:bg-superficie-2">
                      <Icono nombre="descarga" className="size-4" />
                      <span className="hidden sm:inline">{t('vitrina.calidad.descargar')}</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Seccion>
  );
}

/** Escala de 60 a 100 puntos con la marca de café de especialidad en 80. */
function Escala({ puntaje }: { puntaje: number }) {
  const { t } = useTranslation();
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - 60) / 40) * 100))}%`;
  return (
    <div className="mt-6" aria-hidden="true">
      <div className="relative h-3 rounded-full bg-superficie-2">
        <div className="h-full rounded-full bg-marca" style={{ width: pos(puntaje) }} />
        <div className="absolute -top-1.5 h-6 w-0.5 bg-tinta" style={{ left: pos(REFERENCIA_SCA) }} />
      </div>
      <div className="relative mt-2 h-5 text-xs text-tinta-3">
        <span className="absolute left-0">60</span>
        <span className="absolute -translate-x-1/2 font-semibold whitespace-nowrap text-tinta" style={{ left: pos(REFERENCIA_SCA) }}>
          {t('vitrina.calidad.referencia')}
        </span>
        <span className="absolute right-0">100</span>
      </div>
    </div>
  );
}
