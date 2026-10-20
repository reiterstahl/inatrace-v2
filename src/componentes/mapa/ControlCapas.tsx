import { useState } from 'react';
import type { Map as MapaGL } from 'maplibre-gl';
import { useTranslation } from 'react-i18next';
import type { ApiMapLayer } from '@/api/gen/types.gen';
import { Icono } from '@/componentes/ui/Icono';
import { mostrarCapa } from './base';

/** Botón con las capas del catálogo de la instalación (satélite, límites, etc.). */
export function ControlCapas({ mapa, capas }: { mapa: MapaGL | null; capas: ApiMapLayer[] }) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const [visibles, setVisibles] = useState(() => new Set(capas.filter((c) => c.visibleByDefault).map((c) => c.id)));
  if (!mapa || capas.length === 0) return null;
  return (
    <div className="absolute top-2.5 left-2.5 z-10">
      <button
        type="button"
        onClick={() => setAbierto((x) => !x)}
        aria-expanded={abierto}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-superficie px-3 text-sm font-semibold shadow-suave ring-1 ring-linea hover:bg-superficie-2"
      >
        <Icono nombre="mapa" className="size-4" /> {t('mapa.capas')}
      </button>
      {abierto && (
        <ul className="mt-1.5 grid w-64 gap-0.5 rounded-lg bg-superficie p-1.5 shadow-alta ring-1 ring-linea">
          {capas.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-superficie-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--marca)]"
                  checked={visibles.has(c.id)}
                  onChange={(e) => {
                    mostrarCapa(mapa, c, e.target.checked);
                    setVisibles((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(c.id);
                      else n.delete(c.id);
                      return n;
                    });
                  }}
                />
                <span className="min-w-0 flex-1 truncate">{c.label ?? c.code}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
