// Baja la especificación OpenAPI del backend en marcha y la guarda en api/openapi.json.
// Uso: INATRACE_API=http://localhost:8081 pnpm api:actualizar
import { writeFile } from 'node:fs/promises';

const base = process.env.INATRACE_API || 'http://localhost:8081';
const r = await fetch(base + '/v3/api-docs');
if (!r.ok) {
  console.error(`No se pudo leer ${base}/v3/api-docs (${r.status})`);
  process.exit(1);
}
const spec = await r.json();
// Las rutas ya empiezan con /api: el cliente usa el mismo origen, sin servidor fijo.
spec.servers = [{ url: '/' }];
await writeFile('api/openapi.json', JSON.stringify(spec, null, 1) + '\n');
console.log(`api/openapi.json actualizado: ${Object.keys(spec.paths).length} rutas.`);
