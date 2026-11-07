import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, getRouteApi, useBlocker, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ApiProductType, ApiUserCustomer } from '@/api/gen/types.gen';
import { exportarGeoDatos, productores, subirGeoDatos, useBorrarProductor, useGuardarProductor } from '@/api/productores';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual, type Empresa } from '@/util/empresa';
import { nombreCompleto, ubicacionCorta } from '@/util/productor';
import { CodigoQr } from '@/componentes/ui/CodigoQr';
import { aApi, aFormulario, esquemaProductor, type Catalogos, type FormProductor } from './esquema';
import { Banco } from './secciones/Banco';
import { Certificaciones } from './secciones/Certificaciones';
import { Finca } from './secciones/Finca';
import { Organizaciones } from './secciones/Organizaciones';
import { Parcelas } from './secciones/Parcelas';
import { Personales } from './secciones/Personales';
import { Ubicacion } from './secciones/Ubicacion';
import { confirmar, confirmarSalida } from '@/componentes/ui/Confirmar';

const SECCIONES = ['personales', 'ubicacion', 'finca', 'organizaciones', 'banco', 'certificaciones', 'parcelas'] as const;
/** Sección de cada campo con error, para marcarla en el índice y llevar ahí al guardar. */
const SECCION_DE: Record<string, (typeof SECCIONES)[number]> = {
  name: 'personales', surname: 'personales', gender: 'personales', email: 'personales', phone: 'personales', farmerCompanyInternalId: 'personales',
  pais: 'ubicacion', dir: 'ubicacion', lat: 'ubicacion', lng: 'ubicacion',
  unidadArea: 'finca', areaTotal: 'finca', cultivos: 'finca', areaOrganica: 'finca', inicioTransicion: 'finca',
  banco: 'banco', certificaciones: 'certificaciones', parcelas: 'parcelas',
};

const rutaFicha = getRouteApi('/portal/productores/$id');
const rutaRecolector = getRouteApi('/portal/productores/recolectores/$id');
type Tipo = 'FARMER' | 'COLLECTOR';
/** Secciones de un recolector: sin finca, certificaciones ni parcelas (como la versión actual). */
const SECCIONES_RECOLECTOR: readonly (typeof SECCIONES)[number][] = ['personales', 'ubicacion', 'organizaciones', 'banco'];

export function FichaExistente() {
  const { id } = rutaFicha.useParams();
  return <Ficha id={Number(id)} />;
}
export const FichaNueva = () => <Ficha />;

export function RecolectorExistente() {
  const { id } = rutaRecolector.useParams();
  return <Ficha id={Number(id)} tipo="COLLECTOR" />;
}
export const RecolectorNuevo = () => <Ficha tipo="COLLECTOR" />;

function Ficha({ id, tipo = 'FARMER' }: { id?: number; tipo?: Tipo }) {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  const ficha = useQuery({ ...productores.ficha(id ?? 0), enabled: !!id });
  const paises = useQuery(productores.paises());
  const tipos = useQuery({ ...productores.tiposProducto(empresa?.id ?? 0), enabled: !!empresa });
  const asociaciones = useQuery({ ...productores.asociaciones(empresa?.id ?? 0), enabled: !!empresa });
  const certificaciones = useQuery(productores.tiposCertificacion());
  const capas = useQuery(productores.capasMapa());

  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  const consultas = [ficha, paises, tipos, asociaciones, certificaciones].filter((_, i) => i !== 0 || id);
  const conError = consultas.find((c) => c.isError);
  if (conError) return <EstadoError texto={conError.error?.message} reintentar={() => consultas.forEach((c) => void c.refetch())} />;
  if (consultas.some((c) => c.isPending)) return <Cargando />;

  return (
    <Formulario
      // Al guardar, el productor cambia de id (nuevo → guardado): se rearma el formulario.
      key={ficha.data?.id ?? 'nuevo'}
      original={id ? ficha.data! : null}
      tipo={tipo}
      empresa={empresa}
      catalogos={{ paises: paises.data!, tiposProducto: cultivosDisponibles(tipos.data!, id ? ficha.data! : null) }}
      sinCatalogoCultivos={tipos.data!.length === 0}
      asociaciones={asociaciones.data!}
      tiposCertificacion={certificaciones.data!}
      capas={capas.data ?? []}
    />
  );
}

/**
 * Cultivos para elegir: los de las cadenas de valor de la empresa, más los que el productor ya
 * tiene (si la empresa dejó de tenerlos, el formulario no puede quedar sin poder guardarse).
 */
function cultivosDisponibles(deEmpresa: ApiProductType[], p: ApiUserCustomer | null): ApiProductType[] {
  const todos = new Map(deEmpresa.map((x) => [x.id, x]));
  for (const x of [...(p?.productTypes ?? []), ...(p?.plots ?? []).map((pl) => pl.crop)]) {
    if (x?.id && !todos.has(x.id)) todos.set(x.id, { ...x, name: x.name ?? `#${x.id}` });
  }
  return [...todos.values()];
}

function Formulario({
  original,
  tipo,
  empresa,
  catalogos,
  asociaciones,
  tiposCertificacion,
  capas,
  sinCatalogoCultivos,
}: {
  sinCatalogoCultivos: boolean;
  original: ApiUserCustomer | null;
  tipo: Tipo;
  empresa: Empresa;
  catalogos: Catalogos;
  asociaciones: Parameters<typeof Organizaciones>[0]['asociaciones'];
  tiposCertificacion: Parameters<typeof Certificaciones>[0]['tipos'];
  capas: Parameters<typeof Parcelas>[0]['capas'];
}) {
  const { t } = useTranslation();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const guardar = useGuardarProductor(empresa.id);
  const borrar = useBorrarProductor(empresa.id);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'mal'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // El país decide qué campos de dirección son obligatorios. Su código se calcula del catálogo al
  // validar, en vez de guardarlo en el formulario: escribirlo por código marcaba la ficha como
  // modificada apenas se abría.
  const resolver = useMemo<Resolver<FormProductor>>(() => {
    const zod = zodResolver(esquemaProductor) as unknown as Resolver<FormProductor>;
    return (valores, contexto, opciones) =>
      zod({ ...valores, codigoPais: catalogos.paises.find((p) => p.id === valores.pais)?.code }, contexto, opciones);
  }, [catalogos.paises]);
  const form = useForm<FormProductor>({
    resolver,
    defaultValues: aFormulario(original, empresa.id),
    mode: 'onTouched',
  });
  const { formState, handleSubmit, reset } = form;

  // No perder cambios sin guardar al salir de la ficha.
  useBlocker({ shouldBlockFn: async () => formState.isDirty && !guardar.isPending && !(await confirmarSalida(t('productores.ficha.salir_sin_guardar'))), enableBeforeUnload: () => formState.isDirty });

  const recolector = tipo === 'COLLECTOR';
  const secciones = recolector ? SECCIONES_RECOLECTOR : SECCIONES;
  const seccionesConError = new Set(Object.keys(formState.errors).map((k) => SECCION_DE[k]).filter(Boolean));

  async function alGuardar(f: FormProductor) {
    setAviso(null);
    try {
      const guardado = await guardar.mutateAsync(aApi(f, original, empresa.id, catalogos, tipo));
      reset(aFormulario(guardado, empresa.id));
      setAviso({ tono: 'ok', texto: t('productores.ficha.guardado') });
      if (!original && guardado.id) {
        const params = { id: String(guardado.id) };
        await (recolector ? navegar({ to: '/productores/recolectores/$id', params, replace: true }) : navegar({ to: '/productores/$id', params, replace: true }));
      }
    } catch (e) {
      setAviso({ tono: 'mal', texto: (e as Error).message });
    }
  }

  function alFallar(errores: FieldErrors<FormProductor>) {
    // Lleva a la primera sección con problemas, en el orden de la ficha.
    const primera = secciones.find((s) => Object.keys(errores).some((k) => SECCION_DE[k] === s));
    if (primera) document.getElementById(primera)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setAviso({ tono: 'mal', texto: t('productores.ficha.revisar') });
  }

  async function eliminar() {
    if (!original?.id || !(await confirmar(t(recolector ? 'recolectores.borrar_confirmar' : 'productores.borrar_confirmar', { nombre: nombreCompleto(original) }), { accion: 'eliminar' }))) return;
    try {
      await borrar.mutateAsync(original.id);
      reset(form.getValues()); // sin cambios pendientes: que el bloqueo no pregunte
      await (recolector ? navegar({ to: '/productores/recolectores' }) : navegar({ to: '/productores' }));
    } catch (e) {
      setAviso({ tono: 'mal', texto: (e as Error).message });
    }
  }

  async function subirGeo(archivo: File) {
    if (!original?.id) return;
    if (formState.isDirty && !(await confirmar(t('productores.parcela.subir_con_cambios'), { accion: 'continuar' }))) return;
    setOcupado(true);
    setAviso(null);
    try {
      await subirGeoDatos(original.id, archivo);
      const nuevo = await qc.fetchQuery({ ...productores.ficha(original.id), staleTime: 0 });
      reset(aFormulario(nuevo, empresa.id));
      setAviso({ tono: 'ok', texto: t('productores.parcela.geojson_subido') });
    } catch (e) {
      setAviso({ tono: 'mal', texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  const nombre = original ? nombreCompleto(original) : t(recolector ? 'recolectores.nuevo' : 'productores.nuevo');
  useEffect(() => {
    document.title = `${nombre} · INATrace v2`;
  }, [nombre]);

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(alGuardar, alFallar)} noValidate className="grid gap-6 pb-24">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to={recolector ? '/productores/recolectores' : '/productores'} className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
              <Icono nombre="volver" className="size-4" /> {t(recolector ? 'recolectores.titulo' : 'productores.titulo')}
            </Link>
            <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{nombre}</h1>
            {original && <p className="mt-1 text-sm text-tinta-2">{t('productores.ficha.id', { id: original.farmerCompanyInternalId || original.id })}</p>}
          </div>
          {original && (
            <Boton variante="peligro" chico onClick={eliminar} disabled={borrar.isPending}>
              <Icono nombre="borrar" className="size-4" /> {t('productores.borrar')}
            </Boton>
          )}
        </header>

        {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

        {original?.id && !recolector && <Tarjeta productor={original} empresa={empresa.nombre} />}

        <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
          <nav aria-label={t('productores.ficha.indice')} className="hidden lg:block">
            <ul className="sticky top-24 grid gap-0.5 text-sm">
              {secciones.map((s) => (
                <li key={s}>
                  <a href={`#${s}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-tinta-2 hover:bg-superficie-2 hover:text-tinta">
                    {t(`productores.secciones.${s}`)}
                    {seccionesConError.has(s) && <span className="size-2 rounded-full bg-mal" aria-label={t('productores.ficha.con_errores')} />}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="grid min-w-0 gap-6">
            <Personales />
            <Ubicacion paises={catalogos.paises} />
            {!recolector && <Finca tiposProducto={catalogos.tiposProducto} />}
            <Organizaciones empresa={empresa.nombre} asociaciones={asociaciones} miembro={recolector ? 'recolectores.miembro' : undefined} />
            <Banco />
            {!recolector && <Certificaciones tipos={tiposCertificacion} />}
            {!recolector && <Parcelas
              tiposProducto={catalogos.tiposProducto}
              capas={capas}
              ocupado={ocupado}
              sinCatalogo={sinCatalogoCultivos}
              alSubirGeo={original?.id ? subirGeo : undefined}
              alExportarGeo={original?.id ? () => void exportarGeoDatos(original.id!).catch((e: Error) => setAviso({ tono: 'mal', texto: e.message })) : undefined}
            />}
          </div>
        </div>

        {/* Barra de guardado: aparece cuando hay algo que guardar. */}
        {(formState.isDirty || !original) && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-superficie/95 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <p className="text-sm text-tinta-2">{original ? t('productores.ficha.cambios') : t(recolector ? 'recolectores.nuevo_ayuda' : 'productores.ficha.nuevo_ayuda')}</p>
              <div className="flex gap-2">
                {original && (
                  <Boton variante="secundario" onClick={() => reset()} disabled={guardar.isPending}>
                    {t('productores.ficha.descartar')}
                  </Boton>
                )}
                <Boton type="submit" disabled={guardar.isPending}>
                  {guardar.isPending ? t('productores.ficha.guardando') : t('comun.guardar')}
                </Boton>
              </div>
            </div>
          </div>
        )}
      </form>
    </FormProvider>
  );
}

/**
 * Tarjeta del productor con su QR (codifica el ID, como la interfaz actual): sirve para
 * identificarlo en las entregas. Se puede imprimir sola.
 */
function Tarjeta({ productor, empresa }: { productor: ApiUserCustomer; empresa: string }) {
  const { t } = useTranslation();
  function imprimir() {
    document.documentElement.classList.add('modo-impresion');
    const quitar = () => document.documentElement.classList.remove('modo-impresion');
    window.addEventListener('afterprint', quitar, { once: true });
    window.print();
  }
  return (
    <section className="flex flex-wrap items-center gap-5 rounded-caja border border-linea bg-superficie p-4 shadow-suave" aria-label={t('productores.tarjeta.titulo')}>
      <div className="tarjeta-imprimible flex items-center gap-4 rounded-lg p-1 text-tinta">
        <CodigoQr valor={String(productor.id)} etiqueta={t('productores.tarjeta.qr', { id: productor.id })} className="size-24 text-marca-fuerte" />
        <div className="text-sm">
          <p className="font-titulo text-lg font-semibold">{nombreCompleto(productor)}</p>
          <p className="text-tinta-2">{t('productores.ficha.id', { id: productor.farmerCompanyInternalId || productor.id })}</p>
          {ubicacionCorta(productor.location?.address) && <p className="text-tinta-2">{ubicacionCorta(productor.location?.address)}</p>}
          <p className="text-tinta-3">{empresa}</p>
        </div>
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        <Boton variante="secundario" chico onClick={imprimir}>{t('productores.tarjeta.imprimir')}</Boton>
        <Link to="/stock/entregas" search={{ prod: productor.id }} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-marca hover:bg-marca-suave">
          <Icono nombre="bodega" className="size-4" /> {t('productores.tarjeta.entregas_v2')}
        </Link>
        <Link to="/stock/entregas/nueva" search={{ productor: productor.id }} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-marca hover:bg-marca-suave">
          <Icono nombre="mas" className="size-4" /> {t('stock.entregas.nueva')}
        </Link>
        <Link to="/stock/pagos" search={{ prod: productor.id }} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-marca hover:bg-marca-suave">
          <Icono nombre="precio" className="size-4" /> {t('productores.tarjeta.pagos')}
        </Link>
      </div>
    </section>
  );
}
