import { describe, expect, it } from 'vitest';
import { armarCadena, formDesdeCadena, permisosCadena, validarCadena } from './cadena';

const cadena = {
  id: 4,
  name: 'Café',
  description: 'Cadena del café',
  valueChainStatus: 'ENABLED' as const,
  productType: { id: 1, name: 'Café' },
  facilityTypes: [{ id: 2, code: 'WASHING_STATION', label: 'Beneficio' }],
  measureUnitTypes: [{ id: 5, code: 'KG', label: 'kg' }],
  processingEvidenceTypes: [],
  processingEvidenceFields: [{ id: 9, label: 'Humedad' }],
  semiProducts: [{ id: 30, name: 'Pergamino' }, { id: 31, name: 'Oro' }],
};

describe('cadenas de valor', () => {
  it('ida y vuelta: conserva el resto y manda las listas por id', () => {
    const a = armarCadena(cadena, formDesdeCadena(cadena));
    expect(a).toMatchObject({ id: 4, valueChainStatus: 'ENABLED', name: 'Café', description: 'Cadena del café', productType: { id: 1 } });
    expect(a.semiProducts).toEqual([{ id: 30 }, { id: 31 }]);
    expect(a.processingEvidenceTypes).toEqual([]);
  });

  it('nombre, descripción y tipo de producto obligatorios', () => {
    expect(validarCadena(formDesdeCadena())).toEqual({ nombre: 'requerido', descripcion: 'requerido', tipoProducto: 'requerido' });
    expect(validarCadena(formDesdeCadena(cadena))).toEqual({});
  });

  it('la regional solo crea; desactivada no se edita', () => {
    expect(permisosCadena('REGIONAL_ADMIN', cadena)).toEqual({ crear: true, editar: false, activar: false, desactivar: false, borrar: false });
    expect(permisosCadena('SYSTEM_ADMIN', cadena)).toEqual({ crear: true, editar: true, activar: false, desactivar: true, borrar: true });
    expect(permisosCadena('SYSTEM_ADMIN', { valueChainStatus: 'DISABLED' })).toMatchObject({ editar: false, activar: true, desactivar: false });
    expect(permisosCadena('USER', cadena).crear).toBe(false);
  });
});
