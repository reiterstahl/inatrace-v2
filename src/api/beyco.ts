import { queryOptions, useMutation } from '@tanstack/react-query';
import { getBeycoOrderFieldsForSelectedStockOrders, getToken, refreshToken, sendBeycoOrder } from './gen/sdk.gen';
import type { ApiBeycoOrderFields, ApiBeycoTokenResponse } from './gen/types.gen';
import { desenvolver } from './respuesta';
import { CONFIG } from '@/util/entorno';
import { urlAutorizacion, type Pendiente } from '@/util/beyco';

/**
 * Integración con Beyco: la empresa autoriza a INATrace en Beyco (OAuth2) y publica ofertas de
 * café con los datos de sus lotes. El token de Beyco vive solo en memoria, como en la versión
 * actual: no se guarda en el navegador y se pierde al recargar o al cerrar sesión.
 */
const CLAVE_PENDIENTE = 'beyco-pendiente';
const SIMULADO = import.meta.env.MODE === 'simulado';

type Sesion = { empresa: number; token: ApiBeycoTokenResponse; vence: number };
let sesion: Sesion | null = null;

/** Beyco está disponible si la instalación lo configuró (o en el modo de demostración). */
export const beycoConfigurado = () => SIMULADO || (!!CONFIG.beycoUrl && !!CONFIG.beycoClientId);

export const conectadoABeyco = (empresa: number) => !!sesion && sesion.empresa === empresa;
export function olvidarBeyco() {
  sesion = null;
}

const guardar = (empresa: number, token: ApiBeycoTokenResponse) => {
  // expiresIn viene en segundos; se renueva con margen antes de que venza.
  sesion = { empresa, token, vence: Date.now() + Math.max(0, (token.expiresIn ?? 0) - 60) * 1000 };
};

/** Sale hacia Beyco para autorizar; al volver, /stock/beyco retoma la oferta con estos lotes. */
export function irAAutorizar(empresa: number, lotes: number[]) {
  const state = crypto.randomUUID();
  const pendiente: Pendiente = { state, empresa, lotes };
  sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify(pendiente));
  const vuelta = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/stock/beyco`;
  // En el modo de demostración no hay Beyco: se simula que autorizó y vuelve con un código.
  window.location.assign(SIMULADO ? `${vuelta}?code=codigo-simulado&scope=Offer%3ACreate&state=${state}` : urlAutorizacion(CONFIG.beycoUrl!, CONFIG.beycoClientId!, vuelta, state));
}

/** Lo pendiente de la salida hacia Beyco. Se consume una sola vez. */
export function tomarPendiente(): Pendiente | null {
  try {
    const v = sessionStorage.getItem(CLAVE_PENDIENTE);
    sessionStorage.removeItem(CLAVE_PENDIENTE);
    return v ? (JSON.parse(v) as Pendiente) : null;
  } catch {
    return null;
  }
}

/** Cambia el código de autorización por el token (lo hace el backend, que guarda el secreto). */
export async function conectarBeyco(empresa: number, code: string) {
  guardar(empresa, await desenvolver(getToken({ path: { companyId: empresa }, query: { authCode: code } })));
}

/** Token vigente para enviar, renovándolo si venció. */
async function tokenVigente(empresa: number): Promise<string> {
  if (!sesion || sesion.empresa !== empresa) throw new Error('sin_sesion_beyco');
  if (Date.now() >= sesion.vence) {
    if (!sesion.token.refreshToken) throw new Error('sin_sesion_beyco');
    guardar(empresa, await desenvolver(refreshToken({ path: { companyId: empresa }, headers: { 'X-Beyco-Refresh-Token': sesion.token.refreshToken } })));
  }
  return sesion.token.accessToken!;
}

export const beyco = {
  /** Campos iniciales de la oferta, armados por el backend desde los lotes elegidos. */
  campos: (empresa: number, lotes: number[]) =>
    queryOptions({
      queryKey: ['beyco', 'campos', empresa, lotes],
      queryFn: () => desenvolver(getBeycoOrderFieldsForSelectedStockOrders({ path: { companyId: empresa }, query: { id: lotes } })),
      staleTime: Infinity,
    }),
};

export function useEnviarABeyco(empresa: number) {
  return useMutation({
    mutationFn: async (oferta: ApiBeycoOrderFields) => {
      const token = await tokenVigente(empresa);
      return desenvolver(sendBeycoOrder({ path: { companyId: empresa }, headers: { 'X-Beyco-Token': token }, body: oferta }));
    },
  });
}
