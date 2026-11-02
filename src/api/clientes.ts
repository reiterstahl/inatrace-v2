import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCompanyCustomer, deleteCompanyCustomer, updateCompanyCustomer } from './gen/sdk.gen';
import type { ApiCompanyCustomer } from './gen/types.gen';
import { desenvolver } from './respuesta';

// La lista de clientes es `ordenes.clientes` (la usan también los pedidos de clientes).

export function useGuardarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: ApiCompanyCustomer) => desenvolver(c.id ? updateCompanyCustomer({ body: c }) : createCompanyCustomer({ body: c })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['clientes'] }),
  });
}

/** El backend no puede borrar un cliente con pedidos (falla por la clave foránea). */
export function useBorrarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => desenvolver(deleteCompanyCustomer({ path: { id } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['clientes'] }),
  });
}
