import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addProductLabelFeedback,
  getProfileForUser,
  getPublicProductLabelValues,
  getQrTagPublicData,
  login,
  logout,
  updateProfile,
} from './gen/sdk.gen';
import type { ApiProductLabelFeedback, ApiUserUpdate } from './gen/types.gen';
import { desenvolver } from './respuesta';

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

  etiqueta: (uid: string) =>
    queryOptions({
      queryKey: ['vitrina', 'etiqueta', uid],
      queryFn: () => desenvolver(getPublicProductLabelValues({ path: { uid } })),
      staleTime: 10 * 60_000,
    }),

  qr: (qrTag: string) =>
    queryOptions({
      queryKey: ['vitrina', 'qr', qrTag],
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
    onSettled: () => qc.clear(),
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
