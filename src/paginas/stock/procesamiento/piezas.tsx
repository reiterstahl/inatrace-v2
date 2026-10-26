import { useEffect, useId, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { procesamiento, type FiltroDisponible } from '@/api/procesamiento';
import { subirDocumento } from '@/api/productores';
import { urlDocumento } from '@/api/respuesta';
import type { ApiFacility, ApiMeasureUnitType, ApiProcessingAction, ApiProcessingEvidenceField, ApiStockOrder, ApiTransaction } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Icono } from '@/componentes/ui/Icono';
import { fechaCorta } from '@/util/fecha';
import { cantidad, fechaEntrega, nombreInstalacion } from '@/util/formato';
import { nombreCompleto } from '@/util/productor';
import { maximoSaco, repartirEnSacos, type DocumentoEvidencia, type ErroresProcesamiento, type Salida, type Seleccion } from '@/util/procesamiento';
import { aDecimal } from '../entregas/esquema';
import { CONTROL } from '../entregas/campos';

// ---------- Piezas pequeñas ----------

export function Etiqueta({ htmlFor, children, requerido }: { htmlFor?: string; children: ReactNode; requerido?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-tinta-2">
      {children}
      {requerido && <span className="text-mal" aria-hidden="true"> *</span>}
    </label>
  );
}

export function MensajeError({ id, children }: { id?: string; children?: ReactNode }) {
  return children ? <p id={id} role="alert" className="text-sm text-mal">{children}</p> : null;
}

/** Número decimal con unidad a la derecha; acepta coma. Muestra el texto tal cual se escribe. */
export function NumeroConUnidad({ valor, alCambiar, unidad, etiqueta, requerido, error, deshabilitado, ayuda }: { valor: number | null; alCambiar: (v: number | null) => void; unidad?: string; etiqueta: string; requerido?: boolean; error?: string; deshabilitado?: boolean; ayuda?: ReactNode }) {
  const id = useId();
  const [texto, setTexto] = useState(valor === null || Number.isNaN(valor) ? '' : String(valor).replace('.', ','));
  // Si el valor cambia desde afuera (p. ej. la cantidad del QR sigue a la entrada), se refleja.
  useEffect(() => {
    const actual = aDecimal(texto);
    if (actual !== valor && !(actual !== null && valor !== null && Math.abs(actual - valor) < 1e-9)) setTexto(valor === null || Number.isNaN(valor) ? '' : String(valor).replace('.', ','));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return (
    <div className="grid content-start gap-1.5">
      <Etiqueta htmlFor={id} requerido={requerido}>{etiqueta}</Etiqueta>
      <span className={clsx('flex h-11 overflow-hidden rounded-lg border bg-superficie transition-colors focus-within:border-marca focus-within:ring-3 focus-within:ring-marca/15', error ? 'border-mal' : 'border-linea-fuerte', deshabilitado && 'bg-superficie-2')}>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          disabled={deshabilitado}
          aria-invalid={!!error}
          aria-describedby={error ? id + '-e' : undefined}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            alCambiar(aDecimal(e.target.value));
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-right text-tinta tabular-nums outline-none disabled:text-tinta-2"
        />
        {unidad && <span className="grid shrink-0 place-items-center border-l border-linea bg-superficie-2 px-3 text-sm whitespace-nowrap text-tinta-2" aria-hidden="true">{unidad}</span>}
      </span>
      <MensajeError id={id + '-e'}>{error}</MensajeError>
      {!error && ayuda && <p className="text-sm text-tinta-3">{ayuda}</p>}
    </div>
  );
}

// ---------- Entrada ----------

export function Entrada({
  accion,
  instalaciones,
  instalacion,
  alCambiarInstalacion,
  existentes,
  alQuitarExistente,
  selecciones,
  alCambiarSelecciones,
  excluir,
  editando,
  unidad,
}: {
  accion: ApiProcessingAction;
  instalaciones: ApiFacility[];
  instalacion: ApiFacility | null;
  alCambiarInstalacion: (f: ApiFacility | null) => void;
  existentes: ApiTransaction[];
  alQuitarExistente: (i: number) => void;
  selecciones: Seleccion[];
  alCambiarSelecciones: (s: Seleccion[]) => void;
  /** Lotes que no se ofrecen (las salidas de esta misma orden, al editar). */
  excluir: number[];
  editando: boolean;
  unidad?: string;
}) {
  const { t, i18n } = useTranslation();
  const idInst = useId();
  const [filtro, setFiltro] = useState<FiltroDisponible>({});
  const disponibles = useQuery({ ...procesamiento.disponible(instalacion?.id ?? 0, accion, filtro), enabled: !!instalacion });
  const lista = (disponibles.data ?? []).filter((o) => !excluir.includes(o.id!));
  const traslado = accion.type === 'TRANSFER';
  const elegida = (o: ApiStockOrder) => selecciones.find((s) => s.orden.id === o.id);

  function alternar(o: ApiStockOrder) {
    alCambiarSelecciones(elegida(o) ? selecciones.filter((s) => s.orden.id !== o.id) : [...selecciones, { orden: o, cantidad: o.availableQuantity ?? 0 }]);
  }
  const todas = lista.length > 0 && lista.every((o) => elegida(o));
  function alternarTodas() {
    alCambiarSelecciones(todas ? selecciones.filter((s) => !lista.some((o) => o.id === s.orden.id)) : [...selecciones, ...lista.filter((o) => !elegida(o)).map((o) => ({ orden: o, cantidad: o.availableQuantity ?? 0 }))]);
  }

  const organico = selecciones.length > 0 && selecciones.every((s) => s.orden.organic);
  const mujeres = selecciones.length > 0 && selecciones.every((s) => s.orden.womenShare);

  return (
    <div className="grid gap-5">
      <div className="grid gap-1.5 sm:max-w-sm">
        <Etiqueta htmlFor={idInst} requerido>{t('stock.proc.instalacion_entrada')}</Etiqueta>
        <select
          id={idInst}
          value={instalacion?.id ?? ''}
          disabled={editando}
          onChange={(e) => alCambiarInstalacion(instalaciones.find((f) => f.id === Number(e.target.value)) ?? null)}
          className={CONTROL + ' h-11'}
        >
          <option value="">{t('stock.elegir')}</option>
          {instalaciones.map((f) => <option key={f.id} value={f.id}>{nombreInstalacion(f)}</option>)}
        </select>
      </div>

      {existentes.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-tinta-2">{t('stock.proc.ya_incluidos')}</p>
          <ul className="grid gap-2">
            {existentes.map((tx, i) => (
              <li key={tx.id ?? i} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-linea bg-superficie-2 px-3 py-2 text-sm">
                <span className="font-semibold">{tx.sourceStockOrder?.identifier || tx.sourceStockOrder?.internalLotNumber || `#${tx.sourceStockOrder?.id}`}</span>
                <span className="text-tinta-2 tabular-nums">{cantidad(tx.outputQuantity ?? tx.inputQuantity, tx.inputMeasureUnitType?.label ?? unidad, i18n.language)}</span>
                {tx.status === 'CANCELED' && <span className="rounded-full bg-mal-suave px-2 text-xs font-semibold text-mal">{t('stock.traza.tx.CANCELED')}</span>}
                {!traslado && (
                  <button type="button" onClick={() => alQuitarExistente(i)} className="ml-auto rounded-md p-1 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('stock.proc.quitar_entrada')}>
                    <Icono nombre="cerrar" className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {instalacion && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-tinta-2">{t('stock.proc.desde')}</span>
              <input type="date" value={filtro.desde ?? ''} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value || undefined })} className={CONTROL + ' h-10 w-40'} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-tinta-2">{t('stock.proc.hasta')}</span>
              <input type="date" value={filtro.hasta ?? ''} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value || undefined })} className={CONTROL + ' h-10 w-40'} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-tinta-2">{t('stock.proc.buscar_lote')}</span>
              <input type="search" value={filtro.lote ?? ''} onChange={(e) => setFiltro({ ...filtro, lote: e.target.value || undefined })} className={CONTROL + ' h-10 w-44'} />
            </label>
            <TresEstados etiqueta={t('stock.entrega.organico')} valor={filtro.organico} alCambiar={(v) => setFiltro({ ...filtro, organico: v })} />
            <TresEstados etiqueta={t('stock.entregas.cafe_mujeres')} valor={filtro.mujeres} alCambiar={(v) => setFiltro({ ...filtro, mujeres: v })} />
          </div>

          {disponibles.isPending ? (
            <p className="text-sm text-tinta-3">{t('comun.cargando')}</p>
          ) : lista.length === 0 ? (
            <p className="rounded-lg border border-dashed border-linea-fuerte p-6 text-center text-sm text-tinta-2">{t('stock.proc.sin_disponible')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-linea">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="bg-superficie-2 text-tinta-2">
                  <tr>
                    <th scope="col" className="w-10 px-3 py-2">
                      <input type="checkbox" className="size-4 accent-[var(--marca)]" checked={todas} onChange={alternarTodas} aria-label={t('stock.proc.elegir_todos')} />
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">{t('stock.todo.col_fecha')}</th>
                    <th scope="col" className="px-3 py-2 font-semibold">{t('stock.todo.col_lote')}</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">{t('stock.todo.col_disponible')}</th>
                    <th scope="col" className="w-40 px-3 py-2 text-right font-semibold">{t('stock.proc.a_usar')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {lista.map((o) => {
                    const sel = elegida(o);
                    const nombre = o.identifier || o.internalLotNumber || `#${o.id}`;
                    return (
                      <tr key={o.id} className={sel ? 'bg-marca-suave/40' : ''}>
                        <td className="px-3 py-2">
                          <input type="checkbox" className="size-4 accent-[var(--marca)]" checked={!!sel} onChange={() => alternar(o)} aria-label={t('stock.proc.elegir_lote', { lote: nombre })} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{fechaCorta(fechaEntrega(o), i18n.language) || '—'}</td>
                        <td className="px-3 py-2">
                          <span className="font-medium">{nombre}</span>
                          <span className="block text-xs text-tinta-3">
                            {[o.producerUserCustomer ? nombreCompleto(o.producerUserCustomer) : null, o.organic ? t('stock.entrega.organico') : null, o.womenShare ? t('stock.entregas.mujeres_si') : null].filter(Boolean).join(' · ')}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{cantidad(o.availableQuantity, o.measureUnitType?.label, i18n.language)}</td>
                        <td className="px-3 py-2 text-right">
                          {sel && !traslado ? (
                            <input
                              inputMode="decimal"
                              aria-label={t('stock.proc.cantidad_de', { lote: nombre })}
                              defaultValue={String(sel.cantidad).replace('.', ',')}
                              onChange={(e) => {
                                const v = aDecimal(e.target.value);
                                alCambiarSelecciones(selecciones.map((s) => (s.orden.id === o.id ? { ...s, cantidad: v ?? 0 } : s)));
                              }}
                              className={CONTROL + ' h-9 w-28 text-right tabular-nums'}
                            />
                          ) : sel ? (
                            <span className="tabular-nums">{cantidad(sel.cantidad, o.measureUnitType?.label, i18n.language)}</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {traslado && <p className="text-sm text-tinta-3">{t('stock.proc.traslado_completo')}</p>}
          {(organico || mujeres) && (
            <p className="flex flex-wrap gap-2 text-sm">
              {organico && <span className="rounded-full bg-ok-suave px-2.5 py-0.5 font-semibold text-ok">{t('stock.proc.todo_organico')}</span>}
              {mujeres && <span className="rounded-full bg-ok-suave px-2.5 py-0.5 font-semibold text-ok">{t('stock.proc.todo_mujeres')}</span>}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TresEstados({ etiqueta, valor, alCambiar }: { etiqueta: string; valor?: boolean; alCambiar: (v: boolean | undefined) => void }) {
  const { t } = useTranslation();
  const opciones: [boolean | undefined, string][] = [[undefined, t('stock.entregas.mujeres_todas')], [true, t('comun.si')], [false, t('comun.no')]];
  return (
    <div className="grid gap-1 text-sm">
      <span className="font-semibold text-tinta-2">{etiqueta}</span>
      <div className="inline-flex h-10 rounded-lg bg-superficie-2 p-1" role="group" aria-label={etiqueta}>
        {opciones.map(([v, texto]) => (
          <button key={String(v)} type="button" aria-pressed={valor === v} onClick={() => alCambiar(v)} className="rounded-md px-2.5 text-sm font-semibold text-tinta-2 aria-pressed:bg-superficie aria-pressed:text-tinta aria-pressed:shadow-suave">
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Salidas ----------

export function SalidaTarjeta({
  empresa,
  accion,
  salida,
  indice,
  total,
  alCambiar,
  alAutocompletar,
  alQuitar,
  errores,
  unidad,
  cantidadFija,
}: {
  empresa: number;
  accion: ApiProcessingAction;
  salida: Salida;
  indice: number;
  total: number;
  alCambiar: (s: Salida) => void;
  /** Cambios que hace la pantalla sola (p. ej. elegir la única instalación posible): no cuentan como edición. */
  alAutocompletar?: (s: Salida) => void;
  alQuitar?: () => void;
  errores?: ErroresProcesamiento['salidas'][string];
  unidad?: ApiMeasureUnitType | null;
  /** Generar QR: la cantidad sigue a la entrada. Traslado: cada lote se traslada entero. */
  cantidadFija?: 'entrada' | 'traslado';
}) {
  const { t, i18n } = useTranslation();
  const idSemi = useId();
  const idInst = useId();
  const idLote = useId();
  const tipo = accion.type;
  const semis = accion.outputSemiProducts ?? [];
  const semi = semis.find((s) => s.id === salida.semiproducto) ?? null;
  const instalaciones = useQuery(procesamiento.instalacionesPara(empresa, { semi: salida.semiproducto, final: salida.productoFinal }));
  const opciones = instalaciones.data ?? [];
  const maximo = maximoSaco(accion, semi);
  const err = (k: 'semiproducto' | 'instalacion' | 'cantidad' | 'lote' | 'sacos') => (errores?.[k] ? t(`stock.proc.errores.${errores[k]}`) : undefined);

  // Con una sola instalación posible para el producto, se elige sola.
  useEffect(() => {
    if (!salida.instalacion && opciones.length === 1) (alAutocompletar ?? alCambiar)({ ...salida, instalacion: opciones[0]! });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opciones.length, salida.semiproducto, salida.productoFinal]);

  function cambiarCantidad(c: number | null) {
    // Al cambiar la cantidad de un lote que se reempaca, los sacos se reparten de nuevo (salvo los ya guardados).
    const sacos = maximo && !salida.origenReempaque ? repartirEnSacos(c ?? 0, maximo) : salida.sacos;
    alCambiar({ ...salida, cantidad: c, sacos: maximo ? (sacos ?? []) : null });
  }

  return (
    <div role="group" aria-label={t('stock.proc.salida_n', { n: indice + 1 })} className="grid gap-5 rounded-lg border border-linea p-4">
      {total > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-tinta-2">{t('stock.proc.salida_n', { n: indice + 1 })}</span>
          {alQuitar && (
            <button type="button" onClick={alQuitar} className="rounded-md p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('stock.proc.quitar_salida', { n: indice + 1 })}>
              <Icono nombre="borrar" className="size-4" />
            </button>
          )}
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {salida.productoFinal ? (
          <div className="grid content-start gap-1.5">
            <span className="text-sm font-semibold text-tinta-2">{t('stock.proc.producto_final')}</span>
            <span className="flex h-11 items-center rounded-lg bg-superficie-2 px-3.5 font-medium">{accion.outputFinalProduct?.name}{accion.outputFinalProduct?.product?.name ? ` (${accion.outputFinalProduct.product.name})` : ''}</span>
          </div>
        ) : cantidadFija !== 'traslado' ? (
          <div className="grid content-start gap-1.5">
            <Etiqueta htmlFor={idSemi} requerido>{t('stock.semiproducto')}</Etiqueta>
            <select
              id={idSemi}
              value={salida.semiproducto ?? ''}
              aria-invalid={!!err('semiproducto')}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                const nuevo = semis.find((s) => s.id === id) ?? null;
                alCambiar({ ...salida, semiproducto: id, instalacion: null, cantidad: cantidadFija ? salida.cantidad : null, sacos: maximoSaco(accion, nuevo) ? [] : null });
              }}
              className={CONTROL + ' h-11'}
            >
              <option value="">{t('stock.elegir')}</option>
              {semis.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <MensajeError>{err('semiproducto')}</MensajeError>
          </div>
        ) : null}

        <div className="grid content-start gap-1.5">
          <Etiqueta htmlFor={idInst} requerido>{t('stock.proc.instalacion_salida')}</Etiqueta>
          <select
            id={idInst}
            value={salida.instalacion?.id ?? ''}
            disabled={!salida.semiproducto && !salida.productoFinal}
            aria-invalid={!!err('instalacion')}
            onChange={(e) => alCambiar({ ...salida, instalacion: opciones.find((f) => f.id === Number(e.target.value)) ?? null })}
            className={CONTROL + ' h-11'}
          >
            <option value="">{salida.semiproducto || salida.productoFinal ? t('stock.elegir') : t('stock.proc.primero_producto')}</option>
            {opciones.map((f) => <option key={f.id} value={f.id}>{nombreInstalacion(f)}</option>)}
            {salida.instalacion && !opciones.some((f) => f.id === salida.instalacion!.id) && <option value={salida.instalacion.id}>{nombreInstalacion(salida.instalacion)}</option>}
          </select>
          <MensajeError>{err('instalacion')}</MensajeError>
        </div>

        {cantidadFija !== 'traslado' && (
          <NumeroConUnidad
            etiqueta={t('stock.proc.cantidad_salida')}
            requerido={tipo === 'PROCESSING' || tipo === 'FINAL_PROCESSING'}
            valor={salida.cantidad}
            alCambiar={cambiarCantidad}
            unidad={unidad?.label}
            deshabilitado={cantidadFija === 'entrada' || (!salida.semiproducto && !salida.productoFinal)}
            error={err('cantidad')}
            ayuda={cantidadFija === 'entrada' ? t('stock.proc.cantidad_qr') : undefined}
          />
        )}

        <div className="grid content-start gap-1.5">
          <Etiqueta htmlFor={idLote} requerido>{cantidadFija === 'traslado' ? t('stock.proc.lote_base') : t('stock.proc.lote')}</Etiqueta>
          <span className={clsx('flex h-11 overflow-hidden rounded-lg border bg-superficie focus-within:border-marca focus-within:ring-3 focus-within:ring-marca/15', err('lote') ? 'border-mal' : 'border-linea-fuerte')}>
            {accion.prefix && <span className="grid shrink-0 place-items-center border-r border-linea bg-superficie-2 px-3 text-sm font-semibold text-tinta-2" title={t('stock.proc.prefijo')}>{accion.prefix}</span>}
            <input id={idLote} value={salida.lote} aria-invalid={!!err('lote')} onChange={(e) => alCambiar({ ...salida, lote: e.target.value })} className="h-full min-w-0 flex-1 bg-transparent px-3.5 outline-none" />
          </span>
          <MensajeError>{err('lote')}</MensajeError>
          {cantidadFija === 'traslado' && !err('lote') && <p className="text-sm text-tinta-3">{t('stock.proc.lote_traslado_ayuda', { lote: salida.lote || '…' })}</p>}
        </div>
      </div>

      {salida.sacos && maximo && (
        <Sacos salida={salida} maximo={maximo} unidad={unidad?.label} alCambiar={alCambiar} error={err('sacos')} idioma={i18n.language} />
      )}

      {(accion.requiredEvidenceFields ?? []).length > 0 && (
        <CamposEvidencia campos={accion.requiredEvidenceFields!} valores={salida.campos} errores={errores?.campos} alCambiar={(campos) => alCambiar({ ...salida, campos })} />
      )}
    </div>
  );
}

function Sacos({ salida, maximo, unidad, alCambiar, error, idioma }: { salida: Salida; maximo: number; unidad?: string; alCambiar: (s: Salida) => void; error?: string; idioma: string }) {
  const { t } = useTranslation();
  const sacos = salida.sacos ?? [];
  const suma = sacos.reduce((a, s) => a + (s.cantidad ?? 0), 0);
  const cambiar = (i: number, c: Partial<(typeof sacos)[number]>) => alCambiar({ ...salida, sacos: sacos.map((s, j) => (j === i ? { ...s, ...c } : s)) });
  return (
    <fieldset className="grid gap-3 rounded-lg bg-superficie-2 p-3">
      <legend className="sr-only">{t('stock.proc.sacos')}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{t('stock.proc.sacos_titulo', { maximo: cantidad(maximo, unidad, idioma) })}</span>
        <span className="text-sm text-tinta-2 tabular-nums">{t('stock.proc.sacos_suma', { suma: cantidad(suma, unidad, idioma), total: cantidad(salida.cantidad ?? 0, unidad, idioma) })}</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sacos.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <input inputMode="numeric" aria-label={t('stock.proc.saco_numero', { n: i + 1 })} value={s.numero ?? ''} onChange={(e) => cambiar(i, { numero: e.target.value ? Number(e.target.value) : null })} className={CONTROL + ' h-9 w-16 text-center tabular-nums'} />
            <input inputMode="decimal" aria-label={t('stock.proc.saco_cantidad', { n: i + 1 })} value={s.cantidad === null ? '' : String(s.cantidad).replace('.', ',')} onChange={(e) => cambiar(i, { cantidad: aDecimal(e.target.value) })} className={CONTROL + ' h-9 min-w-0 flex-1 text-right tabular-nums'} />
            <button type="button" onClick={() => alCambiar({ ...salida, sacos: sacos.filter((_, j) => j !== i) })} className="rounded-md p-1 text-tinta-3 hover:text-mal" aria-label={t('stock.proc.quitar_saco', { n: i + 1 })}>
              <Icono nombre="cerrar" className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Boton chico variante="secundario" onClick={() => alCambiar({ ...salida, sacos: [...sacos, { numero: Math.max(0, ...sacos.map((x) => x.numero ?? 0)) + 1, cantidad: null }] })}>
          <Icono nombre="mas" className="size-4" /> {t('stock.proc.agregar_saco')}
        </Boton>
        {!salida.origenReempaque && (
          <Boton chico variante="fantasma" onClick={() => alCambiar({ ...salida, sacos: repartirEnSacos(salida.cantidad ?? 0, maximo) })}>
            {t('stock.proc.repartir')}
          </Boton>
        )}
      </div>
      <MensajeError>{error}</MensajeError>
    </fieldset>
  );
}

function CamposEvidencia({ campos, valores, errores, alCambiar }: { campos: ApiProcessingEvidenceField[]; valores: Salida['campos']; errores?: Record<string, string>; alCambiar: (v: Salida['campos']) => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {campos.map((c) => {
        const nombre = c.fieldName ?? '';
        const v = valores[nombre];
        const error = errores?.[nombre] ? t(`stock.proc.errores.${errores[nombre]}`) : undefined;
        const fijar = (x: string | number | null) => alCambiar({ ...valores, [nombre]: x });
        if (c.type === 'NUMBER' || c.type === 'INTEGER' || c.type === 'PRICE' || c.type === 'EXCHANGE_RATE') {
          return <NumeroConUnidad key={nombre} etiqueta={c.label || nombre} requerido={c.mandatory} valor={typeof v === 'number' ? v : v ? aDecimal(v) : null} alCambiar={fijar} error={error} />;
        }
        return <CampoTexto key={nombre} etiqueta={c.label || nombre} requerido={c.mandatory} tipo={c.type === 'DATE' || c.type === 'TIMESTAMP' ? 'date' : c.type === 'TEXT' ? 'area' : 'text'} valor={v == null ? '' : String(v)} alCambiar={(x) => fijar(x || null)} error={error} />;
      })}
    </div>
  );
}

function CampoTexto({ etiqueta, requerido, tipo, valor, alCambiar, error }: { etiqueta: string; requerido?: boolean; tipo: 'text' | 'date' | 'area'; valor: string; alCambiar: (v: string) => void; error?: string }) {
  const id = useId();
  return (
    <div className={clsx('grid content-start gap-1.5', tipo === 'area' && 'sm:col-span-2')}>
      <Etiqueta htmlFor={id} requerido={requerido}>{etiqueta}</Etiqueta>
      {tipo === 'area' ? (
        <textarea id={id} rows={2} value={valor} aria-invalid={!!error} onChange={(e) => alCambiar(e.target.value)} className={CONTROL + ' py-2.5'} />
      ) : (
        <input id={id} type={tipo} value={valor} aria-invalid={!!error} onChange={(e) => alCambiar(e.target.value)} className={CONTROL + ' h-11'} />
      )}
      <MensajeError>{error}</MensajeError>
    </div>
  );
}

// ---------- Documentos ----------

export function Documentos({
  requeridos,
  otros,
  tipos,
  errores,
  alCambiarRequeridos,
  alCambiarOtros,
}: {
  requeridos: DocumentoEvidencia[];
  otros: DocumentoEvidencia[];
  tipos: { id?: number; code: string; label: string }[];
  errores: Record<number, string>;
  alCambiarRequeridos: (d: DocumentoEvidencia[]) => void;
  alCambiarOtros: (d: DocumentoEvidencia[]) => void;
}) {
  const { t } = useTranslation();
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid gap-5">
      {requeridos.length > 0 && (
        <ul className="grid gap-3">
          {requeridos.map((d, i) => (
            <FilaDocumento
              key={d.tipoId}
              d={d}
              error={errores[d.tipoId] ? t(`stock.proc.errores.${errores[d.tipoId]}`) : undefined}
              alCambiar={(x) => alCambiarRequeridos(requeridos.map((y, j) => (j === i ? x : y)))}
            />
          ))}
        </ul>
      )}
      {otros.length > 0 && (
        <ul className="grid gap-3">
          {otros.map((d, i) => (
            <FilaDocumento
              key={i}
              d={d}
              tipos={tipos}
              alCambiar={(x) => alCambiarOtros(otros.map((y, j) => (j === i ? x : y)))}
              alQuitar={() => alCambiarOtros(otros.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      )}
      {tipos.length > 0 && (
        <Boton chico variante="secundario" className="justify-self-start" onClick={() => alCambiarOtros([...otros, { tipoId: tipos[0]!.id!, tipoCodigo: tipos[0]!.code, tipoEtiqueta: tipos[0]!.label, fecha: hoy, documento: null }])}>
          <Icono nombre="mas" className="size-4" /> {t('stock.proc.agregar_documento')}
        </Boton>
      )}
    </div>
  );
}

function FilaDocumento({ d, tipos, error, alCambiar, alQuitar }: { d: DocumentoEvidencia; tipos?: { id?: number; code: string; label: string }[]; error?: string; alCambiar: (d: DocumentoEvidencia) => void; alQuitar?: () => void }) {
  const { t } = useTranslation();
  const idTipo = useId();
  const idFecha = useId();
  const [subiendo, setSubiendo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    setSubiendo(true);
    setFallo(null);
    try {
      alCambiar({ ...d, documento: await subirDocumento(archivo) });
    } catch (e) {
      setFallo((e as Error).message);
    } finally {
      setSubiendo(false);
    }
  }
  return (
    <li className="grid items-end gap-3 rounded-lg border border-linea p-3 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1.2fr)_auto]">
      {tipos ? (
        <div className="grid gap-1.5">
          <Etiqueta htmlFor={idTipo}>{t('stock.proc.tipo_documento')}</Etiqueta>
          <select id={idTipo} value={d.tipoId} onChange={(e) => { const x = tipos.find((y) => y.id === Number(e.target.value)); if (x) alCambiar({ ...d, tipoId: x.id!, tipoCodigo: x.code, tipoEtiqueta: x.label }); }} className={CONTROL + ' h-10'}>
            {tipos.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
      ) : (
        <span className="self-center text-sm font-semibold">
          {d.tipoEtiqueta || d.tipoCodigo}
          {d.obligatorio && <span className="text-mal" aria-hidden="true"> *</span>}
        </span>
      )}
      <div className="grid gap-1.5">
        <Etiqueta htmlFor={idFecha}>{t('stock.proc.fecha_documento')}</Etiqueta>
        <input id={idFecha} type="date" value={d.fecha} onChange={(e) => alCambiar({ ...d, fecha: e.target.value })} className={CONTROL + ' h-10'} />
      </div>
      <div className="grid gap-1.5 text-sm">
        {d.documento ? (
          <span className="flex h-10 items-center gap-2">
            <a href={urlDocumento(d.documento.storageKey)} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium text-marca hover:underline">{d.documento.name}</a>
            <button type="button" onClick={() => alCambiar({ ...d, documento: null })} className="rounded p-1 text-tinta-3 hover:text-mal" aria-label={t('stock.proc.quitar_archivo')}>
              <Icono nombre="cerrar" className="size-4" />
            </button>
          </span>
        ) : (
          <label className={clsx('inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 font-semibold', error ? 'border-mal text-mal' : 'border-linea-fuerte text-tinta-2 hover:border-marca hover:text-marca')}>
            <Icono nombre="subir" className="size-4" /> {subiendo ? t('comun.cargando') : t('stock.proc.subir_archivo')}
            <input type="file" className="sr-only" onChange={(e) => void subir(e.target.files?.[0])} />
          </label>
        )}
        <MensajeError>{error ?? fallo ?? undefined}</MensajeError>
      </div>
      {alQuitar ? (
        <button type="button" onClick={alQuitar} className="self-center rounded-md p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('stock.proc.quitar_documento')}>
          <Icono nombre="borrar" className="size-4" />
        </button>
      ) : (
        <span />
      )}
    </li>
  );
}
