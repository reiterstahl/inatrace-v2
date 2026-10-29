// Siembra lo necesario para probar las órdenes entre empresas (fase 3e) contra el backend real:
//   1. una segunda empresa, "Exportadora Demo (v2)", con el usuario de la siembra inscrito,
//   2. la cadena de valor y una bodega para esa empresa, que maneja café oro/verde,
//   3. en el producto, la empresa demo como PRODUCTORA y la nueva como EXPORTADORA (así la
//      exportadora ve las instalaciones públicas de la productora y le puede pedir café),
//   4. una acción de envío (pedido de cotización) de café oro/verde para la exportadora.
//
// Pensado para la COPIA AISLADA de desarrollo, nunca para una instancia institucional.
// Uso:
//   INATRACE_API=http://127.0.0.1:8381 INATRACE_USUARIO=… INATRACE_CLAVE=… node scripts/sembrar-ordenes.mjs
//
// Si algo ya existe, no se vuelve a crear.

const API = process.env.INATRACE_API ?? 'http://127.0.0.1:8381';
const CONFIG = {
  productora: Number(process.env.DEMO_EMPRESA ?? 1),
  producto: Number(process.env.DEMO_PRODUCTO ?? 1),
  cadena: Number(process.env.DEMO_CADENA ?? 1),
  oro: Number(process.env.DEMO_ORO ?? 5),
  modelo: Number(process.env.DEMO_INSTALACION_PROC ?? 6), // instalación pública de la productora que se usa de modelo
};
const NOMBRE = 'Exportadora Demo (v2)';
const BODEGA = 'Bodega de exportación (v2)';

if (!process.env.INATRACE_USUARIO || !process.env.INATRACE_CLAVE) {
  console.error('Faltan INATRACE_USUARIO e INATRACE_CLAVE.');
  process.exit(1);
}

let cookies = '';
async function llamar(metodo, ruta, cuerpo) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Cookie: cookies, language: 'ES' },
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

await llamar('POST', '/api/user/login', { username: process.env.INATRACE_USUARIO, password: process.env.INATRACE_CLAVE });
const yo = await llamar('GET', '/api/user/profile');
paso(`Sesión iniciada (usuario ${yo.id})`);

// ---------- 1. Empresa exportadora ----------
const empresas = (await llamar('GET', '/api/company/admin/list?limit=500')).items ?? [];
let exportadora = empresas.find((c) => c.name === NOMBRE);
if (!exportadora) {
  const productora = await llamar('GET', `/api/company/profile/${CONFIG.productora}`);
  const creada = await llamar('POST', '/api/company/create', {
    name: NOMBRE,
    abbreviation: 'EXPV2',
    email: 'exportadora@inatrace.local',
    headquarters: productora.headquarters,
    valueChains: [{ id: CONFIG.cadena }],
  });
  exportadora = { id: creada.id, name: NOMBRE };
  paso(`Empresa "${NOMBRE}" creada (id ${creada.id})`);
} else {
  paso(`Empresa "${NOMBRE}" ya existe (id ${exportadora.id})`);
}

// El usuario de la siembra tiene que estar inscrito para operar como la exportadora (quien crea
// la empresa queda inscrito solo; el backend responde "User already exists").
try {
  await llamar('POST', '/api/company/execute/ADD_USER_TO_COMPANY', { companyId: exportadora.id, userId: yo.id, companyUserRole: 'COMPANY_ADMIN' });
  paso('Usuario inscrito en la exportadora como administrador');
} catch (e) {
  if (!String(e.message).includes('User already exists')) throw e;
  paso('El usuario ya está inscrito en la exportadora');
}

// La empresa recién creada puede quedar inactiva: se activa.
await llamar('POST', '/api/company/execute/ACTIVATE_COMPANY', { companyId: exportadora.id }).catch(() => undefined);

// ---------- 2. Cadena de valor y bodega ----------
const perfil = await llamar('GET', `/api/company/profile/${exportadora.id}`);
if (!(perfil.valueChains ?? []).some((v) => v.id === CONFIG.cadena)) {
  await llamar('PUT', '/api/company/profile', { ...perfil, valueChains: [...(perfil.valueChains ?? []), { id: CONFIG.cadena }] });
  paso('Cadena de valor asociada a la exportadora');
}

const instalaciones = (await llamar('GET', `/api/chain/facility/list/company/${exportadora.id}?limit=500`)).items ?? [];
let bodega = instalaciones.find((f) => f.name === BODEGA);
if (!bodega) {
  const modelo = await llamar('GET', `/api/chain/facility/${CONFIG.modelo}`);
  const creada = await llamar('PUT', '/api/chain/facility', {
    name: BODEGA,
    company: { id: exportadora.id },
    facilityType: modelo.facilityType,
    facilityLocation: modelo.facilityLocation,
    isCollectionFacility: false,
    isPublic: false,
    facilitySemiProductList: [{ id: CONFIG.oro }],
    facilityFinalProducts: [],
    facilityValueChains: [{ id: CONFIG.cadena }],
    translations: [
      { language: 'EN', name: 'Export warehouse (v2)' },
      { language: 'ES', name: BODEGA },
    ],
  });
  bodega = { id: creada.id, name: BODEGA };
  paso(`Bodega "${BODEGA}" creada (id ${creada.id})`);
} else {
  paso(`Bodega "${BODEGA}" ya existe (id ${bodega.id})`);
}

// ---------- 3. Roles en el producto ----------
const producto = await llamar('GET', `/api/product/${CONFIG.producto}`);
const asociadas = producto.associatedCompanies ?? [];
const falta = (empresa, tipo) => !asociadas.some((a) => a.company?.id === empresa && a.type === tipo);
const nuevas = [
  ...(falta(CONFIG.productora, 'PRODUCER') ? [{ company: { id: CONFIG.productora }, type: 'PRODUCER' }] : []),
  ...(falta(exportadora.id, 'EXPORTER') ? [{ company: { id: exportadora.id }, type: 'EXPORTER' }] : []),
];
if (nuevas.length) {
  await llamar('PUT', '/api/product/', { ...producto, associatedCompanies: [...asociadas, ...nuevas] });
  paso(`Roles en el producto: ${nuevas.map((n) => `${n.company.id}=${n.type}`).join(', ')}`);
} else {
  paso('Los roles en el producto ya están');
}

// ---------- 4. Acción de envío (pedido de cotización) ----------
const acciones = (await llamar('GET', `/api/chain/processing-action/list/company/${exportadora.id}?limit=500`)).items ?? [];
if (!acciones.some((a) => a.type === 'SHIPMENT')) {
  const creada = await llamar('PUT', '/api/chain/processing-action', {
    company: { id: exportadora.id },
    name: 'Pedido de café oro (demo)',
    description: 'Demostración para la v2: pedido de cotización a la productora.',
    type: 'SHIPMENT',
    prefix: 'PO',
    sortOrder: 40,
    language: 'ES',
    finalProductAction: false,
    inputSemiProduct: { id: CONFIG.oro },
    outputSemiProducts: [{ id: CONFIG.oro }],
    supportedFacilities: [{ id: bodega.id }],
    valueChains: [{ id: CONFIG.cadena }],
    requiredDocumentTypes: [],
    requiredEvidenceFields: [],
    translations: [
      { language: 'EN', name: 'Green coffee order (demo)', description: 'Demo for the v2: quote order to the producer.' },
      { language: 'ES', name: 'Pedido de café oro (demo)', description: 'Demostración para la v2: pedido de cotización a la productora.' },
    ],
  });
  paso(`Acción de envío creada (id ${creada.id})`);
} else {
  paso('La acción de envío ya existe');
}

const vendedoras = (await llamar('GET', `/api/chain/facility/list/company/${exportadora.id}/available-selling?semiProductId=${CONFIG.oro}&limit=50`)).items ?? [];
paso(`Instalaciones a las que la exportadora puede pedir café oro: ${vendedoras.map((f) => `${f.name} (${f.id})`).join(', ') || 'ninguna'}`);
