import { test, expect, type Page } from '@playwright/test';
import { aceptarAviso } from '../e2e/avisos';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('combobox', { name: 'Empresa' }).selectOption({ label: 'Empresa Demo GIZ' });
}

type Respuesta = { status: string; data: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const json = async (r: Promise<{ json: () => Promise<unknown> }>) => (await (await r).json()) as Respuesta;

test('etiqueta: lotes con verificación pública, opiniones con datos privados y estadísticas', async ({ page, request }) => {
  test.setTimeout(180_000);
  await ingresar(page);
  const creado = await json(page.request.post('/api/product/create', {
    data: {
      name: 'Lotes E2E ' + Date.now().toString().slice(-6), description: 'Prueba de la v2.', company: { id: 1 }, valueChain: { id: 1 }, dataSharingAgreements: [],
      origin: { text: 'Huehuetenango.', locations: [{ latitude: 15.5, longitude: -91.6, pinName: 'Finca' }] },
      process: { production: 'Lavado.' }, responsibility: { laborPolicies: 'Pago justo.' }, sustainability: { production: 'Bajo sombra.' }, settings: { language: 'ES' },
    },
  }));
  const producto = creado.data.id as number;
  const etiqueta = (await json(page.request.post('/api/product/label/create', { data: { productId: producto, title: 'Etiqueta de lotes', language: 'ES', fields: [] } }))).data.id as number;
  await page.request.post('/api/product/label/execute/PUBLISH_LABEL', { data: { id: etiqueta } });
  const uuid = (await json(page.request.get(`/api/product/label/${etiqueta}`))).data.uuid as string;

  try {
    // 1. Lote con autenticidad y origen (los lugares del producto).
    await page.goto(`/v2/productos/${producto}/etiquetas/${etiqueta}/lotes`);
    await page.getByRole('button', { name: 'Nuevo lote' }).click();
    const form = page.getByRole('group', { name: 'Nuevo lote' });
    await form.getByRole('textbox', { name: 'Número de lote' }).fill('E2E01');
    await form.getByRole('checkbox', { name: /^Verificar autenticidad/ }).check();
    await form.getByLabel('Fecha de producción', { exact: true }).fill('2026-10-15');
    await form.getByRole('checkbox', { name: /^Rastrear origen/ }).check();
    await form.getByRole('button', { name: 'Usar los lugares del producto' }).click();
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Se guardó el lote E2E01.')).toBeVisible();
    const lotes = (await json(page.request.get(`/api/product/label/${etiqueta}/batches`))).data.items;
    expect(lotes).toHaveLength(1);
    expect(lotes[0]).toMatchObject({ number: 'E2E01', productionDate: '2026-10-15', checkAuthenticity: true, traceOrigin: true });
    expect(lotes[0].locations.map((l: { pinName: string }) => l.pinName)).toEqual(['Finca']);
    // El consumidor puede verificarlo sin sesión.
    const verificacion = await json(request.get(`/api/public/product/label/${uuid}/verify_batch_authenticity`, { params: { number: 'E2E01', productionDate: '2026-10-15' } }));
    expect(verificacion.data).toBe(true);

    // 2. Opiniones: la pública no entrega el correo (H24); la de la empresa, sí.
    await request.post(`/api/public/product/label/feedback/${uuid}`, {
      data: { type: 'PRAISE', feedback: 'Opinión de prueba E2E.', email: 'consumidora.e2e@example.com', gdprConsent: true, questionnaireAnswers: { age: '40', gender: 'Female' } },
    });
    const publica = JSON.stringify(await json(request.get(`/api/public/product/label/feedback/list/${uuid}`)));
    expect(publica).toContain('Opinión de prueba E2E.');
    expect(publica).not.toContain('consumidora.e2e@example.com');
    await page.getByRole('link', { name: 'Opiniones' }).click();
    const opinion = page.getByRole('listitem').filter({ hasText: 'Opinión de prueba E2E.' });
    await expect(opinion).toContainText('consumidora.e2e@example.com');
    await expect(opinion).toContainText('Con consentimiento');
    await expect(opinion).toContainText('40 años · Femenino');
    await aceptarAviso(page);
    await opinion.getByRole('button', { name: 'Borrar la opinión' }).click();
    await expect(page.getByText('Se borró la opinión.')).toBeVisible();

    // 3. Estadísticas: la página responde con los conteos del backend.
    await page.getByRole('link', { name: 'Estadísticas' }).click();
    await expect(page.getByRole('heading', { name: 'Visitas desde los QR' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Verificación de autenticidad' })).toContainText('Total');

    // 4. Borrar el lote.
    await page.getByRole('link', { name: 'Lotes' }).click();
    await aceptarAviso(page);
    await page.getByRole('button', { name: 'Borrar el lote E2E01' }).click();
    await expect(page.getByText('Se borró el lote E2E01.')).toBeVisible();
    expect((await json(page.request.get(`/api/product/label/${etiqueta}/batches`))).data.items).toEqual([]);
  } finally {
    await page.request.delete(`/api/product/${producto}`);
  }
});
