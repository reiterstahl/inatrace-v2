// Carga fotos y video de demostración en la etiqueta sembrada por sembrar-demo.mjs.
// Lee scripts/medios-demo.json (fotos con licencia libre de Wikimedia Commons; ver
// docs/CREDITOS-DEMO.md), las sube como documentos, las agrega a la empresa con su categoría,
// las activa en la etiqueta y usa dos de ellas como fondo de portada y de encabezado.
//
// Solo para instancias de prueba. Uso:
//   INATRACE_API=… INATRACE_USUARIO=… INATRACE_CLAVE=… DEMO_ETIQUETA_ID=1 node scripts/sembrar-medios.mjs
import { readFile } from 'node:fs/promises';

const API = process.env.INATRACE_API ?? 'http://127.0.0.1:8381';
const EMPRESA = Number(process.env.DEMO_EMPRESA ?? 1);
const ETIQUETA = Number(process.env.DEMO_ETIQUETA_ID ?? 1);
const UA = 'inatrace-v2-demo/0.1 (reiterstahl@gmail.com)';
// Los documentos creados por este script se reconocen por su crédito (o por el enlace del video),
// para reemplazarlos en vez de duplicarlos. Versiones anteriores usaban la marca "[demo v2]".
const esDemo = (d, video) => /Wikimedia Commons|\[demo v2\]/.test(d.description ?? '') || d.link === video.link;

if (!process.env.INATRACE_USUARIO || !process.env.INATRACE_CLAVE) {
  console.error('Faltan INATRACE_USUARIO e INATRACE_CLAVE.');
  process.exit(1);
}

let cookies = '';
async function llamar(metodo, ruta, cuerpo, esFormulario = false) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { ...(esFormulario ? {} : { 'Content-Type': 'application/json' }), Cookie: cookies },
    body: cuerpo === undefined ? undefined : esFormulario ? cuerpo : JSON.stringify(cuerpo),
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

const { video, medios } = JSON.parse(await readFile(new URL('./medios-demo.json', import.meta.url), 'utf8'));
await llamar('POST', '/api/user/login', { username: process.env.INATRACE_USUARIO, password: process.env.INATRACE_CLAVE });
paso('Sesión iniciada');

// ---------- 1. Subir cada foto una sola vez ----------
const subidos = new Map(); // archivo → ApiDocument
for (const m of medios) {
  if (subidos.has(m.archivo)) continue;
  const r = await fetch(m.url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`No se pudo bajar ${m.url} (${r.status})`);
  const datos = new FormData();
  datos.append('file', new Blob([await r.arrayBuffer()], { type: 'image/jpeg' }), `${m.archivo}.jpg`);
  subidos.set(m.archivo, await llamar('POST', '/api/common/document', datos, true));
  paso(`Foto subida: ${m.archivo}`);
}
const credito = (m) => `Foto: ${m.autor} · ${m.licencia} · Wikimedia Commons`;

// ---------- 2. Documentos de la empresa (se reemplazan los de demostraciones anteriores) ----------
const empresa = await llamar('GET', `/api/company/profile/${EMPRESA}`);
const propios = (empresa.documents ?? []).filter((d) => !esDemo(d, video));
const nuevos = [
  ...medios
    .filter((m) => m.uso === 'MEET_THE_FARMER' || m.uso === 'PRODUCTION_RECORD')
    .map((m) => ({
      type: 'FILE',
      category: m.uso,
      name: m.nombre,
      description: `${m.descripcion}\n${credito(m)}`,
      document: subidos.get(m.archivo),
    })),
  { type: 'LINK', category: 'VIDEO', name: video.nombre, description: video.fuente, link: video.link },
];
await llamar('PUT', '/api/company/profile', { ...empresa, documents: [...propios, ...nuevos] });
paso(`Empresa: ${nuevos.length} documentos de demostración`);

// ---------- 3. Activarlos en la etiqueta ----------
const disponibles = await llamar('GET', `/api/product/label/${ETIQUETA}/documents`);
const activos = disponibles.map((d) => ({ ...d, active: esDemo(d, video) }));
await llamar('PUT', `/api/product/label/${ETIQUETA}/documents`, activos);
paso(`Etiqueta: ${activos.filter((d) => d.active).length} documentos activos`);

// ---------- 4. Fondos de portada y encabezado ----------
const contenido = await llamar('GET', `/api/product/label/content/${ETIQUETA}`);
const fondo = (uso) => subidos.get(medios.find((m) => m.uso === uso)?.archivo);
contenido.businessToCustomerSettings = {
  ...contenido.businessToCustomerSettings,
  landingPageBackgroundImage: fondo('portada'),
  headerBackgroundImage: fondo('encabezado'),
};
await llamar('PUT', '/api/product/label/content', { ...contenido, labelId: ETIQUETA });
paso('Fondos de portada y encabezado asignados');
