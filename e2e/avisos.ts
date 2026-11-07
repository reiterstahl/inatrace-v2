import type { Page } from '@playwright/test';

/**
 * Los avisos de la v2 son propios (Confirmar.tsx), no window.confirm: estas funciones los responden
 * como antes `page.once('dialog', …)`. Un aviso que nadie espera se cancela, igual que Playwright
 * descarta los diálogos nativos sin manejador.
 */
type Estado = { aceptar: number; siempre: boolean; cancelar: number; mensajes?: string[] };
const estados = new WeakMap<Page, Estado>();

async function preparar(page: Page): Promise<Estado> {
  let e = estados.get(page);
  if (e) return e;
  e = { aceptar: 0, siempre: false, cancelar: 0 };
  estados.set(page, e);
  const s = e;
  await page.addLocatorHandler(page.locator('dialog.aviso-modal[open]'), async (d) => {
    s.mensajes?.push(await d.locator('[data-mensaje]').innerText());
    if (s.cancelar > 0) {
      s.cancelar--;
      await d.locator('[data-aviso="cancelar"]').click();
    } else if (s.siempre || s.aceptar > 0) {
      if (!s.siempre) s.aceptar--;
      await d.locator('[data-aviso="aceptar"]').click();
    } else {
      await d.locator('[data-aviso="cancelar"], [data-aviso="aceptar"]').first().click();
    }
  });
  return e;
}

/** Acepta el próximo aviso (como `page.once('dialog', d => d.accept())`). */
export async function aceptarAviso(page: Page) {
  (await preparar(page)).aceptar++;
}

/** Acepta todos los avisos que vengan (como `page.on('dialog', d => d.accept())`). */
export async function aceptarAvisos(page: Page, mensajes?: string[]) {
  const e = await preparar(page);
  e.siempre = true;
  if (mensajes) e.mensajes = mensajes;
}

/** Cancela el próximo aviso (como `page.once('dialog', d => d.dismiss())`). */
export async function cancelarAviso(page: Page) {
  (await preparar(page)).cancelar++;
}
