import type { ApiCompanyListResponse, ApiUserBase, ApiUserGet } from '@/api/gen/types.gen';

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

export type EstadoUsuario = NonNullable<ApiUserBase['status']>;
export type RolUsuario = NonNullable<ApiUserBase['role']>;
export const ESTADOS_USUARIO: EstadoUsuario[] = ['UNCONFIRMED', 'CONFIRMED_EMAIL', 'ACTIVE', 'DEACTIVATED'];
export const ROLES_USUARIO: RolUsuario[] = ['USER', 'REGIONAL_ADMIN', 'SYSTEM_ADMIN'];
export type AccionUsuario =
  | 'CONFIRM_USER_EMAIL'
  | 'ACTIVATE_USER'
  | 'DEACTIVATE_USER'
  | 'SET_USER_SYSTEM_ADMIN'
  | 'UNSET_USER_SYSTEM_ADMIN'
  | 'SET_USER_REGIONAL_ADMIN'
  | 'UNSET_USER_REGIONAL_ADMIN';

/**
 * Acciones sobre una persona, con las reglas de estado del backend. Nunca sobre uno mismo. La
 * regional solo confirma el correo y activa: el backend le niega desactivar y, aunque hoy le acepta
 * los cambios de rol (ver H29), dárselos le permitiría convertir cualquier cuenta en administración
 * del sistema.
 */
export function accionesUsuario(u: Pick<ApiUserBase, 'id' | 'status' | 'role'>, yo: Pick<ApiUserGet, 'id' | 'role'>): AccionUsuario[] {
  if (!u.id || u.id === yo.id || !esAdministracion(yo.role)) return [];
  const sistema = yo.role === 'SYSTEM_ADMIN';
  switch (u.status) {
    case 'UNCONFIRMED':
      return ['CONFIRM_USER_EMAIL'];
    case 'CONFIRMED_EMAIL':
      return sistema ? ['ACTIVATE_USER', 'DEACTIVATE_USER'] : ['ACTIVATE_USER'];
    case 'DEACTIVATED':
      return ['ACTIVATE_USER'];
    case 'ACTIVE': {
      if (!sistema) return [];
      // El backend no desactiva a la administración del sistema: primero se le quita el rol.
      if (u.role === 'SYSTEM_ADMIN') return ['UNSET_USER_SYSTEM_ADMIN'];
      if (u.role === 'REGIONAL_ADMIN') return ['DEACTIVATE_USER', 'UNSET_USER_REGIONAL_ADMIN'];
      return ['DEACTIVATE_USER', 'SET_USER_REGIONAL_ADMIN', 'SET_USER_SYSTEM_ADMIN'];
    }
    default:
      return [];
  }
}

export type FormPersona = { nombre: string; apellido: string };
export type ErroresPersona = Partial<Record<'nombre' | 'apellido', 'requerido'>>;

export function validarPersona(f: FormPersona): ErroresPersona {
  const e: ErroresPersona = {};
  if (!f.nombre.trim()) e.nombre = 'requerido';
  if (!f.apellido.trim()) e.apellido = 'requerido';
  return e;
}
