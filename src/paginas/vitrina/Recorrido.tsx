import { lazy, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiHistoryTimelineItem } from '@/api/gen/types.gen';
import { Icono, type NombreIcono } from '@/componentes/ui/Icono';
import { fechaLarga } from '@/util/fecha';
import { useVitrina } from './datos';
import { Seccion } from './Vitrina';
import type { Punto } from './MapaRecorrido';

const MapaRecorrido = lazy(() => import('./MapaRecorrido'));

function iconoPaso(p: ApiHistoryTimelineItem): NombreIcono {
  switch (p.iconType) {
    case 'SHIP': return 'barco';
    case 'WAREHOUSE': return 'bodega';
    case 'QRCODE': return 'qr';
    case 'OTHER': return 'punto';
    case 'LEAF': return 'hoja';
    default: return p.type === 'TRANSFER' ? 'barco' : 'hoja';
  }
}

const esCoordenada = (lat?: number, lon?: number): lat is number => typeof lat === 'number' && typeof lon === 'number' && !(lat === 0 && lon === 0);

export function Recorrido() {
  const d = useVitrina();
  const { t, i18n } = useTranslation();
  const items = d.qr?.historyTimeline?.items;
  const pasos = useMemo(() => (items ?? []).filter((p) => p.type), [items]);
  const productor = d.qr?.producerName || d.producto;

  // Ruta dibujada a mano en la etiqueta + los pasos del lote que tienen ubicación.
  // Memorizadas: si cambiaran en cada render, el mapa se rearmaría entero cada vez.
  const marcadores = d.campo<{ latitude?: number; longitude?: number }[]>('journeyMarkers');
  const ruta = useMemo<Punto[]>(
    () => (marcadores ?? []).filter((m) => esCoordenada(m.latitude, m.longitude)).map((m) => [m.longitude!, m.latitude!]),
    [marcadores],
  );
  const lugares = useMemo<Punto[]>(
    () => pasos.filter((p) => esCoordenada(p.latitude, p.longitude)).map((p) => [p.longitude!, p.latitude!]),
    [pasos],
  );
  const hayMapa = ruta.length > 0 || lugares.length > 0;

  const hoy = new Date();
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

  return (
    <Seccion titulo={t('vitrina.recorrido.titulo')} intro={t('vitrina.recorrido.intro')}>
      {hayMapa && (
        <figure className="mb-10 overflow-hidden rounded-caja border border-linea bg-superficie-2 shadow-suave">
          <Suspense fallback={<div className="h-80 animate-pulse" />}>
            <MapaRecorrido ruta={ruta} lugares={lugares} etiqueta={t('vitrina.recorrido.mapa')} />
          </Suspense>
        </figure>
      )}

      <ol className="relative grid gap-0">
        <Paso icono="qr" fecha={fechaLarga(hoyIso, i18n.language)} titulo={t('vitrina.recorrido.tu_escaneo')} destacado />
        {pasos.map((p, i) => (
          <Paso
            key={i}
            icono={iconoPaso(p)}
            fecha={fechaLarga(p.date, i18n.language)}
            titulo={p.name ?? ''}
            detalle={[p.step && p.steps ? t('vitrina.recorrido.paso', { paso: p.step, pasos: p.steps }) : null, p.location].filter(Boolean).join(' · ')}
          />
        ))}
        <Paso icono="hoja" titulo={t('vitrina.recorrido.cosecha')} detalle={t('vitrina.recorrido.productores_de', { nombre: productor })} ultimo />
      </ol>
    </Seccion>
  );
}

function Paso({ icono, fecha, titulo, detalle, destacado, ultimo }: { icono: NombreIcono; fecha?: string; titulo: string; detalle?: string; destacado?: boolean; ultimo?: boolean }) {
  return (
    <li className="relative grid grid-cols-[2.75rem_1fr] gap-4 pb-8 last:pb-0">
      {!ultimo && <span className="absolute top-11 bottom-0 left-[1.375rem] w-px -translate-x-1/2 border-l-2 border-dashed border-linea-fuerte" aria-hidden="true" />}
      <span className={'grid size-11 place-items-center rounded-full ' + (destacado ? 'bg-marca text-sobre-marca shadow-suave' : 'bg-marca-suave text-marca')}>
        <Icono nombre={icono} className="size-5" />
      </span>
      <div className="pt-1">
        {fecha && <p className="text-sm text-tinta-3">{fecha}</p>}
        <p className="font-semibold">{titulo}</p>
        {detalle && <p className="text-sm text-tinta-2">{detalle}</p>}
      </div>
    </li>
  );
}
