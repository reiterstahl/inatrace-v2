import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Casilla, CampoForm, Seccion, useErrorDe } from '../comunes';
import type { FormProductor } from '../esquema';

const GENEROS = ['FEMALE', 'MALE', 'DIVERSE', 'N_A'] as const;

export function Personales() {
  const { t } = useTranslation();
  const { register, watch } = useFormContext<FormProductor>();
  const error = useErrorDe()('gender');
  const genero = watch('gender');
  return (
    <Seccion id="personales" titulo={t('productores.secciones.personales')}>
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoForm nombre="name" etiqueta={t('productores.campos.nombre')} autoComplete="off" />
        <CampoForm nombre="surname" etiqueta={t('productores.campos.apellido')} requerido autoComplete="off" />
        <fieldset className="grid gap-2 sm:col-span-2" aria-invalid={!!error}>
          <legend className="mb-2 text-sm font-semibold text-tinta-2">
            {t('productores.campos.genero')}
            <span className="text-mal" aria-hidden="true"> *</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {GENEROS.map((g) => (
              <label
                key={g}
                className={
                  'inline-flex h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--foco)] ' +
                  (genero === g ? 'border-marca bg-marca text-sobre-marca' : 'border-linea-fuerte bg-superficie text-tinta-2 hover:border-marca')
                }
              >
                <input type="radio" value={g} className="sr-only" {...register('gender')} />
                {t(`productores.generos.${g}`)}
              </label>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-mal">{error}</p>}
        </fieldset>
        <CampoForm nombre="farmerCompanyInternalId" etiqueta={t('productores.campos.id_interno')} ayuda={t('productores.campos.id_interno_ayuda')} />
        <div />
        <CampoForm nombre="phone" etiqueta={t('productores.campos.telefono')} type="tel" autoComplete="off" />
        <CampoForm nombre="email" etiqueta={t('productores.campos.correo')} type="email" autoComplete="off" />
        <div className="sm:col-span-2">
          <Casilla nombre="hasSmartphone">{t('productores.campos.smartphone')}</Casilla>
        </div>
      </div>
    </Seccion>
  );
}
