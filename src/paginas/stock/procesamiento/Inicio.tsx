import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { procesamiento } from '@/api/procesamiento';
import { stock } from '@/api/stock';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono, type NombreIcono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { nombreInstalacion } from '@/util/formato';
import { accionesDeInstalacion } from '@/util/procesamiento';

const ICONO_TIPO: Record<string, NombreIcono> = { PROCESSING: 'hoja', FINAL_PROCESSING: 'taza', TRANSFER: 'barco', GENERATE_QR_CODE: 'qr' };

export function InicioProcesamiento() {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  return <Contenido empresa={empresa.id} />;
}

function Contenido({ empresa }: { empresa: number }) {
  const { t } = useTranslation();
  const instalaciones = useQuery(stock.instalaciones(empresa));
  const acciones = useQuery(procesamiento.acciones(empresa));

  if (instalaciones.isPending || acciones.isPending) return <Cargando />;
  if (instalaciones.isError || acciones.isError) return <EstadoError reintentar={() => { void instalaciones.refetch(); void acciones.refetch(); }} />;

  const conAcciones = instalaciones.data.map((f) => ({ instalacion: f, acciones: accionesDeInstalacion(acciones.data, f) }));
  const ninguna = conAcciones.every((x) => x.acciones.length === 0);

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-titulo text-3xl font-semibold tracking-tight">{t('stock.proc.titulo')}</h1>
        <p className="mt-1 max-w-2xl text-tinta-2">{t('stock.proc.descripcion')}</p>
      </header>

      {ninguna && (
        <Aviso tono="info" titulo={t('stock.proc.sin_acciones')}>
          {t('stock.proc.sin_acciones_texto')}{' '}
          <Link to="/empresa/acciones" className="font-semibold underline">{t('empresa.acciones.ir')}</Link>
        </Aviso>
      )}

      <ul className="grid gap-4 md:grid-cols-2">
        {conAcciones.map(({ instalacion: f, acciones: lista }) => (
          <li key={f.id} className="flex flex-col gap-4 rounded-caja border border-linea bg-superficie p-5 shadow-suave">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-marca-suave text-marca">
                <Icono nombre="bodega" className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold">{nombreInstalacion(f)}</h2>
                <p className="mt-0.5 text-sm text-tinta-3">
                  {[f.facilityType?.label, ...(f.facilitySemiProductList ?? []).map((s) => s.name), ...(f.facilityFinalProducts ?? []).map((p) => p.name)].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            {lista.length === 0 ? (
              <p className="text-sm text-tinta-3">{t('stock.proc.instalacion_sin_acciones')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {lista.map((a) => (
                  <Link
                    key={a.id}
                    to="/stock/procesamiento/nueva"
                    search={{ accion: a.id!, inst: f.id }}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-linea-fuerte bg-superficie px-3 text-sm font-semibold hover:border-marca hover:bg-marca-suave hover:text-marca"
                  >
                    <Icono nombre={ICONO_TIPO[a.type ?? ''] ?? 'ruta'} className="size-4" /> {a.name}
                  </Link>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
