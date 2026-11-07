import { lazy, Suspense, useMemo, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ApiMapLayer, ApiProductType } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Icono } from '@/componentes/ui/Icono';
import { aHectareas, difiereDeDibujada, m2AHectareas, superficieM2, type Punto } from '@/util/geo';
import { Aviso } from '@/componentes/ui/Estados';
import { puntoDe } from '@/util/productor';
import { CampoForm, Seccion, SelectorForm } from '../comunes';
import { parcelaVacia, type FormProductor } from '../esquema';
import { confirmar } from '@/componentes/ui/Confirmar';

const MapaParcelas = lazy(() => import('@/componentes/mapa/MapaParcelas'));
const EditorParcela = lazy(() => import('@/componentes/mapa/EditorParcela'));

export function Parcelas({
  tiposProducto,
  capas,
  alSubirGeo,
  alExportarGeo,
  ocupado,
  sinCatalogo,
}: {
  tiposProducto: ApiProductType[];
  capas: ApiMapLayer[];
  /** Solo para productores ya guardados (la API trabaja sobre el productor existente). */
  alSubirGeo?: (archivo: File) => void;
  alExportarGeo?: () => void;
  ocupado?: boolean;
  /** La empresa no tiene cultivos en sus cadenas de valor (solo se ofrecen los que ya tiene el productor). */
  sinCatalogo?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { control, watch, setValue } = useFormContext<FormProductor>();
  const lista = useFieldArray({ control, name: 'parcelas' });
  const [editando, setEditando] = useState<number | null>(null);
  const parcelas = watch('parcelas');
  const [lat, lng] = [watch('lat'), watch('lng')];
  const ubicacion = lat !== '' && lng !== '' ? puntoDe({ latitude: Number(lat.replace(',', '.')), longitude: Number(lng.replace(',', '.')) }) : null;

  const enMapa = useMemo(() => parcelas.map((p, i) => ({ id: i, nombre: p.plotName, coordenadas: p.coordenadas as Punto[] })), [parcelas]);
  const ha = (c: Punto[]) => m2AHectareas(superficieM2(c));
  const formatoHa = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 2 });

  function agregar() {
    lista.append(parcelaVacia());
    setEditando(lista.fields.length);
  }

  return (
    <Seccion
      id="parcelas"
      titulo={t('productores.secciones.parcelas')}
      descripcion={t('productores.parcela.descripcion')}
      acciones={
        <div className="flex flex-wrap gap-2">
          {alSubirGeo && (
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-linea-fuerte bg-superficie px-3 text-sm font-semibold hover:bg-superficie-2">
              <Icono nombre="subir" className="size-4" /> {t('productores.parcela.subir_geojson')}
              <input type="file" accept=".geojson,.json,application/geo+json,application/json" className="sr-only" disabled={ocupado} onChange={(e) => e.target.files?.[0] && alSubirGeo(e.target.files[0])} />
            </label>
          )}
          {alExportarGeo && parcelas.some((p) => p.coordenadas.length >= 3) && (
            <Boton variante="secundario" chico onClick={alExportarGeo} disabled={ocupado}>
              <Icono nombre="descarga" className="size-4" /> {t('productores.parcela.exportar_geojson')}
            </Boton>
          )}
          <Boton chico onClick={agregar}>
            <Icono nombre="mas" className="size-4" /> {t('productores.parcela.agregar')}
          </Boton>
        </div>
      }
    >
      {(parcelas.some((p) => p.coordenadas.length >= 3) || ubicacion) && editando === null && (
        <Suspense fallback={<div className="mb-5 h-80 animate-pulse rounded-caja bg-superficie-2" />}>
          <MapaParcelas parcelas={enMapa} capas={capas} punto={ubicacion} etiqueta={t('productores.parcela.mapa_resumen')} className="mb-5 h-80" alElegir={(id) => setEditando(Number(id))} />
        </Suspense>
      )}

      {lista.fields.length === 0 ? (
        <p className="text-sm text-tinta-3">{t('productores.parcela.vacio')}</p>
      ) : (
        <ul className="grid gap-4">
          {lista.fields.map((campo, i) => {
            const p = parcelas[i]!;
            const dibujada = ha(p.coordenadas as Punto[]);
            const abierta = editando === i;
            return (
              <li key={campo.id} className={'rounded-lg border p-4 ' + (abierta ? 'border-marca bg-marca-suave/40' : 'border-linea bg-superficie-2')}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-superficie text-marca shadow-suave">
                    <Icono nombre="mapa" className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.plotName || t('productores.parcela.sin_nombre')}</p>
                    <p className="text-sm text-tinta-2">
                      {p.coordenadas.length >= 3 ? t('productores.parcela.con_poligono', { ha: formatoHa(dibujada) }) : t('productores.parcela.sin_poligono')}
                      {p.geoId && <span className="ml-2 rounded bg-ok-suave px-1.5 py-0.5 text-xs font-semibold text-ok">GeoID</span>}
                    </p>
                  </div>
                  <Boton variante={abierta ? 'primario' : 'secundario'} chico onClick={() => setEditando(abierta ? null : i)} aria-expanded={abierta}>
                    {abierta ? t('productores.parcela.listo') : t('productores.parcela.editar')}
                  </Boton>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!(await confirmar(t('productores.parcela.quitar_confirmar', { nombre: p.plotName || t('productores.parcela.sin_nombre') }), { accion: 'quitar' }))) return;
                      lista.remove(i);
                      setEditando(null);
                    }}
                    className="rounded-lg p-2 text-tinta-3 hover:bg-mal-suave hover:text-mal"
                    aria-label={t('productores.parcela.quitar', { nombre: p.plotName })}
                  >
                    <Icono nombre="borrar" className="size-4" />
                  </button>
                </div>

                {abierta && (
                  <div className="mt-4 grid gap-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <CampoForm nombre={`parcelas.${i}.plotName`} etiqueta={t('productores.parcela.nombre')} requerido />
                      <SelectorForm nombre={`parcelas.${i}.cropId`} etiqueta={t('productores.parcela.cultivo')} requerido comoNumero ayuda={sinCatalogo ? t('productores.finca.sin_catalogo') : undefined}>
                        <option value="">{t('productores.parcela.elegir_cultivo')}</option>
                        {tiposProducto.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </SelectorForm>
                      <CampoForm nombre={`parcelas.${i}.numberOfPlants`} etiqueta={t('productores.finca.plantas')} inputMode="numeric" />
                      <div className="grid grid-cols-[1fr_7rem] gap-3">
                        <CampoForm nombre={`parcelas.${i}.size`} etiqueta={t('productores.parcela.superficie')} inputMode="decimal" />
                        <CampoForm nombre={`parcelas.${i}.unit`} etiqueta={t('productores.finca.unidad')} list="unidades-area" />
                      </div>
                      <CampoForm nombre={`parcelas.${i}.organicStartOfTransition`} etiqueta={t('productores.finca.inicio_transicion')} type="date" />
                      {p.geoId && (
                        <div className="grid content-start gap-1.5">
                          <span className="text-sm font-semibold text-tinta-2">GeoID</span>
                          <code className="truncate rounded-lg bg-superficie px-3 py-2.5 text-sm" title={p.geoId}>{p.geoId}</code>
                        </div>
                      )}
                    </div>
                    {(() => {
                      const declarada = p.size === '' ? null : aHectareas(Number(p.size.replace(',', '.')), p.unit);
                      return declarada !== null && difiereDeDibujada(declarada, dibujada) ? (
                        <Aviso tono="aviso">{t('productores.parcela.difiere', { declarada: formatoHa(declarada), dibujada: formatoHa(dibujada) })}</Aviso>
                      ) : null;
                    })()}
                    {dibujada > 0 && p.size === '' && (
                      <button
                        type="button"
                        onClick={() => {
                          setValue(`parcelas.${i}.size`, dibujada.toFixed(2), { shouldDirty: true });
                          setValue(`parcelas.${i}.unit`, 'ha', { shouldDirty: true });
                        }}
                        className="w-fit text-sm font-semibold text-marca hover:underline"
                      >
                        {t('productores.parcela.usar_dibujada', { ha: formatoHa(dibujada) })}
                      </button>
                    )}
                    <Suspense fallback={<div className="h-[26rem] animate-pulse rounded-caja bg-superficie-2" />}>
                      <EditorParcela
                        coordenadas={p.coordenadas as Punto[]}
                        otras={parcelas.filter((_, j) => j !== i).map((x) => x.coordenadas as Punto[])}
                        capas={capas}
                        centro={ubicacion}
                        alCambiar={(c) => setValue(`parcelas.${i}.coordenadas`, c, { shouldDirty: true })}
                      />
                    </Suspense>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Seccion>
  );
}
