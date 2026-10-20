import { useEffect, useRef } from 'react';
import { Map as MapaGL, NavigationControl } from 'maplibre-gl';
import { cerrarAtribucion, ESTILO_BASE, limites, type Punto } from '@/componentes/mapa/base';

export type { Punto };

export default function MapaRecorrido({ ruta, lugares, etiqueta }: { ruta: Punto[]; lugares: Punto[]; etiqueta: string }) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!caja.current) return;
    const todos = [...ruta, ...lugares];
    const color = getComputedStyle(caja.current).getPropertyValue('--marca').trim() || '#1f5b45';
    const unico = todos.length === 1;

    const mapa = new MapaGL({
      container: caja.current,
      style: ESTILO_BASE,
      ...(unico ? { center: todos[0], zoom: 7 } : { bounds: limites(todos), fitBoundsOptions: { padding: { top: 40, bottom: 48, left: 40, right: 64 }, maxZoom: 8 } }),
      attributionControl: { compact: true },
      cooperativeGestures: true, // en el celular, el mapa no se roba el desplazamiento de la página
    });
    mapa.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    cerrarAtribucion(mapa);

    mapa.on('load', () => {
      if (ruta.length > 1) {
        mapa.addSource('ruta', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ruta } } });
        mapa.addLayer({ id: 'ruta', type: 'line', source: 'ruta', paint: { 'line-color': color, 'line-width': 2.5, 'line-dasharray': [2, 2] } });
      }
      mapa.addSource('lugares', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: todos.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } })) },
      });
      mapa.addLayer({ id: 'lugares', type: 'circle', source: 'lugares', paint: { 'circle-radius': 6, 'circle-color': color, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff' } });
    });
    return () => mapa.remove();
  }, [ruta, lugares]);

  return <div ref={caja} className="h-80 w-full" role="img" aria-label={etiqueta} />;
}
