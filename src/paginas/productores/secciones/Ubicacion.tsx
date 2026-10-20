import { lazy, Suspense } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ApiCountry } from '@/api/gen/types.gen';
import { formatoDireccion, puntoDe } from '@/util/productor';
import { CampoForm, Seccion, SelectorForm } from '../comunes';
import type { FormProductor } from '../esquema';

const SelectorUbicacion = lazy(() => import('@/componentes/mapa/SelectorUbicacion'));

export function Ubicacion({ paises }: { paises: ApiCountry[] }) {
  const { t } = useTranslation();
  const { watch, setValue } = useFormContext<FormProductor>();
  const idPais = watch('pais');
  const pais = paises.find((p) => p.id === idPais);
  const formato = formatoDireccion(pais?.code);
  const [lat, lng] = [watch('lat'), watch('lng')];
  const punto = lat !== '' && lng !== '' ? puntoDe({ latitude: Number(lat.replace(',', '.')), longitude: Number(lng.replace(',', '.')) }) : null;

  return (
    <Seccion id="ubicacion" titulo={t('productores.secciones.ubicacion')}>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectorForm nombre="pais" etiqueta={t('productores.ubicacion.pais')} requerido comoNumero className="sm:col-span-2">
          <option value="">{t('productores.ubicacion.elegir_pais')}</option>
          {paises.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </SelectorForm>

        {formato === 'RW' && (
          <>
            <CampoForm nombre="dir.village" etiqueta={t('productores.ubicacion.aldea')} requerido />
            <CampoForm nombre="dir.cell" etiqueta={t('productores.ubicacion.celda')} requerido />
            <CampoForm nombre="dir.sector" etiqueta={t('productores.ubicacion.sector')} requerido />
          </>
        )}
        {formato === 'HN' && (
          <>
            <CampoForm nombre="dir.hondurasFarm" etiqueta={t('productores.ubicacion.finca')} />
            <CampoForm nombre="dir.hondurasVillage" etiqueta={t('productores.ubicacion.aldea')} requerido />
            <CampoForm nombre="dir.hondurasMunicipality" etiqueta={t('productores.ubicacion.municipio')} requerido />
            <CampoForm nombre="dir.hondurasDepartment" etiqueta={t('productores.ubicacion.departamento')} requerido />
          </>
        )}
        {formato === 'general' && (
          <>
            <CampoForm nombre="dir.address" etiqueta={t('productores.ubicacion.direccion')} className="sm:col-span-2" />
            <CampoForm nombre="dir.city" etiqueta={t('productores.ubicacion.ciudad')} requerido />
            <CampoForm nombre="dir.state" etiqueta={t('productores.ubicacion.estado')} requerido />
            <CampoForm nombre="dir.zip" etiqueta={t('productores.ubicacion.codigo_postal')} />
            <CampoForm nombre="dir.otherAddress" etiqueta={t('productores.ubicacion.otra')} />
          </>
        )}

        <div className="grid gap-3 sm:col-span-2">
          <p className="text-sm font-semibold text-tinta-2">{t('productores.ubicacion.punto')}</p>
          <Suspense fallback={<div className="h-72 animate-pulse rounded-caja bg-superficie-2" />}>
            <SelectorUbicacion
              valor={punto}
              centro={pais && typeof pais.longitude === 'number' && typeof pais.latitude === 'number' ? [pais.longitude, pais.latitude] : null}
              alCambiar={([x, y]) => {
                setValue('lng', x.toFixed(6), { shouldDirty: true, shouldValidate: true });
                setValue('lat', y.toFixed(6), { shouldDirty: true, shouldValidate: true });
              }}
            />
          </Suspense>
          <div className="grid gap-5 sm:grid-cols-2">
            <CampoForm nombre="lat" etiqueta={t('productores.ubicacion.latitud')} inputMode="decimal" />
            <CampoForm nombre="lng" etiqueta={t('productores.ubicacion.longitud')} inputMode="decimal" />
          </div>
        </div>
      </div>
    </Seccion>
  );
}
