import { test, expect, type Page } from '@playwright/test';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
}

const sufijo = () => Date.now().toString().slice(-6);

/** Crea, edita y borra en cada catálogo: no deja nada en la instancia. */
test('catálogos: semiproducto con traducciones, editar y borrar', async ({ page }) => {
  test.setTimeout(90_000);
  await ingresar(page);
  page.on('dialog', (d) => void d.accept());
  const nombre = `E2E semi ${sufijo()}`;

  await page.goto('/v2/administracion/catalogos?tipo=semiproductos');
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nombre (Inglés)' }).fill(nombre);
  await page.getByRole('textbox', { name: 'Descripción (Inglés)' }).fill('E2E description');
  await page.getByRole('textbox', { name: 'Nombre (Español)' }).fill(`${nombre} es`);
  await page.getByRole('combobox', { name: 'Unidad de medida' }).selectOption({ index: 1 });
  await page.getByText('Se puede comprar al productor').click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(`«${nombre} es» guardado.`)).toBeVisible();

  // La lista viene en el idioma de la interfaz (español): el nombre visible es la traducción.
  await page.getByRole('searchbox', { name: 'Buscar' }).fill(nombre);
  const fila = page.getByRole('listitem', { name: `${nombre} es` });
  await fila.getByRole('button', { name: /^Editar/ }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre (Inglés)' })).toHaveValue(nombre);
  await expect(page.getByRole('checkbox', { name: 'Se puede comprar al productor' })).toBeChecked();
  await page.getByRole('textbox', { name: 'Descripción (Inglés)' }).fill('E2E description edited');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(`«${nombre} es» guardado.`)).toBeVisible();

  const lista = (await (await page.request.get('/api/chain/semi-product/list?limit=500', { headers: { language: 'EN' } })).json()).data.items;
  const guardado = lista.find((x: { name: string }) => x.name === nombre);
  expect(guardado).toMatchObject({ description: 'E2E description edited', buyable: true });
  expect(guardado.translations.map((t: { language: string }) => t.language).sort()).toEqual(['EN', 'ES']);

  await page.getByRole('searchbox', { name: 'Buscar' }).fill(nombre);
  await page.getByRole('button', { name: `Borrar ${nombre} es` }).click();
  await expect(page.getByText(`«${nombre} es» borrado.`)).toBeVisible();
});

test('catálogos: tipo de producto, unidad, tipo de instalación y evidencias se crean y se borran', async ({ page }) => {
  test.setTimeout(120_000);
  await ingresar(page);
  page.on('dialog', (d) => void d.accept());
  const s = sufijo();

  async function crearYBorrar(tipo: string, llenar: () => Promise<void>, nombre: string) {
    await page.goto(`/v2/administracion/catalogos?tipo=${tipo}`);
    await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
    await llenar();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText(`«${nombre}» guardado.`)).toBeVisible();
    await page.getByRole('searchbox', { name: 'Buscar' }).fill(nombre);
    await expect(page.getByRole('listitem', { name: nombre })).toBeVisible();
    await page.getByRole('button', { name: `Borrar ${nombre}` }).click();
    await expect(page.getByText(`«${nombre}» borrado.`)).toBeVisible();
    await expect(page.getByRole('listitem', { name: nombre })).toHaveCount(0);
  }

  // Los tipos de producto se borran con el id en la consulta (así lo lee el backend).
  await crearYBorrar('tipos-producto', async () => {
    await page.getByRole('textbox', { name: 'Código' }).fill(`E2E_${s}`);
    await page.getByRole('textbox', { name: 'Nombre (Inglés)' }).fill(`E2E product ${s}`);
    await page.getByRole('textbox', { name: 'Descripción (Inglés)' }).fill('E2E');
    await page.getByRole('textbox', { name: 'Nombre (Español)' }).fill(`E2E producto ${s}`);
  }, `E2E producto ${s}`);

  await crearYBorrar('unidades', async () => {
    await page.getByRole('textbox', { name: 'Código' }).fill(`E2E_${s}`);
    await page.getByRole('textbox', { name: 'Etiqueta' }).fill(`E2E saco ${s}`);
    await page.getByRole('textbox', { name: 'Peso en kg' }).fill('46');
  }, `E2E saco ${s}`);

  await crearYBorrar('tipos-instalacion', async () => {
    await page.getByRole('textbox', { name: 'Código' }).fill(`E2E_${s}`);
    await page.getByRole('textbox', { name: 'Etiqueta' }).fill(`E2E secadora ${s}`);
  }, `E2E secadora ${s}`);

  await crearYBorrar('tipos-evidencia', async () => {
    await page.getByRole('textbox', { name: 'Código' }).fill(`E2E_${s}`);
    await page.getByRole('textbox', { name: 'Etiqueta (Inglés)' }).fill(`E2E receipt ${s}`);
    await page.getByRole('textbox', { name: 'Etiqueta (Español)' }).fill(`E2E recibo ${s}`);
    await page.getByRole('combobox', { name: 'Tipo' }).selectOption({ label: 'Documento' });
    await page.getByText('Calidad', { exact: true }).click();
  }, `E2E recibo ${s}`);

  await crearYBorrar('campos-evidencia', async () => {
    await page.getByRole('textbox', { name: 'Nombre del campo' }).fill(`E2E_${s}`);
    await page.getByRole('textbox', { name: 'Etiqueta (Inglés)' }).fill(`E2E moisture ${s}`);
    await page.getByRole('textbox', { name: 'Etiqueta (Español)' }).fill(`E2E humedad ${s}`);
    await page.getByRole('combobox', { name: 'Tipo' }).selectOption({ label: 'Número' });
  }, `E2E humedad ${s}`);
});

test('catálogos: un semiproducto en uso no se borra y se explica', async ({ page }) => {
  await ingresar(page);
  page.on('dialog', (d) => void d.accept());
  await page.goto('/v2/administracion/catalogos?tipo=semiproductos');
  // El que usan las entregas de la demo.
  const [entrega] = (await (await page.request.get('/api/chain/stock-order/list/company/1?limit=1')).json()).data?.items ?? [];
  const semi = entrega?.semiProduct?.name ?? 'Café cereza';
  await page.getByRole('searchbox', { name: 'Buscar' }).fill(semi);
  await page.getByRole('button', { name: `Borrar ${semi}` }).first().click();
  await expect(page.getByText(new RegExp(`No se pudo borrar «${semi.replace(/[()/]/g, '\\$&')}»: probablemente está en uso`))).toBeVisible();
});
