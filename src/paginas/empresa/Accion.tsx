import { useEffect, useState } from 'react';
import { Link, getRouteApi, useBlocker, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { acciones as consultas, useGuardarAccion } from '@/api/acciones';
import { instalaciones } from '@/api/instalaciones';
import { stock } from '@/api/stock';
import type { ApiProcessingAction, ApiProcessingEvidenceType } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Area, Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import {
  IDIOMAS_ACCION, TIPOS_ACCION, armarAccion, conDosTipos, formDesdeAccion, nombreAccion, siguienteGrupo, sinErroresAccion, validarAccion,
  type ErroresAccion, type FormAccion, type TipoAccion,
} from '@/util/accion';
import { nombreInstalacion } from '@/util/instalacion';
import { NumeroConUnidad } from '../stock/procesamiento/piezas';
import { Casilla, Tarjeta } from '../productos/piezas';
import { useEmpresaVista } from './Marco';
import { Fichas, SiNo } from './piezas';

const ruta = getRouteApi('/portal/empresa/acciones/$accion');

export function AccionNueva() {
  const { t } = useTranslation();
  const { id } = useEmpresaVista();
  const cadenas = useQuery(instalaciones.cadenasEmpresa(id));
  if (cadenas.isPending) return <Cargando />;
  if (cadenas.isError) return <EstadoError texto={cadenas.error.message} reintentar={() => void cadenas.refetch()} />;
  return <Formulario original={null} inicial={formDesdeAccion(null, cadenas.data)} titulo={t('empresa.acciones.nueva')} />;
}

export function AccionExistente() {
  const id = Number(ruta.useParams().accion);
  const consulta = useQuery(consultas.detalle(id));
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} />;
  return <Formulario key={id} original={consulta.data} inicial={formDesdeAccion(consulta.data)} titulo={nombreAccion(consulta.data)} />;
}

function Formulario({ original, inicial, titulo }: { original: ApiProcessingAction | null; inicial: FormAccion; titulo: string }) {
  const { t, i18n } = useTranslation();
  const navegar = useNavigate();
  const { id: empresa, editable } = useEmpresaVista();
  const guardar = useGuardarAccion();
  const [f, setF] = useState(inicial);
  const idsCadenas = f.cadenas.map((c) => c.id!);
  const cadenasEmpresa = useQuery(instalaciones.cadenasEmpresa(empresa));
  const semis = useQuery(instalaciones.semiproductos(idsCadenas));
  const finales = useQuery(instalaciones.finalesEmpresa(empresa));
  const lugares = useQuery(stock.instalaciones(empresa));
  const campos = useQuery(consultas.camposEvidencia(idsCadenas));
  const documentos = useQuery(consultas.documentosEvidencia(idsCadenas));
  const [tocado, setTocado] = useState(false);
  const [errores, setErrores] = useState<ErroresAccion>({});
  const [intentado, setIntentado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const cambiar = (c: Partial<FormAccion>) => {
    setF((x) => ({ ...x, ...c }));
    setTocado(true);
  };
  // Después de un intento de guardar, los errores se recalculan a medida que se corrigen.
  useEffect(() => {
    if (intentado) setErrores(validarAccion(f));
  }, [f, intentado]);
  const msg = (k?: string) => (k ? t(`empresa.errores.${k}`, { defaultValue: t(`productos.errores.${k}`, { defaultValue: t(`stock.errores.${k}`) }) }) : undefined);
  const nombreFinal = (x: { name?: string; product?: { name?: string } }) => [x.name, x.product?.name].filter(Boolean).join(' · ');
  const unidadEntrada = semis.data?.find((s) => s.id === f.entradaSemi)?.measurementUnitType?.label;

  useBlocker({ shouldBlockFn: () => tocado && !guardar.isPending && !window.confirm(t('stock.entrega.salir_sin_guardar')), enableBeforeUnload: () => tocado });

  async function alGuardar() {
    setAviso(null);
    const e = validarAccion(f);
    setErrores(e);
    setIntentado(true);
    if (!sinErroresAccion(e)) {
      setAviso(t('stock.entrega.revisar'));
      return;
    }
    try {
      const a = armarAccion(original, f, { empresa, idioma: i18n.language, semis: semis.data ?? [], finales: finales.data ?? [] });
      await guardar.mutateAsync(a);
      setTocado(false);
      const nombre = a.translations?.find((x) => x.language === i18n.language.slice(0, 2).toUpperCase())?.name ?? a.translations?.[0]?.name ?? '';
      await navegar({ to: '/empresa/acciones', search: { guardada: nombre } });
    } catch (x) {
      setAviso((x as Error).message);
    }
  }

  function quitarCadena(id: number) {
    const nombre = f.cadenas.find((c) => c.id === id)?.name ?? '';
    if (!window.confirm(t('empresa.acciones.quitar_cadena_pregunta', { cadena: nombre }))) return;
    // Como la versión actual: se vacía lo que depende de las cadenas.
    cambiar({ cadenas: f.cadenas.filter((c) => c.id !== id), entradaSemi: null, salidas: [], campos: [], documentos: [] });
  }

  function cambiarDocumento(doc: ApiProcessingEvidenceType, c: Partial<ApiProcessingEvidenceType>) {
    cambiar({ documentos: f.documentos.map((d) => (d.id === doc.id ? { ...d, ...c } : d)) });
  }

  if (!editable) return <Aviso tono="info" titulo={t('empresa.solo_lectura_titulo')}>{t('empresa.acciones.ayuda_lectura')}</Aviso>;

  const tipo = f.tipo;
  const pideEntradaSemi = tipo === 'PROCESSING' || tipo === 'FINAL_PROCESSING' || tipo === 'GENERATE_QR_CODE' || (conDosTipos(tipo) && f.deFinales === false);
  const opcionesSemis = semis.data ?? [];
  const opcionesFinales = finales.data ?? [];

  return (
    <div className="grid gap-5">
      <header>
        <Link to="/empresa/acciones" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
          <Icono nombre="volver" className="size-4" /> {t('empresa.acciones.titulo')}
        </Link>
        <h2 className="mt-2 font-titulo text-2xl font-semibold break-words">{titulo}</h2>
      </header>
      {aviso && <Aviso tono="mal">{aviso}</Aviso>}

      <Tarjeta id="que-hace" titulo={t('empresa.acciones.secciones.que_hace')}>
        <div className="grid gap-5">
          <Selector etiqueta={t('empresa.acciones.tipo')} value={tipo} error={msg(errores.tipo)} ayuda={tipo ? t(`empresa.acciones.tipos_ayuda.${tipo}`) : undefined} className="sm:max-w-sm" onChange={(e) => cambiar({ tipo: e.target.value as TipoAccion | '', deFinales: conDosTipos(e.target.value as TipoAccion) ? f.deFinales : null })}>
            <option value="">{t('stock.elegir')}</option>
            {TIPOS_ACCION.map((x) => <option key={x} value={x}>{t(`empresa.acciones.tipos.${x}`)}</option>)}
          </Selector>
          <Fichas
            etiqueta={t('empresa.cadenas')}
            requerido
            error={msg(errores.cadenas)}
            elegidos={f.cadenas.map((c) => ({ id: c.id!, nombre: c.name ?? `#${c.id}` }))}
            opciones={(cadenasEmpresa.data ?? []).map((c) => ({ id: c.id!, nombre: c.name ?? `#${c.id}` }))}
            alAgregar={(id) => cambiar({ cadenas: [...f.cadenas, (cadenasEmpresa.data ?? []).find((c) => c.id === id)!] })}
            alQuitar={quitarCadena}
          />
          {conDosTipos(tipo) && (
            <SiNo etiqueta={t('empresa.acciones.de_finales')} ayuda={t('empresa.acciones.de_finales_ayuda')} valor={f.deFinales} alCambiar={(deFinales) => cambiar({ deFinales })} error={msg(errores.deFinales)} />
          )}
          {pideEntradaSemi && (
            <Selector etiqueta={t('empresa.acciones.entrada_semi')} value={f.entradaSemi ?? ''} error={msg(errores.entradaSemi)} ayuda={f.cadenas.length ? undefined : t('empresa.instalaciones.elegir_cadena')} className="sm:max-w-sm" onChange={(e) => cambiar({ entradaSemi: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t('stock.elegir')}</option>
              {opcionesSemis.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Selector>
          )}
          {conDosTipos(tipo) && f.deFinales && (
            <Selector etiqueta={t('empresa.acciones.entrada_final')} value={f.entradaFinal ?? ''} error={msg(errores.entradaFinal)} className="sm:max-w-sm" onChange={(e) => cambiar({ entradaFinal: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t('stock.elegir')}</option>
              {opcionesFinales.map((x) => <option key={x.id} value={x.id}>{nombreFinal(x)}</option>)}
            </Selector>
          )}
          {tipo === 'GENERATE_QR_CODE' && (
            <Selector etiqueta={t('empresa.acciones.qr_final')} value={f.qrFinal ?? ''} error={msg(errores.qrFinal)} className="sm:max-w-sm" onChange={(e) => cambiar({ qrFinal: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t('stock.elegir')}</option>
              {opcionesFinales.map((x) => <option key={x.id} value={x.id}>{nombreFinal(x)}</option>)}
            </Selector>
          )}

          {tipo === 'PROCESSING' && (
            <div className="grid gap-3">
              <Fichas
                etiqueta={t('empresa.acciones.salidas')}
                requerido
                error={msg(errores.salidas)}
                vacio={f.cadenas.length ? undefined : t('empresa.instalaciones.elegir_cadena')}
                elegidos={[]}
                opciones={opcionesSemis.filter((s) => !f.salidas.some((x) => x.semi.id === s.id)).map((s) => ({ id: s.id!, nombre: s.name ?? `#${s.id}` }))}
                alAgregar={(id) => cambiar({ salidas: [...f.salidas, { semi: opcionesSemis.find((s) => s.id === id)!, reempaque: false, maximo: null }] })}
                alQuitar={() => undefined}
                soloAgregar
              />
              {f.salidas.length > 0 && (
                <ul className="grid gap-2" aria-label={t('empresa.acciones.salidas')}>
                  {f.salidas.map((s) => (
                    <li key={s.semi.id} aria-label={s.semi.name} className="grid gap-3 rounded-lg border border-linea p-3 sm:grid-cols-[1fr_auto_12rem_auto] sm:items-center [&>*]:min-w-0">
                      <span className="font-semibold">{s.semi.name}</span>
                      <Casilla marcada={s.reempaque} alCambiar={(reempaque) => cambiar({ salidas: f.salidas.map((x) => (x.semi.id === s.semi.id ? { ...x, reempaque, maximo: reempaque ? x.maximo : null } : x)) })}>
                        {t('empresa.acciones.reempaque')}
                      </Casilla>
                      {s.reempaque ? (
                        <NumeroConUnidad etiqueta={t('empresa.acciones.maximo')} requerido unidad={s.semi.measurementUnitType?.label} valor={s.maximo} alCambiar={(maximo) => cambiar({ salidas: f.salidas.map((x) => (x.semi.id === s.semi.id ? { ...x, maximo } : x)) })} error={msg(errores.maximos?.[s.semi.id!])} />
                      ) : <span />}
                      <button type="button" onClick={() => cambiar({ salidas: f.salidas.filter((x) => x.semi.id !== s.semi.id) })} className="justify-self-start rounded-md p-2 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('empresa.quitar', { que: s.semi.name })}>
                        <Icono nombre="borrar" className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="sm:max-w-xs">
                <NumeroConUnidad etiqueta={t('empresa.acciones.rendimiento')} ayuda={t('empresa.acciones.rendimiento_ayuda')} unidad={unidadEntrada} valor={f.rendimiento} alCambiar={(rendimiento) => cambiar({ rendimiento })} error={msg(errores.rendimiento)} />
              </div>
            </div>
          )}

          {tipo === 'FINAL_PROCESSING' && (
            <div className="grid gap-4">
              <Selector etiqueta={t('empresa.acciones.salida_final')} value={f.salidaFinal ?? ''} error={msg(errores.salidaFinal)} className="sm:max-w-sm" onChange={(e) => cambiar({ salidaFinal: e.target.value ? Number(e.target.value) : null })}>
                <option value="">{t('stock.elegir')}</option>
                {opcionesFinales.map((x) => <option key={x.id} value={x.id}>{nombreFinal(x)}</option>)}
              </Selector>
              <Casilla marcada={f.reempaqueFinal} alCambiar={(reempaqueFinal) => cambiar({ reempaqueFinal, maximoFinal: reempaqueFinal ? f.maximoFinal : null })}>
                {t('empresa.acciones.reempaque')}
              </Casilla>
              {f.reempaqueFinal && (
                <div className="sm:max-w-xs">
                  <NumeroConUnidad etiqueta={t('empresa.acciones.maximo')} requerido unidad={opcionesFinales.find((x) => x.id === f.salidaFinal)?.measurementUnitType?.label} valor={f.maximoFinal} alCambiar={(maximoFinal) => cambiar({ maximoFinal })} error={msg(errores.maximoFinal)} />
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <Campo etiqueta={<>{t('empresa.acciones.prefijo')} <span className="text-mal" aria-hidden>*</span></>} ayuda={t('empresa.acciones.prefijo_ayuda')} value={f.prefijo} onChange={(e) => cambiar({ prefijo: e.target.value })} error={msg(errores.prefijo)} />
            <Campo etiqueta={t('empresa.acciones.orden')} ayuda={t('empresa.acciones.orden_ayuda')} inputMode="numeric" value={f.orden} onChange={(e) => cambiar({ orden: e.target.value })} error={msg(errores.orden)} />
          </div>
        </div>
      </Tarjeta>

      <Tarjeta id="donde-empieza" titulo={t('empresa.acciones.secciones.donde')} ayuda={t('empresa.acciones.donde_ayuda')}>
        <Fichas
          etiqueta={t('empresa.instalaciones.titulo')}
          elegidos={f.instalaciones.map((x) => ({ id: x.id!, nombre: nombreInstalacion(x) }))}
          opciones={(lugares.data ?? []).map((x) => ({ id: x.id!, nombre: nombreInstalacion(x) }))}
          alAgregar={(id) => cambiar({ instalaciones: [...f.instalaciones, (lugares.data ?? []).find((x) => x.id === id)!] })}
          alQuitar={(id) => cambiar({ instalaciones: f.instalaciones.filter((x) => x.id !== id) })}
        />
      </Tarjeta>

      <Tarjeta id="nombre-accion" titulo={t('empresa.acciones.secciones.nombre')}>
        <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          {IDIOMAS_ACCION.map((x) => (
            <div key={x} role="group" aria-label={t(`productos.idiomas.${x}`)} className="grid content-start gap-3 rounded-lg border border-linea p-3">
              <Campo etiqueta={t('empresa.acciones.nombre_en', { idioma: t(`productos.idiomas.${x}`) })} value={f.textos[x].nombre} onChange={(e) => cambiar({ textos: { ...f.textos, [x]: { ...f.textos[x], nombre: e.target.value } } })} />
              <Area etiqueta={t('empresa.acciones.descripcion_en', { idioma: t(`productos.idiomas.${x}`) })} rows={2} value={f.textos[x].descripcion} onChange={(e) => cambiar({ textos: { ...f.textos, [x]: { ...f.textos[x], descripcion: e.target.value } } })} />
            </div>
          ))}
          <p className={'text-sm sm:col-span-2 ' + (errores.nombre ? 'text-mal' : 'text-tinta-3')} role={errores.nombre ? 'alert' : undefined}>
            {errores.nombre ? t('empresa.instalaciones.sin_nombre') : t('empresa.acciones.nombre_ayuda')}
          </p>
          <Campo etiqueta={t('empresa.acciones.etiqueta_publica')} ayuda={t('empresa.acciones.etiqueta_publica_ayuda')} value={f.etiquetaPublica} onChange={(e) => cambiar({ etiquetaPublica: e.target.value })} className="sm:col-span-2" />
        </div>
      </Tarjeta>

      <Tarjeta id="evidencias" titulo={t('empresa.acciones.secciones.evidencias')} ayuda={t('empresa.acciones.evidencias_ayuda')}>
        <div className="grid gap-6">
          <div className="grid gap-3">
            <Fichas
              etiqueta={t('empresa.acciones.campos')}
              vacio={f.cadenas.length ? undefined : t('empresa.instalaciones.elegir_cadena')}
              elegidos={[]}
              opciones={(campos.data ?? []).filter((c) => !f.campos.some((x) => x.id === c.id)).map((c) => ({ id: c.id!, nombre: c.label || c.fieldName || `#${c.id}` }))}
              alAgregar={(id) => cambiar({ campos: [...f.campos, { ...(campos.data ?? []).find((c) => c.id === id)!, mandatory: false, requiredOnQuote: false }] })}
              alQuitar={() => undefined}
              soloAgregar
            />
            {f.campos.length > 0 && (
              <ul className="grid gap-2" aria-label={t('empresa.acciones.campos')}>
                {f.campos.map((c) => (
                  <li key={c.id} aria-label={c.label || c.fieldName} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-linea p-3">
                    <span className="font-semibold">{c.label || c.fieldName}</span>
                    <div className="flex flex-wrap items-center gap-4">
                      <Casilla marcada={!!c.mandatory} alCambiar={(mandatory) => cambiar({ campos: f.campos.map((x) => (x.id === c.id ? { ...x, mandatory } : x)) })}>{t('empresa.acciones.obligatorio')}</Casilla>
                      <Casilla marcada={!!c.requiredOnQuote} alCambiar={(requiredOnQuote) => cambiar({ campos: f.campos.map((x) => (x.id === c.id ? { ...x, requiredOnQuote } : x)) })}>{t('empresa.acciones.en_pedido')}</Casilla>
                      <button type="button" onClick={() => cambiar({ campos: f.campos.filter((x) => x.id !== c.id) })} className="rounded-md p-2 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('empresa.quitar', { que: c.label || c.fieldName })}>
                        <Icono nombre="borrar" className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3">
            <Fichas
              etiqueta={t('empresa.acciones.documentos')}
              vacio={f.cadenas.length ? undefined : t('empresa.instalaciones.elegir_cadena')}
              elegidos={[]}
              opciones={(documentos.data ?? []).filter((d) => !f.documentos.some((x) => x.id === d.id)).map((d) => ({ id: d.id!, nombre: d.label }))}
              alAgregar={(id) => cambiar({ documentos: [...f.documentos, { ...(documentos.data ?? []).find((d) => d.id === id)!, mandatory: false, requiredOnQuote: false, requiredOneOfGroupIdForQuote: undefined }] })}
              alQuitar={() => undefined}
              soloAgregar
            />
            {f.documentos.length > 0 && (
              <ul className="grid gap-2" aria-label={t('empresa.acciones.documentos')}>
                {f.documentos.map((d) => (
                  <li key={d.id} aria-label={d.label} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-linea p-3">
                    <span className="font-semibold">{d.label}</span>
                    <div className="flex flex-wrap items-center gap-4">
                      <Casilla marcada={!!d.mandatory} alCambiar={(mandatory) => cambiarDocumento(d, { mandatory })}>{t('empresa.acciones.obligatorio')}</Casilla>
                      {/* «En el pedido» y «uno de un grupo» se excluyen, como en la versión actual. */}
                      <Casilla marcada={!!d.requiredOnQuote} alCambiar={(requiredOnQuote) => cambiarDocumento(d, { requiredOnQuote, requiredOneOfGroupIdForQuote: requiredOnQuote ? undefined : d.requiredOneOfGroupIdForQuote })}>{t('empresa.acciones.en_pedido')}</Casilla>
                      <Casilla marcada={!!d.requiredOneOfGroupIdForQuote} alCambiar={(enGrupo) => cambiarDocumento(d, enGrupo ? { requiredOnQuote: false, requiredOneOfGroupIdForQuote: siguienteGrupo(f.documentos) } : { requiredOneOfGroupIdForQuote: undefined })}>{t('empresa.acciones.en_grupo')}</Casilla>
                      {d.requiredOneOfGroupIdForQuote && (
                        <input aria-label={t('empresa.acciones.grupo_de', { documento: d.label })} inputMode="numeric" value={d.requiredOneOfGroupIdForQuote} onChange={(e) => cambiarDocumento(d, { requiredOneOfGroupIdForQuote: e.target.value.replace(/\D/g, '') || undefined })} className="h-9 w-16 rounded-lg border border-linea-fuerte bg-superficie px-2 text-center" />
                      )}
                      <button type="button" onClick={() => cambiar({ documentos: f.documentos.filter((x) => x.id !== d.id) })} className="rounded-md p-2 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('empresa.quitar', { que: d.label })}>
                        <Icono nombre="borrar" className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Tarjeta>

      {(tocado || !original) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-superficie/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm text-tinta-2">{original ? t('productores.ficha.cambios') : t('empresa.acciones.nueva_ayuda')}</p>
            <Boton onClick={() => void alGuardar()} disabled={guardar.isPending}>
              <Icono nombre="ok" className="size-4" /> {guardar.isPending ? t('productores.ficha.guardando') : t('comun.guardar')}
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}
