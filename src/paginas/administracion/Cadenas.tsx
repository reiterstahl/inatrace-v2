import { useDeferredValue, useState } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { cadenas, useBorrarCadena, useEstadoCadena } from '@/api/cadenas';
import { consultas } from '@/api/consultas';
import { POR_PAGINA } from '@/api/productores';
import type { ApiValueChain } from '@/api/gen/types.gen';
import { Boton, clasesBoton } from '@/componentes/ui/Boton';
import { Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { permisosCadena } from '@/util/cadena';

const ruta = getRouteApi('/portal/administracion/cadenas/');

/**
 * Cadenas de valor de la instancia: qué tipos de instalación, unidades, evidencias, campos y
 * semiproductos usa cada una. La regional puede crearlas; el resto es de la administración del sistema.
 */
export function CadenasAdministracion() {
  const { t } = useTranslation();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const { guardada } = ruta.useSearch();
  const [texto, setTexto] = useState('');
  const busqueda = useDeferredValue(texto);
  const [estado, setEstado] = useState<'ENABLED' | 'DISABLED' | ''>('');
  const [pagina, setPagina] = useState(1);
  const consulta = useQuery(cadenas.lista({ texto: busqueda, estado: estado || undefined, pagina }));
  const cambiarEstado = useEstadoCadena();
  const borrar = useBorrarCadena();
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'mal'; texto: string } | null>(guardada ? { tono: 'ok', texto: t('administracion.cadenas.guardada', { nombre: guardada }) } : null);

  const items = consulta.data?.items ?? [];
  const total = consulta.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  async function estadoDe(c: ApiValueChain, activar: boolean) {
    const clave = activar ? 'activar' : 'desactivar';
    if (!window.confirm(t(`administracion.cadenas.${clave}_pregunta`, { nombre: c.name }))) return;
    setAviso(null);
    try {
      await cambiarEstado.mutateAsync({ id: c.id!, activar });
      setAviso({ tono: 'ok', texto: t(`administracion.cadenas.${clave}_hecho`, { nombre: c.name }) });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  async function eliminar(c: ApiValueChain) {
    if (!window.confirm(t('administracion.cadenas.borrar_pregunta', { nombre: c.name }))) return;
    setAviso(null);
    try {
      await borrar.mutateAsync(c.id!);
      setAviso({ tono: 'ok', texto: t('administracion.cadenas.borrada', { nombre: c.name }) });
    } catch (x) {
      // El backend responde un error genérico si la cadena está en uso (H30): se explica la causa probable.
      const m = (x as Error).message;
      setAviso({ tono: 'mal', texto: /invalid value chain id/i.test(m) ? m : t('administracion.cadenas.no_se_borra', { nombre: c.name }) });
    }
  }

  return (
    <div className="grid gap-5">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Campo etiqueta={t('administracion.cadenas.buscar')} type="search" value={texto} onChange={(e) => { setTexto(e.target.value); setPagina(1); }} className="sm:w-64" />
          <Selector etiqueta={t('administracion.cadenas.estado')} value={estado} onChange={(e) => { setEstado(e.target.value as typeof estado); setPagina(1); }} className="sm:w-44">
            <option value="">{t('administracion.empresas.todos')}</option>
            <option value="ENABLED">{t('administracion.cadenas.ENABLED')}</option>
            <option value="DISABLED">{t('administracion.cadenas.DISABLED')}</option>
          </Selector>
        </div>
        {permisosCadena(yo.role).crear && (
          <Link to="/administracion/cadenas/nueva" className={clasesBoton('primario')}>
            <Icono nombre="mas" className="size-4" /> {t('administracion.cadenas.nueva')}
          </Link>
        )}
      </div>

      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} />
      ) : items.length === 0 ? (
        <p className="text-tinta-3">{busqueda.trim() || estado ? t('administracion.cadenas.sin_resultados') : t('administracion.cadenas.vacio')}</p>
      ) : (
        <>
          <ul className="grid gap-3">
            {items.map((c) => {
              const p = permisosCadena(yo.role, c);
              return (
                <li key={c.id} aria-label={c.name} className="flex flex-wrap items-center justify-between gap-3 rounded-caja border border-linea bg-superficie p-4 shadow-suave">
                  <Link to="/administracion/cadenas/$id" params={{ id: String(c.id) }} className="grid min-w-0 gap-0.5 hover:text-marca">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold break-words">{c.name}</span>
                      <span className={'rounded-full px-2.5 py-0.5 text-xs font-semibold ' + (c.valueChainStatus === 'DISABLED' ? 'bg-superficie-2 text-tinta-3' : 'bg-ok-suave text-ok')}>{t(`administracion.cadenas.${c.valueChainStatus ?? 'ENABLED'}`)}</span>
                    </span>
                    {c.description && <span className="line-clamp-2 text-sm text-tinta-2">{c.description}</span>}
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    {p.activar && <Boton chico variante="secundario" disabled={cambiarEstado.isPending} onClick={() => void estadoDe(c, true)} aria-label={t('administracion.cadenas.activar_de', { nombre: c.name })}>{t('administracion.cadenas.activar')}</Boton>}
                    {p.desactivar && <Boton chico variante="fantasma" disabled={cambiarEstado.isPending} onClick={() => void estadoDe(c, false)} aria-label={t('administracion.cadenas.desactivar_de', { nombre: c.name })}>{t('administracion.cadenas.desactivar')}</Boton>}
                    {p.borrar && (
                      <Boton chico variante="fantasma" disabled={borrar.isPending} onClick={() => void eliminar(c)} aria-label={t('administracion.cadenas.borrar_de', { nombre: c.name })}>
                        <Icono nombre="borrar" className="size-4" />
                      </Boton>
                    )}
                  </div>
                </li>
              );
            })}
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
  );
}
