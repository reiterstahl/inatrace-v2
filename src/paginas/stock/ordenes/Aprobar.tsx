import { useEffect, useState } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ordenes, useResolverTransacciones } from '@/api/ordenes';
import { stock } from '@/api/stock';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { fechaCorta } from '@/util/fecha';
import { cantidad, fechaEntrega, nombreInstalacion } from '@/util/formato';
import { CONTROL } from '../entregas/campos';

const ruta = getRouteApi('/portal/stock/ordenes/$id/aprobar');

type Decision = { aprobar: boolean; comentario: string };

/**
 * Lo que el proveedor mandó para una orden queda pendiente hasta que el comprador lo aprueba o lo
 * rechaza (rechazar exige un comentario), como en la versión actual.
 */
export function AprobarOrden() {
  const { t, i18n } = useTranslation();
  const { id } = ruta.useParams();
  const navegar = useNavigate();
  const orden = useQuery(stock.entrega(Number(id)));
  const tx = useQuery(ordenes.transacciones(Number(id)));
  const resolver = useResolverTransacciones();
  const [decisiones, setDecisiones] = useState<Record<number, Decision>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const pendientes = (tx.data ?? []).filter((x) => x.status === 'PENDING');

  useEffect(() => {
    setDecisiones(Object.fromEntries(pendientes.map((x) => [x.id!, { aprobar: true, comentario: '' }])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.data]);

  if (orden.isPending || tx.isPending) return <Cargando />;
  if (orden.isError || tx.isError) return <EstadoError reintentar={() => { void orden.refetch(); void tx.refetch(); }} />;
  const o = orden.data;
  const faltaComentario = Object.values(decisiones).some((d) => !d.aprobar && !d.comentario.trim());

  async function confirmar() {
    setAviso(null);
    if (faltaComentario) {
      setAviso(t('stock.ord.falta_comentario'));
      return;
    }
    try {
      await resolver.mutateAsync(Object.entries(decisiones).map(([k, d]) => ({ id: Number(k), aprobar: d.aprobar, comentario: d.comentario.trim() || undefined })));
      await navegar({ to: '/stock/ordenes' });
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <header>
        <Link to="/stock/ordenes" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
          <Icono nombre="volver" className="size-4" /> {t('stock.pestanas.ordenes')}
        </Link>
        <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{t('stock.ord.aprobar_titulo')}</h1>
        <p className="mt-1 text-tinta-2">
          {[o.orderId || o.internalLotNumber, o.quoteFacility?.company?.name, fechaCorta(o.deliveryTime, i18n.language)].filter(Boolean).join(' · ')}
        </p>
      </header>
      {aviso && <Aviso tono="mal">{aviso}</Aviso>}

      {pendientes.length === 0 ? (
        <div className="rounded-caja border border-dashed border-linea-fuerte p-10 text-center text-tinta-2">{t('stock.ord.sin_pendientes')}</div>
      ) : (
        <>
          <ul className="grid gap-3">
            {pendientes.map((x) => {
              const d = decisiones[x.id!] ?? { aprobar: true, comentario: '' };
              const fijar = (c: Partial<Decision>) => setDecisiones((v) => ({ ...v, [x.id!]: { ...d, ...c } }));
              const lote = x.sourceStockOrder?.internalLotNumber || x.sourceStockOrder?.identifier || `#${x.sourceStockOrder?.id}`;
              return (
                <li key={x.id} role="group" aria-label={t('stock.ord.envio', { lote })} className="grid gap-3 rounded-caja border border-linea bg-superficie p-4 shadow-suave">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold">{lote}</span>
                    <span className="text-sm text-tinta-2">{[nombreInstalacion(x.sourceFacility), fechaCorta(x.sourceStockOrder ? fechaEntrega(x.sourceStockOrder) : undefined, i18n.language)].filter(Boolean).join(' · ')}</span>
                    <span className="ml-auto font-semibold tabular-nums">{cantidad(x.inputQuantity, x.inputMeasureUnitType?.label, i18n.language)}</span>
                  </div>
                  <div className="inline-flex w-fit rounded-lg bg-superficie-2 p-1" role="radiogroup" aria-label={t('stock.ord.decision')}>
                    <button type="button" role="radio" aria-checked={d.aprobar} onClick={() => fijar({ aprobar: true, comentario: '' })} className="h-9 rounded-md px-3 text-sm font-semibold text-tinta-2 aria-checked:bg-ok-suave aria-checked:text-ok">
                      {t('stock.ord.aprobar_boton')}
                    </button>
                    <button type="button" role="radio" aria-checked={!d.aprobar} onClick={() => fijar({ aprobar: false })} className="h-9 rounded-md px-3 text-sm font-semibold text-tinta-2 aria-checked:bg-mal-suave aria-checked:text-mal">
                      {t('stock.ord.rechazar_boton')}
                    </button>
                  </div>
                  {!d.aprobar && (
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-semibold text-tinta-2">{t('stock.ord.motivo')}<span className="text-mal" aria-hidden="true"> *</span></span>
                      <textarea rows={2} value={d.comentario} onChange={(e) => fijar({ comentario: e.target.value })} className={CONTROL + ' py-2'} />
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
          <Boton className="justify-self-start" onClick={() => void confirmar()} disabled={resolver.isPending}>
            <Icono nombre="ok" className="size-4" /> {resolver.isPending ? t('comun.cargando') : t('stock.ord.confirmar_decisiones', { count: pendientes.length })}
          </Boton>
        </>
      )}
    </div>
  );
}
