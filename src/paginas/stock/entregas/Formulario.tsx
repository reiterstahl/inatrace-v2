import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
import { Link, getRouteApi, useBlocker, useNavigate } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas } from '@/api/consultas';
import { productores } from '@/api/productores';
import { stock, useBorrarEntrega, useGuardarEntrega } from '@/api/stock';
import type { ApiCompanyUser, ApiFacility, ApiStockOrder } from '@/api/gen/types.gen';
import { SelectorPersona } from '@/componentes/SelectorPersona';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { costo, pesoNeto, precioFinal } from '@/util/entrega';
import { fechaLarga } from '@/util/fecha';
import { cantidad, dinero, fechaEntrega, nombreInstalacion } from '@/util/formato';
import { nombreCompleto } from '@/util/productor';
import { MONEDAS, aApi, aFormulario, formasPagoPosibles, resolverEntrega, type FormEntrega } from './esquema';
import { Bloque, CONTROL, CampoE, SelectorE, SiNoE } from './campos';
import { EstadoPago } from './Lista';
import { pagos } from '@/api/pagos';
import { EstadoPagoChip } from '../pagos/Lista';
import { puedePagarse } from '@/util/pago';
import { fechaCorta } from '@/util/fecha';

const rutaNueva = getRouteApi('/portal/stock/entregas/nueva');
const rutaFicha = getRouteApi('/portal/stock/entregas/$id');

export function EntregaNueva() {
  const { inst, productor } = rutaNueva.useSearch();
  return <Cargador instalacion={inst} productor={productor} />;
}

export function EntregaExistente() {
  const { id } = rutaFicha.useParams();
  return <Cargador id={Number(id)} />;
}


function Cargador({ id, instalacion, productor }: { id?: number; instalacion?: number; productor?: number }) {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const entrega = useQuery({ ...stock.entrega(id ?? 0), enabled: !!id });
  const instalaciones = useQuery({ ...stock.instalacionesAcopio(empresa?.id ?? 0), enabled: !!empresa });
  const usuarios = useQuery({ ...stock.usuariosEmpresa(empresa?.id ?? 0), enabled: !!empresa });
  const perfilEmpresa = useQuery({ ...productores.perfilEmpresa(empresa?.id ?? 0), enabled: !!empresa });
  // Desde la ficha de un productor: la entrega nueva ya lo trae elegido.
  const elegido = useQuery({ ...productores.ficha(productor ?? 0), enabled: !!productor && !id });

  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  const lista = [instalaciones, usuarios, perfilEmpresa, ...(id ? [entrega] : []), ...(productor && !id ? [elegido] : [])];
  const conError = lista.find((c) => c.isError);
  if (conError) return <EstadoError texto={conError.error?.message} reintentar={() => lista.forEach((c) => void c.refetch())} />;
  if (lista.some((c) => c.isPending)) return <Cargando />;

  const original = id ? entrega.data! : null;
  // Una entrega vieja puede estar en una instalación que ya no figura como de acopio: se agrega.
  const opciones = [...instalaciones.data!];
  if (original?.facility?.id && !opciones.some((f) => f.id === original.facility!.id)) opciones.push(original.facility);
  const personas = usuarios.data ?? [];

  return (
    <Formulario
      key={original?.id ?? 'nueva'}
      empresa={empresa.id}
      original={original}
      instalaciones={opciones}
      usuarios={personas}
      defecto={{
        instalacion: instalacion ?? (opciones.length === 1 ? (opciones[0]?.id ?? null) : null),
        registradoPor: yo.id && personas.some((u) => u.id === yo.id) ? yo.id : null,
        moneda: perfilEmpresa.data?.currency?.code ?? '',
        productor: elegido.data ?? null,
      }}
    />
  );
}

function Formulario({
  empresa,
  original,
  instalaciones,
  usuarios,
  defecto,
}: {
  empresa: number;
  original: ApiStockOrder | null;
  instalaciones: ApiFacility[];
  usuarios: ApiCompanyUser[];
  defecto: Parameters<typeof aFormulario>[1];
}) {
  const { t, i18n } = useTranslation();
  const navegar = useNavigate();
  const guardar = useGuardarEntrega(empresa);
  const borrar = useBorrarEntrega(empresa);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'mal'; texto: string } | null>(null);

  // Las reglas dependen de la instalación elegida: el resolver la lee al validar.
  const instRef = useRef<ApiFacility | undefined>(undefined);
  const resolver = useMemo(() => resolverEntrega(() => instRef.current), []);
  const form = useForm<FormEntrega>({ resolver, defaultValues: aFormulario(original, defecto), mode: 'onTouched' });
  const { control, formState, handleSubmit, reset, resetField, setValue, getValues, getFieldState } = form;
  const v = useWatch({ control });

  const instalacion = useQuery({ ...stock.instalacion(v.instalacion ?? 0), enabled: !!v.instalacion });
  instRef.current = instalacion.data;
  const inst = instalacion.data;
  const semis = inst?.facilitySemiProductList ?? (original?.semiProduct ? [original.semiProduct] : []);

  // Al cambiar de instalación (solo al crear) se propone su primer semiproducto.
  useEffect(() => {
    if (!inst || original) return;
    const actual = getValues('semiproducto');
    if (semis.some((s) => s.id === actual)) return;
    const primero = semis[0]?.id ?? null;
    // Si la instalación vino dada (no la cambió la persona), es parte del punto de partida: no cuenta como cambio.
    if (getFieldState('instalacion').isDirty) setValue('semiproducto', primero, { shouldDirty: true });
    else resetField('semiproducto', { defaultValue: primero });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst?.id]);

  const semiElegido = semis.find((s) => s.id === v.semiproducto);
  const semiDetalle = useQuery({ ...stock.semiproducto(v.semiproducto ?? 0), enabled: !!v.semiproducto && !semiElegido?.measurementUnitType?.label });
  const unidad = semiElegido?.measurementUnitType?.label ?? semiDetalle.data?.measurementUnitType?.label ?? original?.measureUnitType?.label;

  const ficha = useQuery({ ...productores.ficha(v.productor?.id ?? 0), enabled: !!v.productor?.id });
  const parcelas = ficha.data?.plots ?? [];

  useBlocker({ shouldBlockFn: () => formState.isDirty && !guardar.isPending && !window.confirm(t('stock.entrega.salir_sin_guardar')), enableBeforeUnload: () => formState.isDirty });

  const datos = { bruto: num(v.bruto), tara: num(v.tara), descuentoPeso: num(v.descuentoPeso), precio: num(v.precio), descuentoPrecio: num(v.descuentoPrecio), precioDespues: !!v.precioDespues };
  const neto = pesoNeto(datos);
  const final = precioFinal(datos);
  const pago = costo(datos);
  const moneda = (v.moneda ?? '').trim().toUpperCase();

  const mostrar = {
    acopiador: !!inst?.displayMayInvolveCollectors || !!v.acopiador,
    tara: !!inst?.displayTare || num(v.tara) !== null,
    descuentoPeso: !!inst?.displayWeightDeductionDamage || num(v.descuentoPeso) !== null,
    descuentoPrecio: (!!inst?.displayPriceDeductionDamage || num(v.descuentoPrecio) !== null) && !v.precioDespues,
    precioDespues: !!inst?.displayPriceDeterminedLater || !!v.precioDespues,
    organico: !!inst?.displayOrganic || !!v.organico,
    mujeres: !!inst?.displayWomenOnly || !!v.mujeres,
  };

  async function alGuardar(f: FormEntrega, otra = false) {
    setAviso(null);
    try {
      const guardada = await guardar.mutateAsync(aApi(f, original));
      if (otra) {
        // Para cargar una tras otra: se conserva lo que suele repetirse en el día.
        reset({ ...aFormulario(null, defecto), instalacion: f.instalacion, fecha: f.fecha, semiproducto: f.semiproducto, registradoPor: f.registradoPor, moneda: f.moneda, formaPago: f.formaPago });
        setAviso({ tono: 'ok', texto: t('stock.entrega.guardada_otra', { productor: nombreCompleto(f.productor ?? {}) }) });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      reset(aFormulario(guardada, defecto));
      if (!original) {
        await navegar({ to: '/stock/entregas', search: { inst: f.instalacion ?? undefined } });
        return;
      }
      setAviso({ tono: 'ok', texto: t('stock.entrega.guardada') });
    } catch (e) {
      setAviso({ tono: 'mal', texto: (e as Error).message });
    }
  }

  async function eliminar() {
    if (!original?.id || !window.confirm(t('stock.entregas.borrar_confirmar', { productor: nombreCompleto(original.producerUserCustomer ?? {}), fecha: fechaLarga(fechaEntrega(original), i18n.language) }))) return;
    try {
      await borrar.mutateAsync(original.id);
      reset(getValues());
      await navegar({ to: '/stock/entregas', search: { inst: original.facility?.id } });
    } catch (e) {
      setAviso({ tono: 'mal', texto: (e as Error).message });
    }
  }

  const titulo = original ? t('stock.entrega.titulo_editar', { productor: nombreCompleto(original.producerUserCustomer ?? {}) }) : t('stock.entregas.nueva');
  useEffect(() => {
    document.title = `${titulo} · INATrace v2`;
  }, [titulo]);

  const alFallar = () => setAviso({ tono: 'mal', texto: t('stock.entrega.revisar') });

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit((f) => alGuardar(f), alFallar)} noValidate className="grid gap-6 pb-24">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to="/stock/entregas" search={{ inst: original?.facility?.id ?? v.instalacion ?? undefined }} className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
              <Icono nombre="volver" className="size-4" /> {t('stock.entregas.titulo')}
            </Link>
            <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{titulo}</h1>
            {original && (
              <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-tinta-2">
                <span>{original.identifier}</span>
                <EstadoPago e={original} />
              </p>
            )}
          </div>
          {original && (
            <Boton variante="peligro" chico onClick={eliminar} disabled={borrar.isPending}>
              <Icono nombre="borrar" className="size-4" /> {t('stock.entregas.borrar')}
            </Boton>
          )}
        </header>

        {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
        {original && (original.paid ?? 0) > 0 && <Aviso tono="info">{t('stock.entrega.con_pagos')}</Aviso>}
        {original && <PagosDeEntrega entrega={original} />}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-6">
            <Bloque titulo={t('stock.entrega.origen')}>
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectorE nombre="instalacion" etiqueta={t('stock.instalacion')} requerido comoNumero disabled={!!original}>
                  <option value="">{t('stock.elegir')}</option>
                  {instalaciones.map((f) => <option key={f.id} value={f.id}>{nombreInstalacion(f)}</option>)}
                </SelectorE>
                <CampoE nombre="fecha" etiqueta={t('stock.entrega.fecha')} requerido type="date" />
                <Controller
                  control={control}
                  name="productor"
                  render={({ field, fieldState }) => (
                    <SelectorPersona
                      empresa={empresa}
                      valor={field.value}
                      etiqueta={t('stock.entrega.productor')}
                      requerido
                      error={fieldState.error?.message ? t(`stock.errores.${fieldState.error.message}`) : undefined}
                      alElegir={(p) => {
                        field.onChange(p);
                        setValue('parcelas', [], { shouldDirty: true });
                      }}
                    />
                  )}
                />
                {mostrar.acopiador && (
                  <Controller
                    control={control}
                    name="acopiador"
                    render={({ field }) => (
                      <SelectorPersona
                        empresa={empresa}
                        tipo="COLLECTOR"
                        valor={field.value}
                        etiqueta={t('stock.entrega.acopiador')}
                        alElegir={(p) => {
                          field.onChange(p);
                          // "Efectivo a través del acopiador" solo tiene sentido con acopiador.
                          if (!p && getValues('formaPago') === 'CASH_VIA_COLLECTOR') setValue('formaPago', '', { shouldDirty: true });
                          if (p && getValues('formaPago') === 'UNKNOWN') setValue('formaPago', '', { shouldDirty: true });
                        }}
                      />
                    )}
                  />
                )}
                <SelectorE nombre="registradoPor" etiqueta={t('stock.entrega.registrado_por')} requerido comoNumero>
                  <option value="">{t('stock.elegir')}</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{[u.name, u.surname].filter(Boolean).join(' ') || u.email}</option>)}
                </SelectorE>
              </div>

              {v.productor?.id && (
                <Controller
                  control={control}
                  name="parcelas"
                  render={({ field }) => (
                    <fieldset className="mt-6 grid gap-2">
                      <legend className="mb-2 text-sm font-semibold text-tinta-2">{t('stock.entrega.parcelas')}</legend>
                      {ficha.isPending ? (
                        <p className="text-sm text-tinta-3">{t('comun.cargando')}</p>
                      ) : parcelas.length === 0 ? (
                        <p className="text-sm text-tinta-3">{t('stock.entrega.sin_parcelas')}</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {parcelas.map((p) => {
                            const elegida = field.value.includes(p.id!);
                            return (
                              <label key={p.id} className={'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ' + (elegida ? 'border-marca bg-marca-suave' : 'border-linea hover:bg-superficie-2')}>
                                <input
                                  type="checkbox"
                                  className="mt-0.5 size-4 shrink-0 accent-[var(--marca)]"
                                  checked={elegida}
                                  onChange={(e) => field.onChange(e.target.checked ? [...field.value, p.id!] : field.value.filter((x) => x !== p.id))}
                                />
                                <span className="min-w-0">
                                  <span className="block font-semibold">{p.plotName || `#${p.id}`}</span>
                                  <span className="block text-xs text-tinta-3">
                                    {[p.crop?.name, p.size ? `${p.size.toLocaleString(i18n.language)} ${p.unit ?? ''}`.trim() : null, p.geoId ? 'GeoID' : null].filter(Boolean).join(' · ')}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-xs text-tinta-3">{t('stock.entrega.parcelas_ayuda')}</p>
                    </fieldset>
                  )}
                />
              )}
            </Bloque>

            <Bloque titulo={t('stock.entrega.cantidad')}>
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectorE nombre="semiproducto" etiqueta={t('stock.semiproducto')} requerido comoNumero disabled={!v.instalacion}>
                  <option value="">{v.instalacion ? t('stock.elegir') : t('stock.entrega.primero_instalacion')}</option>
                  {semis.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </SelectorE>
                <CampoE nombre="bruto" etiqueta={t('stock.entrega.bruto')} requerido decimal unidad={unidad} />
                {mostrar.tara && <CampoE nombre="tara" etiqueta={t('stock.entrega.tara')} requerido={!!inst?.displayTare} decimal unidad={unidad} />}
                {mostrar.descuentoPeso && <CampoE nombre="descuentoPeso" etiqueta={t('stock.entrega.descuento_peso')} requerido={!!inst?.displayWeightDeductionDamage} decimal unidad={unidad} />}
              </div>
            </Bloque>

            <Bloque titulo={t('stock.entrega.precio_pago')}>
              <div className="grid gap-5 sm:grid-cols-2">
                {mostrar.precioDespues && (
                  <label className="flex cursor-pointer items-start gap-3 text-sm sm:col-span-2">
                    <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--marca)]" {...form.register('precioDespues')} />
                    <span>
                      <span className="block font-semibold">{t('stock.entrega.precio_despues')}</span>
                      <span className="block text-tinta-3">{t('stock.entrega.precio_despues_ayuda')}</span>
                    </span>
                  </label>
                )}
                {!v.precioDespues && <CampoE nombre="precio" etiqueta={t('stock.entrega.precio')} requerido decimal unidad={moneda && unidad ? `${moneda}/${unidad}` : moneda} />}
                {mostrar.descuentoPrecio && <CampoE nombre="descuentoPrecio" etiqueta={t('stock.entrega.descuento_precio')} requerido={!!inst?.displayPriceDeductionDamage} decimal unidad={moneda && unidad ? `${moneda}/${unidad}` : moneda} />}
                <CampoE nombre="moneda" etiqueta={t('stock.entrega.moneda')} requerido list="monedas-entrega" maxLength={3} className="[&_input]:uppercase" ayuda={defecto.moneda ? undefined : t('stock.entrega.moneda_ayuda')} />
                <datalist id="monedas-entrega">{MONEDAS.map((m) => <option key={m} value={m} />)}</datalist>
                <SelectorE nombre="formaPago" etiqueta={t('stock.entrega.forma_pago')} requerido>
                  <option value="">{t('stock.elegir')}</option>
                  {formasPagoPosibles(!!v.acopiador, original?.preferredWayOfPayment).map((f) => <option key={f} value={f}>{t(`stock.forma_pago.${f}`)}</option>)}
                </SelectorE>
              </div>
            </Bloque>

            {(mostrar.organico || mostrar.mujeres) && (
              <Bloque titulo={t('stock.entrega.caracteristicas')}>
                <div className="flex flex-wrap gap-8">
                  {mostrar.organico && <SiNoE nombre="organico" etiqueta={t('stock.entrega.organico')} requerido={!!inst?.displayOrganic} />}
                  {mostrar.mujeres && <SiNoE nombre="mujeres" etiqueta={t('stock.entregas.cafe_mujeres')} requerido={!!inst?.displayWomenOnly} />}
                </div>
              </Bloque>
            )}

            <Bloque titulo={t('stock.entrega.comentarios')}>
              <textarea aria-label={t('stock.entrega.comentarios')} rows={3} className={CONTROL + ' py-2.5'} {...form.register('comentarios')} />
            </Bloque>
          </div>

          <aside className="grid gap-4 rounded-caja border border-linea bg-superficie p-5 shadow-suave lg:sticky lg:top-24" aria-live="polite">
            <h2 className="font-titulo text-lg font-semibold">{t('stock.entrega.resumen')}</h2>
            <dl className="grid gap-3 text-sm">
              <Fila etiqueta={t('stock.entrega.neto')} valor={cantidad(neto, unidad, i18n.language)} />
              <Fila etiqueta={t('stock.entrega.precio_final')} valor={v.precioDespues ? t('stock.entregas.precio_despues') : dinero(final, moneda, i18n.language)} />
              <div className="border-t border-linea pt-3">
                <Fila etiqueta={t('stock.entrega.pago_base')} valor={v.precioDespues ? '—' : dinero(pago, moneda, i18n.language)} grande />
              </div>
            </dl>
            <p className="text-xs text-tinta-3">{t('stock.entrega.resumen_nota')}</p>
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-linea bg-superficie/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-6">
            {formState.isDirty && <span className="mr-auto text-sm text-tinta-3">{t('stock.entrega.sin_guardar')}</span>}
            {!original && (
              <Boton variante="secundario" disabled={guardar.isPending} onClick={() => void handleSubmit((f) => alGuardar(f, true), alFallar)()}>
                {t('stock.entrega.guardar_otra')}
              </Boton>
            )}
            <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-marca px-5 font-semibold text-sobre-marca hover:bg-marca-fuerte disabled:opacity-50" disabled={guardar.isPending || (!!original && !formState.isDirty)}>
              <Icono nombre="ok" className="size-4" /> {guardar.isPending ? t('comun.cargando') : t('comun.guardar')}
            </button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

function Fila({ etiqueta, valor, grande }: { etiqueta: string; valor: string; grande?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-tinta-2">{etiqueta}</dt>
      <dd className={'text-right tabular-nums ' + (grande ? 'text-xl font-semibold' : 'font-semibold')}>{valor}</dd>
    </div>
  );
}

/** Pagos de la entrega y acceso para registrar uno nuevo. */
function PagosDeEntrega({ entrega }: { entrega: ApiStockOrder }) {
  const { t, i18n } = useTranslation();
  const lista = useQuery(pagos.deEntrega(entrega.id!));
  const pagable = puedePagarse(entrega) && (entrega.balance ?? 0) > 0;
  if (!puedePagarse(entrega)) return null;
  return (
    <section aria-labelledby="t-pagos" className="rounded-caja border border-linea bg-superficie p-5 shadow-suave">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="t-pagos" className="font-titulo text-lg font-semibold">{t('stock.pagos.de_entrega')}</h2>
        {pagable && (
          <Link to="/stock/pagos/nuevo" search={{ entrega: entrega.id! }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-marca px-3 text-sm font-semibold text-sobre-marca hover:bg-marca-fuerte">
            <Icono nombre="precio" className="size-4" /> {t('stock.pagos.registrar')}
          </Link>
        )}
      </div>
      {lista.isPending ? (
        <p className="mt-3 text-sm text-tinta-3">{t('comun.cargando')}</p>
      ) : (lista.data ?? []).length === 0 ? (
        <p className="mt-3 text-sm text-tinta-2">{t('stock.pagos.ninguno_entrega')}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {lista.data!.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-superficie-2 px-3 py-2 text-sm">
              <Link to="/stock/pagos/$id" params={{ id: String(p.id) }} className="font-semibold hover:text-marca hover:underline">{fechaCorta(p.formalCreationTime, i18n.language)}</Link>
              <span className="text-tinta-2">{p.paymentPurposeType ? t(`stock.pagos.propositos.${p.paymentPurposeType}`) : ''}</span>
              <span className="ml-auto font-semibold tabular-nums">{dinero(p.amount, p.currency, i18n.language)}</span>
              <EstadoPagoChip estado={p.paymentStatus} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
