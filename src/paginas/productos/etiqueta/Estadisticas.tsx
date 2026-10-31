import { Suspense, lazy, useMemo } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { etiquetas } from '@/api/etiquetas';
import { lotes } from '@/api/lotes';
import { Cargando, EstadoError } from '@/componentes/ui/Estados';
import { ordenarConteos, puntosConteo } from '@/util/lote';
import { Tarjeta } from '../piezas';

const MapaConteos = lazy(() => import('@/componentes/mapa/MapaConteos'));
const ruta = getRouteApi('/portal/productos/$id/etiquetas/$etiqueta');

/**
 * Estadísticas de la etiqueta: visitas desde los QR (por país y ubicación) y las verificaciones de
 * autenticidad y de origen de sus lotes. El backend las agrega cada minuto a partir del registro de
 * visitas.
 */
export function EstadisticasEtiqueta() {
  const { t, i18n } = useTranslation();
  const id = Number(ruta.useParams().etiqueta);
  const etiqueta = useQuery(etiquetas.etiqueta(id));
  const uuid = etiqueta.data?.uuid ?? '';
  const consulta = useQuery({ ...lotes.estadisticas(uuid), enabled: !!uuid });
  const puntos = useMemo(() => puntosConteo(consulta.data?.visitsLocations), [consulta.data]);
  if (etiqueta.isPending || (uuid && consulta.isPending)) return <Cargando />;
  if (consulta.isError) return <EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} />;
  const s = consulta.data ?? {};
  const paises = ordenarConteos(s.visitsCountries);
  const maximo = Math.max(1, ...paises.map(([, n]) => n));
  const nombrePais = (codigo: string) => {
    try {
      return /^[A-Z]{2}$/.test(codigo) ? (new Intl.DisplayNames([i18n.language], { type: 'region' }).of(codigo) ?? codigo) : codigo;
    } catch {
      return codigo;
    }
  };
  const cifra = (n?: number) => (n ?? 0).toLocaleString(i18n.language);

  return (
    <div className="grid gap-5">
      <Tarjeta id="visitas" titulo={t('productos.estadisticas.visitas')} ayuda={t('productos.estadisticas.visitas_ayuda')}>
        <p className="font-titulo text-4xl font-semibold" aria-label={t('productos.estadisticas.visitas_total', { n: s.visits ?? 0 })}>{cifra(s.visits)}</p>
        {paises.length > 0 && (
          <ul className="mt-5 grid gap-2" aria-label={t('productos.estadisticas.por_pais')}>
            {paises.map(([pais, n]) => (
              <li key={pais} className="grid grid-cols-[minmax(6rem,12rem)_1fr_3rem] items-center gap-3 text-sm">
                <span className="truncate">{nombrePais(pais)}</span>
                <span className="h-2 rounded-full bg-marca" style={{ width: `${(n / maximo) * 100}%` }} />
                <span className="text-right font-semibold">{cifra(n)}</span>
              </li>
            ))}
          </ul>
        )}
        {puntos.length > 0 && (
          <div className="mt-5">
            <Suspense fallback={<div className="h-80 rounded-caja bg-superficie-2" />}>
              <MapaConteos puntos={puntos} etiqueta={t('productos.estadisticas.mapa')} />
            </Suspense>
          </div>
        )}
        {!s.visits && <p className="mt-2 text-sm text-tinta-3">{t('productos.estadisticas.sin_visitas')}</p>}
      </Tarjeta>

      <div className="grid gap-5 sm:grid-cols-2">
        {([['autenticidad', s.authTrue, s.authFalse], ['origen', s.originTrue, s.originFalse]] as const).map(([clave, si, no]) => (
          <Tarjeta key={clave} id={clave} titulo={t(`productos.estadisticas.${clave}`)} ayuda={t(`productos.estadisticas.${clave}_ayuda`)}>
            <dl className="grid grid-cols-3 gap-3 text-center">
              {([['total', (si ?? 0) + (no ?? 0)], ['correctas', si], ['fallidas', no]] as const).map(([k, n]) => (
                <div key={k} className="rounded-lg bg-superficie-2 p-3">
                  <dt className="text-xs font-semibold text-tinta-2">{t(`productos.estadisticas.${k}`)}</dt>
                  <dd className="mt-1 text-2xl font-semibold">{cifra(n)}</dd>
                </div>
              ))}
            </dl>
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}
