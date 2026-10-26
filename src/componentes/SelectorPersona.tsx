import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getUserCustomersForCompanyAndType } from '@/api/gen/sdk.gen';
import type { ApiUserCustomer } from '@/api/gen/types.gen';
import { desenvolver } from '@/api/respuesta';
import { nombreCompleto, ubicacionCorta } from '@/util/productor';
import { Icono } from './ui/Icono';

/**
 * Buscador de productores o acopiadores de la empresa (combobox accesible, patrón ARIA 1.2):
 * busca en el servidor mientras se escribe, se maneja con flechas, Enter y Escape.
 */
export function SelectorPersona({
  empresa,
  tipo = 'FARMER',
  valor,
  alElegir,
  etiqueta,
  requerido,
  error,
}: {
  empresa: number;
  tipo?: 'FARMER' | 'COLLECTOR';
  valor: ApiUserCustomer | null;
  alElegir: (p: ApiUserCustomer | null) => void;
  etiqueta: string;
  requerido?: boolean;
  error?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [texto, setTexto] = useState('');
  const [buscado, setBuscado] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);

  // Espera breve: no se consulta por cada tecla.
  useEffect(() => {
    const espera = setTimeout(() => setBuscado(texto.trim()), 250);
    return () => clearTimeout(espera);
  }, [texto]);

  const resultados = useQuery({
    queryKey: ['personas', empresa, tipo, buscado],
    queryFn: async () => {
      // El backend busca por nombre o por apellido, no por los dos: se piden ambos y se unen.
      const pedir = (searchBy: 'BY_NAME' | 'BY_SURNAME') =>
        desenvolver(getUserCustomersForCompanyAndType({ path: { companyId: empresa, type: tipo }, query: { query: buscado || undefined, searchBy, limit: 8, sortBy: 'BY_NAME', sort: 'ASC' } }));
      const [porNombre, porApellido] = await Promise.all([pedir('BY_NAME'), buscado ? pedir('BY_SURNAME') : Promise.resolve({ items: [] })]);
      const unidos = new Map<number, ApiUserCustomer>();
      for (const p of [...(porNombre.items ?? []), ...(porApellido.items ?? [])]) if (p.id) unidos.set(p.id, p);
      return [...unidos.values()].sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b))).slice(0, 8);
    },
    enabled: abierto,
    staleTime: 30_000,
  });
  // Mientras lo escrito no coincide con lo buscado (espera breve o consulta en curso), la lista
  // mostrada es de otra búsqueda: no se puede elegir de ella con Enter.
  const alDia = buscado === texto.trim() && !resultados.isFetching;
  const lista = resultados.data ?? [];

  useEffect(() => {
    const fuera = (e: MouseEvent) => !caja.current?.contains(e.target as Node) && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  function elegir(p: ApiUserCustomer) {
    alElegir(p);
    setTexto('');
    setAbierto(false);
  }

  if (valor) {
    return (
      <div className="grid gap-1.5">
        <span className="text-sm font-semibold text-tinta-2">{etiqueta}{requerido && <span className="text-mal" aria-hidden="true"> *</span>}</span>
        <div className="flex h-11 items-center gap-3 rounded-lg border border-linea-fuerte bg-superficie-2 px-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-marca-suave text-xs font-bold text-marca">{(valor.name?.[0] ?? '') + (valor.surname?.[0] ?? '')}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{nombreCompleto(valor)}</span>
          <button type="button" onClick={() => alElegir(null)} className="rounded p-1 text-tinta-3 hover:text-mal" aria-label={t('selector_persona.cambiar', { nombre: nombreCompleto(valor) })}>
            <Icono nombre="cerrar" className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={caja} className="relative grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-tinta-2">{etiqueta}{requerido && <span className="text-mal" aria-hidden="true"> *</span>}</label>
      <div className="flex h-11 items-center gap-2 rounded-lg border border-linea-fuerte bg-superficie px-3 focus-within:border-marca focus-within:ring-3 focus-within:ring-marca/15 aria-[invalid=true]:border-mal" aria-invalid={!!error}>
        <Icono nombre="buscar" className="size-4 shrink-0 text-tinta-3" />
        <input
          id={id}
          role="combobox"
          aria-expanded={abierto}
          aria-controls={id + '-lista'}
          aria-autocomplete="list"
          aria-activedescendant={abierto && lista[activo] ? `${id}-op-${activo}` : undefined}
          aria-invalid={!!error}
          autoComplete="off"
          value={texto}
          placeholder={t('selector_persona.buscar')}
          onFocus={() => setAbierto(true)}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
            setActivo(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo((a) => Math.min(a + 1, lista.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); if (abierto && alDia && lista[activo]) elegir(lista[activo]); }
            else if (e.key === 'Escape') setAbierto(false);
          }}
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
      </div>
      {error && <p role="alert" className="text-sm text-mal">{error}</p>}
      {abierto && (
        <ul id={id + '-lista'} role="listbox" className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg bg-superficie p-1 shadow-alta ring-1 ring-linea">
          {resultados.isPending || !alDia ? (
            <li className="px-3 py-2 text-sm text-tinta-3">{t('comun.cargando')}</li>
          ) : lista.length === 0 ? (
            <li className="px-3 py-2 text-sm text-tinta-3">{t('selector_persona.sin_resultados')}</li>
          ) : (
            lista.map((p, i) => (
              <li
                key={p.id}
                id={`${id}-op-${i}`}
                role="option"
                aria-selected={i === activo}
                onMouseDown={(e) => { e.preventDefault(); elegir(p); }}
                onMouseEnter={() => setActivo(i)}
                className={'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 ' + (i === activo ? 'bg-marca-suave' : '')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{nombreCompleto(p)}</span>
                  <span className="block truncate text-xs text-tinta-3">{[p.farmerCompanyInternalId, ubicacionCorta(p.location?.address)].filter(Boolean).join(' · ') || `#${p.id}`}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
