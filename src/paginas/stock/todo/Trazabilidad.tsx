import { useEffect } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { exportarGeoDatos, stock } from '@/api/stock';
import { urlDocumento } from '@/api/respuesta';
import type { ApiStockOrder, ApiStockOrderEvidenceFieldValue, ApiStockOrderEvidenceTypeValue, ApiStockOrderHistoryTimelineItem, ApiTransaction } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono, type NombreIcono } from '@/componentes/ui/Icono';
import { fechaCorta } from '@/util/fecha';
import { cantidad, fechaEntrega, nombreInstalacion } from '@/util/formato';
import { nombreCompleto } from '@/util/productor';
import { useState } from 'react';

const ruta = getRouteApi('/portal/stock/trazabilidad/$id');

export function Trazabilidad() {

  const { id } = ruta.useParams();
  const historia = useQuery(stock.historia(Number(id)));

  if (historia.isPending) return <Cargando />;
  if (historia.isError) return <EstadoError texto={historia.error?.message} reintentar={() => void historia.refetch()} />;
  const h = historia.data!;
  const raiz = h.stockOrder;

  return <Contenido id={Number(id)} raiz={raiz} salidas={h.outputTransactions ?? []} items={h.timelineItems ?? []} />;
}

function Contenido({ id, raiz, salidas, items }: { id: number; raiz: ApiStockOrder | undefined; salidas: ApiTransaction[]; items: ApiStockOrderHistoryTimelineItem[] }) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const identificador = raiz?.identifier || raiz?.internalLotNumber || `#${id}`;

  useEffect(() => {
    document.title = `${t('stock.todo.trazabilidad')} · ${identificador} · INATrace v2`;
  }, [identificador, t]);

  async function geo() {
    setError(null);
    try {
      if (!(await exportarGeoDatos(id))) setError(t('stock.todo.sin_geo'));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="grid gap-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/stock/todo" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
            <Icono nombre="volver" className="size-4" /> {t('stock.pestanas.stock')}
          </Link>
          <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{t('stock.traza.titulo')}</h1>
          <p className="mt-1 text-tinta-2">{identificador}</p>
        </div>
        <Boton variante="secundario" onClick={geo}>
          <Icono nombre="mapa" className="size-4" /> {t('stock.todo.geojson')}
        </Boton>
      </header>

      {error && <Aviso tono="mal">{error}</Aviso>}

      {raiz && <OrdenRaiz o={raiz} i18n={i18n.language} />}

      {salidas.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-titulo text-lg font-semibold">{t('stock.traza.salidas')}</h2>
          <ul className="grid gap-2">
            {salidas.map((tx) => (
              <li key={tx.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-linea bg-superficie p-3 text-sm shadow-suave">
                <Icono nombre="flecha" className="size-4 text-marca" />
                <span className="font-semibold">{cantidad(tx.outputQuantity ?? tx.inputQuantity, tx.inputMeasureUnitType?.label, i18n.language)}</span>
                {tx.targetStockOrder && (
                  <Link to="/stock/trazabilidad/$id" params={{ id: String(tx.targetStockOrder.id) }} className="text-marca hover:underline">
                    {tx.targetStockOrder.identifier || tx.targetStockOrder.internalLotNumber || `#${tx.targetStockOrder.id}`}
                  </Link>
                )}
                {tx.status && tx.status !== 'EXECUTED' && <EstadoTx estado={tx.status} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-2">
        <h2 className="font-titulo text-lg font-semibold">{t('stock.traza.origen')}</h2>
        {items.length === 0 ? (
          <p className="text-sm text-tinta-2">{t('stock.traza.sin_historia')}</p>
        ) : (
          <ol className="relative grid gap-4 border-l-2 border-linea pl-6">
            {items.map((item, i) => (
              <Paso key={item.id ?? i} item={item} i18n={i18n.language} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function OrdenRaiz({ o, i18n }: { o: ApiStockOrder; i18n: string }) {
  const { t } = useTranslation();
  const datos: [string, string | undefined][] = [
    [t('stock.semiproducto'), o.semiProduct?.name ?? o.finalProduct?.name],
    [t('stock.instalacion'), nombreInstalacion(o.facility)],
    [t('stock.traza.cantidad'), cantidad(o.totalQuantity, o.measureUnitType?.label, i18n)],
    [t('stock.todo.disponible'), cantidad(o.availableQuantity, o.measureUnitType?.label, i18n)],
    [t('stock.entrega.fecha'), fechaCorta(fechaEntrega(o), i18n)],
    [t('stock.entrega.productor'), o.producerUserCustomer ? nombreCompleto(o.producerUserCustomer) : undefined],
  ];
  return (
    <section className="rounded-caja border border-linea bg-superficie p-5 shadow-suave sm:p-6">
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {datos.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-semibold tracking-wide text-tinta-3 uppercase">{k}</dt>
            <dd className="mt-0.5 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <Evidencias campos={o.requiredEvidenceFieldValues} docs={[...(o.requiredEvidenceTypeValues ?? []), ...(o.otherEvidenceDocuments ?? [])]} pruebas={o.activityProofs} />
    </section>
  );
}

const ICONO_PASO: Record<string, NombreIcono> = { QRCODE: 'qr', SHIP: 'barco', LEAF: 'hoja', WAREHOUSE: 'bodega' };

function Paso({ item, i18n }: { item: ApiStockOrderHistoryTimelineItem; i18n: string }) {
  const { t } = useTranslation();
  const po = item.processingOrder;
  const accion = po?.processingAction;
  const compras = item.purchaseOrders ?? [];
  const icono = accion?.publicTimelineIconType ? (ICONO_PASO[accion.publicTimelineIconType] ?? 'ruta') : 'personas';

  return (
    <li className="relative">
      <span className="absolute top-1 -left-[1.95rem] grid size-7 place-items-center rounded-full bg-marca-suave text-marca ring-4 ring-superficie">
        <Icono nombre={icono} className="size-4" />
      </span>
      <div className="rounded-caja border border-linea bg-superficie p-4 shadow-suave">
        {accion ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">{accion.publicTimelineLabel || accion.name}</h3>
              {po?.processingDate && <span className="text-sm text-tinta-3">{fechaCorta(po.processingDate, i18n)}</span>}
            </div>
            {(po?.targetStockOrders ?? []).length > 0 && (
              <ul className="mt-2 grid gap-1 text-sm text-tinta-2">
                {po!.targetStockOrders!.map((o) => (
                  <li key={o.id}>
                    {cantidad(o.totalQuantity, o.measureUnitType?.label, i18n)} · {o.internalLotNumber || o.identifier || `#${o.id}`}
                    {o.facility?.name ? ` @ ${nombreInstalacion(o.facility)}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <h3 className="font-semibold">{t('stock.traza.entregas', { count: compras.length })}</h3>
        )}
        {compras.length > 0 && (
          <ul className="mt-2 grid gap-1.5 text-sm">
            {compras.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-2 text-tinta-2">
                <Icono nombre="hoja" className="size-3.5 text-marca" />
                <span className="font-medium text-tinta">{c.producerUserCustomer ? nombreCompleto(c.producerUserCustomer) : c.identifier}</span>
                <span>· {cantidad(c.totalQuantity, c.measureUnitType?.label, i18n)}</span>
                {c.productionDate && <span>· {fechaCorta(c.productionDate, i18n)}</span>}
                {(c.plots ?? []).some((p) => p.geoId) && <span className="rounded bg-ok-suave px-1.5 text-xs font-semibold text-ok">GeoID</span>}
              </li>
            ))}
          </ul>
        )}
        <Evidencias campos={undefined} docs={[...(item.requiredEvidenceDocuments ?? []), ...(item.otherEvidenceDocuments ?? [])]} />
      </div>
    </li>
  );
}

function Evidencias({
  campos,
  docs,
  pruebas,
}: {
  campos?: ApiStockOrderEvidenceFieldValue[];
  docs?: ApiStockOrderEvidenceTypeValue[];
  pruebas?: { id?: number; type?: string; document?: { storageKey?: string; name?: string } }[];
}) {
  const { t, i18n } = useTranslation();
  const valores = (campos ?? []).filter((c) => c.stringValue || c.numericValue != null || c.booleanValue != null || c.dateValue);
  const documentos = [
    ...(docs ?? []).filter((d) => d.document?.storageKey).map((d) => ({ etiqueta: d.evidenceTypeLabel, doc: d.document! })),
    ...(pruebas ?? []).filter((p) => p.document?.storageKey).map((p) => ({ etiqueta: p.type, doc: p.document! })),
  ];
  if (valores.length === 0 && documentos.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-linea pt-3 text-sm">
      {valores.map((c) => (
        <span key={c.id} className="rounded-md bg-superficie-2 px-2 py-1 text-tinta-2">
          <span className="font-semibold">{c.evidenceFieldName}:</span>{' '}
          {c.dateValue ? fechaCorta(c.dateValue, i18n.language) : c.booleanValue != null ? t(c.booleanValue ? 'comun.si' : 'comun.no') : (c.stringValue ?? c.numericValue)}
        </span>
      ))}
      {documentos.map((d, i) => (
        <a key={i} href={urlDocumento(d.doc.storageKey)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-marca-suave px-2 py-1 font-medium text-marca hover:underline">
          <Icono nombre="certificado" className="size-3.5" /> {d.doc.name || d.etiqueta || t('stock.traza.documento')}
        </a>
      ))}
    </div>
  );
}

function EstadoTx({ estado }: { estado: string }) {
  const { t } = useTranslation();
  return <span className="rounded-full bg-aviso-suave px-2 py-0.5 text-xs font-semibold text-aviso">{t(`stock.traza.tx.${estado}`, { defaultValue: estado })}</span>;
}
