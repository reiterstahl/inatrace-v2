import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CampoForm, Seccion } from '../comunes';
import type { FormProductor } from '../esquema';

export function Banco() {
  const { t } = useTranslation();
  const { register } = useFormContext<FormProductor>();
  return (
    <Seccion id="banco" titulo={t('productores.secciones.banco')} descripcion={t('productores.banco.descripcion')}>
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoForm nombre="banco.accountHolderName" etiqueta={t('productores.banco.titular')} autoComplete="off" />
        <CampoForm nombre="banco.bankName" etiqueta={t('productores.banco.banco')} autoComplete="off" />
        <CampoForm nombre="banco.accountNumber" etiqueta={t('productores.banco.cuenta')} autoComplete="off" />
        <div className="grid gap-1.5 sm:col-span-2">
          <label htmlFor="banco-info" className="text-sm font-semibold text-tinta-2">{t('productores.banco.info')}</label>
          <textarea id="banco-info" rows={3} className="w-full rounded-lg border border-linea-fuerte bg-superficie px-3.5 py-2.5 focus:border-marca focus:outline-none focus:ring-3 focus:ring-marca/15" {...register('banco.additionalInformation')} />
        </div>
      </div>
    </Seccion>
  );
}
