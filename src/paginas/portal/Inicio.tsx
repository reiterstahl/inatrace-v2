import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas } from '@/api/consultas';
import { Icono, type NombreIcono } from '@/componentes/ui/Icono';
import { Link } from '@tanstack/react-router';
import { enAnterior } from '@/util/entorno';

/** Estado de cada módulo en la migración. Se actualiza a medida que avanzan las fases. */
const MODULOS: { clave: string; icono: NombreIcono; enV2: boolean; anterior?: string; v2?: '/productores' | '/stock'; parcial?: boolean }[] = [
  { clave: 'vitrina', icono: 'qr', enV2: true },
  { clave: 'productores', icono: 'personas', enV2: true, v2: '/productores' },
  { clave: 'stock', icono: 'bodega', enV2: true, parcial: true, v2: '/stock', anterior: '/my-stock' },
  { clave: 'productos', icono: 'certificado', enV2: false, anterior: '/product-labels' },
  { clave: 'empresa', icono: 'web', enV2: false, anterior: '/home' },
];

export function Inicio() {
  const { t } = useTranslation();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  return (
    <div className="grid gap-10">
      <section className="max-w-2xl">
        <h1 className="font-titulo text-4xl font-semibold tracking-tight">{t('portal.hola', { nombre: yo.name || yo.email })}</h1>
        <p className="mt-3 text-lg leading-relaxed text-tinta-2">{t('portal.bienvenida')}</p>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-tinta-3 uppercase">{t('portal.modulos')}</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m) => (
            <li key={m.clave} className="flex flex-col gap-4 rounded-caja border border-linea bg-superficie p-5 shadow-suave">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-marca-suave text-marca">
                  <Icono nombre={m.icono} className="size-5" />
                </span>
                <span className={'rounded-full px-2.5 py-1 text-xs font-semibold ' + (m.parcial ? 'bg-aviso-suave text-aviso' : m.enV2 ? 'bg-ok-suave text-ok' : 'bg-superficie-2 text-tinta-3')}>
                  {m.parcial ? t('portal.en_parte') : m.enV2 ? t('portal.en_v2') : t('portal.en_actual')}
                </span>
              </div>
              <div>
                <h3 className="font-semibold">{t(`portal.modulo.${m.clave}`)}</h3>
                <p className="mt-1 text-sm text-tinta-2">{t(`portal.modulo.${m.clave}_desc`)}</p>
              </div>
              {m.v2 && (
                <Link to={m.v2} className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-marca hover:underline">
                  {t('portal.abrir')} <Icono nombre="flecha" className="size-3.5" />
                </Link>
              )}
              {m.anterior && (
                <a href={enAnterior(m.anterior)} className={(m.v2 ? '-mt-2 text-tinta-2' : 'mt-auto text-marca') + ' inline-flex items-center gap-1.5 text-sm font-semibold hover:underline'}>
                  {m.v2 ? t('portal.resto_actual') : t('portal.abrir')} <Icono nombre="externo" className="size-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
