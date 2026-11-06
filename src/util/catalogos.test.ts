import { describe, expect, it } from 'vitest';
import { armarItem, formDesdeItem, nombreItem, permisosCatalogo, validarCatalogo } from './catalogos';

const semi = {
  id: 3, name: 'Café cereza', description: 'Fruto fresco', measurementUnitType: { id: 2, code: 'WEIGHT_KG', label: 'kg' }, buyable: true, sku: false, skuendCustomer: false,
  translations: [{ language: 'EN' as const, name: 'Coffee cherry', description: 'Fresh fruit' }, { language: 'ES' as const, name: 'Café cereza', description: 'Fruto fresco' }],
};

describe('catálogos', () => {
  it('semiproducto: ida y vuelta con traducciones y unidad', () => {
    const a = armarItem('semiproductos', semi, formDesdeItem('semiproductos', semi));
    expect(a).toMatchObject({ id: 3, name: 'Coffee cherry', description: 'Fresh fruit', measurementUnitType: { id: 2 }, buyable: true, sku: false });
    expect((a as typeof semi).translations).toEqual([
      { language: 'EN', name: 'Coffee cherry', description: 'Fresh fruit' },
      { language: 'ES', name: 'Café cereza', description: 'Fruto fresco' },
    ]);
  });

  it('los idiomas sin texto no se mandan; el inglés es obligatorio', () => {
    const f = formDesdeItem('semiproductos');
    f.textos.ES.nombre = 'Pergamino';
    f.unidad = '2';
    expect(validarCatalogo('semiproductos', f)).toEqual({ nombre: 'requerido' });
    f.textos.EN.nombre = 'Parchment';
    expect(validarCatalogo('semiproductos', f)).toEqual({});
    expect((armarItem('semiproductos', undefined, f) as typeof semi).translations.map((t) => t.language)).toEqual(['EN', 'ES']);
  });

  it('códigos en mayúsculas, números y guion bajo (salvo tipos de producto)', () => {
    const f = { ...formDesdeItem('tipos-instalacion'), codigo: 'Beneficio', etiqueta: 'Beneficio' };
    expect(validarCatalogo('tipos-instalacion', f)).toEqual({ codigo: 'formato' });
    expect(validarCatalogo('tipos-instalacion', { ...f, codigo: 'WET_MILL_2' })).toEqual({});
    const p = formDesdeItem('tipos-producto');
    p.codigo = 'Cacao';
    p.textos.EN.nombre = 'Cocoa';
    expect(validarCatalogo('tipos-producto', p)).toEqual({ descripcion: 'requerido' });
  });

  it('unidad: peso opcional pero numérico, y unidad base', () => {
    const f = { ...formDesdeItem('unidades'), codigo: 'BAG_46', etiqueta: 'Saco 46 kg', peso: 'x' };
    expect(validarCatalogo('unidades', f)).toEqual({ peso: 'numero' });
    const a = armarItem('unidades', { id: 9, code: 'OLD', label: 'Viejo' }, { ...f, peso: '46,5', unidadBase: '2' });
    expect(a).toMatchObject({ id: 9, code: 'BAG_46', weight: 46.5, underlyingMeasurementUnitType: { id: 2 } });
    expect(armarItem('unidades', undefined, { ...f, peso: '' })).toMatchObject({ weight: undefined });
  });

  it('evidencias: la etiqueta principal sale del inglés y el tipo es obligatorio', () => {
    const f = formDesdeItem('campos-evidencia');
    f.codigo = 'HUMEDAD';
    f.textos.EN.nombre = 'Moisture (%)';
    f.textos.ES.nombre = 'Humedad (%)';
    expect(validarCatalogo('campos-evidencia', f)).toEqual({ tipo: 'requerido' });
    const a = armarItem('campos-evidencia', undefined, { ...f, tipo: 'NUMBER' });
    expect(a).toMatchObject({ fieldName: 'HUMEDAD', label: 'Moisture (%)', type: 'NUMBER', translations: [{ language: 'EN', label: 'Moisture (%)' }, { language: 'ES', label: 'Humedad (%)' }] });
    expect(nombreItem(a)).toBe('Moisture (%)');
  });

  it('la regional crea pero no edita ni borra', () => {
    expect(permisosCatalogo('REGIONAL_ADMIN')).toEqual({ crear: true, editar: false, borrar: false });
    expect(permisosCatalogo('SYSTEM_ADMIN')).toEqual({ crear: true, editar: true, borrar: true });
    expect(permisosCatalogo('USER').crear).toBe(false);
  });
});
