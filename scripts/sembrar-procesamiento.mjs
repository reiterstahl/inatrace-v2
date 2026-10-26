// Siembra dos acciones de procesamiento de demostración en una instancia de INATrace, por su API:
//   · "Trillado (demo)": procesamiento, de café pergamino a café oro/verde (rinde ~80 %),
//   · "Traslado (demo)": traslado de café oro/verde entre instalaciones.
// Sirven para probar la pantalla de procesamiento de la v2 contra el backend real.
//
// Pensado para la COPIA AISLADA de desarrollo, nunca para una instancia institucional.
// Uso:
//   INATRACE_API=http://127.0.0.1:8381 INATRACE_USUARIO=… INATRACE_CLAVE=… node scripts/sembrar-procesamiento.mjs
//
// Si una acción con el mismo nombre ya existe, no se vuelve a crear.

const API = process.env.INATRACE_API ?? 'http://127.0.0.1:8381';
const CONFIG = {
  empresa: Number(process.env.DEMO_EMPRESA ?? 1),
  cadena: Number(process.env.DEMO_CADENA ?? 1),
  instalacion: Number(process.env.DEMO_INSTALACION_PROC ?? 6),
  pergamino: Number(process.env.DEMO_PERGAMINO ?? 4),
  oro: Number(process.env.DEMO_ORO ?? 5),
};

if (!process.env.INATRACE_USUARIO || !process.env.INATRACE_CLAVE) {
  console.error('Faltan INATRACE_USUARIO e INATRACE_CLAVE.');
  process.exit(1);
}

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

await llamar('POST', '/api/user/login', { username: process.env.INATRACE_USUARIO, password: process.env.INATRACE_CLAVE });
paso('Sesión iniciada');

const existentes = (await llamar('GET', `/api/chain/processing-action/list/company/${CONFIG.empresa}?limit=500`)).items ?? [];
const comun = {
  company: { id: CONFIG.empresa },
  language: 'ES',
  valueChains: [{ id: CONFIG.cadena }],
  supportedFacilities: [{ id: CONFIG.instalacion }],
  requiredDocumentTypes: [],
  requiredEvidenceFields: [],
  finalProductAction: false,
};
const ACCIONES = [
  {
    ...comun,
    name: 'Trillado (demo)',
    description: 'Demostración para la v2: de pergamino a oro/verde.',
    type: 'PROCESSING',
    prefix: 'TR',
    sortOrder: 10,
    estimatedOutputQuantityPerUnit: 0.8,
    inputSemiProduct: { id: CONFIG.pergamino },
    outputSemiProducts: [{ id: CONFIG.oro }],
    translations: [
      { language: 'EN', name: 'Hulling (demo)', description: 'Demo for the v2: from parchment to green coffee.' },
      { language: 'ES', name: 'Trillado (demo)', description: 'Demostración para la v2: de pergamino a oro/verde.' },
    ],
  },
  {
    ...comun,
    name: 'Traslado (demo)',
    description: 'Demostración para la v2: traslado de café oro/verde.',
    type: 'TRANSFER',
    prefix: 'TL',
    sortOrder: 20,
    inputSemiProduct: { id: CONFIG.oro },
    outputSemiProducts: [{ id: CONFIG.oro }],
    translations: [
      { language: 'EN', name: 'Transfer (demo)', description: 'Demo for the v2: green coffee transfer.' },
      { language: 'ES', name: 'Traslado (demo)', description: 'Demostración para la v2: traslado de café oro/verde.' },
    ],
  },
];

for (const a of ACCIONES) {
  const ya = existentes.find((x) => a.translations.some((t) => t.name === x.name));
  if (ya) {
    paso(`"${a.name}" ya existe (id ${ya.id})`);
    continue;
  }
  const creada = await llamar('PUT', '/api/chain/processing-action', a);
  paso(`"${a.name}" creada (id ${creada.id})`);
}
