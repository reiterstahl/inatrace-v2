import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Boton } from '@/componentes/ui/Boton';
import { Selector } from '@/componentes/ui/Campo';
import { Icono } from '@/componentes/ui/Icono';

/** Pregunta de sí o no, sin respuesta marcada hasta que se elige (como la versión actual). */
export function SiNo({ etiqueta, ayuda, valor, alCambiar, error }: { etiqueta: string; ayuda?: string; valor: boolean | null; alCambiar: (v: boolean) => void; error?: string }) {
  const { t } = useTranslation();
  return (
    <fieldset className="grid gap-1.5" aria-invalid={error ? true : undefined}>
      <legend className="text-sm font-semibold text-tinta-2">{etiqueta} <span className="text-mal" aria-hidden>*</span></legend>
      <div className="flex gap-4">
        {([true, false] as const).map((v) => (
          <label key={String(v)} className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" className="size-4 accent-[var(--marca)]" checked={valor === v} onChange={() => alCambiar(v)} />
            {v ? t('comun.si') : t('comun.no')}
          </label>
        ))}
      </div>
      {error ? <p className="text-sm text-mal" role="alert">{error}</p> : ayuda ? <p className="text-sm text-tinta-3">{ayuda}</p> : null}
    </fieldset>
  );
}

/** Lista de elementos elegidos (como fichas) y un selector para sumar otro. */
/** Con `soloAgregar` solo muestra el selector (la lista elegida la dibuja quien la usa). */
export function Fichas({ etiqueta, requerido, error, vacio, elegidos, opciones, alAgregar, alQuitar, soloAgregar }: {
  etiqueta: string;
  requerido?: boolean;
  error?: string;
  vacio?: string;
  elegidos: { id: number; nombre: string }[];
  opciones: { id: number; nombre: string }[];
  alAgregar: (id: number) => void;
  alQuitar: (id: number) => void;
  soloAgregar?: boolean;
}) {
  const { t } = useTranslation();
  const [elegida, setElegida] = useState('');
  const disponibles = opciones.filter((o) => !elegidos.some((e) => e.id === o.id));
  const req: ReactNode = requerido ? <span className="text-mal" aria-hidden> *</span> : null;
  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold text-tinta-2">{etiqueta}{req}</span>
      {soloAgregar ? (
        vacio && <p className="text-sm text-tinta-3">{vacio}</p>
      ) : elegidos.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={etiqueta}>
          {elegidos.map((e) => (
            <li key={e.id} className="inline-flex items-center gap-1 rounded-full bg-marca-suave py-1 pr-1 pl-3 text-sm font-semibold text-marca">
              {e.nombre}
              <button type="button" onClick={() => alQuitar(e.id)} className="rounded-full p-1 hover:bg-marca/15" aria-label={t('empresa.quitar', { que: e.nombre })}>
                <Icono nombre="cerrar" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-tinta-3">{vacio ?? t('empresa.lista_vacia')}</p>
      )}
      {error && <p className="text-sm text-mal" role="alert">{error}</p>}
      {disponibles.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <Selector etiqueta={t('empresa.instalaciones.agregar_a', { que: etiqueta.toLowerCase() })} value={elegida} onChange={(e) => setElegida(e.target.value)} className="min-w-0 flex-1 sm:max-w-sm">
            <option value="">{t('stock.elegir')}</option>
            {disponibles.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </Selector>
          <Boton variante="secundario" disabled={!elegida} onClick={() => { alAgregar(Number(elegida)); setElegida(''); }} aria-label={t('empresa.instalaciones.agregar_a', { que: etiqueta.toLowerCase() })}>
            <Icono nombre="mas" className="size-4" /> {t('empresa.agregar')}
          </Boton>
        </div>
      )}
    </div>
  );
}
