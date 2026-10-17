import { useEffect, useRef } from 'react';
import { Link, Outlet, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ErrorApi, urlDocumento } from '@/api/respuesta';
import { EstadoError } from '@/componentes/ui/Estados';
import { Icono, type NombreIcono } from '@/componentes/ui/Icono';
import { SelectorIdioma } from '@/componentes/ui/Preferencias';
import { cambiarIdioma, deApi, idiomaElegido } from '@/i18n';
import type { ApiBusinessToCustomerSettings } from '@/api/gen/types.gen';
import { pestanas, useVitrina, type Pestana } from './datos';
import { estiloMarca } from './marca';

/** Marco de la vitrina: colores y fuentes del producto, idioma de la etiqueta y pie. */
export function Vitrina() {
  const d = useVitrina();
  useIdiomaDeEtiqueta(d.etiqueta.language);
  useFuentesDelProducto(d.ajustes);

  useEffect(() => {
    document.title = d.producto ? `${d.producto} · INATrace` : 'INATrace';
  }, [d.producto]);

  return (
    <div className="tema-claro flex min-h-dvh flex-col bg-papel text-tinta" style={{ ...estiloMarca(d.ajustes), fontFamily: 'var(--fuente-texto, inherit)' }}>
      <div className="flex-1">
        <Outlet />
      </div>
      <Pie />
    </div>
  );
}

/** La etiqueta está escrita en un idioma: la interfaz lo sigue, salvo que la persona haya elegido otro. */
function useIdiomaDeEtiqueta(idiomaEtiqueta?: string) {
  useEffect(() => {
    const l = deApi(idiomaEtiqueta);
    if (l && !idiomaElegido()) cambiarIdioma(l, false);
  }, [idiomaEtiqueta]);
}

/** Fuentes propias del producto (si las cargaron): títulos y texto. */
function useFuentesDelProducto(a: ApiBusinessToCustomerSettings) {
  const titulo = a.productFont?.storageKey;
  const texto = a.textFont?.storageKey;
  useEffect(() => {
    const raiz = document.documentElement.style;
    const cargar = (familia: string, clave: string | undefined, variable: string) => {
      if (!clave) return;
      new FontFace(familia, `url(${urlDocumento(clave)})`)
        .load()
        .then((f) => {
          document.fonts.add(f);
          raiz.setProperty(variable, `'${familia}'`);
        })
        .catch(() => undefined); // si la fuente no carga, se queda la del sistema
    };
    cargar('producto-titulo', titulo, '--fuente-producto');
    cargar('producto-texto', texto, '--fuente-texto');
    return () => {
      raiz.removeProperty('--fuente-producto');
      raiz.removeProperty('--fuente-texto');
    };
  }, [titulo, texto]);
}

const RUTA_PESTANA = {
  journey: '/p-cd/$etiqueta/$qr/journey',
  'fair-prices': '/p-cd/$etiqueta/$qr/fair-prices',
  producers: '/p-cd/$etiqueta/$qr/producers',
  quality: '/p-cd/$etiqueta/$qr/quality',
  feedback: '/p-cd/$etiqueta/$qr/feedback',
} as const satisfies Record<Pestana, string>;

const ICONO_PESTANA: Record<Pestana, NombreIcono> = {
  journey: 'ruta',
  'fair-prices': 'precio',
  producers: 'personas',
  quality: 'taza',
  feedback: 'mensaje',
};

export function enlacePestana(p: Pestana) {
  return RUTA_PESTANA[p];
}
export function iconoPestana(p: Pestana) {
  return ICONO_PESTANA[p];
}

/** Encabezado de las secciones: nombre del producto y pestañas. La portada tiene el suyo. */
export function Seccion({ titulo, intro, children }: { titulo: string; intro?: React.ReactNode; children: React.ReactNode }) {
  const d = useVitrina();
  const { t } = useTranslation();
  const fondo = urlDocumento(d.ajustes.headerBackgroundImage?.storageKey);
  // En el celular las pestañas no entran: la activa se desplaza a la vista.
  const barra = useRef<HTMLElement>(null);
  useEffect(() => {
    barra.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [titulo]);
  return (
    <>
      <header className="relative overflow-hidden bg-marca text-sobre-marca">
        {fondo && <img src={fondo} alt="" className="absolute inset-0 size-full object-cover opacity-35" />}
        <div className="relative mx-auto max-w-3xl px-5 pt-6 pb-5">
          <Link to="/p-cd/$etiqueta/$qr" params={d.params} className="inline-flex items-center gap-2 text-sm font-medium opacity-90 hover:opacity-100">
            <Icono nombre="volver" className="size-4" />
            <span className="font-titulo text-lg font-semibold" style={{ fontFamily: 'var(--fuente-producto, var(--font-titulo))' }}>
              {d.producto}
            </span>
          </Link>
        </div>
        <nav ref={barra} className="relative mx-auto max-w-3xl overflow-x-auto px-3 pb-3 [scrollbar-width:none]" aria-label={t('vitrina.recorrido.titulo')}>
          <ul className="flex w-max gap-1">
            {pestanas(d.ajustes).map((p) => (
              <li key={p}>
                <Link
                  to={RUTA_PESTANA[p]}
                  params={d.params}
                  className="inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap text-sobre-marca/85 hover:bg-white/10 hover:text-sobre-marca"
                  activeProps={{ className: '!bg-papel !text-marca', 'aria-current': 'page' }}
                >
                  <Icono nombre={ICONO_PESTANA[p]} className="size-4" />
                  <span className="first-letter:uppercase">{t(`vitrina.pestanas.${p}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-titulo text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: 'var(--titulo-vitrina, var(--tinta))' }}>
          {titulo}
        </h1>
        {intro && <div className="mt-3 text-lg leading-relaxed text-tinta-2">{intro}</div>}
        <div className="mt-8">{children}</div>
      </main>
    </>
  );
}

const REDES = ['facebook', 'instagram', 'twitter', 'youtube', 'other'] as const;
const NOMBRE_RED: Record<(typeof REDES)[number], string> = { facebook: 'Facebook', instagram: 'Instagram', twitter: 'X', youtube: 'YouTube', other: 'Web' };

/** Solo enlaces http(s): lo que escribe la empresa no puede convertirse en un javascript: */
export function enlaceSeguro(url?: string | null): string | undefined {
  if (!url) return undefined;
  const conEsquema = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : 'https://' + url;
  try {
    const u = new URL(conEsquema);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

function Pie() {
  const d = useVitrina();
  const { t } = useTranslation();
  const redes = REDES.map((r) => [r, enlaceSeguro(d.campo(`company.mediaLinks.${r}`))] as const).filter(([, u]) => u);
  return (
    <footer className="border-t border-linea bg-superficie">
      <div className="mx-auto grid max-w-3xl gap-6 px-5 py-8">
        {redes.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label={t('vitrina.pie.redes')}>
            {redes.map(([r, u]) => (
              <li key={r}>
                <a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-linea px-3.5 text-sm font-medium text-tinta-2 hover:border-marca hover:text-marca">
                  {NOMBRE_RED[r]} <Icono nombre="externo" className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-tinta-3">
          <nav className="flex gap-4">
            <Link to="/p-cd/$etiqueta/$qr/terms-of-use" params={d.params} className="hover:text-tinta">
              {t('vitrina.legal.terminos')}
            </Link>
            <Link to="/p-cd/$etiqueta/$qr/privacy-policy" params={d.params} className="hover:text-tinta">
              {t('vitrina.legal.privacidad')}
            </Link>
          </nav>
          <SelectorIdioma />
        </div>
        <p className="flex items-center gap-2 text-xs text-tinta-3">
          <Icono nombre="hoja" className="size-3.5 text-marca" />
          {t('vitrina.pie.trazabilidad')}
        </p>
      </div>
    </footer>
  );
}

export function VitrinaError({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const noEsta = error instanceof ErrorApi && error.noEncontrado;
  return (
    <div className="tema-claro grid min-h-dvh place-items-center bg-papel text-tinta">
      {noEsta ? (
        <EstadoError titulo={t('vitrina.no_encontrada')} texto={t('vitrina.no_encontrada_texto')} />
      ) : (
        <EstadoError reintentar={() => void router.invalidate()} />
      )}
    </div>
  );
}
