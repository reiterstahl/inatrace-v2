import { test as base } from '@playwright/test';

/** Sin internet en las pruebas: el mapa y el video externos se cortan para que todo sea determinista. */
export const test = base.extend({
  page: async ({ page }, usar) => {
    await page.route(/tiles\.openfreemap\.org|youtube-nocookie\.com/, (r) => r.abort());
    await usar(page);
  },
});
export { expect } from '@playwright/test';

export const VITRINA = 'p-cd/demo/QR-DEMO-2026';
