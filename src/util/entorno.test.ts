import { describe, expect, it } from 'vitest';
import { urlQr } from './entorno';

describe('URL del QR de un lote', () => {
  it('igual que la versión actual: {raíz}/{idioma de la etiqueta}/q-cd/{uuid}/{código}', () => {
    expect(urlQr({ uuid: 'ec8eed8f', language: 'ES' }, '4cc6143a-e209')).toBe(`${window.location.origin}/es/q-cd/ec8eed8f/4cc6143a-e209`);
  });

  it('sin idioma, en inglés (el idioma por defecto de las etiquetas)', () => {
    expect(urlQr({ uuid: 'x' }, 'y')).toBe(`${window.location.origin}/en/q-cd/x/y`);
  });
});
