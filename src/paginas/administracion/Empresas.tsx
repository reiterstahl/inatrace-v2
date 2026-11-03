import { useDeferredValue, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { administracion, useAccionEmpresa, useCrearEmpresa } from '@/api/administracion';
import { consultas } from '@/api/consultas';
import { POR_PAGINA } from '@/api/productores';
import type { ApiCompanyListResponse } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { ESTADOS_EMPRESA, accionesEmpresa, destinosFusion, validarNombreEmpresa, type AccionEmpresa, type EstadoEmpresa } from '@/util/administracion';
import { elegirEmpresa } from '@/util/empresa';

const TONO_ESTADO: Record<EstadoEmpresa, string> = {
  ACTIVE: 'bg-ok-suave text-ok',
  REGISTERED: 'bg-aviso-suave text-aviso',
  DEACTIVATED: 'bg-superficie-2 text-tinta-3',
};

type AvisoPantalla = { tono: 'mal' | 'ok'; texto: string } | null;

/**
 * Empresas de la instancia: buscar, crear, activar, desactivar, fusionar y abrir una para trabajar
 * con ella (la ficha, sus personas, instalaciones…). La regional ve solo las suyas y solo activa.
 */
export function EmpresasAdministracion() {
  const { t } = useTranslation();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const sistema = yo.role === 'SYSTEM_ADMIN';
  const [texto, setTexto] = useState('');
  const busqueda = useDeferredValue(texto);
  const [estado, setEstado] = useState<EstadoEmpresa | ''>('');
  const [pagina, setPagina] = useState(1);
  const consulta = useQuery(administracion.empresas({ texto: busqueda, estado: estado || undefined, pagina }, sistema));
  const accion = useAccionEmpresa();
  const [aviso, setAviso] = useState<AvisoPantalla>(null);
  const [creando, setCreando] = useState(false);
  const [fusionando, setFusionando] = useState<number | null>(null);
  const qc = useQueryClient();
  const navegar = useNavigate();

  const items = consulta.data?.items ?? [];
  const total = consulta.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  async function abrir(id: number) {
    elegirEmpresa(id);
    // Lo cargado de la empresa anterior no sirve para la nueva.
    void qc.invalidateQueries({ queryKey: ['productores'] });
    await navegar({ to: '/empresa' });
  }

  async function ejecutar(e: ApiCompanyListResponse, a: Exclude<AccionEmpresa, 'MERGE_TO_COMPANY'>) {
    if (!window.confirm(t(`administracion.empresas.${a}_pregunta`, { nombre: e.name }))) return;
    setAviso(null);
    try {
      await accion.mutateAsync({ accion: a, empresa: e.id! });
      setAviso({ tono: 'ok', texto: t(`administracion.empresas.${a}_hecho`, { nombre: e.name }) });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  return (
    <div className="grid gap-5">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Campo etiqueta={t('administracion.empresas.buscar')} type="search" placeholder={t('administracion.empresas.buscar_placeholder')} value={texto} onChange={(e) => { setTexto(e.target.value); setPagina(1); }} className="sm:w-64" />
          <Selector etiqueta={t('administracion.empresas.estado')} value={estado} onChange={(e) => { setEstado(e.target.value as EstadoEmpresa | ''); setPagina(1); }} className="sm:w-44">
            <option value="">{t('administracion.empresas.todos')}</option>
            {ESTADOS_EMPRESA.map((s) => <option key={s} value={s}>{t(`administracion.estado.${s}`)}</option>)}
          </Selector>
        </div>
        {sistema && !creando && (
          <Boton onClick={() => { setAviso(null); setCreando(true); }}>
            <Icono nombre="mas" className="size-4" /> {t('administracion.empresas.nueva')}
          </Boton>
        )}
      </div>
      {creando && <NuevaEmpresa cerrar={() => setCreando(false)} abrir={abrir} />}

      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} />
      ) : items.length === 0 ? (
        <p className="text-tinta-3">{busqueda.trim() || estado ? t('administracion.empresas.sin_resultados') : t('administracion.empresas.vacio')}</p>
      ) : (
        <>
          <ul className="grid gap-3">
            {items.map((e) => {
              const acciones = accionesEmpresa(e.status, yo.role);
              return (
                <li key={e.id} aria-label={e.name} className="grid gap-3 rounded-caja border border-linea bg-superficie p-4 shadow-suave">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="font-semibold break-words">{e.name}</span>
                      {e.status && <span className={'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ' + TONO_ESTADO[e.status]}>{t(`administracion.estado.${e.status}`)}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Boton chico variante="secundario" onClick={() => void abrir(e.id!)} aria-label={t('administracion.empresas.abrir_de', { nombre: e.name })}>
                        <Icono nombre="flecha" className="size-4" /> {t('administracion.empresas.abrir')}
                      </Boton>
                      {acciones.includes('ACTIVATE_COMPANY') && (
                        <Boton chico variante="secundario" disabled={accion.isPending} onClick={() => void ejecutar(e, 'ACTIVATE_COMPANY')} aria-label={t('administracion.empresas.activar_de', { nombre: e.name })}>
                          <Icono nombre="ok" className="size-4" /> {t('administracion.empresas.activar')}
                        </Boton>
                      )}
                      {acciones.includes('DEACTIVATE_COMPANY') && (
                        <Boton chico variante="fantasma" disabled={accion.isPending} onClick={() => void ejecutar(e, 'DEACTIVATE_COMPANY')} aria-label={t('administracion.empresas.desactivar_de', { nombre: e.name })}>
                          {t('administracion.empresas.desactivar')}
                        </Boton>
                      )}
                      {acciones.includes('MERGE_TO_COMPANY') && fusionando !== e.id && (
                        <Boton chico variante="fantasma" onClick={() => { setAviso(null); setFusionando(e.id!); }} aria-label={t('administracion.empresas.fusionar_de', { nombre: e.name })}>
                          {t('administracion.empresas.fusionar')}
                        </Boton>
                      )}
                    </div>
                  </div>
                  {fusionando === e.id && <Fusion origen={e} cerrar={(texto) => { setFusionando(null); if (texto) setAviso({ tono: 'ok', texto }); }} />}
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

/** Empresa nueva con solo el nombre; después se abre su ficha para completarla. */
function NuevaEmpresa({ cerrar, abrir }: { cerrar: () => void; abrir: (id: number) => Promise<void> }) {
  const { t } = useTranslation();
  const crear = useCrearEmpresa();
  const [nombre, setNombre] = useState('');
  const [intento, setIntento] = useState(false);
  const [falla, setFalla] = useState('');
  const error = intento ? validarNombreEmpresa(nombre) : null;

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setIntento(true);
    if (validarNombreEmpresa(nombre)) return;
    setFalla('');
    try {
      await abrir(await crear.mutateAsync(nombre));
    } catch (x) {
      setFalla((x as Error).message);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-3 rounded-caja border border-linea bg-superficie p-4 shadow-suave" aria-label={t('administracion.empresas.nueva')}>
      <p className="text-sm text-tinta-2">{t('administracion.empresas.nueva_ayuda')}</p>
      {falla && <Aviso tono="mal">{falla}</Aviso>}
      <Campo etiqueta={t('administracion.empresas.nombre')} value={nombre} onChange={(e) => setNombre(e.target.value)} error={error ? t(`administracion.empresas.nombre_${error}`) : undefined} autoFocus className="sm:max-w-md" />
      <div className="flex gap-2">
        <Boton type="submit" disabled={crear.isPending}>{t('administracion.empresas.crear')}</Boton>
        <Boton type="button" variante="secundario" onClick={cerrar}>{t('comun.cancelar')}</Boton>
      </div>
    </form>
  );
}

/** Pasa las personas de la empresa a otra activa y desactiva la de origen (lo hace el backend). */
function Fusion({ origen, cerrar }: { origen: ApiCompanyListResponse; cerrar: (texto?: string) => void }) {
  const { t } = useTranslation();
  const [texto, setTexto] = useState('');
  const busqueda = useDeferredValue(texto);
  const [destino, setDestino] = useState('');
  const activas = useQuery(administracion.activas(busqueda));
  const accion = useAccionEmpresa();
  const [falla, setFalla] = useState('');
  const opciones = destinosFusion(activas.data ?? [], origen.id!);
  const elegida = opciones.find((o) => String(o.id) === destino);

  async function fusionar() {
    if (!elegida || !window.confirm(t('administracion.empresas.fusionar_pregunta', { origen: origen.name, destino: elegida.name }))) return;
    setFalla('');
    try {
      await accion.mutateAsync({ accion: 'MERGE_TO_COMPANY', empresa: origen.id!, destino: elegida.id });
      cerrar(t('administracion.empresas.fusionar_hecho', { origen: origen.name, destino: elegida.name }));
    } catch (x) {
      setFalla((x as Error).message);
    }
  }

  return (
    <div className="grid gap-3 border-t border-linea pt-3">
      <p className="text-sm text-tinta-2">{t('administracion.empresas.fusionar_ayuda', { nombre: origen.name })}</p>
      {falla && <Aviso tono="mal">{falla}</Aviso>}
      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta={t('administracion.empresas.buscar_destino')} type="search" value={texto} onChange={(e) => { setTexto(e.target.value); setDestino(''); }} className="sm:w-56" />
        <Selector etiqueta={t('administracion.empresas.destino')} value={destino} onChange={(e) => setDestino(e.target.value)} className="sm:w-64">
          <option value="">{activas.isPending ? t('comun.cargando') : t('administracion.empresas.elegir_destino')}</option>
          {opciones.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Selector>
      </div>
      <div className="flex gap-2">
        <Boton chico disabled={!elegida || accion.isPending} onClick={() => void fusionar()}>{t('administracion.empresas.fusionar')}</Boton>
        <Boton chico variante="secundario" onClick={() => cerrar()}>{t('comun.cancelar')}</Boton>
      </div>
    </div>
  );
}
