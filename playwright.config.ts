import { defineConfig, devices } from '@playwright/test';

const PUERTO = 5180;

/** Pruebas de punta a punta sobre el modo simulado (MSW): no necesitan backend. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO}/v2/`,
    trace: 'retain-on-failure',
    locale: 'es-ES',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm dev:simulado --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}/v2/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
