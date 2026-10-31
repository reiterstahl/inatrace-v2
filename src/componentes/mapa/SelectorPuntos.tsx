import { useEffect, useRef } from 'react';
import { LngLatBounds, Map as MapaGL, Marker, NavigationControl } from 'maplibre-gl';
import { useTranslation } from 'react-i18next';
import type { Punto } from '@/util/geo';
import { cerrarAtribucion, colorMarca, ESTILO_BASE } from './base';

/**
 * Varios puntos sobre el mapa (el origen de un producto): tocar el mapa agrega uno y cada pin se
 * arrastra. Los pines llevan el número del punto en la lista que acompaña al mapa.
 */
export default function SelectorPuntos({ puntos, alAgregar, alMover }: { puntos: (Punto | null)[]; alAgregar: (p: Punto) => void; alMover: (i: number, p: Punto) => void }) {
  const { t } = useTranslation();
  const caja = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapaGL | null>(null);
  // Alineados con la lista: el pin i es el punto i (vacío si todavía no tiene coordenadas).
  const pines = useRef<(Marker | undefined)[]>([]);
  const avisos = useRef({ alAgregar, alMover });
  avisos.current = { alAgregar, alMover };

  useEffect(() => {
    if (!caja.current) return;
    const conPosicion = puntos.filter((p): p is Punto => !!p);
    const m = new MapaGL({ container: caja.current, style: ESTILO_BASE, center: conPosicion[0] ?? [-90.3, 15.5], zoom: conPosicion.length ? 7 : 6, attributionControl: { compact: true }, cooperativeGestures: true });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    cerrarAtribucion(m);
    m.on('click', (e) => avisos.current.alAgregar([e.lngLat.lng, e.lngLat.lat]));
    if (conPosicion.length > 1) {
      const b = new LngLatBounds();
      conPosicion.forEach((p) => b.extend(p));
      m.fitBounds(b, { padding: 48, maxZoom: 11, duration: 0 });
    }
    mapaRef.current = m;
    return () => {
      pines.current.forEach((p) => p?.remove());
      pines.current = [];
      m.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Los pines siguen a la lista: se crean, se mueven o se quitan según cambie.
  useEffect(() => {
    const m = mapaRef.current;
    if (!m || !caja.current) return;
    const color = colorMarca(caja.current);
    pines.current.slice(puntos.length).forEach((p) => p?.remove());
    pines.current = pines.current.slice(0, puntos.length);
    puntos.forEach((p, i) => {
      let pin = pines.current[i];
      if (!p) {
        pin?.remove();
        pines.current[i] = undefined;
        return;
      }
      if (!pin) {
        const etiqueta = document.createElement('div');
        etiqueta.className = 'grid size-7 place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow';
        etiqueta.style.background = color;
        pin = new Marker({ element: etiqueta, draggable: true });
        pin.on('dragend', () => {
          const { lng, lat } = pin!.getLngLat();
          avisos.current.alMover(pines.current.indexOf(pin!), [lng, lat]);
        });
        pines.current[i] = pin.setLngLat(p).addTo(m);
      } else {
        pin.setLngLat(p);
      }
      pin.getElement().textContent = String(i + 1);
      pin.getElement().setAttribute('aria-label', t('productos.origen.punto', { n: i + 1 }));
    });
  }, [puntos, t]);

  return <div ref={caja} className="h-80 overflow-hidden rounded-caja border border-linea bg-superficie-2" role="application" aria-label={t('productos.origen.mapa')} />;
}
