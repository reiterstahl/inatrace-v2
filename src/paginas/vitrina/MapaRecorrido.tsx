import { useEffect, useRef } from 'react';
import { Map as MapaGL, NavigationControl, setWorkerUrl, type LngLatBoundsLike } from 'maplibre-gl';
import urlTrabajador from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre 6 busca su worker como archivo vecino del módulo; al empaquetar con Vite ese vecino
// no existe y el mapa queda en blanco ("Worker failed to load"). Se le pasa la URL explícita.
setWorkerUrl(urlTrabajador);

/** [longitud, latitud] */
export type Punto = [number, number];

// Teselas abiertas, sin clave ni rastreo (la versión actual usa Google Maps).
const ESTILO = 'https://tiles.openfreemap.org/styles/positron';

function limites(puntos: Punto[]): LngLatBoundsLike {
  const lons = puntos.map((p) => p[0]), lats = puntos.map((p) => p[1]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

export default function MapaRecorrido({ ruta, lugares, etiqueta }: { ruta: Punto[]; lugares: Punto[]; etiqueta: string }) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!caja.current) return;
    const todos = [...ruta, ...lugares];
    const color = getComputedStyle(caja.current).getPropertyValue('--marca').trim() || '#1f5b45';
    const unico = todos.length === 1;

    const mapa = new MapaGL({
      container: caja.current,
      style: ESTILO,
      ...(unico ? { center: todos[0], zoom: 7 } : { bounds: limites(todos), fitBoundsOptions: { padding: { top: 40, bottom: 48, left: 40, right: 64 }, maxZoom: 8 } }),
      attributionControl: { compact: true },
      cooperativeGestures: true, // en el celular, el mapa no se roba el desplazamiento de la página
    });
    mapa.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    // La atribución compacta arranca abierta y tapa medio mapa en el celular: se cierra al cargar.
    mapa.once('load', () => caja.current?.querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show'));

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
