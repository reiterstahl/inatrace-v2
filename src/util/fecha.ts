/** "2026-09-03" (o con hora) → fecha legible en el idioma activo, sin correr el día por zona horaria. */
export function fechaLarga(iso: string | undefined | null, idioma: string): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return iso;
  return new Intl.DateTimeFormat(idioma, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(a, m - 1, d));
}

/** "2026-09-03" → "3 sept 2026": para tablas y tarjetas. */
export function fechaCorta(iso: string | undefined | null, idioma: string): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return iso;
  return new Intl.DateTimeFormat(idioma, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(a, m - 1, d));
}
