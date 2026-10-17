import { manejadores } from './manejadores';

/** Activa la simulación de la API (solo en `pnpm dev:simulado` y en las pruebas de punta a punta). */
export async function iniciarSimulacion() {
  const { network } = await import('virtual:msw');
  // Lo que no es de la API (teselas del mapa, fuentes) sigue su camino normal.
  network.configure({ handlers: manejadores, onUnhandledFrame: 'bypass' });
  await network.enable();
}
