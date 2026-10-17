import { describe, expect, it } from 'vitest';
import { contraste, estiloMarca, textoSobre } from './marca';
import { enlaceSeguro } from './Vitrina';
import { videoInsertable } from './Productores';
import { validarOpinion } from './Opinion';

describe('enlaceSeguro', () => {
  it('acepta http(s) y completa el esquema', () => {
    expect(enlaceSeguro('https://ejemplo.org/a')).toBe('https://ejemplo.org/a');
    expect(enlaceSeguro('instagram.com/coop')).toBe('https://instagram.com/coop');
  });
  it('descarta esquemas peligrosos', () => {
    expect(enlaceSeguro('javascript:alert(1)')).toBeUndefined();
    expect(enlaceSeguro('data:text/html,<script>')).toBeUndefined();
    expect(enlaceSeguro('')).toBeUndefined();
  });
});

describe('videoInsertable', () => {
  it('convierte YouTube a la versión sin cookies', () => {
    expect(videoInsertable('https://youtu.be/aqz-KE-bpKQ')).toBe('https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ');
    expect(videoInsertable('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).toBe('https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ');
  });
  it('no inserta otros sitios', () => {
    expect(videoInsertable('https://malicioso.example/embed/x')).toBeUndefined();
  });
});

describe('colores de marca', () => {
  it('elige el texto más legible sobre cada fondo', () => {
    expect(textoSobre('#2f5d3a')).toBe('#ffffff');
    expect(textoSobre('#f3e9b0')).toBe('#1b201d');
  });
  it('descarta un color de texto ilegible sobre el papel', () => {
    expect(contraste('#eeeeee', '#f7f5f0')).toBeLessThan(4.5);
    expect(estiloMarca({ textColor: '#eeeeee' })).not.toHaveProperty('--tinta');
    expect(estiloMarca({ textColor: '#2a2f2b' })).toHaveProperty('--tinta', '#2a2f2b');
  });
  it('ignora valores que no son colores', () => {
    expect(estiloMarca({ primaryColor: 'red; background:url(x)' })).toEqual({});
  });
});

describe('validarOpinion', () => {
  const base = { tipo: 'PRAISE' as const, comentario: '', sabor: '', edad: '', genero: '', correo: '', acepto: true };
  it('exige consentimiento y valida formatos', () => {
    expect(validarOpinion({ ...base, acepto: false })).toHaveProperty('acepto');
    expect(validarOpinion({ ...base, correo: 'no-es-correo' })).toHaveProperty('correo');
    expect(validarOpinion({ ...base, comentario: 'x'.repeat(501) })).toHaveProperty('comentario');
    expect(validarOpinion({ ...base, edad: '0' })).toHaveProperty('edad');
    expect(validarOpinion({ ...base, correo: 'a@b.co', edad: '34' })).toEqual({});
  });
});
