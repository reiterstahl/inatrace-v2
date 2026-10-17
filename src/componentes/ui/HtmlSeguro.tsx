import DOMPurify from 'dompurify';
import { useMemo } from 'react';

/**
 * Texto con formato que llega del backend (descripciones, términos, privacidad). Lo escribe
 * gente de cada empresa, así que se sanea siempre: sin scripts, estilos ni eventos.
 * Si no trae etiquetas HTML, se muestra como texto respetando los saltos de línea.
 */
export function HtmlSeguro({ html, className = '' }: { html?: string | null; className?: string }) {
  const limpio = useMemo(() => {
    if (!html) return '';
    if (!/<[a-z][\s\S]*>/i.test(html)) return null;
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input'], FORBID_ATTR: ['style'] });
  }, [html]);
  if (!html) return null;
  if (limpio === null) return <div className={'prosa whitespace-pre-line ' + className}>{html}</div>;
  return <div className={'prosa ' + className} dangerouslySetInnerHTML={{ __html: limpio }} />;
}
