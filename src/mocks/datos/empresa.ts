import type { ApiCompanyGet, ApiCurrencyType, ApiFacility, ApiFacilityType, ApiUserBase, ApiValueChain } from '@/api/gen/types.gen';
import { EMPRESA_DEMO, paises } from './productores';
import { instalaciones } from './stock';

export const monedas: ApiCurrencyType[] = [
  { id: 1, code: 'EUR', label: 'Euro', enabled: true },
  { id: 2, code: 'USD', label: 'US dollar', enabled: true },
  { id: 3, code: 'GTQ', label: 'Quetzal', enabled: true },
];

export const cadenasActivas: ApiValueChain[] = [
  { id: 1, name: 'Café', valueChainStatus: 'ENABLED' },
  { id: 2, name: 'Cacao', valueChainStatus: 'ENABLED' },
];

/** Ficha completa de la empresa demo (la que lee y guarda la pestaña Ficha). */
export const fichaEmpresaDemo: ApiCompanyGet = {
  ...EMPRESA_DEMO,
  abbreviation: 'CFS',
  logo: { id: 900, storageKey: 'logo-flor', name: 'logo.png', contentType: 'image/png' },
  headquarters: { address: '4a calle 2-15, zona 1', city: 'Huehuetenango', state: 'Huehuetenango', country: paises[0] },
  about: 'Cooperativa de pequeños productores de café de altura en la Sierra de los Cuchumatanes.',
  manager: 'Marta López',
  email: 'info@flordelasierra.example',
  phone: '+502 7764 0000',
  webPage: 'https://flordelasierra.example',
  mediaLinks: { facebook: 'https://facebook.com/flordelasierra' },
  documents: [{ id: 901, category: 'VIDEO', type: 'LINK', description: 'La cosecha 2026', link: 'https://youtu.be/cosecha' }],
  certifications: [],
  valueChains: [cadenasActivas[0]!],
  currency: monedas[1],
  allowBeycoIntegration: true,
  displayPrefferedWayOfPayment: true,
};

/** Cuentas de la instancia, para sumar personas a la empresa (administración). */
export const cuentasInstancia: ApiUserBase[] = [
  { id: 7, name: 'Ana', surname: 'Demo', email: 'demo@inatrace.local', status: 'ACTIVE', role: 'USER' },
  { id: 8, name: 'Luis', surname: 'Pérez', email: 'luis@inatrace.local', status: 'ACTIVE', role: 'USER' },
  { id: 9, name: 'Rosa', surname: 'Chávez', email: 'rosa@inatrace.local', status: 'ACTIVE', role: 'USER' },
  { id: 10, name: 'Pedro', surname: 'Chávez', email: 'pedro@inatrace.local', status: 'UNCONFIRMED', role: 'USER' },
];

export const tiposInstalacion: ApiFacilityType[] = [
  { id: 1, code: 'WASHING_STATION', label: 'Beneficio húmedo' },
  { id: 2, code: 'COLLECTION_CENTER', label: 'Centro de acopio' },
  { id: 3, code: 'WAREHOUSE', label: 'Bodega' },
];

/** Las instalaciones de stock con lo que pide la pestaña de la empresa (tipo, lugar, nombres, cadenas). */
export const instalacionesEmpresa: ApiFacility[] = instalaciones.map((f, i) => ({
  ...f,
  company: { id: EMPRESA_DEMO.id, name: EMPRESA_DEMO.name },
  facilityType: tiposInstalacion[i === 0 ? 0 : 1],
  translations: [{ language: 'ES' as const, name: f.name }, { language: 'EN' as const, name: f.name }, { language: 'DE' as const, name: f.name }, { language: 'RW' as const, name: f.name }],
  facilityLocation: { publiclyVisible: i === 0, latitude: i === 0 ? 15.32 : undefined, longitude: i === 0 ? -91.47 : undefined, address: { city: i === 0 ? 'Huehuetenango' : 'Todos Santos', country: paises[0] } },
  isPublic: i === 0,
  facilityValueChains: [cadenasActivas[0]!],
  deactivated: false,
}));
