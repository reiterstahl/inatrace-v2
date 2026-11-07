import { Suspense, lazy, useState } from 'react';
import { useBlocker } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useGuardarProducto } from '@/api/productos';
import { Area, Selector } from '@/componentes/ui/Campo';
import { Aviso } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import {
  COLORES, GRAFICOS, PESTANAS, PRECIOS, armarVitrina, formDesdeVitrina, moverPunto, puntoRecorrido, validarVitrina,
  type ErroresVitrina, type FormVitrina,
} from '@/util/vitrinaProducto';
import { NumeroConUnidad } from '../stock/procesamiento/piezas';
import { ConVisibilidad, type Visibilidad } from './Ficha';
import { useProducto } from './Marco';
import { BarraGuardar, CampoArchivo, CampoColor, Casilla, Tarjeta } from './piezas';
import { confirmarSalida } from '@/componentes/ui/Confirmar';

const SelectorPuntos = lazy(() => import('@/componentes/mapa/SelectorPuntos'));

const sinErrores = (e: ErroresVitrina) => Object.keys(e).length === 0;

/** Pestaña "Vitrina y recorrido" del producto. */
export function VitrinaProducto() {
  const { t } = useTranslation();
  const { producto, editable } = useProducto();
  const guardar = useGuardarProducto();
  const [f, setF] = useState<FormVitrina>(() => formDesdeVitrina(producto));
  const [tocado, setTocado] = useState(false);
  const [errores, setErrores] = useState<ErroresVitrina>({});
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok'; texto: string } | null>(null);
  const cambiar = (c: Partial<FormVitrina>) => {
    setF((x) => ({ ...x, ...c }));
    setTocado(true);
  };
  useBlocker({ shouldBlockFn: async () => tocado && !guardar.isPending && !(await confirmarSalida(t('stock.entrega.salir_sin_guardar'))), enableBeforeUnload: () => tocado });

  async function alGuardar() {
    setAviso(null);
    const e = validarVitrina(f);
    setErrores(e);
    if (!sinErrores(e)) {
      setAviso({ tono: 'mal', texto: t('stock.entrega.revisar') });
      return;
    }
    try {
      await guardar.mutateAsync(armarVitrina(f, producto));
      setTocado(false);
      setAviso({ tono: 'ok', texto: t('productos.guardado') });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  return (
    <div className="grid gap-6">
      <p className="text-tinta-2">{t('productos.vitrina.intro')}</p>
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <EditorVitrina f={f} cambiar={cambiar} errores={errores} editable={editable} />
      {editable && tocado && <BarraGuardar texto={t('productores.ficha.cambios')} guardando={guardar.isPending} alGuardar={() => void alGuardar()} />}
    </div>
  );
}

/**
 * Apariencia, pestañas, precios y recorrido de la vitrina. Lo usan el producto y cada etiqueta
 * (que guarda su propia copia).
 */
export function EditorVitrina({ f, cambiar, errores, editable, visibilidad }: { f: FormVitrina; cambiar: (c: Partial<FormVitrina>) => void; errores: ErroresVitrina; editable: boolean; visibilidad?: Visibilidad }) {
  const { t } = useTranslation();
  const err = (k: keyof ErroresVitrina) => (errores[k] ? t(`productos.vitrina.errores.${errores[k]}`) : undefined);
  const archivo = (k: keyof FormVitrina['archivos']) => ({ doc: f.archivos[k], alCambiar: (d: FormVitrina['archivos'][typeof k]) => cambiar({ archivos: { ...f.archivos, [k]: d } }), deshabilitado: !editable });
  const fuentes = ['ttf', 'woff', 'woff2'];
  const imagenes = ['png', 'jpg', 'jpeg'];

  return (
    <fieldset disabled={!editable} className="grid min-w-0 gap-6">
      <Tarjeta id="apariencia" titulo={t('productos.vitrina.apariencia')} ayuda={t('productos.vitrina.apariencia_ayuda')}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          {COLORES.map((c) => (
            <CampoColor key={c} etiqueta={t(`productos.vitrina.colores.${c}`)} valor={f.colores[c]} alCambiar={(v) => cambiar({ colores: { ...f.colores, [c]: v } })} error={err(c)} deshabilitado={!editable} />
          ))}
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
          <CampoArchivo etiqueta={t('productos.vitrina.archivos.productFont')} ayuda={t('productos.vitrina.ayuda_fuente_titulo')} tipos={fuentes} {...archivo('productFont')} />
          <CampoArchivo etiqueta={t('productos.vitrina.archivos.textFont')} ayuda={t('productos.vitrina.ayuda_fuente_texto')} tipos={fuentes} {...archivo('textFont')} />
          <CampoArchivo etiqueta={t('productos.vitrina.archivos.landingPageImage')} ayuda={t('productos.vitrina.ayuda_tamano', { tamano: '780×780' })} tipos={imagenes} imagen {...archivo('landingPageImage')} />
          <CampoArchivo etiqueta={t('productos.vitrina.archivos.landingPageBackgroundImage')} ayuda={t('productos.vitrina.ayuda_tamano', { tamano: '1200×1800' })} tipos={imagenes} imagen {...archivo('landingPageBackgroundImage')} />
          <CampoArchivo etiqueta={t('productos.vitrina.archivos.headerBackgroundImage')} ayuda={t('productos.vitrina.ayuda_tamano', { tamano: '1200×476' })} tipos={imagenes} imagen {...archivo('headerBackgroundImage')} />
        </div>
      </Tarjeta>

      <Tarjeta id="pestanas" titulo={t('productos.vitrina.pestanas')} ayuda={t('productos.vitrina.pestanas_ayuda')}>
        <ul className="grid gap-3">
          {PESTANAS.map((p) => (
            <li key={p} className="grid items-center gap-3 rounded-lg border border-linea p-3 sm:grid-cols-[1fr_10rem]">
              <Casilla marcada={f.pestanas[p].activa} alCambiar={(activa) => cambiar({ pestanas: { ...f.pestanas, [p]: { ...f.pestanas[p], activa } } })} deshabilitada={!editable}>
                <span className="font-semibold">{t(`productos.vitrina.pestana.${p}`)}</span>
              </Casilla>
              {f.pestanas[p].activa && (
                <NumeroConUnidad etiqueta={t('productos.vitrina.posicion')} valor={f.pestanas[p].orden} alCambiar={(orden) => cambiar({ pestanas: { ...f.pestanas, [p]: { ...f.pestanas[p], orden } } })} error={err(`orden${p}`)} deshabilitado={!editable} />
              )}
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta id="precios" titulo={t('productos.vitrina.precios')} ayuda={t('productos.vitrina.precios_ayuda')}>
        <div className="grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
          <Selector etiqueta={t('productos.vitrina.grafico_productor')} value={f.graficoProductor} onChange={(e) => cambiar({ graficoProductor: e.target.value as FormVitrina['graficoProductor'] })}>
            {GRAFICOS.map((g) => <option key={g} value={g}>{t(`productos.vitrina.graficos.${g}`)}</option>)}
          </Selector>
          <Selector etiqueta={t('productos.vitrina.grafico_finca')} value={f.graficoFinca} onChange={(e) => cambiar({ graficoFinca: e.target.value as FormVitrina['graficoFinca'] })}>
            {GRAFICOS.map((g) => <option key={g} value={g}>{t(`productos.vitrina.graficos.${g}`)}</option>)}
          </Selector>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-3 [&>*]:min-w-0">
          {PRECIOS.map((k) => (
            <NumeroConUnidad key={k} etiqueta={t(`productos.vitrina.precio.${k}`)} valor={f.precios[k]} alCambiar={(v) => cambiar({ precios: { ...f.precios, [k]: v } })} error={err(k)} deshabilitado={!editable} />
          ))}
        </div>
        <div className="mt-5 grid gap-5">
          <ConVisibilidad campo="settings.incomeIncreaseDescription" texto={t('productos.vitrina.transparencia')} v={visibilidad}>
            <Area etiqueta={t('productos.vitrina.transparencia')} ayuda={t('productos.vitrina.transparencia_ayuda')} rows={4} value={f.transparencia} onChange={(e) => cambiar({ transparencia: e.target.value })} />
          </ConVisibilidad>
          <Casilla marcada={f.graficoCalidad} alCambiar={(graficoCalidad) => cambiar({ graficoCalidad })} deshabilitada={!editable}>
            {t('productos.vitrina.grafico_calidad')}
          </Casilla>
        </div>
      </Tarjeta>

      <Tarjeta id="recorrido" titulo={t('productos.vitrina.recorrido')} ayuda={t('productos.vitrina.recorrido_ayuda')}>
        {editable && <p className="mb-3 text-sm text-tinta-3">{t('productos.vitrina.recorrido_instrucciones')}</p>}
        <Suspense fallback={<div className="h-80 rounded-caja bg-superficie-2" />}>
          <SelectorPuntos
            linea
            etiqueta={t('productos.vitrina.recorrido_mapa')}
            puntos={f.recorrido.map((p) => [p.lng, p.lat] as [number, number])}
            alAgregar={([lng, lat]) => editable && cambiar({ recorrido: [...f.recorrido, puntoRecorrido(lng, lat)] })}
            alMover={(i, [lng, lat]) => editable && cambiar({ recorrido: f.recorrido.map((p, j) => (j === i ? { ...p, lng, lat } : p)) })}
          />
        </Suspense>
        {f.recorrido.length > 0 && (
          <ol className="mt-4 grid gap-2">
            {f.recorrido.map((p, i) => (
              <li key={p.clave} aria-label={t('productos.vitrina.parada', { n: i + 1 })} className="flex flex-wrap items-center gap-3 rounded-lg border border-linea px-3 py-2 text-sm">
                <span className="grid size-7 place-items-center rounded-full bg-marca text-xs font-bold text-sobre-marca">{i + 1}</span>
                <span className="font-mono text-tinta-2">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                {editable && (
                  <span className="ml-auto flex gap-1">
                    <button type="button" disabled={i === 0} onClick={() => cambiar({ recorrido: moverPunto(f.recorrido, i, -1) })} className="rounded-md p-2 text-tinta-3 hover:bg-superficie-2 hover:text-tinta disabled:opacity-30" aria-label={t('productos.vitrina.subir_parada', { n: i + 1 })}>
                      <Icono nombre="flecha" className="size-4 -rotate-90" />
                    </button>
                    <button type="button" disabled={i === f.recorrido.length - 1} onClick={() => cambiar({ recorrido: moverPunto(f.recorrido, i, 1) })} className="rounded-md p-2 text-tinta-3 hover:bg-superficie-2 hover:text-tinta disabled:opacity-30" aria-label={t('productos.vitrina.bajar_parada', { n: i + 1 })}>
                      <Icono nombre="flecha" className="size-4 rotate-90" />
                    </button>
                    <button type="button" onClick={() => cambiar({ recorrido: f.recorrido.filter((x) => x.clave !== p.clave) })} className="rounded-md p-2 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('productos.vitrina.quitar_parada', { n: i + 1 })}>
                      <Icono nombre="borrar" className="size-4" />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </Tarjeta>
    </fieldset>
  );
}
