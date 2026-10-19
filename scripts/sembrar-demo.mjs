// Siembra datos de demostración para la vitrina en una instancia de INATrace, usando solo su API:
//   1. una acción de procesamiento "generar código QR",
//   2. un lote procesado con ella (de ahí sale el QR),
//   3. una etiqueta del producto, con contenido y ajustes B2C, publicada.
//
// Pensado para la COPIA AISLADA de desarrollo, nunca para una instancia institucional.
// Uso:
//   INATRACE_API=http://127.0.0.1:8381 INATRACE_USUARIO=… INATRACE_CLAVE=… node scripts/sembrar-demo.mjs
//
// Usa la empresa, el producto, el producto final, la instalación y una orden de compra que ya
// existan en esa instancia (los IDs se pueden cambiar con variables, ver CONFIG).

const API = process.env.INATRACE_API ?? 'http://127.0.0.1:8381';
const CONFIG = {
  empresa: Number(process.env.DEMO_EMPRESA ?? 1),
  producto: Number(process.env.DEMO_PRODUCTO ?? 1),
  productoFinal: Number(process.env.DEMO_PRODUCTO_FINAL ?? 1),
  cadena: Number(process.env.DEMO_CADENA ?? 1),
  instalacion: Number(process.env.DEMO_INSTALACION ?? 5),
  semiproducto: Number(process.env.DEMO_SEMIPRODUCTO ?? 3),
  ordenCompra: Number(process.env.DEMO_ORDEN ?? 1),
  cantidad: Number(process.env.DEMO_CANTIDAD ?? 60),
};
const TITULO_ETIQUETA = 'Vitrina v2 (demostración)';

if (!process.env.INATRACE_USUARIO || !process.env.INATRACE_CLAVE) {
  console.error('Faltan INATRACE_USUARIO e INATRACE_CLAVE.');
  process.exit(1);
}

// ---------- Cliente mínimo con cookies ----------
let cookies = '';
async function llamar(metodo, ruta, cuerpo) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const nuevas = r.headers.getSetCookie?.() ?? [];
  if (nuevas.length) cookies = nuevas.map((c) => c.split(';')[0]).join('; ');
  const datos = await r.json().catch(() => ({}));
  if (!r.ok || datos.status !== 'OK') {
    throw new Error(`${metodo} ${ruta} → ${r.status} ${datos.status ?? ''}: ${datos.errorMessage ?? JSON.stringify(datos).slice(0, 300)}`);
  }
  return datos.data;
}
const paso = (t) => console.log('·', t);

// ---------- 1. Sesión ----------
await llamar('POST', '/api/user/login', { username: process.env.INATRACE_USUARIO, password: process.env.INATRACE_CLAVE });
paso('Sesión iniciada');

// ---------- 2. Acción "generar QR" (se reutiliza si ya existe) ----------
const acciones = await llamar('GET', `/api/chain/processing-action/list/company/${CONFIG.empresa}?limit=500`);
let accion = (acciones.items ?? []).find((a) => a.type === 'GENERATE_QR_CODE');
if (!accion) {
  accion = await llamar('PUT', '/api/chain/processing-action', {
    company: { id: CONFIG.empresa },
    type: 'GENERATE_QR_CODE',
    prefix: 'QR',
    sortOrder: 99,
    inputSemiProduct: { id: CONFIG.semiproducto },
    qrCodeForFinalProduct: { id: CONFIG.productoFinal },
    publicTimelineLabel: 'Empaque y código QR',
    publicTimelineLocation: 'Huehuetenango',
    publicTimelineIconType: 'QRCODE',
    supportedFacilities: [{ id: CONFIG.instalacion }],
    valueChains: [{ id: CONFIG.cadena }],
    requiredEvidenceFields: [],
    requiredDocumentTypes: [],
    translations: [
      { language: 'EN', name: 'Generate QR code', description: 'Demo for the v2 public page' },
      { language: 'ES', name: 'Generar código QR', description: 'Demostración de la vitrina v2' },
    ],
  });
  paso(`Acción "generar QR" creada (#${accion.id})`);
} else {
  paso(`Acción "generar QR" existente (#${accion.id})`);
}

// ---------- 3. Lote procesado → QR ----------
const origen = await llamar('GET', `/api/chain/stock-order/${CONFIG.ordenCompra}`);
const hoy = new Date().toISOString().slice(0, 10);
const orden = await llamar('PUT', '/api/chain/processing-order', {
  processingAction: { id: accion.id },
  processingDate: hoy,
  inputTransactions: [
    {
      company: { id: CONFIG.empresa },
      sourceStockOrder: origen,
      semiProduct: { id: CONFIG.semiproducto },
      sourceFacility: { id: CONFIG.instalacion },
      status: 'EXECUTED',
      isProcessing: true,
      inputMeasureUnitType: origen.measureUnitType,
      inputQuantity: CONFIG.cantidad,
      outputQuantity: CONFIG.cantidad,
    },
  ],
  targetStockOrders: [
    {
      company: { id: CONFIG.empresa },
      facility: { id: CONFIG.instalacion },
      semiProduct: { id: CONFIG.semiproducto },
      measureUnitType: origen.measureUnitType,
      orderType: 'PROCESSING_ORDER',
      totalQuantity: CONFIG.cantidad,
      fulfilledQuantity: CONFIG.cantidad,
      availableQuantity: CONFIG.cantidad,
      productionDate: hoy,
      internalLotNumber: 'DEMO-V2',
    },
  ],
});
const proc = await llamar('GET', `/api/chain/processing-order/${orden.id}`);
const qr = proc.targetStockOrders?.[0]?.qrCodeTag;
if (!qr) throw new Error('El procesamiento no generó un código QR.');
paso(`Lote procesado (#${orden.id}) con QR ${qr}`);

// ---------- 4. Etiqueta del producto ----------
const etiquetas = await llamar('GET', `/api/product/${CONFIG.producto}/labels`);
let etiqueta = etiquetas.find((e) => e.title === TITULO_ETIQUETA);
const CAMPOS = [
  ['name', 'product'],
  ['settings.language', 'settings'],
  ['settings.gdprText', 'settings'],
  ['settings.termsOfUseText', 'settings'],
  ['settings.privacyPolicyText', 'settings'],
  ['settings.incomeIncreaseDescription', 'settings'],
  ['journeyMarkers', 'journey'],
  ['company.mediaLinks.facebook', 'company'],
  ['company.mediaLinks.instagram', 'company'],
].map(([name, section]) => ({ name, section, visible: true }));

if (!etiqueta) {
  const nueva = await llamar('POST', '/api/product/label/create', {
    productId: CONFIG.producto,
    title: TITULO_ETIQUETA,
    language: 'ES',
    status: 'UNPUBLISHED',
    fields: CAMPOS,
  });
  etiqueta = { id: nueva.id };
  paso(`Etiqueta creada (#${etiqueta.id})`);
} else {
  await llamar('PUT', '/api/product/label', { ...etiqueta, fields: CAMPOS });
  paso(`Etiqueta existente (#${etiqueta.id}), campos actualizados`);
}

// Contenido: se parte del actual y se completan textos, recorrido y ajustes B2C.
const contenido = await llamar('GET', `/api/product/label/content/${etiqueta.id}`);
contenido.name = 'Café de Guatemala — Origen Demo';
contenido.settings = {
  ...contenido.settings,
  language: 'ES',
  gdprText: 'Tus datos se usan solo para responder a tu comentario. Instancia de demostración.',
  termsOfUseText: '<p>Instancia de <strong>demostración</strong> de la vitrina v2 de INATrace.</p>',
  privacyPolicyText: '<p>Esta instancia no guarda datos reales.</p>',
  incomeIncreaseDescription: 'Vender como café de especialidad mejora el ingreso de las familias productoras.',
};
contenido.journeyMarkers = [
  { latitude: 15.32, longitude: -91.47 },
  { latitude: 14.63, longitude: -90.51 },
  { latitude: 15.69, longitude: -88.62 },
];
contenido.businessToCustomerSettings = {
  ...contenido.businessToCustomerSettings,
  primaryColor: '#7a4b2a',
  secondaryColor: '#d9a441',
  tertiaryColor: '#2b1d14',
  quaternaryColor: '#7a4b2a',
  productTitleColor: '#f6e7cf',
  headingColor: '#5b3720',
  textColor: '#2d2620',
  tabFairPrices: true,
  tabProducers: true,
  tabQuality: true,
  tabFeedback: true,
  orderFairPrices: 1,
  orderProducers: 2,
  orderQuality: 3,
  orderFeedback: 4,
  graphicPriceToProducer: 'PER_KG',
  graphicFarmGatePrice: 'PERCENT_VALUE',
  graphicQuality: true,
  manualProducerPrice: 5.4,
  manualFarmGatePrice: 3.6,
  containerSize: 69,
  worldMarket: 1.85,
  fairTrade: 1.4,
  averageRegionFarmGatePrice: 1.2,
};
await llamar('PUT', '/api/product/label/content', { ...contenido, labelId: etiqueta.id });
paso('Contenido y ajustes B2C guardados');

await llamar('POST', '/api/product/label/execute/PUBLISH_LABEL', { id: etiqueta.id }).catch(async (e) => {
  // Algunas versiones publican cambiando el estado de la etiqueta.
  paso(`(publicación por acción no disponible: ${e.message.slice(0, 80)}…; se cambia el estado)`);
  const actual = (await llamar('GET', `/api/product/${CONFIG.producto}/labels`)).find((x) => x.id === etiqueta.id);
  await llamar('PUT', '/api/product/label', { ...actual, status: 'PUBLISHED', fields: CAMPOS });
});
const publicada = (await llamar('GET', `/api/product/${CONFIG.producto}/labels`)).find((x) => x.id === etiqueta.id);
paso(`Etiqueta ${publicada.status} · uuid ${publicada.uuid}`);

console.log(`\nVitrina v2:      /v2/p-cd/${publicada.uuid}/${qr}`);
console.log(`Versión actual:  /p-cd/${publicada.uuid}/${qr}`);
