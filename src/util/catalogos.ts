import type {
  ApiCertificationType, ApiConversionFactor, ApiFacilityType, ApiMapLayer, ApiMeasureUnitType, ApiProcessingEvidenceField,
  ApiProcessingEvidenceType, ApiProductType, ApiSemiProduct,
} from '@/api/gen/types.gen';

/** Los catálogos del sistema que se editan desde Administración → Catálogos. */
export const CATALOGOS = [
  'semiproductos', 'tipos-producto', 'tipos-instalacion', 'unidades', 'tipos-evidencia', 'campos-evidencia',
  // Propios de esta instalación (no están en el original): tienen su propio editor.
  'capas-mapa', 'certificaciones', 'factores',
] as const;
export type Catalogo = (typeof CATALOGOS)[number];
export const CATALOGOS_PROPIOS = ['capas-mapa', 'certificaciones', 'factores'] as const;
export type CatalogoPropio = (typeof CATALOGOS_PROPIOS)[number];
export const esPropio = (c: Catalogo): c is CatalogoPropio => (CATALOGOS_PROPIOS as readonly string[]).includes(c);
export type ItemCatalogo =
  | ApiSemiProduct | ApiProductType | ApiFacilityType | ApiMeasureUnitType | ApiProcessingEvidenceType | ApiProcessingEvidenceField
  | ApiMapLayer | ApiCertificationType | ApiConversionFactor;

/** El inglés va primero: el backend lo exige en los catálogos con traducciones. */
export const IDIOMAS_CATALOGO = ['EN', 'ES', 'DE', 'RW'] as const;
type Idioma = (typeof IDIOMAS_CATALOGO)[number];

export const TIPOS_EVIDENCIA = ['DOCUMENT', 'FIELD', 'CALCULATED'] as const;
export const TIPOS_CAMPO = ['STRING', 'TEXT', 'NUMBER', 'INTEGER', 'DATE', 'OBJECT', 'PRICE', 'EXCHANGE_RATE', 'TIMESTAMP'] as const;
export const MARCAS = ['buyable', 'sku', 'skuendCustomer', 'fairness', 'provenance', 'quality'] as const;
type Marca = (typeof MARCAS)[number];

/**
 * Qué pide cada catálogo, como la versión actual: código (en mayúsculas, números y guion bajo, salvo
 * el de los tipos de producto), etiqueta o traducciones, y los campos propios de cada uno.
 */
export const FORMA: Record<Catalogo, {
  codigo?: 'estricto' | 'libre';
  etiqueta?: boolean;
  traducciones?: 'nombre' | 'etiqueta';
  descripcionObligatoria?: boolean;
  unidad?: boolean;
  peso?: boolean;
  tipos?: readonly string[];
  marcas?: readonly Marca[];
}> = {
  semiproductos: { traducciones: 'nombre', unidad: true, marcas: ['buyable', 'sku', 'skuendCustomer'] },
  'tipos-producto': { codigo: 'libre', traducciones: 'nombre', descripcionObligatoria: true },
  'tipos-instalacion': { codigo: 'estricto', etiqueta: true },
  unidades: { codigo: 'estricto', etiqueta: true, peso: true },
  'tipos-evidencia': { codigo: 'estricto', traducciones: 'etiqueta', tipos: TIPOS_EVIDENCIA, marcas: ['fairness', 'provenance', 'quality'] },
  'campos-evidencia': { codigo: 'estricto', traducciones: 'etiqueta', tipos: TIPOS_CAMPO },
  'capas-mapa': {},
  certificaciones: {},
  factores: {},
};

type Textos = Record<Idioma, { nombre: string; descripcion: string }>;
export type FormCatalogo = {
  codigo: string;
  etiqueta: string;
  textos: Textos;
  unidad: string;
  peso: string;
  unidadBase: string;
  tipo: string;
  marcas: Record<Marca, boolean>;
};
export type CampoCatalogo = 'codigo' | 'etiqueta' | 'nombre' | 'descripcion' | 'unidad' | 'peso' | 'tipo';
export type ErroresCatalogo = Partial<Record<CampoCatalogo, 'requerido' | 'formato' | 'numero'>>;

type Traduccion = { language?: Idioma; name?: string; description?: string; label?: string };
const traducciones = (x: ItemCatalogo | undefined): Traduccion[] => ((x as { translations?: Traduccion[] } | undefined)?.translations ?? []);
const campo = <T,>(x: ItemCatalogo | undefined, k: string) => (x as Record<string, unknown> | undefined)?.[k] as T | undefined;

/** Nombre a mostrar: la etiqueta, o el nombre, o el código; un factor, como «entrada → salida». */
export const nombreItem = (x: ItemCatalogo) =>
  (campo<string>(x, 'inputSemiProductName') && `${campo<string>(x, 'inputSemiProductName')} → ${campo<string>(x, 'outputSemiProductName') ?? ''}`) ||
  campo<string>(x, 'label') || campo<string>(x, 'name') || campo<string>(x, 'code') || campo<string>(x, 'fieldName') || `#${x.id}`;
/** Código a mostrar junto al nombre. */
export const codigoItem = (x: ItemCatalogo) => campo<string>(x, 'code') ?? campo<string>(x, 'fieldName') ?? '';

export function formDesdeItem(cat: Catalogo, x?: ItemCatalogo): FormCatalogo {
  const tr = traducciones(x);
  const textos = Object.fromEntries(
    IDIOMAS_CATALOGO.map((l) => {
      const t = tr.find((y) => y.language === l);
      // Sin traducciones guardadas, el inglés toma lo que tenga el registro.
      const base = !tr.length && l === 'EN' ? { nombre: campo<string>(x, 'name') ?? campo<string>(x, 'label') ?? '', descripcion: campo<string>(x, 'description') ?? '' } : null;
      return [l, base ?? { nombre: (FORMA[cat].traducciones === 'etiqueta' ? t?.label : t?.name) ?? '', descripcion: t?.description ?? '' }];
    }),
  ) as Textos;
  const unidadBase = campo<ApiMeasureUnitType>(x, 'underlyingMeasurementUnitType')?.id;
  const peso = campo<number>(x, 'weight');
  return {
    codigo: (cat === 'campos-evidencia' ? campo<string>(x, 'fieldName') : campo<string>(x, 'code')) ?? '',
    etiqueta: campo<string>(x, 'label') ?? '',
    textos,
    unidad: campo<ApiMeasureUnitType>(x, 'measurementUnitType')?.id ? String(campo<ApiMeasureUnitType>(x, 'measurementUnitType')!.id) : '',
    peso: peso != null ? String(peso) : '',
    unidadBase: unidadBase ? String(unidadBase) : '',
    tipo: campo<string>(x, 'type') ?? '',
    marcas: Object.fromEntries(MARCAS.map((m) => [m, !!campo<boolean>(x, m)])) as Record<Marca, boolean>,
  };
}

export function validarCatalogo(cat: Catalogo, f: FormCatalogo): ErroresCatalogo {
  const forma = FORMA[cat];
  const e: ErroresCatalogo = {};
  if (forma.codigo) {
    if (!f.codigo.trim()) e.codigo = 'requerido';
    else if (forma.codigo === 'estricto' && !/^[A-Z_0-9]+$/.test(f.codigo.trim())) e.codigo = 'formato';
  }
  if (forma.etiqueta && !f.etiqueta.trim()) e.etiqueta = 'requerido';
  if (forma.traducciones) {
    if (!f.textos.EN.nombre.trim()) e.nombre = 'requerido';
    if (forma.descripcionObligatoria && !f.textos.EN.descripcion.trim()) e.descripcion = 'requerido';
  }
  if (forma.unidad && !f.unidad) e.unidad = 'requerido';
  if (forma.peso && f.peso.trim() && !(Number(f.peso.replace(',', '.')) > 0)) e.peso = 'numero';
  if (forma.tipos && !f.tipo) e.tipo = 'requerido';
  return e;
}

/**
 * El registro a guardar, sobre el original. Las traducciones van solo para los idiomas con texto (el
 * backend borra las demás); el nombre o la etiqueta principal es la del inglés, como en la versión actual.
 */
export function armarItem(cat: Catalogo, original: ItemCatalogo | undefined, f: FormCatalogo): ItemCatalogo {
  const en = { nombre: f.textos.EN.nombre.trim(), descripcion: f.textos.EN.descripcion.trim() };
  const conTexto = IDIOMAS_CATALOGO.filter((l) => f.textos[l].nombre.trim());
  const marcas = Object.fromEntries((FORMA[cat].marcas ?? []).map((m) => [m, f.marcas[m]]));
  const base = { ...original } as Record<string, unknown>;
  switch (cat) {
    case 'semiproductos':
      return {
        ...base, ...marcas, name: en.nombre, description: en.descripcion, measurementUnitType: { id: Number(f.unidad) } as ApiMeasureUnitType,
        translations: conTexto.map((language) => ({ language, name: f.textos[language].nombre.trim(), description: f.textos[language].descripcion.trim() })),
      } as ApiSemiProduct;
    case 'tipos-producto':
      return {
        ...base, code: f.codigo.trim(), name: en.nombre, description: en.descripcion,
        translations: conTexto.map((language) => ({ language, name: f.textos[language].nombre.trim(), description: f.textos[language].descripcion.trim() })),
      } as ApiProductType;
    case 'tipos-instalacion':
      return { ...base, code: f.codigo.trim(), label: f.etiqueta.trim() } as ApiFacilityType;
    case 'unidades': {
      const peso = f.peso.trim() ? Number(f.peso.replace(',', '.')) : undefined;
      return {
        ...base, code: f.codigo.trim(), label: f.etiqueta.trim(), weight: peso,
        underlyingMeasurementUnitType: f.unidadBase ? ({ id: Number(f.unidadBase) } as ApiMeasureUnitType) : undefined,
      } as ApiMeasureUnitType;
    }
    case 'tipos-evidencia':
      return {
        ...base, ...marcas, code: f.codigo.trim(), label: en.nombre, type: f.tipo,
        translations: conTexto.map((language) => ({ language, label: f.textos[language].nombre.trim() })),
      } as ApiProcessingEvidenceType;
    case 'campos-evidencia':
      return {
        ...base, fieldName: f.codigo.trim(), label: en.nombre, type: f.tipo,
        translations: conTexto.map((language) => ({ language, label: f.textos[language].nombre.trim() })),
      } as ApiProcessingEvidenceField;
    default:
      // Los catálogos propios se arman con su editor (util/catalogosPropios.ts).
      return base as ItemCatalogo;
  }
}

/** Como el backend: la regional crea pero no edita; borrar es de la administración del sistema. */
export function permisosCatalogo(rol: string | undefined) {
  const sistema = rol === 'SYSTEM_ADMIN';
  return { crear: sistema || rol === 'REGIONAL_ADMIN', editar: sistema, borrar: sistema };
}
