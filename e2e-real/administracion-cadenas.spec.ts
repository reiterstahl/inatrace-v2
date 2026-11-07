import { test, expect, type Page } from '@playwright/test';
import { aceptarAvisos } from '../e2e/avisos';

const { INATRACE_USUARIO: usuario = '', INATRACE_CLAVE: clave = '' } = process.env;

async function ingresar(page: Page) {
  await page.goto('/v2/ingreso');
  await page.getByLabel('Correo electrónico').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
}

/** Crea una cadena, la edita, la desactiva, la activa y la borra (no queda nada en la instancia). */
test('cadenas de valor: crear, editar, desactivar, activar y borrar', async ({ page }) => {
  test.setTimeout(90_000);
  await ingresar(page);
  await aceptarAvisos(page);
  const nombre = 'E2E Cadena ' + Date.now().toString().slice(-6);

  await page.goto('/v2/administracion/cadenas/nueva');
  await page.getByRole('textbox', { name: 'Nombre' }).fill(nombre);
  await page.getByRole('textbox', { name: 'Descripción' }).fill('Cadena de prueba');
  await page.getByRole('combobox', { name: 'Tipo de producto' }).selectOption({ index: 1 });
  const semis = page.getByRole('combobox', { name: 'Agregar a semiproductos' });
  await expect(semis.getByRole('option')).not.toHaveCount(1);
  const semi = (await semis.getByRole('option').nth(1).textContent())!.trim();
  await semis.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Agregar a semiproductos' }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(`Cadena «${nombre}» guardada.`)).toBeVisible();

  await page.getByRole('searchbox', { name: 'Buscar' }).fill(nombre);
  const fila = page.getByRole('listitem', { name: nombre });
  await expect(fila).toContainText('Activa');
  await fila.getByRole('link').click();
  await expect(page.getByRole('list', { name: 'Semiproductos' })).toContainText(semi);
  await page.getByRole('textbox', { name: 'Descripción' }).fill('Cadena de prueba editada');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(`Cadena «${nombre}» guardada.`)).toBeVisible();

  const lista = async () => (await (await page.request.get(`/api/chain/value-chain/list?name=${encodeURIComponent(nombre)}`)).json()).data.items;
  const [c] = await lista();
  expect(c).toMatchObject({ name: nombre, description: 'Cadena de prueba editada', valueChainStatus: 'ENABLED' });
  // El semiproducto sigue después de editar (el backend reemplaza las listas que llegan).
  const detalle = (await (await page.request.get(`/api/chain/value-chain/${c.id}`)).json()).data;
  expect(detalle.semiProducts).toHaveLength(1);

  await page.getByRole('searchbox', { name: 'Buscar' }).fill(nombre);
  await page.getByRole('button', { name: `Desactivar ${nombre}` }).click();
  await expect(fila).toContainText('Desactivada');
  await page.getByRole('button', { name: `Activar ${nombre}`, exact: true }).click();
  await expect(fila).toContainText('Activa');
  await page.getByRole('button', { name: `Borrar ${nombre}` }).click();
  await expect(page.getByText(`Cadena «${nombre}» borrada.`)).toBeVisible();
  expect(await lista()).toHaveLength(0);
});

test('cadenas de valor: una en uso no se borra y se explica', async ({ page }) => {
  await ingresar(page);
  await aceptarAvisos(page);
  await page.goto('/v2/administracion/cadenas');
  const [usada] = (await (await page.request.get('/api/company/1/value-chains?limit=1')).json()).data.items;
  await page.getByRole('searchbox', { name: 'Buscar' }).fill(usada.name);
  await page.getByRole('button', { name: `Borrar ${usada.name}` }).click();
  await expect(page.getByText(new RegExp(`No se pudo borrar «${usada.name.replace(/[()]/g, '\\$&')}»`))).toBeVisible();
  const sigue = (await (await page.request.get(`/api/chain/value-chain/${usada.id}`)).json()).data;
  expect(sigue.id).toBe(usada.id);
});
