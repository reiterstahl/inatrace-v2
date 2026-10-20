import { describe, expect, it } from 'vitest';
import { abrir, aHectareas, cerrar, difiereDeDibujada, m2AHectareas, superficieM2, type Punto } from './geo';

describe('superficieM2', () => {
  it('un cuadrado de 0,01° en el ecuador mide ~1,24 km²', () => {
    const c: Punto[] = [[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01]];
    expect(superficieM2(c) / 1e6).toBeCloseTo(1.2364, 2);
  });
  it('da lo mismo con el anillo abierto o cerrado y en cualquier sentido', () => {
    const c: Punto[] = [[-91.47, 15.32], [-91.46, 15.32], [-91.46, 15.33], [-91.47, 15.33]];
    const base = superficieM2(c);
    expect(superficieM2(cerrar(c))).toBeCloseTo(base, 6);
    expect(superficieM2([...c].reverse())).toBeCloseTo(base, 6);
    // ~1,07 km × 1,11 km en Huehuetenango ≈ 119 ha
    expect(m2AHectareas(base)).toBeGreaterThan(115);
    expect(m2AHectareas(base)).toBeLessThan(122);
  });
  it('menos de tres vértices no es un polígono', () => {
    expect(superficieM2([[0, 0], [1, 1]])).toBe(0);
  });
  it('abrir y cerrar son inversos', () => {
    const c: Punto[] = [[1, 1], [2, 1], [2, 2]];
    expect(abrir(cerrar(c))).toEqual(c);
    expect(cerrar(cerrar(c))).toEqual(cerrar(c));
  });
});

describe('superficie declarada', () => {
  it('convierte unidades conocidas a hectáreas', () => {
    expect(aHectareas(2, 'ha')).toBe(2);
    expect(aHectareas(10, 'mz')).toBeCloseTo(6.987, 3);
    expect(aHectareas(10000, 'm²')).toBeCloseTo(1, 6);
    expect(aHectareas(1, 'cuerdas')).toBeNull();
  });
  it('avisa si difiere más de un 20 % de lo dibujado', () => {
    expect(difiereDeDibujada(1.5, 6.88)).toBe(true);
    expect(difiereDeDibujada(6.5, 6.88)).toBe(false);
  });
});
