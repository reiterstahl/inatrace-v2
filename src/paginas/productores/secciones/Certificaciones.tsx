import { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ApiCertificationType } from '@/api/gen/types.gen';
import { subirDocumento } from '@/api/productores';
import { Boton } from '@/componentes/ui/Boton';
import { Icono } from '@/componentes/ui/Icono';
import { CampoForm, Seccion, SelectorForm } from '../comunes';
import type { FormProductor } from '../esquema';

export function Certificaciones({ tipos }: { tipos: ApiCertificationType[] }) {
  const { t } = useTranslation();
  const { control, watch, setValue } = useFormContext<FormProductor>();
  const lista = useFieldArray({ control, name: 'certificaciones' });
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subir(i: number, archivo?: File) {
    if (!archivo) return;
    setSubiendo(i);
    setError(null);
    try {
      setValue(`certificaciones.${i}.certificate`, await subirDocumento(archivo), { shouldDirty: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(null);
    }
  }

  return (
    <Seccion
      id="certificaciones"
      titulo={t('productores.secciones.certificaciones')}
      acciones={
        <Boton variante="secundario" chico onClick={() => lista.append({ type: '', description: '', validity: '', certificate: null })}>
          <Icono nombre="mas" className="size-4" /> {t('productores.certificaciones.agregar')}
        </Boton>
      }
    >
      {error && <p role="alert" className="mb-3 text-sm text-mal">{error}</p>}
      {lista.fields.length === 0 ? (
        <p className="text-sm text-tinta-3">{t('productores.certificaciones.vacio')}</p>
      ) : (
        <ul className="grid gap-4">
          {lista.fields.map((c, i) => {
            const doc = watch(`certificaciones.${i}.certificate`);
            return (
              <li key={c.id} className="grid gap-4 rounded-lg bg-superficie-2 p-4 sm:grid-cols-2">
                {tipos.length > 0 ? (
                  <SelectorForm nombre={`certificaciones.${i}.type`} etiqueta={t('productores.certificaciones.tipo')} requerido>
                    <option value="">{t('productores.certificaciones.elegir')}</option>
                    {tipos.map((x) => <option key={x.code} value={x.code}>{x.label ?? x.code}</option>)}
                    {/* Un tipo cargado antes del catálogo sigue apareciendo. */}
                    {c.type && !tipos.some((x) => x.code === c.type) && <option value={c.type}>{c.type}</option>}
                  </SelectorForm>
                ) : (
                  <CampoForm nombre={`certificaciones.${i}.type`} etiqueta={t('productores.certificaciones.tipo')} requerido />
                )}
                <CampoForm nombre={`certificaciones.${i}.validity`} etiqueta={t('productores.certificaciones.vigencia')} type="date" />
                <CampoForm nombre={`certificaciones.${i}.description`} etiqueta={t('productores.certificaciones.descripcion')} className="sm:col-span-2" />
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  {doc?.storageKey ? (
                    <a href={`/api/common/document/${encodeURIComponent(doc.storageKey)}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-marca hover:underline" download={doc.name}>
                      <Icono nombre="descarga" className="size-4" /> {doc.name ?? t('productores.certificaciones.documento')}
                    </a>
                  ) : (
                    <span className="text-sm text-tinta-3">{t('productores.certificaciones.sin_documento')}</span>
                  )}
                  <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-linea-fuerte bg-superficie px-3 text-sm font-semibold hover:bg-superficie-2">
                    <Icono nombre="subir" className="size-4" />
                    {subiendo === i ? t('comun.cargando') : doc ? t('productores.certificaciones.reemplazar') : t('productores.certificaciones.subir')}
                    <input type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => void subir(i, e.target.files?.[0])} />
                  </label>
                  <button type="button" onClick={() => lista.remove(i)} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-tinta-3 hover:bg-mal-suave hover:text-mal">
                    <Icono nombre="borrar" className="size-4" /> {t('productores.certificaciones.quitar')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Seccion>
  );
}
