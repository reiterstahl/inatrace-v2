import { useEffect, useRef, useState } from 'react';
import { Map as MapaGL, NavigationControl, type GeoJSONSource } from 'maplibre-gl';
import type { ApiMapLayer } from '@/api/gen/types.gen';
import { cerrar, type Punto } from '@/util/geo';
import { agregarCapas, cerrarAtribucion, colorMarca, ESTILO_BASE, limites } from './base';
import { ControlCapas } from './ControlCapas';

export type ParcelaEnMapa = { id: number | string; nombre: string; coordenadas: Punto[]; detalle?: string };

function colección(parcelas: ParcelaEnMapa[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: parcelas
      .filter((p) => p.coordenadas.length >= 3)
      .map((p) => ({ type: 'Feature', id: typeof p.id === 'number' ? p.id : undefined, properties: { id: String(p.id), nombre: p.nombre }, geometry: { type: 'Polygon', coordinates: [cerrar(p.coordenadas)] } })),
  };
}

/** Centro aproximado (promedio de vértices): alcanza para marcar una parcela de pocas hectáreas. */
function centros(parcelas: ParcelaEnMapa[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: parcelas
      .filter((p) => p.coordenadas.length >= 3)
      .map((p) => {
        const n = p.coordenadas.length;
        const c: Punto = [p.coordenadas.reduce((s, x) => s + x[0], 0) / n, p.coordenadas.reduce((s, x) => s + x[1], 0) / n];
        return { type: 'Feature', properties: { id: String(p.id), nombre: p.nombre }, geometry: { type: 'Point', coordinates: c } };
      }),
  };
}

/** Mapa de solo lectura con parcelas. Al tocar una se avisa con `alElegir`. */
export default function MapaParcelas({
  parcelas,
  capas = [],
  alElegir,
  etiqueta,
  className = 'h-96',
  punto,
}: {
  parcelas: ParcelaEnMapa[];
  capas?: ApiMapLayer[];
  alElegir?: (id: string) => void;
  etiqueta: string;
  className?: string;
  /** Ubicación del productor, si no tiene parcelas dibujadas. */
  punto?: Punto | null;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<MapaGL | null>(null);
  const elegir = useRef(alElegir);
  elegir.current = alElegir;

  useEffect(() => {
    if (!caja.current) return;
    const color = colorMarca(caja.current);
    const m = new MapaGL({ container: caja.current, style: ESTILO_BASE, center: [-90.3, 15.5], zoom: 6, attributionControl: { compact: true }, cooperativeGestures: true });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    cerrarAtribucion(m);
    m.on('load', () => {
      m.addSource('parcelas', { type: 'geojson', data: colección([]) });
      m.addLayer({ id: 'parcelas-relleno', type: 'fill', source: 'parcelas', paint: { 'fill-color': color, 'fill-opacity': 0.22 } });
      m.addLayer({ id: 'parcelas-borde', type: 'line', source: 'parcelas', paint: { 'line-color': color, 'line-width': 2 } });
      m.addLayer({ id: 'parcelas-nombre', type: 'symbol', source: 'parcelas', layout: { 'text-field': ['get', 'nombre'], 'text-size': 12, 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#1b201d', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }, minzoom: 12 });
      // De lejos, una parcela de pocas hectáreas mide menos de un píxel: se marca con un punto.
      m.addSource('centros', { type: 'geojson', data: centros([]) });
      m.addLayer({ id: 'parcelas-centro', type: 'circle', source: 'centros', maxzoom: 12, paint: { 'circle-radius': 6, 'circle-color': color, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      m.addSource('punto', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'punto', type: 'circle', source: 'punto', paint: { 'circle-radius': 7, 'circle-color': color, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } });
      for (const capa of ['parcelas-relleno', 'parcelas-centro']) {
        m.on('click', capa, (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (id && elegir.current) elegir.current(String(id));
        });
        m.on('mouseenter', capa, () => (m.getCanvas().style.cursor = elegir.current ? 'pointer' : ''));
        m.on('mouseleave', capa, () => (m.getCanvas().style.cursor = ''));
      }
      setMapa(m);
    });
    return () => m.remove();
  }, []);

  // Capas del catálogo, por debajo de las parcelas.
  useEffect(() => {
    if (mapa && capas.length) agregarCapas(mapa, capas, 'parcelas-relleno');
  }, [mapa, capas]);

  // Datos y encuadre: se actualizan sin rearmar el mapa.
  useEffect(() => {
    if (!mapa) return;
    (mapa.getSource('parcelas') as GeoJSONSource).setData(colección(parcelas));
    (mapa.getSource('centros') as GeoJSONSource).setData(centros(parcelas));
    (mapa.getSource('punto') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: punto ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: punto } }] : [],
    });
    const todos = [...parcelas.flatMap((p) => p.coordenadas), ...(punto ? [punto] : [])];
    if (todos.length === 1) mapa.jumpTo({ center: todos[0], zoom: 13 });
    else if (todos.length > 1) mapa.fitBounds(limites(todos), { padding: { top: 56, bottom: 48, left: 48, right: 64 }, maxZoom: 16, duration: 0 });
  }, [mapa, parcelas, punto]);

  return (
    <div className={'relative overflow-hidden rounded-caja border border-linea bg-superficie-2 ' + className}>
      <div ref={caja} className="size-full" role="img" aria-label={etiqueta} />
      <ControlCapas mapa={mapa} capas={capas} />
    </div>
  );
}
