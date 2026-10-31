import { test, expect, type Page } from '@playwright/test';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('combobox', { name: 'Empresa' }).selectOption({ label: 'Empresa Demo GIZ' });
}

const json = async (r: Promise<{ json: () => Promise<unknown> }>) => (await (await r).json()) as { status: string; data: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

test('etiqueta: crear, elegir campos, vista previa, publicar en la vitrina, retirar y borrar', async ({ page, context }) => {
  test.setTimeout(180_000);
  await ingresar(page);
  const foto = await json(page.request.post('/api/common/image', { multipart: { file: { name: 'foto.png', mimeType: 'image/png', buffer: PNG } } }));
  const creado = await json(page.request.post('/api/product/create', {
    data: {
      name: 'Etiquetas E2E ' + Date.now().toString().slice(-6), description: 'Prueba de la v2.', company: { id: 1 }, valueChain: { id: 1 }, dataSharingAgreements: [], photo: foto.data,
      origin: { text: 'Huehuetenango.', locations: [{ latitude: 15.5, longitude: -91.6, pinName: 'Finca' }] },
      process: { production: 'Lavado y secado en patio.' }, responsibility: { laborPolicies: 'Pago justo.' }, sustainability: { production: 'Bajo sombra.' }, settings: { language: 'ES' },
    },
  }));
  expect(creado.status).toBe('OK');
  const producto = creado.data.id as number;

  try {
    // 1. Alta: la etiqueta arranca con la copia del producto.
    await page.goto(`/v2/productos/${producto}/etiquetas`);
    await page.getByRole('button', { name: 'Nueva etiqueta' }).click();
    await page.getByRole('textbox', { name: 'Nombre de la etiqueta' }).fill('Etiqueta E2E');
    await page.getByRole('button', { name: 'Crear etiqueta' }).click();
    await expect(page).toHaveURL(/etiquetas\/\d+$/);
    const id = Number(page.url().split('/').pop());
    const datos = page.getByRole('region', { name: 'Datos del producto' });
    await expect(datos.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue(/^Etiquetas E2E/);

    // 2. Contenido propio, un campo más a la vista y otro color.
    await datos.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Café de la etiqueta E2E');
    await page.getByRole('checkbox', { name: 'Mostrar en la vitrina: Cómo se produce' }).check();
    await page.getByRole('textbox', { name: 'Color primario', exact: true }).fill('#224466');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Etiqueta guardada.')).toBeVisible();
    const etiqueta = (await json(page.request.get(`/api/product/label/${id}`))).data;
    expect(etiqueta.title).toBe('Etiqueta E2E');
    expect(etiqueta.fields.find((f: { name: string }) => f.name === 'process.production').visible).toBe(true);
    expect(etiqueta.fields.find((f: { name: string }) => f.name === 'company.name').visible).toBe(false);
    const contenido = (await json(page.request.get(`/api/product/label/content/${id}`))).data;
    expect(contenido.name).toBe('Café de la etiqueta E2E');
    expect(contenido.businessToCustomerSettings.primaryColor).toBe('#224466');
    expect(contenido.origin.text).toBe('Huehuetenango.');
    // H23: la copia del backend pierde las políticas laborales (la v2 las completa al crear)…
    expect(contenido.responsibility.laborPolicies).toBe('Pago justo.');
    // …y no guarda lugares de origen en la etiqueta. Si esto falla, el backend ya lo corrigió:
    // quitar el aviso del editor y volver a exigir los lugares.
    expect(contenido.origin.locations ?? []).toHaveLength(0);
    // El producto no cambió.
    expect((await json(page.request.get(`/api/product/${producto}`))).data.name).toMatch(/^Etiquetas E2E/);

    // 3. Vista previa sin publicar (la vitrina pública todavía no la entrega).
    expect((await json(page.request.get(`/api/public/product/label/${etiqueta.uuid}`))).status).not.toBe('OK');
    const [previa] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Vista previa' }).click()]);
    await expect(previa.getByRole('status')).toContainText('Todavía no está publicada');
    await expect(previa.getByRole('heading', { level: 1, name: 'Café de la etiqueta E2E' })).toBeVisible();
    await previa.close();

    // 4. Publicar: la vitrina pública de la v2 la muestra con los campos elegidos.
    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('La etiqueta está publicada: sus QR abren la vitrina.')).toBeVisible();
    const publica = await json(page.request.get(`/api/public/product/label/${etiqueta.uuid}`));
    expect(publica.status).toBe('OK');
    const campos = publica.data.fields.map((f: { name: string }) => f.name);
    expect(campos).toContain('process.production');
    expect(campos).not.toContain('company.name');
    expect(publica.data.businessToCustomerSettings.primaryColor).toBe('#224466');
    const vitrina = await context.newPage();
    await vitrina.goto(`/v2/p-cd/${etiqueta.uuid}/EMPTY`);
    await expect(vitrina.getByRole('heading', { level: 1, name: 'Café de la etiqueta E2E' })).toBeVisible();
    await expect(vitrina.getByRole('status')).toHaveCount(0);
    await vitrina.close();

    // 5. Retirar y borrar.
    await page.getByRole('button', { name: 'Retirar de la vitrina' }).click();
    await expect(page.getByText('La etiqueta ya no se muestra en la vitrina.')).toBeVisible();
    expect((await json(page.request.get(`/api/public/product/label/${etiqueta.uuid}`))).status).not.toBe('OK');
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar etiqueta' }).click();
    await expect(page).toHaveURL(/etiquetas$/);
    expect((await json(page.request.get(`/api/product/${producto}/labels`))).data).toEqual([]);
  } finally {
    await page.request.delete(`/api/product/${producto}`);
  }
});
