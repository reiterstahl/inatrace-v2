import { useId, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ordenes } from '@/api/ordenes';
import { stock } from '@/api/stock';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { nombreInstalacion } from '@/util/formato';
import { CONTROL } from '../entregas/campos';

/**
 * Nuevo pedido a otra empresa: se elige la instalación propia que recibe y la acción de envío
 * (plantilla del pedido); el resto se completa en el formulario de la orden, como en la versión actual.
 */
export function OrdenNueva() {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  const navegar = useNavigate();
  const idInst = useId();
  const idAccion = useId();
  const instalaciones = useQuery({ ...stock.instalaciones(empresa?.id ?? 0), enabled: !!empresa });
  const acciones = useQuery({ ...ordenes.accionesDePedido(empresa?.id ?? 0), enabled: !!empresa });
  const [inst, setInst] = useState<number | null>(null);
  const [accion, setAccion] = useState<number | null>(null);

  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  if (instalaciones.isPending || acciones.isPending) return <Cargando />;

  // Acciones de envío que admiten la instalación elegida (o todas, si la acción no limita).
  const posibles = (acciones.data ?? []).filter((a) => !inst || !(a.supportedFacilities ?? []).length || a.supportedFacilities!.some((f) => f.id === inst));

  return (
    <div className="grid max-w-2xl gap-6">
      <header>
        <Link to="/stock/ordenes" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
          <Icono nombre="volver" className="size-4" /> {t('stock.pestanas.ordenes')}
        </Link>
        <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{t('stock.ord.nuevo_pedido')}</h1>
        <p className="mt-1 text-tinta-2">{t('stock.ord.nuevo_descripcion')}</p>
      </header>

      {(acciones.data ?? []).length === 0 ? (
        <Aviso tono="info" titulo={t('stock.ord.sin_acciones')}>
          {t('stock.ord.sin_acciones_texto')}{' '}
          <Link to="/empresa/acciones" className="font-semibold underline">{t('empresa.acciones.ir')}</Link>
        </Aviso>
      ) : (
        <section className="grid gap-5 rounded-caja border border-linea bg-superficie p-5 shadow-suave sm:p-6">
          <div className="grid gap-1.5">
            <label htmlFor={idInst} className="text-sm font-semibold text-tinta-2">{t('stock.ord.instalacion_recibe')}</label>
            <select id={idInst} value={inst ?? ''} onChange={(e) => { setInst(e.target.value ? Number(e.target.value) : null); setAccion(null); }} className={CONTROL + ' h-11'}>
              <option value="">{t('stock.elegir')}</option>
              {(instalaciones.data ?? []).map((f) => <option key={f.id} value={f.id}>{nombreInstalacion(f)}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={idAccion} className="text-sm font-semibold text-tinta-2">{t('stock.ord.plantilla')}</label>
            <select id={idAccion} value={accion ?? ''} disabled={!inst} onChange={(e) => setAccion(e.target.value ? Number(e.target.value) : null)} className={CONTROL + ' h-11'}>
              <option value="">{inst ? t('stock.elegir') : t('stock.ord.primero_instalacion')}</option>
              {posibles.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {inst && posibles.length === 0 && <p className="text-sm text-tinta-3">{t('stock.ord.sin_acciones_instalacion')}</p>}
          </div>
          <Boton className="justify-self-start" disabled={!inst || !accion} onClick={() => void navegar({ to: '/stock/procesamiento/nueva', search: { accion: accion!, destino: inst! } })}>
            {t('stock.ord.continuar')} <Icono nombre="flecha" className="size-4" />
          </Boton>
        </section>
      )}
    </div>
  );
}
