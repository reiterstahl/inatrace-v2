import type { ApiProduct } from '@/api/gen/types.gen';
import { EMPRESA_DEMO } from './productores';

/** Productos del modo simulado: uno propio de la cooperativa y uno de otra empresa donde es compradora. */
export const productosIniciales: ApiProduct[] = [
  {
    id: 1,
    name: 'Café Flor de la Sierra',
    description: 'Café de altura de pequeños productores de Huehuetenango.',
    photo: { id: 901, storageKey: 'producto-1', name: 'cafe.jpg', contentType: 'image/jpeg' },
    company: EMPRESA_DEMO,
    valueChain: { id: 1, name: 'Café' },
    origin: { text: 'Fincas de 1.500 a 1.900 m en Huehuetenango.', locations: [{ pinName: 'Todos Santos', latitude: 15.508, longitude: -91.605, numberOfFarmers: 34 }, { pinName: 'La Libertad', latitude: 15.514, longitude: -91.869, numberOfFarmers: 21 }] },
    process: { production: 'Despulpado el mismo día, fermentación de 36 horas y secado en patio.' },
    responsibility: { laborPolicies: 'Pago al productor dentro de los 15 días y sin trabajo infantil.' },
    sustainability: { production: 'Café bajo sombra con árboles nativos.', packaging: 'Sacos de yute reutilizables.', co2Footprint: '1,2 kg CO₂ por kg' },
    settings: { language: 'ES', costBreakdown: false },
    businessToCustomerSettings: { primaryColor: '#2f5d50' },
    associatedCompanies: [{ company: EMPRESA_DEMO, type: 'OWNER' }],
    labels: [],
    dataSharingAgreements: [],
  },
  {
    id: 2,
    name: 'Tueste La Vecina',
    description: 'Café tostado de Cooperativa La Vecina.',
    company: { id: 50, name: 'Cooperativa La Vecina' },
    valueChain: { id: 1, name: 'Café' },
    origin: { text: 'Mezcla de cooperativas de la región.', locations: [{ pinName: 'Chiantla', latitude: 15.355, longitude: -91.457 }] },
    process: { production: 'Tueste medio.' },
    responsibility: { laborPolicies: 'Comercio justo.' },
    sustainability: { production: 'Producción orgánica.' },
    settings: {},
    associatedCompanies: [{ company: { id: 50, name: 'Cooperativa La Vecina' }, type: 'OWNER' }, { company: EMPRESA_DEMO, type: 'BUYER' }],
    labels: [],
    dataSharingAgreements: [],
  },
];
