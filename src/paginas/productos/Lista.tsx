import { useEffect, useState } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas } from '@/api/consultas';
import { POR_PAGINA_PRODUCTOS, productos } from '@/api/productos';
import { urlImagen } from '@/api/respuesta';
import { Boton, clasesBoton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';

const ruta = getRouteApi('/portal/productos/');

export function ListaProductos() {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const filtro = ruta.useSearch();
  const navegar = useNavigate({ from: '/productos/' });
  const fijar = (c: Partial<typeof filtro>) => navegar({ search: (s) => ({ ...s, ...c }), replace: true });
  const [texto, setTexto] = useState(filtro.q ?? '');
  const esAdmin = yo.role === 'SYSTEM_ADMIN';
  const pagina = filtro.pagina ?? 1;
  const consulta = useQuery(productos.lista({ nombre: filtro.q, pagina, todos: esAdmin && filtro.todos }));

  // La búsqueda se aplica al dejar de escribir.
  useEffect(() => {
    const id = setTimeout(() => {
      if ((filtro.q ?? '') !== texto.trim()) fijar({ q: texto.trim() || undefined, pagina: undefined });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);
  useEffect(() => {
    document.title = `${t('productos.titulo')} · INATrace v2`;
  }, [t]);

  const total = consulta.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_PRODUCTOS));

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-titulo text-3xl font-semibold tracking-tight">{t('productos.titulo')}</h1>
          <p className="mt-1 max-w-2xl text-tinta-2">{t('productos.descripcion')}</p>
        </div>
        {empresa && (
          <Link to="/productos/nuevo" className={clasesBoton('primario')}>
            <Icono nombre="mas" className="size-4" /> {t('productos.nuevo')}
          </Link>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-64 flex-1 gap-1 text-sm sm:max-w-sm">
          <span className="font-semibold text-tinta-2">{t('productos.buscar')}</span>
          <span className="relative">
            <Icono nombre="buscar" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-3" />
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t('productos.buscar_placeholder')} className="h-11 w-full rounded-lg border border-linea-fuerte bg-superficie pr-3 pl-9" />
          </span>
        </label>
        {esAdmin && (
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium text-tinta-2">
            <input type="checkbox" className="size-4 accent-[var(--marca)]" checked={!!filtro.todos} onChange={(e) => fijar({ todos: e.target.checked || undefined, pagina: undefined })} />
            {t('productos.todos')}
          </label>
        )}
      </div>

      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <EstadoError reintentar={() => void consulta.refetch()} />
      ) : total === 0 ? (
        <div className="rounded-caja border border-dashed border-linea-fuerte p-10 text-center text-tinta-2">{filtro.q ? t('productos.sin_resultados') : t('productos.vacio')}</div>
      ) : (
        <>
          <p className="text-sm text-tinta-2">{t('productos.total', { count: total })}</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(consulta.data.items ?? []).map((p) => (
              <li key={p.id}>
                <Link to="/productos/$id" params={{ id: String(p.id) }} className="group flex items-center gap-4 rounded-caja border border-linea bg-superficie p-3 shadow-suave hover:border-marca">
                  {p.photoStorageId ? (
                    <img src={urlImagen(p.photoStorageId, 'SMALL')} alt="" className="size-20 shrink-0 rounded-lg bg-superficie-2 object-cover" loading="lazy" />
                  ) : (
                    <span className="grid size-20 shrink-0 place-items-center rounded-lg bg-superficie-2 text-tinta-3"><Icono nombre="certificado" className="size-7" /></span>
                  )}
                  <span className="min-w-0 font-semibold group-hover:text-marca">{p.name || `#${p.id}`}</span>
                </Link>
              </li>
            ))}
          </ul>
          {paginas > 1 && (
            <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t('productores.paginacion')}>
              <span className="text-tinta-2">{t('productores.pagina', { pagina, total: paginas })}</span>
              <div className="flex gap-2">
                <Boton variante="secundario" chico disabled={pagina <= 1} onClick={() => fijar({ pagina: pagina - 1 || undefined })}>{t('productores.anterior')}</Boton>
                <Boton variante="secundario" chico disabled={pagina >= paginas} onClick={() => fijar({ pagina: pagina + 1 })}>{t('productores.siguiente')}</Boton>
              </div>
            </nav>
          )}
        </>
      )}
      {!empresa && <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>}
    </div>
  );
}
