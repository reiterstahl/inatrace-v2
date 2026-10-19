/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { msw } from 'msw/vite';
import { fileURLToPath } from 'node:url';

/**
 * La v2 vive bajo /v2/ y convive con la interfaz actual detrás del mismo proxy.
 * En desarrollo, Vite hace de ese proxy: /api va al backend real.
 * Con `--mode simulado` no hace falta backend: MSW responde con datos de ejemplo.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const simulado = mode === 'simulado';
  return {
    base: '/v2/',
    plugins: [react(), tailwindcss(), ...(simulado ? [msw()] : [])],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: 5173,
      proxy: simulado ? undefined : { '/api': { target: env.INATRACE_API || 'http://localhost:8081' } },
    },
    // El mapa (MapLibre, ~1 MB) va en su propio archivo y solo se baja al abrir el recorrido.
    build: { sourcemap: true, chunkSizeWarningLimit: 1100 },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/pruebas/preparar.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
