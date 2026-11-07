import { useQueries, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { consultas } from '@/api/consultas';
import { productos } from '@/api/productos';
import { etiquetas } from '@/api/etiquetas';
import { Icono, type NombreIcono } from '@/componentes/ui/Icono';
import { esAdministracion } from '@/util/administracion';

type Destino = '/productores' | '/stock' | '/productos' | '/empresa' | '/administracion';

/** Los módulos de la plataforma, con su entrada. La administración solo se muestra a quien administra. */
const MODULOS: { clave: string; icono: NombreIcono; v2: Destino; admin?: true }[] = [
  { clave: 'vitrina', icono: 'qr', v2: '/productos' },
  { clave: 'productores', icono: 'personas', v2: '/productores' },
  { clave: 'stock', icono: 'bodega', v2: '/stock' },
  { clave: 'productos', icono: 'certificado', v2: '/productos' },
  { clave: 'empresa', icono: 'web', v2: '/empresa' },
  { clave: 'administracion', icono: 'lista', v2: '/administracion', admin: true },
];

/** Cuántos productos se revisan para encontrar una etiqueta publicada que mostrar. */
const PRODUCTOS_A_REVISAR = 5;

/**
 * La vitrina es de cada etiqueta (la abre su QR): desde el inicio se abre la primera etiqueta
 * publicada de los productos de la persona. Sin ninguna, la tarjeta lleva a Productos.
 */
function useVitrinaPublicada(): string | null {
  const lista = useQuery({ ...productos.lista({ pagina: 1 }), staleTime: 5 * 60_000 });
  const ids = (lista.data?.items ?? []).slice(0, PRODUCTOS_A_REVISAR).map((p) => p.id!).filter(Boolean);
  const listas = useQueries({ queries: ids.map((id) => ({ ...etiquetas.lista(id), staleTime: 5 * 60_000 })) });
  for (const l of listas) {
    const publicada = (l.data ?? []).find((e) => e.status === 'PUBLISHED' && e.uuid);
    if (publicada) return `${import.meta.env.BASE_URL}p-cd/${publicada.uuid}/EMPTY`;
  }
  return null;
}

// La tarjeta entera es el enlace. Al pasar el cursor (o con el foco del teclado) se levanta apenas,
// el borde toma el color de la marca y el ícono gira y se rellena.
const TARJETA =
  'group flex h-full flex-col gap-4 rounded-caja border border-linea bg-superficie p-5 shadow-suave transition duration-200 hover:-translate-y-0.5 hover:border-marca/50 hover:shadow-alta focus-visible:-translate-y-0.5 focus-visible:border-marca motion-reduce:transform-none';
const ICONO =
  'grid size-11 place-items-center rounded-xl bg-marca-suave text-marca transition duration-500 ease-out group-hover:rotate-360 group-hover:bg-marca group-hover:text-sobre-marca group-focus-visible:rotate-360 group-focus-visible:bg-marca group-focus-visible:text-sobre-marca motion-reduce:rotate-0';

function Contenido({ clave, icono, externo }: { clave: string; icono: NombreIcono; externo?: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <span className={ICONO}>
        <Icono nombre={icono} className="size-5" />
      </span>
      <span className="block">
        <span className="block font-semibold">{t(`portal.modulo.${clave}`)}</span>
        <span className="mt-1 block text-sm text-tinta-2">{t(`portal.modulo.${clave}_desc`)}</span>
      </span>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-marca">
        {t('portal.abrir')}
        <Icono nombre={externo ? 'externo' : 'flecha'} className={clsx('size-3.5 transition-transform duration-200', !externo && 'group-hover:translate-x-1')} />
        {externo && <span className="sr-only">({t('portal.pestana_nueva')})</span>}
      </span>
    </>
  );
}

export function Inicio() {
  const { t } = useTranslation();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const vitrina = useVitrinaPublicada();
  return (
    <div className="grid gap-10">
      <section className="max-w-2xl">
        <h1 className="font-titulo text-4xl font-semibold tracking-tight">{t('portal.hola', { nombre: yo.name || yo.email })}</h1>
        <p className="mt-3 text-lg leading-relaxed text-tinta-2">{t('portal.bienvenida')}</p>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-tinta-3 uppercase">{t('portal.modulos')}</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.filter((m) => !m.admin || esAdministracion(yo.role)).map((m) => (
            <li key={m.clave}>
              {m.clave === 'vitrina' && vitrina ? (
                <a href={vitrina} target="_blank" rel="noopener" className={TARJETA}>
                  <Contenido clave={m.clave} icono={m.icono} externo />
                </a>
              ) : (
                <Link to={m.v2} className={TARJETA}>
                  <Contenido clave={m.clave} icono={m.icono} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
