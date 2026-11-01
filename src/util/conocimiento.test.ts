import { describe, expect, it } from 'vitest';
import { armarEntrada, entradaVacia, enlaceValido, formDesdeEntrada, normalizarEnlace, sinErroresEntrada, validarEntrada } from './conocimiento';

describe('base de conocimiento', () => {
  it('pide tema y título, y respeta los largos del backend', () => {
    expect(validarEntrada(entradaVacia())).toEqual({ tema: 'requerido', titulo: 'requerido' });
    const largo = { ...entradaVacia(), tema: 'QUALITY' as const, titulo: 'x'.repeat(256), resumen: 'r'.repeat(3001), contenido: 'c'.repeat(5001) };
    expect(validarEntrada(largo)).toEqual({ titulo: 'largo', resumen: 'largo', contenido: 'largo' });
    expect(sinErroresEntrada(validarEntrada({ ...entradaVacia(), tema: 'FAIRNESS', titulo: 'Precio justo', resumen: 'r'.repeat(3000) }))).toBe(true);
  });

  it('acepta el video sin protocolo y lo guarda con https://', () => {
    expect(normalizarEnlace('  youtu.be/abc ')).toBe('https://youtu.be/abc');
    expect(normalizarEnlace('http://example.org/v')).toBe('http://example.org/v');
    expect(normalizarEnlace('')).toBe('');
    expect(enlaceValido('youtube.com/watch?v=1')).toBe(true);
    expect(enlaceValido('javascript:alert(1)')).toBe(false);
    expect(enlaceValido('no es un enlace')).toBe(false);
    expect(validarEntrada({ ...entradaVacia(), tema: 'QUALITY', titulo: 'T', video: 'ftp://example.org/v' }).video).toBe('enlace');
  });

  it('ida y vuelta con el backend', () => {
    const e = { id: 5, type: 'PROVENANCE' as const, title: 'De la finca', date: '2026-10-01', summary: '<p>Resumen</p>', content: '<p>Texto</p>', youtubeUrl: 'https://youtu.be/abc', documents: [{ id: 9, storageKey: 'k', name: 'ficha.pdf' }] };
    expect(armarEntrada(formDesdeEntrada(e))).toEqual(e);
    // Los campos vacíos no se mandan como texto vacío.
    expect(armarEntrada({ ...entradaVacia(), tema: 'QUALITY', titulo: ' Catación ', resumen: '  ' })).toEqual({ id: undefined, type: 'QUALITY', title: 'Catación', date: undefined, summary: undefined, content: undefined, youtubeUrl: undefined, documents: [] });
  });
});
