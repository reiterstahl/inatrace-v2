/**
 * Base de conocimiento del producto: portada de product-label-knowledge-blog y knowledge-blog-part
 * de la versión actual.
 *  - Cada entrada es de un tema (equidad, calidad u origen) que el backend no deja cambiar después:
 *    al actualizar copia título, resumen, contenido, fecha, video y documentos, pero no el tema.
 *  - El resumen y el contenido llegan como HTML (la versión actual usaba un editor enriquecido); se
 *    editan tal cual y la vista previa los muestra saneados.
 *  - Los largos son los del backend: título y enlace 255, resumen 3000, contenido 5000.
 *  - El enlace del video se guarda con https:// si se escribió sin protocolo (la versión actual le
 *    ponía http:// al mostrarlo).
 */
import type { ApiDocument, ApiKnowledgeBlog } from '@/api/gen/types.gen';

export const TEMAS = ['FAIRNESS', 'QUALITY', 'PROVENANCE'] as const;
export type Tema = (typeof TEMAS)[number];

export const MAXIMOS = { titulo: 255, resumen: 3000, contenido: 5000, video: 255 } as const;

export type FormEntrada = {
  id?: number;
  tema: Tema | '';
  titulo: string;
  fecha: string;
  resumen: string;
  contenido: string;
  video: string;
  documentos: ApiDocument[];
};

export const entradaVacia = (): FormEntrada => ({ tema: '', titulo: '', fecha: '', resumen: '', contenido: '', video: '', documentos: [] });

export function formDesdeEntrada(e: ApiKnowledgeBlog): FormEntrada {
  return {
    id: e.id,
    tema: e.type ?? '',
    titulo: e.title ?? '',
    fecha: e.date ?? '',
    resumen: e.summary ?? '',
    contenido: e.content ?? '',
    video: e.youtubeUrl ?? '',
    documentos: e.documents ?? [],
  };
}

/** Enlace con protocolo; vacío si no se escribió nada. */
export function normalizarEnlace(texto: string): string {
  const s = texto.trim();
  if (!s) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s;
}

export function enlaceValido(texto: string): boolean {
  try {
    const u = new URL(normalizarEnlace(texto));
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}

export type ErroresEntrada = Partial<Record<'tema' | 'titulo' | 'resumen' | 'contenido' | 'video', string>>;

export function validarEntrada(f: FormEntrada): ErroresEntrada {
  const e: ErroresEntrada = {};
  if (!f.tema) e.tema = 'requerido';
  if (!f.titulo.trim()) e.titulo = 'requerido';
  else if (f.titulo.trim().length > MAXIMOS.titulo) e.titulo = 'largo';
  if (f.resumen.trim().length > MAXIMOS.resumen) e.resumen = 'largo';
  if (f.contenido.trim().length > MAXIMOS.contenido) e.contenido = 'largo';
  if (f.video.trim()) {
    if (!enlaceValido(f.video)) e.video = 'enlace';
    else if (normalizarEnlace(f.video).length > MAXIMOS.video) e.video = 'largo';
  }
  return e;
}

export const sinErroresEntrada = (e: ErroresEntrada) => Object.keys(e).length === 0;

/** Entrada a guardar: el backend reemplaza todos los campos (y los documentos) con lo que recibe. */
export function armarEntrada(f: FormEntrada): ApiKnowledgeBlog {
  const opcional = (s: string) => s.trim() || undefined;
  return {
    id: f.id,
    type: f.tema || undefined,
    title: f.titulo.trim(),
    date: f.fecha || undefined,
    summary: opcional(f.resumen),
    content: opcional(f.contenido),
    youtubeUrl: normalizarEnlace(f.video) || undefined,
    documents: f.documentos,
  };
}
