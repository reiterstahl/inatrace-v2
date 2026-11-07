import { useEffect, useId, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { IDIOMAS, cambiarIdioma, type Idioma } from '@/i18n';
import { elegirEmpresa, useEmpresaActual, useEmpresas } from '@/util/empresa';
import { TEMAS, useTema } from '@/util/tema';
import { useAvatar } from '@/util/avatar';
import { Avatar } from './ui/Avatar';
import { Icono } from './ui/Icono';

type Props = { cuenta: string; nombre: string; correo?: string; alSalir: () => void };

/**
 * Menú de la cuenta, detrás del avatar: empresa con la que se trabaja, idioma, tema (claro u oscuro y
 * su combinación de colores), el perfil y la salida. Se cierra con Esc, al hacer clic afuera o al
 * elegir un destino.
 */
export function MenuUsuario({ cuenta, nombre, correo, alSalir }: Props) {
  const { t, i18n } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [avatar] = useAvatar(cuenta);
  const { empresas } = useEmpresas();
  const actual = useEmpresaActual();
  const qc = useQueryClient();
  const [tema, modo, alternar, elegirTema] = useTema();

  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', afuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', afuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const etiqueta = 'grid gap-1.5 text-xs font-semibold tracking-wide text-tinta-3 uppercase';
  const lista = 'h-10 w-full rounded-lg border border-linea bg-superficie px-3 text-sm font-medium tracking-normal text-tinta normal-case focus:border-marca focus:outline-none';
  const opcion = 'flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-tinta hover:bg-superficie-2';

  return (
    <div ref={caja} className="relative sm:ml-2">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={t('portal.menu_usuario')}
        title={nombre}
        className={clsx('grid rounded-full ring-marca ring-offset-2 ring-offset-superficie transition hover:ring-2', abierto && 'ring-2')}
      >
        <Avatar avatar={avatar} className="size-9" />
      </button>

      {abierto && (
        <div id={id} role="dialog" aria-label={t('portal.menu_usuario')} className="absolute top-full right-0 z-30 mt-2 grid w-[min(20rem,calc(100vw-1.5rem))] gap-4 rounded-caja border border-linea bg-superficie p-4 shadow-alta">
          <div className="flex items-center gap-3">
            <Avatar avatar={avatar} className="size-12" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{nombre}</p>
              {correo && <p className="truncate text-sm text-tinta-3">{correo}</p>}
            </div>
          </div>

          {actual && (
            <label className={etiqueta}>
              {t('portal.empresa')}
              {empresas.length > 1 ? (
                <select
                  value={actual.id}
                  onChange={(e) => {
                    elegirEmpresa(Number(e.target.value));
                    void qc.invalidateQueries({ queryKey: ['productores'] });
                  }}
                  className={lista}
                >
                  {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              ) : (
                <span className="text-sm font-medium tracking-normal text-tinta normal-case">{actual.nombre}</span>
              )}
            </label>
          )}

          <label className={etiqueta}>
            {t('comun.idioma')}
            <select value={i18n.language} onChange={(e) => cambiarIdioma(e.target.value as Idioma)} className={lista}>
              {IDIOMAS.map((l) => <option key={l} value={l}>{t(`idiomas.${l}`)}</option>)}
            </select>
          </label>

          <div className={etiqueta}>
            {t('portal.tema')}
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-superficie-2 p-1 tracking-normal normal-case" role="group" aria-label={t('portal.tema')}>
              {(['claro', 'oscuro'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={modo === m} onClick={() => modo !== m && alternar()} className={clsx('inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-semibold', modo === m ? 'bg-marca text-sobre-marca' : 'text-tinta-2 hover:text-tinta')}>
                  <Icono nombre={m === 'claro' ? 'sol' : 'luna'} className="size-3.5" />
                  {t(m === 'claro' ? 'portal.modo_claro' : 'portal.modo_oscuro')}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label={t('portal.colores')}>
              {TEMAS.filter((x) => x.modo === modo).map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="radio"
                  aria-checked={x.id === tema}
                  aria-label={t(`perfil.apariencia.temas.${x.id}`)}
                  title={t(`perfil.apariencia.temas.${x.id}`)}
                  onClick={() => elegirTema(x.id)}
                  className={clsx('grid size-8 place-items-center rounded-full border-2 transition', x.id === tema ? 'border-marca' : 'border-transparent hover:border-linea-fuerte')}
                >
                  <span className="grid size-6 place-items-center rounded-full" style={{ background: x.colores.papel, boxShadow: `inset 0 0 0 1px ${x.colores['linea-fuerte']}` }}>
                    <span className="size-3 rounded-full" style={{ background: x.colores.marca }} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="-mx-2 grid gap-0.5 border-t border-linea px-0 pt-3">
            <Link to="/perfil" onClick={() => setAbierto(false)} className={opcion}>
              <Icono nombre="usuario" className="size-4 text-tinta-2" />
              {t('portal.configurar_perfil')}
            </Link>
            <button type="button" onClick={alSalir} className={opcion}>
              <Icono nombre="salir" className="size-4 text-tinta-2" />
              {t('portal.salir')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
