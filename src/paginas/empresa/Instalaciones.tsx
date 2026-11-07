import { Suspense, lazy, useMemo, useState } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { instalaciones as consultas, useBorrarInstalacion, useEstadoInstalacion } from '@/api/instalaciones';
import type { ApiFacility } from '@/api/gen/types.gen';
import { clasesBoton } from '@/componentes/ui/Boton';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { lugarInstalacion, nombreInstalacion } from '@/util/instalacion';
import { Tarjeta } from '../productos/piezas';
import { useEmpresaVista } from './Marco';
import { confirmar } from '@/componentes/ui/Confirmar';

const MapaConteos = lazy(() => import('@/componentes/mapa/MapaConteos'));
const ruta = getRouteApi('/portal/empresa/instalaciones/');

/**
 * Instalaciones de la empresa (también las desactivadas). Crear, editar, activar, desactivar y
 * borrar lo hace la administración de la empresa o del sistema. Borrar es nuevo respecto de la versión
 * actual: el backend solo lo permite si la instalación no tiene movimientos.
 */
export function InstalacionesEmpresa() {
  const { t } = useTranslation();
  const { id, editable } = useEmpresaVista();
  const { guardada } = ruta.useSearch();
  const lista = useQuery(consultas.todas(id));
  const estado = useEstadoInstalacion();
  const borrar = useBorrarInstalacion();
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok'; texto: string } | null>(guardada ? { tono: 'ok', texto: t('empresa.instalaciones.guardada', { nombre: guardada }) } : null);
  const items = lista.data ?? [];
  const puntos = useMemo(
    () => items.flatMap((i) => {
      const l = i.facilityLocation;
      return l?.publiclyVisible && l.latitude != null && l.longitude != null ? [{ lat: l.latitude, lng: l.longitude, n: 1 }] : [];
    }),
    [items],
  );

  async function ejecutar(fn: () => Promise<unknown>, ok: string) {
    setAviso(null);
    try {
      await fn();
      setAviso({ tono: 'ok', texto: ok });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  async function cambiarEstado(i: ApiFacility) {
    const nombre = nombreInstalacion(i);
    if (!i.deactivated && !(await confirmar(t('empresa.instalaciones.desactivar_pregunta', { nombre }), { accion: 'desactivar' }))) return;
    void ejecutar(() => estado.mutateAsync({ id: i.id!, activa: !!i.deactivated }), t(i.deactivated ? 'empresa.instalaciones.activada' : 'empresa.instalaciones.desactivada', { nombre }));
  }

  async function eliminar(i: ApiFacility) {
    const nombre = nombreInstalacion(i);
    if (!(await confirmar(t('empresa.instalaciones.borrar_pregunta', { nombre }), { accion: 'eliminar' }))) return;
    void ejecutar(() => borrar.mutateAsync(i.id!), t('empresa.instalaciones.borrada', { nombre }));
  }

  return (
    <div className="grid gap-5">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <Tarjeta
        id="instalaciones"
        titulo={t('empresa.instalaciones.titulo')}
        ayuda={editable ? t('empresa.instalaciones.ayuda') : t('empresa.instalaciones.ayuda_lectura')}
        acciones={editable && (
          <Link to="/empresa/instalaciones/nueva" className={clasesBoton('primario', true)}>
            <Icono nombre="mas" className="size-4" /> {t('empresa.instalaciones.nueva')}
          </Link>
        )}
      >
        {lista.isPending ? (
          <Cargando />
        ) : lista.isError ? (
          <EstadoError texto={lista.error.message} reintentar={() => void lista.refetch()} />
        ) : items.length === 0 ? (
          <p className="text-sm text-tinta-3">{t('empresa.instalaciones.vacio')}</p>
        ) : (
          <ul className="grid gap-3">
            {items.map((i) => (
              <li key={i.id} aria-label={nombreInstalacion(i)} className={clsx('flex flex-wrap items-start justify-between gap-3 rounded-lg border border-linea p-4', i.deactivated && 'bg-superficie-2')}>
                <div className="grid min-w-0 gap-1">
                  <p className={clsx('font-semibold break-words', i.deactivated && 'text-tinta-3')}>{nombreInstalacion(i)}</p>
                  <p className="text-sm text-tinta-2">{[i.facilityType?.label, lugarInstalacion(i)].filter(Boolean).join(' · ')}</p>
                  <p className="flex flex-wrap gap-2 text-xs">
                    {i.deactivated && <span className="rounded-full bg-mal-suave px-2 py-0.5 font-semibold text-mal">{t('empresa.instalaciones.desactivada_chip')}</span>}
                    {i.isCollectionFacility && <span className="rounded-full bg-marca-suave px-2 py-0.5 font-semibold text-marca">{t('empresa.instalaciones.acopio_chip')}</span>}
                    {i.isPublic && <span className="rounded-full bg-marca-suave px-2 py-0.5 font-semibold text-marca">{t('empresa.instalaciones.vende_chip')}</span>}
                  </p>
                </div>
                {editable && (
                  <div className="flex flex-wrap gap-1">
                    <Link to="/empresa/instalaciones/$instalacion" params={{ instalacion: String(i.id) }} className={clasesBoton('fantasma', true)}>
                      <Icono nombre="editar" className="size-4" /> {t('comun.editar')}
                    </Link>
                    <Boton chico variante="fantasma" onClick={() => cambiarEstado(i)} disabled={estado.isPending}>
                      {i.deactivated ? t('empresa.instalaciones.activar') : t('empresa.instalaciones.desactivar')}
                    </Boton>
                    <Boton chico variante="fantasma" onClick={() => eliminar(i)} disabled={borrar.isPending} aria-label={t('empresa.instalaciones.borrar', { nombre: nombreInstalacion(i) })}>
                      <Icono nombre="borrar" className="size-4" />
                    </Boton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
      {puntos.length > 0 && (
        <Tarjeta id="mapa-instalaciones" titulo={t('empresa.instalaciones.mapa')} ayuda={t('empresa.instalaciones.mapa_ayuda')}>
          <Suspense fallback={<div className="h-80 rounded-caja bg-superficie-2" />}>
            <MapaConteos puntos={puntos} etiqueta={t('empresa.instalaciones.mapa')} />
          </Suspense>
        </Tarjeta>
      )}
    </div>
  );
}
