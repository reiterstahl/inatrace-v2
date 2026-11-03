import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas, useSalir } from '@/api/consultas';
import { Icono, type NombreIcono } from '@/componentes/ui/Icono';
import { InterruptorTema, Logo, SelectorIdioma } from '@/componentes/ui/Preferencias';
import { enAnterior } from '@/util/entorno';
import { SelectorEmpresa } from '@/componentes/SelectorEmpresa';
import { esAdministracion } from '@/util/administracion';

const NAV: { to: '/' | '/productores' | '/stock' | '/productos' | '/empresa' | '/administracion'; clave: string; icono: NombreIcono; exacto?: boolean; admin?: true }[] = [
  { to: '/', clave: 'portal.inicio', icono: 'inicio', exacto: true },
  { to: '/productores', clave: 'portal.productores', icono: 'personas' },
  { to: '/stock', clave: 'portal.stock', icono: 'bodega' },
  { to: '/productos', clave: 'portal.productos', icono: 'certificado' },
  { to: '/empresa', clave: 'portal.empresa', icono: 'web' },
  { to: '/administracion', clave: 'portal.administracion', icono: 'lista', admin: true },
];

export function Marco() {
  const { t } = useTranslation();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const salir = useSalir();
  const navegar = useNavigate();
  const admin = esAdministracion(yo.role);
  const nombre = [yo.name, yo.surname].filter(Boolean).join(' ') || yo.email || '';
  const iniciales = nombre.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  async function cerrar() {
    await salir.mutateAsync().catch(() => undefined);
    await navegar({ to: '/ingreso', search: {} });
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-linea bg-superficie/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:gap-6 sm:px-6">
          <Link to="/" aria-label="INATrace">
            <Logo compacto />
          </Link>
          <nav className="flex items-center gap-1" aria-label="Principal">
            {NAV.filter((n) => !n.admin || admin).map((n) => (
              <Link
                key={n.to}
                to={n.to}
                aria-label={t(n.clave)}
                title={admin ? t(n.clave) : undefined}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-tinta-2 hover:bg-superficie-2 hover:text-tinta sm:px-3"
                activeProps={{ className: 'bg-marca-suave !text-marca' }}
                activeOptions={{ exact: !!n.exacto }}
              >
                <Icono nombre={n.icono} className="size-4" />
                {/* Con la entrada de la administración no entran los textos de las seis: solo si sobra lugar. */}
                <span className={'hidden whitespace-nowrap ' + (admin ? '2xl:inline' : 'md:inline')}>{t(n.clave)}</span>
              </Link>
            ))}
            {/* Con la entrada de la administración no entra en el celular: queda en las tarjetas del inicio. */}
            <a href={enAnterior('/home')} aria-label={t('portal.version_actual')} className={(admin ? 'hidden sm:inline-flex' : 'inline-flex') + ' h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-tinta-3 hover:bg-superficie-2 hover:text-tinta sm:px-3'}>
              <Icono nombre="externo" className="size-4" />
              <span className="hidden whitespace-nowrap 2xl:inline">{t('portal.version_actual')}</span>
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <SelectorEmpresa />
            {/* Envuelto: el propio selector es inline-flex y le ganaría a un "hidden". */}
            <div className="hidden sm:block">
              <SelectorIdioma />
            </div>
            <InterruptorTema />
            {/* El avatar lleva al perfil (en el celular no hay lugar para otra entrada en la barra). */}
            <Link
              to="/perfil"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-acento-suave text-sm font-bold text-acento ring-marca hover:ring-2 sm:ml-2"
              activeProps={{ className: 'ring-2' }}
              title={`${t('portal.perfil')} · ${nombre}`}
              aria-label={t('portal.perfil')}
            >
              {iniciales || '·'}
            </Link>
            <button type="button" onClick={cerrar} className="grid size-9 place-items-center rounded-lg text-tinta-2 hover:bg-superficie-2" title={t('portal.salir')} aria-label={t('portal.salir')}>
              <Icono nombre="salir" className="size-[1.1rem]" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <Outlet />
      </main>
    </div>
  );
}
