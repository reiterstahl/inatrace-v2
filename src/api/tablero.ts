import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { calculateProcessingPerformanceData, exportDeliveriesData, exportProcessingPerformanceData, getDeliveriesAggregatedData } from './gen/sdk.gen';
import type { ApiProcessingPerformanceRequest, GetDeliveriesAggregatedDataData } from './gen/types.gen';
import { descargarBlob, desenvolver } from './respuesta';

export type FiltroEntregas = NonNullable<GetDeliveriesAggregatedDataData['query']>;
export type Formato = 'EXCEL' | 'CSV' | 'PDF';
const EXTENSION: Record<Formato, string> = { EXCEL: 'xlsx', CSV: 'csv', PDF: 'pdf' };

export const tablero = {
  /** Entregas agregadas por período (cantidad en kg, como la versión actual). */
  entregas: (f: FiltroEntregas) =>
    queryOptions({
      queryKey: ['tablero', 'entregas', f],
      queryFn: () => desenvolver(getDeliveriesAggregatedData({ query: f })),
      placeholderData: keepPreviousData,
    }),

  /** Entrada, salida y rendimiento de un proceso por período. */
  rendimiento: (r: ApiProcessingPerformanceRequest) =>
    queryOptions({
      queryKey: ['tablero', 'rendimiento', r],
      queryFn: () => desenvolver(calculateProcessingPerformanceData({ body: r })),
      enabled: !!r.processActionId,
      placeholderData: keepPreviousData,
    }),
};

export const exportarEntregasTablero = (f: FiltroEntregas, formato: Formato) =>
  descargarBlob(exportDeliveriesData({ query: { ...f, exportType: formato }, parseAs: 'blob' }), `entregas.${EXTENSION[formato]}`);

export const exportarRendimiento = (r: ApiProcessingPerformanceRequest, formato: Formato) =>
  descargarBlob(exportProcessingPerformanceData({ body: { ...r, exportType: formato }, parseAs: 'blob' }), `procesamiento.${EXTENSION[formato]}`);
