// Arma de/rw de la vitrina reutilizando las traducciones de la interfaz actual (Angular), en
// vez de inventarlas. Lo que no está traducido allá (o quedó igual al inglés) no se copia: la
// app cae al inglés. Uso: ANGULAR_LOCALE=../ruta/frontend/src/assets/locale pnpm i18n:importar
import { readFile, writeFile } from 'node:fs/promises';

const origen = process.env.ANGULAR_LOCALE || '../giz/inatrace-dap/frontend/src/assets/locale';

// clave v2 → [clave Angular, { marcador Angular: variable v2 }]
const MAPA = {
  'vitrina.pestanas.journey': ['frontPage.header.tab.journey'],
  'vitrina.pestanas.fair-prices': ['frontPage.header.tab.fair-prices'],
  'vitrina.pestanas.producers': ['frontPage.header.tab.producers'],
  'vitrina.pestanas.quality': ['frontPage.header.tab.quality'],
  'vitrina.pestanas.feedback': ['frontPage.header.tab.feedback'],
  'vitrina.ver_recorrido': ['front-page.button.productJourney'],
  'vitrina.recorrido.titulo': ['frontPage.journey.title'],
  'vitrina.recorrido.tu_escaneo': ['frontPage.journey.yourScan'],
  'vitrina.recorrido.cosecha': ['frontPage.journey.harvesting'],
  'vitrina.recorrido.productores_de': ['frontPage.journey.farmersFromCooperative', { INTERPOLATION: 'nombre' }],
  'vitrina.precios.titulo': ['frontPage.fair-prices.title'],
  'vitrina.precios.pedido': ['front-page.fair-prices.paragraph1', { INTERPOLATION: 'pedido', UNIT: 'unidad' }],
  'vitrina.precios.mercado_mundial': ['frontPage.fair-prices.barChart.label1'],
  'vitrina.precios.fairtrade': ['frontPage.fair-prices.barChart.label2'],
  'vitrina.precios.pagado_como': ['frontPage.fair-prices.barChart.label1Farmers', { INTERPOLATION: 'producto' }],
  'vitrina.precios.promedio_sin': ['frontPage.fair-prices.barChart.label2Farmers', { INTERPOLATION: 'producto' }],
  'vitrina.precios.unidad.PER_CONTAINER': ['productLabel.b2c.price.unit.container'],
  'vitrina.precios.unidad.PER_KG': ['productLabel.b2c.price.unit.kg'],
  'vitrina.precios.unidad.PERCENT_VALUE': ['productLabel.b2c.price.unit.percentValue'],
  'vitrina.productores.titulo': ['frontPage.producers.title.meetFarmers'],
  'vitrina.calidad.titulo': ['frontPage.quality.title'],
  'vitrina.calidad.puntos': ['frontPage.quality.chart.label2', { PH: 'puntos' }],
  'vitrina.calidad.referencia': ['frontPage.quality.chart.label1'],
  'vitrina.calidad.perfil_sabor': ['frontPage.quality.flavourProfile'],
  'vitrina.calidad.perfil_tueste': ['frontPage.quality.roastingProfile'],
  'vitrina.calidad.certificados': ['frontPage.quality.certificates'],
  'vitrina.calidad.descargar': ['frontPage.quality.cert.button.download'],
  'vitrina.opinion.titulo': ['frontPage.feedback.title'],
  'vitrina.opinion.intro': ['frontPage.feedback.textinput.text.label', { INTERPOLATION: 'producto' }],
  'vitrina.opinion.comentario_largo': ['frontPage.feedback.textinput.feedback.errorMaxLength'],
  'vitrina.opinion.sabor': ['frontPage.feedback.taste', { INTERPOLATION: 'producto' }],
  'vitrina.opinion.sabores.Better': ['frontPage.feedback.tasteCodes.better'],
  'vitrina.opinion.sabores.Same': ['frontPage.feedback.tasteCodes.same'],
  'vitrina.opinion.sabores.Worse': ['frontPage.feedback.tasteCodes.worse'],
  'vitrina.opinion.edad': ['frontPage.feedback.textinput.age.label'],
  'vitrina.opinion.genero': ['frontPage.feedback.gender'],
  'vitrina.opinion.generos.Female': ['frontPage.feedback.ageCodes.female'],
  'vitrina.opinion.generos.Male': ['frontPage.feedback.ageCodes.male'],
  'vitrina.opinion.correo': ['frontPage.feedback.textinput.email.label'],
  'vitrina.opinion.correo_invalido': ['frontPage.feedback.textinput.email.error'],
  'vitrina.opinion.consentimiento_requerido': ['frontPage.feedback.checkbox-input.gdprConsent.error'],
  'vitrina.opinion.enviar': ['frontPage.feedback.button.submit'],
  'vitrina.opinion.gracias_titulo': ['frontPage.feedback.success.title'],
  'vitrina.opinion.gracias': ['frontPage.feedback.success.message'],
  'vitrina.opinion.error': ['frontPage.feedback.error.message'],
  'vitrina.opinion.tipos.PRAISE': ['frontPage.feedback.statusList.registred'],
  'vitrina.opinion.tipos.PROPOSAL': ['frontPage.feedback.statusList.active'],
  'vitrina.opinion.tipos.COMPLAINT': ['frontPage.feedback.statusList.deactivated'],
  'vitrina.legal.terminos': ['frontPage.terms.title'],
  'vitrina.legal.privacidad': ['frontPage.privacy.title'],
};

function convertir(texto, marcadores = {}) {
  let t = texto
    .replace(/\{\$(START|CLOSE)_TAG_[A-Z_]+\}/g, '') // etiquetas HTML de Angular
    .replace(/^\d+\.\s*/, '') // "1. ¿Cómo…" → la numeración la pone la interfaz
    .trim();
  const faltan = [];
  t = t.replace(/\{\$([A-Z_]+)\}/g, (_, m) => {
    if (marcadores[m]) return `{{${marcadores[m]}}}`;
    faltan.push(m);
    return '';
  });
  return faltan.length ? null : t;
}

function poner(obj, ruta, valor) {
  const partes = ruta.split('.');
  let o = obj;
  for (const p of partes.slice(0, -1)) o = o[p] ??= {};
  o[partes.at(-1)] = valor;
}

const en = JSON.parse(await readFile(`${origen}/en.json`, 'utf8')).translations;
for (const lengua of ['de', 'rw']) {
  const t = JSON.parse(await readFile(`${origen}/${lengua}.json`, 'utf8')).translations;
  const salida = {};
  let n = 0;
  for (const [clave, [angular, marcadores]] of Object.entries(MAPA)) {
    const v = t[angular];
    if (!v || v === en[angular]) continue; // sin traducir allá: que caiga al inglés
    const c = convertir(v, marcadores);
    if (!c) continue;
    poner(salida, clave, c);
    n++;
  }
  await writeFile(`src/i18n/textos/${lengua}.json`, JSON.stringify(salida, null, 2) + '\n');
  console.log(`${lengua}: ${n} de ${Object.keys(MAPA).length} textos importados de la interfaz actual.`);
}
