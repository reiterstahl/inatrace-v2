import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addProductLabelFeedback,
  logPublicRequest,
  getProfileForUser,
  getPublicProductLabelValues,
  getQrTagPublicData,
  login,
  logout,
  updateProfile,
} from './gen/sdk.gen';
import type { ApiProductLabelFeedback, ApiUserUpdate } from './gen/types.gen';
import { desenvolver, ErrorApi } from './respuesta';
import { esVistaPrevia, leerVistaPrevia, type EtiquetaVitrina } from '@/util/etiqueta';
import { olvidarBeyco } from './beyco';

/** Un QR "EMPTY" es una etiqueta sin lote: la vitrina se muestra sin datos del pedido. */
export const QR_VACIO = 'EMPTY';

export const consultas = {
  perfil: () =>
    queryOptions({
      queryKey: ['perfil'],
      queryFn: () => desenvolver(getProfileForUser()),
      retry: false,
      staleTime: 5 * 60_000,
    }),

  /** La etiqueta publicada, o la vista previa que dejó el editor en este navegador. */
  etiqueta: (uid: string) =>
    queryOptions({
      queryKey: ['vitrina', 'etiqueta', uid],
      queryFn: async (): Promise<EtiquetaVitrina> => {
        if (!esVistaPrevia(uid)) {
          try {
            return await desenvolver(getPublicProductLabelValues({ path: { uid } }));
          } catch (e) {
            // El backend responde 400 «Invalid label uid» si la etiqueta no existe o no está publicada.
            if (e instanceof ErrorApi && e.estado === 'INVALID_REQUEST') throw new ErrorApi(e.message, 'NOT_FOUND', 404);
            throw e;
          }
        }
        const previa = leerVistaPrevia(uid);
        if (!previa) throw new ErrorApi('La vista previa ya no está disponible: ábrela de nuevo desde el editor de la etiqueta.', 'NOT_FOUND', 404);
        return previa;
      },
      staleTime: 10 * 60_000,
    }),

  /** El recorrido del lote viene traducido por el backend: la consulta depende del idioma. */
  qr: (qrTag: string, idioma: string) =>
    queryOptions({
      queryKey: ['vitrina', 'qr', qrTag, idioma],
      queryFn: () =>
        qrTag === QR_VACIO
          ? Promise.resolve(null)
          : desenvolver(getQrTagPublicData({ path: { qrTag }, query: { withHistory: true } })),
      staleTime: 10 * 60_000,
    }),
};

export function useIngresar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { username: string; password: string }) => desenvolver(login({ body: d })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfil'] }),
  });
}

export function useSalir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => desenvolver(logout()),
    onSettled: () => {
      olvidarBeyco();
      qc.clear();
    },
  });
}

export function useGuardarPerfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: ApiUserUpdate) => desenvolver(updateProfile({ body: d })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfil'] }),
  });
}

export function useEnviarOpinion(uid: string) {
  return useMutation({
    mutationFn: (d: ApiProductLabelFeedback) => desenvolver(addProductLabelFeedback({ path: { labelUid: uid }, body: d })),
  });
}

/**
 * Registra la visita de un QR, igual que la interfaz actual: de esto salen las estadísticas de
 * escaneos de cada etiqueta. Nunca frena ni rompe la vitrina: si falla o tarda, se sigue.
 */
export async function registrarVisitaQr(etiqueta: string, token?: string) {
  if (!token) return;
  const envio = logPublicRequest({ body: { token, type: 'VISIT_QR', logKey: etiqueta.slice(0, 64) } }).catch(() => undefined);
  await Promise.race([envio, new Promise((r) => setTimeout(r, 1500))]);
}
