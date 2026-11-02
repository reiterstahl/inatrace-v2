import { describe, expect, it } from 'vitest';
import type { ApiCompanyGet } from '@/api/gen/types.gen';
import { armarEmpresa, dejaSinAdministracion, formDesdeEmpresa, validarEmpresa } from './fichaEmpresa';

const empresa: ApiCompanyGet = {
  id: 1,
  name: 'Cooperativa Flor de la Sierra',
  abbreviation: 'CFS',
  logo: { id: 3, storageKey: 'logo', name: 'logo.png' },
  headquarters: { address: 'Calle 1', city: 'Huehuetenango', country: { id: 90, code: 'GT', name: 'Guatemala' }, village: 'Aldea' },
  about: 'Café de altura.',
  email: 'info@flor.example',
  phone: '+502 5555 0000',
  mediaLinks: { facebook: 'https://facebook.com/flor' },
  documents: [
    { id: 10, category: 'VIDEO', type: 'LINK', description: 'Cosecha', link: 'https://youtu.be/x' },
    { id: 11, category: 'MEET_THE_FARMER', type: 'FILE', name: 'Ana', description: 'Productora', quote: 'Me gusta', document: { id: 4, storageKey: 'ana', name: 'ana.jpg' } },
  ],
  certifications: [{ id: 7, type: 'ORGANIC', description: 'Orgánico', certificate: { id: 5, storageKey: 'cert', name: 'cert.pdf' }, validity: '2027-01-01' }],
  valueChains: [{ id: 1, name: 'Café' }],
  currency: { id: 2, code: 'USD', label: 'Dólar' },
  allowBeycoIntegration: true,
  displayPrefferedWayOfPayment: true,
  users: [{ id: 1, companyRole: 'COMPANY_ADMIN' }],
  actions: ['VIEW_COMPANY_PROFILE'],
  supportsCollectors: false,
};

describe('ficha de la empresa', () => {
  it('ida y vuelta: conserva lo que la ficha no edita y no manda usuarios', () => {
    const a = armarEmpresa(empresa, formDesdeEmpresa(empresa), { paises: [{ id: 90, code: 'GT', name: 'Guatemala' }], monedas: [] });
    expect(a).not.toHaveProperty('users');
    expect(a).not.toHaveProperty('actions');
    expect(a.displayPrefferedWayOfPayment).toBe(true);
    expect(a.headquarters).toMatchObject({ address: 'Calle 1', village: 'Aldea', country: { id: 90, code: 'GT' } });
    expect(a.documents).toEqual([
      { id: 10, category: 'VIDEO', type: 'LINK', description: 'Cosecha', link: 'https://youtu.be/x' },
      { id: 11, category: 'MEET_THE_FARMER', type: 'FILE', name: 'Ana', description: 'Productora', quote: 'Me gusta', document: { id: 4, storageKey: 'ana', name: 'ana.jpg' } },
    ]);
    expect(a.certifications).toEqual([{ type: 'ORGANIC', description: 'Orgánico', certificate: { id: 5, storageKey: 'cert', name: 'cert.pdf' }, validity: '2027-01-01' }]);
    expect(a.mediaLinks).toEqual({ facebook: 'https://facebook.com/flor' });
    expect(a.currency).toEqual({ id: 2, code: 'USD', label: 'Dólar' });
    const otra = armarEmpresa(empresa, { ...formDesdeEmpresa(empresa), moneda: 3 }, { paises: [], monedas: [{ id: 3, code: 'GTQ', label: 'Quetzal' }] });
    expect(otra.currency).toEqual({ id: 3, code: 'GTQ', label: 'Quetzal' });
    expect(a.allowBeycoIntegration).toBe(true);
  });

  it('valida obligatorios, largos, correo, abreviatura y listas', () => {
    expect(validarEmpresa(formDesdeEmpresa(empresa))).toEqual({});
    const f = { ...formDesdeEmpresa({}), abreviatura: 'AB', correo: 'no-es-correo', acerca: 'x'.repeat(2001) };
    expect(validarEmpresa(f)).toMatchObject({ nombre: 'requerido', abreviatura: 'abreviatura', logo: 'requerido', direccion: 'requerido', acerca: 'largo_2000', correo: 'correo', telefono: 'requerido', cadenas: 'sin_cadenas', moneda: 'requerido' });
    const conListas = { ...formDesdeEmpresa(empresa), videos: [{ clave: 'v', descripcion: '', enlace: '' }], certificaciones: [{ clave: 'c', tipo: '', descripcion: 'x', certificado: null, vigencia: '' }] };
    expect(validarEmpresa(conListas)).toEqual({ 'videos.v.descripcion': 'requerido', 'videos.v.enlace': 'requerido', 'certificaciones.c.certificado': 'requerido' });
  });

  it('no deja a la empresa sin administración', () => {
    const usuarios = [{ id: 1, companyRole: 'COMPANY_ADMIN' }, { id: 2, companyRole: 'COMPANY_USER' }];
    expect(dejaSinAdministracion(usuarios, 1)).toBe(true);
    expect(dejaSinAdministracion(usuarios, 1, 'MANAGER')).toBe(true);
    expect(dejaSinAdministracion(usuarios, 1, 'COMPANY_ADMIN')).toBe(false);
    expect(dejaSinAdministracion(usuarios, 2)).toBe(false);
    expect(dejaSinAdministracion([...usuarios, { id: 3, companyRole: 'COMPANY_ADMIN' }], 1)).toBe(false);
  });
});
