import { test, expect, type Page } from '@playwright/test';
import { aceptarAviso } from '../e2e/avisos';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Empresa' }).selectOption({ label: 'Empresa Demo GIZ' });
}

// Un PNG de 1×1 para el logo.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test('empresa: la ficha guarda sobre lo que ya tenía y los usuarios no quedan sin administración', async ({ page }) => {
  test.setTimeout(90_000);
  await ingresar(page);
  const ficha = async () => (await (await page.request.get('/api/company/profile/1')).json()).data;
  const original = await ficha();

  try {
    await page.goto('/v2/empresa');
    await expect(page.getByRole('heading', { level: 1, name: 'Empresa Demo GIZ' })).toBeVisible();
    const entrevista = 'Entrevista E2E ' + Date.now().toString().slice(-6);
    await page.getByRole('textbox', { name: 'Entrevista' }).fill(entrevista);
    // Con H26 el backend guarda la gerencia.
    await page.getByRole('textbox', { name: 'Gerencia' }).fill('Gerencia E2E');
    // La demo no tiene logo, teléfono ni moneda, que la ficha exige.
    if (!original.phone) await page.getByRole('textbox', { name: /^Teléfono de contacto/ }).fill('+506 2222 0000');
    if (!original.currency) await page.getByRole('combobox', { name: /^Moneda base/ }).selectOption({ index: 1 });
    if (!original.logo) await page.getByLabel('Logo', { exact: true }).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('img', { name: 'Logo' })).toBeVisible();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Empresa guardada.')).toBeVisible();

    const guardada = await ficha();
    expect(guardada.interview).toBe(entrevista);
    expect(guardada.manager).toBe('Gerencia E2E');
    // Lo que la ficha no tocó sigue igual (el backend reemplaza todo lo que recibe).
    expect(guardada.name).toBe(original.name);
    expect(guardada.headquarters).toEqual(original.headquarters);
    const ids = (l: { id: number }[]) => l.map((x) => x.id).sort((a, b) => a - b);
    // Los mismos documentos (actualizados, no recreados); el backend no garantiza el orden.
    expect(ids(guardada.documents)).toEqual(ids(original.documents));
    expect(guardada.valueChains.map((c: { id: number }) => c.id)).toEqual(original.valueChains.map((c: { id: number }) => c.id));
    expect(guardada.users.map((u: { id: number }) => u.id)).toEqual(original.users.map((u: { id: number }) => u.id));
    expect(guardada.allowBeycoIntegration).toBe(original.allowBeycoIntegration);

    // Usuarios: la única persona con administración no puede perder el rol.
    await page.getByRole('link', { name: 'Usuarios' }).click();
    const yo = page.getByRole('listitem', { name: 'Admin INATrace' });
    await expect(yo).toContainText('admin@inatrace.local');
    await page.getByRole('combobox', { name: 'Rol de Admin INATrace' }).selectOption({ label: 'Gerencia' });
    await expect(page.getByText('No se puede: es la única persona con rol de administración.', { exact: false })).toBeVisible();
    // La búsqueda va contra las cuentas de la instancia y no ofrece a quien ya está en la empresa.
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('admin');
    await expect(page.getByText('No hay cuentas que coincidan (o ya están en la empresa).')).toBeVisible();
  } finally {
    // Deja la ficha como estaba (sin usuarios: esos no se tocan por esta ruta).
    const { users: _u, actions: _a, companyRoles: _c, supportsCollectors: _s, ...resto } = original;
    const r = await (await page.request.put('/api/company/profile', { data: resto })).json();
    expect(r.status).toBe('OK');
  }
});

test('instalaciones: crear, ver lo guardado, desactivar, activar y borrar contra el backend', async ({ page }) => {
  test.setTimeout(90_000);
  await ingresar(page);
  const nombre = 'Bodega E2E ' + Date.now().toString().slice(-6);
  const todas = async () => (await (await page.request.get('/api/chain/facility/list/company/1/all?limit=500')).json()).data.items as { id: number; name: string; deactivated?: boolean }[];
  let id: number | undefined;
  try {
    await page.goto('/v2/empresa/instalaciones/nueva');
    await page.getByRole('combobox', { name: 'Tipo de instalación' }).selectOption({ index: 1 });
    await page.getByRole('textbox', { name: 'Nombre en Español' }).fill(nombre);
    await page.getByRole('combobox', { name: 'País' }).selectOption({ label: 'Guatemala' });
    await page.getByRole('textbox', { name: 'Ciudad' }).fill('Chiantla');
    await page.getByRole('group', { name: /^¿Se muestra en el mapa público\?/ }).getByLabel('Sí').check();
    await page.getByRole('textbox', { name: /^Latitud/ }).fill('15,35');
    await page.getByRole('textbox', { name: /^Longitud/ }).fill('-91,45');
    await page.getByRole('group', { name: /^¿Es un centro de acopio\?/ }).getByLabel('Sí').check();
    await page.getByRole('group', { name: /^¿Vende semiproductos/ }).getByLabel('No').check();
    await page.getByRole('checkbox', { name: 'Tara' }).check();
    if ((await page.getByRole('list', { name: /^Cadenas de valor/ }).count()) === 0) {
      await page.getByRole('combobox', { name: 'Agregar a cadenas de valor' }).selectOption({ index: 1 });
      await page.getByRole('button', { name: 'Agregar a cadenas de valor' }).click();
    }
    await page.getByRole('combobox', { name: 'Agregar a semiproductos' }).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Agregar a semiproductos' }).click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText(`Se guardó «${nombre}».`)).toBeVisible();

    id = (await todas()).find((f) => f.name === nombre)?.id;
    expect(id).toBeTruthy();
    const d = (await (await page.request.get(`/api/chain/facility/${id}/detail`)).json()).data;
    // Los cuatro idiomas con el nombre, ubicación con coordenadas y las opciones elegidas.
    expect(d.translations.map((t: { name: string }) => t.name)).toEqual([nombre, nombre, nombre, nombre]);
    expect(d.facilityLocation).toMatchObject({ publiclyVisible: true, latitude: 15.35, longitude: -91.45, address: { city: 'Chiantla', country: { code: 'GT' } } });
    expect(d).toMatchObject({ isCollectionFacility: true, isPublic: false, displayTare: true, displayOrganic: false });
    expect(d.facilityValueChains.length).toBeGreaterThan(0);
    expect(d.facilitySemiProductList.length).toBe(1);

    const fila = page.getByRole('listitem', { name: nombre });
    await aceptarAviso(page);
    await fila.getByRole('button', { name: 'Desactivar' }).click();
    await expect(fila).toContainText('Desactivada');
    expect((await todas()).find((f) => f.id === id)?.deactivated).toBe(true);
    await fila.getByRole('button', { name: 'Activar' }).click();
    await expect(fila).not.toContainText('Desactivada');

    await aceptarAviso(page);
    await page.getByRole('button', { name: `Borrar ${nombre}` }).click();
    await expect(page.getByText(`Se borró «${nombre}».`)).toBeVisible();
    expect((await todas()).some((f) => f.id === id)).toBe(false);
    id = undefined;
  } finally {
    if (id) await page.request.delete(`/api/chain/facility/${id}`);
  }
});

test('acciones: crear un procesamiento, ver lo guardado, cambiar el tipo y borrar contra el backend', async ({ page }) => {
  test.setTimeout(90_000);
  await ingresar(page);
  const nombre = 'Fermentado E2E ' + Date.now().toString().slice(-6);
  const todas = async () => (await (await page.request.get('/api/chain/processing-action/list/company/1?limit=500')).json()).data.items as { id: number; name: string }[];
  let id: number | undefined;
  try {
    await page.goto('/v2/empresa/acciones/nueva');
    await page.getByRole('combobox', { name: 'Tipo de acción' }).selectOption({ label: 'Procesamiento' });
    if ((await page.getByRole('list', { name: /^Cadenas de valor/ }).count()) === 0) {
      await page.getByRole('combobox', { name: 'Agregar a cadenas de valor' }).selectOption({ index: 1 });
      await page.getByRole('button', { name: 'Agregar a cadenas de valor' }).click();
    }
    await page.getByRole('combobox', { name: 'Semiproducto de entrada' }).selectOption({ index: 1 });
    await page.getByRole('combobox', { name: 'Agregar a semiproductos de salida' }).selectOption({ index: 2 });
    await page.getByRole('button', { name: 'Agregar a semiproductos de salida' }).click();
    const salida = page.getByRole('list', { name: 'Semiproductos de salida' }).getByRole('listitem').first();
    await salida.getByRole('checkbox', { name: 'Se reempaca' }).check();
    await salida.getByRole('textbox', { name: /^Máximo por envase/ }).fill('46');
    await page.getByRole('textbox', { name: /^Rendimiento estimado/ }).fill('0,8');
    await page.getByRole('textbox', { name: 'Prefijo de los lotes' }).fill('FER');
    await page.getByRole('textbox', { name: 'Nombre en Español' }).fill(nombre);
    await page.getByRole('textbox', { name: 'Descripción en Español' }).fill('En tanques');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText(`Se guardó «${nombre}».`)).toBeVisible();

    id = (await todas()).find((a) => a.name === nombre)?.id;
    expect(id).toBeTruthy();
    const d = (await (await page.request.get(`/api/chain/processing-action/${id}/detail`)).json()).data;
    expect(d).toMatchObject({ type: 'PROCESSING', prefix: 'FER', estimatedOutputQuantityPerUnit: 0.8, finalProductAction: false });
    expect(d.inputSemiProduct.id).toBeTruthy();
    expect(d.outputSemiProducts).toHaveLength(1);
    expect(d.outputSemiProducts[0]).toMatchObject({ repackedOutput: true, maxOutputWeight: 46 });
    // El inglés que exige el backend tomó el nombre escrito en español.
    expect(d.translations.find((t: { language: string }) => t.language === 'EN')).toMatchObject({ name: nombre, description: 'En tanques' });

    // Cambiar a traslado de semiproductos: el backend deja de guardar las salidas.
    await page.getByRole('listitem', { name: nombre }).getByRole('link', { name: 'Editar' }).click();
    await page.getByRole('combobox', { name: 'Tipo de acción' }).selectOption({ label: 'Traslado' });
    await page.getByRole('group', { name: /^¿Mueve productos finales\?/ }).getByLabel('No').check();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('listitem', { name: nombre })).toContainText('Traslado');
    const t = (await (await page.request.get(`/api/chain/processing-action/${id}/detail`)).json()).data;
    expect(t).toMatchObject({ type: 'TRANSFER', finalProductAction: false });

    await aceptarAviso(page);
    await page.getByRole('button', { name: `Borrar ${nombre}` }).click();
    await expect(page.getByText(`Se borró «${nombre}».`)).toBeVisible();
    expect((await todas()).some((a) => a.id === id)).toBe(false);
    id = undefined;
  } finally {
    if (id) await page.request.delete(`/api/chain/processing-action/${id}`);
  }
});

test('recolectores y clientes: crear, ver lo guardado y borrar contra el backend', async ({ page }) => {
  test.setTimeout(90_000);
  await ingresar(page);
  const marca = Date.now().toString().slice(-6);
  let recolector: number | undefined;
  let cliente: number | undefined;
  try {
    // Recolector: misma ficha que un productor, guardado como COLLECTOR.
    await page.goto('/v2/productores/recolectores/nuevo');
    await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Recolector');
    await page.getByRole('textbox', { name: /^Apellido/ }).fill('E2E ' + marca);
    await page.getByText('Hombre', { exact: true }).click();
    await page.getByRole('combobox', { name: /^País/ }).selectOption({ label: 'Guatemala' });
    await page.getByRole('textbox', { name: /^Ciudad o municipio/ }).fill('Chiantla');
    await page.getByRole('textbox', { name: /^Departamento o estado/ }).fill('Huehuetenango');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL(/\/v2\/productores\/recolectores\/\d+$/);
    recolector = Number(page.url().split('/').pop());
    const r = (await (await page.request.get(`/api/company/userCustomers/${recolector}`)).json()).data;
    expect(r).toMatchObject({ type: 'COLLECTOR', surname: 'E2E ' + marca });
    const lista = (await (await page.request.get(`/api/company/userCustomers/1/COLLECTOR?limit=500`)).json()).data.items as { id: number }[];
    expect(lista.some((x) => x.id === recolector)).toBe(true);
    const deProductores = (await (await page.request.get(`/api/company/userCustomers/1/FARMER?limit=500`)).json()).data.items as { id: number }[];
    expect(deProductores.some((x) => x.id === recolector)).toBe(false);

    // Cliente.
    await page.goto('/v2/empresa/clientes');
    await page.getByRole('button', { name: 'Nuevo cliente' }).click();
    const form = page.getByRole('group', { name: 'Nuevo cliente' });
    const nombre = 'Cliente E2E ' + marca;
    await form.getByRole('textbox', { name: /^Nombre/ }).fill(nombre);
    await form.getByRole('textbox', { name: 'Identificación fiscal' }).fill('3-101-' + marca);
    await form.getByRole('textbox', { name: 'Correo' }).fill('compras@cliente.example');
    await form.getByRole('combobox', { name: /^País/ }).selectOption({ label: 'Costa Rica' });
    await form.getByRole('textbox', { name: 'Ciudad' }).fill('Heredia');
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText(`Se guardó «${nombre}».`)).toBeVisible();
    const clientes = (await (await page.request.get('/api/company/companyCustomers/list/1?limit=500')).json()).data.items as { id: number; name: string; vatId?: string; location?: { city?: string; country?: { code?: string } } }[];
    const c = clientes.find((x) => x.name === nombre)!;
    cliente = c.id;
    expect(c).toMatchObject({ vatId: '3-101-' + marca, location: { city: 'Heredia', country: { code: 'CR' } } });
    await aceptarAviso(page);
    await page.getByRole('button', { name: `Borrar ${nombre}` }).click();
    await expect(page.getByText(`Se borró «${nombre}».`)).toBeVisible();
    cliente = undefined;

    await page.goto(`/v2/productores/recolectores/${recolector}`);
    await aceptarAviso(page);
    await page.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page).toHaveURL(/\/v2\/productores\/recolectores$/);
    recolector = undefined;
  } finally {
    if (cliente) await page.request.delete(`/api/company/companyCustomers/${cliente}`);
    if (recolector) await page.request.delete(`/api/company/userCustomers/${recolector}`);
  }
});
