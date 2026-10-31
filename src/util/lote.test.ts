import { describe, expect, it } from 'vitest';
import { armarLote, csvCorreos, formDesdeLote, loteVacio, ordenarConteos, puntosConteo, sinErroresLote, validarLote } from './lote';

describe('lotes', () => {
  it('pide número, una fecha si se verifica la autenticidad y un lugar si se rastrea el origen', () => {
    const f = { ...loteVacio(), autenticidad: true, origen: true };
    expect(validarLote(f)).toEqual({ numero: 'requerido', fechas: 'una_fecha', lugares: 'sin_lugares', puntos: {} });
    expect(sinErroresLote(validarLote({ ...loteVacio(), numero: 'L1' }))).toBe(true);
    expect(validarLote({ ...loteVacio(), numero: 'L-1' }).numero).toBe('alfanumerico');
    // El backend valida con \p{Alnum} de Java, que sin bandera Unicode es solo ASCII.
    expect(validarLote({ ...loteVacio(), numero: 'Año2026' }).numero).toBe('alfanumerico');
  });

  it('el vencimiento no puede ser anterior a la producción', () => {
    expect(validarLote({ ...loteVacio(), numero: 'L1', produccion: '2026-10-01', vencimiento: '2026-09-30' }).vencimiento).toBe('vence_antes');
    expect(validarLote({ ...loteVacio(), numero: 'L1', produccion: '2026-10-01', vencimiento: '2026-10-01' }).vencimiento).toBeUndefined();
  });

  it('ida y vuelta con el backend', () => {
    const l = { id: 3, labelId: 7, number: 'L26', productionDate: '2026-10-01', checkAuthenticity: true, traceOrigin: true, locations: [{ latitude: 15.5, longitude: -91.6, pinName: 'Finca', numberOfFarmers: 4 }] };
    const f = formDesdeLote(l);
    expect(f.lugares[0]).toMatchObject({ nombre: 'Finca', lat: 15.5, lng: -91.6, productores: 4 });
    expect(armarLote(f, 7)).toEqual({ ...l, expiryDate: undefined, photo: undefined });
  });
});

describe('opiniones y estadísticas', () => {
  it('exporta solo los correos con consentimiento, sin repetir y escapados', () => {
    expect(
      csvCorreos([
        { email: 'a@x.org', gdprConsent: true },
        { email: 'b@x.org', gdprConsent: false },
        { email: 'a@x.org', gdprConsent: true },
        { email: 'raro,"c"@x.org', gdprConsent: true },
        { gdprConsent: true },
      ]),
    ).toBe('email\na@x.org\n"raro,""c""@x.org"\n');
  });

  it('ordena conteos y lee los puntos "lat:lng"', () => {
    expect(ordenarConteos({ GT: 3, CR: 5, SV: 3 })).toEqual([['CR', 5], ['GT', 3], ['SV', 3]]);
    expect(puntosConteo({ '14.6:-90.5': 2, 'x:y': 1, '95:0': 1 })).toEqual([{ lat: 14.6, lng: -90.5, n: 2 }]);
  });
});
