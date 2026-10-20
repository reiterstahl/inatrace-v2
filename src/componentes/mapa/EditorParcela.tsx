import { useEffect, useRef, useState } from 'react';
import { Map as MapaGL, NavigationControl, type GeoJSONSource } from 'maplibre-gl';
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode, type GeoJSONStoreFeatures } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { useTranslation } from 'react-i18next';
import type { ApiMapLayer } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Icono } from '@/componentes/ui/Icono';
import { abrir, cerrar, m2AHectareas, superficieM2, type Punto } from '@/util/geo';
import { agregarCapas, cerrarAtribucion, colorMarca, ESTILO_BASE, limites } from './base';
import { ControlCapas } from './ControlCapas';

const ID = 'parcela-editada';
/** Por debajo de este zoom, una parcela de pocas hectáreas no se puede dibujar con precisión. */
const ZOOM_MINIMO_DIBUJO = 13;

/**
 * Dibujo y edición del polígono de una parcela: se dibuja tocando los vértices (el último toque
 * en el primero lo cierra); luego se pueden mover vértices, agregar intermedios y arrastrar.
 * Las demás parcelas del productor se ven de fondo, sin editarse.
 */
export default function EditorParcela({
  coordenadas,
  alCambiar,
  otras = [],
  capas = [],
  centro,
}: {
  coordenadas: Punto[];
  alCambiar: (c: Punto[]) => void;
  otras?: Punto[][];
  capas?: ApiMapLayer[];
  centro?: Punto | null;
}) {
  const { t, i18n } = useTranslation();
  const caja = useRef<HTMLDivElement>(null);
  const dibujo = useRef<TerraDraw | null>(null);
  const [mapa, setMapa] = useState<MapaGL | null>(null);
  const [modo, setModo] = useState<'dibujar' | 'editar'>(coordenadas.length >= 3 ? 'editar' : 'dibujar');
  const [area, setArea] = useState(() => superficieM2(coordenadas));
  // Con zoom de país, un toque abarca kilómetros: se pide acercarse antes de dibujar.
  const [lejos, setLejos] = useState(false);
  const avisar = useRef(alCambiar);
  avisar.current = alCambiar;
  const inicial = useRef(coordenadas);

  useEffect(() => {
    if (!caja.current) return;
    const color = colorMarca(caja.current) as `#${string}`;
    // Se encuadra la parcela que se edita; las otras son solo contexto (pueden estar lejos).
    const puntosIniciales = inicial.current.length ? inicial.current : otras.flat();
    const m = new MapaGL({
      container: caja.current,
      style: ESTILO_BASE,
      ...(puntosIniciales.length > 1
        ? { bounds: limites(puntosIniciales), fitBoundsOptions: { padding: 56, maxZoom: 17 } }
        : { center: puntosIniciales[0] ?? centro ?? [-90.3, 15.5], zoom: puntosIniciales[0] || centro ? 15 : 6 }),
      attributionControl: { compact: true },
    });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    cerrarAtribucion(m);
    const revisarZoom = () => {
      setLejos(m.getZoom() < ZOOM_MINIMO_DIBUJO);
      m.getContainer().dataset.zoom = m.getZoom().toFixed(1); // para pruebas y depuración
    };
    m.on('zoom', revisarZoom);
    m.once('load', revisarZoom);

    m.on('style.load', () => {
      m.addSource('otras', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: otras.filter((o) => o.length >= 3).map((o) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [cerrar(o)] } })) },
      });
      m.addLayer({ id: 'otras', type: 'line', source: 'otras', paint: { 'line-color': '#78807b', 'line-width': 1.5, 'line-dasharray': [2, 2] } });

      const td = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map: m }),
        modes: [
          new TerraDrawPolygonMode({ styles: { fillColor: color, outlineColor: color, fillOpacity: 0.25, outlineWidth: 2 } }),
          new TerraDrawSelectMode({
            flags: { polygon: { feature: { draggable: true, coordinates: { draggable: true, deletable: true, midpoints: { draggable: true } } } } },
            styles: { selectedPolygonColor: color, selectedPolygonOutlineColor: color, selectedPolygonFillOpacity: 0.25, selectionPointColor: color, midPointColor: color },
          }),
        ],
      });
      td.start();

      const leer = () => {
        const f = td.getSnapshot().find((x) => x.geometry.type === 'Polygon');
        const anillo = f ? abrir((f.geometry.coordinates as Punto[][])[0] ?? []) : [];
        setArea(superficieM2(anillo));
        return anillo;
      };
      td.on('finish', (id) => {
        // Una sola parcela: si quedaba otra figura, se descarta.
        td.getSnapshot().filter((x) => x.id !== id).forEach((x) => td.removeFeatures([x.id!]));
        avisar.current(leer());
        td.setMode('select');
        td.selectFeature(id);
        setModo('editar');
      });
      td.on('change', (_ids, tipo) => {
        if (tipo === 'update' && td.getMode() === 'select') avisar.current(leer());
      });

      if (inicial.current.length >= 3) {
        const f: GeoJSONStoreFeatures = { id: ID, type: 'Feature', properties: { mode: 'polygon' }, geometry: { type: 'Polygon', coordinates: [cerrar(inicial.current)] } };
        td.addFeatures([f]);
        td.setMode('select');
        td.selectFeature(ID);
      } else {
        td.setMode('polygon');
      }
      dibujo.current = td;
      setMapa(m);
    });
    return () => {
      dibujo.current?.stop();
      m.remove();
    };
    // El mapa se arma una sola vez; lo demás se actualiza por eventos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapa && capas.length) agregarCapas(mapa, capas, 'otras');
  }, [mapa, capas]);

  // Mantener el fondo de "otras parcelas" al día si cambian.
  useEffect(() => {
    const src = mapa?.getSource('otras') as GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features: otras.filter((o) => o.length >= 3).map((o) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [cerrar(o)] } })) });
  }, [mapa, otras]);

  function redibujar() {
    const td = dibujo.current;
    if (!td) return;
    td.clear();
    td.setMode('polygon');
    setModo('dibujar');
    setArea(0);
    avisar.current([]);
  }

  const hectareas = m2AHectareas(area);
  return (
    <div className="grid gap-2">
      <div className="relative h-[26rem] overflow-hidden rounded-caja border border-linea bg-superficie-2">
        <div ref={caja} className="size-full" role="application" aria-label={t('productores.parcela.mapa_editor')} />
        <ControlCapas mapa={mapa} capas={capas} />
        <p
          role={modo === 'dibujar' && lejos ? 'status' : undefined}
          className={'pointer-events-none absolute bottom-2 left-2 rounded-md px-2.5 py-1 text-xs font-medium shadow-suave ' + (modo === 'dibujar' && lejos ? 'bg-aviso-suave text-aviso' : 'bg-superficie/90 text-tinta-2')}
        >
          {modo === 'dibujar' ? (lejos ? t('productores.parcela.acercate') : t('productores.parcela.ayuda_dibujar')) : t('productores.parcela.ayuda_editar')}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-tinta-2">
          {hectareas > 0
            ? t('productores.parcela.superficie_dibujada', { ha: hectareas.toLocaleString(i18n.language, { maximumFractionDigits: 2 }) })
            : t('productores.parcela.sin_poligono')}
        </span>
        <Boton variante="secundario" chico onClick={redibujar}>
          <Icono nombre="editar" className="size-4" /> {t('productores.parcela.redibujar')}
        </Boton>
      </div>
    </div>
  );
}
