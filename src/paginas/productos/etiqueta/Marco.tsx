import { Link, Outlet, getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { etiquetas } from '@/api/etiquetas';
import { Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono, type NombreIcono } from '@/componentes/ui/Icono';
import { Estado } from '../Etiquetas';

const ruta = getRouteApi('/portal/productos/$id/etiquetas/$etiqueta');

type Destino = '/productos/$id/etiquetas/$etiqueta' | '/productos/$id/etiquetas/$etiqueta/lotes' | '/productos/$id/etiquetas/$etiqueta/opiniones' | '/productos/$id/etiquetas/$etiqueta/estadisticas';
const PARTES: { to: Destino; clave: string; icono: NombreIcono; exacta?: boolean }[] = [
  { to: '/productos/$id/etiquetas/$etiqueta', clave: 'contenido', icono: 'editar', exacta: true },
  { to: '/productos/$id/etiquetas/$etiqueta/lotes', clave: 'lotes', icono: 'lista' },
  { to: '/productos/$id/etiquetas/$etiqueta/opiniones', clave: 'opiniones', icono: 'mensaje' },
  { to: '/productos/$id/etiquetas/$etiqueta/estadisticas', clave: 'estadisticas', icono: 'grafico' },
];

/** Una etiqueta: su contenido, sus lotes, las opiniones que recibió y sus estadísticas. */
export function MarcoEtiqueta() {
  const { t } = useTranslation();
  const params = ruta.useParams();
  const consulta = useQuery(etiquetas.etiqueta(Number(params.etiqueta)));
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} />;
  const e = consulta.data;
  return (
    <div className="grid gap-5 [&>*]:min-w-0">
      <div>
        <Link to="/productos/$id/etiquetas" params={{ id: params.id }} className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
          <Icono nombre="volver" className="size-4" /> {t('productos.etiquetas.titulo')}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="font-titulo text-2xl font-semibold">{e.title || `#${e.id}`}</h2>
          <Estado publicada={e.status === 'PUBLISHED'} />
          {e.language && <span className="text-sm text-tinta-2">{t(`productos.idiomas.${e.language}`)}</span>}
        </div>
      </div>
      <nav aria-label={t('productos.etiquetas.partes.titulo')} className="flex flex-wrap gap-1 rounded-xl bg-superficie-2 p-1 text-sm">
        {PARTES.map((p) => (
          <Link
            key={p.to}
            to={p.to}
            params={params}
            activeOptions={{ exact: !!p.exacta }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 font-semibold text-tinta-2 hover:text-tinta"
            activeProps={{ className: '!bg-superficie !text-marca shadow-suave', 'aria-current': 'page' }}
          >
            <Icono nombre={p.icono} className="size-4" /> {t(`productos.etiquetas.partes.${p.clave}`)}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
