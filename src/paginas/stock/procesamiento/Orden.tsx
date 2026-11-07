import { useEffect, useMemo, useState } from 'react';
import { Link, getRouteApi, useBlocker, useNavigate } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas } from '@/api/consultas';
import { procesamiento, useBorrarProcesamiento, useGuardarProcesamiento } from '@/api/procesamiento';
import { ordenes } from '@/api/ordenes';
import type { ApiFacility, ApiMeasureUnitType, ApiProcessingAction, ApiProcessingOrder } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { cantidad } from '@/util/formato';
import {
  armarOrden,
  formularioDesdeOrden,
  formularioNuevo,
  rangoEsperado,
  salidaNueva,
  sinErrores,
  totalEntrada,
  totalSalida,
  unidadesDeAccion,
  validar,
  variasSalidas,
  type ErroresProcesamiento,
  type FormProcesamiento,
  type Salida,
} from '@/util/procesamiento';
import { Bloque } from '../entregas/campos';
import { Documentos, Entrada, SalidaTarjeta } from './piezas';
import { confirmar, confirmarSalida } from '@/componentes/ui/Confirmar';

const rutaNueva = getRouteApi('/portal/stock/procesamiento/nueva');
const rutaEditar = getRouteApi('/portal/stock/procesamiento/$lote');

export function ProcesamientoNuevo() {
  const { accion, inst, destino } = rutaNueva.useSearch();
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  const a = useQuery({ ...procesamiento.accion(accion ?? 0), enabled: !!accion });
  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  if (!accion) return <EstadoError texto={t('stock.proc.falta_accion')} />;
  if (a.isPending) return <Cargando />;
  if (a.isError) return <EstadoError texto={a.error.message} reintentar={() => void a.refetch()} />;
  return <Formulario empresa={empresa.id} accion={a.data} instalacionInicial={inst} destinoInicial={destino} />;
}

export function ProcesamientoExistente() {
  const { lote } = rutaEditar.useParams();
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  const orden = useQuery(procesamiento.deLote(Number(lote)));
  const a = useQuery({ ...procesamiento.accion(orden.data?.processingAction?.id ?? 0), enabled: !!orden.data?.processingAction?.id });
  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  if (orden.isPending || (orden.data && a.isPending)) return <Cargando />;
  if (orden.isError) return <EstadoError texto={orden.error.message} reintentar={() => void orden.refetch()} />;
  if (a.isError) return <EstadoError texto={a.error.message} reintentar={() => void a.refetch()} />;
  return <Formulario key={orden.data.id} empresa={empresa.id} accion={a.data!} original={orden.data} />;
}

function Formulario({ empresa, accion, original, instalacionInicial, destinoInicial }: { empresa: number; accion: ApiProcessingAction; original?: ApiProcessingOrder; instalacionInicial?: number; destinoInicial?: number }) {
  const { t, i18n } = useTranslation();
  const navegar = useNavigate();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const guardar = useGuardarProcesamiento();
  const borrar = useBorrarProcesamiento();
  const editando = !!original;
  const traslado = accion.type === 'TRANSFER';
  const qr = accion.type === 'GENERATE_QR_CODE';
  const esPedido = accion.type === 'SHIPMENT';

  const inicial = useMemo(() => (original ? formularioDesdeOrden(original, accion) : formularioNuevo(accion, null)), [original, accion]);
  const [f, setF] = useState<FormProcesamiento>(inicial);
  const [tocado, setTocado] = useState(false);
  const [errores, setErrores] = useState<ErroresProcesamiento | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const cambiar = (c: Partial<FormProcesamiento>) => {
    setF((x) => ({ ...x, ...c }));
    setTocado(true);
  };

  // Unidades: lo que entra y lo que sale de cada salida.
  const { entrada, salidaFinal, salidasSemi } = unidadesDeAccion(accion);
  const unidadEntrada = entrada?.measurementUnitType ?? null;
  const unidadDe = (s: Salida): ApiMeasureUnitType | null | undefined =>
    traslado ? unidadEntrada : s.productoFinal ? salidaFinal?.measurementUnitType : salidasSemi.find((x) => x.id === s.semiproducto)?.measurementUnitType;

  // Instalaciones de entrada: las de la empresa que manejan lo que entra, y las admitidas por la acción si las define.
  // En un pedido, las de otras empresas de la cadena a las que se les puede pedir (y la acción limita el destino).
  const producto = { semi: accion.inputSemiProduct?.id, final: accion.inputFinalProduct?.id };
  const posibles = useQuery({ ...procesamiento.instalacionesPara(empresa, producto), enabled: !esPedido });
  const vendedoras = useQuery({ ...ordenes.vendedoras(empresa, producto), enabled: esPedido });
  const soportadas = (accion.supportedFacilities ?? []).map((x) => x.id!).filter(Boolean);
  const instalaciones = esPedido ? (vendedoras.data ?? []) : (posibles.data ?? []).filter((x) => soportadas.length === 0 || soportadas.includes(x.id!));
  // En un pedido ya creado, quien completa la orden es el proveedor (la instalación de entrada es suya);
  // el comprador ve lo que le mandaron pero no elige stock ajeno.
  const pedido: 'comprador' | 'proveedor' | undefined = !esPedido ? undefined : editando && f.instalacionEntrada?.company?.id === empresa ? 'proveedor' : 'comprador';
  useEffect(() => {
    if (f.instalacionEntrada || editando || instalaciones.length === 0) return;
    const elegida = instalaciones.find((x) => x.id === instalacionInicial) ?? (instalaciones.length === 1 ? instalaciones[0] : undefined);
    if (elegida) setF((x) => ({ ...x, instalacionEntrada: elegida }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instalaciones.length]);

  const tipos = useQuery(procesamiento.tiposEvidencia((accion.valueChains ?? []).map((v) => v.id!).filter(Boolean)));

  const entra = totalEntrada(f);
  const sale = totalSalida(f.salidas, unidadDe, unidadEntrada);
  const restante = Math.max(0, sale - entra);
  const rango = rangoEsperado(accion, entra);
  const fueraDeRango = !!rango && sale > 0 && (sale < rango.desde || sale > rango.hasta);

  // Generar QR: lo que sale es exactamente lo que entra.
  useEffect(() => {
    if (!qr) return;
    setF((x) => ({ ...x, salidas: x.salidas.map((s) => ({ ...s, cantidad: entra || null })) }));
  }, [qr, entra]);

  useBlocker({ shouldBlockFn: async () => tocado && !guardar.isPending && !(await confirmarSalida(t('stock.entrega.salir_sin_guardar'))), enableBeforeUnload: () => tocado });

  const titulo = editando ? t('stock.proc.titulo_editar', { accion: accion.name }) : accion.name ?? '';
  useEffect(() => {
    document.title = `${titulo} · INATrace v2`;
  }, [titulo]);

  async function alGuardar() {
    setAviso(null);
    const e = validar(f, { unidadDe, unidadEntrada });
    setErrores(e);
    if (!sinErrores(e)) {
      setAviso(t('stock.entrega.revisar'));
      return;
    }
    try {
      await guardar.mutateAsync(armarOrden(f, { empresa, usuario: yo.id!, original, unidadDe }));
      setTocado(false);
      if (esPedido) await navegar({ to: '/stock/ordenes', search: { vista: pedido === 'proveedor' ? 'recibidas' : undefined } });
      else await navegar({ to: '/stock/todo', search: { inst: f.salidas[0]?.instalacion?.id } });
    } catch (err) {
      setAviso((err as Error).message);
    }
  }

  async function alBorrar() {
    if (!original?.id || !(await confirmar(t('stock.proc.borrar_confirmar'), { accion: 'eliminar' }))) return;
    try {
      await borrar.mutateAsync(original.id);
      setTocado(false);
      await navegar(esPedido ? { to: '/stock/ordenes' } : { to: '/stock/procesamiento' });
    } catch (err) {
      setAviso((err as Error).message);
    }
  }

  const unidadEntradaTxt = unidadEntrada?.label;
  const excluir = f.salidas.flatMap((s) => [s.original?.id, ...(s.sacos ?? []).map((x) => x.id)]).filter((x): x is number => typeof x === 'number');

  return (
    <div className="grid gap-6 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {esPedido ? (
            <Link to="/stock/ordenes" search={{ vista: pedido === 'proveedor' ? 'recibidas' : undefined }} className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
              <Icono nombre="volver" className="size-4" /> {t('stock.pestanas.ordenes')}
            </Link>
          ) : (
            <Link to="/stock/procesamiento" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
              <Icono nombre="volver" className="size-4" /> {t('stock.pestanas.procesamiento')}
            </Link>
          )}
          <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{titulo}</h1>
          <p className="mt-1 text-tinta-2">
            {t(`stock.proc.tipo.${accion.type}`)}
            {entrada?.name ? ` · ${entrada.name}` : ''}
            {salidaFinal?.name ? ` → ${salidaFinal.name}` : salidasSemi.length ? ` → ${salidasSemi.map((s) => s.name).join(', ')}` : ''}
          </p>
        </div>
        {editando && pedido !== 'proveedor' && (
          <Boton variante="peligro" chico onClick={alBorrar} disabled={borrar.isPending}>
            <Icono nombre="borrar" className="size-4" /> {t('stock.proc.borrar')}
          </Boton>
        )}
      </header>

      {aviso && <Aviso tono="mal">{aviso}</Aviso>}
      {errores && errores.generales.length > 0 && (
        <Aviso tono="mal">
          <ul className="list-disc pl-5">
            {errores.generales.map((g) => <li key={g}>{t(`stock.proc.errores.${g}`)}</li>)}
          </ul>
        </Aviso>
      )}
      {editando && traslado && <Aviso tono="info">{t('stock.proc.traslado_solo_lectura')}</Aviso>}
      {pedido === 'proveedor' && (
        <Aviso tono="info" titulo={t('stock.ord.completar_titulo', { empresa: f.salidas[0]?.instalacion?.company?.name ?? '' })}>{t('stock.ord.completar_texto')}</Aviso>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <fieldset disabled={editando && traslado} className="grid min-w-0 gap-6">
          <Bloque titulo={t('stock.proc.entrada')}>
            <Entrada
              accion={accion}
              instalaciones={instalaciones}
              instalacion={f.instalacionEntrada}
              alCambiarInstalacion={(x: ApiFacility | null) => cambiar({ instalacionEntrada: x, selecciones: [] })}
              existentes={f.existentes}
              alQuitarExistente={(i) => cambiar({ existentes: f.existentes.filter((_, j) => j !== i) })}
              selecciones={f.selecciones}
              alCambiarSelecciones={(s) => cambiar({ selecciones: s })}
              excluir={excluir}
              editando={editando}
              unidad={unidadEntradaTxt}
              pedido={pedido}
              restante={restante}
            />
          </Bloque>

          <Bloque titulo={esPedido ? t('stock.ord.el_pedido') : variasSalidas(accion.type) ? t('stock.proc.salidas') : t('stock.proc.salida')}>
            {/* El proveedor ve lo pedido pero no lo cambia. */}
            <fieldset disabled={pedido === 'proveedor'} className="grid min-w-0 gap-4">
              {f.salidas.map((s, i) => (
                <SalidaTarjeta
                  key={s.clave}
                  empresa={empresa}
                  accion={accion}
                  salida={s}
                  indice={i}
                  total={f.salidas.length}
                  alCambiar={(x) => cambiar({ salidas: f.salidas.map((y) => (y.clave === s.clave ? x : y)) })}
                  alAutocompletar={(x) => setF((v) => ({ ...v, salidas: v.salidas.map((y) => (y.clave === s.clave ? x : y)) }))}
                  alQuitar={f.salidas.length > 1 ? () => cambiar({ salidas: f.salidas.filter((y) => y.clave !== s.clave) }) : undefined}
                  errores={errores?.salidas[s.clave]}
                  unidad={unidadDe(s)}
                  cantidadFija={qr ? 'entrada' : traslado ? 'traslado' : undefined}
                  soportadas={esPedido ? soportadas : undefined}
                  preferida={destinoInicial}
                />
              ))}
              {variasSalidas(accion.type) && (
                <Boton variante="secundario" className="justify-self-start" onClick={() => cambiar({ salidas: [...f.salidas, salidaNueva(accion)] })}>
                  <Icono nombre="mas" className="size-4" /> {t('stock.proc.agregar_salida')}
                </Boton>
              )}
            </fieldset>
          </Bloque>

          <Bloque titulo={t('stock.proc.datos')}>
            <div className="grid gap-5">
              <label className="grid gap-1.5 sm:max-w-xs">
                <span className="text-sm font-semibold text-tinta-2">{t('stock.proc.fecha')}<span className="text-mal" aria-hidden="true"> *</span></span>
                <input type="date" value={f.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} className="h-11 rounded-lg border border-linea-fuerte bg-superficie px-3.5" />
              </label>
              <Documentos
                requeridos={f.requeridos}
                otros={f.otros}
                tipos={tipos.data ?? []}
                errores={errores?.requeridos ?? {}}
                alCambiarRequeridos={(d) => cambiar({ requeridos: d })}
                alCambiarOtros={(d) => cambiar({ otros: d })}
              />
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-tinta-2">{t('stock.entrega.comentarios')}</span>
                <textarea rows={3} value={f.comentarios} onChange={(e) => cambiar({ comentarios: e.target.value })} className="rounded-lg border border-linea-fuerte bg-superficie px-3.5 py-2.5" />
              </label>
            </div>
          </Bloque>
        </fieldset>

        <aside className="grid gap-4 rounded-caja border border-linea bg-superficie p-5 shadow-suave lg:sticky lg:top-24" aria-live="polite">
          <h2 className="font-titulo text-lg font-semibold">{t('stock.entrega.resumen')}</h2>
          <dl className="grid gap-3 text-sm">
            {esPedido ? (
              <>
                <Fila etiqueta={t('stock.ord.resumen_pedido')} valor={cantidad(sale, unidadEntradaTxt, i18n.language)} />
                <Fila etiqueta={t('stock.ord.resumen_enviado')} valor={cantidad(entra, unidadEntradaTxt, i18n.language)} />
                <Fila etiqueta={t('stock.ord.resumen_falta')} valor={cantidad(restante, unidadEntradaTxt, i18n.language)} />
              </>
            ) : (
              <>
                <Fila etiqueta={t('stock.proc.total_entrada')} valor={cantidad(entra, unidadEntradaTxt, i18n.language)} />
                {!traslado && <Fila etiqueta={t('stock.proc.total_salida')} valor={cantidad(sale, unidadEntradaTxt, i18n.language)} />}
                {!traslado && !qr && <Fila etiqueta={t('stock.proc.restante')} valor={cantidad(Math.max(0, entra - sale), unidadEntradaTxt, i18n.language)} />}
              </>
            )}
          </dl>
          {rango && (
            <p className={'rounded-lg p-3 text-sm ' + (fueraDeRango ? 'bg-aviso-suave text-aviso' : 'bg-superficie-2 text-tinta-2')}>
              {t('stock.proc.rango', { desde: cantidad(rango.desde, unidadEntradaTxt, i18n.language), hasta: cantidad(rango.hasta, unidadEntradaTxt, i18n.language) })}
              {fueraDeRango && <span className="mt-1 block font-semibold">{t('stock.proc.fuera_de_rango')}</span>}
            </p>
          )}
        </aside>
      </div>

      {!(editando && traslado) && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-linea bg-superficie/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-6">
            {tocado && <span className="mr-auto text-sm text-tinta-3">{t('stock.entrega.sin_guardar')}</span>}
            <Boton onClick={() => void alGuardar()} disabled={guardar.isPending || (editando && !tocado)}>
              <Icono nombre="ok" className="size-4" /> {guardar.isPending ? t('comun.cargando') : t('comun.guardar')}
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-tinta-2">{etiqueta}</dt>
      <dd className="text-right font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}
