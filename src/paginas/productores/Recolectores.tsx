import { useDeferredValue, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { POR_PAGINA, productores, useBorrarProductor } from '@/api/productores';
import type { ApiUserCustomer } from '@/api/gen/types.gen';
import { Boton, clasesBoton } from '@/componentes/ui/Boton';
import { Campo } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { nombreCompleto, ubicacionCorta } from '@/util/productor';

const PESTANA = 'inline-flex h-11 shrink-0 items-center gap-2 rounded-t-lg border-b-2 border-transparent px-4 text-sm font-semibold text-tinta-2 hover:text-tinta';

/** Productores y recolectores son el mismo tipo de ficha: se pasa de una lista a la otra. */
export function PestanasPersonas() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('recolectores.pestanas')} className="-mx-4 flex overflow-x-auto border-b border-linea px-4 sm:mx-0 sm:px-0">
      <Link to="/productores" activeOptions={{ exact: true, includeSearch: false }} className={PESTANA} activeProps={{ className: '!border-marca !text-marca', 'aria-current': 'page' }}>
        <Icono nombre="personas" className="size-4" /> {t('productores.titulo')}
      </Link>
      <Link to="/productores/recolectores" className={PESTANA} activeProps={{ className: '!border-marca !text-marca', 'aria-current': 'page' }}>
        <Icono nombre="taza" className="size-4" /> {t('recolectores.titulo')}
      </Link>
    </nav>
  );
}

/**
 * Recolectores (acopiadores) de la empresa: quienes traen el café de los productores y cobran por
 * ellos. Misma ficha que un productor, sin finca, certificaciones ni parcelas.
 */
export function ListaRecolectores() {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  const [texto, setTexto] = useState('');
  const busqueda = useDeferredValue(texto);
  const [pagina, setPagina] = useState(1);
  const consulta = useQuery({ ...productores.recolectores(empresa?.id ?? 0, { texto: busqueda, pagina }), enabled: !!empresa });
  const borrar = useBorrarProductor(empresa?.id ?? 0);
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok'; texto: string } | null>(null);

  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  const items = consulta.data?.items ?? [];
  const total = consulta.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  async function eliminar(r: ApiUserCustomer) {
    if (!window.confirm(t('recolectores.borrar_confirmar', { nombre: nombreCompleto(r) }))) return;
    setAviso(null);
    try {
      await borrar.mutateAsync(r.id!);
      setAviso({ tono: 'ok', texto: t('recolectores.borrado', { nombre: nombreCompleto(r) }) });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-titulo text-3xl font-semibold tracking-tight">{t('recolectores.titulo')}</h1>
          <p className="mt-1 text-tinta-2">{consulta.data ? t('recolectores.subtitulo', { count: total, empresa: empresa.nombre }) : empresa.nombre}</p>
        </div>
        <Link to="/productores/recolectores/nuevo" className={clasesBoton('primario')}>
          <Icono nombre="mas" className="size-4" /> {t('recolectores.nuevo')}
        </Link>
      </header>
      <PestanasPersonas />
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <Campo etiqueta={t('recolectores.buscar')} type="search" placeholder={t('recolectores.buscar_placeholder')} value={texto} onChange={(e) => { setTexto(e.target.value); setPagina(1); }} className="sm:max-w-xs" />
      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} />
      ) : items.length === 0 ? (
        <p className="text-tinta-3">{busqueda.trim() ? t('recolectores.sin_resultados') : t('recolectores.vacio')}</p>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((r) => (
              <li key={r.id} aria-label={nombreCompleto(r)} className="flex items-start justify-between gap-3 rounded-caja border border-linea bg-superficie p-4 shadow-suave">
                <Link to="/productores/recolectores/$id" params={{ id: String(r.id) }} className="grid min-w-0 gap-0.5 hover:text-marca">
                  <span className="font-semibold break-words">{nombreCompleto(r)}</span>
                  <span className="text-sm text-tinta-2">{[ubicacionCorta(r.location?.address), r.phone].filter(Boolean).join(' · ') || '—'}</span>
                </Link>
                <Boton chico variante="fantasma" onClick={() => void eliminar(r)} disabled={borrar.isPending} aria-label={t('productores.borrar_de', { nombre: nombreCompleto(r) })}>
                  <Icono nombre="borrar" className="size-4" />
                </Boton>
              </li>
            ))}
          </ul>
          {paginas > 1 && (
            <nav aria-label={t('productos.lotes.paginas')} className="flex items-center justify-end gap-2 text-sm">
              <Boton chico variante="secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} aria-label={t('productos.lotes.anterior')}><Icono nombre="izquierda" className="size-4" /></Boton>
              <span>{pagina} / {paginas}</span>
              <Boton chico variante="secundario" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)} aria-label={t('productos.lotes.siguiente')}><Icono nombre="derecha" className="size-4" /></Boton>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
