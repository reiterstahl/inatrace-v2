import { useState } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { POR_PAGINA_STOCK, exportarGeoDatos, stock, useBorrarEntrega } from '@/api/stock';
import { procesamiento, useBorrarProcesamiento } from '@/api/procesamiento';
import { beycoConfigurado, conectadoABeyco, irAAutorizar } from '@/api/beyco';
import { productores } from '@/api/productores';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiGroupStockOrder, ApiStockOrder } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { fechaCorta } from '@/util/fecha';
import { cantidad, fechaEntrega, nombreInstalacion } from '@/util/formato';
import { nombreCompleto } from '@/util/productor';

const ruta = getRouteApi('/portal/stock/todo');

export function ListaStock() {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  return <Contenido empresa={empresa.id} />;
}

function Contenido({ empresa }: { empresa: number }) {
  const { t, i18n } = useTranslation();
  const filtro = ruta.useSearch();
  const navegar = useNavigate({ from: '/stock/todo' });
  const fijar = (c: Partial<typeof filtro>) => navegar({ search: (s) => ({ ...s, ...c }), replace: true });
  const [error, setError] = useState<string | null>(null);

  const instalaciones = useQuery(stock.instalaciones(empresa));
  const instalacion = instalaciones.data?.find((x) => x.id === filtro.inst);
  const agrupado = filtro.vista === 'agrupada';
  const pagina = filtro.pagina ?? 1;
  const orden = { campo: filtro.orden ?? 'date', sentido: filtro.sentido ?? 'DESC' } as const;
  const comun = { instalacion: filtro.inst, semiproducto: filtro.semi, soloCompras: filtro.compras, soloDisponible: filtro.disponible, agrupado, pagina, orden };

  const sueltas = useQuery({ ...stock.ordenes(comun), enabled: !!filtro.inst && !agrupado });
  const grupos = useQuery({ ...stock.ordenesAgrupadas(comun), enabled: !!filtro.inst && agrupado });
  const consulta = agrupado ? grupos : sueltas;
  const total = consulta.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_STOCK));
  const borrar = useBorrarEntrega(empresa);
  const borrarProceso = useBorrarProcesamiento();
  const qc = useQueryClient();

  // Beyco: solo si la empresa lo tiene habilitado y la instalación lo configuró (como la versión actual).
  const perfil = useQuery(productores.perfilEmpresa(empresa));
  const conBeyco = !!perfil.data?.allowBeycoIntegration && beycoConfigurado();
  const [elegidos, setElegidos] = useState<number[]>([]);
  const claveFiltro = JSON.stringify(comun);
  const [filtroElegidos, setFiltroElegidos] = useState(claveFiltro);
  if (filtroElegidos !== claveFiltro) {
    // Cambiar de filtro o de página vacía la selección: lo elegido tiene que estar a la vista.
    setFiltroElegidos(claveFiltro);
    setElegidos([]);
  }
  function exportarABeyco() {
    if (conectadoABeyco(empresa)) void navegar({ to: '/stock/beyco/oferta', search: { lotes: elegidos.join(',') } });
    else irAAutorizar(empresa, elegidos);
  }

  async function geo(id: number) {
    setError(null);
    try {
      const hubo = await exportarGeoDatos(id);
      if (!hubo) setError(t('stock.todo.sin_geo'));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function eliminar(o: ApiStockOrder) {
    const lote = o.identifier || o.internalLotNumber || `#${o.id}`;
    const esCompra = o.orderType === 'PURCHASE_ORDER';
    if (!window.confirm(t(esCompra ? 'stock.todo.borrar_confirmar' : 'stock.todo.borrar_proceso_confirmar', { lote }))) return;
    setError(null);
    try {
      if (esCompra) {
        await borrar.mutateAsync(o.id!);
        return;
      }
      // Un lote procesado se borra borrando la orden de procesamiento que lo produjo (como la versión actual).
      const orden = await qc.fetchQuery({ ...procesamiento.deLote(o.id!), staleTime: 0 });
      if (!orden.id) throw new Error(t('stock.todo.sin_orden_proceso'));
      await borrarProceso.mutateAsync(orden.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-titulo text-3xl font-semibold tracking-tight">{t('stock.todo.titulo')}</h1>
          <p className="mt-1 text-tinta-2">{t('stock.todo.descripcion')}</p>
        </div>
        {conBeyco && !agrupado && filtro.inst && (
          <Boton variante="secundario" disabled={!elegidos.length} onClick={exportarABeyco}>
            <Icono nombre="externo" className="size-4" /> {t('stock.beyco.exportar', { count: elegidos.length })}
          </Boton>
        )}
      </header>

      {error && <Aviso tono="mal">{error}</Aviso>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-tinta-2">{t('stock.instalacion')}</span>
          <select
            value={filtro.inst ?? ''}
            onChange={(e) => fijar({ inst: e.target.value ? Number(e.target.value) : undefined, semi: undefined, pagina: undefined })}
            className="h-11 min-w-56 rounded-lg border border-linea-fuerte bg-superficie px-3"
          >
            <option value="">{t('stock.elegir')}</option>
            {(instalaciones.data ?? []).map((f) => <option key={f.id} value={f.id}>{nombreInstalacion(f)}</option>)}
          </select>
        </label>
        {instalacion && (instalacion.facilitySemiProductList ?? []).length > 1 && (
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-tinta-2">{t('stock.semiproducto')}</span>
            <select value={filtro.semi ?? ''} onChange={(e) => fijar({ semi: e.target.value ? Number(e.target.value) : undefined, pagina: undefined })} className="h-11 rounded-lg border border-linea-fuerte bg-superficie px-3">
              <option value="">{t('stock.todos_semiproductos')}</option>
              {instalacion.facilitySemiProductList!.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        {filtro.inst && (
          <>
            <div className="inline-flex self-end rounded-lg bg-superficie-2 p-1" role="group" aria-label={t('stock.todo.vista')}>
              {(['suelta', 'agrupada'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={(filtro.vista ?? 'suelta') === v} onClick={() => fijar({ vista: v === 'suelta' ? undefined : v, pagina: undefined })} className="h-9 rounded-md px-3 text-sm font-semibold text-tinta-2 aria-pressed:bg-superficie aria-pressed:text-tinta aria-pressed:shadow-suave">
                  {t(`stock.todo.vista_${v}`)}
                </button>
              ))}
            </div>
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 self-end rounded-lg px-2 text-sm font-medium text-tinta-2">
              <input type="checkbox" className="size-4 accent-[var(--marca)]" checked={!!filtro.compras} onChange={(e) => fijar({ compras: e.target.checked || undefined, pagina: undefined })} />
              {t('stock.todo.solo_compras')}
            </label>
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 self-end rounded-lg px-2 text-sm font-medium text-tinta-2">
              <input type="checkbox" className="size-4 accent-[var(--marca)]" checked={!!filtro.disponible} onChange={(e) => fijar({ disponible: e.target.checked || undefined, pagina: undefined })} />
              {t('stock.todo.solo_disponible')}
            </label>
          </>
        )}
      </div>

      {!filtro.inst ? (
        <div className="rounded-caja border border-dashed border-linea-fuerte p-10 text-center text-tinta-2">{t('stock.todo.elegir_instalacion')}</div>
      ) : consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <EstadoError reintentar={() => void consulta.refetch()} />
      ) : total === 0 ? (
        <div className="rounded-caja border border-dashed border-linea-fuerte p-10 text-center text-tinta-2">{t('stock.todo.vacio')}</div>
      ) : (
        <>
          <p className="text-sm text-tinta-2">{t('stock.todo.mostrando', { count: total })}</p>
          {agrupado ? (
            <TablaAgrupada items={grupos.data!.items ?? []} i18n={i18n.language} />
          ) : (
            <TablaSuelta items={sueltas.data!.items ?? []} i18n={i18n.language} onGeo={geo} onBorrar={eliminar} eleccion={conBeyco ? { elegidos, setElegidos } : undefined} />
          )}
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
    </div>
  );
}

/** Igual que la versión actual: una orden general solo se borra si nada de ella se usó todavía. */
const puedeBorrar = (o: ApiStockOrder) => o.orderType !== 'GENERAL_ORDER' || Math.abs((o.fulfilledQuantity ?? 0) - (o.availableQuantity ?? 0)) < 1e-9;

function Tipo({ tipo }: { tipo?: string }) {
  const { t } = useTranslation();
  const clave = tipo && ['PURCHASE_ORDER', 'PROCESSING_ORDER', 'TRANSFER_ORDER', 'GENERAL_ORDER', 'SALES_ORDER'].includes(tipo) ? tipo : 'OTRO';
  return <span className="rounded-full bg-superficie-2 px-2.5 py-1 text-xs font-semibold text-tinta-2">{t(`stock.todo.tipo.${clave}`)}</span>;
}

function Disponible({ o }: { o: { availableQuantity?: number } }) {
  const { t } = useTranslation();
  const hay = (o.availableQuantity ?? 0) > 0;
  return <span className={'rounded-full px-2.5 py-1 text-xs font-semibold ' + (hay ? 'bg-ok-suave text-ok' : 'bg-superficie-2 text-tinta-3')}>{hay ? t('stock.todo.disponible') : t('stock.todo.agotado')}</span>;
}

type Eleccion = { elegidos: number[]; setElegidos: (v: number[]) => void };

function TablaSuelta({ items, i18n, onGeo, onBorrar, eleccion }: { items: ApiStockOrder[]; i18n: string; onGeo: (id: number) => void; onBorrar: (o: ApiStockOrder) => void; eleccion?: Eleccion }) {
  const { t } = useTranslation();
  return (
    <div className="relative overflow-x-auto rounded-caja border border-linea bg-superficie shadow-suave">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="border-b border-linea bg-superficie-2 text-tinta-2">
          <tr>
            {eleccion && (
              <th scope="col" className="px-4 py-3">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--marca)]"
                  aria-label={t('stock.beyco.elegir_todos')}
                  checked={items.length > 0 && items.every((o) => eleccion.elegidos.includes(o.id!))}
                  onChange={(e) => eleccion.setElegidos(e.target.checked ? items.map((o) => o.id!) : [])}
                />
              </th>
            )}
            <th scope="col" className="px-4 py-3 font-semibold">{t('stock.todo.col_fecha')}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{t('stock.todo.col_lote')}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{t('stock.todo.col_tipo')}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{t('stock.semiproducto')}</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">{t('stock.todo.col_cantidad')}</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">{t('stock.todo.col_disponible')}</th>
            <th scope="col" className="px-4 py-3"><span className="sr-only">{t('productores.columnas.acciones')}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linea">
          {items.map((o) => (
            <tr key={o.id} className="hover:bg-superficie-2/60">
              {eleccion && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--marca)]"
                    aria-label={t('stock.beyco.elegir', { lote: o.identifier || o.internalLotNumber || `#${o.id}` })}
                    checked={eleccion.elegidos.includes(o.id!)}
                    onChange={(e) => eleccion.setElegidos(e.target.checked ? [...eleccion.elegidos, o.id!] : eleccion.elegidos.filter((x) => x !== o.id))}
                  />
                </td>
              )}
              <td className="px-4 py-3 whitespace-nowrap">{fechaCorta(fechaEntrega(o), i18n) || '—'}</td>
              <td className="px-4 py-3">
                <Link to="/stock/trazabilidad/$id" params={{ id: String(o.id) }} className="font-semibold hover:text-marca hover:underline">
                  {o.identifier || o.internalLotNumber || `#${o.id}`}
                </Link>
                {o.producerUserCustomer && <span className="block text-xs text-tinta-3">{nombreCompleto(o.producerUserCustomer)}</span>}
              </td>
              <td className="px-4 py-3"><Tipo tipo={o.orderType} /></td>
              <td className="px-4 py-3 text-tinta-2">{o.semiProduct?.name ?? o.finalProduct?.name ?? '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums">{cantidad(o.totalQuantity, o.measureUnitType?.label, i18n)}</td>
              <td className="px-4 py-3 text-right tabular-nums"><span className="inline-flex items-center gap-2"><Disponible o={o} />{cantidad(o.availableQuantity, o.measureUnitType?.label, i18n)}</span></td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Link to="/stock/trazabilidad/$id" params={{ id: String(o.id) }} className="rounded-md p-1.5 text-tinta-3 hover:bg-superficie-2 hover:text-marca" aria-label={t('stock.todo.trazabilidad')} title={t('stock.todo.trazabilidad')}>
                    <Icono nombre="ruta" className="size-4" />
                  </Link>
                  {o.qrCodeTag && (
                    <Link to="/stock/trazabilidad/$id" params={{ id: String(o.id) }} hash="qr" className="rounded-md p-1.5 text-tinta-3 hover:bg-superficie-2 hover:text-marca" aria-label={t('stock.qr.ver')} title={t('stock.qr.ver')}>
                      <Icono nombre="qr" className="size-4" />
                    </Link>
                  )}
                  <button type="button" onClick={() => onGeo(o.id!)} className="rounded-md p-1.5 text-tinta-3 hover:bg-superficie-2 hover:text-marca" aria-label={t('stock.todo.geojson')} title={t('stock.todo.geojson')}>
                    <Icono nombre="mapa" className="size-4" />
                  </button>
                  {o.orderType === 'PURCHASE_ORDER' ? (
                    <Link to="/stock/entregas/$id" params={{ id: String(o.id) }} className="rounded-md p-1.5 text-tinta-3 hover:bg-superficie-2 hover:text-marca" aria-label={t('productores.editar')} title={t('productores.editar')}>
                      <Icono nombre="editar" className="size-4" />
                    </Link>
                  ) : (
                    <Link to="/stock/procesamiento/$lote" params={{ lote: String(o.id) }} className="rounded-md p-1.5 text-tinta-3 hover:bg-superficie-2 hover:text-marca" aria-label={t('stock.todo.editar_proceso')} title={t('stock.todo.editar_proceso')}>
                      <Icono nombre="editar" className="size-4" />
                    </Link>
                  )}
                  {puedeBorrar(o) && (
                    <button type="button" onClick={() => onBorrar(o)} className="rounded-md p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={o.orderType === 'PURCHASE_ORDER' ? t('stock.entregas.borrar') : t('stock.todo.borrar_proceso')} title={o.orderType === 'PURCHASE_ORDER' ? t('stock.entregas.borrar') : t('stock.todo.borrar_proceso')}>
                      <Icono nombre="borrar" className="size-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaAgrupada({ items, i18n }: { items: ApiGroupStockOrder[]; i18n: string }) {
  const { t } = useTranslation();
  return (
    <div className="relative overflow-x-auto rounded-caja border border-linea bg-superficie shadow-suave">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="border-b border-linea bg-superficie-2 text-tinta-2">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">{t('stock.todo.col_lote')}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{t('stock.todo.col_fecha')}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{t('stock.todo.col_tipo')}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{t('stock.semiproducto')}</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">{t('stock.todo.col_ordenes')}</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">{t('stock.todo.col_cantidad')}</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">{t('stock.todo.col_disponible')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linea">
          {items.map((g) => (
            <tr key={(g.groupedIds ?? []).join('-')} className="hover:bg-superficie-2/60">
              <td className="px-4 py-3 font-semibold">{g.internalLotNumber || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap">{fechaCorta(g.productionDate || g.deliveryTime, i18n) || '—'}</td>
              <td className="px-4 py-3"><Tipo tipo={g.orderType} /></td>
              <td className="px-4 py-3 text-tinta-2">{g.semiProductName || g.finalProductName || '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums">{(g.groupedIds ?? []).length}</td>
              <td className="px-4 py-3 text-right tabular-nums">{cantidad(g.totalQuantity, g.unitLabel, i18n)}</td>
              <td className="px-4 py-3 text-right tabular-nums"><span className="inline-flex items-center gap-2"><Disponible o={g} />{cantidad(g.availableQuantity, g.unitLabel, i18n)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
