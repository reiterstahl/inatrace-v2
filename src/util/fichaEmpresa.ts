/**
 * Ficha de la empresa: portada de company-detail de la versión actual.
 *  - El backend reemplaza con lo que recibe todos los campos de la ficha (nombre, sede, logo, moneda,
 *    Beyco…), así que se guarda siempre sobre la empresa tal como llegó y solo se cambian los campos
 *    del formulario. Los usuarios no se mandan: se administran aparte con las acciones de la empresa.
 *  - Videos, registros de producción y «Conoce a los productores» van juntos en `documents`,
 *    separados por categoría; cada uno conserva su id para que el backend lo actualice en vez de
 *    borrarlo y crearlo de nuevo.
 *  - Reglas de la versión actual: nombre, logo, dirección, descripción (≤2000), correo, teléfono,
 *    moneda y al menos una cadena de valor son obligatorios; la abreviatura, si se escribe, tiene de
 *    3 a 6 caracteres; la entrevista ≤2000 y el código postal ≤50. La frase de «Conoce a los
 *    productores» queda opcional: la versión actual solo la pedía al editar ese elemento.
 */
import type { ApiCertification, ApiCompanyDocument, ApiCompanyGet, ApiCompanyUpdate, ApiCountry, ApiCurrencyType, ApiDocument, ApiValueChain } from '@/api/gen/types.gen';

export const REDES = ['facebook', 'instagram', 'twitter', 'youtube', 'other'] as const;
export type Red = (typeof REDES)[number];

export type Video = { clave: string; id?: number; descripcion: string; enlace: string };
export type Registro = { clave: string; id?: number; descripcion: string; doc: ApiDocument | null };
export type Productor = { clave: string; id?: number; nombre: string; descripcion: string; cita: string; doc: ApiDocument | null };
export type Certificacion = { clave: string; tipo: string; descripcion: string; certificado: ApiDocument | null; vigencia: string };

export type FormEmpresa = {
  nombre: string;
  abreviatura: string;
  logo: ApiDocument | null;
  direccion: string;
  ciudad: string;
  region: string;
  postal: string;
  pais: number | null;
  acerca: string;
  gerente: string;
  correo: string;
  telefono: string;
  web: string;
  entrevista: string;
  redes: Record<Red, string>;
  videos: Video[];
  registros: Registro[];
  productores: Productor[];
  cadenas: ApiValueChain[];
  moneda: number | null;
  beyco: boolean;
  certificaciones: Certificacion[];
};

let n = 0;
export const clave = () => `e${++n}`;

const de = (docs: ApiCompanyDocument[] | undefined, categoria: ApiCompanyDocument['category']) => (docs ?? []).filter((d) => d.category === categoria);

export function formDesdeEmpresa(e: ApiCompanyGet): FormEmpresa {
  const h = e.headquarters ?? {};
  const redes = (e.mediaLinks ?? {}) as Partial<Record<string, string>>;
  return {
    nombre: e.name ?? '',
    abreviatura: e.abbreviation ?? '',
    logo: e.logo ?? null,
    direccion: h.address ?? '',
    ciudad: h.city ?? '',
    region: h.state ?? '',
    postal: h.zip ?? '',
    pais: h.country?.id ?? null,
    acerca: e.about ?? '',
    gerente: e.manager ?? '',
    correo: e.email ?? '',
    telefono: e.phone ?? '',
    web: e.webPage ?? '',
    entrevista: e.interview ?? '',
    redes: Object.fromEntries(REDES.map((r) => [r, redes[r] ?? ''])) as Record<Red, string>,
    videos: de(e.documents, 'VIDEO').map((d) => ({ clave: clave(), id: d.id, descripcion: d.description ?? '', enlace: d.link ?? '' })),
    registros: de(e.documents, 'PRODUCTION_RECORD').map((d) => ({ clave: clave(), id: d.id, descripcion: d.description ?? '', doc: d.document ?? null })),
    productores: de(e.documents, 'MEET_THE_FARMER').map((d) => ({ clave: clave(), id: d.id, nombre: d.name ?? '', descripcion: d.description ?? '', cita: d.quote ?? '', doc: d.document ?? null })),
    cadenas: e.valueChains ?? [],
    moneda: e.currency?.id ?? null,
    beyco: !!e.allowBeycoIntegration,
    certificaciones: (e.certifications ?? []).map((c) => ({ clave: clave(), tipo: c.type ?? '', descripcion: c.description ?? '', certificado: c.certificate ?? null, vigencia: c.validity ?? '' })),
  };
}

export const correoValido = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** Errores por campo; los de las listas van como `lista.clave.campo`. */
export type ErroresEmpresa = Record<string, string>;

export function validarEmpresa(f: FormEmpresa): ErroresEmpresa {
  const e: ErroresEmpresa = {};
  const req = (k: string, v: string) => {
    if (!v.trim()) e[k] = 'requerido';
  };
  const largo = (k: string, v: string, max: number) => {
    if (!e[k] && v.trim().length > max) e[k] = `largo_${max}`;
  };
  req('nombre', f.nombre);
  const ab = f.abreviatura.trim();
  if (ab && (ab.length < 3 || ab.length > 6)) e.abreviatura = 'abreviatura';
  if (!f.logo) e.logo = 'requerido';
  req('direccion', f.direccion);
  largo('postal', f.postal, 50);
  req('acerca', f.acerca);
  largo('acerca', f.acerca, 2000);
  req('correo', f.correo);
  if (!e.correo && !correoValido(f.correo)) e.correo = 'correo';
  req('telefono', f.telefono);
  largo('entrevista', f.entrevista, 2000);
  if (!f.cadenas.length) e.cadenas = 'sin_cadenas';
  if (!f.moneda) e.moneda = 'requerido';
  for (const v of f.videos) {
    req(`videos.${v.clave}.descripcion`, v.descripcion);
    largo(`videos.${v.clave}.descripcion`, v.descripcion, 2000);
    req(`videos.${v.clave}.enlace`, v.enlace);
  }
  for (const r of f.registros) {
    req(`registros.${r.clave}.descripcion`, r.descripcion);
    largo(`registros.${r.clave}.descripcion`, r.descripcion, 2000);
    if (!r.doc) e[`registros.${r.clave}.doc`] = 'requerido';
  }
  for (const p of f.productores) {
    req(`productores.${p.clave}.nombre`, p.nombre);
    req(`productores.${p.clave}.descripcion`, p.descripcion);
    largo(`productores.${p.clave}.descripcion`, p.descripcion, 2000);
    // La frase no la exige el backend y hay fichas cargadas sin ella: no se bloquea el guardado.
    largo(`productores.${p.clave}.cita`, p.cita, 2000);
    if (!p.doc) e[`productores.${p.clave}.doc`] = 'requerido';
  }
  for (const c of f.certificaciones) {
    req(`certificaciones.${c.clave}.descripcion`, c.descripcion);
    if (!c.certificado) e[`certificaciones.${c.clave}.certificado`] = 'requerido';
  }
  return e;
}

const opcional = (s: string) => s.trim() || undefined;

/** Empresa a guardar: la original con los campos del formulario encima. */
export function armarEmpresa(original: ApiCompanyGet, f: FormEmpresa, catalogos: { paises: ApiCountry[]; monedas: ApiCurrencyType[] }): ApiCompanyUpdate {
  const { paises, monedas } = catalogos;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { users, actions, companyRoles, supportsCollectors, ...resto } = original;
  const documentos: ApiCompanyDocument[] = [
    ...f.videos.map((v) => ({ id: v.id, category: 'VIDEO' as const, type: 'LINK' as const, description: v.descripcion.trim(), link: v.enlace.trim() })),
    ...f.registros.map((r) => ({ id: r.id, category: 'PRODUCTION_RECORD' as const, type: 'FILE' as const, description: r.descripcion.trim(), document: r.doc ?? undefined })),
    ...f.productores.map((p) => ({ id: p.id, category: 'MEET_THE_FARMER' as const, type: 'FILE' as const, name: p.nombre.trim(), description: p.descripcion.trim(), quote: p.cita.trim(), document: p.doc ?? undefined })),
  ];
  const certificaciones: ApiCertification[] = f.certificaciones.map((c) => ({ type: opcional(c.tipo), description: c.descripcion.trim(), certificate: c.certificado ?? undefined, validity: c.vigencia || undefined }));
  return {
    ...resto,
    name: f.nombre.trim(),
    abbreviation: opcional(f.abreviatura),
    logo: f.logo ?? undefined,
    headquarters: {
      ...(original.headquarters ?? {}),
      address: f.direccion.trim(),
      city: opcional(f.ciudad),
      state: opcional(f.region),
      zip: opcional(f.postal),
      country: f.pais ? (paises.find((p) => p.id === f.pais) ?? original.headquarters?.country) : undefined,
    },
    about: f.acerca.trim(),
    manager: opcional(f.gerente),
    email: f.correo.trim(),
    phone: f.telefono.trim(),
    webPage: opcional(f.web),
    interview: opcional(f.entrevista),
    mediaLinks: Object.fromEntries(REDES.filter((r) => f.redes[r].trim()).map((r) => [r, f.redes[r].trim()])),
    documents: documentos,
    certifications: certificaciones,
    valueChains: f.cadenas,
    // El backend valida la moneda completa (código y nombre), no solo el id.
    currency: f.moneda ? (monedas.find((m) => m.id === f.moneda) ?? (original.currency?.id === f.moneda ? original.currency : undefined)) : undefined,
    allowBeycoIntegration: f.beyco,
  };
}

// ---------- Usuarios ----------

export const ROLES_EMPRESA = ['COMPANY_ADMIN', 'MANAGER', 'ACCOUNTANT', 'COMPANY_USER'] as const;
export type RolEmpresa = (typeof ROLES_EMPRESA)[number];

/**
 * Si el cambio deja a la empresa sin administración (quitar o cambiar de rol a la última persona
 * administradora). El backend no lo impide.
 */
export function dejaSinAdministracion(usuarios: { id?: number; companyRole?: string }[], usuario: number, nuevoRol?: RolEmpresa): boolean {
  const admins = usuarios.filter((u) => u.companyRole === 'COMPANY_ADMIN');
  return admins.length === 1 && admins[0]!.id === usuario && nuevoRol !== 'COMPANY_ADMIN';
}
