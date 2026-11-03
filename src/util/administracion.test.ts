import { describe, expect, it } from 'vitest';
import { accionesEmpresa, destinosFusion, esAdministracion, validarNombreEmpresa } from './administracion';

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
