import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createBulkPayment,
  createOrUpdatePayment,
  deletePayment,
  exportBulkPaymentsByCompany,
  exportPaymentsByCompany,
  getBulkPayment,
  getPayment,
  listBulkPaymentsByCompany,
  listPaymentsByCompany,
  listPaymentsByPurchase,
} from './gen/sdk.gen';
import type { ApiBulkPayment, ApiPayment } from './gen/types.gen';
import { desenvolver, descargarBlob } from './respuesta';

export const POR_PAGINA_PAGOS = 20;

export type FiltroPagos = {
  texto?: string;
  forma?: ApiPayment['preferredWayOfPayment'];
  estado?: ApiPayment['paymentStatus'];
  desde?: string;
  hasta?: string;
  productor?: number;
  pagina: number;
  /** El backend solo ordena por fecha de la entrega o por orden de creación. */
  orden: { campo: 'productionDate' | 'id'; sentido: 'ASC' | 'DESC' };
};

export const pagos = {
  lista: (empresa: number, f: FiltroPagos) =>
    queryOptions({
      queryKey: ['pagos', empresa, f],
      queryFn: () =>
        desenvolver(
          listPaymentsByCompany({
            path: { id: empresa },
            query: {
              query: f.texto?.trim() || undefined,
              preferredWayOfPayment: f.forma,
              paymentStatus: f.estado,
              productionDateStart: f.desde,
              productionDateEnd: f.hasta,
              farmerId: f.productor,
              sortBy: f.orden.campo,
              sort: f.orden.sentido,
              limit: POR_PAGINA_PAGOS,
              offset: (f.pagina - 1) * POR_PAGINA_PAGOS,
            },
          }),
        ),
      placeholderData: keepPreviousData,
    }),

  masivos: (empresa: number, pagina: number) =>
    queryOptions({
      queryKey: ['pagos', 'masivos', empresa, pagina],
      queryFn: () => desenvolver(listBulkPaymentsByCompany({ path: { id: empresa }, query: { sortBy: 'id', sort: 'DESC', limit: POR_PAGINA_PAGOS, offset: (pagina - 1) * POR_PAGINA_PAGOS } })),
      placeholderData: keepPreviousData,
    }),

  pago: (id: number) =>
    queryOptions({
      queryKey: ['pago', id],
      queryFn: () => desenvolver(getPayment({ path: { id } })),
    }),

  masivo: (id: number) =>
    queryOptions({
      queryKey: ['pago-masivo', id],
      queryFn: () => desenvolver(getBulkPayment({ path: { id } })),
    }),

  /** Pagos de una entrega (para mostrarlos en su ficha). */
  deEntrega: (entrega: number) =>
    queryOptions({
      queryKey: ['pagos', 'entrega', entrega],
      queryFn: async () => (await desenvolver(listPaymentsByPurchase({ path: { id: entrega }, query: { limit: 100 } }))).items ?? [],
    }),
};

/** Lo que cambia al pagar: listas de pagos, saldos de entregas y su stock. */
function invalidar(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['pagos'] });
  void qc.invalidateQueries({ queryKey: ['pago'] });
  void qc.invalidateQueries({ queryKey: ['entregas'] });
  void qc.invalidateQueries({ queryKey: ['entrega'] });
  void qc.invalidateQueries({ queryKey: ['stock'] });
}

export function useGuardarPago() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: ApiPayment) => desenvolver(createOrUpdatePayment({ body: p })), onSuccess: () => invalidar(qc) });
}

/** El backend solo permite cambiar un pago existente de "sin confirmar" a "confirmado". */
export function useConfirmarPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: ApiPayment) => desenvolver(createOrUpdatePayment({ body: { ...p, paymentStatus: 'CONFIRMED' } })),
    onSuccess: () => invalidar(qc),
  });
}

export function useBorrarPago() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => desenvolver(deletePayment({ path: { id } })), onSuccess: () => invalidar(qc) });
}

export function useCrearPagoMasivo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: ApiBulkPayment) => desenvolver(createBulkPayment({ body: p })), onSuccess: () => invalidar(qc) });
}

export const exportarPagos = (empresa: number) => descargarBlob(exportPaymentsByCompany({ path: { id: empresa }, parseAs: 'blob' }), 'pagos.xlsx');
export const exportarPagosMasivos = (empresa: number) => descargarBlob(exportBulkPaymentsByCompany({ path: { id: empresa }, parseAs: 'blob' }), 'pagos-masivos.xlsx');
