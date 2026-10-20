import { describe, expect, it } from 'vitest';
import type { ApiUserCustomer } from '@/api/gen/types.gen';
import { aApi, aFormulario, esquemaProductor } from './esquema';

const EMPRESA = 1;
const cat = {
  paises: [{ id: 90, code: 'GT', name: 'Guatemala' }, { id: 180, code: 'RW', name: 'Rwanda' }, { id: 95, code: 'HN', name: 'Honduras' }],
  tiposProducto: [{ id: 1, name: 'Coffee', code: 'COFFEE' }],
};

const original: ApiUserCustomer = {
  id: 7, companyId: EMPRESA, type: 'FARMER', name: 'Ana', surname: 'Pérez', gender: 'FEMALE', phone: '5555',
  location: { latitude: 15.3, longitude: -91.4, address: { city: 'Huehuetenango', state: 'Huehuetenango', country: { id: 90, code: 'GT', name: 'Guatemala' } } },
  farm: { areaUnit: 'ha', totalCultivatedArea: 2.5, organic: false, farmPlantInformationList: [{ productType: { id: 1 }, plantCultivatedArea: 2, numberOfPlants: 3000 }] },
  productTypes: [{ id: 1, name: 'Coffee' }],
  cooperatives: [{ id: 3, company: { id: EMPRESA }, userCustomerType: 'FARMER' }, { id: 4, company: { id: 99 }, userCustomerType: 'FARMER' }],
  associations: [{ id: 5, company: { id: 12 } }],
  ownProducts: [{ id: 1, name: 'Café pergamino' }], // la v2 todavía no los edita: no se pueden perder
  plots: [{ id: 11, plotName: 'La Loma', crop: { id: 1 }, size: 1.2, unit: 'ha', geoId: 'abc', coordinates: [{ id: 1, latitude: 15.3, longitude: -91.4 }, { id: 2, latitude: 15.31, longitude: -91.4 }, { id: 3, latitude: 15.31, longitude: -91.41 }] }],
};

describe('ficha del productor', () => {
  it('ida y vuelta sin cambios conserva los datos', () => {
    const f = aFormulario(original, EMPRESA);
    expect(esquemaProductor.safeParse(f).success).toBe(true);
    const api = aApi(f, original, EMPRESA, cat);
    expect(api.ownProducts).toEqual(original.ownProducts);
    expect(api.location?.latitude).toBe(15.3);
    expect(api.location?.address?.city).toBe('Huehuetenango');
    expect(api.farm?.farmPlantInformationList?.[0]).toMatchObject({ plantCultivatedArea: 2, numberOfPlants: 3000 });
    expect(api.plots?.[0]).toMatchObject({ id: 11, plotName: 'La Loma', geoId: 'abc', size: 1.2 });
    expect(api.plots?.[0]?.coordinates).toHaveLength(3);
    // Se conservan la cooperativa de otra empresa y la membresía (con su id) en esta.
    expect(api.cooperatives).toEqual([{ id: 4, company: { id: 99 }, userCustomerType: 'FARMER' }, { id: 3, company: { id: EMPRESA }, userCustomerType: 'FARMER' }]);
    expect(api.associations).toEqual([{ id: 5, company: { id: 12 } }]);
  });

  it('acepta coma decimal', () => {
    const f = { ...aFormulario(original, EMPRESA), areaTotal: '3,75' };
    expect(aApi(f, original, EMPRESA, cat).farm?.totalCultivatedArea).toBe(3.75);
  });

  it('exige apellido, género y país', () => {
    const r = esquemaProductor.safeParse(aFormulario(null, EMPRESA));
    expect(r.success).toBe(false);
    const caminos = r.error!.issues.map((i) => i.path.join('.'));
    expect(caminos).toEqual(expect.arrayContaining(['surname', 'gender', 'pais']));
  });

  it('pide los campos de dirección del país elegido', () => {
    const base = { ...aFormulario(original, EMPRESA), dir: { ...aFormulario(original, EMPRESA).dir, city: '', state: '' } };
    const caminos = (c: string) => esquemaProductor.safeParse({ ...base, codigoPais: c }).error?.issues.map((i) => i.path.join('.')) ?? [];
    expect(caminos('GT')).toEqual(expect.arrayContaining(['dir.city', 'dir.state']));
    expect(caminos('RW')).toEqual(expect.arrayContaining(['dir.village', 'dir.cell', 'dir.sector']));
    expect(caminos('HN')).toEqual(expect.arrayContaining(['dir.hondurasVillage', 'dir.hondurasMunicipality', 'dir.hondurasDepartment']));
  });

  it('al cambiar de país no quedan restos del formato anterior', () => {
    const f = { ...aFormulario(original, EMPRESA), pais: 180, codigoPais: 'RW', dir: { ...aFormulario(original, EMPRESA).dir, village: 'Kigali', cell: 'A', sector: 'B' } };
    const dir = aApi(f, original, EMPRESA, cat).location?.address;
    expect(dir).toMatchObject({ village: 'Kigali', country: { code: 'RW' } });
    expect(dir).not.toHaveProperty('city');
  });

  it('con superficies cargadas, la unidad es obligatoria', () => {
    const f = { ...aFormulario(original, EMPRESA), unidadArea: '' };
    expect(esquemaProductor.safeParse(f).error?.issues.map((i) => i.path.join('.'))).toContain('unidadArea');
  });

  it('una parcela necesita nombre y cultivo', () => {
    const f = aFormulario(original, EMPRESA);
    f.parcelas.push({ plotName: '', cropId: null, numberOfPlants: '', size: '', unit: '', organicStartOfTransition: '', coordenadas: [] });
    const caminos = esquemaProductor.safeParse(f).error?.issues.map((i) => i.path.join('.'));
    expect(caminos).toEqual(expect.arrayContaining(['parcelas.1.plotName', 'parcelas.1.cropId']));
  });

  it('un productor nuevo queda como miembro de la cooperativa de la empresa', () => {
    const f = { ...aFormulario(null, EMPRESA), surname: 'Ruiz', gender: 'MALE' as const, pais: 90, codigoPais: 'GT', dir: { ...aFormulario(null, EMPRESA).dir, city: 'X', state: 'Y' } };
    expect(esquemaProductor.safeParse(f).success).toBe(true);
    expect(aApi(f, null, EMPRESA, cat).cooperatives).toEqual([{ company: { id: EMPRESA }, userCustomerType: 'FARMER' }]);
  });
});

describe('selectores numéricos', () => {
  it('vacío, null y undefined son null; nunca 0', async () => {
    const { aNumeroONulo } = await import('./comunes');
    expect([aNumeroONulo(''), aNumeroONulo(null), aNumeroONulo(undefined), aNumeroONulo('90')]).toEqual([null, null, null, 90]);
  });
});
