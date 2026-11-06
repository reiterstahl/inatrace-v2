import { useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmEmail, createUser, requestResetPassword, resetPassword } from './gen/sdk.gen';
import { consultas } from './consultas';
import { desenvolver } from './respuesta';

type Idioma = 'ES' | 'EN' | 'DE' | 'RW';

/** Crea la cuenta sin activar: el backend manda el correo para confirmarla y avisa a la administración. */
export function useRegistrar() {
  return useMutation({
    mutationFn: (d: { name: string; surname: string; email: string; password: string; language: Idioma }) => desenvolver(createUser({ body: d })),
  });
}

/** Confirma el correo con el código del enlace; la cuenta queda esperando que la administración la active. */
export function useConfirmarCorreo() {
  return useMutation({ mutationFn: (token: string) => desenvolver(confirmEmail({ body: { token } })) });
}

/** Pide el enlace para restablecer la contraseña. El backend no dice si el correo existe. */
export function usePedirRestablecer() {
  return useMutation({ mutationFn: (email: string) => desenvolver(requestResetPassword({ body: { email } })) });
}

/**
 * ¿Quedó abierta la sesión? Con un fetch común: si no hay sesión, el 401 no debe disparar la
 * renovación ni mandar a la pantalla de ingreso (como haría fetchConSesion).
 */
export async function haySesion(): Promise<boolean> {
  const r = await fetch('/api/user/profile', { credentials: 'include' }).catch(() => null);
  return !!r?.ok;
}

/**
 * Cambia la contraseña con el código del enlace. Si la cuenta está activa, el backend además abre la
 * sesión; si todavía espera su activación, solo cambia la contraseña.
 */
export function useRestablecer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { token: string; password: string }) => desenvolver(resetPassword({ body: d })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: consultas.perfil().queryKey }),
  });
}
