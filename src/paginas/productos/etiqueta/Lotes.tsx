import { Suspense, lazy, useDeferredValue, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { POR_PAGINA_LOTES, lotes, useBorrarLote, useGuardarLote } from '@/api/lotes';
import { Boton } from '@/componentes/ui/Boton';
import { Campo } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { armarLote, formDesdeLote, loteVacio, lugarDesde, sinErroresLote, validarLote, type ErroresLote, type FormLote } from '@/util/lote';
import { puntoNuevo, type PuntoOrigen } from '@/util/producto';
import { NumeroConUnidad } from '../../stock/procesamiento/piezas';
import { useProducto } from '../Marco';
import { CampoArchivo, Casilla, Tarjeta } from '../piezas';
import { confirmar } from '@/componentes/ui/Confirmar';

const SelectorPuntos = lazy(() => import('@/componentes/mapa/SelectorPuntos'));
const ruta = getRouteApi('/portal/productos/$id/etiquetas/$etiqueta');

/**
 * Lotes de una etiqueta: el número impreso junto al QR y, si se activan, la verificación de
 * autenticidad (por fechas) y el rastreo de origen (por lugares).
 */
export function LotesEtiqueta() {
  const { t } = useTranslation();
  const etiqueta = Number(ruta.useParams().etiqueta);
  const { editable } = useProducto();
  const [texto, setTexto] = useState('');
  const numero = useDeferredValue(texto.trim());
  const [pagina, setPagina] = useState(1);
  const lista = useQuery(lotes.lista(etiqueta, { numero, pagina }));
  const borrar = useBorrarLote(etiqueta);
  const [editando, setEditando] = useState<FormLote | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok'; texto: string } | null>(null);
  const terminar = (texto?: string) => {
    setEditando(null);
    if (texto) setAviso({ tono: 'ok', texto });
  };

  async function eliminar(id: number, n: string) {
    if (!(await confirmar(t('productos.lotes.borrar_pregunta', { numero: n }), { accion: 'eliminar' }))) return;
    setAviso(null);
    try {
      await borrar.mutateAsync(id);
      setAviso({ tono: 'ok', texto: t('productos.lotes.borrado', { numero: n }) });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  const items = lista.data?.items ?? [];
  const total = lista.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_LOTES));
  return (
    <div className="grid gap-5">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <Tarjeta
        id="lotes"
        titulo={t('productos.lotes.titulo')}
        ayuda={t('productos.lotes.ayuda')}
        acciones={editable && !editando && (
          <Boton chico onClick={() => { setAviso(null); setEditando(loteVacio()); }}>
            <Icono nombre="mas" className="size-4" /> {t('productos.lotes.nuevo')}
          </Boton>
        )}
      >
        {editando && !editando.id && <FormularioLote etiqueta={etiqueta} inicial={editando} alTerminar={terminar} />}
        <Campo etiqueta={t('productos.lotes.buscar')} type="search" placeholder={t('productos.lotes.buscar_placeholder')} value={texto} onChange={(e) => { setTexto(e.target.value); setPagina(1); }} className="mb-4 sm:max-w-xs" />
        {lista.isPending ? (
          <Cargando />
        ) : lista.isError ? (
          <EstadoError texto={lista.error.message} reintentar={() => void lista.refetch()} />
        ) : items.length === 0 ? (
          <p className="text-sm text-tinta-3">{numero ? t('productos.lotes.sin_resultados') : t('productos.lotes.vacio')}</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-tinta-2">{t('productos.lotes.total', { count: total })}</p>
            <ul className="grid gap-3">
              {items.map((l) =>
                editando?.id === l.id ? (
                  <li key={l.id}><FormularioLote etiqueta={etiqueta} inicial={editando!} alTerminar={terminar} /></li>
                ) : (
                  <li key={l.id} aria-label={t('productos.lotes.uno', { numero: l.number })} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-linea p-4">
                    <div className="grid gap-1">
                      <p className="font-semibold">{l.number}</p>
                      <p className="text-sm text-tinta-2">
                        {[l.productionDate && t('productos.lotes.producido', { fecha: l.productionDate }), l.expiryDate && t('productos.lotes.vence', { fecha: l.expiryDate })].filter(Boolean).join(' · ') || t('productos.lotes.sin_fechas')}
                      </p>
                      <p className="flex flex-wrap gap-2 text-xs">
                        {l.checkAuthenticity && <span className="rounded-full bg-marca-suave px-2 py-0.5 font-semibold text-marca">{t('productos.lotes.autenticidad')}</span>}
                        {l.traceOrigin && <span className="rounded-full bg-marca-suave px-2 py-0.5 font-semibold text-marca">{t('productos.lotes.origen_n', { count: l.locations?.length ?? 0 })}</span>}
                      </p>
                    </div>
                    {editable && !editando && (
                      <div className="flex gap-1">
                        <Boton chico variante="fantasma" onClick={() => { setAviso(null); setEditando(formDesdeLote(l)); }}>
                          <Icono nombre="editar" className="size-4" /> {t('comun.editar')}
                        </Boton>
                        <Boton chico variante="fantasma" onClick={() => void eliminar(l.id!, l.number ?? '')} disabled={borrar.isPending} aria-label={t('productos.lotes.borrar', { numero: l.number })}>
                          <Icono nombre="borrar" className="size-4" />
                        </Boton>
                      </div>
                    )}
                  </li>
                ),
              )}
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

function FormularioLote({ etiqueta, inicial, alTerminar }: { etiqueta: number; inicial: FormLote; alTerminar: (texto?: string) => void }) {
  const { t } = useTranslation();
  const { producto } = useProducto();
  const guardar = useGuardarLote(etiqueta);
  const [f, setF] = useState(inicial);
  const [errores, setErrores] = useState<ErroresLote>({ puntos: {} });
  const [error, setError] = useState<string | null>(null);
  // El mapa se rearma (y se encuadra) solo cuando se reemplazan todos los lugares.
  const [version, setVersion] = useState(0);
  const cambiar = (c: Partial<FormLote>) => setF((x) => ({ ...x, ...c }));
  const cambiarLugar = (clave: string, c: Partial<PuntoOrigen>) => cambiar({ lugares: f.lugares.map((p) => (p.clave === clave ? { ...p, ...c } : p)) });
  const msg = (k?: string) => (k ? t(`productos.lotes.errores.${k}`, { defaultValue: t(`productos.errores.${k}`, { defaultValue: t(`stock.errores.${k}`) }) }) : undefined);
  const delProducto = producto.origin?.locations ?? [];

  async function alGuardar() {
    setError(null);
    const e = validarLote(f);
    setErrores(e);
    if (!sinErroresLote(e)) return;
    try {
      await guardar.mutateAsync(armarLote(f, etiqueta));
      alTerminar(t('productos.lotes.guardado', { numero: f.numero.trim() }));
    } catch (x) {
      setError((x as Error).message);
    }
  }

  async function usarLugaresDelProducto() {
    if (f.lugares.length && !(await confirmar(t('productos.lotes.reemplazar_lugares'), { accion: 'continuar' }))) return;
    cambiar({ lugares: delProducto.map(lugarDesde) });
    setVersion((v) => v + 1);
  }

  return (
    <div role="group" aria-label={f.id ? t('productos.lotes.editar') : t('productos.lotes.nuevo')} className="mb-4 grid gap-4 rounded-lg border border-marca/40 bg-marca-suave/30 p-4">
      {error && <Aviso tono="mal">{error}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <Campo etiqueta={t('productos.lotes.numero')} ayuda={t('productos.lotes.numero_ayuda')} value={f.numero} onChange={(e) => cambiar({ numero: e.target.value })} error={msg(errores.numero)} />
        <CampoArchivo etiqueta={t('productos.lotes.foto')} ayuda={t('productos.lotes.foto_ayuda')} tipos={['png', 'jpg', 'jpeg']} imagen doc={f.foto} alCambiar={(foto) => cambiar({ foto })} />
      </div>

      <div className="grid gap-3 rounded-lg border border-linea bg-superficie p-3">
        <Casilla marcada={f.autenticidad} alCambiar={(autenticidad) => cambiar({ autenticidad })}>
          <span className="font-semibold">{t('productos.lotes.autenticidad')}</span>
          <span className="block text-tinta-3">{t('productos.lotes.autenticidad_ayuda')}</span>
        </Casilla>
        {f.autenticidad && (
          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <Campo etiqueta={t('productos.lotes.produccion')} type="date" value={f.produccion} onChange={(e) => cambiar({ produccion: e.target.value })} error={msg(errores.fechas)} />
            <Campo etiqueta={t('productos.lotes.vencimiento')} type="date" value={f.vencimiento} onChange={(e) => cambiar({ vencimiento: e.target.value })} error={msg(errores.vencimiento ?? errores.fechas)} />
          </div>
        )}
      </div>

      <div className="grid gap-3 rounded-lg border border-linea bg-superficie p-3">
        <Casilla marcada={f.origen} alCambiar={(origen) => cambiar({ origen })}>
          <span className="font-semibold">{t('productos.lotes.origen')}</span>
          <span className="block text-tinta-3">{t('productos.lotes.origen_ayuda')}</span>
        </Casilla>
        {f.origen && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-tinta-3">{t('productos.origen.instrucciones')}</p>
              {delProducto.length > 0 && (
                <Boton chico variante="secundario" onClick={usarLugaresDelProducto}>
                  <Icono nombre="pin" className="size-4" /> {t('productos.lotes.usar_producto')}
                </Boton>
              )}
            </div>
            <Suspense fallback={<div className="h-80 rounded-caja bg-superficie-2" />}>
              <SelectorPuntos
                key={version}
                etiqueta={t('productos.lotes.mapa')}
                puntos={f.lugares.map((p) => (p.lat !== null && p.lng !== null && !Number.isNaN(p.lat) && !Number.isNaN(p.lng) ? ([p.lng, p.lat] as [number, number]) : null))}
                alAgregar={([lng, lat]) => cambiar({ lugares: [...f.lugares, puntoNuevo(lng, lat)] })}
                alMover={(i, [lng, lat]) => cambiar({ lugares: f.lugares.map((p, j) => (j === i ? { ...p, lng, lat } : p)) })}
              />
            </Suspense>
            {errores.lugares && <p className="text-sm text-mal">{msg(errores.lugares)}</p>}
            {f.lugares.length > 0 && (
              <ol className="grid gap-3">
                {f.lugares.map((p, i) => {
                  const ep = errores.puntos[p.clave] ?? {};
                  return (
                    <li key={p.clave} aria-label={t('productos.origen.punto', { n: i + 1 })} className="grid gap-3 rounded-lg border border-linea p-3 sm:grid-cols-[2rem_1fr_7rem_7rem_7rem_auto] sm:items-end [&>*]:min-w-0">
                      <span className="grid size-7 place-items-center rounded-full bg-marca text-xs font-bold text-sobre-marca sm:mb-2">{i + 1}</span>
                      <Campo etiqueta={t('productos.origen.nombre_punto')} value={p.nombre} onChange={(x) => cambiarLugar(p.clave, { nombre: x.target.value })} />
                      <NumeroConUnidad etiqueta={t('productos.origen.latitud')} requerido valor={p.lat} alCambiar={(lat) => cambiarLugar(p.clave, { lat })} error={msg(ep.lat)} />
                      <NumeroConUnidad etiqueta={t('productos.origen.longitud')} requerido valor={p.lng} alCambiar={(lng) => cambiarLugar(p.clave, { lng })} error={msg(ep.lng)} />
                      <NumeroConUnidad etiqueta={t('productos.origen.productores')} valor={p.productores} alCambiar={(productores) => cambiarLugar(p.clave, { productores })} error={msg(ep.productores)} />
                      <button type="button" onClick={() => cambiar({ lugares: f.lugares.filter((x) => x.clave !== p.clave) })} className="justify-self-start rounded-md p-2 text-tinta-3 hover:bg-mal-suave hover:text-mal sm:mb-1" aria-label={t('productos.origen.quitar', { n: i + 1 })}>
                        <Icono nombre="borrar" className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>

      <div className="flex gap-2">
        <Boton onClick={() => void alGuardar()} disabled={guardar.isPending}>
          <Icono nombre="ok" className="size-4" /> {guardar.isPending ? t('productores.ficha.guardando') : t('comun.guardar')}
        </Boton>
        <Boton variante="secundario" onClick={() => alTerminar()}>{t('comun.cancelar')}</Boton>
      </div>
    </div>
  );
}
