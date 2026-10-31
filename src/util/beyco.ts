/**
 * Oferta de café en Beyco (marketplace de café verde), portada de beyco-offer-list de la versión
 * actual y alineada con BeycoOrderService del backend:
 *  - el backend arma los campos iniciales a partir de los lotes elegidos (nombre, cosecha,
 *    certificaciones, zaranda, taza y grado, y el puerto según la instalación);
 *  - las mismas validaciones de la versión actual: título hasta 70 caracteres, zaranda entre 8 y 20
 *    (mínima ≤ máxima), taza entre 60 y 100 (desde 80 se marca como especialidad), y los textos
 *    libres cuando se elige «Otro»;
 *  - el backend fija al enviar la privacidad (pública), precio fijo, a granel y en kilos.
 */
import type { ApiStockOrder, ApiBeycoCoffee, ApiBeycoCoffeeCertificate, ApiBeycoCoffeeGrade, ApiBeycoCoffeeQuality, ApiBeycoCoffeeVariety, ApiBeycoOrderCoffees, ApiBeycoOrderFields } from '@/api/gen/types.gen';

type Valores<T> = NonNullable<T>;
export type Variedad = Valores<ApiBeycoCoffeeVariety['type']>;
export type Segmento = Valores<ApiBeycoCoffeeQuality['type']>;
export type Grado = Valores<ApiBeycoCoffeeGrade['type']>;
export type Certificado = Valores<ApiBeycoCoffeeCertificate['type']>;
export type Incoterm = Valores<ApiBeycoOrderCoffees['incoterms']>;
export type Moneda = Valores<ApiBeycoOrderCoffees['currency']>;
export type UnidadPrecio = Valores<ApiBeycoOrderCoffees['priceUnit']>;
export type Especie = Valores<ApiBeycoCoffee['species']>;
export type Proceso = Valores<ApiBeycoCoffee['process']>;

export const VARIEDADES: Variedad[] = ['Bourbon', 'Castillo', 'Catimor', 'Catuai', 'Caturra', 'Geisha', 'Heirloom', 'Ih90', 'Jackson', 'Java', 'Lempira', 'MundoNovo', 'Sl14', 'Sl28', 'Sl34', 'Typica', 'Other'];
export const SEGMENTOS: Segmento[] = ['Specialty', 'CommodityConventional', 'LowGrade'];
export const GRADOS: Grado[] = ['Na', 'Grade1', 'Grade2', 'Grade3', 'Grade4', 'Grade5', 'Aa', 'A', 'Ab', 'B', 'C', 'Pb', 'X', 'E', 'Psc', 'Y1', 'Y2', 'T', 'HgHb', 'ShgShb', 'Other'];
export const CERTIFICADOS: Certificado[] = ['Ra', 'Fairtrade', 'Organic', 'Practices', 'FourC'];
export const INCOTERMS: Incoterm[] = ['Tbd', 'Fob', 'Fot', 'Fca', 'Fas', 'Exw', 'Cfr', 'Cif', 'Cpt', 'Cip', 'Dap', 'Dpu', 'Ddp', 'Other'];
export const MONEDAS: Moneda[] = ['Usd', 'UsdCt', 'Eur'];
export const UNIDADES_PRECIO: UnidadPrecio[] = ['Kg', 'Lb', 'Mg'];
export const ESPECIES: Especie[] = ['Arabica', 'Robusta'];
export const PROCESOS: Proceso[] = ['FullyWashed', 'SemiWashedHoney', 'Natural', 'Other'];

export type CafeBeyco = {
  clave: string;
  lote: string;
  nombre: string;
  cantidad: number | null;
  precio: number | null;
  unidadPrecio: UnidadPrecio | '';
  moneda: Moneda | '';
  cosecha: string;
  region: string;
  pais: string;
  incoterm: Incoterm | '';
  incotermOtro: string;
  especie: Especie | '';
  proceso: Proceso | '';
  zarandaMin: number | null;
  zarandaMax: number | null;
  taza: number | null;
  variedades: Variedad[];
  variedadOtra: string;
  segmentos: Segmento[];
  grados: Grado[];
  gradoOtro: string;
  certificados: Certificado[];
};

export type OfertaBeyco = {
  titulo: string;
  disponible: string;
  direccion: string;
  pais: string;
  latitud: number | null;
  longitud: number | null;
  cafes: CafeBeyco[];
};

const dia = (iso?: string) => (iso ? iso.slice(0, 10) : '');

/** Formulario inicial a partir de los campos que arma el backend para los lotes elegidos. */
export function ofertaDesdeCampos(c: ApiBeycoOrderFields): OfertaBeyco {
  return {
    titulo: c.title ?? '',
    disponible: dia(c.availableAt),
    direccion: c.portOfExport?.address ?? '',
    pais: c.portOfExport?.country ?? '',
    latitud: c.portOfExport?.latitude ?? null,
    longitud: c.portOfExport?.longitude ?? null,
    cafes: (c.offerCoffees ?? []).map((o, i): CafeBeyco => {
      const cafe = o.coffee ?? {};
      return {
        clave: `c${i + 1}`,
        lote: cafe.name ?? '',
        nombre: cafe.name ?? '',
        cantidad: cafe.quantity ?? null,
        precio: o.price ?? null,
        unidadPrecio: o.priceUnit ?? '',
        moneda: o.currency ?? '',
        cosecha: dia(cafe.harvestAt),
        region: cafe.region ?? '',
        pais: cafe.country ?? '',
        incoterm: o.incoterms ?? '',
        incotermOtro: o.customIncoterms ?? '',
        especie: cafe.species ?? '',
        proceso: cafe.process ?? '',
        zarandaMin: cafe.minScreenSize ?? null,
        zarandaMax: cafe.maxScreenSize ?? null,
        taza: cafe.cuppingScore ?? null,
        variedades: (cafe.varieties ?? []).map((v) => v.type).filter((v): v is Variedad => !!v),
        variedadOtra: cafe.varieties?.find((v) => v.type === 'Other')?.customVariety ?? '',
        segmentos: conEspecialidad((cafe.qualitySegments ?? []).map((v) => v.type).filter((v): v is Segmento => !!v), cafe.cuppingScore ?? null),
        grados: (cafe.grades ?? []).map((v) => v.type).filter((v): v is Grado => !!v),
        gradoOtro: cafe.additionalQualityDescriptors ?? '',
        certificados: (cafe.certificates ?? []).map((v) => v.type).filter((v): v is Certificado => !!v),
      };
    }),
  };
}

/**
 * El backend nombra cada café con el número interno del lote, que las entregas (compras) no tienen:
 * ahí llega vacío. Se completa con el identificador del lote, en el mismo orden en que se pidieron.
 */
export function completarNombres(f: OfertaBeyco, lotes: (ApiStockOrder | undefined)[]): OfertaBeyco {
  return {
    ...f,
    cafes: f.cafes.map((c, i) => {
      const o = lotes[i];
      const nombre = o?.internalLotNumber || o?.identifier || '';
      return { ...c, lote: c.lote || nombre, nombre: c.nombre || nombre };
    }),
  };
}

/** Desde 80 puntos de taza el café es de especialidad (como la versión actual). */
export function conEspecialidad(segmentos: Segmento[], taza: number | null): Segmento[] {
  return taza !== null && taza >= 80 && !segmentos.includes('Specialty') ? [...segmentos, 'Specialty'] : segmentos;
}

export type ErroresCafe = Partial<Record<keyof CafeBeyco, string>>;
export type ErroresOferta = Partial<Record<'titulo' | 'disponible' | 'direccion' | 'pais' | 'latitud' | 'longitud', string>> & { cafes: Record<string, ErroresCafe> };

const MAXIMO = 999_999_999_999_999_999;
const fechaValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function validarOferta(f: OfertaBeyco): ErroresOferta {
  const e: ErroresOferta = { cafes: {} };
  if (!f.titulo.trim()) e.titulo = 'requerido';
  else if (f.titulo.trim().length > 70) e.titulo = 'titulo_largo';
  if (!fechaValida(f.disponible)) e.disponible = 'requerido';
  if (!f.direccion.trim()) e.direccion = 'requerido';
  if (!f.pais.trim()) e.pais = 'requerido';
  if (f.latitud === null || Number.isNaN(f.latitud)) e.latitud = 'requerido';
  else if (f.latitud < -90 || f.latitud > 90) e.latitud = 'coordenada';
  if (f.longitud === null || Number.isNaN(f.longitud)) e.longitud = 'requerido';
  else if (f.longitud < -180 || f.longitud > 180) e.longitud = 'coordenada';

  for (const c of f.cafes) {
    const ec: ErroresCafe = {};
    if (!c.nombre.trim()) ec.nombre = 'requerido';
    for (const k of ['cantidad', 'precio'] as const) {
      const v = c[k];
      if (v === null || Number.isNaN(v)) ec[k] = 'requerido';
      else if (v < 0 || v > MAXIMO) ec[k] = 'rango';
    }
    if (!c.unidadPrecio) ec.unidadPrecio = 'requerido';
    if (!c.moneda) ec.moneda = 'requerido';
    if (!fechaValida(c.cosecha)) ec.cosecha = 'requerido';
    if (!c.pais.trim()) ec.pais = 'requerido';
    if (!c.incoterm) ec.incoterm = 'requerido';
    else if (c.incoterm === 'Other' && !c.incotermOtro.trim()) ec.incotermOtro = 'requerido';
    if (!c.especie) ec.especie = 'requerido';
    for (const k of ['zarandaMin', 'zarandaMax'] as const) {
      const v = c[k];
      if (v === null || Number.isNaN(v)) ec[k] = 'requerido';
      else if (v < 8 || v > 20) ec[k] = 'zaranda';
    }
    if (!ec.zarandaMin && !ec.zarandaMax && c.zarandaMin! > c.zarandaMax!) ec.zarandaMax = 'zaranda_orden';
    if (c.taza === null || Number.isNaN(c.taza)) ec.taza = 'requerido';
    else if (c.taza < 60 || c.taza > 100) ec.taza = 'taza';
    if (!c.variedades.length) ec.variedades = 'requerido';
    else if (c.variedades.includes('Other') && !c.variedadOtra.trim()) ec.variedadOtra = 'requerido';
    if (!c.segmentos.length) ec.segmentos = 'requerido';
    if (!c.grados.length) ec.grados = 'requerido';
    else if (c.grados.includes('Other') && !c.gradoOtro.trim()) ec.gradoOtro = 'requerido';
    if (Object.keys(ec).length) e.cafes[c.clave] = ec;
  }
  return e;
}

export const sinErroresOferta = (e: ErroresOferta) => Object.keys(e).filter((k) => k !== 'cafes').length === 0 && Object.keys(e.cafes).length === 0;

export function armarOferta(f: OfertaBeyco): ApiBeycoOrderFields {
  return {
    title: f.titulo.trim(),
    availableAt: f.disponible,
    portOfExport: { address: f.direccion.trim(), country: f.pais.trim(), latitude: f.latitud!, longitude: f.longitud! },
    offerCoffees: f.cafes.map(
      (c): ApiBeycoOrderCoffees => ({
        currency: c.moneda || undefined,
        price: c.precio!,
        priceUnit: c.unidadPrecio || undefined,
        incoterms: c.incoterm || undefined,
        customIncoterms: c.incoterm === 'Other' ? c.incotermOtro.trim() : undefined,
        coffee: {
          name: c.nombre.trim(),
          quantity: c.cantidad!,
          harvestAt: c.cosecha,
          region: c.region.trim() || undefined,
          country: c.pais.trim(),
          species: c.especie || undefined,
          process: c.proceso || undefined,
          minScreenSize: c.zarandaMin!,
          maxScreenSize: c.zarandaMax!,
          cuppingScore: c.taza!,
          varieties: c.variedades.map((v) => ({ type: v, customVariety: v === 'Other' ? c.variedadOtra.trim() : undefined })),
          qualitySegments: c.segmentos.map((v) => ({ type: v })),
          grades: c.grados.map((v) => ({ type: v })),
          additionalQualityDescriptors: c.grados.includes('Other') ? c.gradoOtro.trim() : undefined,
          certificates: c.certificados.map((v) => ({ type: v })),
        },
      }),
    ),
  };
}

// ---------- Autorización OAuth2 con Beyco ----------

/**
 * URL de autorización de Beyco con los mismos parámetros que usa la versión actual
 * (responseType, clientId, redirectUri, scope y state).
 */
export function urlAutorizacion(base: string, clientId: string, redirectUri: string, state: string): string {
  const p = [
    'responseType=code',
    'clientId=' + encodeURIComponent(clientId),
    'redirectUri=' + encodeURIComponent(redirectUri),
    'scope=' + encodeURIComponent('Offer:Create'),
    'state=' + encodeURIComponent(state),
  ];
  return base + (base.includes('?') ? '&' : '?') + p.join('&');
}

/** Lo que se guarda antes de salir hacia Beyco, para validar la vuelta y retomar la oferta. */
export type Pendiente = { state: string; empresa: number; lotes: number[] };

/**
 * Resultado de la vuelta de Beyco. El `state` tiene que coincidir con el que se generó al salir
 * (protege contra una vuelta que no inició esta pestaña).
 */
export function resolverVuelta(
  q: { code?: string; state?: string; error?: string },
  pendiente: Pendiente | null,
): { ok: true; code: string; pendiente: Pendiente } | { ok: false; motivo: 'estado' | 'denegado' | 'sin_codigo' } {
  if (!pendiente || !q.state || q.state !== pendiente.state) return { ok: false, motivo: 'estado' };
  if (q.error) return { ok: false, motivo: 'denegado' };
  if (!q.code) return { ok: false, motivo: 'sin_codigo' };
  return { ok: true, code: q.code, pendiente };
}
