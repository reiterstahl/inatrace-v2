import { useDeferredValue, useState } from 'react';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { monedas, useEstadoMoneda } from '@/api/ajustes';
import { consultas } from '@/api/consultas';
import { POR_PAGINA } from '@/api/productores';
import type { ApiCurrencyType } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Campo } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { permisosMoneda } from '@/util/ajustes';
import { Tarjeta } from '../productos/piezas';

const OPCION = 'h-9 rounded-lg px-3.5 text-sm font-semibold';

/**
 * Monedas de la instancia: las activas son las que las empresas pueden elegir. Activar lo puede
 * también la regional; desactivar, solo la administración del sistema (como el backend).
 */
export function MonedasAdministracion() {
  const { t } = useTranslation();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const permisos = permisosMoneda(yo.role);
  const [activas, setActivas] = useState(true);
  const [texto, setTexto] = useState('');
  const busqueda = useDeferredValue(texto);
  const [pagina, setPagina] = useState(1);
  const consulta = useQuery(monedas.lista({ activas, texto: busqueda, pagina }));
  const estado = useEstadoMoneda();
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'mal'; texto: string } | null>(null);
  const items = consulta.data?.items ?? [];
  const total = consulta.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  async function cambiar(m: ApiCurrencyType, activar: boolean) {
    setAviso(null);
    try {
      await estado.mutateAsync({ id: m.id!, activar });
      setAviso({ tono: 'ok', texto: t(activar ? 'administracion.monedas.activada' : 'administracion.monedas.desactivada', { moneda: `${m.code} · ${m.label}` }) });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  return (
    <div className="grid gap-5">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <Tarjeta id="monedas" titulo={t('administracion.monedas.titulo')} ayuda={`${t('administracion.monedas.ayuda')} ${t('administracion.monedas.ayuda_activar')}`}>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div role="group" aria-label={t('administracion.monedas.cuales')} className="inline-flex rounded-xl bg-superficie-2 p-1">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" aria-pressed={activas === v} onClick={() => { setActivas(v); setPagina(1); }} className={OPCION + (activas === v ? ' bg-superficie text-tinta shadow-suave' : ' text-tinta-2')}>
                  {t(v ? 'administracion.monedas.activas' : 'administracion.monedas.desactivadas')}
                </button>
              ))}
            </div>
            <Campo etiqueta={t('administracion.monedas.buscar')} type="search" placeholder={t('administracion.monedas.buscar_placeholder')} value={texto} onChange={(e) => { setTexto(e.target.value); setPagina(1); }} className="sm:w-64" />
          </div>
          {consulta.isPending ? (
            <Cargando />
          ) : consulta.isError ? (
            <EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} />
          ) : items.length === 0 ? (
            <p className="text-tinta-3">{t('administracion.monedas.vacio')}</p>
          ) : (
            <>
              <p className="text-sm text-tinta-3">{t('administracion.monedas.total', { count: total })}</p>
              <ul className="divide-y divide-linea" aria-label={t(activas ? 'administracion.monedas.activas' : 'administracion.monedas.desactivadas')}>
                {items.map((m) => (
                  <li key={m.id} aria-label={`${m.code} · ${m.label}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-12 shrink-0 font-mono text-sm font-semibold">{m.code}</span>
                      <span className="break-words">{m.label}</span>
                    </span>
                    {activas
                      ? permisos.desactivar && <Boton chico variante="fantasma" disabled={estado.isPending} onClick={() => void cambiar(m, false)} aria-label={t('administracion.monedas.desactivar_de', { moneda: m.code })}>{t('administracion.monedas.desactivar')}</Boton>
                      : permisos.activar && (
                          // Activar hace que el backend actualice los tipos de cambio con un servicio externo: puede tardar.
                          <Boton chico variante="secundario" disabled={estado.isPending} onClick={() => void cambiar(m, true)} aria-label={t('administracion.monedas.activar_de', { moneda: m.code })}>
                            <Icono nombre="ok" className="size-4" /> {estado.isPending && estado.variables?.id === m.id ? t('administracion.monedas.activando') : t('administracion.monedas.activar')}
                          </Boton>
                        )}
                  </li>
                ))}
              </ul>
              {paginas > 1 && (
                <nav aria-label={t('productos.lotes.paginas')} className="flex items-center justify-end gap-2 text-sm">
                  <Boton chico variante="secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} aria-label={t('productos.lotes.anterior')}><Icono nombre="izquierda" className="size-4" /></Boton>
                  <span>{pagina} / {paginas}</span>
                  <Boton chico variante="secundario" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)} aria-label={t('productos.lotes.siguiente')}><Icono nombre="derecha" className="size-4" /></Boton>
                </nav>
              )}
            </>
          )}
        </div>
      </Tarjeta>
    </div>
  );
}
