import { useEffect, useRef } from 'react';
import { Map as MapaGL, Marker, NavigationControl } from 'maplibre-gl';
import { useTranslation } from 'react-i18next';
import type { Punto } from '@/util/geo';
import { cerrarAtribucion, colorMarca, ESTILO_BASE } from './base';

/** Elegir la ubicación del productor: tocando el mapa o arrastrando el pin. */
export default function SelectorUbicacion({ valor, alCambiar, centro }: { valor: Punto | null; alCambiar: (p: Punto) => void; centro?: Punto | null }) {
  const { t } = useTranslation();
  const caja = useRef<HTMLDivElement>(null);
  const pin = useRef<Marker | null>(null);
  const mapaRef = useRef<MapaGL | null>(null);
  const avisar = useRef(alCambiar);
  avisar.current = alCambiar;

  useEffect(() => {
    if (!caja.current) return;
    const inicio = valor ?? centro ?? [-90.3, 15.5];
    const m = new MapaGL({ container: caja.current, style: ESTILO_BASE, center: inicio, zoom: valor ? 13 : centro ? 7 : 6, attributionControl: { compact: true }, cooperativeGestures: true });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    cerrarAtribucion(m);
    const marcador = new Marker({ draggable: true, color: colorMarca(caja.current) });
    marcador.on('dragend', () => {
      const { lng, lat } = marcador.getLngLat();
      avisar.current([lng, lat]);
    });
    if (valor) marcador.setLngLat(valor).addTo(m);
    m.on('click', (e) => {
      marcador.setLngLat(e.lngLat).addTo(m);
      avisar.current([e.lngLat.lng, e.lngLat.lat]);
    });
    pin.current = marcador;
    mapaRef.current = m;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el valor cambia desde los campos de texto, el pin lo sigue.
  useEffect(() => {
    if (valor && pin.current && mapaRef.current) pin.current.setLngLat(valor).addTo(mapaRef.current);
  }, [valor]);

  return <div ref={caja} className="h-72 overflow-hidden rounded-caja border border-linea bg-superficie-2" role="application" aria-label={t('productores.ubicacion.mapa')} />;
}
