import { describe, expect, it } from 'vitest';
import type { ApiBeycoOrderFields } from '@/api/gen/types.gen';
import { armarOferta, completarNombres, conEspecialidad, ofertaDesdeCampos, resolverVuelta, sinErroresOferta, urlAutorizacion, validarOferta, type OfertaBeyco } from './beyco';

// Lo que arma el backend para un lote (BeycoOrderService.getBeycoOrderFieldList).
const campos: ApiBeycoOrderFields = {
  privacy: 'Public',
  portOfExport: { address: 'Huehuetenango', country: 'Guatemala', latitude: 15.31, longitude: -91.47 },
  offerCoffees: [
    {
      coffee: {
        name: 'LOTE-FS-001',
        harvestAt: '2026-10-17T00:00:00Z',
        minScreenSize: 15,
        maxScreenSize: 15,
        cuppingScore: 84,
        qualitySegments: [{ type: 'CommodityConventional' }],
        grades: [{ type: 'ShgShb' }],
        certificates: [{ type: 'Organic' }],
      },
    },
  ],
};

function completa(): OfertaBeyco {
  const f = ofertaDesdeCampos(campos);
  return {
    ...f,
    titulo: 'Café de Huehuetenango',
    disponible: '2026-11-15',
    cafes: f.cafes.map((c) => ({ ...c, cantidad: 690, precio: 5.2, unidadPrecio: 'Kg', moneda: 'Usd', pais: 'Guatemala', incoterm: 'Fob', especie: 'Arabica', variedades: ['Caturra'] })),
  };
}

describe('oferta en Beyco', () => {
  it('parte de lo que arma el backend: lote, cosecha, puerto, zaranda, taza, grado y sellos', () => {
    const f = ofertaDesdeCampos(campos);
    expect(f).toMatchObject({ direccion: 'Huehuetenango', pais: 'Guatemala', latitud: 15.31, longitud: -91.47 });
    expect(f.cafes[0]).toMatchObject({ lote: 'LOTE-FS-001', nombre: 'LOTE-FS-001', cosecha: '2026-10-17', zarandaMin: 15, zarandaMax: 15, taza: 84, grados: ['ShgShb'], certificados: ['Organic'] });
    // Con 84 puntos de taza ya viene marcado como especialidad.
    expect(f.cafes[0]!.segmentos).toEqual(['CommodityConventional', 'Specialty']);
  });

  it('una entrega llega sin nombre: se completa con el identificador del lote', () => {
    const sinNombre = ofertaDesdeCampos({ ...campos, offerCoffees: [{ coffee: { harvestAt: '2026-10-17' } }, { coffee: { name: 'PROC-1' } }] });
    const f = completarNombres(sinNombre, [{ identifier: 'PT-López-2026-10-14' }, { identifier: 'X', internalLotNumber: 'PROC-1' }]);
    expect(f.cafes.map((c) => [c.lote, c.nombre])).toEqual([['PT-López-2026-10-14', 'PT-López-2026-10-14'], ['PROC-1', 'PROC-1']]);
  });

  it('especialidad desde 80 puntos, sin duplicar', () => {
    expect(conEspecialidad([], 79)).toEqual([]);
    expect(conEspecialidad([], 80)).toEqual(['Specialty']);
    expect(conEspecialidad(['Specialty'], 90)).toEqual(['Specialty']);
  });

  it('las validaciones de la versión actual', () => {
    expect(sinErroresOferta(validarOferta(completa()))).toBe(true);
    const f = completa();
    const c = f.cafes[0]!;
    const e = validarOferta({
      ...f,
      titulo: 'x'.repeat(71),
      latitud: 95,
      cafes: [{ ...c, zarandaMin: 18, zarandaMax: 16, taza: 59, incoterm: 'Other', incotermOtro: '', variedades: ['Other'], variedadOtra: '', grados: ['Other'], gradoOtro: '', precio: -1 }],
    });
    expect(e).toMatchObject({ titulo: 'titulo_largo', latitud: 'coordenada' });
    expect(e.cafes[c.clave]).toEqual({ zarandaMax: 'zaranda_orden', taza: 'taza', incotermOtro: 'requerido', variedadOtra: 'requerido', gradoOtro: 'requerido', precio: 'rango' });
    expect(validarOferta({ ...f, cafes: [{ ...c, zarandaMin: 7, zarandaMax: 21 }] }).cafes[c.clave]).toEqual({ zarandaMin: 'zaranda', zarandaMax: 'zaranda' });
  });

  it('armado: los textos libres de «Otro» solo viajan cuando se eligió «Otro»', () => {
    const f = completa();
    const o = armarOferta({ ...f, cafes: [{ ...f.cafes[0]!, incotermOtro: 'no debe ir', variedades: ['Caturra', 'Other'], variedadOtra: 'Pache' }] });
    expect(o).toMatchObject({ title: 'Café de Huehuetenango', availableAt: '2026-11-15', portOfExport: { country: 'Guatemala', latitude: 15.31 } });
    const cafe = o.offerCoffees![0]!;
    expect(cafe).toMatchObject({ price: 5.2, priceUnit: 'Kg', currency: 'Usd', incoterms: 'Fob' });
    expect(cafe.customIncoterms).toBeUndefined();
    expect(cafe.coffee!.varieties).toEqual([{ type: 'Caturra', customVariety: undefined }, { type: 'Other', customVariety: 'Pache' }]);
    expect(cafe.coffee!.additionalQualityDescriptors).toBeUndefined();
    expect(cafe.coffee!.certificates).toEqual([{ type: 'Organic' }]);
  });
});

describe('autorización con Beyco', () => {
  it('URL con los parámetros de la versión actual', () => {
    const u = urlAutorizacion('https://beyco.example/oauth', 'cliente 1', 'https://inatrace.example/v2/stock/beyco', 'abc');
    expect(u).toBe('https://beyco.example/oauth?responseType=code&clientId=cliente%201&redirectUri=https%3A%2F%2Finatrace.example%2Fv2%2Fstock%2Fbeyco&scope=Offer%3ACreate&state=abc');
  });

  it('la vuelta exige el mismo state que se generó al salir', () => {
    const pendiente = { state: 'abc', empresa: 1, lotes: [3, 4] };
    expect(resolverVuelta({ code: 'k', state: 'abc' }, pendiente)).toEqual({ ok: true, code: 'k', pendiente });
    expect(resolverVuelta({ code: 'k', state: 'otro' }, pendiente)).toEqual({ ok: false, motivo: 'estado' });
    expect(resolverVuelta({ code: 'k', state: 'abc' }, null)).toEqual({ ok: false, motivo: 'estado' });
    expect(resolverVuelta({ error: 'AccessDenied', state: 'abc' }, pendiente)).toEqual({ ok: false, motivo: 'denegado' });
    expect(resolverVuelta({ state: 'abc' }, pendiente)).toEqual({ ok: false, motivo: 'sin_codigo' });
  });
});
