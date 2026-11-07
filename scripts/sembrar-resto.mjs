// Segunda parte de la siembra sintética (después de sembrar-lleno.mjs), por la API, para que ninguna
// pantalla quede vacía:
//   · dos asociaciones de productores (empresas de ejemplo) asociadas al producto,
//   · productores con cultivo, certificaciones y asociación,
//   · catálogos de tipos y campos de evidencia y factores de conversión,
//   · base de conocimiento, acuerdos de datos y la etiqueta en el producto final.
// Las órdenes entre empresas y de clientes las crea sembrar-ordenes-ui.mjs (por la interfaz).
//
// Pensado para la COPIA AISLADA de desarrollo, nunca para una instancia institucional.
// Uso:
//   INATRACE_API=http://127.0.0.1:8381 INATRACE_USUARIO=… INATRACE_CLAVE=… node scripts/sembrar-resto.mjs
// Cada parte comprueba si ya está hecha: se puede correr más de una vez.

const API = process.env.INATRACE_API ?? 'http://127.0.0.1:8381';
const C = {
  empresa: Number(process.env.DEMO_EMPRESA ?? 1),
  cadena: Number(process.env.DEMO_CADENA ?? 1),
  producto: Number(process.env.DEMO_PRODUCTO ?? 1),
  cafe: Number(process.env.DEMO_TIPO_CAFE ?? 1),
  cereza: Number(process.env.DEMO_CEREZA ?? 3),
  pergamino: Number(process.env.DEMO_PERGAMINO ?? 4),
  oro: Number(process.env.DEMO_ORO ?? 5),
};

if (!process.env.INATRACE_USUARIO || !process.env.INATRACE_CLAVE) {
  console.error('Faltan INATRACE_USUARIO e INATRACE_CLAVE.');
  process.exit(1);
}

let cookies = '';
async function llamar(metodo, ruta, cuerpo) {
  const r = await fetch(API + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', Cookie: cookies }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const nuevas = r.headers.getSetCookie?.() ?? [];
  if (nuevas.length) cookies = nuevas.map((c) => c.split(';')[0]).join('; ');
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.status !== 'OK') throw new Error(`${metodo} ${ruta} → ${r.status} ${d.status ?? ''}: ${d.errorMessage ?? JSON.stringify(d).slice(0, 300)}`);
  return d.data;
}
const paso = (t) => console.log('·', t);
const fallas = [];
async function intentar(que, fn) {
  try {
    return await fn();
  } catch (e) {
    fallas.push(`${que}: ${e.message}`);
    return undefined;
  }
}
let semilla = Number(process.env.SEMILLA ?? 777);
const azar = () => ((semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const entero = (a, b) => Math.floor(a + azar() * (b - a + 1));
const uno = (l) => l[Math.floor(azar() * l.length)];
const items = (d) => d?.items ?? d ?? [];

await llamar('POST', '/api/user/login', { username: process.env.INATRACE_USUARIO, password: process.env.INATRACE_CLAVE });
paso('Sesión iniciada');

// ---------- 1. Asociaciones de productores ----------
const ASOCIACIONES = [
  { nombre: 'Asociación de Caficultores de Huehuetenango (ejemplo)', sigla: 'ACH', correo: 'contacto.ach@example.org' },
  { nombre: 'Red de Mujeres Cafetaleras de Atitlán (ejemplo)', sigla: 'RMCA', correo: 'contacto.rmca@example.org' },
];
const sede = (await llamar('GET', `/api/company/profile/${C.empresa}`)).headquarters;
const empresas = items(await llamar('GET', '/api/company/admin/list?limit=500'));
const idsAsoc = [];
for (const a of ASOCIACIONES) {
  let e = empresas.find((x) => x.name === a.nombre);
  if (!e) {
    const creada = await intentar('asociación', () => llamar('POST', '/api/company/create', { name: a.nombre, abbreviation: a.sigla, email: a.correo, headquarters: sede, valueChains: [{ id: C.cadena }] }));
    if (!creada) continue;
    e = { id: creada.id };
    await llamar('POST', '/api/company/execute/ACTIVATE_COMPANY', { companyId: e.id }).catch(() => undefined);
  }
  idsAsoc.push(e.id);
}
const producto = await llamar('GET', `/api/product/${C.producto}`);
const asociadas = producto.associatedCompanies ?? [];
const faltan = idsAsoc.filter((id) => !asociadas.some((x) => x.company?.id === id && x.type === 'ASSOCIATION'));
if (faltan.length) await intentar('asociaciones en el producto', () => llamar('PUT', '/api/product/', { ...producto, associatedCompanies: [...asociadas, ...faltan.map((id) => ({ company: { id }, type: 'ASSOCIATION' }))] }));
paso(`${idsAsoc.length} asociaciones (en el producto como ASSOCIATION)`);

// ---------- 2. Productores: cultivo, certificaciones y asociación ----------
const guatemala = items(await llamar('GET', '/api/common/countries?limit=500')).find((x) => x.code === 'GT');
const certTipos = items(await llamar('GET', '/api/chain/certification-type/active').catch(() => []));
const CERT_TEXTO = { ORGANIC: 'Producción orgánica', FAIRTRADE: 'Comercio justo', RAINFOREST: 'Rainforest Alliance' };
let enriquecidos = 0;
for (const tipo of ['FARMER', 'COLLECTOR']) {
  const lista = items(await llamar('GET', `/api/company/userCustomers/${C.empresa}/${tipo}?limit=1000`));
  for (const resumen of lista) {
    const p = await intentar('leer productor', () => llamar('GET', `/api/company/userCustomers/${resumen.id}`));
    if (!p) continue;
    const cambios = {};
    if (tipo === 'FARMER' && !(p.farm?.farmPlantInformationList ?? []).length) {
      const area = p.farm?.totalCultivatedArea || (p.plots ?? []).reduce((n, x) => n + (x.size ?? 0), 0) || 1;
      cambios.productTypes = [{ id: C.cafe }];
      cambios.farm = { ...(p.farm ?? {}), areaUnit: p.farm?.areaUnit ?? 'ha', totalCultivatedArea: area, farmPlantInformationList: [{ productType: { id: C.cafe }, plantCultivatedArea: area, numberOfPlants: Math.round(area * entero(3800, 5200)) }] };
    }
    if (tipo === 'FARMER' && !(p.certifications ?? []).length && certTipos.length && azar() < 0.55) {
      const t = uno(certTipos);
      cambios.certifications = [{ type: t.code, description: CERT_TEXTO[t.code] ?? t.label ?? t.code, validity: `${2027 + entero(0, 1)}-${String(entero(1, 12)).padStart(2, '0')}-28` }];
    }
    if (!(p.associations ?? []).length && idsAsoc.length && azar() < 0.7) cambios.associations = [{ company: { id: p.gender === 'FEMALE' && idsAsoc[1] ? idsAsoc[1] : idsAsoc[0] } }];
    if (!Object.keys(cambios).length) continue;
    // Sin país en la dirección el backend falla al guardar (NPE en CountryMapper): se completa.
    if (!p.location?.address?.country?.id) cambios.location = { ...(p.location ?? {}), address: { ...(p.location?.address ?? {}), country: guatemala } };
    if ((await intentar('editar productor', () => llamar('PUT', '/api/company/userCustomers/edit', { ...p, ...cambios }))) !== undefined) enriquecidos++;
  }
}
paso(`${enriquecidos} productores y acopiadores con cultivo, certificaciones o asociación`);

// ---------- 3. Catálogos de evidencias y factores de conversión ----------
const tiposEv = items(await llamar('GET', '/api/chain/processing-evidence-type/list?limit=500'));
const TIPOS_EV = [
  { code: 'FACTURA_COMPRA', label: 'Purchase invoice', es: 'Factura de compra', type: 'DOCUMENT', fairness: true },
  { code: 'FOTO_SECADO', label: 'Drying photo', es: 'Foto del secado', type: 'DOCUMENT', quality: true },
  { code: 'ANALISIS_CALIDAD', label: 'Quality analysis', es: 'Análisis de calidad (taza)', type: 'DOCUMENT', quality: true },
  { code: 'CERT_ORIGEN', label: 'Certificate of origin', es: 'Certificado de origen', type: 'DOCUMENT', provenance: true },
];
let nuevosEv = 0;
for (const t of TIPOS_EV) {
  if (tiposEv.some((x) => x.code === t.code)) continue;
  const ok = await intentar('tipo de evidencia', () =>
    llamar('PUT', '/api/chain/processing-evidence-type', { code: t.code, label: t.label, type: t.type, fairness: !!t.fairness, provenance: !!t.provenance, quality: !!t.quality, translations: [{ language: 'EN', label: t.label }, { language: 'ES', label: t.es }] }),
  );
  if (ok !== undefined) nuevosEv++;
}
const camposEv = items(await llamar('GET', '/api/chain/processing-evidence-field/list?limit=500'));
const CAMPOS_EV = [
  { fieldName: 'humedad', label: 'Moisture (%)', es: 'Humedad (%)', type: 'NUMBER' },
  { fieldName: 'puntaje_taza', label: 'Cupping score', es: 'Puntaje de taza', type: 'NUMBER' },
  { fieldName: 'variedad', label: 'Variety', es: 'Variedad', type: 'STRING' },
  { fieldName: 'fecha_cosecha', label: 'Harvest date', es: 'Fecha de cosecha', type: 'DATE' },
];
let nuevosCampos = 0;
for (const c of CAMPOS_EV) {
  if (camposEv.some((x) => x.fieldName === c.fieldName)) continue;
  const ok = await intentar('campo de evidencia', () => llamar('PUT', '/api/chain/processing-evidence-field', { fieldName: c.fieldName, label: c.label, type: c.type, translations: [{ language: 'EN', label: c.label }, { language: 'ES', label: c.es }] }));
  if (ok !== undefined) nuevosCampos++;
}
const factores = items(await llamar('GET', '/api/chain/conversion/factors?limit=500').catch(() => []));
const FACTORES = [
  { entrada: C.cereza, salida: C.pergamino, factor: 0.2, notas: 'Beneficiado húmedo: unas 5 libras de cereza por libra de pergamino.' },
  { entrada: C.pergamino, salida: C.oro, factor: 0.8, notas: 'Trillado: se pierde la cascarilla (cerca del 20 %).' },
];
let nuevosFactores = 0;
for (const f of FACTORES) {
  if (factores.some((x) => x.inputSemiProductId === f.entrada && x.outputSemiProductId === f.salida)) continue;
  const ok = await intentar('factor', () => llamar('PUT', '/api/chain/conversion/factors', { inputSemiProductId: f.entrada, outputSemiProductId: f.salida, factor: f.factor, notes: f.notas, enabled: true }));
  if (ok !== undefined) nuevosFactores++;
}
paso(`${nuevosEv} tipos de evidencia, ${nuevosCampos} campos de evidencia, ${nuevosFactores} factores de conversión`);

// ---------- 4. Base de conocimiento ----------
const blog = items(await llamar('GET', `/api/product/knowledgeBlog/list/${C.producto}?limit=100`).catch(() => []));
const ENTRADAS = [
  { type: 'FAIRNESS', title: 'Precio justo en la cosecha 2025/26', summary: 'Cómo se calculó el precio pagado a cada familia productora.', content: '<p>Este ciclo el precio de la cereza se fijó por encima del mercado local, con un premio adicional para el café de mujeres productoras. Las cifras de esta entrada son de ejemplo.</p>' },
  { type: 'QUALITY', title: 'Del beneficio a la taza', summary: 'Despulpado el mismo día, fermentación controlada y secado en patio.', content: '<p>Cada lote se cata antes de exportarse. El puntaje de taza y la humedad quedan registrados en la plataforma. Texto de ejemplo.</p>' },
  { type: 'PROVENANCE', title: 'Parcelas georreferenciadas', summary: 'Cada entrega viene de parcelas con polígono, listas para el reglamento europeo (EUDR).', content: '<p>Las parcelas de las familias productoras están dibujadas en el mapa y registradas en el AgStack Asset Registry. Texto de ejemplo.</p>' },
  { type: 'QUALITY', title: 'Variedades de altura', summary: 'Bourbon, Caturra y Catuaí entre 1.400 y 1.900 metros.', content: '<p>La altura y la sombra de los cafetales dan una maduración lenta. Texto de ejemplo.</p>' },
];
let nuevasEntradas = 0;
for (const e of ENTRADAS) {
  if (blog.some((x) => x.title === e.title)) continue;
  const antes = fallas.length;
  await intentar('entrada de conocimiento', () => llamar('POST', `/api/product/knowledgeBlog/${C.producto}`, { ...e, date: `2026-${String(entero(1, 10)).padStart(2, '0')}-${String(entero(1, 28)).padStart(2, '0')}`, documents: [] }));
  if (fallas.length === antes) nuevasEntradas++;
}
paso(`${nuevasEntradas} entradas en la base de conocimiento`);

// ---------- 5. Acuerdos de datos y etiqueta en el producto final ----------
const prod = await llamar('GET', `/api/product/${C.producto}`);
if (!(prod.dataSharingAgreements ?? []).length) {
  await intentar('acuerdos', () =>
    llamar('PUT', '/api/product/', {
      ...prod,
      dataSharingAgreements: [
        { description: 'Las asociaciones comparten con la exportadora los datos de entrega de sus socias y socios, solo para la trazabilidad del producto (ejemplo).' },
        { description: 'La ubicación de las parcelas se publica agregada por municipio; nunca el polígono ni el nombre de la familia (ejemplo).' },
      ],
    }),
  );
}
paso('Acuerdos de datos');
const etiquetas = (await llamar('GET', `/api/product/${C.producto}/labels`)) ?? [];
const finales = items(await llamar('GET', `/api/product/${C.producto}/finalProduct/list?limit=100`).catch(() => []));
let finalesConEtiqueta = 0;
for (const f of finales) {
  // La lista llega sin etiquetas: se consultan aparte.
  const ya = await llamar('GET', `/api/product/${C.producto}/finalProduct/${f.id}/labels`).catch(() => []);
  if ((ya ?? []).length || !etiquetas.length) continue;
  const ok = await intentar('producto final', () => llamar('PUT', `/api/product/${C.producto}/finalProduct`, { ...f, labels: etiquetas.filter((e) => e.status === 'PUBLISHED').map((e) => ({ id: e.id })) }));
  if (ok !== undefined) finalesConEtiqueta++;
}
paso(`${finalesConEtiqueta} productos finales con su etiqueta`);

// ---------- 6. Acción de pedido de producto final de la productora ----------
// Sin ella, su pantalla de pedidos de clientes no tiene plantilla y sus órdenes emitidas quedan vacías.
const bodega = Number(process.env.DEMO_INSTALACION_PROC ?? 6);
const productoFinal = Number(process.env.DEMO_PRODUCTO_FINAL ?? 1);
const accionesEmp = items(await llamar('GET', `/api/chain/processing-action/list/company/${C.empresa}?limit=500`));
if (!accionesEmp.some((a) => a.type === 'SHIPMENT' && a.finalProductAction)) {
  await intentar('acción de pedido', () =>
    llamar('PUT', '/api/chain/processing-action', {
      company: { id: C.empresa },
      name: 'Pedido de producto final',
      description: 'Pedido de un cliente: café oro en sacos de 60 kg (ejemplo).',
      type: 'SHIPMENT',
      prefix: 'PF',
      sortOrder: 41,
      language: 'ES',
      finalProductAction: true,
      inputFinalProduct: { id: productoFinal },
      outputFinalProduct: { id: productoFinal },
      supportedFacilities: [{ id: bodega }],
      valueChains: [{ id: C.cadena }],
      requiredDocumentTypes: [],
      requiredEvidenceFields: [],
      translations: [
        { language: 'EN', name: 'Final product order', description: 'Customer order: green coffee in 60 kg bags (example).' },
        { language: 'ES', name: 'Pedido de producto final', description: 'Pedido de un cliente: café oro en sacos de 60 kg (ejemplo).' },
      ],
    }),
  );
  paso('Acción de pedido de producto final de la productora');
}
// Y alguien a quien pedírselo: la bodega de la exportadora también vende el producto final.
const exportadora = items(await llamar('GET', '/api/company/admin/list?limit=500')).find((x) => x.name === 'Exportadora Demo (v2)');
if (exportadora) {
  for (const f of items(await llamar('GET', `/api/chain/facility/list/company/${exportadora.id}?limit=50`))) {
    const d = await llamar('GET', `/api/chain/facility/${f.id}/detail`);
    if (!(d.facilityFinalProducts ?? []).some((x) => x.id === productoFinal) || !d.isPublic) {
      await intentar('bodega de la exportadora', () => llamar('PUT', '/api/chain/facility', { ...d, isPublic: true, facilityFinalProducts: [...(d.facilityFinalProducts ?? []).filter((x) => x.id !== productoFinal), { id: productoFinal }] }));
    }
  }
}
// El backend ofrece vendedoras solo a quien es BUYER o EXPORTER en el producto: la productora pasa a
// ser también compradora (le pide café oro a la exportadora para sus clientes).
const prodRoles = await llamar('GET', `/api/product/${C.producto}`);
if (!(prodRoles.associatedCompanies ?? []).some((x) => x.company?.id === C.empresa && x.type === 'BUYER')) {
  await intentar('rol de compradora', () => llamar('PUT', '/api/product/', { ...prodRoles, associatedCompanies: [...(prodRoles.associatedCompanies ?? []), { company: { id: C.empresa }, type: 'BUYER' }] }));
}
const vende = items(await llamar('GET', `/api/chain/facility/list/company/${C.empresa}/available-selling?finalProductId=${productoFinal}&limit=50`).catch(() => []));
paso(`La productora puede pedir el producto final a: ${vende.map((f) => f.name).join(', ') || 'ninguna instalación'}`);

if (fallas.length) {
  console.log(`\n${fallas.length} operaciones fallaron (las primeras):`);
  for (const f of [...new Set(fallas)].slice(0, 12)) console.log('  -', f);
}
