import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  approveTransaction,
  createProductOrder,
  getCompanyCustomersList,
  getQuoteOrdersInFacility,
  getStockOrderInputTransactions,
  getStockOrdersInFacilityForCustomer,
  listAvailableSellingFacilitiesForCompany,
  listProcessingActionsByCompany,
  rejectTransaction,
} from './gen/sdk.gen';
import type { ApiProductOrder } from './gen/types.gen';
import { desenvolver } from './respuesta';

export const POR_PAGINA_ORDENES = 20;

export type FiltroOrdenes = {
  instalacion?: number;
  semiproducto?: number;
  cliente?: number;
  soloAbiertas?: boolean;
  pagina: number;
};

/**
 * Órdenes entre empresas de la cadena:
 *  - recibidas: pedidos que otras empresas le hicieron a esta (la empresa es el proveedor);
 *  - emitidas: las órdenes que esta empresa creó (pedidos a proveedores y pedidos de clientes).
 */
export const ordenes = {
  recibidas: (empresa: number, f: FiltroOrdenes) =>
    queryOptions({
      queryKey: ['ordenes', 'recibidas', empresa, f],
      queryFn: () =>
        desenvolver(
          getQuoteOrdersInFacility({
            path: { companyId: empresa },
            query: { facilityId: f.instalacion, semiProductId: f.semiproducto, openOnly: f.soloAbiertas || undefined, sortBy: 'updateTimestamp', sort: 'DESC', limit: POR_PAGINA_ORDENES, offset: (f.pagina - 1) * POR_PAGINA_ORDENES },
          }),
        ),
      placeholderData: keepPreviousData,
    }),

  emitidas: (empresa: number, f: FiltroOrdenes) =>
    queryOptions({
      queryKey: ['ordenes', 'emitidas', empresa, f],
      queryFn: () =>
        desenvolver(
          getStockOrdersInFacilityForCustomer({
            path: { companyId: empresa },
            query: { facilityId: f.instalacion, companyCustomerId: f.cliente, openOnly: f.soloAbiertas || undefined, sortBy: 'updateTimestamp', sort: 'DESC', limit: POR_PAGINA_ORDENES, offset: (f.pagina - 1) * POR_PAGINA_ORDENES },
          }),
        ),
      placeholderData: keepPreviousData,
    }),

  /** Acciones de envío (pedidos de cotización) de la empresa. */
  accionesDePedido: (empresa: number) =>
    queryOptions({
      queryKey: ['procesamiento', 'acciones', empresa, 'SHIPMENT'],
      queryFn: async () => (await desenvolver(listProcessingActionsByCompany({ path: { id: empresa }, query: { actionType: 'SHIPMENT', limit: 500 } }))).items ?? [],
      staleTime: 10 * 60_000,
    }),

  /** Acciones de envío de producto final (para los pedidos de clientes). */
  accionesDeProductoFinal: (empresa: number) =>
    queryOptions({
      queryKey: ['procesamiento', 'acciones', empresa, 'SHIPMENT', 'final'],
      queryFn: async () => (await desenvolver(listProcessingActionsByCompany({ path: { id: empresa }, query: { actionType: 'SHIPMENT', onlyFinalProducts: true, limit: 500 } }))).items ?? [],
      staleTime: 10 * 60_000,
    }),

  /** Clientes (empresas compradoras) de esta empresa. */
  clientes: (empresa: number) =>
    queryOptions({
      queryKey: ['clientes', empresa],
      queryFn: async () => (await desenvolver(getCompanyCustomersList({ path: { companyId: empresa }, query: { limit: 500 } }))).items ?? [],
      staleTime: 10 * 60_000,
    }),

  /** Instalaciones públicas de otras empresas de la cadena a las que esta empresa puede pedir. */
  vendedoras: (empresa: number, producto: { semi?: number | null; final?: number | null }) =>
    queryOptions({
      queryKey: ['instalaciones', empresa, 'vendedoras', producto.semi ?? null, producto.final ?? null],
      queryFn: async () =>
        (await desenvolver(listAvailableSellingFacilitiesForCompany({ path: { id: empresa }, query: { semiProductId: producto.semi ?? undefined, finalProductId: producto.final ?? undefined, limit: 500 } }))).items ?? [],
      staleTime: 10 * 60_000,
    }),

  /** Transacciones de entrada de una orden (para aprobar o rechazar las pendientes). */
  transacciones: (idOrden: number) =>
    queryOptions({
      queryKey: ['ordenes', 'transacciones', idOrden],
      queryFn: async () => (await desenvolver(getStockOrderInputTransactions({ path: { stockOrderId: idOrden } }))).items ?? [],
    }),
};

/** Aprueba o rechaza (con comentario) las transacciones pendientes de una orden. */
export function useResolverTransacciones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (decisiones: { id: number; aprobar: boolean; comentario?: string }[]) => {
      for (const d of decisiones) {
        if (d.aprobar) await desenvolver(approveTransaction({ path: { id: d.id } }));
        else await desenvolver(rejectTransaction({ path: { id: d.id }, body: { id: d.id, rejectComment: d.comentario } }));
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ordenes'] });
      void qc.invalidateQueries({ queryKey: ['stock'] });
      void qc.invalidateQueries({ queryKey: ['procesamiento'] });
    },
  });
}

/** Crea el pedido de un cliente: una orden por producto final, que después completan los proveedores. */
export function useCrearPedidoCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ApiProductOrder) => desenvolver(createProductOrder({ body: p })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ordenes'] });
      void qc.invalidateQueries({ queryKey: ['procesamiento'] });
    },
  });
}
