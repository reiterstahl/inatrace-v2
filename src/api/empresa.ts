import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminListUsers, executeCompanyAction, getCompany, getEnabledCurrencyTypes, getValueChainList, regionalAdminListUsers, updateCompany } from './gen/sdk.gen';
import type { ApiCompanyUpdate } from './gen/types.gen';
import type { RolEmpresa } from '@/util/fichaEmpresa';
import { consultas } from './consultas';
import { desenvolver } from './respuesta';

export const empresa = {
  /** Ficha completa, fresca: se edita sobre ella (el backend reemplaza todos los campos). */
  ficha: (id: number) =>
    queryOptions({
      queryKey: ['empresa', id, 'perfil'],
      queryFn: () => desenvolver(getCompany({ path: { id } })),
      staleTime: 0,
    }),

  monedas: () =>
    queryOptions({
      queryKey: ['catalogo', 'monedas'],
      queryFn: async () => (await desenvolver(getEnabledCurrencyTypes({ query: { limit: 500, sortBy: 'code', sort: 'ASC' } }))).items ?? [],
      staleTime: 30 * 60_000,
    }),

  cadenasActivas: () =>
    queryOptions({
      queryKey: ['catalogo', 'cadenas-activas'],
      queryFn: async () => (await desenvolver(getValueChainList({ query: { valueChainStatus: 'ENABLED', limit: 1000 } }))).items ?? [],
      staleTime: 10 * 60_000,
    }),

  /** Personas de toda la instancia (solo administración del sistema o regional), para sumar a la empresa. */
  buscarUsuarios: (texto: string, regional: boolean) =>
    queryOptions({
      queryKey: ['usuarios', 'buscar', texto, regional],
      queryFn: async () => {
        const query = { query: texto, limit: 20, sortBy: 'surname', sort: 'ASC' as const };
        return (await desenvolver(regional ? regionalAdminListUsers({ query }) : adminListUsers({ query }))).items ?? [];
      },
      enabled: texto.length >= 2,
    }),
};

export function useGuardarEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: ApiCompanyUpdate) => desenvolver(updateCompany({ body: e })),
    onSuccess: (_, e) => void qc.invalidateQueries({ queryKey: ['empresa', e.id] }),
  });
}

type AccionUsuario = { accion: 'ADD_USER_TO_COMPANY' | 'SET_USER_COMPANY_ROLE' | 'REMOVE_USER_FROM_COMPANY'; usuario: number; rol?: RolEmpresa };

/** Sumar, cambiar de rol o quitar a una persona de la empresa. */
export function useAccionUsuario(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accion, usuario, rol }: AccionUsuario) => desenvolver(executeCompanyAction({ path: { action: accion }, body: { companyId: id, userId: usuario, companyUserRole: rol } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['empresa', id] });
      // Si la persona cambió su propio rol, cambian las empresas que administra.
      void qc.invalidateQueries({ queryKey: consultas.perfil().queryKey });
    },
  });
}
