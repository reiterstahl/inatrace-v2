import { useEffect, useId, useState } from 'react';
import { Link, getRouteApi, useBlocker, useNavigate } from '@tanstack/react-router';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { pagos, useCrearPagoMasivo } from '@/api/pagos';
import { productores, subirDocumento } from '@/api/productores';
import { stock } from '@/api/stock';
import { urlDocumento } from '@/api/respuesta';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { fechaCorta } from '@/util/fecha';
import { dinero, fechaEntrega } from '@/util/formato';
import { nombreCompleto } from '@/util/productor';
import {
  PROPOSITOS,
  TIPOS_DOCUMENTO_MASIVO,
  armarPagoMasivo,
  destinatario,
  monedaMasivo,
  pagoMasivoNuevo,
  sinErroresMasivo,
  tieneCuenta,
  totalMasivo,
  validarPagoMasivo,
  type ErroresMasivo,
  type FormPagoMasivo,
} from '@/util/pago';
import { aDecimal } from '../entregas/esquema';
import { CONTROL } from '../entregas/campos';
import { MensajeError, NumeroConUnidad } from '../procesamiento/piezas';
import { EstadoPagoChip } from './Lista';

const rutaNuevo = getRouteApi('/portal/stock/pagos/masivo/nuevo');
const rutaVer = getRouteApi('/portal/stock/pagos/masivo/$id');

export function PagoMasivoNuevo() {
  const { t } = useTranslation();
  const { entregas } = rutaNuevo.useSearch();
  const empresa = useEmpresaActual();
  const ids = (entregas ?? '').split(',').map(Number).filter((x) => x > 0);
  const consultas = useQueries({ queries: ids.map((id) => stock.entrega(id)) });
  const perfil = useQuery({ ...productores.perfilEmpresa(empresa?.id ?? 0), enabled: !!empresa });
  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  if (ids.length === 0) return <EstadoError texto={t('stock.pagos.falta_entrega')} />;
  if (consultas.some((c) => c.isPending) || perfil.isPending) return <Cargando />;
  const fallo = consultas.find((c) => c.isError);
  if (fallo) return <EstadoError texto={fallo.error?.message} reintentar={() => consultas.forEach((c) => void c.refetch())} />;
  return <Formulario empresa={empresa.id} monedaEmpresa={perfil.data?.currency?.code} entregas={consultas.map((c) => c.data!)} />;
}

function Formulario({ empresa, monedaEmpresa, entregas }: { empresa: number; monedaEmpresa?: string; entregas: Parameters<typeof pagoMasivoNuevo>[0] }) {
  const { t, i18n } = useTranslation();
  const navegar = useNavigate();
  const crear = useCrearPagoMasivo();
  const [f, setF] = useState<FormPagoMasivo>(() => pagoMasivoNuevo(entregas));
  const [tocado, setTocado] = useState(false);
  const [errores, setErrores] = useState<ErroresMasivo | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const cambiar = (c: Partial<FormPagoMasivo>) => {
    setF((x) => ({ ...x, ...c }));
    setTocado(true);
  };
  const moneda = monedaMasivo(f, monedaEmpresa);
  const fuera = entregas.length - f.filas.length; // con precio a definir: no se pagan
  const err = (k: 'fecha' | 'proposito' | 'descripcion' | 'recibo' | 'costoAdicional' | 'descripcionCosto') => (errores?.[k] ? t(`stock.errores.${errores[k]}`) : undefined);
  const ids = { fecha: useId(), proposito: useId(), descripcion: useId(), recibo: useId(), costoDesc: useId() };

  useBlocker({ shouldBlockFn: () => tocado && !crear.isPending && !window.confirm(t('stock.entrega.salir_sin_guardar')), enableBeforeUnload: () => tocado });
  useEffect(() => {
    document.title = `${t('stock.pagos.masivo_nuevo')} · INATrace v2`;
  }, [t]);

  async function subir(archivo?: File) {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const documento = await subirDocumento(archivo);
      cambiar({ documentos: [...f.documentos, { tipo: 'PAYMENT_PROOF', fecha: f.fecha, documento }] });
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setSubiendo(false);
    }
  }

  async function alGuardar() {
    setAviso(null);
    const e = validarPagoMasivo(f);
    setErrores(e);
    if (!sinErroresMasivo(e)) {
      setAviso(t('stock.entrega.revisar'));
      return;
    }
    try {
      await crear.mutateAsync(armarPagoMasivo(f, empresa, moneda));
      setTocado(false);
      await navegar({ to: '/stock/pagos', search: { vista: 'masivos' } });
    } catch (x) {
      setAviso((x as Error).message);
    }
  }

  const sinCuenta = f.filas.filter((x) => !tieneCuenta(destinatario(x.entrega).persona));

  return (
    <div className="grid gap-6 pb-24 [&>*]:min-w-0">
      <header>
        <Link to="/stock/entregas" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
          <Icono nombre="volver" className="size-4" /> {t('stock.entregas.titulo')}
        </Link>
        <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{t('stock.pagos.masivo_nuevo')}</h1>
        <p className="mt-1 max-w-2xl text-tinta-2">{t('stock.pagos.masivo_descripcion')}</p>
      </header>

      {aviso && <Aviso tono="mal">{aviso}</Aviso>}
      {errores && errores.generales.length > 0 && (
        <Aviso tono="mal">
          <ul className="list-disc pl-5">{errores.generales.map((g) => <li key={g}>{t(`stock.pagos.errores.${g}`)}</li>)}</ul>
        </Aviso>
      )}
      {fuera > 0 && <Aviso tono="info">{t('stock.pagos.fuera_precio', { count: fuera })}</Aviso>}
      {sinCuenta.length > 0 && (
        <Aviso tono="aviso" titulo={t('stock.pagos.sin_cuenta_titulo', { count: sinCuenta.length })}>
          {t('stock.pagos.sin_cuenta_texto')}
        </Aviso>
      )}

      <section className="grid gap-5 rounded-caja border border-linea bg-superficie p-5 shadow-suave sm:grid-cols-2 sm:p-6">
        <div className="grid content-start gap-1.5">
          <label htmlFor={ids.fecha} className="text-sm font-semibold text-tinta-2">{t('stock.pagos.fecha')}<span className="text-mal" aria-hidden="true"> *</span></label>
          <input id={ids.fecha} type="date" value={f.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} className={CONTROL + ' h-11'} />
          <MensajeError>{err('fecha')}</MensajeError>
        </div>
        <div className="grid content-start gap-1.5">
          <label htmlFor={ids.proposito} className="text-sm font-semibold text-tinta-2">{t('stock.pagos.proposito')}<span className="text-mal" aria-hidden="true"> *</span></label>
          <select id={ids.proposito} value={f.proposito} onChange={(e) => cambiar({ proposito: e.target.value as FormPagoMasivo['proposito'] })} className={CONTROL + ' h-11'}>
            {PROPOSITOS.map((p) => <option key={p} value={p}>{t(`stock.pagos.propositos.${p}`)}</option>)}
          </select>
          <MensajeError>{err('proposito')}</MensajeError>
        </div>
        <div className="grid content-start gap-1.5">
          <label htmlFor={ids.descripcion} className="text-sm font-semibold text-tinta-2">{t('stock.pagos.descripcion_masivo')}<span className="text-mal" aria-hidden="true"> *</span></label>
          <input id={ids.descripcion} value={f.descripcion} aria-invalid={!!err('descripcion')} onChange={(e) => cambiar({ descripcion: e.target.value })} className={CONTROL + ' h-11'} />
          <MensajeError>{err('descripcion')}</MensajeError>
        </div>
        <div className="grid content-start gap-1.5">
          <label htmlFor={ids.recibo} className="text-sm font-semibold text-tinta-2">{t('stock.pagos.recibo')}<span className="text-mal" aria-hidden="true"> *</span></label>
          <input id={ids.recibo} value={f.recibo} aria-invalid={!!err('recibo')} onChange={(e) => cambiar({ recibo: e.target.value })} className={CONTROL + ' h-11'} />
          <MensajeError>{err('recibo')}</MensajeError>
        </div>
        <NumeroConUnidad etiqueta={t('stock.pagos.costo_adicional')} valor={f.costoAdicional} alCambiar={(costoAdicional) => cambiar({ costoAdicional })} unidad={moneda || undefined} error={err('costoAdicional')} />
        <div className="grid content-start gap-1.5">
          <label htmlFor={ids.costoDesc} className="text-sm font-semibold text-tinta-2">
            {t('stock.pagos.costo_descripcion')}
            {f.costoAdicional !== null && <span className="text-mal" aria-hidden="true"> *</span>}
          </label>
          <input id={ids.costoDesc} value={f.descripcionCosto} disabled={f.costoAdicional === null} aria-invalid={!!err('descripcionCosto')} onChange={(e) => cambiar({ descripcionCosto: e.target.value })} className={CONTROL + ' h-11'} />
          <MensajeError>{err('descripcionCosto')}</MensajeError>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <span className="text-sm font-semibold text-tinta-2">{t('stock.pagos.documentos')}</span>
          <ul className="grid gap-2">
            {f.documentos.map((d, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-superficie-2 px-3 py-2 text-sm">
                <select
                  aria-label={t('stock.proc.tipo_documento')}
                  value={d.tipo}
                  onChange={(e) => cambiar({ documentos: f.documentos.map((x, j) => (j === i ? { ...x, tipo: e.target.value as typeof d.tipo } : x)) })}
                  className={CONTROL + ' h-9 w-auto'}
                >
                  {TIPOS_DOCUMENTO_MASIVO.map((x) => <option key={x} value={x}>{t(`stock.pagos.tipos_documento.${x}`)}</option>)}
                </select>
                <input
                  type="date"
                  aria-label={t('stock.proc.fecha_documento')}
                  value={d.fecha}
                  onChange={(e) => cambiar({ documentos: f.documentos.map((x, j) => (j === i ? { ...x, fecha: e.target.value } : x)) })}
                  className={CONTROL + ' h-9 w-40'}
                />
                <a href={urlDocumento(d.documento.storageKey)} target="_blank" rel="noreferrer" className="min-w-0 truncate text-marca hover:underline">{d.documento.name}</a>
                <button type="button" onClick={() => cambiar({ documentos: f.documentos.filter((_, j) => j !== i) })} className="ml-auto rounded p-0.5 text-tinta-3 hover:text-mal" aria-label={t('stock.proc.quitar_documento')}>
                  <Icono nombre="cerrar" className="size-3.5" />
                </button>
              </li>
            ))}
            <li>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-linea-fuerte px-3 text-sm font-semibold text-tinta-2 hover:border-marca hover:text-marca">
                <Icono nombre="subir" className="size-4" /> {subiendo ? t('comun.cargando') : t('stock.proc.subir_archivo')}
                <input type="file" className="sr-only" aria-label={t('stock.pagos.documentos')} onChange={(e) => void subir(e.target.files?.[0])} />
              </label>
            </li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="t-filas" className="grid gap-3 [&>*]:min-w-0">
        <h2 id="t-filas" className="font-titulo text-xl font-semibold">{t('stock.pagos.entregas_a_pagar', { count: f.filas.length })}</h2>
        <div className="relative overflow-x-auto rounded-caja border border-linea bg-superficie shadow-suave">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-linea bg-superficie-2 text-tinta-2">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{t('stock.pagos.col_entrega')}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t('stock.pagos.destinatario')}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t('stock.pagos.cuenta')}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{t('stock.pagos.saldo')}</th>
                <th scope="col" className="w-44 px-4 py-3 text-right font-semibold">{t('stock.pagos.monto')}</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">{t('productores.columnas.acciones')}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {f.filas.map((x) => {
                const { persona, esAcopiador } = destinatario(x.entrega);
                const cuenta = persona?.bank?.accountNumber?.trim();
                const error = errores?.filas[x.entrega.id!];
                return (
                  <tr key={x.entrega.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{x.entrega.identifier || `#${x.entrega.id}`}</span>
                      <span className="block text-xs text-tinta-3">{fechaCorta(fechaEntrega(x.entrega), i18n.language)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {persona ? nombreCompleto(persona) : '—'}
                      {esAcopiador && <span className="block text-xs text-tinta-3">{t('stock.pagos.acopiador_de', { productor: x.entrega.producerUserCustomer ? nombreCompleto(x.entrega.producerUserCustomer) : '' })}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {cuenta ? (
                        <span className="font-mono text-xs">{[persona?.bank?.bankName, cuenta].filter(Boolean).join(' · ')}</span>
                      ) : (
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-mal-suave px-2 py-0.5 text-xs font-semibold text-mal">{t('stock.pagos.sin_cuenta')}</span>
                          {persona?.id && <Link to="/productores/$id" params={{ id: String(persona.id) }} hash="banco" className="text-xs font-semibold text-marca hover:underline">{t('stock.pagos.cargar_cuenta')}</Link>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{dinero(x.entrega.balance ?? 0, x.entrega.currency, i18n.language)}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        inputMode="decimal"
                        aria-label={t('stock.pagos.monto_de', { ref: x.entrega.identifier || x.entrega.id })}
                        aria-invalid={!!error}
                        defaultValue={x.monto === null ? '' : String(x.monto).replace('.', ',')}
                        onChange={(e) => cambiar({ filas: f.filas.map((y) => (y.entrega.id === x.entrega.id ? { ...y, monto: aDecimal(e.target.value) } : y)) })}
                        className={CONTROL + ' h-9 w-32 text-right tabular-nums'}
                      />
                      {error && <span className="block text-xs text-mal">{t(`stock.errores.${error}`)}</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => cambiar({ filas: f.filas.filter((y) => y.entrega.id !== x.entrega.id) })} className="rounded-md p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('stock.pagos.quitar_entrega', { ref: x.entrega.identifier || x.entrega.id })}>
                        <Icono nombre="cerrar" className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-linea bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <span className="mr-auto text-sm text-tinta-2" aria-live="polite">
            {t('stock.pagos.total_transferir')}: <strong className="text-tinta tabular-nums">{dinero(totalMasivo(f), moneda, i18n.language)}</strong>
          </span>
          <Boton onClick={() => void alGuardar()} disabled={crear.isPending || sinCuenta.length > 0 || f.filas.length === 0}>
            <Icono nombre="ok" className="size-4" /> {crear.isPending ? t('comun.cargando') : t('stock.pagos.registrar_masivo', { count: f.filas.length })}
          </Boton>
        </div>
      </div>
    </div>
  );
}

// ---------- Ver un pago masivo (no se edita: el backend no lo permite) ----------

export function PagoMasivoVer() {
  const { t, i18n } = useTranslation();
  const { id } = rutaVer.useParams();
  const m = useQuery(pagos.masivo(Number(id)));
  if (m.isPending) return <Cargando />;
  if (m.isError) return <EstadoError texto={m.error.message} reintentar={() => void m.refetch()} />;
  const b = m.data;
  const datos: [string, string][] = [
    [t('stock.pagos.fecha'), fechaCorta(b.formalCreationTime, i18n.language)],
    [t('stock.pagos.recibo'), b.receiptNumber || '—'],
    [t('stock.pagos.proposito'), b.paymentPurposeType ? t(`stock.pagos.propositos.${b.paymentPurposeType}`) : '—'],
    [t('stock.pagos.descripcion_masivo'), b.paymentDescription || '—'],
    ...(b.additionalCost ? [[t('stock.pagos.costo_adicional'), `${dinero(b.additionalCost, b.currency, i18n.language)} · ${b.additionalCostDescription ?? ''}`] as [string, string]] : []),
    [t('stock.pagos.creado_por'), b.createdBy ? nombreCompleto(b.createdBy) : '—'],
  ];
  return (
    <div className="grid gap-6">
      <header>
        <Link to="/stock/pagos" search={{ vista: 'masivos' }} className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
          <Icono nombre="volver" className="size-4" /> {t('stock.pagos.vista_masivos')}
        </Link>
        <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{t('stock.pagos.masivo_titulo', { monto: dinero(b.totalAmount, b.currency, i18n.language) })}</h1>
      </header>
      <dl className="grid gap-x-6 gap-y-4 rounded-caja border border-linea bg-superficie p-5 shadow-suave sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        {datos.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-semibold tracking-wide text-tinta-3 uppercase">{k}</dt>
            <dd className="mt-0.5 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {(b.additionalProofs ?? []).length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {b.additionalProofs!.filter((d) => d.document).map((d, i) => (
            <li key={i}><a href={urlDocumento(d.document!.storageKey)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-marca-suave px-2 py-1 text-sm font-medium text-marca hover:underline"><Icono nombre="certificado" className="size-3.5" /> {d.document!.name}</a></li>
          ))}
        </ul>
      )}
      <ul className="grid gap-2">
        {(b.payments ?? []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-linea bg-superficie px-4 py-3 text-sm shadow-suave">
            <Link to="/stock/pagos/$id" params={{ id: String(p.id) }} className="font-semibold hover:text-marca hover:underline">{p.recipientUserCustomer ? nombreCompleto(p.recipientUserCustomer) : `#${p.id}`}</Link>
            <span className="text-tinta-2">{p.stockOrder?.identifier}</span>
            <span className="ml-auto font-semibold tabular-nums">{dinero(p.amount, p.currency, i18n.language)}</span>
            <EstadoPagoChip estado={p.paymentStatus} />
          </li>
        ))}
      </ul>
    </div>
  );
}
