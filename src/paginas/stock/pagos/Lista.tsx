import { useEffect, useState } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { POR_PAGINA_PAGOS, exportarPagos, exportarPagosMasivos, pagos, useBorrarPago, useConfirmarPago } from '@/api/pagos';
import { productores } from '@/api/productores';
import type { ApiPayment } from '@/api/gen/types.gen';
import { Boton, clasesBoton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { fechaCorta } from '@/util/fecha';
import { dinero } from '@/util/formato';
import { nombreCompleto } from '@/util/productor';
import { confirmar as preguntar } from '@/componentes/ui/Confirmar';

const ruta = getRouteApi('/portal/stock/pagos/');
const FORMAS = ['CASH', 'CASH_VIA_COLLECTOR', 'BANK_TRANSFER', 'CHEQUE', 'OFFSETTING', 'UNKNOWN'] as const;

export function ListaPagos() {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  return <Contenido empresa={empresa.id} />;
}

function Contenido({ empresa }: { empresa: number }) {
  const { t } = useTranslation();
  const filtro = ruta.useSearch();
  const navegar = useNavigate({ from: '/stock/pagos/' });
  const fijar = (c: Partial<typeof filtro>) => navegar({ search: (s) => ({ ...s, ...c }), replace: true });
  const [error, setError] = useState<string | null>(null);
  const masivos = filtro.vista === 'masivos';

  async function exportar() {
    setError(null);
    try {
      await (masivos ? exportarPagosMasivos(empresa) : exportarPagos(empresa));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="grid gap-6 [&>*]:min-w-0">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-titulo text-3xl font-semibold tracking-tight">{t('stock.pagos.titulo')}</h1>
          <p className="mt-1 max-w-2xl text-tinta-2">{t('stock.pagos.descripcion')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" onClick={() => void exportar()}>
            <Icono nombre="descarga" className="size-4" /> {t('stock.entregas.exportar')}
          </Boton>
          <Link to="/stock/entregas" search={{ saldo: true }} className={clasesBoton('primario')}>
            <Icono nombre="mas" className="size-4" /> {t('stock.pagos.nuevo')}
          </Link>
        </div>
      </header>

      <div className="inline-flex w-fit rounded-lg bg-superficie-2 p-1" role="group" aria-label={t('stock.todo.vista')}>
        {([undefined, 'masivos'] as const).map((v) => (
          <button key={v ?? 'pagos'} type="button" aria-pressed={filtro.vista === v} onClick={() => navegar({ search: { vista: v }, replace: true })} className="h-9 rounded-md px-3 text-sm font-semibold text-tinta-2 aria-pressed:bg-superficie aria-pressed:text-tinta aria-pressed:shadow-suave">
            {v ? t('stock.pagos.vista_masivos') : t('stock.pagos.vista_pagos')}
          </button>
        ))}
      </div>

      {error && <Aviso tono="mal">{error}</Aviso>}
      {masivos ? <Masivos empresa={empresa} pagina={filtro.pagina ?? 1} fijar={fijar} /> : <Pagos empresa={empresa} filtro={filtro} fijar={fijar} setError={setError} />}
    </div>
  );
}

type Filtro = ReturnType<typeof ruta.useSearch>;

function Pagos({ empresa, filtro, fijar, setError }: { empresa: number; filtro: Filtro; fijar: (c: Partial<Filtro>) => void; setError: (e: string | null) => void }) {
  const { t, i18n } = useTranslation();
  const [texto, setTexto] = useState(filtro.q ?? '');
  useEffect(() => {
    if (texto === (filtro.q ?? '')) return;
    const espera = setTimeout(() => fijar({ q: texto || undefined, pagina: undefined }), 300);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);
  const productor = useQuery({ ...productores.ficha(filtro.prod ?? 0), enabled: !!filtro.prod });
  const consulta = useQuery(
    pagos.lista(empresa, {
      texto: filtro.q,
      forma: filtro.forma,
      estado: filtro.estado,
      desde: filtro.desde,
      hasta: filtro.hasta,
      productor: filtro.prod,
      pagina: filtro.pagina ?? 1,
      orden: { campo: filtro.orden ?? 'id', sentido: filtro.sentido ?? 'DESC' },
    }),
  );
  const items = consulta.data?.items ?? [];
  const total = consulta.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_PAGOS));
  const confirmar = useConfirmarPago();
  const borrar = useBorrarPago();
  const [elegidos, setElegidos] = useState<number[]>([]);
  const sinConfirmar = items.filter((p) => p.paymentStatus === 'UNCONFIRMED');

  async function confirmarLista(lista: ApiPayment[]) {
    if (lista.length === 0 || !(await preguntar(t('stock.pagos.confirmar_pregunta', { count: lista.length })))) return;
    setError(null);
    try {
      for (const p of lista) await confirmar.mutateAsync(p);
      setElegidos([]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function eliminar(p: ApiPayment) {
    if (!(await preguntar(t('stock.pagos.borrar_pregunta', { monto: dinero(p.amount, p.currency, i18n.language) }), { accion: 'eliminar' }))) return;
    setError(null);
    try {
      await borrar.mutateAsync(p.id!);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-tinta-2">{t('stock.entregas.buscar_productor')}</span>
          <span className="flex h-11 items-center gap-2 rounded-lg border border-linea-fuerte bg-superficie px-3 focus-within:border-marca focus-within:ring-3 focus-within:ring-marca/15">
            <Icono nombre="buscar" className="size-4 text-tinta-3" />
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} className="w-44 bg-transparent outline-none" placeholder={t('stock.entregas.buscar_ph')} />
          </span>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-tinta-2">{t('stock.entrega.forma_pago')}</span>
          <select value={filtro.forma ?? ''} onChange={(e) => fijar({ forma: (e.target.value || undefined) as Filtro['forma'], pagina: undefined })} className="h-11 rounded-lg border border-linea-fuerte bg-superficie px-3">
            <option value="">{t('stock.entregas.mujeres_todas')}</option>
            {FORMAS.map((f) => <option key={f} value={f}>{t(`stock.forma_pago.${f}`)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-tinta-2">{t('stock.pagos.estado')}</span>
          <select value={filtro.estado ?? ''} onChange={(e) => fijar({ estado: (e.target.value || undefined) as Filtro['estado'], pagina: undefined })} className="h-11 rounded-lg border border-linea-fuerte bg-superficie px-3">
            <option value="">{t('stock.entregas.mujeres_todas')}</option>
            <option value="UNCONFIRMED">{t('stock.pagos.UNCONFIRMED')}</option>
            <option value="CONFIRMED">{t('stock.pagos.CONFIRMED')}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-tinta-2">{t('stock.pagos.entregas_desde')}</span>
          <input type="date" value={filtro.desde ?? ''} onChange={(e) => fijar({ desde: e.target.value || undefined, pagina: undefined })} className="h-11 rounded-lg border border-linea-fuerte bg-superficie px-3" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-tinta-2">{t('stock.proc.hasta')}</span>
          <input type="date" value={filtro.hasta ?? ''} onChange={(e) => fijar({ hasta: e.target.value || undefined, pagina: undefined })} className="h-11 rounded-lg border border-linea-fuerte bg-superficie px-3" />
        </label>
      </div>

      {filtro.prod && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-marca-suave py-1 pr-1 pl-3 font-semibold text-marca">
            {t('stock.entregas.de_productor', { nombre: productor.data ? nombreCompleto(productor.data) : `#${filtro.prod}` })}
            <button type="button" onClick={() => fijar({ prod: undefined, pagina: undefined })} className="grid size-6 place-items-center rounded-full hover:bg-marca/15" aria-label={t('stock.entregas.quitar_filtro_productor')}>
              <Icono nombre="cerrar" className="size-3.5" />
            </button>
          </span>
        </p>
      )}

      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <EstadoError reintentar={() => void consulta.refetch()} />
      ) : items.length === 0 ? (
        <div className="rounded-caja border border-dashed border-linea-fuerte p-10 text-center text-tinta-2">{t('stock.pagos.vacio')}</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-tinta-2">{t('stock.pagos.total', { count: total })}</p>
            {sinConfirmar.length > 0 && (
              <Boton chico variante="secundario" disabled={elegidos.length === 0 || confirmar.isPending} onClick={() => void confirmarLista(sinConfirmar.filter((p) => elegidos.includes(p.id!)))}>
                <Icono nombre="ok" className="size-4" /> {t('stock.pagos.confirmar_elegidos', { count: elegidos.length })}
              </Boton>
            )}
          </div>
          <div className="relative overflow-x-auto rounded-caja border border-linea bg-superficie shadow-suave">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b border-linea bg-superficie-2 text-tinta-2">
                <tr>
                  <th scope="col" className="w-10 px-3 py-3">
                    {sinConfirmar.length > 0 && (
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--marca)]"
                        aria-label={t('stock.pagos.elegir_todos')}
                        checked={sinConfirmar.every((p) => elegidos.includes(p.id!))}
                        onChange={(e) => setElegidos(e.target.checked ? sinConfirmar.map((p) => p.id!) : [])}
                      />
                    )}
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    <button type="button" onClick={() => fijar({ orden: 'id', sentido: filtro.orden !== 'productionDate' && filtro.sentido === 'ASC' ? 'DESC' : 'ASC' })} className="hover:text-tinta">
                      {t('stock.pagos.col_fecha')}
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">{t('stock.pagos.col_entrega')}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{t('stock.entrega.productor')}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{t('stock.pagos.proposito')}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{t('stock.pagos.tipo')}</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">{t('stock.pagos.monto')}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{t('stock.pagos.estado')}</th>
                  <th scope="col" className="px-3 py-3"><span className="sr-only">{t('productores.columnas.acciones')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {items.map((p) => {
                  const pendiente = p.paymentStatus === 'UNCONFIRMED';
                  const aEmpresa = p.recipientType === 'COMPANY';
                  const ref = (aEmpresa ? p.stockOrder?.orderId || p.stockOrder?.internalLotNumber : p.stockOrder?.identifier) || `#${p.stockOrder?.id}`;
                  return (
                    <tr key={p.id} className="hover:bg-superficie-2/60">
                      <td className="px-3 py-3">
                        {pendiente && (
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--marca)]"
                            aria-label={t('stock.pagos.elegir', { ref })}
                            checked={elegidos.includes(p.id!)}
                            onChange={(e) => setElegidos(e.target.checked ? [...elegidos, p.id!] : elegidos.filter((x) => x !== p.id))}
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Link to="/stock/pagos/$id" params={{ id: String(p.id) }} className="font-semibold hover:text-marca hover:underline">{fechaCorta(p.formalCreationTime, i18n.language) || `#${p.id}`}</Link>
                      </td>
                      <td className="px-3 py-3">
                        {!p.stockOrder?.id ? '—' : aEmpresa ? (
                          <Link to="/stock/procesamiento/$lote" params={{ lote: String(p.stockOrder.id) }} className="hover:text-marca hover:underline">{ref}</Link>
                        ) : (
                          <Link to="/stock/entregas/$id" params={{ id: String(p.stockOrder.id) }} className="hover:text-marca hover:underline">{ref}</Link>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {p.recipientUserCustomer ? nombreCompleto(p.recipientUserCustomer) : p.recipientCompany?.name ?? '—'}
                        {p.representativeOfRecipientUserCustomer && <span className="block text-xs text-tinta-3">{t('stock.pagos.via', { nombre: nombreCompleto(p.representativeOfRecipientUserCustomer) })}</span>}
                      </td>
                      <td className="px-3 py-3 text-tinta-2">{p.paymentPurposeType ? t(`stock.pagos.propositos.${p.paymentPurposeType}`) : '—'}</td>
                      <td className="px-3 py-3 text-tinta-2">{p.paymentType ? t(`stock.forma_pago.${p.paymentType}`) : '—'}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{dinero(p.amount, p.currency, i18n.language)}</td>
                      <td className="px-3 py-3"><EstadoPagoChip estado={p.paymentStatus} /></td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          {pendiente && (
                            <button type="button" onClick={() => void confirmarLista([p])} className="rounded-md p-1.5 text-tinta-3 hover:bg-ok-suave hover:text-ok" aria-label={t('stock.pagos.confirmar_uno', { ref })} title={t('stock.pagos.confirmar')}>
                              <Icono nombre="ok" className="size-4" />
                            </button>
                          )}
                          <button type="button" onClick={() => void eliminar(p)} className="rounded-md p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('stock.pagos.borrar_uno', { ref })} title={t('stock.pagos.borrar')}>
                            <Icono nombre="borrar" className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {paginas > 1 && <Paginacion pagina={filtro.pagina ?? 1} paginas={paginas} ir={(n) => fijar({ pagina: n > 1 ? n : undefined })} />}
        </>
      )}
    </div>
  );
}

export function EstadoPagoChip({ estado }: { estado?: ApiPayment['paymentStatus'] }) {
  const { t } = useTranslation();
  return estado === 'CONFIRMED' ? (
    <span className="rounded-full bg-ok-suave px-2.5 py-1 text-xs font-semibold text-ok">{t('stock.pagos.CONFIRMED')}</span>
  ) : (
    <span className="rounded-full bg-aviso-suave px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-aviso">{t('stock.pagos.UNCONFIRMED')}</span>
  );
}

function Paginacion({ pagina, paginas, ir }: { pagina: number; paginas: number; ir: (n: number) => void }) {
  const { t } = useTranslation();
  return (
    <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t('productores.paginacion')}>
      <span className="text-tinta-2">{t('productores.pagina', { pagina, total: paginas })}</span>
      <div className="flex gap-2">
        <Boton variante="secundario" chico disabled={pagina <= 1} onClick={() => ir(pagina - 1)}>{t('productores.anterior')}</Boton>
        <Boton variante="secundario" chico disabled={pagina >= paginas} onClick={() => ir(pagina + 1)}>{t('productores.siguiente')}</Boton>
      </div>
    </nav>
  );
}

function Masivos({ empresa, pagina, fijar }: { empresa: number; pagina: number; fijar: (c: Partial<Filtro>) => void }) {
  const { t, i18n } = useTranslation();
  const consulta = useQuery(pagos.masivos(empresa, pagina));
  const items = consulta.data?.items ?? [];
  const paginas = Math.max(1, Math.ceil((consulta.data?.count ?? 0) / POR_PAGINA_PAGOS));
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <EstadoError reintentar={() => void consulta.refetch()} />;
  if (items.length === 0) return <div className="rounded-caja border border-dashed border-linea-fuerte p-10 text-center text-tinta-2">{t('stock.pagos.sin_masivos')}</div>;
  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <div className="relative overflow-x-auto rounded-caja border border-linea bg-superficie shadow-suave">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-linea bg-superficie-2 text-tinta-2">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">{t('stock.pagos.col_fecha')}</th>
              <th scope="col" className="px-4 py-3 font-semibold">{t('stock.pagos.recibo')}</th>
              <th scope="col" className="px-4 py-3 font-semibold">{t('stock.pagos.descripcion_masivo')}</th>
              <th scope="col" className="px-4 py-3 font-semibold">{t('stock.pagos.proposito')}</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">{t('stock.pagos.monto_total')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {items.map((m) => (
              <tr key={m.id} className="hover:bg-superficie-2/60">
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link to="/stock/pagos/masivo/$id" params={{ id: String(m.id) }} className="font-semibold hover:text-marca hover:underline">{fechaCorta(m.formalCreationTime, i18n.language) || `#${m.id}`}</Link>
                </td>
                <td className="px-4 py-3">{m.receiptNumber || '—'}</td>
                <td className="px-4 py-3 text-tinta-2">{m.paymentDescription || '—'}</td>
                <td className="px-4 py-3 text-tinta-2">{m.paymentPurposeType ? t(`stock.pagos.propositos.${m.paymentPurposeType}`) : '—'}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{dinero(m.totalAmount, m.currency, i18n.language)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginas > 1 && <Paginacion pagina={pagina} paginas={paginas} ir={(n) => fijar({ pagina: n > 1 ? n : undefined })} />}
    </div>
  );
}
