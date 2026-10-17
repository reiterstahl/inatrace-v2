import type { CreateClientConfig } from './gen/client.gen';
import { fetchConSesion } from './sesion';

/**
 * Mismo origen que el backend (el proxy reparte /api), y las cookies de sesión viajan siempre.
 * fetchConSesion renueva el acceso cuando vence, igual que hace la interfaz actual.
 */
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: '',
  credentials: 'include',
  fetch: fetchConSesion,
});
