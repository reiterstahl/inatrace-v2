import { useFieldArray, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ApiProductType } from '@/api/gen/types.gen';
import { Icono } from '@/componentes/ui/Icono';
import { Casilla, CampoForm, Seccion } from '../comunes';
import type { FormProductor } from '../esquema';

export const UNIDADES_AREA = ['ha', 'mz', 'm²', 'acre'];

export function Finca({ tiposProducto }: { tiposProducto: ApiProductType[] }) {
  const { t } = useTranslation();
  const { control, watch } = useFormContext<FormProductor>();
  const cultivos = useFieldArray({ control, name: 'cultivos' });
  const organico = watch('organico');
  const usados = new Set(watch('cultivos').map((c) => c.productTypeId));
  const disponibles = tiposProducto.filter((p) => !usados.has(p.id!));
  const nombre = (id: number) => tiposProducto.find((p) => p.id === id)?.name ?? `#${id}`;
  const unidad = watch('unidadArea');

  return (
    <Seccion id="finca" titulo={t('productores.secciones.finca')}>
      <datalist id="unidades-area">
        {UNIDADES_AREA.map((u) => <option key={u} value={u} />)}
      </datalist>
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoForm nombre="unidadArea" etiqueta={t('productores.finca.unidad')} list="unidades-area" ayuda={t('productores.finca.unidad_ayuda')} />
        <CampoForm nombre="areaTotal" etiqueta={t('productores.finca.area_total')} inputMode="decimal" ayuda={unidad || undefined} />

        <div className="grid gap-3 sm:col-span-2">
          <p className="text-sm font-semibold text-tinta-2">{t('productores.finca.cultivos')}</p>
          {cultivos.fields.length === 0 && <p className="text-sm text-tinta-3">{t('productores.finca.sin_cultivos')}</p>}
          <ul className="grid gap-3">
            {cultivos.fields.map((c, i) => (
              <li key={c.id} className="grid gap-3 rounded-lg bg-superficie-2 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <p className="font-semibold sm:pb-2.5">{nombre(c.productTypeId)}</p>
                <CampoForm nombre={`cultivos.${i}.area`} etiqueta={t('productores.finca.area_cultivo', { unidad: unidad || '—' })} inputMode="decimal" />
                <CampoForm nombre={`cultivos.${i}.plantas`} etiqueta={t('productores.finca.plantas')} inputMode="numeric" />
                <button type="button" onClick={() => cultivos.remove(i)} className="h-11 rounded-lg px-3 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('productores.finca.quitar_cultivo', { cultivo: nombre(c.productTypeId) })}>
                  <Icono nombre="borrar" className="mx-auto size-4" />
                </button>
              </li>
            ))}
          </ul>
          {disponibles.length > 0 && (
            <label className="inline-flex w-fit items-center gap-2 text-sm">
              <Icono nombre="mas" className="size-4 text-marca" />
              <select
                value=""
                onChange={(e) => e.target.value && cultivos.append({ productTypeId: Number(e.target.value), area: '', plantas: '' })}
                className="h-9 cursor-pointer rounded-lg border border-linea-fuerte bg-superficie px-2 font-semibold text-marca"
                aria-label={t('productores.finca.agregar_cultivo')}
              >
                <option value="">{t('productores.finca.agregar_cultivo')}</option>
                {disponibles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="grid gap-4 sm:col-span-2">
          <Casilla nombre="organico">{t('productores.finca.organico')}</Casilla>
          {organico && (
            <div className="grid gap-5 sm:grid-cols-2">
              <CampoForm nombre="areaOrganica" etiqueta={t('productores.finca.area_organica')} inputMode="decimal" ayuda={unidad || undefined} />
              <CampoForm nombre="inicioTransicion" etiqueta={t('productores.finca.inicio_transicion')} type="date" />
            </div>
          )}
        </div>
      </div>
    </Seccion>
  );
}
