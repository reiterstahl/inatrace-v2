import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas } from '@/api/consultas';
import { Icono, type NombreIcono } from '@/componentes/ui/Icono';
import { Link } from '@tanstack/react-router';
import { esAdministracion } from '@/util/administracion';

/** Los módulos de la plataforma, con su entrada. La administración solo se muestra a quien administra. */
const MODULOS: { clave: string; icono: NombreIcono; v2?: '/productores' | '/stock' | '/productos' | '/empresa' | '/administracion'; admin?: true }[] = [
  { clave: 'vitrina', icono: 'qr' },
  { clave: 'productores', icono: 'personas', v2: '/productores' },
  { clave: 'stock', icono: 'bodega', v2: '/stock' },
  { clave: 'productos', icono: 'certificado', v2: '/productos' },
  { clave: 'empresa', icono: 'web', v2: '/empresa' },
  { clave: 'administracion', icono: 'lista', v2: '/administracion', admin: true },
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
          {MODULOS.filter((m) => !m.admin || esAdministracion(yo.role)).map((m) => (
            <li key={m.clave} className="flex flex-col gap-4 rounded-caja border border-linea bg-superficie p-5 shadow-suave">
              <span className="grid size-11 place-items-center rounded-xl bg-marca-suave text-marca">
                <Icono nombre={m.icono} className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">{t(`portal.modulo.${m.clave}`)}</h3>
                <p className="mt-1 text-sm text-tinta-2">{t(`portal.modulo.${m.clave}_desc`)}</p>
              </div>
              {m.v2 && (
                <Link to={m.v2} className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-marca hover:underline">
                  {t('portal.abrir')} <Icono nombre="flecha" className="size-3.5" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
