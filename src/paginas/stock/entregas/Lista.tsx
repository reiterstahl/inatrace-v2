import { useEffect, useState } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { POR_PAGINA_STOCK, exportarEntregas, stock, useBorrarEntrega } from '@/api/stock';
import type { ApiStockOrder } from '@/api/gen/types.gen';
import { Boton, clasesBoton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { fechaCorta, fechaLarga } from '@/util/fecha';
import { cantidad, dinero, fechaEntrega, nombreInstalacion } from '@/util/formato';
import { nombreCompleto } from '@/util/productor';
import { productores } from '@/api/productores';
import { puedePagarse } from '@/util/pago';
import { confirmar } from '@/componentes/ui/Confirmar';

const ruta = getRouteApi('/portal/stock/entregas/');

export function ListaEntregas() {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  return <Contenido empresa={empresa.id} />;
}

function Contenido({ empresa }: { empresa: number }) {
  const { t, i18n } = useTranslation();
  const filtro = ruta.useSearch();
  const navegar = useNavigate({ from: '/stock/entregas/' });
  const fijar = (c: Partial<typeof filtro>) => navegar({ search: (s) => ({ ...s, ...c }), replace: true });
  const instalaciones = useQuery(stock.instalacionesAcopio(empresa));
  const instalacion = instalaciones.data?.find((x) => x.id === filtro.inst);
  const productor = useQuery({ ...productores.ficha(filtro.prod ?? 0), enabled: !!filtro.prod });
  const [texto, setTexto] = useState(filtro.q ?? '');
  useEffect(() => {
    if (texto === (filtro.q ?? '')) return;
    const espera = setTimeout(() => fijar({ q: texto || undefined, pagina: undefined }), 300);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const consulta = useQuery(
    stock.entregas(empresa, {
      instalacion: filtro.inst,
      texto: filtro.q,
      mujeres: filtro.mujeres === undefined ? undefined : filtro.mujeres === 'si',
      semiproducto: filtro.semi,
      soloSaldo: filtro.saldo,
      pagina: filtro.pagina ?? 1,
      orden: { campo: filtro.orden ?? 'date', sentido: filtro.sentido ?? 'DESC' },
      // El filtro por productor solo existe en la lista de toda la empresa (como en el backend).
      productor: filtro.inst ? undefined : filtro.prod,
    }),
  );
  const total = consulta.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_STOCK));
  const borrar = useBorrarEntrega(empresa);
  // Entregas elegidas para un pago masivo (solo las que tienen precio y saldo pendiente).
  const [elegidas, setElegidas] = useState<number[]>([]);
  useEffect(() => setElegidas([]), [consulta.data]);
  const pagables = (consulta.data?.items ?? []).filter((e) => puedePagarse(e) && (e.balance ?? 0) > 0);

  async function exportar() {
    setExportando(true);
    setError(null);
    try {
      await exportarEntregas(empresa);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExportando(false);
    }
  }

  async function confirmarBorrado(e: ApiStockOrder) {
    if (!(await confirmar(t('stock.entregas.borrar_confirmar', { productor: nombreCompleto(e.producerUserCustomer ?? {}), fecha: fechaLarga(fechaEntrega(e), i18n.language) }), { accion: 'eliminar' }))) return;
    try {
      await borrar.mutateAsync(e.id!);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-titulo text-3xl font-semibold tracking-tight">{t('stock.entregas.titulo')}</h1>
          <p className="mt-1 text-tinta-2">{consulta.data ? t('stock.entregas.subtitulo', { count: total }) : t('stock.entregas.descripcion')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" onClick={exportar} disabled={exportando}>
            <Icono nombre="descarga" className="size-4" /> {exportando ? t('comun.cargando') : t('stock.entregas.exportar')}
          </Boton>
          <Link to="/stock/entregas/masiva" search={{ inst: filtro.inst }} className={clasesBoton('secundario')}>
            <Icono nombre="personas" className="size-4" /> {t('stock.entregas.masiva')}
          </Link>
          <Link to="/stock/entregas/nueva" search={{ inst: filtro.inst, productor: filtro.prod }} className={clasesBoton('primario')}>
            <Icono nombre="mas" className="size-4" /> {t('stock.entregas.nueva')}
          </Link>
        </div>
      </header>

      {error && <Aviso tono="mal">{error}</Aviso>}

      {filtro.prod && !filtro.inst && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-marca-suave py-1 pr-1 pl-3 font-semibold text-marca">
            {t('stock.entregas.de_productor', { nombre: productor.data ? nombreCompleto(productor.data) : `#${filtro.prod}` })}
            <button type="button" onClick={() => fijar({ prod: undefined, pagina: undefined })} className="grid size-6 place-items-center rounded-full hover:bg-marca/15" aria-label={t('stock.entregas.quitar_filtro_productor')}>
              <Icono nombre="cerrar" className="size-3.5" />
            </button>
          </span>
          <Link to="/productores/$id" params={{ id: String(filtro.prod) }} className="font-medium text-marca hover:underline">{t('stock.entregas.ver_ficha')}</Link>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-tinta-2">{t('stock.instalacion')}</span>
          <select
            value={filtro.inst ?? ''}
            onChange={(e) => fijar({ inst: e.target.value ? Number(e.target.value) : undefined, semi: undefined, prod: undefined, pagina: undefined })}
            className="h-11 min-w-56 rounded-lg border border-linea-fuerte bg-superficie px-3"
          >
            <option value="">{t('stock.todas_instalaciones')}</option>
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
        <label className="grid flex-1 gap-1 text-sm sm:max-w-sm">
          <span className="font-semibold text-tinta-2">{t('stock.entregas.buscar_productor')}</span>
          <span className="flex h-11 items-center gap-2 rounded-lg border border-linea-fuerte bg-superficie px-3 focus-within:border-marca focus-within:ring-3 focus-within:ring-marca/15">
            <Icono nombre="buscar" className="size-4 text-tinta-3" />
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" placeholder={t('stock.entregas.buscar_ph')} />
          </span>
        </label>
        <div className="flex flex-wrap items-end gap-2 self-end">
          <div className="inline-flex rounded-lg bg-superficie-2 p-1" role="group" aria-label={t('stock.entregas.cafe_mujeres')}>
            {(['', 'si', 'no'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={(filtro.mujeres ?? '') === v} onClick={() => fijar({ mujeres: v || undefined, pagina: undefined })} className="h-9 rounded-md px-3 text-sm font-semibold text-tinta-2 aria-pressed:bg-superficie aria-pressed:text-tinta aria-pressed:shadow-suave">
                {t(`stock.entregas.mujeres_${v || 'todas'}`)}
              </button>
            ))}
          </div>
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium text-tinta-2">
            <input type="checkbox" className="size-4 accent-[var(--marca)]" checked={!!filtro.saldo} onChange={(e) => fijar({ saldo: e.target.checked || undefined, pagina: undefined })} />
            {t('stock.entregas.solo_saldo')}
          </label>
        </div>
      </div>

      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <EstadoError reintentar={() => void consulta.refetch()} />
      ) : (consulta.data?.items ?? []).length === 0 ? (
        <div className="rounded-caja border border-dashed border-linea-fuerte p-10 text-center text-tinta-2">{t('stock.entregas.vacio')}</div>
      ) : (
        <>
          {elegidas.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-marca-suave px-4 py-2 text-sm">
              <span className="font-semibold text-marca">{t('stock.pagos.elegidas', { count: elegidas.length })}</span>
              <Link to="/stock/pagos/masivo/nuevo" search={{ entregas: elegidas.join(',') }} className={clasesBoton('primario', true)}>
                <Icono nombre="banco" className="size-4" /> {t('stock.pagos.masivo_boton', { count: elegidas.length })}
              </Link>
            </div>
          )}
          <div className="hidden relative overflow-x-auto rounded-caja border border-linea bg-superficie shadow-suave md:block">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-linea bg-superficie-2 text-tinta-2">
                <tr>
                  <th scope="col" className="w-10 py-3 pl-4">
                    {pagables.length > 0 && (
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--marca)]"
                        aria-label={t('stock.pagos.elegir_todas')}
                        checked={pagables.every((e) => elegidas.includes(e.id!))}
                        onChange={(ev) => setElegidas(ev.target.checked ? pagables.map((e) => e.id!) : [])}
                      />
                    )}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => fijar({ orden: 'date', sentido: filtro.orden !== 'lastChange' && filtro.sentido === 'ASC' ? 'DESC' : 'ASC' })} className="inline-flex items-center gap-1 hover:text-tinta">
                      {t('stock.entregas.col_fecha')} <span aria-hidden="true" className="text-marca">{filtro.sentido === 'ASC' ? '↑' : '↓'}</span>
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('stock.entregas.col_productor')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('stock.semiproducto')}</th>
                  {!filtro.inst && <th scope="col" className="px-4 py-3 font-semibold">{t('stock.instalacion')}</th>}
                  <th scope="col" className="px-4 py-3 text-right font-semibold">{t('stock.entregas.col_neto')}</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">{t('stock.entregas.col_pago')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('stock.entregas.col_estado')}</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">{t('productores.columnas.acciones')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {consulta.data!.items!.map((e) => (
                  <tr key={e.id} className="hover:bg-superficie-2/60">
                    <td className="py-3 pl-4">
                      {pagables.includes(e) && (
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--marca)]"
                          aria-label={t('stock.pagos.elegir_entrega', { productor: nombreCompleto(e.producerUserCustomer ?? {}), fecha: fechaCorta(fechaEntrega(e), i18n.language) })}
                          checked={elegidas.includes(e.id!)}
                          onChange={(ev) => setElegidas(ev.target.checked ? [...elegidas, e.id!] : elegidas.filter((x) => x !== e.id))}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to="/stock/entregas/$id" params={{ id: String(e.id) }} className="font-semibold hover:text-marca hover:underline">
                        {fechaCorta(fechaEntrega(e), i18n.language) || `#${e.id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{nombreCompleto(e.producerUserCustomer ?? {}) || '—'}</td>
                    <td className="px-4 py-3 text-tinta-2">{e.semiProduct?.name ?? '—'}</td>
                    {!filtro.inst && <td className="px-4 py-3 text-tinta-2">{nombreInstalacion(e.facility)}</td>}
                    <td className="px-4 py-3 text-right tabular-nums">{cantidad(e.totalQuantity, e.measureUnitType?.label, i18n.language)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{e.priceDeterminedLater ? t('stock.entregas.precio_despues') : dinero(e.cost, e.currency, i18n.language)}</td>
                    <td className="px-4 py-3"><EstadoPago e={e} /></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {pagables.includes(e) && (
                        <Link to="/stock/pagos/nuevo" search={{ entrega: e.id! }} className="inline-flex rounded-md p-1.5 text-tinta-3 hover:bg-ok-suave hover:text-ok" aria-label={t('stock.pagos.pagar_entrega', { productor: nombreCompleto(e.producerUserCustomer ?? {}) })} title={t('stock.pagos.pagar')}>
                          <Icono nombre="precio" className="size-4" />
                        </Link>
                      )}
                      <button type="button" onClick={() => void confirmarBorrado(e)} className="rounded-md p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('stock.entregas.borrar')}>
                        <Icono nombre="borrar" className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {consulta.data!.items!.map((e) => (
              <li key={e.id} className="overflow-hidden rounded-caja border border-linea bg-superficie shadow-suave">
                <Link to="/stock/entregas/$id" params={{ id: String(e.id) }} className="grid gap-2 p-4">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{nombreCompleto(e.producerUserCustomer ?? {}) || '—'}</span>
                      <span className="block truncate text-sm text-tinta-2">{[fechaCorta(fechaEntrega(e), i18n.language), e.semiProduct?.name].filter(Boolean).join(' · ')}</span>
                    </span>
                    <EstadoPago e={e} />
                  </span>
                  <span className="flex justify-between gap-3 text-sm tabular-nums">
                    <span>{cantidad(e.totalQuantity, e.measureUnitType?.label, i18n.language)}</span>
                    <span className="font-semibold">{e.priceDeterminedLater ? t('stock.entregas.precio_despues') : dinero(e.cost, e.currency, i18n.language)}</span>
                  </span>
                </Link>
                {/* Acciones de pago fuera del enlace de la tarjeta (no se anidan elementos interactivos). */}
                {pagables.includes(e) && (
                  <div className="flex items-center justify-between gap-3 border-t border-linea bg-superficie-2/60 px-4 py-2">
                    <label className="inline-flex items-center gap-2 text-sm text-tinta-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--marca)]"
                        aria-label={t('stock.pagos.elegir_entrega', { productor: nombreCompleto(e.producerUserCustomer ?? {}), fecha: fechaCorta(fechaEntrega(e), i18n.language) })}
                        checked={elegidas.includes(e.id!)}
                        onChange={(ev) => setElegidas(ev.target.checked ? [...elegidas, e.id!] : elegidas.filter((x) => x !== e.id))}
                      />
                      {t('stock.pagos.para_masivo')}
                    </label>
                    <Link to="/stock/pagos/nuevo" search={{ entrega: e.id! }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-marca hover:underline" aria-label={t('stock.pagos.pagar_entrega', { productor: nombreCompleto(e.producerUserCustomer ?? {}) })}>
                      <Icono nombre="precio" className="size-4" /> {t('stock.pagos.pagar')}
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
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

/** Pagado, con saldo pendiente o sin precio todavía. */
export function EstadoPago({ e }: { e: ApiStockOrder }) {
  const { t, i18n } = useTranslation();
  if (e.priceDeterminedLater || typeof e.balance !== 'number') return <span className="rounded-full bg-superficie-2 px-2.5 py-1 text-xs font-semibold text-tinta-3">{t('stock.entregas.sin_precio')}</span>;
  if (e.balance <= 0) return <span className="rounded-full bg-ok-suave px-2.5 py-1 text-xs font-semibold text-ok">{t('stock.entregas.pagada')}</span>;
  return <span className="rounded-full bg-aviso-suave px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-aviso">{t('stock.entregas.debe', { monto: dinero(e.balance, e.currency, i18n.language) })}</span>;
}
