import { describe, expect, it } from 'vitest';
import { validarClave, validarRegistro } from './cuenta';

const valido = { nombre: 'Ana', apellido: 'Demo', correo: 'ana@ejemplo.org', clave: 'una-clave-larga', repetir: 'una-clave-larga', acepta: true };

describe('cuenta', () => {
  it('registro: todo obligatorio, correo válido y aceptar las condiciones', () => {
    expect(validarRegistro(valido)).toEqual({});
    expect(validarRegistro({ ...valido, nombre: ' ', correo: 'sin-arroba', acepta: false })).toEqual({ nombre: 'requerido', correo: 'correo', acepta: 'aceptar' });
  });

  it('la clave: de 8 a 50 caracteres y repetida igual (como el backend)', () => {
    expect(validarClave('corta', 'corta')).toEqual({ clave: 'clave_corta' });
    expect(validarClave('x'.repeat(51), 'x'.repeat(51))).toEqual({ clave: 'clave_larga' });
    expect(validarClave('una-clave-larga', 'otra-clave')).toEqual({ repetir: 'distintas' });
    expect(validarClave('', '')).toEqual({ clave: 'requerido' });
  });
});
