import { useEffect } from 'react';
import { Link, Outlet, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas } from '@/api/consultas';
import { productos, useBorrarProducto } from '@/api/productos';
import type { ApiProduct } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono, type NombreIcono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { enAnterior } from '@/util/entorno';
import { esDuena } from '@/util/producto';

const ruta = getRouteApi('/portal/productos/$id');

type Destino = '/productos/$id' | '/productos/$id/vitrina' | '/productos/$id/empresas' | '/productos/$id/finales';
const PESTANAS: { to: Destino; clave: string; icono: NombreIcono; exacta?: boolean }[] = [
  { to: '/productos/$id', clave: 'productos.pestanas.ficha', icono: 'lista', exacta: true },
  { to: '/productos/$id/vitrina', clave: 'productos.pestanas.vitrina', icono: 'ruta' },
  { to: '/productos/$id/empresas', clave: 'productos.pestanas.empresas', icono: 'personas' },
  { to: '/productos/$id/finales', clave: 'productos.pestanas.finales', icono: 'taza' },
];
/** Lo que sigue en la versión actual (se migra en 5b–5d). */
const PENDIENTES: { clave: string; anterior: (id: string) => string }[] = [
  { clave: 'productos.pestanas.etiquetas', anterior: (id) => `/product-labels/${id}` },
  { clave: 'productos.pestanas.conocimiento', anterior: (id) => `/product-labels/${id}/knowledge-blog` },
];

const PESTANA = 'inline-flex h-11 shrink-0 items-center gap-2 rounded-t-lg border-b-2 border-transparent px-4 text-sm font-semibold text-tinta-2 hover:text-tinta';

/** Producto que se está viendo, para las pestañas (ya cargado por el marco). */
export function useProducto(): { producto: ApiProduct; editable: boolean; empresa: number } {
  const { id } = ruta.useParams();
  const empresa = useEmpresaActual();
  const { data } = useSuspenseQuery(productos.producto(Number(id)));
  return { producto: data, editable: !!empresa && esDuena(data, empresa.id), empresa: empresa?.id ?? 0 };
}

/** La administración del sistema o regional (asocia empresas a un producto). */
export function useAdministraEmpresas(): { puede: boolean; sistema: boolean } {
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  return { puede: yo.role === 'SYSTEM_ADMIN' || yo.role === 'REGIONAL_ADMIN', sistema: yo.role === 'SYSTEM_ADMIN' };
}

export function MarcoProducto() {
  const { t } = useTranslation();
  const { id } = ruta.useParams();
  const empresa = useEmpresaActual();
  const navegar = useNavigate();
  const borrar = useBorrarProducto();
  const consulta = useQuery(productos.producto(Number(id)));
  const p = consulta.data;
  const nombre = p?.name?.trim() || `#${id}`;
  useEffect(() => {
    document.title = `${nombre} · INATrace v2`;
  }, [nombre]);

  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} />;
  const producto = consulta.data;
  const editable = esDuena(producto, empresa.id);
  const duena = producto.associatedCompanies?.find((a) => a.type === 'OWNER')?.company?.name ?? producto.company?.name;

  async function eliminar() {
    if (!window.confirm(t('productos.borrar_pregunta', { nombre }))) return;
    try {
      await borrar.mutateAsync(producto.id!);
      await navegar({ to: '/productos' });
    } catch (x) {
      window.alert((x as Error).message);
    }
  }

  return (
    <div className="grid gap-6 pb-24 [&>*]:min-w-0">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/productos" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
            <Icono nombre="volver" className="size-4" /> {t('productos.titulo')}
          </Link>
          <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{nombre}</h1>
          <p className="mt-1 text-sm text-tinta-2">
            {[duena && t('productos.de_empresa', { empresa: duena }), producto.valueChain?.name && t('productos.cadena_de', { cadena: producto.valueChain.name })].filter(Boolean).join(' · ')}
          </p>
        </div>
        {editable && (
          <Boton variante="peligro" chico onClick={() => void eliminar()} disabled={borrar.isPending}>
            <Icono nombre="borrar" className="size-4" /> {t('productos.borrar')}
          </Boton>
        )}
      </header>

      {!editable && <Aviso tono="info" titulo={t('productos.solo_lectura_titulo')}>{t('productos.solo_lectura')}</Aviso>}

      <nav aria-label={t('productos.pestanas.titulo')} className="-mx-4 flex overflow-x-auto border-b border-linea px-4 sm:mx-0 sm:px-0">
        {PESTANAS.map((x) => (
          <Link key={x.to} to={x.to} params={{ id }} activeOptions={{ exact: !!x.exacta }} className={PESTANA} activeProps={{ className: '!border-marca !text-marca', 'aria-current': 'page' }}>
            <Icono nombre={x.icono} className="size-4" /> {t(x.clave)}
          </Link>
        ))}
        {PENDIENTES.map((x) => (
          <a key={x.clave} href={enAnterior(x.anterior(id))} className={PESTANA + ' font-medium text-tinta-3'} title={t('portal.en_actual')}>
            {t(x.clave)} <Icono nombre="externo" className="size-3.5" />
          </a>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
