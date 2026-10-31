// Habilita Beyco en la empresa demo para probar la exportación (fase 3e.3) contra el backend real.
// Sin una cuenta de Beyco, lo que se puede probar de verdad es la precarga de la oferta (el backend
// la arma desde los lotes) y que el cambio del código por el token falla limpio.
//
// Pensado para la COPIA AISLADA de desarrollo, nunca para una instancia institucional.
// Uso:
//   INATRACE_API=http://127.0.0.1:8381 INATRACE_USUARIO=… INATRACE_CLAVE=… node scripts/sembrar-beyco.mjs
//
// Si ya está habilitado, no cambia nada.

const API = process.env.INATRACE_API ?? 'http://127.0.0.1:8381';
const EMPRESA = Number(process.env.DEMO_EMPRESA ?? 1);

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
if (perfil.allowBeycoIntegration) {
  console.log(`· Beyco ya está habilitado en "${perfil.name}"`);
} else {
  await llamar('PUT', '/api/company/profile', { ...perfil, allowBeycoIntegration: true });
  const despues = await llamar('GET', `/api/company/profile/${EMPRESA}`);
  console.log(`· Beyco habilitado en "${despues.name}": ${despues.allowBeycoIntegration}`);
}
