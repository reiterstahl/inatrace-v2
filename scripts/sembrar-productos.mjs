// Prepara la empresa demo para probar los productos (fase 5) contra el backend real: le asigna la
// cadena de valor de café, sin la cual no se puede crear un producto (pasa igual en la versión actual).
//
// Pensado para la COPIA AISLADA de desarrollo, nunca para una instancia institucional.
// Uso:
//   INATRACE_API=http://127.0.0.1:8381 INATRACE_USUARIO=… INATRACE_CLAVE=… node scripts/sembrar-productos.mjs
//
// Si ya la tiene, no cambia nada.

const API = process.env.INATRACE_API ?? 'http://127.0.0.1:8381';
const EMPRESA = Number(process.env.DEMO_EMPRESA ?? 1);
const CADENA = Number(process.env.DEMO_CADENA ?? 1);

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

await llamar('POST', '/api/user/login', { username: process.env.INATRACE_USUARIO, password: process.env.INATRACE_CLAVE });
const perfil = await llamar('GET', `/api/company/profile/${EMPRESA}`);
if ((perfil.valueChains ?? []).some((v) => v.id === CADENA)) {
  console.log(`· "${perfil.name}" ya tiene la cadena de valor ${CADENA}`);
} else {
  await llamar('PUT', '/api/company/profile', { ...perfil, valueChains: [...(perfil.valueChains ?? []), { id: CADENA }] });
  const despues = await llamar('GET', `/api/company/profile/${EMPRESA}`);
  console.log(`· Cadenas de valor de "${despues.name}": ${(despues.valueChains ?? []).map((v) => v.name).join(', ')}`);
}
