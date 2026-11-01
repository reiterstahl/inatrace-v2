import type { ApiFinalProduct, ApiKnowledgeBlog, ApiMeasureUnitType, ApiProduct, ApiProductLabel, ApiProductLabelAnalytics, ApiProductLabelBatch, ApiProductLabelCompanyDocument, ApiProductLabelContent, ApiProductLabelFeedback } from '@/api/gen/types.gen';
import { camposIniciales } from '@/util/etiqueta';
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
    labels: [{ id: 11, productId: 1, uuid: 'etiqueta-tienda', title: 'Tienda en línea', language: 'ES', status: 'PUBLISHED' }],
    dataSharingAgreements: [],
    journeyMarkers: [{ latitude: 15.508, longitude: -91.605 }, { latitude: 14.634, longitude: -90.507 }],
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

/** Empresas de la instancia, para asociarlas a un producto (lo hace la administración). */
export const empresasInstancia = [
  EMPRESA_DEMO,
  { id: 50, name: 'Cooperativa La Vecina' },
  { id: 60, name: 'Exportadora del Norte' },
  { id: 61, name: 'Tostaduría Central' },
];

export const unidadesMedida: ApiMeasureUnitType[] = [
  { id: 2, code: 'WEIGHT_KG', label: 'kg', weight: 1 },
  { id: 5, code: 'WEIGHT_LB', label: 'lb', weight: 0.4536 },
  { id: 6, code: 'PIECE', label: 'unidad' },
];

export const finalesIniciales: ApiFinalProduct[] = [
  { id: 21, name: 'Café tostado 340 g', description: 'Bolsa con válvula, tueste medio.', product: { id: 1, name: 'Café Flor de la Sierra' }, measurementUnitType: unidadesMedida[2], labels: [{ id: 11, title: 'Tienda en línea', status: 'PUBLISHED' }] },
];

/** Etiquetas del modo simulado: cada una con su contenido (copia del producto) y los medios elegidos. */
export type EtiquetaSimulada = { etiqueta: ApiProductLabel; contenido: ApiProductLabelContent; medios: number[] };

const empresaCompleta = { ...EMPRESA_DEMO, about: 'Cooperativa de 120 familias cafetaleras.', webPage: 'https://flordelasierra.example', mediaLinks: { facebook: 'https://facebook.com/flordelasierra' } };

export function contenidoDe(p: ApiProduct): ApiProductLabelContent {
  const { name, description, photo, origin, process, responsibility, sustainability, settings, businessToCustomerSettings, journeyMarkers } = p;
  return structuredClone({ name, description, photo, origin, process, responsibility, sustainability, settings, businessToCustomerSettings, journeyMarkers, company: empresaCompleta });
}

export const etiquetasIniciales: EtiquetaSimulada[] = [
  {
    etiqueta: { id: 11, productId: 1, uuid: 'etiqueta-tienda', title: 'Tienda en línea', language: 'ES', status: 'PUBLISHED', fields: camposIniciales().map((c) => (c.name === 'process.production' ? { ...c, visible: true } : c)) },
    contenido: contenidoDe(productosIniciales[0]!),
    medios: [302],
  },
];

/** Documentos de las empresas de la cadena que una etiqueta puede mostrar. */
export const mediosEmpresa: ApiProductLabelCompanyDocument[] = [
  { id: 301, category: 'VIDEO', type: 'LINK', name: 'Visita a la finca', link: 'https://youtu.be/dQw4w9WgXcQ' },
  { id: 305, category: 'VIDEO', type: 'LINK', name: 'Día de corte', link: 'https://youtu.be/abcdefghijk' },
  { id: 302, category: 'MEET_THE_FARMER', type: 'FILE', name: 'Doña Marta', quote: 'Cuidamos la sombra del cafetal.', document: { id: 902, storageKey: 'productora-marta', name: 'marta.jpg', contentType: 'image/jpeg' } },
  { id: 303, category: 'MEET_THE_FARMER', type: 'FILE', name: 'Don Luis', document: { id: 903, storageKey: 'productor-luis', name: 'luis.jpg', contentType: 'image/jpeg' } },
  { id: 304, category: 'PRODUCTION_RECORD', type: 'FILE', name: 'Registro de cosecha 2026', document: { id: 904, storageKey: 'registro-2026', name: 'registro.jpg', contentType: 'image/jpeg' } },
];

export const lotesIniciales: ApiProductLabelBatch[] = [
  { id: 31, labelId: 11, number: 'FS202601', productionDate: '2026-03-10', expiryDate: '2027-03-10', checkAuthenticity: true, traceOrigin: true, locations: [{ pinName: 'Todos Santos', latitude: 15.508, longitude: -91.605, numberOfFarmers: 12 }] },
  { id: 32, labelId: 11, number: 'FS202602', productionDate: '2026-06-02', checkAuthenticity: false, traceOrigin: false, locations: [] },
];

export const opinionesIniciales: ApiProductLabelFeedback[] = [
  { id: 41, labelId: 11, type: 'PRAISE', feedback: 'Muy buen café, se siente el chocolate.', email: 'lucia@example.com', gdprConsent: true, questionnaireAnswers: { age: '34', gender: 'Female', rateTaste: 'Better' }, productName: 'Café Flor de la Sierra' },
  { id: 42, labelId: 11, type: 'PROPOSAL', feedback: 'Me gustaría una bolsa más pequeña.', email: 'sin.permiso@example.com', gdprConsent: false, questionnaireAnswers: { gender: 'Male' }, productName: 'Café Flor de la Sierra' },
  { id: 43, labelId: 11, type: 'COMPLAINT', feedback: 'La bolsa llegó abierta.', gdprConsent: false, questionnaireAnswers: {}, productName: 'Café Flor de la Sierra' },
];

export const estadisticasDemo: ApiProductLabelAnalytics = {
  visits: 128,
  visitsCountries: { GT: 74, US: 31, DE: 23 },
  visitsLocations: { '14.634:-90.507': 60, '15.32:-91.47': 14, '40.71:-74.0': 31, '52.52:13.4': 23 },
  authTrue: 9,
  authFalse: 1,
  originTrue: 5,
  originFalse: 0,
};

/** Base de conocimiento: el producto 1 tiene una entrada de cada tema; el contenido llega como HTML. */
export const conocimientoIniciales: (ApiKnowledgeBlog & { productId: number })[] = [
  { id: 51, productId: 1, type: 'FAIRNESS', title: 'Precio justo para las familias', date: '2026-08-14', summary: '<p>Cómo se reparte el precio de cada bolsa.</p>', content: '<p>La cooperativa paga un <strong>sobreprecio</strong> por calidad.</p>', documents: [{ id: 501, storageKey: 'doc-precios', name: 'precios-2026.pdf', contentType: 'application/pdf' }] },
  { id: 52, productId: 1, type: 'QUALITY', title: 'Catación de la cosecha 2026', date: '2026-09-02', summary: 'Notas de chocolate y frutos rojos.', content: '', youtubeUrl: 'https://youtu.be/demo-catacion', documents: [] },
  { id: 53, productId: 1, type: 'PROVENANCE', title: 'De Todos Santos a tu taza', documents: [] },
];
