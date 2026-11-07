import { useState } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { POR_PAGINA_ORDENES, ordenes } from '@/api/ordenes';
import { procesamiento, useBorrarProcesamiento } from '@/api/procesamiento';
import { exportarGeoDatos, stock } from '@/api/stock';
import type { ApiStockOrder } from '@/api/gen/types.gen';
import { Boton, clasesBoton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { fechaCorta } from '@/util/fecha';
import { cantidad, nombreInstalacion } from '@/util/formato';
import { puedePagarseOrden } from '@/util/pago';
import { confirmar } from '@/componentes/ui/Confirmar';

const ruta = getRouteApi('/portal/stock/ordenes/');

export function ListaOrdenes() {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  return <Contenido empresa={empresa.id} />;
}

/** Una orden está abierta mientras no se cumplió lo pedido. */
const abierta = (o: ApiStockOrder) => (o.fulfilledQuantity ?? 0) < (o.totalQuantity ?? 0) - 1e-9;

function Contenido({ empresa }: { empresa: number }) {
  const { t, i18n } = useTranslation();
  const filtro = ruta.useSearch();
  const navegar = useNavigate({ from: '/stock/ordenes/' });
  const fijar = (c: Partial<typeof filtro>) => navegar({ search: (s) => ({ ...s, ...c }), replace: true });
  const recibidas = filtro.vista === 'recibidas';
  const instalaciones = useQuery(stock.instalaciones(empresa));
  const instalacion = instalaciones.data?.find((x) => x.id === filtro.inst);
  const f = { instalacion: filtro.inst, semiproducto: filtro.semi, cliente: filtro.cliente, soloAbiertas: filtro.abiertas, pagina: filtro.pagina ?? 1 };
  const consulta = useQuery(recibidas ? ordenes.recibidas(empresa, f) : ordenes.emitidas(empresa, f));
  const items = consulta.data?.items ?? [];
  const total = consulta.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_ORDENES));
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const borrar = useBorrarProcesamiento();

  async function eliminar(o: ApiStockOrder) {
    if (!(await confirmar(t('stock.ord.borrar_pregunta', { orden: o.internalLotNumber || o.orderId || `#${o.id}` }), { accion: 'eliminar' }))) return;
    setError(null);
    try {
      const orden = await qc.fetchQuery({ ...procesamiento.deLote(o.id!), staleTime: 0 });
      await borrar.mutateAsync(orden.id!);
      void qc.invalidateQueries({ queryKey: ['ordenes'] });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function geo(id: number) {
    setError(null);
    try {
      if (!(await exportarGeoDatos(id))) setError(t('stock.todo.sin_geo'));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="grid gap-6 [&>*]:min-w-0">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-titulo text-3xl font-semibold tracking-tight">{t('stock.ord.titulo')}</h1>
          <p className="mt-1 max-w-2xl text-tinta-2">{recibidas ? t('stock.ord.descripcion_recibidas') : t('stock.ord.descripcion_emitidas')}</p>
        </div>
        {!recibidas && (
          <div className="flex flex-wrap gap-2">
            <Link to="/stock/ordenes/cliente" className={clasesBoton('secundario')}>
              <Icono nombre="personas" className="size-4" /> {t('stock.ord.cli.titulo')}
            </Link>
            <Link to="/stock/ordenes/nueva" className={clasesBoton('primario')}>
              <Icono nombre="mas" className="size-4" /> {t('stock.ord.nuevo_pedido')}
            </Link>
          </div>
        )}
      </header>

      <div className="inline-flex w-fit rounded-lg bg-superficie-2 p-1" role="group" aria-label={t('stock.todo.vista')}>
        {([undefined, 'recibidas'] as const).map((v) => (
          <button key={v ?? 'emitidas'} type="button" aria-pressed={filtro.vista === v} onClick={() => navegar({ search: { vista: v }, replace: true })} className="h-9 rounded-md px-3 text-sm font-semibold text-tinta-2 aria-pressed:bg-superficie aria-pressed:text-tinta aria-pressed:shadow-suave">
            {v ? t('stock.ord.recibidas') : t('stock.ord.emitidas')}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-tinta-2">{t('stock.instalacion')}</span>
          <select value={filtro.inst ?? ''} onChange={(e) => fijar({ inst: e.target.value ? Number(e.target.value) : undefined, semi: undefined, pagina: undefined })} className="h-11 min-w-56 rounded-lg border border-linea-fuerte bg-superficie px-3">
            <option value="">{t('stock.todas_instalaciones')}</option>
            {(instalaciones.data ?? []).map((x) => <option key={x.id} value={x.id}>{nombreInstalacion(x)}</option>)}
          </select>
        </label>
        {recibidas && instalacion && (instalacion.facilitySemiProductList ?? []).length > 1 && (
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-tinta-2">{t('stock.semiproducto')}</span>
            <select value={filtro.semi ?? ''} onChange={(e) => fijar({ semi: e.target.value ? Number(e.target.value) : undefined, pagina: undefined })} className="h-11 rounded-lg border border-linea-fuerte bg-superficie px-3">
              <option value="">{t('stock.todos_semiproductos')}</option>
              {instalacion.facilitySemiProductList!.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
        )}
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 self-end rounded-lg px-2 text-sm font-medium text-tinta-2">
          <input type="checkbox" className="size-4 accent-[var(--marca)]" checked={!!filtro.abiertas} onChange={(e) => fijar({ abiertas: e.target.checked || undefined, pagina: undefined })} />
          {t('stock.ord.solo_abiertas')}
        </label>
      </div>

      {error && <Aviso tono="mal">{error}</Aviso>}

      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} />
      ) : items.length === 0 ? (
        <div className="rounded-caja border border-dashed border-linea-fuerte p-10 text-center text-tinta-2">{recibidas ? t('stock.ord.vacio_recibidas') : t('stock.ord.vacio_emitidas')}</div>
      ) : (
        <>
          <p className="text-sm text-tinta-2">{t('stock.ord.total', { count: total })}</p>
          <div className="relative overflow-x-auto rounded-caja border border-linea bg-superficie shadow-suave">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead className="border-b border-linea bg-superficie-2 text-tinta-2">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('stock.ord.col_entrega')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('stock.ord.col_orden')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('stock.ord.col_producto')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{recibidas ? t('stock.ord.col_comprador') : t('stock.ord.col_proveedor')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('stock.ord.col_destino')}</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">{t('stock.ord.col_cantidad')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('stock.entregas.col_estado')}</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">{t('productores.columnas.acciones')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {items.map((o) => {
                  const ref = o.productOrder?.orderId || o.orderId || o.internalLotNumber || `#${o.id}`;
                  const unidad = o.measureUnitType?.label;
                  return (
                    <tr key={o.id} className="hover:bg-superficie-2/60">
                      <td className="px-4 py-3 whitespace-nowrap">{fechaCorta(o.deliveryTime, i18n.language) || '—'}</td>
                      <td className="px-4 py-3">
                        <Link to="/stock/procesamiento/$lote" params={{ lote: String(o.id) }} className="font-semibold hover:text-marca hover:underline">{ref}</Link>
                        {o.consumerCompanyCustomer?.name && <span className="block text-xs text-tinta-3">{t('stock.ord.para_cliente', { cliente: o.consumerCompanyCustomer.name })}</span>}
                      </td>
                      <td className="px-4 py-3 text-tinta-2">{o.semiProduct?.name ?? o.finalProduct?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        {recibidas ? (o.facility?.company?.name ?? '—') : (
                          <>
                            {o.quoteFacility?.company?.name ?? '—'}
                            {o.quoteFacility && <span className="block text-xs text-tinta-3">{nombreInstalacion(o.quoteFacility)}</span>}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-tinta-2">{nombreInstalacion(o.facility)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                        {cantidad(o.fulfilledQuantity ?? 0, undefined, i18n.language)} / {cantidad(o.totalQuantity, unidad, i18n.language)}
                      </td>
                      <td className="px-4 py-3">
                        {abierta(o) ? (
                          <span className="rounded-full bg-aviso-suave px-2.5 py-1 text-xs font-semibold text-aviso">{t('stock.ord.abierta')}</span>
                        ) : (
                          <span className="rounded-full bg-ok-suave px-2.5 py-1 text-xs font-semibold text-ok">{t('stock.ord.cumplida')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link to="/stock/procesamiento/$lote" params={{ lote: String(o.id) }} className="rounded-md p-1.5 text-tinta-3 hover:bg-superficie-2 hover:text-marca" aria-label={recibidas ? t('stock.ord.completar', { orden: ref }) : t('stock.ord.editar', { orden: ref })} title={recibidas ? t('stock.ord.completar_corto') : t('productores.editar')}>
                            <Icono nombre={recibidas ? 'mas' : 'editar'} className="size-4" />
                          </Link>
                          <Link to="/stock/trazabilidad/$id" params={{ id: String(o.id) }} className="rounded-md p-1.5 text-tinta-3 hover:bg-superficie-2 hover:text-marca" aria-label={t('stock.todo.trazabilidad')} title={t('stock.todo.trazabilidad')}>
                            <Icono nombre="ruta" className="size-4" />
                          </Link>
                          {!recibidas && (
                            <>
                              <Link to="/stock/ordenes/$id/aprobar" params={{ id: String(o.id) }} className="rounded-md p-1.5 text-tinta-3 hover:bg-ok-suave hover:text-ok" aria-label={t('stock.ord.aprobar', { orden: ref })} title={t('stock.ord.aprobar_corto')}>
                                <Icono nombre="ok" className="size-4" />
                              </Link>
                              {puedePagarseOrden(o) && (
                                <Link to="/stock/pagos/nuevo" search={{ orden: o.id! }} className="rounded-md p-1.5 text-tinta-3 hover:bg-ok-suave hover:text-ok" aria-label={t('stock.ord.pagar', { orden: ref })} title={t('stock.pagos.pagar')}>
                                  <Icono nombre="precio" className="size-4" />
                                </Link>
                              )}
                              {o.qrCodeTag && (
                                <Link to="/stock/trazabilidad/$id" params={{ id: String(o.id) }} hash="qr" className="rounded-md p-1.5 text-tinta-3 hover:bg-superficie-2 hover:text-marca" aria-label={t('stock.qr.ver')} title={t('stock.qr.ver')}>
                                  <Icono nombre="qr" className="size-4" />
                                </Link>
                              )}
                              <button type="button" onClick={() => void geo(o.id!)} className="rounded-md p-1.5 text-tinta-3 hover:bg-superficie-2 hover:text-marca" aria-label={t('stock.todo.geojson')} title={t('stock.todo.geojson')}>
                                <Icono nombre="mapa" className="size-4" />
                              </button>
                              {/* Como la versión actual: solo se borra si nada de lo recibido se usó todavía. */}
                              {Math.abs((o.fulfilledQuantity ?? 0) - (o.availableQuantity ?? 0)) < 1e-9 && (
                                <button type="button" onClick={() => void eliminar(o)} className="rounded-md p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('stock.ord.borrar', { orden: ref })} title={t('stock.ord.borrar_corto')}>
                                  <Icono nombre="borrar" className="size-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {paginas > 1 && (
            <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t('productores.paginacion')}>
              <span className="text-tinta-2">{t('productores.pagina', { pagina: filtro.pagina ?? 1, total: paginas })}</span>
              <div className="flex gap-2">
                <Boton variante="secundario" chico disabled={(filtro.pagina ?? 1) <= 1} onClick={() => fijar({ pagina: (filtro.pagina ?? 1) - 1 || undefined })}>{t('productores.anterior')}</Boton>
                <Boton variante="secundario" chico disabled={(filtro.pagina ?? 1) >= paginas} onClick={() => fijar({ pagina: (filtro.pagina ?? 1) + 1 })}>{t('productores.siguiente')}</Boton>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
