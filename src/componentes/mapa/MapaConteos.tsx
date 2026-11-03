import { useEffect, useRef } from 'react';
import { LngLatBounds, Map as MapaGL, NavigationControl } from 'maplibre-gl';
import { cerrarAtribucion, colorMarca, ESTILO_BASE } from './base';

/** Puntos con un conteo (p. ej. visitas por ubicación): círculos más grandes donde hay más. */
export default function MapaConteos({ puntos, etiqueta }: { puntos: { lat: number; lng: number; n: number }[]; etiqueta: string }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!caja.current) return;
    const m = new MapaGL({ container: caja.current, style: ESTILO_BASE, center: [-90.3, 15.5], zoom: 2, attributionControl: { compact: true }, cooperativeGestures: true });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    cerrarAtribucion(m);
    const color = colorMarca(caja.current);
    const maximo = Math.max(1, ...puntos.map((p) => p.n));
    m.on('load', () => {
      m.addSource('conteos', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: puntos.map((p) => ({ type: 'Feature', properties: { n: p.n }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) },
      });
      m.addLayer({
        id: 'conteos',
        type: 'circle',
        source: 'conteos',
        // Con un solo valor (p. ej. todas las instalaciones con n = 1) no hay escala que interpolar.
        paint: { 'circle-color': color, 'circle-opacity': 0.55, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5, 'circle-radius': maximo > 1 ? ['interpolate', ['linear'], ['get', 'n'], 1, 6, maximo, 22] : 8 },
      });
    });
    if (puntos.length) {
      const b = new LngLatBounds();
      puntos.forEach((p) => b.extend([p.lng, p.lat]));
      m.fitBounds(b, { padding: 48, maxZoom: 8, duration: 0 });
    }
    return () => m.remove();
  }, [puntos]);
  return <div ref={caja} className="h-80 overflow-hidden rounded-caja border border-linea bg-superficie-2" role="img" aria-label={etiqueta} />;
}
