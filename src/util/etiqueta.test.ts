import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiProductLabel, ApiProductLabelContent } from '@/api/gen/types.gen';
import {
  aparienciaEfectiva, armarCampos, armarVistaPrevia, camposIniciales, esVistaPrevia, guardarVistaPrevia, idVistaPrevia, leerVistaPrevia, validarMedios, valorCampo, visiblesDesde,
} from './etiqueta';

const etiqueta: ApiProductLabel = {
  id: 7,
  uuid: 'abc',
  title: 'Tienda',
  language: 'ES',
  status: 'UNPUBLISHED',
  // Orden propio (la versión actual deja reordenar) y un campo que la v2 no conoce.
  fields: [
    { name: 'description', section: 'product', visible: true },
    { name: 'name', section: 'product', visible: true },
    { name: 'journeyMarkers', section: 'product', visible: false },
    { name: 'company.name', section: 'company', visible: false },
    { name: 'algo.nuevo', section: 'otro', visible: true },
  ],
};

const contenido: ApiProductLabelContent = {
  name: 'Café de la etiqueta',
  description: 'Para la tienda.',
  process: { production: 'Lavado.' },
  company: { name: 'Cooperativa', mediaLinks: { facebook: 'https://facebook.com/coop' } },
  journeyMarkers: [{ latitude: 1, longitude: 2 }],
  businessToCustomerSettings: { id: 3, primaryColor: '#111111', tabFeedback: false, secondaryColor: undefined },
};

describe('etiquetas', () => {
  beforeEach(() => localStorage.clear());

  it('una etiqueta nueva muestra solo los datos del producto y el recorrido', () => {
    const visibles = camposIniciales().filter((c) => c.visible).map((c) => c.name);
    expect(visibles).toEqual(['name', 'photo', 'description', 'origin', 'journeyMarkers']);
  });

  it('lee la visibilidad y el recorrido queda siempre visible', () => {
    const v = visiblesDesde(etiqueta);
    expect(v.name).toBe(true);
    expect(v['process.production']).toBe(false);
    expect(v.journeyMarkers).toBe(true);
  });

  it('al guardar conserva el orden y los campos desconocidos, y agrega los que faltan', () => {
    const v = { ...visiblesDesde(etiqueta), 'company.name': true, 'process.production': true };
    const campos = armarCampos(v, etiqueta.fields);
    expect(campos.slice(0, 5).map((c) => [c.name, c.visible])).toEqual([
      ['description', true], ['name', true], ['journeyMarkers', true], ['company.name', true], ['algo.nuevo', true],
    ]);
    expect(campos.find((c) => c.name === 'process.production')).toEqual({ name: 'process.production', section: 'process', visible: true });
    expect(new Set(campos.map((c) => c.name)).size).toBe(campos.length);
  });

  it('lee valores por ruta como el backend', () => {
    expect(valorCampo(contenido, 'company.mediaLinks.facebook')).toBe('https://facebook.com/coop');
    expect(valorCampo(contenido, 'settings.gdprText')).toBeUndefined();
    expect(valorCampo(contenido, 'process')).toEqual({ production: 'Lavado.' });
  });

  it('la apariencia de la etiqueta reemplaza a la del producto solo donde tiene valores', () => {
    expect(aparienciaEfectiva({ primaryColor: '#000000', secondaryColor: '#222222', tabFeedback: true }, contenido.businessToCustomerSettings)).toEqual({
      primaryColor: '#111111', secondaryColor: '#222222', tabFeedback: false,
    });
  });

  it('un solo video', () => {
    expect(validarMedios([{ id: 1, category: 'VIDEO', active: true }, { id: 2, category: 'VIDEO', active: false }])).toBeNull();
    expect(validarMedios([{ id: 1, category: 'VIDEO', active: true }, { id: 2, category: 'VIDEO', active: true }])).toBe('un_video');
  });

  it('arma la vista previa con los campos visibles, la apariencia y los medios elegidos', () => {
    const v = { ...visiblesDesde(etiqueta), 'company.mediaLinks.facebook': true };
    const p = armarVistaPrevia({
      etiqueta, titulo: 'Tienda nueva', contenido, visibles: v, aparienciaProducto: { secondaryColor: '#222222' }, producto: 1,
      medios: [{ id: 5, category: 'VIDEO', active: true, link: 'https://youtu.be/abcdefgh' }, { id: 6, category: 'MEET_THE_FARMER', active: false }, { id: 8, category: 'PRODUCTION_RECORD', active: true }],
    });
    expect(p.uuid).toBe('previa-7');
    expect(esVistaPrevia(p.uuid!)).toBe(true);
    expect(p.title).toBe('Tienda nueva');
    expect(p.fields!.map((f) => f.name)).toEqual(['description', 'name', 'journeyMarkers', 'algo.nuevo', 'company.mediaLinks.facebook']);
    expect(p.fields!.find((f) => f.name === 'company.mediaLinks.facebook')?.value).toBe('https://facebook.com/coop');
    expect(p.fields!.some((f) => f.name === 'company.name')).toBe(false);
    expect(p.businessToCustomerSettings).toMatchObject({ primaryColor: '#111111', secondaryColor: '#222222' });
    expect(p.videoMeetTheFarmers?.id).toBe(5);
    expect(p.photosMeetTheFarmers).toEqual([]);
    expect(p.productionRecords?.map((d) => d.id)).toEqual([8]);
    expect(p.vistaPrevia).toEqual({ producto: 1, etiqueta: 7, titulo: 'Tienda nueva', publicada: false });
  });

  it('la vista previa se guarda en el navegador y vence', () => {
    const p = armarVistaPrevia({ etiqueta, titulo: 'T', contenido, visibles: visiblesDesde(etiqueta), producto: 1, medios: [] });
    guardarVistaPrevia(p);
    expect(leerVistaPrevia(idVistaPrevia(7))?.title).toBe('T');
    expect(leerVistaPrevia(idVistaPrevia(7), Date.now() + 25 * 60 * 60_000)).toBeNull();
    expect(leerVistaPrevia('previa-99')).toBeNull();
  });
});
