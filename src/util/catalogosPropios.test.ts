import { describe, expect, it } from 'vitest';
import {
  armarCapa, armarCertificacion, armarFactor, formDesdeCapa, formDesdeCertificacion, formDesdeFactor, porCien,
  validarCapa, validarCertificacion, validarFactor,
} from './catalogosPropios';

describe('capas de mapa', () => {
  it('reglas del backend según el tipo', () => {
    const f = { ...formDesdeCapa(), codigo: 'CATASTRO', etiqueta: 'Catastro', tipo: 'WMS' as const, url: 'https://mapas.ejemplo.org/wms' };
    expect(validarCapa(f)).toEqual({ capa: 'requerido' });
    expect(validarCapa({ ...f, tipo: 'XYZ', url: 'https://tiles.ejemplo.org/{z}/{x}.png' })).toEqual({ url: 'plantilla_xyz' });
    expect(validarCapa({ ...f, capa: 'parcelas', opacidad: '1,5' })).toEqual({ opacidad: 'opacidad' });
    expect(validarCapa({ ...f, capa: 'parcelas', url: 'javascript:alert(1)' })).toEqual({ url: 'url' });
    expect(validarCapa({ ...f, capa: 'parcelas', opacidad: '0,7' })).toEqual({});
  });

  it('el código no cambia al editar y se guarda sobre la original', () => {
    const original = { id: 3, code: 'BOSQUES', label: 'Bosques', type: 'XYZ' as const, url: 'https://t/{z}/{x}/{y}.png', opacity: 0.5, visibleByDefault: true, enabled: true, sortOrder: 2 };
    const f = { ...formDesdeCapa(original), codigo: 'OTRO', etiqueta: 'Bosques 2026', opacidad: '0,8' };
    expect(armarCapa(original, f)).toMatchObject({ id: 3, code: 'BOSQUES', label: 'Bosques 2026', opacity: 0.8, visibleByDefault: true, sortOrder: 2 });
  });
});

describe('tipos de certificación', () => {
  it('nombre y código obligatorios, logo como enlace, orden entero', () => {
    expect(validarCertificacion(formDesdeCertificacion())).toEqual({ codigo: 'requerido', etiqueta: 'requerido' });
    const f = { ...formDesdeCertificacion(), codigo: 'RA', etiqueta: 'Rainforest Alliance', logo: 'no-es-url', orden: '1.5' };
    expect(validarCertificacion(f)).toEqual({ logo: 'url', orden: 'entero' });
    expect(armarCertificacion({ id: 4, code: 'RA', label: 'RA' }, { ...f, codigo: 'X', logo: '', orden: '3' })).toMatchObject({ id: 4, code: 'RA', label: 'Rainforest Alliance', sortOrder: 3, logoUrl: undefined });
  });
});

describe('factores de conversión', () => {
  it('entrada y salida distintas y factor positivo', () => {
    expect(validarFactor(formDesdeFactor())).toEqual({ entrada: 'requerido', salida: 'requerido', factor: 'positivo' });
    expect(validarFactor({ entrada: '3', salida: '3', factor: '0', notas: '', activo: true })).toEqual({ salida: 'mismo', factor: 'positivo' });
    expect(validarFactor({ entrada: '3', salida: '4', factor: '0,2', notas: '', activo: true })).toEqual({});
  });

  it('conserva la empresa del factor', () => {
    const original = { id: 9, inputSemiProductId: 3, outputSemiProductId: 4, factor: 0.2, companyId: 1 };
    expect(armarFactor(original, { ...formDesdeFactor(original), factor: '0,25' })).toMatchObject({ id: 9, companyId: 1, factor: 0.25, inputSemiProductId: 3, outputSemiProductId: 4 });
    expect(porCien(0.205)).toBe(20.5);
  });
});
