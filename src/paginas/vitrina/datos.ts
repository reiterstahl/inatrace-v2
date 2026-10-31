import { getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas } from '@/api/consultas';
import type { ApiBusinessToCustomerSettings, ApiQrTagPublic } from '@/api/gen/types.gen';
import { urlDocumento, urlDocumentoPublico } from '@/api/respuesta';
import type { EtiquetaVitrina } from '@/util/etiqueta';

const ruta = getRouteApi('/p-cd/$etiqueta/$qr');

export type DatosVitrina = {
  etiqueta: EtiquetaVitrina;
  qr: ApiQrTagPublic | null;
  ajustes: ApiBusinessToCustomerSettings;
  /** Valor de un campo de la etiqueta por nombre (p. ej. "name", "settings.gdprText"). */
  campo: <T = string>(nombre: string) => T | undefined;
  producto: string;
  params: { etiqueta: string; qr: string };
  /**
   * Dirección de un documento de la vitrina. En la vista previa (etiqueta sin publicar) se piden por
   * la ruta autenticada: la pública solo entrega los de etiquetas publicadas.
   */
  urlDoc: (clave?: string | null) => string | undefined;
};

export function armarDatos(etiqueta: EtiquetaVitrina, qr: ApiQrTagPublic | null, params: { etiqueta: string; qr: string }): DatosVitrina {
  const campos = new Map((etiqueta.fields ?? []).map((f) => [f.name, f.value]));
  const campo = <T,>(nombre: string) => (campos.get(nombre) ?? undefined) as T | undefined;
  return {
    etiqueta,
    qr,
    ajustes: etiqueta.businessToCustomerSettings ?? {},
    campo,
    producto: (campo<string>('name') ?? etiqueta.title ?? '').trim(),
    params,
    urlDoc: etiqueta.vistaPrevia ? urlDocumento : urlDocumentoPublico,
  };
}

export function useVitrina(): DatosVitrina {
  const { etiqueta, qr: qrInicial } = ruta.useLoaderData();
  const params = ruta.useParams();
  const { i18n } = useTranslation();
  // Si cambia el idioma, el lote se vuelve a pedir traducido; mientras tanto se muestra el anterior.
  const { data: qr } = useQuery({ ...consultas.qr(params.qr, i18n.language), placeholderData: (previo) => previo ?? qrInicial });
  return armarDatos(etiqueta, qr ?? qrInicial, params);
}

/** Pestañas habilitadas, en el orden configurado para el producto. El recorrido va siempre primero. */
export type Pestana = 'journey' | 'fair-prices' | 'producers' | 'quality' | 'feedback';
export function pestanas(a: ApiBusinessToCustomerSettings): Pestana[] {
  const opcionales: [boolean | undefined, number | undefined, Pestana][] = [
    [a.tabFairPrices, a.orderFairPrices, 'fair-prices'],
    [a.tabProducers, a.orderProducers, 'producers'],
    [a.tabQuality, a.orderQuality, 'quality'],
    [a.tabFeedback, a.orderFeedback, 'feedback'],
  ];
  return [
    'journey',
    ...opcionales
      .filter(([on]) => on)
      .sort((x, y) => (x[1] ?? 99) - (y[1] ?? 99))
      .map(([, , p]) => p),
  ];
}
