import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ApiCompanyListResponse } from '@/api/gen/types.gen';
import { Casilla, Seccion } from '../comunes';
import type { FormProductor } from '../esquema';

/** `miembro`: clave del texto de la casilla (los recolectores dicen «Recolecta para…»). */
export function Organizaciones({ empresa, asociaciones, miembro = 'productores.organizaciones.miembro' }: { empresa: string; asociaciones: ApiCompanyListResponse[]; miembro?: string }) {
  const { t } = useTranslation();
  const { watch, setValue } = useFormContext<FormProductor>();
  const elegidas = new Set(watch('asociaciones'));
  return (
    <Seccion id="organizaciones" titulo={t('productores.secciones.organizaciones')}>
      <div className="grid gap-5">
        <Casilla nombre="miembroCooperativa">{t(miembro, { empresa })}</Casilla>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold text-tinta-2">{t('productores.organizaciones.asociaciones')}</legend>
          {asociaciones.length === 0 ? (
            <p className="text-sm text-tinta-3">{t('productores.organizaciones.sin_asociaciones')}</p>
          ) : (
            asociaciones.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--marca)]"
                  checked={elegidas.has(a.id!)}
                  onChange={(e) => {
                    const n = new Set(elegidas);
                    if (e.target.checked) n.add(a.id!);
                    else n.delete(a.id!);
                    setValue('asociaciones', [...n], { shouldDirty: true });
                  }}
                />
                {a.name}
              </label>
            ))
          )}
        </fieldset>
      </div>
    </Seccion>
  );
}
