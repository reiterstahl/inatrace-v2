import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { createCompany, executeCompanyAction, listCompanies, listCompaniesAdmin } from './gen/sdk.gen';
import type { AccionEmpresa, EstadoEmpresa } from '@/util/administracion';
import { consultas } from './consultas';
import { POR_PAGINA } from './productores';
import { desenvolver } from './respuesta';

export type FiltroEmpresas = { texto: string; estado?: EstadoEmpresa; pagina: number };

export const administracion = {
  /**
   * Empresas de la instancia (administración del sistema) o en las que está inscrita (regional,
   * que no puede usar la lista completa). El backend busca por comienzo del nombre.
   */
  empresas: (f: FiltroEmpresas, sistema: boolean) =>
    queryOptions({
      queryKey: ['empresas', 'administracion', sistema, f],
      queryFn: () => {
        const query = { name: f.texto.trim() || undefined, status: f.estado, limit: POR_PAGINA, offset: (f.pagina - 1) * POR_PAGINA, sortBy: 'name', sort: 'ASC' as const };
        return desenvolver(sistema ? listCompaniesAdmin({ query }) : listCompanies({ query }));
      },
      placeholderData: keepPreviousData,
    }),

  /** Empresas activas a las que se puede fusionar otra. */
  activas: (texto: string) =>
    queryOptions({
      queryKey: ['empresas', 'administracion', 'activas', texto],
      queryFn: async () => (await desenvolver(listCompaniesAdmin({ query: { name: texto.trim() || undefined, status: 'ACTIVE', limit: 20, sortBy: 'name', sort: 'ASC' } }))).items ?? [],
    }),
};

function useAlCambiarEmpresas() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['empresas'] });
    void qc.invalidateQueries({ queryKey: ['empresa'] });
  };
}

export function useAccionEmpresa() {
  const alCambiar = useAlCambiarEmpresas();
  return useMutation({
    mutationFn: ({ accion, empresa, destino }: { accion: AccionEmpresa; empresa: number; destino?: number }) =>
      desenvolver(executeCompanyAction({ path: { action: accion }, body: { companyId: empresa, otherCompanyId: destino } })),
    onSuccess: alCambiar,
  });
}

/** Crea la empresa con solo el nombre: quien la crea queda como su administración (así lo hace el backend). */
export function useCrearEmpresa() {
  const qc = useQueryClient();
  const alCambiar = useAlCambiarEmpresas();
  return useMutation({
    mutationFn: async (nombre: string) => (await desenvolver(createCompany({ body: { name: nombre.trim() } }))).id!,
    onSuccess: () => {
      alCambiar();
      // Ahora está inscrita en la empresa nueva.
      void qc.invalidateQueries({ queryKey: consultas.perfil().queryKey });
    },
  });
}
