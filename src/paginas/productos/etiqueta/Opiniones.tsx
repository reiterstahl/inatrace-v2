import { useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { POR_PAGINA_OPINIONES, lotes, todasLasOpiniones, useBorrarOpinion, type TipoOpinion } from '@/api/lotes';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { csvCorreos } from '@/util/lote';
import { useProducto } from '../Marco';
import { Tarjeta } from '../piezas';

const ruta = getRouteApi('/portal/productos/$id/etiquetas/$etiqueta');
const TIPOS: TipoOpinion[] = ['PRAISE', 'PROPOSAL', 'COMPLAINT'];
const TONO: Record<TipoOpinion, string> = { PRAISE: 'bg-ok-suave text-ok', PROPOSAL: 'bg-marca-suave text-marca', COMPLAINT: 'bg-mal-suave text-mal' };

/**
 * Opiniones que dejaron los consumidores en la vitrina de la etiqueta, con su correo y respuestas.
 * Las ven las empresas del producto; borrar y exportar, la dueña.
 */
export function OpinionesEtiqueta() {
  const { t } = useTranslation();
  const etiqueta = Number(ruta.useParams().etiqueta);
  const { editable } = useProducto();
  const [tipo, setTipo] = useState<TipoOpinion | undefined>();
  const [pagina, setPagina] = useState(1);
  const lista = useQuery(lotes.opiniones(etiqueta, { tipo, pagina }));
  const borrar = useBorrarOpinion(etiqueta);
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok'; texto: string } | null>(null);
  const [exportando, setExportando] = useState(false);

  async function eliminar(id: number) {
    if (!window.confirm(t('productos.opiniones.borrar_pregunta'))) return;
    setAviso(null);
    try {
      await borrar.mutateAsync(id);
      setAviso({ tono: 'ok', texto: t('productos.opiniones.borrada') });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  async function exportar() {
    setExportando(true);
    try {
      const todas = await todasLasOpiniones(etiqueta);
      const url = URL.createObjectURL(new Blob([csvCorreos(todas)], { type: 'text/csv;charset=utf-8' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `opiniones-correos-${etiqueta}.csv` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    } finally {
      setExportando(false);
    }
  }

  const items = lista.data?.items ?? [];
  const total = lista.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_OPINIONES));
  const filtro = (activo: boolean) => clsx('h-9 rounded-lg px-3 text-sm font-semibold', activo ? 'bg-marca text-sobre-marca' : 'bg-superficie-2 text-tinta-2 hover:text-tinta');

  return (
    <div className="grid gap-5">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <Tarjeta
        id="opiniones"
        titulo={t('productos.opiniones.titulo')}
        ayuda={t('productos.opiniones.ayuda')}
        acciones={editable && (
          <Boton chico variante="secundario" onClick={() => void exportar()} disabled={exportando} title={t('productos.opiniones.exportar_ayuda')}>
            <Icono nombre="descarga" className="size-4" /> {t('productos.opiniones.exportar')}
          </Boton>
        )}
      >
        <div role="group" aria-label={t('productos.opiniones.filtro')} className="mb-4 flex flex-wrap gap-2">
          <button type="button" aria-pressed={!tipo} className={filtro(!tipo)} onClick={() => { setTipo(undefined); setPagina(1); }}>{t('productos.opiniones.todas')}</button>
          {TIPOS.map((x) => (
            <button key={x} type="button" aria-pressed={tipo === x} className={filtro(tipo === x)} onClick={() => { setTipo(x); setPagina(1); }}>{t(`productos.opiniones.tipos.${x}`)}</button>
          ))}
        </div>
        {lista.isPending ? (
          <Cargando />
        ) : lista.isError ? (
          <EstadoError texto={lista.error.message} reintentar={() => void lista.refetch()} />
        ) : items.length === 0 ? (
          <p className="text-sm text-tinta-3">{t('productos.opiniones.vacio')}</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-tinta-2">{t('productos.opiniones.total', { count: total })}</p>
            <ul className="grid gap-3">
              {items.map((o) => {
                const r = o.questionnaireAnswers ?? {};
                const datos = [
                  r.age && t('productos.opiniones.edad', { edad: r.age }),
                  r.gender && t(`vitrina.opinion.generos.${r.gender}`, { defaultValue: r.gender }),
                  r.rateTaste && t('productos.opiniones.sabor', { sabor: t(`vitrina.opinion.sabores.${r.rateTaste}`, { defaultValue: r.rateTaste }) }),
                ].filter(Boolean);
                return (
                  <li key={o.id} aria-label={t('productos.opiniones.una', { n: o.id })} className="grid gap-2 rounded-lg border border-linea p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold', TONO[o.type ?? 'PRAISE'])}>{t(`productos.opiniones.tipos.${o.type ?? 'PRAISE'}`)}</span>
                      {editable && (
                        <button type="button" onClick={() => void eliminar(o.id!)} disabled={borrar.isPending} className="rounded-md p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('productos.opiniones.borrar')}>
                          <Icono nombre="borrar" className="size-4" />
                        </button>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{o.feedback}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-tinta-2">
                      {o.email && (
                        <span className="inline-flex items-center gap-1.5">
                          <Icono nombre="correo" className="size-4" /> {o.email}
                          <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', o.gdprConsent ? 'bg-ok-suave text-ok' : 'bg-superficie-2 text-tinta-3')}>
                            {o.gdprConsent ? t('productos.opiniones.con_consentimiento') : t('productos.opiniones.sin_consentimiento')}
                          </span>
                        </span>
                      )}
                      {datos.length > 0 && <span>{datos.join(' · ')}</span>}
                    </p>
                  </li>
                );
              })}
            </ul>
            {paginas > 1 && (
              <nav aria-label={t('productos.lotes.paginas')} className="mt-4 flex items-center justify-end gap-2 text-sm">
                <Boton chico variante="secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} aria-label={t('productos.lotes.anterior')}><Icono nombre="izquierda" className="size-4" /></Boton>
                <span>{pagina} / {paginas}</span>
                <Boton chico variante="secundario" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)} aria-label={t('productos.lotes.siguiente')}><Icono nombre="derecha" className="size-4" /></Boton>
              </nav>
            )}
          </>
        )}
      </Tarjeta>
    </div>
  );
}
