import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { disableCurrency, enableCurrency, getDisabledCurrencyTypes, getEnabledCurrencyTypes, getGlobalSettings, getPublicGlobalSettings, updateGlobalSettings } from './gen/sdk.gen';
import { AJUSTES, type Ajuste } from '@/util/ajustes';
import { POR_PAGINA } from './productores';
import { desenvolver } from './respuesta';

export const ajustes = {
  /** Con sesión (Administración). */
  valor: (a: Ajuste) =>
    queryOptions({
      queryKey: ['ajustes', a],
      queryFn: async () => (await desenvolver(getGlobalSettings({ path: { name: AJUSTES[a].clave } }))).value ?? '',
      staleTime: 0,
    }),

  /** Sin sesión: solo los ajustes públicos (la vitrina). */
  publico: (a: Ajuste) =>
    queryOptions({
      queryKey: ['ajustes', 'publico', a],
      queryFn: async () => (await desenvolver(getPublicGlobalSettings({ path: { name: AJUSTES[a].clave } }))).value ?? '',
      staleTime: 10 * 60_000,
    }),
};

export function useGuardarAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ajuste, valor }: { ajuste: Ajuste; valor: string }) =>
      desenvolver(updateGlobalSettings({ path: { name: AJUSTES[ajuste].clave }, body: { value: valor, isPublic: AJUSTES[ajuste].publico } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ajustes'] }),
  });
}

export type FiltroMonedas = { activas: boolean; texto: string; pagina: number };

export const monedas = {
  lista: (f: FiltroMonedas) =>
    queryOptions({
      queryKey: ['monedas', 'administracion', f],
      queryFn: () => {
        const query = { query: f.texto.trim() || undefined, limit: POR_PAGINA, offset: (f.pagina - 1) * POR_PAGINA, sortBy: 'code', sort: 'ASC' as const };
        return desenvolver(f.activas ? getEnabledCurrencyTypes({ query }) : getDisabledCurrencyTypes({ query }));
      },
      placeholderData: keepPreviousData,
    }),
};

/** Activar o desactivar una moneda; la lista de monedas activas de la ficha de empresa cambia. */
export function useEstadoMoneda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activar }: { id: number; activar: boolean }) => desenvolver(activar ? enableCurrency({ path: { id } }) : disableCurrency({ path: { id } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['monedas'] });
      void qc.invalidateQueries({ queryKey: ['catalogo', 'monedas'] });
    },
  });
}
