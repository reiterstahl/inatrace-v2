import { defineConfig } from '@hey-api/openapi-ts';

// El cliente se genera desde api/openapi.json, una copia fijada de la especificación del
// backend. Se actualiza con `pnpm api:actualizar` (ver scripts/actualizar-api.mjs).
export default defineConfig({
  input: './api/openapi.json',
  output: 'src/api/gen',
  plugins: [
    '@hey-api/typescript',
    '@hey-api/sdk',
    {
      name: '@hey-api/client-fetch',
      // La configuración real (URL base, cookies, renovación de sesión) vive en src/api/cliente.ts.
      runtimeConfigPath: './src/api/cliente-config',
    },
  ],
});
