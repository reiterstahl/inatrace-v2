import type { ApiProductLabelFieldValue, ApiProductLabelValuesExtended, ApiQrTagPublic } from '@/api/gen/types.gen';

// La especificación declara `value` como objeto, pero el backend manda texto, listas, etc.
const c = (name: string, section: string, value: unknown) => ({ name, section, value }) as ApiProductLabelFieldValue;

/**
 * Producto de ejemplo, ficticio, para desarrollar y probar la vitrina sin backend.
 * La cooperativa, las personas y las cifras son inventadas.
 */
export const ETIQUETA_DEMO = 'demo';
export const QR_DEMO = 'QR-DEMO-2026';

const TEXTO_PRIVACIDAD = '<p>Este es un texto de ejemplo. La política real la define cada empresa desde su panel.</p><ul><li>Solo usamos tu correo para responderte.</li><li>No compartimos tus datos.</li></ul>';

export const etiqueta: ApiProductLabelValuesExtended = {
  id: 1,
  productId: 1,
  status: 'PUBLISHED',
  uuid: ETIQUETA_DEMO,
  title: 'Café Altos de la Sierra',
  language: 'ES',
  numberOfBatches: 3,
  fields: [
    c('name', 'product', 'Café Altos de la Sierra'),
    c('settings.language', 'settings', 'ES'),
    c('journeyMarkers', 'journey', [
      { latitude: 15.47, longitude: -91.62 },
      { latitude: 14.84, longitude: -91.52 },
      { latitude: 14.63, longitude: -90.51 },
      { latitude: 15.73, longitude: -88.6 },
    ]),
    c(
      'comparisonOfPrice.description',
      'pricing',
      '<p>Los productores de la cooperativa reciben un <strong>precio por encima del mercado</strong> gracias a la venta directa y a la calidad de su café.</p>',
    ),
    c('settings.incomeIncreaseDescription', 'pricing', 'Vender como café de especialidad mejora el ingreso de cada familia productora.'),
    c('settings.gdprText', 'settings', 'Tus datos se tratan según la política de privacidad de la cooperativa.'),
    c('settings.termsOfUseText', 'settings', '<h2>Términos de uso</h2><p>Texto de ejemplo para la vitrina simulada.</p>'),
    c('settings.privacyPolicyText', 'settings', TEXTO_PRIVACIDAD),
    c('company.mediaLinks.facebook', 'company', 'https://facebook.com/'),
    c('company.mediaLinks.instagram', 'company', 'instagram.com/'),
    c('company.mediaLinks.other', 'company', 'javascript:alert(1)'), // debe descartarse
  ],
  businessToCustomerSettings: {
    primaryColor: '#2f5d3a',
    secondaryColor: '#c4793a',
    tertiaryColor: '#1f3527',
    quaternaryColor: '#2f5d3a',
    productTitleColor: '#f4ead8',
    headingColor: '#2f5d3a',
    textColor: '#2a2f2b',
    tabFairPrices: true,
    tabProducers: true,
    tabQuality: true,
    tabFeedback: true,
    orderFairPrices: 1,
    orderProducers: 2,
    orderQuality: 3,
    orderFeedback: 4,
    landingPageBackgroundImage: { storageKey: 'portada-fondo', name: 'fondo.svg' },
    headerBackgroundImage: { storageKey: 'cabecera', name: 'cabecera.svg' },
    graphicFairPrices: true,
    graphicIncreaseOfIncome: true,
    graphicQuality: true,
    graphicPriceToProducer: 'PER_KG',
    graphicFarmGatePrice: 'PERCENT_VALUE',
    manualFarmGatePrice: 3.5,
    manualProducerPrice: 5.2,
    containerSize: 69,
    worldMarket: 1.85,
    fairTrade: 1.4,
    averageRegionFarmGatePrice: 1.2,
  },
  videoMeetTheFarmers: { type: 'LINK', category: 'VIDEO', link: 'https://youtu.be/aqz-KE-bpKQ' },
  photosMeetTheFarmers: [
    { id: 11, type: 'FILE', category: 'MEET_THE_FARMER', name: 'María López', quote: 'Cuidamos cada mata como a la familia.', description: 'Productora desde 1998, 2 ha a 1.700 m.', document: { storageKey: 'foto-1', name: 'foto-1.svg' } },
    { id: 12, type: 'FILE', category: 'MEET_THE_FARMER', name: 'Don Pedro Ajcá', description: 'Socio fundador de la cooperativa.', document: { storageKey: 'foto-2', name: 'foto-2.svg' } },
    { id: 13, type: 'FILE', category: 'MEET_THE_FARMER', name: 'Grupo de mujeres', description: 'Secado y selección en el beneficio comunitario.', document: { storageKey: 'foto-3', name: 'foto-3.svg' } },
  ],
  productionRecords: [
    { id: 21, type: 'FILE', category: 'PRODUCTION_RECORD', name: 'Cosecha 2025–2026', document: { storageKey: 'registro-1', name: 'registro-1.svg' } },
    { id: 22, type: 'FILE', category: 'PRODUCTION_RECORD', name: 'Beneficio húmedo', document: { storageKey: 'registro-2', name: 'registro-2.svg' } },
  ],
};

export const qr: ApiQrTagPublic = {
  qrTag: QR_DEMO,
  orderId: 'PED-2026-0142',
  producerName: 'Cooperativa Flor de la Sierra',
  priceToProducer: 5.2,
  priceToFarmer: 3.5,
  cuppingScore: 86.5,
  cuppingFlavour: 'Chocolate con leche, naranja y panela; acidez brillante y final largo.',
  roastingProfile: 'Tueste medio, desarrollado para filtrado.',
  certificates: [
    { id: 1, type: 'Orgánico', validity: '31.12.2027', description: 'Certificación orgánica de la cooperativa.', certificate: { storageKey: 'cert-1', name: 'certificado-organico.pdf' } },
    { id: 2, type: 'Comercio justo', validity: '30.06.2027' },
  ],
  historyTimeline: {
    items: [
      { type: 'TRANSFER', name: 'Exportación', date: '2026-08-20', location: 'Puerto Santo Tomás de Castilla', latitude: 15.69, longitude: -88.62, iconType: 'SHIP' },
      { type: 'PROCESSING', name: 'Trillado y clasificación', date: '2026-07-28', location: 'Ciudad de Guatemala', latitude: 14.63, longitude: -90.51, iconType: 'WAREHOUSE', step: 2, steps: 2 },
      { type: 'PROCESSING', name: 'Beneficio húmedo', date: '2026-02-14', location: 'Huehuetenango', latitude: 15.32, longitude: -91.47, step: 1, steps: 2 },
    ],
  },
};
