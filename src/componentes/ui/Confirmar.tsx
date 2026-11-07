import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Icono } from './Icono';

/**
 * Avisos y confirmaciones propios, en lugar de window.confirm/alert: usan los colores y el idioma
 * de la plataforma, y se destacan del fondo (claro u oscuro) con un halo difuminado.
 * Se llaman como funciones: `if (!(await confirmar(texto, { accion: 'eliminar' }))) return;`
 */
export type Accion = 'confirmar' | 'eliminar' | 'quitar' | 'desactivar' | 'continuar' | 'salir';
type Opciones = { accion?: Accion; titulo?: string };
type Pedido = Opciones & { mensaje: string; soloAviso?: boolean; resolver: (si: boolean) => void };

/** Las que no se deshacen: el botón va en rojo y el foco empieza en «Cancelar». */
const DELICADAS: Accion[] = ['eliminar', 'quitar', 'desactivar', 'salir'];

let pedido: Pedido | null = null;
const escuchas = new Set<() => void>();
const cambiar = (p: Pedido | null) => {
  pedido = p;
  escuchas.forEach((fn) => fn());
};

export function confirmar(mensaje: string, opciones: Opciones = {}): Promise<boolean> {
  return new Promise((resolver) => {
    pedido?.resolver(false); // uno a la vez: el anterior queda cancelado
    cambiar({ ...opciones, mensaje, resolver });
  });
}

/** Igual que confirmar, para salir de un formulario con cambios sin guardar. */
export const confirmarSalida = (mensaje: string) => confirmar(mensaje, { accion: 'salir' });

/** Aviso con un solo botón. */
export function avisar(mensaje: string, titulo?: string): Promise<void> {
  return new Promise((resolver) => {
    pedido?.resolver(false);
    cambiar({ mensaje, titulo, soloAviso: true, resolver: () => resolver() });
  });
}

export function Confirmaciones() {
  const { t } = useTranslation();
  const p = useSyncExternalStore(
    (fn) => (escuchas.add(fn), () => escuchas.delete(fn)),
    () => pedido,
  );
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (p && !d.open) d.showModal();
    if (!p && d.open) d.close();
  }, [p]);

  const responder = (si: boolean) => {
    if (!p) return;
    cambiar(null);
    p.resolver(si);
  };

  const accion = p?.accion ?? 'confirmar';
  const delicada = !p?.soloAviso && DELICADAS.includes(accion);
  return (
    <dialog
      ref={dialogo}
      role="alertdialog"
      aria-labelledby="aviso-mensaje"
      className="aviso-modal"
      // Esc y clic afuera cancelan.
      onCancel={(e) => {
        e.preventDefault();
        responder(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) responder(false);
      }}
    >
      {p && (
        <div className="grid gap-5 p-6">
          <div className="flex items-start gap-4">
            <span className={clsx('grid size-10 shrink-0 place-items-center rounded-full', delicada ? 'bg-mal-suave text-mal' : 'bg-marca-suave text-marca')}>
              <Icono nombre={delicada ? 'alerta' : p.soloAviso ? 'mensaje' : 'ok'} className="size-5" />
            </span>
            <div className="grid gap-1 pt-1.5">
              {p.titulo && <h2 className="font-semibold">{p.titulo}</h2>}
              <p id="aviso-mensaje" data-mensaje className="leading-relaxed text-tinta">
                {p.mensaje}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {!p.soloAviso && (
              <button type="button" data-aviso="cancelar" autoFocus={delicada} onClick={() => responder(false)} className="h-10 rounded-lg border border-linea bg-superficie px-4 text-sm font-semibold text-tinta hover:bg-superficie-2">
                {t(accion === 'salir' ? 'comun.aviso.seguir' : 'comun.cancelar')}
              </button>
            )}
            <button
              type="button"
              data-aviso="aceptar"
              autoFocus={!delicada}
              onClick={() => responder(true)}
              className={clsx('h-10 rounded-lg px-4 text-sm font-semibold', delicada ? 'bg-mal text-papel hover:brightness-110' : 'bg-marca text-sobre-marca hover:bg-marca-fuerte')}
            >
              {p.soloAviso ? t('comun.aviso.entendido') : t(`comun.aviso.${accion}`)}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
