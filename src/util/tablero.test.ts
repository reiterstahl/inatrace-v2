import { describe, expect, it } from 'vitest';
import { agrupacionPara, escala, etiquetaPeriodo, rangoInicial } from './tablero';

describe('tablero', () => {
  it('agrupa según el largo del rango, como la versión actual', () => {
    expect(agrupacionPara('2026-10-01', '2026-10-05')).toBe('DAY');
    expect(agrupacionPara('2026-10-01', '2026-10-20')).toBe('WEEK');
    expect(agrupacionPara('2024-11-01', '2026-11-01')).toBe('MONTH');
    expect(agrupacionPara('2020-01-01', '2026-11-01')).toBe('YEAR');
  });

  it('etiquetas de período', () => {
    expect(etiquetaPeriodo('10', 2026, 'MONTH', 'es', 'sem.')).toMatch(/oct.*2026/);
    expect(etiquetaPeriodo('43', 2026, 'WEEK', 'es', 'sem.')).toBe('sem. 43 · 2026');
    expect(etiquetaPeriodo('2026', 2026, 'YEAR', 'es', 'sem.')).toBe('2026');
    expect(etiquetaPeriodo('2026-10-20', 2026, 'DAY', 'es', 'sem.')).toBe('2026-10-20');
  });

  it('rango inicial de dos años y escala redonda', () => {
    expect(rangoInicial(new Date('2026-11-02T12:00:00Z'))).toEqual({ desde: '2024-11-02', hasta: '2026-11-02' });
    expect(escala(1234)).toEqual({ tope: 1500, paso: 500 });
    expect(escala(0.8)).toEqual({ tope: 0.8, paso: 0.2 });
    expect(escala(0)).toEqual({ tope: 1, paso: 0.25 });
  });
});
