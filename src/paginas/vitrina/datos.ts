import { getRouteApi } from '@tanstack/react-router';
import type { ApiBusinessToCustomerSettings, ApiProductLabelValuesExtended, ApiQrTagPublic } from '@/api/gen/types.gen';

const ruta = getRouteApi('/p-cd/$etiqueta/$qr');

export type DatosVitrina = {
  etiqueta: ApiProductLabelValuesExtended;
  qr: ApiQrTagPublic | null;
  ajustes: ApiBusinessToCustomerSettings;
  /** Valor de un campo de la etiqueta por nombre (p. ej. "name", "settings.gdprText"). */
  campo: <T = string>(nombre: string) => T | undefined;
  producto: string;
  params: { etiqueta: string; qr: string };
};

export function armarDatos(etiqueta: ApiProductLabelValuesExtended, qr: ApiQrTagPublic | null, params: { etiqueta: string; qr: string }): DatosVitrina {
  const campos = new Map((etiqueta.fields ?? []).map((f) => [f.name, f.value]));
  const campo = <T,>(nombre: string) => (campos.get(nombre) ?? undefined) as T | undefined;
  return {
    etiqueta,
    qr,
    ajustes: etiqueta.businessToCustomerSettings ?? {},
    campo,
    producto: (campo<string>('name') ?? etiqueta.title ?? '').trim(),
    params,
  };
}

export function useVitrina(): DatosVitrina {
  const { etiqueta, qr } = ruta.useLoaderData();
  const params = ruta.useParams();
  return armarDatos(etiqueta, qr, params);
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
