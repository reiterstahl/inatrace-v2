import type { ApiCompanyGet, ApiCurrencyType, ApiUserBase, ApiValueChain } from '@/api/gen/types.gen';
import { EMPRESA_DEMO, paises } from './productores';

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
