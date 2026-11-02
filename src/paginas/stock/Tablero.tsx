import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { procesamiento } from '@/api/procesamiento';
import { stock } from '@/api/stock';
import { exportarEntregasTablero, exportarRendimiento, tablero, type FiltroEntregas, type Formato } from '@/api/tablero';
import type { ApiProcessingAction, ApiProcessingPerformanceRequest, ApiProcessingPerformanceRequestEvidenceField, ApiUserCustomer } from '@/api/gen/types.gen';
import { SelectorPersona } from '@/componentes/SelectorPersona';
import { Barras } from '@/componentes/graficos/Barras';
import { Boton } from '@/componentes/ui/Boton';
import { Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { nombreInstalacion } from '@/util/instalacion';
import { nombreAccion } from '@/util/accion';
import { MAX_PERIODOS, agrupacionPara, etiquetaPeriodo, rangoInicial } from '@/util/tablero';
import { Casilla, Tarjeta } from '../productos/piezas';

const FORMATOS: Formato[] = ['EXCEL', 'CSV', 'PDF'];

/**
 * Tablero de la empresa: entregas por período y rendimiento de los procesos (lo que entra, lo que
 * sale y su relación), con los mismos filtros y exportaciones que la versión actual.
 */
export function TableroStock() {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-titulo text-3xl font-semibold tracking-tight">{t('tablero.titulo')}</h1>
        <p className="mt-1 text-tinta-2">{t('tablero.descripcion', { empresa: empresa.nombre })}</p>
      </header>
      <Entregas empresa={empresa.id} />
      <Rendimiento empresa={empresa.id} />
    </div>
  );
}

function useFormatos() {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const n = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 });
    return { numero: (v: number) => n.format(v), idioma: i18n.language };
  }, [i18n.language]);
}

function Exportar({ alExportar }: { alExportar: (f: Formato) => Promise<unknown> }) {
  const { t } = useTranslation();
  const [ocupado, setOcupado] = useState<Formato | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function exportar(f: Formato) {
    setOcupado(f);
    setError(null);
    try {
      await alExportar(f);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }
  return (
    <div className="grid justify-items-end gap-1">
      <div className="flex flex-wrap gap-1" role="group" aria-label={t('tablero.exportar')}>
        {FORMATOS.map((f) => (
          <Boton key={f} chico variante="secundario" disabled={ocupado !== null} onClick={() => void exportar(f)} aria-label={t('tablero.exportar_en', { formato: t(`tablero.formatos.${f}`) })}>
            <Icono nombre="descarga" className="size-4" /> {ocupado === f ? t('comun.cargando') : t(`tablero.formatos.${f}`)}
          </Boton>
        ))}
      </div>
      {error && <p className="text-sm text-mal" role="alert">{error}</p>}
    </div>
  );
}

function Fechas({ desde, hasta, alCambiar }: { desde: string; hasta: string; alCambiar: (c: { desde?: string; hasta?: string }) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Campo etiqueta={t('tablero.desde')} type="date" value={desde} max={hasta} onChange={(e) => e.target.value && alCambiar({ desde: e.target.value })} />
      <Campo etiqueta={t('tablero.hasta')} type="date" value={hasta} min={desde} onChange={(e) => e.target.value && alCambiar({ hasta: e.target.value })} />
    </>
  );
}

function Entregas({ empresa }: { empresa: number }) {
  const { t } = useTranslation();
  const { numero, idioma } = useFormatos();
  const acopio = useQuery(stock.instalacionesAcopio(empresa));
  const [rango, setRango] = useState(rangoInicial);
  const [instalacion, setInstalacion] = useState<number | ''>('');
  const [semiElegido, setSemi] = useState<number | '' | null>(null);
  const [productor, setProductor] = useState<ApiUserCustomer | null>(null);
  const [recolector, setRecolector] = useState<ApiUserCustomer | null>(null);
  const [opciones, setOpciones] = useState({ organico: false, mujeres: false, despues: false });
  const lugares = acopio.data ?? [];
  const elegidas = instalacion ? lugares.filter((l) => l.id === instalacion) : lugares;
  const semis = [...new Map(elegidas.flatMap((l) => l.facilitySemiProductList ?? []).map((s) => [s.id, s])).values()];
  // Como la versión actual: arranca con el primer semiproducto (las cantidades se suman en kg).
  const semi = semiElegido === null ? (semis[0]?.id ?? '') : semiElegido;
  const agrupacion = agrupacionPara(rango.desde, rango.hasta);
  const filtro: FiltroEntregas = {
    companyId: empresa,
    facilityIds: elegidas.map((l) => l.id!),
    semiProductId: semi || undefined,
    farmerId: productor?.id,
    collectorId: recolector?.id,
    organicOnly: opciones.organico || undefined,
    isWomenShare: opciones.mujeres || undefined,
    priceDeterminedLater: opciones.despues || undefined,
    productionDateStart: rango.desde,
    productionDateEnd: rango.hasta,
    aggregationType: agrupacion,
  };
  const datos = useQuery({ ...tablero.entregas(filtro), enabled: lugares.length > 0 });
  const totales = datos.data?.totals ?? [];
  const periodos = totales.map((x) => etiquetaPeriodo(x.unit, x.year, agrupacion, idioma, t('tablero.semana')));

  return (
    <Tarjeta id="tablero-entregas" titulo={t('tablero.entregas')} ayuda={t('tablero.entregas_ayuda')} acciones={lugares.length > 0 && <Exportar alExportar={(f) => exportarEntregasTablero(filtro, f)} />}>
      {acopio.isPending ? (
        <Cargando />
      ) : acopio.isError ? (
        <EstadoError texto={acopio.error.message} reintentar={() => void acopio.refetch()} />
      ) : lugares.length === 0 ? (
        <p className="text-sm text-tinta-3">{t('tablero.sin_acopio')}</p>
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
            <Fechas desde={rango.desde} hasta={rango.hasta} alCambiar={(c) => setRango((r) => ({ ...r, ...c }))} />
            <Selector etiqueta={t('tablero.instalacion')} value={instalacion} onChange={(e) => { setInstalacion(e.target.value ? Number(e.target.value) : ''); setSemi(null); }}>
              <option value="">{t('tablero.todas_acopio')}</option>
              {lugares.map((l) => <option key={l.id} value={l.id}>{nombreInstalacion(l)}</option>)}
            </Selector>
            <Selector etiqueta={t('tablero.semiproducto')} value={semi} onChange={(e) => setSemi(e.target.value ? Number(e.target.value) : '')}>
              <option value="">{t('tablero.todos')}</option>
              {semis.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Selector>
            <div className="sm:col-span-2"><SelectorPersona empresa={empresa} valor={productor} alElegir={setProductor} etiqueta={t('tablero.productor')} /></div>
            <div className="sm:col-span-2"><SelectorPersona empresa={empresa} tipo="COLLECTOR" valor={recolector} alElegir={setRecolector} etiqueta={t('tablero.recolector')} /></div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Casilla marcada={opciones.organico} alCambiar={(organico) => setOpciones((o) => ({ ...o, organico }))}>{t('tablero.solo_organico')}</Casilla>
            <Casilla marcada={opciones.mujeres} alCambiar={(mujeres) => setOpciones((o) => ({ ...o, mujeres }))}>{t('tablero.solo_mujeres')}</Casilla>
            <Casilla marcada={opciones.despues} alCambiar={(despues) => setOpciones((o) => ({ ...o, despues }))}>{t('tablero.precio_despues')}</Casilla>
          </div>
          {datos.isPending ? (
            <Cargando />
          ) : datos.isError ? (
            <EstadoError texto={datos.error.message} reintentar={() => void datos.refetch()} />
          ) : (
            <>
              <p className="text-sm text-tinta-2">{t('tablero.total_kg', { total: numero(totales.reduce((s, x) => s + (x.totalQuantity ?? 0), 0)) })} · {t(`tablero.agrupado.${agrupacion}`)}</p>
              <Barras
                titulo={t('tablero.entregas_grafico')}
                periodos={periodos.slice(0, MAX_PERIODOS)}
                series={[{ nombre: t('tablero.cantidad_kg'), color: 'var(--serie-1)', valores: totales.slice(0, MAX_PERIODOS).map((x) => x.totalQuantity ?? null) }]}
                formato={numero}
              />
              {totales.length > MAX_PERIODOS && <p className="text-sm text-tinta-3">{t('tablero.recortado', { n: MAX_PERIODOS, total: totales.length })}</p>}
            </>
          )}
        </div>
      )}
    </Tarjeta>
  );
}

/** Valor de un campo de evidencia para el filtro, según su tipo (como la versión actual). */
function filtroCampo(c: { fieldName?: string; type?: string }, valor: string): ApiProcessingPerformanceRequestEvidenceField {
  const campo = { fieldName: c.fieldName };
  if (c.type === 'DATE' || c.type === 'TIMESTAMP' || c.fieldName === 'WASHING_DATE') return { evidenceField: campo, instantValue: new Date(valor).toISOString() };
  if (['NUMBER', 'INTEGER', 'PRICE', 'EXCHANGE_RATE'].includes(c.type ?? '') || c.fieldName === 'SIZE') return { evidenceField: campo, numericValue: Number(valor.replace(',', '.')) };
  return { evidenceField: campo, stringValue: valor };
}

function Rendimiento({ empresa }: { empresa: number }) {
  const { t } = useTranslation();
  const { numero, idioma } = useFormatos();
  const accionesQ = useQuery(procesamiento.acciones(empresa));
  const lugaresQ = useQuery(stock.instalaciones(empresa));
  const acciones = (accionesQ.data ?? []).filter((a) => a.type === 'PROCESSING' || a.type === 'FINAL_PROCESSING');
  const [rango, setRango] = useState(rangoInicial);
  const [instalacion, setInstalacion] = useState<number | ''>('');
  const [accionElegida, setAccion] = useState<number | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const accion: ApiProcessingAction | undefined = acciones.find((a) => a.id === accionElegida) ?? acciones[0];
  const agrupacion = agrupacionPara(rango.desde, rango.hasta);
  const pedido: ApiProcessingPerformanceRequest = {
    companyId: empresa,
    facilityId: instalacion || undefined,
    processActionId: accion?.id,
    dateStart: rango.desde,
    dateEnd: rango.hasta,
    aggregationType: agrupacion,
    evidenceFields: (accion?.requiredEvidenceFields ?? []).filter((c) => campos[c.fieldName ?? '']?.trim()).map((c) => filtroCampo(c, campos[c.fieldName!]!.trim())),
  };
  const datos = useQuery(tablero.rendimiento(pedido));
  const totales = datos.data?.totals ?? [];
  const unidad = datos.data?.measureUnitType?.label ?? '';
  const periodos = totales.map((x) => etiquetaPeriodo(x.unit, x.year, agrupacion, idioma, t('tablero.semana'))).slice(0, MAX_PERIODOS);
  const recorte = totales.slice(0, MAX_PERIODOS);

  return (
    <Tarjeta id="tablero-rendimiento" titulo={t('tablero.rendimiento')} ayuda={t('tablero.rendimiento_ayuda')} acciones={accion && <Exportar alExportar={(f) => exportarRendimiento(pedido, f)} />}>
      {accionesQ.isPending ? (
        <Cargando />
      ) : accionesQ.isError ? (
        <EstadoError texto={accionesQ.error.message} reintentar={() => void accionesQ.refetch()} />
      ) : !accion ? (
        <p className="text-sm text-tinta-3">{t('tablero.sin_procesos')}</p>
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
            <Selector etiqueta={t('tablero.proceso')} value={accion.id} onChange={(e) => { setAccion(Number(e.target.value)); setCampos({}); }}>
              {acciones.map((a) => <option key={a.id} value={a.id}>{nombreAccion(a)}</option>)}
            </Selector>
            <Selector etiqueta={t('tablero.instalacion')} value={instalacion} onChange={(e) => setInstalacion(e.target.value ? Number(e.target.value) : '')}>
              <option value="">{t('tablero.todas')}</option>
              {(lugaresQ.data ?? []).map((l) => <option key={l.id} value={l.id}>{nombreInstalacion(l)}</option>)}
            </Selector>
            <Fechas desde={rango.desde} hasta={rango.hasta} alCambiar={(c) => setRango((r) => ({ ...r, ...c }))} />
            {(accion.requiredEvidenceFields ?? []).map((c) => (
              <Campo
                key={c.fieldName}
                etiqueta={c.label || c.fieldName}
                type={c.type === 'DATE' || c.type === 'TIMESTAMP' || c.fieldName === 'WASHING_DATE' ? 'date' : 'text'}
                inputMode={['NUMBER', 'INTEGER', 'PRICE', 'EXCHANGE_RATE'].includes(c.type ?? '') ? 'decimal' : undefined}
                value={campos[c.fieldName ?? ''] ?? ''}
                onChange={(e) => setCampos((x) => ({ ...x, [c.fieldName ?? '']: e.target.value }))}
              />
            ))}
          </div>
          {datos.isPending ? (
            <Cargando />
          ) : datos.isError ? (
            <EstadoError texto={datos.error.message} reintentar={() => void datos.refetch()} />
          ) : totales.length === 0 ? (
            <p className="text-sm text-tinta-3">{t('tablero.sin_datos')}</p>
          ) : (
            <>
              <p className="text-sm text-tinta-2">{t(`tablero.agrupado.${agrupacion}`)}</p>
              <Barras
                titulo={t('tablero.cantidades_grafico', { unidad })}
                periodos={periodos}
                series={[
                  { nombre: t('tablero.entrada', { unidad }), color: 'var(--serie-1)', valores: recorte.map((x) => x.inputQuantity ?? null) },
                  { nombre: t('tablero.salida', { unidad }), color: 'var(--serie-2)', valores: recorte.map((x) => x.outputQuantity ?? null) },
                ]}
                formato={numero}
              />
              {/* El rendimiento es un porcentaje: va en su propio gráfico, nunca en un segundo eje. */}
              <h3 className="font-titulo text-lg font-semibold">{t('tablero.relacion')}</h3>
              <Barras
                titulo={t('tablero.relacion')}
                periodos={periodos}
                series={[{ nombre: t('tablero.relacion_serie'), color: 'var(--serie-1)', valores: recorte.map((x) => x.ratio ?? null) }]}
                formato={(v) => `${numero(v)} %`}
              />
              {totales.length > MAX_PERIODOS && <p className="text-sm text-tinta-3">{t('tablero.recortado', { n: MAX_PERIODOS, total: totales.length })}</p>}
            </>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
