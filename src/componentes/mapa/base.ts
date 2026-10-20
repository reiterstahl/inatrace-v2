import { setWorkerUrl, type LngLatBoundsLike, type Map as MapaGL, type SourceSpecification } from 'maplibre-gl';
import urlTrabajador from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { ApiMapLayer } from '@/api/gen/types.gen';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre 6 busca su worker como archivo vecino del módulo; al empaquetar con Vite ese vecino
// no existe y el mapa queda en blanco ("Worker failed to load"). Se le pasa la URL explícita.
setWorkerUrl(urlTrabajador);

/** Mapa base abierto, sin clave ni rastreo (la versión actual usa Mapbox y Google Maps). */
export const ESTILO_BASE = 'https://tiles.openfreemap.org/styles/positron';

/** [longitud, latitud] */
export type Punto = [number, number];

export function limites(puntos: Punto[]): LngLatBoundsLike {
  const lons = puntos.map((p) => p[0]), lats = puntos.map((p) => p[1]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

export function colorMarca(el: Element | null): string {
  return (el && getComputedStyle(el).getPropertyValue('--marca').trim()) || '#1f5b45';
}

/**
 * Traduce una capa del catálogo (backend mejorado) a una fuente de MapLibre, igual que la
 * interfaz actual. Devuelve null si la capa no se puede dibujar: una fila mal cargada se salta
 * en vez de romper el mapa.
 */
export function fuenteDeCapa(c: ApiMapLayer): SourceSpecification | null {
  const url = (c.url ?? '').trim();
  const atribucion = c.attribution ?? '';
  if (!url) return null;
  switch (c.type) {
    case 'XYZ':
      return { type: 'raster', tiles: [url], tileSize: 256, attribution: atribucion };
    case 'ARCGIS_REST':
      // ArcGIS sirve /tile/{z}/{y}/{x}: la fila va antes que la columna, al revés que XYZ.
      return { type: 'raster', tiles: [`${url.replace(/\/+$/, '')}/tile/{z}/{y}/{x}`], tileSize: 256, attribution: atribucion };
    case 'WMS': {
      if (!c.layerName) return null;
      const params = [
        'SERVICE=WMS', 'REQUEST=GetMap', 'VERSION=1.3.0', `LAYERS=${encodeURIComponent(c.layerName)}`,
        'CRS=EPSG:3857', 'BBOX={bbox-epsg-3857}', 'WIDTH=256', 'HEIGHT=256', 'FORMAT=image/png', 'TRANSPARENT=true',
      ].join('&');
      return { type: 'raster', tiles: [`${url}${url.includes('?') ? '&' : '?'}${params}`], tileSize: 256, attribution: atribucion };
    }
    case 'GEOJSON':
      return { type: 'geojson', data: url, attribution: atribucion };
    default:
      return null;
  }
}

const idCapa = (c: ApiMapLayer) => `catalogo-${c.code ?? c.id}`;

/** Agrega las capas del catálogo por debajo de lo que dibuja la app (`antesDe`), ocultas si así están configuradas. */
export function agregarCapas(mapa: MapaGL, capas: ApiMapLayer[], antesDe?: string) {
  for (const c of [...capas].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
    const fuente = fuenteDeCapa(c);
    const id = idCapa(c);
    if (!fuente || mapa.getSource(id)) continue;
    mapa.addSource(id, fuente);
    const visibilidad = c.visibleByDefault ? 'visible' : 'none';
    if (fuente.type === 'geojson') {
      mapa.addLayer({ id, source: id, type: 'line', layout: { visibility: visibilidad }, paint: { 'line-color': '#2563eb', 'line-width': 1.5, 'line-opacity': c.opacity ?? 1 } }, antesDe);
    } else {
      mapa.addLayer({ id, source: id, type: 'raster', layout: { visibility: visibilidad }, paint: { 'raster-opacity': c.opacity ?? 1 } }, antesDe);
    }
  }
}

export function mostrarCapa(mapa: MapaGL, c: ApiMapLayer, visible: boolean) {
  const id = idCapa(c);
  if (mapa.getLayer(id)) mapa.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

/** La atribución compacta arranca abierta y tapa medio mapa en el celular: se cierra al cargar. */
export function cerrarAtribucion(mapa: MapaGL) {
  mapa.once('load', () => mapa.getContainer().querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show'));
}
