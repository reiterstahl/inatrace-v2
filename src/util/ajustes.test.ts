import { describe, expect, it } from 'vitest';
import { editaAjustes, enlaceValido, normalizarEnlace, permisosMoneda } from './ajustes';

describe('ajustes', () => {
  it('completa el esquema del enlace y deja el vacío como vacío', () => {
    expect(normalizarEnlace(' docs.inatrace.org/etiquetas ')).toBe('https://docs.inatrace.org/etiquetas');
    expect(normalizarEnlace('http://ejemplo.org')).toBe('http://ejemplo.org');
    expect(normalizarEnlace('  ')).toBe('');
  });

  it('valida el enlace', () => {
    expect(enlaceValido('')).toBe(true);
    expect(enlaceValido('docs.inatrace.org')).toBe(true);
    expect(enlaceValido('no es un enlace')).toBe(false);
    expect(enlaceValido('javascript:alert(1)')).toBe(false);
  });

  it('permisos como el backend', () => {
    expect(permisosMoneda('REGIONAL_ADMIN')).toEqual({ activar: true, desactivar: false });
    expect(permisosMoneda('SYSTEM_ADMIN')).toEqual({ activar: true, desactivar: true });
    expect(editaAjustes('REGIONAL_ADMIN')).toBe(false);
  });
});
