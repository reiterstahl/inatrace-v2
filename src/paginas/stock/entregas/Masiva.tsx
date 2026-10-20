import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, getRouteApi, useBlocker, useNavigate } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas } from '@/api/consultas';
import { productores } from '@/api/productores';
import { stock, useEntregaMasiva } from '@/api/stock';
import type { ApiCompanyUser, ApiFacility } from '@/api/gen/types.gen';
import { SelectorPersona } from '@/componentes/SelectorPersona';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { costo, pesoNeto } from '@/util/entrega';
import { cantidad, dinero, nombreInstalacion } from '@/util/formato';
import { MONEDAS, aApiMasiva, filaVacia, formasPagoPosibles, masivaVacia, resolverMasiva, type FormMasiva } from './esquema';
import { Bloque, CampoE, SelectorE, SiNoE } from './campos';

const ruta = getRouteApi('/portal/stock/entregas/masiva');

export function EntregaMasiva() {
  const { t } = useTranslation();
  const { inst } = ruta.useSearch();
  const empresa = useEmpresaActual();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const instalaciones = useQuery({ ...stock.instalacionesAcopio(empresa?.id ?? 0), enabled: !!empresa });
  const usuarios = useQuery({ ...stock.usuariosEmpresa(empresa?.id ?? 0), enabled: !!empresa });
  const perfilEmpresa = useQuery({ ...productores.perfilEmpresa(empresa?.id ?? 0), enabled: !!empresa });

  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  const lista = [instalaciones, usuarios, perfilEmpresa];
  const conError = lista.find((c) => c.isError);
  if (conError) return <EstadoError texto={conError.error?.message} reintentar={() => lista.forEach((c) => void c.refetch())} />;
  if (lista.some((c) => c.isPending)) return <Cargando />;
  const opciones = instalaciones.data!;
  const personas = usuarios.data ?? [];

  return (
    <Formulario
      empresa={empresa.id}
      instalaciones={opciones}
      usuarios={personas}
      defecto={{
        instalacion: inst ?? (opciones.length === 1 ? (opciones[0]?.id ?? null) : null),
        registradoPor: yo.id && personas.some((u) => u.id === yo.id) ? yo.id : null,
        moneda: perfilEmpresa.data?.currency?.code ?? '',
      }}
    />
  );
}

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

function Formulario({ empresa, instalaciones, usuarios, defecto }: { empresa: number; instalaciones: ApiFacility[]; usuarios: ApiCompanyUser[]; defecto: { instalacion: number | null; registradoPor: number | null; moneda: string } }) {
  const { t, i18n } = useTranslation();
  const navegar = useNavigate();
  const guardar = useEntregaMasiva(empresa);
  const [aviso, setAviso] = useState<string | null>(null);

  const instRef = useRef<ApiFacility | undefined>(undefined);
  const resolver = useMemo(() => resolverMasiva(() => instRef.current), []);
  const form = useForm<FormMasiva>({ resolver, defaultValues: masivaVacia(defecto), mode: 'onTouched' });
  const { control, formState, handleSubmit, reset, resetField, setValue, getValues, getFieldState } = form;
  const filas = useFieldArray({ control, name: 'filas' });
  const v = useWatch({ control });

  const instalacion = useQuery({ ...stock.instalacion(v.instalacion ?? 0), enabled: !!v.instalacion });
  instRef.current = instalacion.data;
  const inst = instalacion.data;
  const semis = inst?.facilitySemiProductList ?? [];

  // Semiproducto por defecto en cada fila: el primero de la instalación.
  useEffect(() => {
    if (!inst) return;
    const primero = semis[0]?.id ?? null;
    getValues('filas').forEach((f, i) => {
      if (semis.some((s) => s.id === f.semiproducto)) return;
      if (getFieldState('instalacion').isDirty) setValue(`filas.${i}.semiproducto`, primero, { shouldDirty: true });
      else resetField(`filas.${i}.semiproducto`, { defaultValue: primero });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst?.id]);

  const unidadDe = (semi: number | null | undefined) => semis.find((s) => s.id === semi)?.measurementUnitType?.label;
  const moneda = (v.moneda ?? '').trim().toUpperCase();
  const mostrar = {
    acopiador: !!inst?.displayMayInvolveCollectors,
    tara: !!inst?.displayTare,
    descuentoPeso: !!inst?.displayWeightDeductionDamage,
    descuentoPrecio: !!inst?.displayPriceDeductionDamage,
    organico: !!inst?.displayOrganic,
    mujeres: !!inst?.displayWomenOnly,
  };

  const calculo = (f: Partial<Record<'bruto' | 'tara' | 'descuentoPeso' | 'precio' | 'descuentoPrecio', unknown>> | undefined) => {
    const d = { bruto: num(f?.bruto), tara: num(f?.tara), descuentoPeso: num(f?.descuentoPeso), precio: num(f?.precio), descuentoPrecio: num(f?.descuentoPrecio) };
    return { neto: pesoNeto(d), pago: costo(d) };
  };
  const totales = (v.filas ?? []).reduce((a, f) => {
    const c = calculo(f);
    return { neto: a.neto + (c.neto ?? 0), pago: a.pago + (c.pago ?? 0) };
  }, { neto: 0, pago: 0 });
  // Si todas las filas usan la misma unidad, el total la muestra; si no, no se suman peras con manzanas.
  const unidades = new Set((v.filas ?? []).map((f) => unidadDe(f?.semiproducto)));
  const unidadTotal = unidades.size === 1 ? [...unidades][0] : undefined;

  useBlocker({ shouldBlockFn: () => formState.isDirty && !guardar.isPending && !window.confirm(t('stock.entrega.salir_sin_guardar')), enableBeforeUnload: () => formState.isDirty });

  async function alGuardar(f: FormMasiva) {
    setAviso(null);
    try {
      await guardar.mutateAsync(aApiMasiva(f));
      reset(f);
      await navegar({ to: '/stock/entregas', search: { inst: f.instalacion ?? undefined } });
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  function agregar() {
    const ultima = getValues('filas').at(-1);
    filas.append({ ...filaVacia(ultima?.semiproducto ?? semis[0]?.id ?? null), precio: ultima?.precio ?? null }, { shouldFocus: false });
    // El foco va al buscador de la fila nueva, para seguir cargando con el teclado.
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-fila="${getValues('filas').length - 1}"] input[role="combobox"]`)?.focus(), 0);
  }

  useEffect(() => {
    document.title = `${t('stock.entregas.masiva')} · INATrace v2`;
  }, [t]);

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(alGuardar, () => setAviso(t('stock.entrega.revisar')))} noValidate className="grid gap-6 pb-24">
        <header>
          <Link to="/stock/entregas" search={{ inst: v.instalacion ?? undefined }} className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
            <Icono nombre="volver" className="size-4" /> {t('stock.entregas.titulo')}
          </Link>
          <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{t('stock.entregas.masiva')}</h1>
          <p className="mt-1 max-w-2xl text-tinta-2">{t('stock.masiva.descripcion')}</p>
        </header>

        {aviso && <Aviso tono="mal">{aviso}</Aviso>}

        <Bloque titulo={t('stock.masiva.comunes')}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SelectorE nombre="instalacion" etiqueta={t('stock.instalacion')} requerido comoNumero>
              <option value="">{t('stock.elegir')}</option>
              {instalaciones.map((f) => <option key={f.id} value={f.id}>{nombreInstalacion(f)}</option>)}
            </SelectorE>
            <CampoE nombre="fecha" etiqueta={t('stock.entrega.fecha')} requerido type="date" />
            <SelectorE nombre="registradoPor" etiqueta={t('stock.entrega.registrado_por')} requerido comoNumero>
              <option value="">{t('stock.elegir')}</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{[u.name, u.surname].filter(Boolean).join(' ') || u.email}</option>)}
            </SelectorE>
            <CampoE nombre="moneda" etiqueta={t('stock.entrega.moneda')} requerido list="monedas-masiva" maxLength={3} className="[&_input]:uppercase" ayuda={defecto.moneda ? undefined : t('stock.entrega.moneda_ayuda')} />
            <datalist id="monedas-masiva">{MONEDAS.map((m) => <option key={m} value={m} />)}</datalist>
            <SelectorE nombre="formaPago" etiqueta={t('stock.entrega.forma_pago')} requerido>
              <option value="">{t('stock.elegir')}</option>
              {formasPagoPosibles(!!v.acopiador).map((f) => <option key={f} value={f}>{t(`stock.forma_pago.${f}`)}</option>)}
            </SelectorE>
            {mostrar.acopiador && (
              <Controller
                control={control}
                name="acopiador"
                render={({ field }) => <SelectorPersona empresa={empresa} tipo="COLLECTOR" valor={field.value} etiqueta={t('stock.entrega.acopiador')} alElegir={field.onChange} />}
              />
            )}
          </div>
        </Bloque>

        <section aria-labelledby="t-filas" className="grid gap-4">
          <h2 id="t-filas" className="font-titulo text-xl font-semibold">{t('stock.masiva.productores', { count: filas.fields.length })}</h2>
          {filas.fields.map((campo, i) => {
            const c = calculo(v.filas?.[i]);
            const unidad = unidadDe(v.filas?.[i]?.semiproducto);
            return (
              <div key={campo.id} data-fila={i} role="group" aria-label={t('stock.masiva.fila', { n: i + 1 })} className="rounded-caja border border-linea bg-superficie p-5 shadow-suave">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-marca-suave text-sm font-bold text-marca">{i + 1}</span>
                  <span className="ml-auto text-sm text-tinta-2 tabular-nums">
                    {cantidad(c.neto, unidad, i18n.language)} · <strong className="text-tinta">{dinero(c.pago, moneda, i18n.language)}</strong>
                  </span>
                  {filas.fields.length > 1 && (
                    <button type="button" onClick={() => filas.remove(i)} className="rounded-md p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('stock.masiva.quitar', { n: i + 1 })}>
                      <Icono nombre="borrar" className="size-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <Controller
                      control={control}
                      name={`filas.${i}.productor`}
                      render={({ field, fieldState }) => (
                        <SelectorPersona
                          empresa={empresa}
                          valor={field.value}
                          etiqueta={t('stock.entrega.productor')}
                          requerido
                          error={fieldState.error?.message ? t(`stock.errores.${fieldState.error.message}`) : undefined}
                          alElegir={field.onChange}
                        />
                      )}
                    />
                  </div>
                  <SelectorE nombre={`filas.${i}.semiproducto`} etiqueta={t('stock.semiproducto')} requerido comoNumero disabled={!v.instalacion}>
                    <option value="">{v.instalacion ? t('stock.elegir') : t('stock.entrega.primero_instalacion')}</option>
                    {semis.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </SelectorE>
                  <CampoE nombre={`filas.${i}.bruto`} etiqueta={t('stock.entrega.bruto')} requerido decimal unidad={unidad} />
                  {mostrar.tara && <CampoE nombre={`filas.${i}.tara`} etiqueta={t('stock.entrega.tara')} requerido decimal unidad={unidad} />}
                  {mostrar.descuentoPeso && <CampoE nombre={`filas.${i}.descuentoPeso`} etiqueta={t('stock.entrega.descuento_peso')} requerido decimal unidad={unidad} />}
                  <CampoE nombre={`filas.${i}.precio`} etiqueta={t('stock.entrega.precio')} requerido decimal unidad={moneda || undefined} />
                  {mostrar.descuentoPrecio && <CampoE nombre={`filas.${i}.descuentoPrecio`} etiqueta={t('stock.entrega.descuento_precio')} requerido decimal unidad={moneda || undefined} />}
                  {mostrar.organico && <SiNoE nombre={`filas.${i}.organico`} etiqueta={t('stock.entrega.organico')} requerido />}
                  {mostrar.mujeres && <SiNoE nombre={`filas.${i}.mujeres`} etiqueta={t('stock.entregas.cafe_mujeres')} requerido />}
                </div>
              </div>
            );
          })}
          <Boton variante="secundario" onClick={agregar} className="justify-self-start">
            <Icono nombre="mas" className="size-4" /> {t('stock.masiva.agregar')}
          </Boton>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-linea bg-superficie/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
            <span className="mr-auto text-sm text-tinta-2 tabular-nums" aria-live="polite">
              {t('stock.masiva.total', { count: filas.fields.length })} · {unidadTotal ? cantidad(totales.neto, unidadTotal, i18n.language) : null}
              {unidadTotal ? ' · ' : null}
              <strong className="text-tinta">{dinero(totales.pago, moneda, i18n.language)}</strong>
            </span>
            <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-marca px-5 font-semibold text-sobre-marca hover:bg-marca-fuerte disabled:opacity-50" disabled={guardar.isPending}>
              <Icono nombre="ok" className="size-4" /> {guardar.isPending ? t('comun.cargando') : t('stock.masiva.guardar', { count: filas.fields.length })}
            </button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
