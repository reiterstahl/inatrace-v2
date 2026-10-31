import { describe, expect, it } from 'vitest';
import type { ApiProduct } from '@/api/gen/types.gen';
import { armarProducto, esDuena, formDesdeProducto, puntoNuevo, seccionesConError, sinErroresProducto, validarProducto, type FormProducto } from './producto';

const original: ApiProduct = {
  id: 1,
  name: 'Café de la Sierra',
  description: 'Café de altura',
  photo: { id: 9, storageKey: 'k', name: 'foto.jpg' },
  company: { id: 1, name: 'Cooperativa' },
  valueChain: { id: 3 },
  origin: { text: 'Huehuetenango', locations: [{ pinName: 'Finca 1', latitude: 15.3, longitude: -91.4, numberOfFarmers: 12 }] },
  process: { production: 'Lavado' },
  responsibility: { laborPolicies: 'Pago justo' },
  sustainability: { production: 'Sombra', packaging: 'Yute', co2Footprint: '1 kg' },
  settings: { language: 'ES', gdprText: 'GDPR', costBreakdown: true },
  businessToCustomerSettings: { primaryColor: '#123456' },
  associatedCompanies: [
    { company: { id: 1 }, type: 'OWNER' },
    { company: { id: 2 }, type: 'BUYER' },
  ],
  labels: [{ id: 7, title: 'Etiqueta' }],
};

function completo(): FormProducto {
  return { ...formDesdeProducto(original) };
}

describe('ficha de producto', () => {
  it('carga desde el producto, con los puntos de origen', () => {
    const f = formDesdeProducto(original);
    expect(f).toMatchObject({ nombre: 'Café de la Sierra', origenTexto: 'Huehuetenango', produccion: 'Lavado', idioma: 'ES', gdpr: 'GDPR', sostenibleEmpaque: 'Yute' });
    expect(f.puntos).toEqual([expect.objectContaining({ nombre: 'Finca 1', lat: 15.3, lng: -91.4, productores: 12 })]);
    expect(formDesdeProducto(null)).toMatchObject({ nombre: '', puntos: [], foto: null });
  });

  it('obligatorios y límites de la versión actual', () => {
    expect(sinErroresProducto(validarProducto(completo()))).toBe(true);
    const e = validarProducto(formDesdeProducto(null));
    expect(e).toMatchObject({ nombre: 'requerido', descripcion: 'requerido', foto: 'requerido', origenTexto: 'requerido', sinPuntos: 'sin_puntos', produccion: 'requerido', politicasLaborales: 'requerido', sostenibleProduccion: 'requerido', idioma: 'requerido' });
    expect([...seccionesConError(e)].sort()).toEqual(['ajustes', 'datos', 'origen', 'proceso', 'responsabilidad', 'sostenibilidad']);
    const largo = validarProducto({ ...completo(), sostenibleProduccion: 'x'.repeat(1001), sostenibleEmpaque: 'y'.repeat(1001) });
    expect(largo).toMatchObject({ sostenibleProduccion: 'largo_1000', sostenibleEmpaque: 'largo_1000' });
  });

  it('cada punto de origen necesita coordenadas válidas', () => {
    const p = { ...puntoNuevo(), lat: 95, productores: 2.5 };
    const e = validarProducto({ ...completo(), puntos: [p] });
    expect(e.puntos[p.clave]).toEqual({ lat: 'latitud', lng: 'requerido', productores: 'entero' });
    expect([...seccionesConError(e)]).toEqual(['origen']);
  });

  it('al guardar parte del producto completo y solo cambia lo de la ficha', () => {
    const f = { ...completo(), nombre: ' Café nuevo ', sostenibleEmpaque: '', puntos: [{ ...completo().puntos[0]!, nombre: 'Finca norte' }] };
    const p = armarProducto(f, original);
    // Lo que la ficha no toca viaja tal cual (el backend reescribe todo lo que recibe).
    expect(p.associatedCompanies).toBe(original.associatedCompanies);
    expect(p.businessToCustomerSettings).toBe(original.businessToCustomerSettings);
    expect(p.labels).toBe(original.labels);
    expect(p.settings).toMatchObject({ costBreakdown: true, language: 'ES' });
    expect(p).toMatchObject({ id: 1, name: 'Café nuevo', sustainability: { packaging: undefined, co2Footprint: '1 kg' } });
    // El punto conserva lo demás y cambia el nombre.
    expect(p.origin!.locations).toEqual([{ pinName: 'Finca norte', latitude: 15.3, longitude: -91.4, numberOfFarmers: 12 }]);
  });

  it('un producto nuevo lleva empresa, cadena de valor y acuerdos vacíos', () => {
    const p = armarProducto(completo(), null, { empresa: 4, cadena: 3 });
    expect(p).toMatchObject({ company: { id: 4 }, valueChain: { id: 3 }, dataSharingAgreements: [], name: 'Café de la Sierra' });
    expect(p.id).toBeUndefined();
  });

  it('edita solo la empresa dueña', () => {
    expect(esDuena(original, 1)).toBe(true);
    expect(esDuena(original, 2)).toBe(false);
  });
});
