import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { POR_PAGINA, exportarProductores, productores, useBorrarProductor } from '@/api/productores';
import type { ApiUserCustomer } from '@/api/gen/types.gen';
import { Boton, clasesBoton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { coordenadasDe, nombreCompleto, ubicacionCorta } from '@/util/productor';
import type { ParcelaEnMapa } from '@/componentes/mapa/MapaParcelas';

const MapaParcelas = lazy(() => import('@/componentes/mapa/MapaParcelas'));
const ruta = getRouteApi('/portal/productores/');

export function ListaProductores() {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  return <Contenido empresa={empresa.id} nombreEmpresa={empresa.nombre} />;
}

function Contenido({ empresa, nombreEmpresa }: { empresa: number; nombreEmpresa: string }) {
  const { t } = useTranslation();
  const filtro = ruta.useSearch();
  const navegar = useNavigate({ from: '/productores/' });
  const fijar = (cambios: Partial<typeof filtro>) => navegar({ search: (s) => ({ ...s, ...cambios }), replace: true });
  // La búsqueda espera a que se deje de escribir, para no consultar por cada tecla.
  const [texto, setTexto] = useState(filtro.q ?? '');
  useEffect(() => {
    if (texto === (filtro.q ?? '')) return;
    const espera = setTimeout(() => fijar({ q: texto || undefined, pagina: undefined }), 300);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consulta = useQuery(
    productores.lista(empresa, {
      texto: filtro.q ?? '',
      buscarPor: filtro.por ?? 'BY_NAME',
      orden: { campo: filtro.orden ?? 'BY_NAME', sentido: filtro.sentido ?? 'ASC' },
      pagina: filtro.pagina ?? 1,
    }),
  );
  const total = consulta.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  async function exportar() {
    setExportando(true);
    setError(null);
    try {
      await exportarProductores(empresa);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-titulo text-3xl font-semibold tracking-tight">{t('productores.titulo')}</h1>
          <p className="mt-1 text-tinta-2">{consulta.data ? t('productores.subtitulo', { count: total, empresa: nombreEmpresa }) : nombreEmpresa}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/productores/importar" className={clasesBoton('secundario')}>
            <Icono nombre="subir" className="size-4" /> {t('productores.importar')}
          </Link>
          <Boton variante="secundario" onClick={exportar} disabled={exportando || total === 0}>
            <Icono nombre="descarga" className="size-4" /> {exportando ? t('comun.cargando') : t('productores.exportar')}
          </Boton>
          <Link to="/productores/nuevo" className={clasesBoton('primario')}>
            <Icono nombre="mas" className="size-4" /> {t('productores.nuevo')}
          </Link>
        </div>
      </header>

      {error && <Aviso tono="mal">{error}</Aviso>}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-linea-fuerte bg-superficie px-3 focus-within:border-marca focus-within:ring-3 focus-within:ring-marca/15 sm:max-w-md">
          <Icono nombre="buscar" className="size-4 shrink-0 text-tinta-3" />
          <span className="sr-only">{t('productores.buscar')}</span>
          <input
            type="search"
            value={texto}
            placeholder={t('productores.buscar')}
            onChange={(e) => setTexto(e.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
          <select
            value={filtro.por ?? 'BY_NAME'}
            onChange={(e) => fijar({ por: e.target.value as 'BY_NAME' | 'BY_SURNAME', pagina: undefined })}
            aria-label={t('productores.buscar_en')}
            className="cursor-pointer bg-transparent text-sm text-tinta-2 outline-none"
          >
            <option value="BY_NAME">{t('productores.buscar_por.BY_NAME')}</option>
            <option value="BY_SURNAME">{t('productores.buscar_por.BY_SURNAME')}</option>
          </select>
        </label>
        <div className="ml-auto inline-flex rounded-lg bg-superficie-2 p-1" role="group" aria-label={t('productores.vista.etiqueta')}>
          {(['lista', 'mapa'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => fijar({ vista: v === 'lista' ? undefined : v })}
              aria-pressed={(filtro.vista ?? 'lista') === v}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-tinta-2 aria-pressed:bg-superficie aria-pressed:text-tinta aria-pressed:shadow-suave"
            >
              <Icono nombre={v === 'lista' ? 'lista' : 'mapa'} className="size-4" /> {t(`productores.vista.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {filtro.vista === 'mapa' ? (
        <VistaMapa empresa={empresa} />
      ) : consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <EstadoError reintentar={() => void consulta.refetch()} />
      ) : (consulta.data?.items ?? []).length === 0 ? (
        <div className="rounded-caja border border-dashed border-linea-fuerte p-10 text-center text-tinta-2">
          {filtro.q ? t('productores.sin_resultados') : t('productores.vacio')}
        </div>
      ) : (
        <>
          <Tabla items={consulta.data!.items!} empresa={empresa} orden={filtro.orden ?? 'BY_NAME'} sentido={filtro.sentido ?? 'ASC'} alOrdenar={(campo, sentido) => fijar({ orden: campo, sentido, pagina: undefined })} />
          {paginas > 1 && (
            <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t('productores.paginacion')}>
              <span className="text-tinta-2">{t('productores.pagina', { pagina: filtro.pagina ?? 1, total: paginas })}</span>
              <div className="flex gap-2">
                <Boton variante="secundario" chico disabled={(filtro.pagina ?? 1) <= 1} onClick={() => fijar({ pagina: (filtro.pagina ?? 1) - 1 || undefined })}>
                  <Icono nombre="izquierda" className="size-4" /> {t('productores.anterior')}
                </Boton>
                <Boton variante="secundario" chico disabled={(filtro.pagina ?? 1) >= paginas} onClick={() => fijar({ pagina: (filtro.pagina ?? 1) + 1 })}>
                  {t('productores.siguiente')} <Icono nombre="derecha" className="size-4" />
                </Boton>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

type Campo = 'BY_NAME' | 'BY_SURNAME' | 'BY_ID';

function Tabla({ items, empresa, orden, sentido, alOrdenar }: { items: ApiUserCustomer[]; empresa: number; orden: Campo; sentido: 'ASC' | 'DESC'; alOrdenar: (c: Campo, s: 'ASC' | 'DESC') => void }) {
  const { t } = useTranslation();
  const borrar = useBorrarProductor(empresa);
  const encabezado = (campo: Campo, texto: string) => {
    const activo = orden === campo;
    return (
      <th scope="col" aria-sort={activo ? (sentido === 'ASC' ? 'ascending' : 'descending') : undefined} className="px-4 py-3 font-semibold">
        <button type="button" onClick={() => alOrdenar(campo, activo && sentido === 'ASC' ? 'DESC' : 'ASC')} className="inline-flex items-center gap-1 hover:text-tinta">
          {texto} <span aria-hidden="true" className={activo ? 'text-marca' : 'text-tinta-3/50'}>{activo && sentido === 'DESC' ? '↓' : '↑'}</span>
        </button>
      </th>
    );
  };
  async function confirmarBorrado(p: ApiUserCustomer) {
    if (!window.confirm(t('productores.borrar_confirmar', { nombre: nombreCompleto(p) }))) return;
    await borrar.mutateAsync(p.id!).catch(() => undefined);
  }
  return (
    <>
      {borrar.isError && <Aviso tono="mal">{borrar.error.message}</Aviso>}
      {/* Escritorio: tabla. Celular: tarjetas (la misma información). */}
      <div className="hidden overflow-hidden rounded-caja border border-linea bg-superficie shadow-suave md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-linea bg-superficie-2 text-tinta-2">
            <tr>
              {encabezado('BY_ID', t('productores.columnas.id'))}
              {encabezado('BY_NAME', t('productores.columnas.nombre'))}
              {encabezado('BY_SURNAME', t('productores.columnas.apellido'))}
              <th scope="col" className="px-4 py-3 font-semibold">{t('productores.columnas.ubicacion')}</th>
              <th scope="col" className="px-4 py-3 font-semibold">{t('productores.columnas.telefono')}</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">{t('productores.columnas.acciones')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-superficie-2/60">
                <td className="px-4 py-3 text-tinta-3 tabular-nums">{p.farmerCompanyInternalId || p.id}</td>
                <td className="px-4 py-3 font-semibold">
                  <Link to="/productores/$id" params={{ id: String(p.id) }} className="hover:text-marca hover:underline">{p.name}</Link>
                </td>
                <td className="px-4 py-3">{p.surname}</td>
                <td className="px-4 py-3 text-tinta-2">{ubicacionCorta(p.location?.address) || '—'}</td>
                <td className="px-4 py-3 text-tinta-2">{p.phone || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => confirmarBorrado(p)} className="rounded-md p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('productores.borrar_de', { nombre: nombreCompleto(p) })}>
                    <Icono nombre="borrar" className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-3 md:hidden">
        {items.map((p) => (
          <li key={p.id}>
            <Link to="/productores/$id" params={{ id: String(p.id) }} className="flex items-center gap-3 rounded-caja border border-linea bg-superficie p-4 shadow-suave">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-marca-suave font-bold text-marca">{(p.name?.[0] ?? '') + (p.surname?.[0] ?? '')}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{nombreCompleto(p)}</span>
                <span className="block truncate text-sm text-tinta-2">{ubicacionCorta(p.location?.address) || p.phone || `#${p.farmerCompanyInternalId || p.id}`}</span>
              </span>
              <Icono nombre="derecha" className="size-4 text-tinta-3" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function VistaMapa({ empresa }: { empresa: number }) {
  const { t } = useTranslation();
  const navegar = useNavigate();
  const parcelas = useQuery(productores.parcelasDeEmpresa(empresa));
  const capas = useQuery(productores.capasMapa());
  const enMapa = useMemo<ParcelaEnMapa[]>(
    () => (parcelas.data ?? []).map((p) => ({ id: `${p.farmerId}:${p.id}`, nombre: p.plotName ?? '', coordenadas: coordenadasDe(p) })),
    [parcelas.data],
  );
  if (parcelas.isPending) return <Cargando />;
  if (parcelas.isError) return <EstadoError reintentar={() => void parcelas.refetch()} />;
  return (
    <div className="grid gap-2">
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-caja bg-superficie-2" />}>
        <MapaParcelas
          parcelas={enMapa}
          capas={capas.data ?? []}
          etiqueta={t('productores.mapa_titulo')}
          className="h-[32rem]"
          alElegir={(id) => void navegar({ to: '/productores/$id', params: { id: id.split(':')[0]! }, hash: 'parcelas' })}
        />
      </Suspense>
      <p className="text-sm text-tinta-2">
        {enMapa.filter((p) => p.coordenadas.length >= 3).length > 0 ? t('productores.mapa_ayuda', { count: enMapa.filter((p) => p.coordenadas.length >= 3).length }) : t('productores.mapa_vacio')}
      </p>
    </div>
  );
}
