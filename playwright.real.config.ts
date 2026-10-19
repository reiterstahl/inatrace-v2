import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas contra una instalación REAL en convivencia (proxy + interfaz actual + v2 + backend).
 * No levantan servidor: apuntan a INATRACE_URL. Ver e2e-real/README.md.
 */
export default defineConfig({
  testDir: 'e2e-real',
  workers: 1,
  reporter: 'list',
  use: { baseURL: process.env.INATRACE_URL ?? 'http://127.0.0.1:8390', trace: 'retain-on-failure', locale: 'es-ES' },
  projects: [{ name: 'real', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } } }],
});
