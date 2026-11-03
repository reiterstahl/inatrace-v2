import { useEffect } from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas } from '@/api/consultas';
import { Aviso } from '@/componentes/ui/Estados';
import { Icono, type NombreIcono } from '@/componentes/ui/Icono';
import { esAdministracion } from '@/util/administracion';

const PESTANAS: { to: '/administracion/empresas' | '/administracion/usuarios' | '/administracion/cadenas'; clave: string; icono: NombreIcono }[] = [
  { to: '/administracion/empresas', clave: 'administracion.pestanas.empresas', icono: 'web' },
  { to: '/administracion/usuarios', clave: 'administracion.pestanas.usuarios', icono: 'personas' },
  { to: '/administracion/cadenas', clave: 'administracion.pestanas.cadenas', icono: 'ruta' },
];

const PESTANA = 'inline-flex h-11 shrink-0 items-center gap-2 rounded-t-lg border-b-2 border-transparent px-4 text-sm font-semibold text-tinta-2 hover:text-tinta';

/** Administración de la instancia: solo para la administración del sistema y la regional. */
export function MarcoAdministracion() {
  const { t } = useTranslation();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  useEffect(() => {
    document.title = `${t('administracion.titulo')} · INATrace v2`;
  }, [t]);

  if (!esAdministracion(yo.role)) return <Aviso tono="info">{t('administracion.sin_permiso')}</Aviso>;
  return (
    <div className="grid gap-6 pb-24 [&>*]:min-w-0">
      <header>
        <h1 className="font-titulo text-3xl font-semibold tracking-tight">{t('administracion.titulo')}</h1>
        <p className="mt-1 text-tinta-2">{t(yo.role === 'SYSTEM_ADMIN' ? 'administracion.subtitulo_sistema' : 'administracion.subtitulo_regional')}</p>
      </header>
      <nav aria-label={t('administracion.pestanas.titulo')} className="-mx-4 flex overflow-x-auto border-b border-linea px-4 sm:mx-0 sm:px-0">
        {PESTANAS.map((x) => (
          <Link key={x.to} to={x.to} className={PESTANA} activeProps={{ className: '!border-marca !text-marca', 'aria-current': 'page' }}>
            <Icono nombre={x.icono} className="size-4" /> {t(x.clave)}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
