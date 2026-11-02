import { describe, expect, it } from 'vitest';
import type { ApiProcessingAction } from '@/api/gen/types.gen';
import { armarAccion, completarTextos, formDesdeAccion, siguienteGrupo, validarAccion } from './accion';

const cereza = { id: 3, name: 'Cereza' };
const pergamino = { id: 4, name: 'Pergamino' };
const bolsa = { id: 9, name: 'Bolsa 340 g' };

const trillado: ApiProcessingAction = {
  id: 2,
  company: { id: 1, name: 'Flor' },
  type: 'PROCESSING',
  inputSemiProduct: cereza,
  outputSemiProducts: [{ ...pergamino, repackedOutput: true, maxOutputWeight: 46 }],
  estimatedOutputQuantityPerUnit: 0.2,
  prefix: 'TRI',
  sortOrder: 3,
  publicTimelineLabel: 'Trillado',
  publicTimelineIconType: 'LEAF',
  translations: [{ language: 'ES', name: 'Trillado', description: 'De cereza a pergamino' }],
  valueChains: [{ id: 1, name: 'Café' }],
  requiredEvidenceFields: [{ id: 5, fieldName: 'humedad', mandatory: true }],
  requiredDocumentTypes: [{ id: 6, code: 'CERT', label: 'Certificado', requiredOneOfGroupIdForQuote: '1' }],
  supportedFacilities: [{ id: 11, name: 'Beneficio' }],
};

const ctx = { empresa: 1, idioma: 'es', semis: [cereza, pergamino], finales: [bolsa] };

describe('acciones de procesamiento', () => {
  it('ida y vuelta: conserva lo que no edita y completa la traducción al inglés que exige el backend', () => {
    const a = armarAccion(trillado, formDesdeAccion(trillado), ctx);
    expect(a).toMatchObject({ id: 2, company: { id: 1, name: 'Flor' }, type: 'PROCESSING', inputSemiProduct: cereza, prefix: 'TRI', sortOrder: 3, publicTimelineIconType: 'LEAF', estimatedOutputQuantityPerUnit: 0.2, finalProductAction: false });
    expect(a.outputSemiProducts).toEqual([{ ...pergamino, repackedOutput: true, maxOutputWeight: 46 }]);
    expect(a.translations?.find((t) => t.language === 'EN')).toEqual({ language: 'EN', name: 'Trillado', description: 'De cereza a pergamino' });
    expect(a.requiredDocumentTypes?.[0]?.requiredOneOfGroupIdForQuote).toBe('1');
  });

  it('manda solo los productos del tipo', () => {
    const pedido = { ...formDesdeAccion(trillado), tipo: 'SHIPMENT' as const, deFinales: true, entradaFinal: 9 };
    const a = armarAccion(trillado, pedido, ctx);
    expect(a).toMatchObject({ type: 'SHIPMENT', finalProductAction: true, inputFinalProduct: bolsa, inputSemiProduct: undefined, outputSemiProducts: [], estimatedOutputQuantityPerUnit: undefined });
    const qr = armarAccion(null, { ...formDesdeAccion(null), tipo: 'GENERATE_QR_CODE', entradaSemi: 4, qrFinal: 9, prefijo: 'QR', textos: { ...formDesdeAccion(null).textos, EN: { nombre: 'QR', descripcion: '' } } }, ctx);
    expect(qr).toMatchObject({ company: { id: 1 }, inputSemiProduct: pergamino, qrCodeForFinalProduct: bolsa, finalProductAction: false });
  });

  it('valida según el tipo', () => {
    expect(validarAccion(formDesdeAccion(trillado))).toEqual({});
    expect(validarAccion(formDesdeAccion(null))).toEqual({ tipo: 'requerido', cadenas: 'sin_cadenas', prefijo: 'requerido', nombre: 'requerido' });
    const base = formDesdeAccion(trillado);
    expect(validarAccion({ ...base, salidas: [] })).toEqual({ salidas: 'sin_salidas' });
    expect(validarAccion({ ...base, salidas: [{ semi: pergamino, reempaque: true, maximo: null }] })).toEqual({ maximos: { 4: 'requerido' } });
    expect(validarAccion({ ...base, tipo: 'FINAL_PROCESSING', reempaqueFinal: true })).toEqual({ salidaFinal: 'requerido', maximoFinal: 'requerido' });
    expect(validarAccion({ ...base, tipo: 'TRANSFER', deFinales: null })).toEqual({ deFinales: 'requerido' });
    expect(validarAccion({ ...base, tipo: 'TRANSFER', deFinales: true })).toEqual({ entradaFinal: 'requerido' });
    expect(validarAccion({ ...base, tipo: 'GENERATE_QR_CODE' })).toEqual({ qrFinal: 'requerido' });
    expect(validarAccion({ ...base, orden: '2a' })).toEqual({ orden: 'entero' });
  });

  it('nueva: arranca con la cadena si la empresa tiene una sola; grupos y textos', () => {
    expect(formDesdeAccion(null, [{ id: 1 }]).cadenas).toEqual([{ id: 1 }]);
    expect(siguienteGrupo([{ code: 'a', label: 'a', requiredOneOfGroupIdForQuote: '2' }, { code: 'b', label: 'b' }])).toBe('3');
    expect(siguienteGrupo([])).toBe('1');
    const t = completarTextos({ ES: { nombre: '', descripcion: '' }, EN: { nombre: 'Drying', descripcion: 'Sun' }, DE: { nombre: '', descripcion: '' }, RW: { nombre: '', descripcion: '' } }, 'es');
    expect(t.ES).toEqual({ nombre: 'Drying', descripcion: 'Sun' });
  });
});
