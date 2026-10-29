import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link, getRouteApi, useBlocker, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { pagos, useBorrarPago, useConfirmarPago, useGuardarPago } from '@/api/pagos';
import { subirDocumento } from '@/api/productores';
import { stock } from '@/api/stock';
import { urlDocumento } from '@/api/respuesta';
import type { ApiPayment, ApiStockOrder } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { fechaCorta } from '@/util/fecha';
import { cantidad, dinero, fechaEntrega, nombreInstalacion } from '@/util/formato';
import { nombreCompleto } from '@/util/productor';
import { PROPOSITOS, armarPago, armarPagoAEmpresa, pagaDeMas, pagoAEmpresaNuevo, pagoNuevo, puedePagarse, puedePagarseOrden, tiposDePago, validarPago, type ErroresPago, type FormPago } from '@/util/pago';
import { CONTROL } from '../entregas/campos';
import { MensajeError, NumeroConUnidad } from '../procesamiento/piezas';
import { EstadoPagoChip } from './Lista';

const rutaNuevo = getRouteApi('/portal/stock/pagos/nuevo');
const rutaVer = getRouteApi('/portal/stock/pagos/$id');

export function PagoNuevo() {
  const { t } = useTranslation();
  const { entrega, orden } = rutaNuevo.useSearch();
  const empresa = useEmpresaActual();
  // Se paga una entrega a su productor, o una orden emitida a la empresa proveedora.
  const id = orden ?? entrega;
  const e = useQuery({ ...stock.entrega(id ?? 0), enabled: !!id });
  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  if (!id) return <EstadoError texto={t('stock.pagos.falta_entrega')} />;
  if (e.isPending) return <Cargando />;
  if (e.isError) return <EstadoError texto={e.error.message} reintentar={() => void e.refetch()} />;
  if (orden) {
    if (!puedePagarseOrden(e.data)) return <Aviso tono="aviso" titulo={t('stock.pagos.orden_no_se_puede')}>{t('stock.pagos.orden_no_se_puede_texto')}</Aviso>;
    return <Formulario empresa={empresa.id} entrega={e.data} aEmpresa />;
  }
  if (!puedePagarse(e.data)) return <Aviso tono="aviso" titulo={t('stock.pagos.no_se_puede')}>{t('stock.pagos.no_se_puede_texto')}</Aviso>;
  return <Formulario empresa={empresa.id} entrega={e.data} />;
}

/** Datos de la orden que se paga: a qué empresa, qué se pidió y cuánto se cumplió. */
function ResumenOrden({ o }: { o: ApiStockOrder }) {
  const { t, i18n } = useTranslation();
  const unidad = o.measureUnitType?.label;
  const filas: [string, ReactNode][] = [
    [t('stock.ord.col_orden'), <Link key="o" to="/stock/procesamiento/$lote" params={{ lote: String(o.id) }} className="text-marca hover:underline">{o.orderId || o.internalLotNumber || `#${o.id}`}</Link>],
    [t('stock.ord.col_proveedor'), o.quoteCompany?.name ?? '—'],
    ...(o.quoteFacility ? [[t('stock.ord.instalacion_proveedor'), nombreInstalacion(o.quoteFacility)] as [string, ReactNode]] : []),
    [t('stock.ord.col_producto'), o.semiProduct?.name ?? o.finalProduct?.name ?? '—'],
    [t('stock.ord.col_entrega'), fechaCorta(o.deliveryTime, i18n.language) || '—'],
    [t('stock.ord.resumen_pedido'), cantidad(o.totalQuantity, unidad, i18n.language)],
    [t('stock.ord.resumen_enviado'), cantidad(o.fulfilledQuantity ?? 0, unidad, i18n.language)],
  ];
  return (
    <aside className="grid gap-3 rounded-caja border border-linea bg-superficie p-5 shadow-suave lg:sticky lg:top-24">
      <h2 className="font-titulo text-lg font-semibold">{t('stock.ord.el_pedido')}</h2>
      <dl className="grid gap-2 text-sm">
        {filas.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-tinta-2">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

/** Datos de la entrega que se paga: a quién, cuánto costó, cuánto se pagó y cuánto falta. */
function ResumenEntrega({ e }: { e: ApiStockOrder }) {
  const { t, i18n } = useTranslation();
  const filas: [string, ReactNode][] = [
    [t('stock.pagos.col_entrega'), <Link key="e" to="/stock/entregas/$id" params={{ id: String(e.id) }} className="text-marca hover:underline">{e.identifier || `#${e.id}`}</Link>],
    [t('stock.entrega.fecha'), fechaCorta(fechaEntrega(e), i18n.language)],
    [t('stock.entrega.productor'), e.producerUserCustomer ? nombreCompleto(e.producerUserCustomer) : '—'],
    ...(e.representativeOfProducerUserCustomer ? [[t('stock.entrega.acopiador'), nombreCompleto(e.representativeOfProducerUserCustomer)] as [string, ReactNode]] : []),
    [t('stock.entrega.forma_pago'), e.preferredWayOfPayment ? t(`stock.forma_pago.${e.preferredWayOfPayment}`) : '—'],
    [t('stock.entrega.pago_base'), dinero(e.cost, e.currency, i18n.language)],
    [t('stock.pagos.pagado'), dinero(e.paid ?? 0, e.currency, i18n.language)],
  ];
  return (
    <aside className="grid gap-3 rounded-caja border border-linea bg-superficie p-5 shadow-suave lg:sticky lg:top-24">
      <h2 className="font-titulo text-lg font-semibold">{t('stock.pagos.la_entrega')}</h2>
      <dl className="grid gap-2 text-sm">
        {filas.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-tinta-2">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-linea pt-3">
          <dt className="text-tinta-2">{t('stock.pagos.saldo')}</dt>
          <dd className="text-xl font-semibold tabular-nums">{dinero(e.balance ?? 0, e.currency, i18n.language)}</dd>
        </div>
      </dl>
    </aside>
  );
}

function Formulario({ empresa, entrega, aEmpresa = false }: { empresa: number; entrega: ApiStockOrder; aEmpresa?: boolean }) {
  const { t, i18n } = useTranslation();
  const navegar = useNavigate();
  const guardar = useGuardarPago();
  const [f, setF] = useState<FormPago>(() => (aEmpresa ? pagoAEmpresaNuevo(entrega) : pagoNuevo(entrega)));
  const [tocado, setTocado] = useState(false);
  const [errores, setErrores] = useState<ErroresPago>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const cambiar = (c: Partial<FormPago>) => {
    setF((x) => ({ ...x, ...c }));
    setTocado(true);
  };
  const conAcopiador = !!entrega.representativeOfProducerUserCustomer?.id;
  const err = (k: keyof FormPago) => (errores[k] ? t(`stock.pagos.errores.${errores[k]}`, { defaultValue: t(`stock.errores.${errores[k]}`) }) : undefined);
  const ids = { fecha: useId(), proposito: useId(), tipo: useId(), moneda: useId(), recibo: useId(), comprobante: useId() };

  useBlocker({ shouldBlockFn: () => tocado && !guardar.isPending && !window.confirm(t('stock.entrega.salir_sin_guardar')), enableBeforeUnload: () => tocado });
  useEffect(() => {
    document.title = `${t('stock.pagos.nuevo')} · INATrace v2`;
  }, [t]);

  async function subir(archivo?: File) {
    if (!archivo) return;
    setSubiendo(true);
    try {
      cambiar({ documento: await subirDocumento(archivo) });
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setSubiendo(false);
    }
  }

  async function alGuardar() {
    setAviso(null);
    const e = validarPago(f);
    setErrores(e);
    if (Object.keys(e).length) {
      setAviso(t('stock.entrega.revisar'));
      return;
    }
    try {
      await guardar.mutateAsync(aEmpresa ? armarPagoAEmpresa(f, entrega, empresa) : armarPago(f, entrega, empresa));
      setTocado(false);
      if (aEmpresa) await navegar({ to: '/stock/pagos' });
      else await navegar({ to: '/stock/entregas/$id', params: { id: String(entrega.id) } });
    } catch (x) {
      setAviso((x as Error).message);
    }
  }

  return (
    <div className="grid gap-6 pb-24">
      <header>
        <Link to="/stock/pagos" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
          <Icono nombre="volver" className="size-4" /> {t('stock.pagos.titulo')}
        </Link>
        <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{t('stock.pagos.nuevo_para', { productor: aEmpresa ? entrega.quoteCompany?.name : entrega.producerUserCustomer ? nombreCompleto(entrega.producerUserCustomer) : entrega.identifier })}</h1>
      </header>
      {aviso && <Aviso tono="mal">{aviso}</Aviso>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="grid gap-5 rounded-caja border border-linea bg-superficie p-5 shadow-suave sm:grid-cols-2 sm:p-6">
          <Campo id={ids.fecha} etiqueta={t('stock.pagos.fecha')} requerido error={err('fecha')}>
            <input id={ids.fecha} type="date" value={f.fecha} aria-invalid={!!err('fecha')} onChange={(e) => cambiar({ fecha: e.target.value })} className={CONTROL + ' h-11'} />
          </Campo>
          <Campo id={ids.proposito} etiqueta={t('stock.pagos.proposito')} requerido error={err('proposito')}>
            <select id={ids.proposito} value={f.proposito} aria-invalid={!!err('proposito')} onChange={(e) => cambiar({ proposito: e.target.value as FormPago['proposito'] })} className={CONTROL + ' h-11'}>
              <option value="">{t('stock.elegir')}</option>
              {PROPOSITOS.map((p) => <option key={p} value={p}>{t(`stock.pagos.propositos.${p}`)}</option>)}
            </select>
          </Campo>
          <Campo id={ids.tipo} etiqueta={t('stock.pagos.tipo')} requerido error={err('tipo')}>
            <select id={ids.tipo} value={f.tipo} disabled={aEmpresa} aria-invalid={!!err('tipo')} onChange={(e) => cambiar({ tipo: e.target.value as FormPago['tipo'] })} className={CONTROL + ' h-11'}>
              <option value="">{t('stock.elegir')}</option>
              {tiposDePago(conAcopiador).map((x) => <option key={x} value={x}>{t(`stock.forma_pago.${x}`)}</option>)}
            </select>
          </Campo>
          <NumeroConUnidad
            etiqueta={t('stock.pagos.monto')}
            requerido
            valor={f.monto}
            alCambiar={(monto) => cambiar({ monto })}
            unidad={f.moneda || undefined}
            error={err('monto')}
            ayuda={!aEmpresa && pagaDeMas(f, entrega) ? <span className="text-aviso">{t('stock.pagos.de_mas', { saldo: dinero(entrega.balance, entrega.currency, i18n.language) })}</span> : undefined}
          />
          <Campo id={ids.moneda} etiqueta={t('stock.entrega.moneda')} requerido error={err('moneda')}>
            <input id={ids.moneda} value={f.moneda} maxLength={3} aria-invalid={!!err('moneda')} onChange={(e) => cambiar({ moneda: e.target.value.toUpperCase() })} className={CONTROL + ' h-11 uppercase'} />
          </Campo>
          <Campo id={ids.recibo} etiqueta={t('stock.pagos.recibo')}>
            <input id={ids.recibo} value={f.recibo} onChange={(e) => cambiar({ recibo: e.target.value })} className={CONTROL + ' h-11'} />
          </Campo>
          <Campo id={ids.comprobante} etiqueta={t('stock.pagos.tipo_comprobante')}>
            <select id={ids.comprobante} value={f.tipoComprobante} disabled={aEmpresa || !conAcopiador} onChange={(e) => cambiar({ tipoComprobante: e.target.value as FormPago['tipoComprobante'] })} className={CONTROL + ' h-11'}>
              <option value="">{t('stock.elegir')}</option>
              <option value="RECEIPT">{t('stock.pagos.comprobantes.RECEIPT')}</option>
              <option value="PURCHASE_SHEET">{t('stock.pagos.comprobantes.PURCHASE_SHEET')}</option>
            </select>
          </Campo>
          <div className="grid content-start gap-1.5">
            <span className="text-sm font-semibold text-tinta-2">
              {t('stock.pagos.documento')}
              {f.proposito === 'FIRST_INSTALLMENT' && <span className="text-mal" aria-hidden="true"> *</span>}
            </span>
            {f.documento ? (
              <span className="flex h-11 items-center gap-2 text-sm">
                <a href={urlDocumento(f.documento.storageKey)} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium text-marca hover:underline">{f.documento.name}</a>
                <button type="button" onClick={() => cambiar({ documento: null })} className="rounded p-1 text-tinta-3 hover:text-mal" aria-label={t('stock.proc.quitar_archivo')}>
                  <Icono nombre="cerrar" className="size-4" />
                </button>
              </span>
            ) : (
              <label className={'inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm font-semibold ' + (err('documento') ? 'border-mal text-mal' : 'border-linea-fuerte text-tinta-2 hover:border-marca hover:text-marca')}>
                <Icono nombre="subir" className="size-4" /> {subiendo ? t('comun.cargando') : t('stock.proc.subir_archivo')}
                <input type="file" className="sr-only" aria-label={t('stock.pagos.documento')} onChange={(e) => void subir(e.target.files?.[0])} />
              </label>
            )}
            <MensajeError>{err('documento')}</MensajeError>
          </div>
        </section>
        {aEmpresa ? <ResumenOrden o={entrega} /> : <ResumenEntrega e={entrega} />}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-linea bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <Boton onClick={() => void alGuardar()} disabled={guardar.isPending}>
            <Icono nombre="ok" className="size-4" /> {guardar.isPending ? t('comun.cargando') : t('stock.pagos.registrar')}
          </Boton>
        </div>
      </div>
    </div>
  );
}

function Campo({ id, etiqueta, requerido, error, children }: { id: string; etiqueta: string; requerido?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-tinta-2">
        {etiqueta}
        {requerido && <span className="text-mal" aria-hidden="true"> *</span>}
      </label>
      {children}
      <MensajeError>{error}</MensajeError>
    </div>
  );
}

// ---------- Ver un pago ----------

export function PagoVer() {
  const { t, i18n } = useTranslation();
  const { id } = rutaVer.useParams();
  const navegar = useNavigate();
  const pago = useQuery(pagos.pago(Number(id)));
  const confirmar = useConfirmarPago();
  const borrar = useBorrarPago();
  const [aviso, setAviso] = useState<string | null>(null);

  if (pago.isPending) return <Cargando />;
  if (pago.isError) return <EstadoError texto={pago.error.message} reintentar={() => void pago.refetch()} />;
  const p: ApiPayment = pago.data;
  const pendiente = p.paymentStatus === 'UNCONFIRMED';

  async function alConfirmar() {
    if (!window.confirm(t('stock.pagos.confirmar_pregunta', { count: 1 }))) return;
    try {
      await confirmar.mutateAsync(p);
    } catch (e) {
      setAviso((e as Error).message);
    }
  }
  async function alBorrar() {
    if (!window.confirm(t('stock.pagos.borrar_pregunta', { monto: dinero(p.amount, p.currency, i18n.language) }))) return;
    try {
      await borrar.mutateAsync(p.id!);
      await navegar({ to: '/stock/pagos' });
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  const datos: [string, ReactNode][] = [
    [t('stock.pagos.fecha'), fechaCorta(p.formalCreationTime, i18n.language)],
    p.recipientType === 'COMPANY'
      ? [t('stock.ord.col_orden'), p.stockOrder?.id ? <Link key="e" to="/stock/procesamiento/$lote" params={{ lote: String(p.stockOrder.id) }} className="text-marca hover:underline">{p.stockOrder.orderId || p.stockOrder.internalLotNumber || `#${p.stockOrder.id}`}</Link> : '—']
      : [t('stock.pagos.col_entrega'), p.stockOrder?.id ? <Link key="e" to="/stock/entregas/$id" params={{ id: String(p.stockOrder.id) }} className="text-marca hover:underline">{p.stockOrder.identifier || `#${p.stockOrder.id}`}</Link> : '—'],
    p.recipientType === 'COMPANY' ? [t('stock.pagos.pagado_a'), p.recipientCompany?.name ?? '—'] : [t('stock.entrega.productor'), p.recipientUserCustomer ? nombreCompleto(p.recipientUserCustomer) : '—'],
    ...(p.representativeOfRecipientUserCustomer ? [[t('stock.entrega.acopiador'), nombreCompleto(p.representativeOfRecipientUserCustomer)] as [string, ReactNode]] : []),
    [t('stock.pagos.proposito'), p.paymentPurposeType ? t(`stock.pagos.propositos.${p.paymentPurposeType}`) : '—'],
    [t('stock.pagos.tipo'), p.paymentType ? t(`stock.forma_pago.${p.paymentType}`) : '—'],
    [t('stock.pagos.recibo'), p.receiptNumber || '—'],
    [t('stock.pagos.tipo_comprobante'), p.receiptDocumentType ? t(`stock.pagos.comprobantes.${p.receiptDocumentType}`) : '—'],
    [t('stock.pagos.documento'), p.receiptDocument ? <a key="d" href={urlDocumento(p.receiptDocument.storageKey)} target="_blank" rel="noreferrer" className="text-marca hover:underline">{p.receiptDocument.name}</a> : '—'],
    ...(p.paymentStatus === 'CONFIRMED'
      ? [[t('stock.pagos.confirmado_por'), [p.paymentConfirmedByUser ? nombreCompleto(p.paymentConfirmedByUser) : null, fechaCorta(p.paymentConfirmedAtTime, i18n.language)].filter(Boolean).join(' · ')] as [string, ReactNode]]
      : []),
  ];

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/stock/pagos" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
            <Icono nombre="volver" className="size-4" /> {t('stock.pagos.titulo')}
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 font-titulo text-3xl font-semibold tracking-tight">
            {dinero(p.amount, p.currency, i18n.language)} <EstadoPagoChip estado={p.paymentStatus} />
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {pendiente && (
            <Boton onClick={() => void alConfirmar()} disabled={confirmar.isPending}>
              <Icono nombre="ok" className="size-4" /> {t('stock.pagos.confirmar')}
            </Boton>
          )}
          <Boton variante="peligro" onClick={() => void alBorrar()} disabled={borrar.isPending}>
            <Icono nombre="borrar" className="size-4" /> {t('stock.pagos.borrar')}
          </Boton>
        </div>
      </header>
      {aviso && <Aviso tono="mal">{aviso}</Aviso>}
      {pendiente && <Aviso tono="info">{t('stock.pagos.solo_confirmar')}</Aviso>}
      <dl className="grid gap-x-6 gap-y-4 rounded-caja border border-linea bg-superficie p-5 shadow-suave sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        {datos.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-semibold tracking-wide text-tinta-3 uppercase">{k}</dt>
            <dd className="mt-0.5 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
