import type { ApiCompanyListResponse, ApiUserGet } from '@/api/gen/types.gen';

export type EstadoEmpresa = NonNullable<ApiCompanyListResponse['status']>;
export const ESTADOS_EMPRESA: EstadoEmpresa[] = ['ACTIVE', 'REGISTERED', 'DEACTIVATED'];
export type AccionEmpresa = 'ACTIVATE_COMPANY' | 'DEACTIVATE_COMPANY' | 'MERGE_TO_COMPANY';

/** Quién entra a Administración: la del sistema ve todas las empresas; la regional, las suyas. */
export const esAdministracion = (rol: ApiUserGet['role']) => rol === 'SYSTEM_ADMIN' || rol === 'REGIONAL_ADMIN';

/**
 * Acciones sobre una empresa según su estado y el rol, como el backend: la administración del
 * sistema activa, desactiva y fusiona; la regional solo activa (desactivar y fusionar se le niegan).
 */
export function accionesEmpresa(estado: EstadoEmpresa | undefined, rol: ApiUserGet['role']): AccionEmpresa[] {
  if (rol === 'REGIONAL_ADMIN') return estado === 'ACTIVE' ? [] : ['ACTIVATE_COMPANY'];
  if (rol !== 'SYSTEM_ADMIN') return [];
  const porEstado: AccionEmpresa[] =
    estado === 'REGISTERED' ? ['ACTIVATE_COMPANY', 'DEACTIVATE_COMPANY'] : estado === 'DEACTIVATED' ? ['ACTIVATE_COMPANY'] : ['DEACTIVATE_COMPANY'];
  return [...porEstado, 'MERGE_TO_COMPANY'];
}

/** Destinos posibles de una fusión: solo empresas activas (el backend rechaza las demás) y nunca la misma. */
export const destinosFusion = (empresas: ApiCompanyListResponse[], origen: number) => empresas.filter((e) => e.status === 'ACTIVE' && e.id !== origen);

/** Nombre de una empresa nueva: obligatorio y con un largo razonable. */
export function validarNombreEmpresa(nombre: string): 'requerido' | 'largo' | null {
  const n = nombre.trim();
  if (!n) return 'requerido';
  return n.length > 255 ? 'largo' : null;
}
