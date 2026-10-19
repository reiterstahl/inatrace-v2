import type { CreateClientConfig } from './gen/client.gen';
import { fetchConSesion } from './sesion';
import i18n from '@/i18n';

/**
 * Igual que la interfaz actual: cada petición lleva el idioma activo en la cabecera `language`
 * (el backend traduce con eso, p. ej. los pasos del recorrido de un lote).
 */
const conIdioma: typeof fetch = (entrada, opciones) => {
  const peticion = new Request(entrada, opciones);
  peticion.headers.set('language', (i18n.language || 'en').slice(0, 2).toUpperCase());
  return fetchConSesion(peticion);
};

/**
 * Mismo origen que el backend (el proxy reparte /api), y las cookies de sesión viajan siempre.
 * fetchConSesion renueva el acceso cuando vence, igual que hace la interfaz actual.
 */
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: '',
  credentials: 'include',
  fetch: conIdioma,
});
