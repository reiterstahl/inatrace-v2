import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { subirDocumento } from '@/api/productores';
import type { ApiDocument } from '@/api/gen/types.gen';
import { urlDocumento } from '@/api/respuesta';
import { Boton } from '@/componentes/ui/Boton';
import { Icono } from '@/componentes/ui/Icono';

/** Tarjeta de una sección de las pestañas del producto, con ancla. */
export function Tarjeta({ id, titulo, ayuda, acciones, children }: { id: string; titulo: ReactNode; ayuda?: ReactNode; acciones?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-24 rounded-caja border border-linea bg-superficie p-5 shadow-suave sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-titulo`} className="font-titulo text-xl font-semibold">{titulo}</h2>
          {ayuda && <p className="mt-1 text-sm text-tinta-2">{ayuda}</p>}
        </div>
        {acciones}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Casilla({ marcada, alCambiar, children, deshabilitada }: { marcada: boolean; alCambiar: (v: boolean) => void; children: ReactNode; deshabilitada?: boolean }) {
  return (
    <label className={clsx('flex items-start gap-3 text-sm', deshabilitada ? 'cursor-default' : 'cursor-pointer')}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--marca)]" checked={marcada} disabled={deshabilitada} onChange={(e) => alCambiar(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** Barra fija para guardar los cambios de la pestaña. */
export function BarraGuardar({ texto, guardando, alGuardar, deshabilitado }: { texto: ReactNode; guardando: boolean; alGuardar: () => void; deshabilitado?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-superficie/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="text-sm text-tinta-2">{texto}</p>
        <Boton onClick={alGuardar} disabled={guardando || deshabilitado}>
          <Icono nombre="ok" className="size-4" /> {guardando ? t('productores.ficha.guardando') : t('comun.guardar')}
        </Boton>
      </div>
    </div>
  );
}

/** Color con selector y texto (#rrggbb). */
export function CampoColor({ etiqueta, valor, alCambiar, error, deshabilitado }: { etiqueta: string; valor: string; alCambiar: (v: string) => void; error?: string; deshabilitado?: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-tinta-2">{etiqueta}</label>
      <span className={clsx('flex h-11 items-center gap-2 rounded-lg border bg-superficie px-2', error ? 'border-mal' : 'border-linea-fuerte')}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(valor) ? valor : '#000000'} onChange={(e) => alCambiar(e.target.value)} disabled={deshabilitado} aria-label={t('productos.vitrina.elegir_color', { color: etiqueta })} className={clsx('size-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-default', !/^#[0-9a-f]{6}$/i.test(valor) && 'opacity-25')} />
        <input id={id} value={valor} onChange={(e) => alCambiar(e.target.value.trim())} disabled={deshabilitado} placeholder="#rrggbb" aria-invalid={error ? true : undefined} className="min-w-0 flex-1 bg-transparent font-mono text-sm focus:outline-none" />
      </span>
      {error && <p className="text-sm text-mal" role="alert">{error}</p>}
    </div>
  );
}

/**
 * Archivo subido al backend (imagen o tipografía), con vista previa si es imagen. `tipos` filtra por
 * extensión porque los navegadores no siempre reconocen el tipo de las tipografías.
 */
export function CampoArchivo({ etiqueta, ayuda, doc, alCambiar, tipos, imagen, deshabilitado }: { etiqueta: string; ayuda?: string; doc: ApiDocument | null; alCambiar: (d: ApiDocument | null) => void; tipos: string[]; imagen?: boolean; deshabilitado?: boolean }) {
  const { t } = useTranslation();
  const [estado, setEstado] = useState<{ subiendo?: boolean; error?: string }>({});
  async function subir(archivo?: File) {
    if (!archivo) return;
    const ext = archivo.name.split('.').pop()?.toLowerCase() ?? '';
    if (!tipos.includes(ext)) {
      setEstado({ error: t('productos.vitrina.archivo_tipo', { tipos: tipos.join(', ').toUpperCase() }) });
      return;
    }
    setEstado({ subiendo: true });
    try {
      alCambiar(await subirDocumento(archivo));
      setEstado({});
    } catch (e) {
      setEstado({ error: (e as Error).message });
    }
  }
  return (
    <div className="grid content-start gap-1.5">
      <span className="text-sm font-semibold text-tinta-2">{etiqueta}</span>
      <div className="flex flex-wrap items-center gap-3">
        {imagen && doc?.storageKey ? (
          <img src={urlDocumento(doc.storageKey)} alt={etiqueta} className="h-16 w-24 rounded-lg border border-linea bg-superficie-2 object-cover" />
        ) : doc ? (
          <span className="inline-flex max-w-56 items-center gap-1.5 truncate rounded-lg bg-superficie-2 px-3 py-2 text-sm">{doc.name ?? doc.storageKey}</span>
        ) : (
          <span className="text-sm text-tinta-3">{t('productos.vitrina.sin_archivo')}</span>
        )}
        {!deshabilitado && (
          <>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-linea-fuerte px-3 text-sm font-semibold text-tinta-2 hover:border-marca hover:text-marca">
              <Icono nombre="subir" className="size-4" /> {estado.subiendo ? t('comun.cargando') : doc ? t('productos.vitrina.cambiar') : t('productos.vitrina.subir')}
              <input type="file" accept={tipos.map((x) => '.' + x).join(',')} className="sr-only" aria-label={etiqueta} onChange={(e) => void subir(e.target.files?.[0])} />
            </label>
            {doc && (
              <button type="button" onClick={() => alCambiar(null)} className="rounded-md p-2 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('productos.vitrina.quitar', { que: etiqueta })}>
                <Icono nombre="borrar" className="size-4" />
              </button>
            )}
          </>
        )}
      </div>
      {estado.error ? <p className="text-sm text-mal" role="alert">{estado.error}</p> : ayuda ? <p className="text-sm text-tinta-3">{ayuda}</p> : null}
    </div>
  );
}
