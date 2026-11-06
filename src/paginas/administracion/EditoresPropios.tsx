import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { catalogos, useGuardarItem } from '@/api/catalogos';
import type { ApiCertificationType, ApiConversionFactor, ApiMapLayer } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Area, Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso } from '@/componentes/ui/Estados';
import { nombreItem, type CatalogoPropio, type ItemCatalogo } from '@/util/catalogos';
import {
  TIPOS_CAPA, armarCapa, armarCertificacion, armarFactor, formDesdeCapa, formDesdeCertificacion, formDesdeFactor, porCien,
  validarCapa, validarCertificacion, validarFactor, type FormCapa, type FormCertificacion, type FormFactor,
} from '@/util/catalogosPropios';
import { Casilla, Tarjeta } from '../productos/piezas';

const OBLIGATORIO = <span className="text-mal" aria-hidden> *</span>;
type Props<T> = { original?: T; editable: boolean; cerrar: (texto?: string) => void };

/**
 * Esqueleto común: tarjeta, formulario, validación al enviar (y en vivo después) y guardado. Cada
 * editor pone sus campos.
 */
function useFormulario<F, E extends Record<string, string | undefined>>(inicial: F, validar: (f: F) => E) {
  const [f, setF] = useState(inicial);
  const [errores, setErrores] = useState<E | null>(null);
  const cambiar = (c: Partial<F>) => {
    const nuevo = { ...f, ...c };
    setF(nuevo);
    if (errores) setErrores(validar(nuevo));
  };
  return { f, cambiar, errores, intentar: () => { const v = validar(f); setErrores(v); return Object.keys(v).length === 0; } };
}

function Marco({ cat, titulo, editable, falla, enviando, cerrar, alEnviar, children }: {
  cat: CatalogoPropio; titulo: string; editable: boolean; falla: string; enviando: boolean; cerrar: () => void; alEnviar: (e: FormEvent) => void; children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Tarjeta id={`editor-${cat}`} titulo={titulo} ayuda={editable ? undefined : t('administracion.catalogos.solo_lectura')}>
      <form onSubmit={alEnviar} noValidate className="grid gap-6">
        {falla && <Aviso tono="mal">{falla}</Aviso>}
        <fieldset disabled={!editable} className="grid min-w-0 gap-5">{children}</fieldset>
        <div className="flex flex-wrap gap-2">
          {editable && <Boton type="submit" disabled={enviando}>{t('comun.guardar')}</Boton>}
          <Boton type="button" variante="secundario" onClick={cerrar}>{editable ? t('comun.cancelar') : t('administracion.catalogos.volver')}</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

function useGuardar(cat: CatalogoPropio, cerrar: (texto?: string) => void) {
  const { t } = useTranslation();
  const guardar = useGuardarItem(cat);
  const [falla, setFalla] = useState('');
  async function enviar(item: ItemCatalogo) {
    setFalla('');
    try {
      await guardar.mutateAsync(item);
      cerrar(t('administracion.catalogos.guardado', { nombre: nombreItem(item) }));
    } catch (x) {
      setFalla((x as Error).message);
    }
  }
  return { enviar, falla, enviando: guardar.isPending };
}

const msg = (t: (k: string) => string, e?: string) => (e ? t(`administracion.catalogos.errores.${e}`) : undefined);

/** Capa de mapa: lo que la v2 y la versión actual muestran sobre los mapas de parcelas. */
export function EditorCapa({ original, editable, cerrar }: Props<ApiMapLayer>) {
  const { t } = useTranslation();
  const { f, cambiar, errores, intentar } = useFormulario<FormCapa, ReturnType<typeof validarCapa>>(formDesdeCapa(original), validarCapa);
  const { enviar, falla, enviando } = useGuardar('capas-mapa', cerrar);
  const titulo = original ? nombreItem(original) : t('administracion.catalogos.nuevo_de', { que: t('administracion.catalogos.nombres.capas-mapa').toLowerCase() });
  return (
    <Marco cat="capas-mapa" titulo={titulo} editable={editable} falla={falla} enviando={enviando} cerrar={() => cerrar()} alEnviar={(e) => { e.preventDefault(); if (intentar()) void enviar(armarCapa(original, f)); }}>
      <div className="grid gap-5 sm:grid-cols-2">
        {/* El backend no cambia el código al editar. */}
        <Campo etiqueta={<>{t('administracion.catalogos.codigo')}{OBLIGATORIO}</>} value={f.codigo} readOnly={!!original} ayuda={original ? t('administracion.catalogos.codigo_fijo') : undefined} onChange={(e) => cambiar({ codigo: e.target.value })} error={msg(t, errores?.codigo)} />
        <Campo etiqueta={<>{t('administracion.catalogos.nombre')}{OBLIGATORIO}</>} value={f.etiqueta} onChange={(e) => cambiar({ etiqueta: e.target.value })} error={msg(t, errores?.etiqueta)} />
        <Selector etiqueta={<>{t('administracion.catalogos.tipo')}{OBLIGATORIO}</>} value={f.tipo} onChange={(e) => cambiar({ tipo: e.target.value as FormCapa['tipo'] })} error={msg(t, errores?.tipo)}>
          <option value="">{t('stock.elegir')}</option>
          {TIPOS_CAPA.map((x) => <option key={x} value={x}>{t(`administracion.catalogos.capas.tipos.${x}`)}</option>)}
        </Selector>
        {f.tipo === 'WMS' && <Campo etiqueta={<>{t('administracion.catalogos.capas.capa')}{OBLIGATORIO}</>} value={f.capa} onChange={(e) => cambiar({ capa: e.target.value })} error={msg(t, errores?.capa)} />}
        <Campo
          etiqueta={<>{t('administracion.catalogos.capas.url')}{OBLIGATORIO}</>}
          ayuda={f.tipo ? t(`administracion.catalogos.capas.url_ayuda.${f.tipo}`) : undefined}
          inputMode="url"
          value={f.url}
          onChange={(e) => cambiar({ url: e.target.value })}
          error={msg(t, errores?.url)}
          className="sm:col-span-2"
        />
        <Campo etiqueta={t('administracion.catalogos.capas.opacidad')} ayuda={t('administracion.catalogos.capas.opacidad_ayuda')} inputMode="decimal" value={f.opacidad} onChange={(e) => cambiar({ opacidad: e.target.value })} error={msg(t, errores?.opacidad)} />
        <Campo etiqueta={t('administracion.catalogos.orden')} inputMode="numeric" value={f.orden} onChange={(e) => cambiar({ orden: e.target.value })} error={msg(t, errores?.orden)} />
        <Campo etiqueta={t('administracion.catalogos.capas.atribucion')} value={f.atribucion} onChange={(e) => cambiar({ atribucion: e.target.value })} className="sm:col-span-2" />
        <Area etiqueta={t('administracion.catalogos.descripcion')} rows={2} value={f.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} className="sm:col-span-2" />
      </div>
      <div className="grid gap-2">
        <Casilla marcada={f.visible} alCambiar={(visible) => cambiar({ visible })} deshabilitada={!editable}>{t('administracion.catalogos.capas.visible')}</Casilla>
        <Casilla marcada={f.activa} alCambiar={(activa) => cambiar({ activa })} deshabilitada={!editable}>{t('administracion.catalogos.activo')}</Casilla>
      </div>
    </Marco>
  );
}

/** Tipo de certificación: los sellos que se eligen en la ficha de cada productor. */
export function EditorCertificacion({ original, editable, cerrar }: Props<ApiCertificationType>) {
  const { t } = useTranslation();
  const { f, cambiar, errores, intentar } = useFormulario<FormCertificacion, ReturnType<typeof validarCertificacion>>(formDesdeCertificacion(original), validarCertificacion);
  const { enviar, falla, enviando } = useGuardar('certificaciones', cerrar);
  const titulo = original ? nombreItem(original) : t('administracion.catalogos.nuevo_de', { que: t('administracion.catalogos.nombres.certificaciones').toLowerCase() });
  return (
    <Marco cat="certificaciones" titulo={titulo} editable={editable} falla={falla} enviando={enviando} cerrar={() => cerrar()} alEnviar={(e) => { e.preventDefault(); if (intentar()) void enviar(armarCertificacion(original, f)); }}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo etiqueta={<>{t('administracion.catalogos.codigo')}{OBLIGATORIO}</>} value={f.codigo} readOnly={!!original} ayuda={original ? t('administracion.catalogos.certificaciones.codigo_fijo') : undefined} onChange={(e) => cambiar({ codigo: e.target.value })} error={msg(t, errores?.codigo)} />
        <Campo etiqueta={<>{t('administracion.catalogos.nombre')}{OBLIGATORIO}</>} value={f.etiqueta} onChange={(e) => cambiar({ etiqueta: e.target.value })} error={msg(t, errores?.etiqueta)} />
        <Area etiqueta={t('administracion.catalogos.certificaciones.significado')} rows={2} value={f.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} className="sm:col-span-2" />
        <Campo etiqueta={t('administracion.catalogos.certificaciones.logo')} inputMode="url" placeholder="https://" value={f.logo} onChange={(e) => cambiar({ logo: e.target.value })} error={msg(t, errores?.logo)} />
        <Campo etiqueta={t('administracion.catalogos.orden')} inputMode="numeric" value={f.orden} onChange={(e) => cambiar({ orden: e.target.value })} error={msg(t, errores?.orden)} />
      </div>
      <Casilla marcada={f.activa} alCambiar={(activa) => cambiar({ activa })} deshabilitada={!editable}>{t('administracion.catalogos.certificaciones.ofrecido')}</Casilla>
    </Marco>
  );
}

/** Factor de conversión: cuánto sale de un semiproducto por cada unidad que entra de otro. */
export function EditorFactor({ original, editable, cerrar }: Props<ApiConversionFactor>) {
  const { t, i18n } = useTranslation();
  const { f, cambiar, errores, intentar } = useFormulario<FormFactor, ReturnType<typeof validarFactor>>(formDesdeFactor(original), validarFactor);
  const { enviar, falla, enviando } = useGuardar('factores', cerrar);
  const semis = useQuery(catalogos.lista('semiproductos', i18n.language));
  const opciones = (semis.data ?? []).map((s) => ({ id: s.id!, nombre: nombreItem(s) }));
  const factor = Number(f.factor.replace(',', '.'));
  const titulo = original ? nombreItem(original) : t('administracion.catalogos.nuevo_de', { que: t('administracion.catalogos.nombres.factores').toLowerCase() });
  return (
    <Marco cat="factores" titulo={titulo} editable={editable} falla={falla} enviando={enviando} cerrar={() => cerrar()} alEnviar={(e) => { e.preventDefault(); if (intentar()) void enviar(armarFactor(original, f)); }}>
      {original?.companyId && <Aviso tono="info">{t('administracion.catalogos.factores.de_empresa', { empresa: original.companyId })}</Aviso>}
      <div className="grid gap-5 sm:grid-cols-2">
        {(['entrada', 'salida'] as const).map((k) => (
          <Selector key={k} etiqueta={<>{t(`administracion.catalogos.factores.${k}`)}{OBLIGATORIO}</>} value={f[k]} onChange={(e) => cambiar({ [k]: e.target.value })} error={errores?.[k] ? t(`administracion.catalogos.errores.${errores[k]}`) : undefined}>
            <option value="">{semis.isPending ? t('comun.cargando') : t('stock.elegir')}</option>
            {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </Selector>
        ))}
        <Campo
          etiqueta={<>{t('administracion.catalogos.factores.factor')}{OBLIGATORIO}</>}
          inputMode="decimal"
          value={f.factor}
          onChange={(e) => cambiar({ factor: e.target.value })}
          ayuda={factor > 0 ? t('administracion.catalogos.factores.por_cien', { n: porCien(factor).toLocaleString(i18n.language) }) : t('administracion.catalogos.factores.factor_ayuda')}
          error={msg(t, errores?.factor)}
        />
        <Area etiqueta={t('administracion.catalogos.factores.notas')} rows={2} value={f.notas} onChange={(e) => cambiar({ notas: e.target.value })} className="sm:col-span-2" />
      </div>
      <Casilla marcada={f.activo} alCambiar={(activo) => cambiar({ activo })} deshabilitada={!editable}>{t('administracion.catalogos.factores.en_uso')}</Casilla>
    </Marco>
  );
}
