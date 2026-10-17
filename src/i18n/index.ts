import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './textos/es.json';
import en from './textos/en.json';
import de from './textos/de.json';
import rw from './textos/rw.json';
import { leer, guardar } from '@/util/almacen';

export const IDIOMAS = ['es', 'en', 'de', 'rw'] as const;
export type Idioma = (typeof IDIOMAS)[number];

/** El backend usa EN/DE/RW/ES; la interfaz, códigos en minúscula. */
export const deApi = (l?: string | null): Idioma | undefined => {
  const x = l?.toLowerCase();
  return (IDIOMAS as readonly string[]).includes(x ?? '') ? (x as Idioma) : undefined;
};
export const aApi = (l: Idioma) => l.toUpperCase() as 'ES' | 'EN' | 'DE' | 'RW';

const CLAVE = 'inatrace.idioma';

/** Idioma elegido a mano por la persona (si lo eligió). Tiene prioridad sobre todo lo demás. */
export const idiomaElegido = (): Idioma | undefined => deApi(leer(CLAVE));

function inicial(): Idioma {
  return idiomaElegido() ?? deApi(navigator.language.slice(0, 2)) ?? 'es';
}

export function cambiarIdioma(l: Idioma, recordar = true) {
  if (recordar) guardar(CLAVE, l);
  void i18n.changeLanguage(l);
  document.documentElement.lang = l;
}

void i18n.use(initReactI18next).init({
  resources: { es: { t: es }, en: { t: en }, de: { t: de }, rw: { t: rw } },
  defaultNS: 't',
  lng: inicial(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React ya escapa
  returnNull: false,
});
document.documentElement.lang = i18n.language;

export default i18n;
