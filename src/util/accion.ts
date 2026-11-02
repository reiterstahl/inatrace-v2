/**
 * Acciones de procesamiento de la empresa: portada de company-processing-actions de la versión actual.
 * Una acción define qué entra y qué sale de un proceso, y lo que se pide al registrarlo.
 *  - Lo que se pide depende del tipo (mismas reglas que la versión actual y el backend):
 *    · PROCESSING: semiproducto de entrada y al menos uno de salida (cada salida puede reempacarse
 *      con un máximo por envase).
 *    · FINAL_PROCESSING: semiproducto de entrada y producto final de salida (reempaque opcional).
 *    · SHIPMENT (pedido) y TRANSFER (traslado): de semiproductos o de productos finales; según eso,
 *      semiproducto o producto final de entrada.
 *    · GENERATE_QR_CODE: semiproducto de entrada y el producto final del QR.
 *  - El backend exige la traducción al inglés con nombre y descripción, y reemplaza las traducciones
 *    con lo que recibe: la v2 pide el nombre en al menos un idioma y completa los vacíos con el
 *    primero escrito (como con las instalaciones).
 *  - Cadenas de valor: al menos una; los semiproductos, campos y documentos se eligen entre los de
 *    esas cadenas, así que al quitar una cadena se vacían (como la versión actual).
 */
import type {
  ApiFacility, ApiFinalProduct, ApiProcessingAction, ApiProcessingActionOutputSemiProduct, ApiProcessingEvidenceField, ApiProcessingEvidenceType,
  ApiSemiProduct, ApiValueChain,
} from '@/api/gen/types.gen';

export const TIPOS_ACCION = ['PROCESSING', 'FINAL_PROCESSING', 'SHIPMENT', 'TRANSFER', 'GENERATE_QR_CODE'] as const;
export type TipoAccion = (typeof TIPOS_ACCION)[number];

export const IDIOMAS_ACCION = ['ES', 'EN', 'DE', 'RW'] as const;
export type IdiomaAccion = (typeof IDIOMAS_ACCION)[number];

export type Salida = { semi: ApiProcessingActionOutputSemiProduct; reempaque: boolean; maximo: number | null };

export type FormAccion = {
  id?: number;
  tipo: TipoAccion | '';
  cadenas: ApiValueChain[];
  /** Solo en pedidos y traslados: si mueve productos finales en vez de semiproductos. */
  deFinales: boolean | null;
  entradaSemi: number | null;
  entradaFinal: number | null;
  qrFinal: number | null;
  salidas: Salida[];
  salidaFinal: number | null;
  reempaqueFinal: boolean;
  maximoFinal: number | null;
  rendimiento: number | null;
  prefijo: string;
  orden: string;
  instalaciones: ApiFacility[];
  textos: Record<IdiomaAccion, { nombre: string; descripcion: string }>;
  etiquetaPublica: string;
  campos: ApiProcessingEvidenceField[];
  documentos: ApiProcessingEvidenceType[];
};

export const conDosTipos = (tipo: FormAccion['tipo']) => tipo === 'SHIPMENT' || tipo === 'TRANSFER';

export function formDesdeAccion(a: ApiProcessingAction | null, cadenasEmpresa: ApiValueChain[] = []): FormAccion {
  const texto = (idioma: IdiomaAccion) => {
    const t = a?.translations?.find((x) => x.language === idioma);
    return { nombre: t?.name ?? '', descripcion: t?.description ?? '' };
  };
  return {
    id: a?.id,
    tipo: a?.type ?? '',
    // Como la versión actual: una acción nueva arranca con la cadena si la empresa tiene una sola.
    cadenas: a ? (a.valueChains ?? []) : cadenasEmpresa.length === 1 ? cadenasEmpresa : [],
    deFinales: a && conDosTipos(a.type ?? '') ? !!a.finalProductAction : null,
    entradaSemi: a?.inputSemiProduct?.id ?? null,
    entradaFinal: a?.inputFinalProduct?.id ?? null,
    qrFinal: a?.qrCodeForFinalProduct?.id ?? null,
    salidas: (a?.outputSemiProducts ?? []).map((s) => ({ semi: s, reempaque: !!s.repackedOutput, maximo: s.maxOutputWeight ?? null })),
    salidaFinal: a?.outputFinalProduct?.id ?? null,
    reempaqueFinal: !!a?.repackedOutputFinalProducts,
    maximoFinal: a?.maxOutputWeight ?? null,
    rendimiento: a?.estimatedOutputQuantityPerUnit ?? null,
    prefijo: a?.prefix ?? '',
    orden: a?.sortOrder != null ? String(a.sortOrder) : '',
    instalaciones: a?.supportedFacilities ?? [],
    textos: Object.fromEntries(IDIOMAS_ACCION.map((x) => [x, texto(x)])) as FormAccion['textos'],
    etiquetaPublica: a?.publicTimelineLabel ?? '',
    campos: a?.requiredEvidenceFields ?? [],
    documentos: a?.requiredDocumentTypes ?? [],
  };
}

export type ErroresAccion = Partial<Record<
  'tipo' | 'cadenas' | 'deFinales' | 'entradaSemi' | 'entradaFinal' | 'qrFinal' | 'salidas' | 'salidaFinal' | 'maximoFinal' | 'rendimiento' | 'prefijo' | 'orden' | 'nombre',
  string
>> & { maximos?: Record<number, string> };

const positivo = (n: number | null) => n !== null && !Number.isNaN(n) && n > 0;

export function validarAccion(f: FormAccion): ErroresAccion {
  const e: ErroresAccion = {};
  if (!f.tipo) e.tipo = 'requerido';
  if (!f.cadenas.length) e.cadenas = 'sin_cadenas';
  if (!f.prefijo.trim()) e.prefijo = 'requerido';
  if (f.orden.trim() && !/^\d+$/.test(f.orden.trim())) e.orden = 'entero';
  if (!IDIOMAS_ACCION.some((x) => f.textos[x].nombre.trim())) e.nombre = 'requerido';
  if (f.rendimiento !== null && (Number.isNaN(f.rendimiento) || f.rendimiento < 0)) e.rendimiento = 'no_negativo';

  switch (f.tipo) {
    case 'PROCESSING': {
      if (!f.entradaSemi) e.entradaSemi = 'requerido';
      if (!f.salidas.length) e.salidas = 'sin_salidas';
      const maximos: Record<number, string> = {};
      for (const s of f.salidas) if (s.reempaque && !positivo(s.maximo)) maximos[s.semi.id!] = 'requerido';
      if (Object.keys(maximos).length) e.maximos = maximos;
      break;
    }
    case 'FINAL_PROCESSING':
      if (!f.entradaSemi) e.entradaSemi = 'requerido';
      if (!f.salidaFinal) e.salidaFinal = 'requerido';
      if (f.reempaqueFinal && !positivo(f.maximoFinal)) e.maximoFinal = 'requerido';
      break;
    case 'SHIPMENT':
    case 'TRANSFER':
      if (f.deFinales === null) e.deFinales = 'requerido';
      else if (f.deFinales && !f.entradaFinal) e.entradaFinal = 'requerido';
      else if (!f.deFinales && !f.entradaSemi) e.entradaSemi = 'requerido';
      break;
    case 'GENERATE_QR_CODE':
      if (!f.entradaSemi) e.entradaSemi = 'requerido';
      if (!f.qrFinal) e.qrFinal = 'requerido';
      break;
  }
  return e;
}

export const sinErroresAccion = (e: ErroresAccion) => Object.keys(e).length === 0;

/** Los idiomas sin nombre toman el nombre (y la descripción) del primero escrito, antes el de la interfaz. */
export function completarTextos(textos: FormAccion['textos'], idiomaInterfaz: string): FormAccion['textos'] {
  const orden = [idiomaInterfaz.slice(0, 2).toUpperCase(), ...IDIOMAS_ACCION] as IdiomaAccion[];
  const base = orden.map((x) => textos[x]).find((t) => t?.nombre.trim()) ?? { nombre: '', descripcion: '' };
  return Object.fromEntries(
    IDIOMAS_ACCION.map((x) => {
      const t = textos[x];
      return [x, t.nombre.trim() ? { nombre: t.nombre.trim(), descripcion: t.descripcion.trim() } : { nombre: base.nombre.trim(), descripcion: base.descripcion.trim() }];
    }),
  ) as FormAccion['textos'];
}

/** Acción a guardar: la original (si existe) con el formulario encima; solo los productos de su tipo. */
export function armarAccion(
  original: ApiProcessingAction | null,
  f: FormAccion,
  c: { empresa: number; idioma: string; semis: ApiSemiProduct[]; finales: ApiFinalProduct[] },
): ApiProcessingAction {
  const textos = completarTextos(f.textos, c.idioma);
  const semi = (id: number | null) => (id ? (c.semis.find((s) => s.id === id) ?? (original?.inputSemiProduct?.id === id ? original.inputSemiProduct : { id })) : undefined);
  const final = (id: number | null) => (id ? (c.finales.find((x) => x.id === id) ?? { id }) : undefined);
  const tipo = f.tipo as TipoAccion;
  const deFinales = conDosTipos(tipo) && !!f.deFinales;
  const usaEntradaSemi = tipo === 'PROCESSING' || tipo === 'FINAL_PROCESSING' || tipo === 'GENERATE_QR_CODE' || (conDosTipos(tipo) && !deFinales);
  return {
    ...(original ?? {}),
    id: original?.id,
    company: original?.company ?? { id: c.empresa },
    type: tipo,
    finalProductAction: conDosTipos(tipo) ? deFinales : false,
    inputSemiProduct: usaEntradaSemi ? semi(f.entradaSemi) : undefined,
    inputFinalProduct: deFinales ? final(f.entradaFinal) : undefined,
    qrCodeForFinalProduct: tipo === 'GENERATE_QR_CODE' ? final(f.qrFinal) : undefined,
    outputSemiProducts: tipo === 'PROCESSING' ? f.salidas.map((s) => ({ ...s.semi, repackedOutput: s.reempaque, maxOutputWeight: s.reempaque ? (s.maximo ?? undefined) : undefined })) : [],
    outputFinalProduct: tipo === 'FINAL_PROCESSING' ? final(f.salidaFinal) : undefined,
    repackedOutputFinalProducts: tipo === 'FINAL_PROCESSING' ? f.reempaqueFinal : undefined,
    maxOutputWeight: tipo === 'FINAL_PROCESSING' && f.reempaqueFinal ? (f.maximoFinal ?? undefined) : undefined,
    estimatedOutputQuantityPerUnit: tipo === 'PROCESSING' ? (f.rendimiento ?? undefined) : undefined,
    prefix: f.prefijo.trim(),
    sortOrder: f.orden.trim() ? Number(f.orden.trim()) : undefined,
    publicTimelineLabel: f.etiquetaPublica.trim() || undefined,
    supportedFacilities: f.instalaciones,
    translations: IDIOMAS_ACCION.map((language) => ({ language, name: textos[language].nombre, description: textos[language].descripcion })),
    valueChains: f.cadenas,
    requiredEvidenceFields: f.campos,
    requiredDocumentTypes: f.documentos,
  };
}

/** Grupo siguiente para «uno de un grupo en el pedido» (como la versión actual: 1, 2, 3…). */
export function siguienteGrupo(documentos: ApiProcessingEvidenceType[]): string {
  const usados = documentos.map((d) => d.requiredOneOfGroupIdForQuote).filter((g): g is string => !!g && /^\d+$/.test(g)).map(Number);
  return String(usados.length ? Math.max(...usados) + 1 : 1);
}

/** Nombre para mostrar: el del idioma pedido o, si falta, el primero que haya. */
export const nombreAccion = (a: ApiProcessingAction) => a.name?.trim() || a.translations?.find((t) => t.name?.trim())?.name || `#${a.id}`;
