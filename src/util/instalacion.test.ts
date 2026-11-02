import { describe, expect, it } from 'vitest';
import type { ApiFacility } from '@/api/gen/types.gen';
import { armarInstalacion, completarNombres, formDesdeInstalacion, lugarInstalacion, nombreInstalacion, validarInstalacion } from './instalacion';

const gt = { id: 90, code: 'GT', name: 'Guatemala' };
const rw = { id: 184, code: 'RW', name: 'Rwanda' };
const tipo = { id: 3, code: 'WASHING_STATION', label: 'Beneficio' };

const instalacion: ApiFacility = {
  id: 11,
  name: 'Beneficio',
  company: { id: 1, name: 'Flor' },
  facilityType: tipo,
  translations: [{ language: 'ES', name: 'Beneficio' }, { language: 'EN', name: 'Wet mill' }],
  facilityLocation: { publiclyVisible: true, latitude: 15.3, longitude: -91.4, numberOfFarmers: 12, address: { address: 'Km 4', city: 'Huehuetenango', country: gt } },
  isCollectionFacility: true,
  isPublic: false,
  displayTare: true,
  deactivated: true,
  facilityValueChains: [{ id: 1, name: 'Café' }],
  facilitySemiProductList: [{ id: 2, name: 'Cereza' }],
};

describe('instalaciones', () => {
  it('ida y vuelta: conserva lo que el formulario no edita, incluido si está desactivada', () => {
    const a = armarInstalacion(instalacion, formDesdeInstalacion(instalacion), { empresa: 1, idioma: 'es', paises: [gt], tipos: [tipo] });
    expect(a.deactivated).toBe(true);
    expect(a.company).toEqual({ id: 1, name: 'Flor' });
    expect(a.facilityLocation).toMatchObject({ numberOfFarmers: 12, latitude: 15.3, address: { address: 'Km 4', country: gt } });
    // Los idiomas vacíos toman el nombre de la interfaz.
    expect(a.translations).toEqual([{ language: 'ES', name: 'Beneficio' }, { language: 'EN', name: 'Wet mill' }, { language: 'DE', name: 'Beneficio' }, { language: 'RW', name: 'Beneficio' }]);
    expect(a).toMatchObject({ isCollectionFacility: true, isPublic: false, displayTare: true, displayOrganic: false, facilityType: tipo });
  });

  it('en Ruanda guarda aldea, celda y sector en vez de la dirección', () => {
    const f = { ...formDesdeInstalacion(instalacion), pais: 184, codigoPais: 'RW', aldea: 'Nyamata', celda: 'Kanazi', sector: 'Bugesera' };
    const a = armarInstalacion(instalacion, f, { empresa: 1, idioma: 'en', paises: [gt, rw], tipos: [tipo] });
    expect(a.facilityLocation?.address).toMatchObject({ country: rw, village: 'Nyamata', cell: 'Kanazi', sector: 'Bugesera', address: undefined, city: undefined });
  });

  it('valida lo obligatorio y las coordenadas si se muestra en el mapa', () => {
    expect(validarInstalacion(formDesdeInstalacion(instalacion))).toEqual({});
    expect(validarInstalacion(formDesdeInstalacion(null))).toEqual({ tipo: 'requerido', nombre: 'requerido', pais: 'requerido', visible: 'requerido', acopio: 'requerido', vende: 'requerido', cadenas: 'sin_cadenas' });
    const f = { ...formDesdeInstalacion(instalacion), lat: null, lng: 200 };
    expect(validarInstalacion(f)).toEqual({ lat: 'requerido', lng: 'longitud' });
    expect(validarInstalacion({ ...f, visible: false })).toEqual({});
  });

  it('una nueva arranca con la cadena si la empresa tiene una sola', () => {
    expect(formDesdeInstalacion(null, [{ id: 1, name: 'Café' }]).cadenas).toEqual([{ id: 1, name: 'Café' }]);
    expect(formDesdeInstalacion(null, [{ id: 1 }, { id: 2 }]).cadenas).toEqual([]);
  });

  it('nombres y lugar para la lista', () => {
    expect(completarNombres({ ES: '', EN: ' Mill ', DE: '', RW: '' }, 'es')).toEqual({ ES: 'Mill', EN: 'Mill', DE: 'Mill', RW: 'Mill' });
    expect(nombreInstalacion({ id: 4, name: '', translations: [{ language: 'EN', name: 'Mill' }] })).toBe('Mill');
    expect(nombreInstalacion({ id: 4 })).toBe('#4');
    expect(lugarInstalacion(instalacion)).toBe('Huehuetenango, Guatemala');
  });
});
