import { test, expect, type Page } from '@playwright/test';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Empresa' }).selectOption({ label: 'Empresa Demo GIZ' });
}

const api = async (page: Page, metodo: 'get' | 'post' | 'delete', ruta: string, data?: unknown) => (await page.request[metodo](ruta, data ? { data } : undefined)).json();

test('producto: vitrina y recorrido, empresas, acuerdos y productos finales contra el backend', async ({ page }) => {
  test.setTimeout(150_000);
  await ingresar(page);
  // Un producto de prueba creado por la API (la ficha ya tiene su propia prueba).
  const nombre = 'Partes E2E ' + Date.now().toString().slice(-6);
  const creado = await api(page, 'post', '/api/product/create', {
    name: nombre, description: 'Prueba de la v2.', company: { id: 1 }, valueChain: { id: 1 }, dataSharingAgreements: [],
    origin: { text: 'Huehuetenango.', locations: [{ latitude: 15.5, longitude: -91.6, pinName: 'Finca' }] },
    process: { production: 'Lavado.' }, responsibility: { laborPolicies: 'Pago justo.' }, sustainability: { production: 'Bajo sombra.' }, settings: { language: 'ES' },
  });
  expect(creado.status).toBe('OK');
  const id = creado.data.id as number;
  const producto = async () => (await api(page, 'get', `/api/product/${id}`)).data;

  try {
    // 1. Vitrina y recorrido.
    await page.goto(`/v2/productos/${id}/vitrina`);
    await page.getByRole('textbox', { name: 'Color primario', exact: true }).fill('#123456');
    await page.getByRole('checkbox', { name: 'Calidad', exact: true }).check();
    await page.getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: 'Calidad', exact: true }) }).getByRole('textbox', { name: 'Posición' }).fill('3');
    await page.getByRole('combobox', { name: 'Gráfico del precio en finca' }).selectOption({ label: 'Por kg' });
    const mapa = page.getByRole('application', { name: 'Mapa del recorrido' });
    await mapa.click({ position: { x: 150, y: 120 } });
    await mapa.click({ position: { x: 300, y: 200 } });
    await expect(page.getByRole('listitem', { name: 'Parada 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Producto guardado.')).toBeVisible();
    const p1 = await producto();
    expect(p1.businessToCustomerSettings).toMatchObject({ primaryColor: '#123456', tabQuality: true, orderQuality: 3, graphicFarmGatePrice: 'PER_KG' });
    expect(p1.journeyMarkers).toHaveLength(2);
    // Lo de la ficha no se tocó (el backend reescribe todo lo que recibe).
    expect(p1.origin.text).toBe('Huehuetenango.');
    expect(p1.origin.locations).toHaveLength(1);
    expect(p1.process.production).toBe('Lavado.');

    // 2. Empresas (la cuenta de prueba es administración del sistema).
    await page.getByRole('link', { name: 'Empresas' }).click();
    await page.getByRole('combobox', { name: 'Como' }).selectOption({ label: 'Compradoras' });
    await page.getByRole('searchbox', { name: 'Empresa' }).fill('Exportadora Demo');
    await page.getByRole('list', { name: 'Empresas encontradas' }).getByRole('button', { name: 'Agregar' }).first().click();
    await expect(page.getByRole('region', { name: 'Compradoras' })).toContainText('Exportadora Demo (v2)');
    expect((await producto()).associatedCompanies.some((a: { type: string; company: { name: string } }) => a.type === 'BUYER' && a.company.name === 'Exportadora Demo (v2)')).toBe(true);
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Quitar a Exportadora Demo (v2)' }).click();
    await expect(page.getByRole('region', { name: 'Compradoras' })).toContainText('Ninguna.');

    // Acuerdo de datos con documento.
    await page.getByRole('button', { name: 'Agregar acuerdo' }).click();
    const acuerdo = page.getByRole('listitem', { name: 'Acuerdo 1' });
    await acuerdo.getByRole('textbox', { name: 'Descripción' }).fill('Acuerdo de prueba.');
    await acuerdo.getByLabel('Documento').setInputFiles({ name: 'acuerdo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%prueba') });
    await expect(acuerdo.getByText('acuerdo.pdf')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Producto guardado.')).toBeVisible();
    const p2 = await producto();
    expect(p2.dataSharingAgreements).toHaveLength(1);
    expect(p2.dataSharingAgreements[0].description).toBe('Acuerdo de prueba.');
    expect(p2.businessToCustomerSettings.primaryColor).toBe('#123456');

    // 3. Producto final.
    await page.getByRole('link', { name: 'Productos finales' }).click();
    await page.getByRole('button', { name: 'Nuevo producto final' }).click();
    const form = page.getByRole('group', { name: 'Nuevo producto final' });
    await form.getByRole('textbox', { name: 'Nombre' }).fill('Final E2E');
    await form.getByRole('combobox', { name: 'Unidad de medida' }).selectOption({ index: 1 });
    await form.getByRole('textbox', { name: 'Descripción' }).fill('Bolsa de prueba.');
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('listitem', { name: 'Final E2E' })).toBeVisible();
    const finales = (await api(page, 'get', `/api/product/${id}/finalProduct/list`)).data.items;
    expect(finales.map((f: { name: string }) => f.name)).toEqual(['Final E2E']);
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar Final E2E' }).click();
    await expect(page.getByRole('listitem', { name: 'Final E2E' })).toHaveCount(0);
  } finally {
    // Limpieza.
    await page.request.delete(`/api/product/${id}`);
  }
});

test('producto: base de conocimiento contra el backend', async ({ page }) => {
  test.setTimeout(90_000);
  await ingresar(page);
  const nombre = 'Conocimiento E2E ' + Date.now().toString().slice(-6);
  const creado = await api(page, 'post', '/api/product/create', {
    name: nombre, description: 'Prueba de la v2.', company: { id: 1 }, valueChain: { id: 1 }, dataSharingAgreements: [],
    origin: { text: 'Huehuetenango.', locations: [{ latitude: 15.5, longitude: -91.6, pinName: 'Finca' }] },
    process: { production: 'Lavado.' }, responsibility: { laborPolicies: 'Pago justo.' }, sustainability: { production: 'Bajo sombra.' }, settings: { language: 'ES' },
  });
  expect(creado.status).toBe('OK');
  const id = creado.data.id as number;
  const entradas = async () => (await api(page, 'get', `/api/product/knowledgeBlog/list/${id}?limit=50`)).data.items as { id: number; title: string; type: string }[];

  try {
    await page.goto(`/v2/productos/${id}/conocimiento`);
    await expect(page.getByText('Todavía no hay entradas.')).toBeVisible();
    await page.getByRole('button', { name: 'Nueva entrada' }).click();
    const form = page.getByRole('group', { name: 'Nueva entrada' });
    await form.getByRole('combobox', { name: 'Tema' }).selectOption({ label: 'Calidad' });
    await form.getByRole('textbox', { name: 'Título' }).fill('Catación E2E');
    await form.getByLabel('Fecha', { exact: true }).fill('2026-10-20');
    await form.getByRole('textbox', { name: 'Resumen' }).fill('<p>Notas de <strong>chocolate</strong>.</p>');
    await form.getByRole('textbox', { name: 'Video' }).fill('youtu.be/catacion');
    await form.getByLabel('Documentos', { exact: true }).setInputFiles({ name: 'catacion.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') });
    await expect(form.getByRole('link', { name: 'catacion.pdf' })).toBeVisible();
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Se guardó «Catación E2E».')).toBeVisible();

    const [e] = await entradas();
    expect(e).toMatchObject({ title: 'Catación E2E', type: 'QUALITY' });
    const guardada = (await api(page, 'get', `/api/product/knowledgeBlog/${e.id}`)).data;
    expect(guardada).toMatchObject({ date: '2026-10-20', summary: '<p>Notas de <strong>chocolate</strong>.</p>', youtubeUrl: 'https://youtu.be/catacion' });
    expect(guardada.documents.map((d: { name: string }) => d.name)).toEqual(['catacion.pdf']);

    // Editar conserva el tema y los documentos.
    await page.getByRole('listitem', { name: 'Catación E2E' }).getByRole('button', { name: 'Editar' }).click();
    const edicion = page.getByRole('group', { name: 'Editar entrada' });
    await expect(edicion.getByRole('link', { name: 'catacion.pdf' })).toBeVisible();
    await edicion.getByRole('textbox', { name: 'Título' }).fill('Catación E2E 2026');
    await edicion.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('listitem', { name: 'Catación E2E 2026' })).toContainText('Calidad');
    const editada = (await api(page, 'get', `/api/product/knowledgeBlog/${e.id}`)).data;
    expect(editada).toMatchObject({ title: 'Catación E2E 2026', type: 'QUALITY', youtubeUrl: 'https://youtu.be/catacion' });
    expect(editada.documents).toHaveLength(1);

    await page.getByRole('group', { name: 'Filtrar por tema' }).getByRole('button', { name: 'Equidad' }).click();
    await expect(page.getByText('No hay entradas de este tema.')).toBeVisible();
    await page.getByRole('group', { name: 'Filtrar por tema' }).getByRole('button', { name: 'Todas' }).click();

    // Borrar una entrada (ruta de H25).
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Borrar «Catación E2E 2026»' }).click();
    await expect(page.getByText('Se borró «Catación E2E 2026».')).toBeVisible();
    expect(await entradas()).toEqual([]);

    // Con H25, un producto con entradas se borra junto con ellas.
    expect((await api(page, 'post', `/api/product/knowledgeBlog/${id}`, { type: 'FAIRNESS', title: 'Queda al borrar' })).status).toBe('OK');
  } finally {
    // Limpieza (también comprueba que el producto con una entrada se puede borrar).
    expect((await (await page.request.delete(`/api/product/${id}`)).json()).status).toBe('OK');
  }
});
