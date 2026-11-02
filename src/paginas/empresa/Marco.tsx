import { useEffect } from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas } from '@/api/consultas';
import { empresa as consultasEmpresa } from '@/api/empresa';
import type { ApiCompanyGet } from '@/api/gen/types.gen';
import { urlImagen } from '@/api/respuesta';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono, type NombreIcono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';

type Destino = '/empresa' | '/empresa/usuarios' | '/empresa/instalaciones' | '/empresa/acciones' | '/empresa/clientes';
const PESTANAS: { to: Destino; clave: string; icono: NombreIcono; exacta?: boolean }[] = [
  { to: '/empresa', clave: 'empresa.pestanas.ficha', icono: 'lista', exacta: true },
  { to: '/empresa/usuarios', clave: 'empresa.pestanas.usuarios', icono: 'personas' },
  { to: '/empresa/instalaciones', clave: 'empresa.pestanas.instalaciones', icono: 'bodega' },
  { to: '/empresa/acciones', clave: 'empresa.pestanas.acciones', icono: 'ruta' },
  { to: '/empresa/clientes', clave: 'empresa.pestanas.clientes', icono: 'barco' },
];

const PESTANA = 'inline-flex h-11 shrink-0 items-center gap-2 rounded-t-lg border-b-2 border-transparent px-4 text-sm font-semibold text-tinta-2 hover:text-tinta';

/**
 * Empresa que se está viendo (la elegida arriba) y qué puede hacer la persona con ella. Editar la
 * ficha: la administración de la empresa o del sistema (como el backend). Sumar y quitar personas:
 * la administración del sistema o regional (como la versión actual, que es la que puede buscarlas).
 */
export function useEmpresaVista(): { id: number; ficha: ApiCompanyGet; editable: boolean; gestionaUsuarios: boolean; regional: boolean; yo: number } {
  const actual = useEmpresaActual();
  const id = actual?.id ?? 0;
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const { data: ficha } = useSuspenseQuery(consultasEmpresa.ficha(id));
  const sistema = yo.role === 'SYSTEM_ADMIN';
  const regional = yo.role === 'REGIONAL_ADMIN' && (yo.companyIds ?? []).includes(id);
  return { id, ficha, editable: sistema || (yo.companyIdsAdmin ?? []).includes(id), gestionaUsuarios: sistema || regional, regional: yo.role === 'REGIONAL_ADMIN', yo: yo.id ?? 0 };
}

export function MarcoEmpresa() {
  const { t } = useTranslation();
  const actual = useEmpresaActual();
  const consulta = useQuery({ ...consultasEmpresa.ficha(actual?.id ?? 0), enabled: !!actual });
  const nombre = consulta.data?.name?.trim() || actual?.nombre || '';
  useEffect(() => {
    document.title = `${nombre || t('empresa.titulo')} · INATrace v2`;
  }, [nombre, t]);

  if (!actual) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} />;
  const e = consulta.data;

  return (
    <div className="grid gap-6 pb-24 [&>*]:min-w-0">
      <header className="flex flex-wrap items-center gap-4">
        {e.logo?.storageKey ? (
          <img src={urlImagen(e.logo.storageKey, 'SMALL')} alt="" className="size-14 rounded-lg border border-linea bg-superficie object-contain" />
        ) : (
          <span className="grid size-14 place-items-center rounded-lg border border-dashed border-linea-fuerte text-tinta-3"><Icono nombre="web" className="size-6" /></span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-tinta-3">{t('empresa.titulo')}</p>
          <h1 className="font-titulo text-3xl font-semibold tracking-tight break-words">{nombre}</h1>
        </div>
      </header>

      <nav aria-label={t('empresa.pestanas.titulo')} className="-mx-4 flex overflow-x-auto border-b border-linea px-4 sm:mx-0 sm:px-0">
        {PESTANAS.map((x) => (
          <Link key={x.to} to={x.to} activeOptions={{ exact: !!x.exacta }} className={PESTANA} activeProps={{ className: '!border-marca !text-marca', 'aria-current': 'page' }}>
            <Icono nombre={x.icono} className="size-4" /> {t(x.clave)}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
