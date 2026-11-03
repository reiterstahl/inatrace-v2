import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { activateUser, adminListUsers, adminUpdateProfile, createCompany, executeCompanyAction, getProfileForAdmin, listCompanies, listCompaniesAdmin, regionalAdminListUsers } from './gen/sdk.gen';
import type { ApiAdminUserUpdate, ApiUserGet } from './gen/types.gen';
import type { AccionEmpresa, AccionUsuario, EstadoEmpresa, EstadoUsuario, RolUsuario } from '@/util/administracion';
import { consultas } from './consultas';
import { POR_PAGINA } from './productores';
import { desenvolver } from './respuesta';

export type FiltroUsuarios = { texto: string; estado?: EstadoUsuario; rol?: RolUsuario; pagina: number };

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

  /**
   * Personas de la instancia (administración del sistema) o las de sus empresas más las que todavía
   * no tienen empresa (regional). Busca en nombre, apellido y correo.
   */
  usuarios: (f: FiltroUsuarios, sistema: boolean) =>
    queryOptions({
      queryKey: ['usuarios', 'administracion', sistema, f],
      queryFn: () => {
        const query = { query: f.texto.trim() || undefined, status: f.estado, role: f.rol, limit: POR_PAGINA, offset: (f.pagina - 1) * POR_PAGINA, sortBy: 'surname', sort: 'ASC' as const };
        return desenvolver(sistema ? adminListUsers({ query }) : regionalAdminListUsers({ query }));
      },
      placeholderData: keepPreviousData,
    }),

  /** El backend responde también las empresas de la persona (el tipo generado no las declara). */
  usuario: (id: number) =>
    queryOptions({
      queryKey: ['usuarios', 'administracion', 'ficha', id],
      queryFn: async () => (await desenvolver(getProfileForAdmin({ path: { id } }))) as ApiUserGet,
      staleTime: 0,
    }),
};

export function useAccionCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accion, usuario }: { accion: AccionUsuario; usuario: number }) => desenvolver(activateUser({ path: { action: accion }, body: { id: usuario } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

/** El backend reemplaza nombre, apellido e idioma: se mandan los tres siempre. */
export function useGuardarCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (u: ApiAdminUserUpdate) => desenvolver(adminUpdateProfile({ body: u })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

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
