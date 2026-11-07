import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { TEMAS, useTema } from '@/util/tema';
import type { DefTema, Modo } from '@/util/temas';
import { Icono } from './Icono';

/** Miniatura del tema con sus propios colores: fondo, una tarjeta con texto y un botón de la marca. */
function Muestra({ tema }: { tema: DefTema }) {
  const c = tema.colores;
  return (
    <span aria-hidden="true" className="block overflow-hidden rounded-lg" style={{ background: c.papel }}>
      <span className="flex items-center gap-1.5 px-2.5 py-2" style={{ background: c.superficie, borderBottom: `1px solid ${c.linea}` }}>
        <span className="size-2.5 rounded-full" style={{ background: c.marca }} />
        <span className="h-1.5 w-8 rounded-full" style={{ background: c['tinta-3'] }} />
      </span>
      <span className="grid gap-1.5 p-2.5">
        <span className="grid gap-1 rounded-md p-2" style={{ background: c.superficie, border: `1px solid ${c.linea}` }}>
          <span className="h-1.5 w-3/4 rounded-full" style={{ background: c.tinta }} />
          <span className="h-1.5 w-1/2 rounded-full" style={{ background: c['tinta-2'] }} />
        </span>
        <span className="flex gap-1.5">
          <span className="h-3.5 w-10 rounded" style={{ background: c.marca }} />
          <span className="h-3.5 w-6 rounded" style={{ background: c['marca-suave'] }} />
          <span className="h-3.5 w-4 rounded" style={{ background: c.acento }} />
        </span>
      </span>
    </span>
  );
}

/** Los temas claros y oscuros para elegir; se aplican al instante y se guardan en este navegador. */
export function SelectorTema() {
  const { t } = useTranslation();
  const [actual, , , elegir] = useTema();
  return (
    <div className="grid gap-6">
      {(['claro', 'oscuro'] as Modo[]).map((modo) => (
        <fieldset key={modo} className="grid gap-3">
          <legend className="mb-3 text-sm font-semibold text-tinta-2">{t(modo === 'claro' ? 'perfil.apariencia.claros' : 'perfil.apariencia.oscuros')}</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TEMAS.filter((x) => x.modo === modo).map((tema) => {
              const activo = tema.id === actual;
              return (
                <label key={tema.id} className="group cursor-pointer">
                  <input type="radio" name="tema" value={tema.id} checked={activo} onChange={() => elegir(tema.id)} className="peer sr-only" />
                  <span className={clsx('block rounded-xl border-2 p-1 transition group-hover:border-linea-fuerte peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foco', activo ? 'border-marca group-hover:border-marca' : 'border-linea')}>
                    <Muestra tema={tema} />
                  </span>
                  <span className={clsx('mt-1.5 flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium', activo ? 'bg-marca-suave text-marca' : 'text-tinta-2')}>
                    {activo && <Icono nombre="ok" className="size-3.5 shrink-0" />}
                    {t(`perfil.apariencia.temas.${tema.id}`)}
                    {activo && <span className="sr-only">({t('perfil.apariencia.activo')})</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
