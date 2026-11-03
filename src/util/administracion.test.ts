import { describe, expect, it } from 'vitest';
import { accionesEmpresa, accionesUsuario, destinosFusion, esAdministracion, validarNombreEmpresa, validarPersona } from './administracion';

describe('administración de empresas', () => {
  it('la del sistema activa, desactiva y fusiona según el estado', () => {
    expect(accionesEmpresa('REGISTERED', 'SYSTEM_ADMIN')).toEqual(['ACTIVATE_COMPANY', 'DEACTIVATE_COMPANY', 'MERGE_TO_COMPANY']);
    expect(accionesEmpresa('ACTIVE', 'SYSTEM_ADMIN')).toEqual(['DEACTIVATE_COMPANY', 'MERGE_TO_COMPANY']);
    expect(accionesEmpresa('DEACTIVATED', 'SYSTEM_ADMIN')).toEqual(['ACTIVATE_COMPANY', 'MERGE_TO_COMPANY']);
  });

  it('la regional solo activa; el resto, nada', () => {
    expect(accionesEmpresa('REGISTERED', 'REGIONAL_ADMIN')).toEqual(['ACTIVATE_COMPANY']);
    expect(accionesEmpresa('ACTIVE', 'REGIONAL_ADMIN')).toEqual([]);
    expect(accionesEmpresa('DEACTIVATED', 'USER')).toEqual([]);
    expect(esAdministracion('REGIONAL_ADMIN')).toBe(true);
    expect(esAdministracion('USER')).toBe(false);
  });

  it('solo se fusiona hacia otra empresa activa', () => {
    const l = [{ id: 1, status: 'ACTIVE' as const }, { id: 2, status: 'ACTIVE' as const }, { id: 3, status: 'DEACTIVATED' as const }, { id: 4, status: 'REGISTERED' as const }];
    expect(destinosFusion(l, 1).map((e) => e.id)).toEqual([2]);
  });

  it('pide el nombre', () => {
    expect(validarNombreEmpresa('  ')).toBe('requerido');
    expect(validarNombreEmpresa('x'.repeat(256))).toBe('largo');
    expect(validarNombreEmpresa(' Cooperativa ')).toBeNull();
  });
});

describe('administración de usuarios', () => {
  const sistema = { id: 1, role: 'SYSTEM_ADMIN' as const };
  const regional = { id: 2, role: 'REGIONAL_ADMIN' as const };

  it('la del sistema: según estado y rol, como el backend', () => {
    expect(accionesUsuario({ id: 9, status: 'UNCONFIRMED' }, sistema)).toEqual(['CONFIRM_USER_EMAIL']);
    expect(accionesUsuario({ id: 9, status: 'CONFIRMED_EMAIL' }, sistema)).toEqual(['ACTIVATE_USER', 'DEACTIVATE_USER']);
    expect(accionesUsuario({ id: 9, status: 'DEACTIVATED' }, sistema)).toEqual(['ACTIVATE_USER']);
    expect(accionesUsuario({ id: 9, status: 'ACTIVE', role: 'USER' }, sistema)).toEqual(['DEACTIVATE_USER', 'SET_USER_REGIONAL_ADMIN', 'SET_USER_SYSTEM_ADMIN']);
    expect(accionesUsuario({ id: 9, status: 'ACTIVE', role: 'REGIONAL_ADMIN' }, sistema)).toEqual(['DEACTIVATE_USER', 'UNSET_USER_REGIONAL_ADMIN']);
    // No se desactiva a la administración del sistema sin quitarle antes el rol.
    expect(accionesUsuario({ id: 9, status: 'ACTIVE', role: 'SYSTEM_ADMIN' }, sistema)).toEqual(['UNSET_USER_SYSTEM_ADMIN']);
  });

  it('nada sobre uno mismo ni para quien no administra', () => {
    expect(accionesUsuario({ id: 1, status: 'ACTIVE', role: 'SYSTEM_ADMIN' }, sistema)).toEqual([]);
    expect(accionesUsuario({ id: 9, status: 'DEACTIVATED' }, { id: 3, role: 'USER' })).toEqual([]);
  });

  it('la regional nunca cambia roles ni desactiva (H29)', () => {
    expect(accionesUsuario({ id: 9, status: 'ACTIVE', role: 'USER' }, regional)).toEqual([]);
    expect(accionesUsuario({ id: 9, status: 'CONFIRMED_EMAIL' }, regional)).toEqual(['ACTIVATE_USER']);
    expect(accionesUsuario({ id: 9, status: 'UNCONFIRMED' }, regional)).toEqual(['CONFIRM_USER_EMAIL']);
  });

  it('nombre y apellido obligatorios', () => {
    expect(validarPersona({ nombre: ' ', apellido: 'Pérez' })).toEqual({ nombre: 'requerido' });
    expect(validarPersona({ nombre: 'Ana', apellido: 'Pérez' })).toEqual({});
  });
});
