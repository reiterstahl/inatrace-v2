import { correoValido } from './fichaEmpresa';

/** Como el backend (PasswordTools): de 8 a 50 caracteres. */
export const CLAVE_MIN = 8;
export const CLAVE_MAX = 50;

export type FormRegistro = { nombre: string; apellido: string; correo: string; clave: string; repetir: string; acepta: boolean };
export type ErroresRegistro = Partial<Record<keyof FormRegistro, 'requerido' | 'correo' | 'clave_corta' | 'clave_larga' | 'distintas' | 'aceptar'>>;

export function validarClave(clave: string, repetir: string): Pick<ErroresRegistro, 'clave' | 'repetir'> {
  const e: Pick<ErroresRegistro, 'clave' | 'repetir'> = {};
  if (!clave) e.clave = 'requerido';
  else if (clave.length < CLAVE_MIN) e.clave = 'clave_corta';
  else if (clave.length > CLAVE_MAX) e.clave = 'clave_larga';
  if (!e.clave && clave !== repetir) e.repetir = 'distintas';
  return e;
}

export function validarRegistro(f: FormRegistro): ErroresRegistro {
  const e: ErroresRegistro = { ...validarClave(f.clave, f.repetir) };
  if (!f.nombre.trim()) e.nombre = 'requerido';
  if (!f.apellido.trim()) e.apellido = 'requerido';
  if (!f.correo.trim()) e.correo = 'requerido';
  else if (!correoValido(f.correo)) e.correo = 'correo';
  if (!f.acepta) e.acepta = 'aceptar';
  return e;
}
