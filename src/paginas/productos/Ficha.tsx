import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Link, useBlocker, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { productores } from '@/api/productores';
import { subirImagen, useGuardarProducto } from '@/api/productos';
import { urlImagen } from '@/api/respuesta';
import type { ApiProduct, ApiValueChain } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Area, Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import type { Visibles } from '@/util/etiqueta';
import { enAnterior } from '@/util/entorno';
import {
  IDIOMAS, SECCIONES, armarProducto, esDuena, formDesdeProducto, puntoNuevo, seccionesConError, sinErroresProducto, validarProducto,
  type ErroresProducto, type FormProducto, type PuntoOrigen, type Seccion,
} from '@/util/producto';
import { NumeroConUnidad } from '../stock/procesamiento/piezas';
import { useProducto } from './Marco';

const SelectorPuntos = lazy(() => import('@/componentes/mapa/SelectorPuntos'));

export function ProductoNuevo() {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  const perfil = useQuery({ ...productores.perfilEmpresa(empresa?.id ?? 0), enabled: !!empresa });
  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  if (perfil.isPending) return <Cargando />;
  if (perfil.isError) return <EstadoError texto={perfil.error.message} reintentar={() => void perfil.refetch()} />;
  return <Formulario empresa={empresa.id} original={null} cadenas={perfil.data?.valueChains ?? []} />;
}

/** Pestaña "Ficha" de un producto existente (la cabecera y el borrado están en el marco). */
export function ProductoExistente() {
  const { producto, empresa } = useProducto();
  return <Formulario key={producto.id} empresa={empresa} original={producto} cadenas={[]} />;
}

const MAXIMO = 1000;

function Formulario({ empresa, original, cadenas }: { empresa: number; original: ApiProduct | null; cadenas: ApiValueChain[] }) {
  const { t, i18n } = useTranslation();
  const navegar = useNavigate();
  const guardar = useGuardarProducto();
  const editable = !original || esDuena(original, empresa);
  const [f, setF] = useState<FormProducto>(() => {
    const inicial = formDesdeProducto(original);
    // Un producto nuevo arranca en el idioma de la interfaz.
    const delUsuario = i18n.language.slice(0, 2).toUpperCase() as FormProducto['idioma'];
    return original ? inicial : { ...inicial, idioma: (IDIOMAS as string[]).includes(delUsuario) ? delUsuario : 'EN' };
  });
  const [cadena, setCadena] = useState<number | null>(cadenas.length === 1 ? cadenas[0]!.id! : null);
  const [tocado, setTocado] = useState(false);
  const [errores, setErrores] = useState<ErroresProducto>({ puntos: {} });
  const [sinCadena, setSinCadena] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok'; texto: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const cambiar = (c: Partial<FormProducto>) => {
    setF((x) => ({ ...x, ...c }));
    setTocado(true);
  };
  const conError = seccionesConError(errores);
  const nombre = f.nombre.trim() || (original ? `#${original.id}` : t('productos.nuevo'));

  useBlocker({ shouldBlockFn: () => tocado && !guardar.isPending && !window.confirm(t('stock.entrega.salir_sin_guardar')), enableBeforeUnload: () => tocado });
  useEffect(() => {
    if (!original) document.title = `${nombre} · INATrace v2`;
  }, [nombre, original]);


  async function alGuardar() {
    setAviso(null);
    const e = validarProducto(f);
    const faltaCadena = !original && !cadena;
    setErrores(e);
    setSinCadena(faltaCadena);
    if (!sinErroresProducto(e) || faltaCadena) {
      setAviso({ tono: 'mal', texto: t('stock.entrega.revisar') });
      return;
    }
    try {
      const id = await guardar.mutateAsync(armarProducto(f, original, original ? undefined : { empresa, cadena: cadena! }));
      setTocado(false);
      if (!original) await navegar({ to: '/productos/$id', params: { id: String(id) }, replace: true });
      else setAviso({ tono: 'ok', texto: t('productos.guardado') });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }


  return (
    <div className={original ? 'grid gap-6' : 'grid gap-6 pb-24'}>
      {!original && (
        <header>
          <Link to="/productos" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
            <Icono nombre="volver" className="size-4" /> {t('productos.titulo')}
          </Link>
          <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{nombre}</h1>
        </header>
      )}

      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <nav aria-label={t('productos.indice')} className="hidden lg:block">
          <ul className="sticky top-24 grid gap-0.5 text-sm">
            {SECCIONES.map((s) => (
              <li key={s}>
                <a href={`#${s}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-tinta-2 hover:bg-superficie-2 hover:text-tinta">
                  {t(`productos.secciones.${s}`)}
                  {(conError.has(s) || (s === 'datos' && sinCadena)) && <span className="size-2 rounded-full bg-mal" aria-label={t('productores.ficha.con_errores')} />}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <CamposFicha
          f={f}
          cambiar={cambiar}
          errores={errores}
          editable={editable}
          nombre={nombre}
          alAvisar={(texto) => setAviso({ tono: 'mal', texto })}
          alSubir={setSubiendo}
          datosExtra={
            <>
              {!original && cadenas.length === 0 && (
                <Aviso tono="aviso" titulo={t('productos.sin_cadenas_titulo')}>
                  {t('productos.sin_cadenas')}{' '}
                  <a href={enAnterior(`/companies/${empresa}`)} className="font-semibold underline">{t('portal.version_actual')}</a>
                </Aviso>
              )}
              {!original && cadenas.length > 0 && (
                <Selector etiqueta={<Requerido texto={t('productos.cadena')} />} value={cadena ?? ''} onChange={(e) => { setCadena(e.target.value ? Number(e.target.value) : null); setTocado(true); }} error={sinCadena ? t('stock.errores.requerido') : undefined}>
                  <option value="">{t('stock.elegir')}</option>
                  {cadenas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Selector>
              )}
            </>
          }
        />
      </div>

      {editable && (tocado || !original) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-superficie/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm text-tinta-2">{original ? t('productores.ficha.cambios') : t('productos.nuevo_ayuda')}</p>
            <Boton onClick={() => void alGuardar()} disabled={guardar.isPending || subiendo}>
              <Icono nombre="ok" className="size-4" /> {guardar.isPending ? t('productores.ficha.guardando') : t('comun.guardar')}
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}

export type Visibilidad = { visibles: Visibles; alternar: (campo: string, visible: boolean) => void };

/**
 * Las secciones de la ficha: las usan el producto y el contenido de cada etiqueta. En una etiqueta,
 * `visibilidad` agrega a cada campo el interruptor de si se muestra en la vitrina.
 */
export function CamposFicha({ f, cambiar, errores, editable, nombre, datosExtra, visibilidad, avisoOrigen, alAvisar, alSubir }: {
  f: FormProducto;
  cambiar: (c: Partial<FormProducto>) => void;
  errores: ErroresProducto;
  editable: boolean;
  nombre: string;
  datosExtra?: ReactNode;
  visibilidad?: Visibilidad;
  /** Aviso sobre los lugares de origen (en una etiqueta). */
  avisoOrigen?: ReactNode;
  alAvisar: (texto: string) => void;
  alSubir?: (subiendo: boolean) => void;
}) {
  const { t } = useTranslation();
  const [subiendo, setSubiendo] = useState(false);
  const cambiarPunto = (clave: string, c: Partial<PuntoOrigen>) => cambiar({ puntos: f.puntos.map((p) => (p.clave === clave ? { ...p, ...c } : p)) });
  const err = (k: keyof FormProducto) => {
    const v = (errores as Record<string, unknown>)[k];
    return typeof v === 'string' ? t(`productos.errores.${v}`, { defaultValue: t(`stock.errores.${v}`) }) : undefined;
  };
  const req = (texto: string) => <Requerido texto={texto} />;
  const contador = (texto: string) => t('productos.caracteres', { n: texto.trim().length, max: MAXIMO });

  async function subirFoto(archivo?: File) {
    if (!archivo) return;
    if (!/^image\/(png|jpe?g)$/.test(archivo.type)) {
      alAvisar(t('productos.foto_tipo'));
      return;
    }
    setSubiendo(true);
    alSubir?.(true);
    try {
      cambiar({ foto: await subirImagen(archivo) });
    } catch (e) {
      alAvisar((e as Error).message);
    } finally {
      setSubiendo(false);
      alSubir?.(false);
    }
  }

  return (
        <fieldset disabled={!editable} className="grid min-w-0 gap-6">
          <Seccion id="datos">
            <div className="grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
              <ConVisibilidad campo="name" texto={t('productos.nombre')} v={visibilidad} className="sm:col-span-2">
                <Campo etiqueta={req(t('productos.nombre'))} value={f.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} error={err('nombre')} />
              </ConVisibilidad>
              {datosExtra}
              <ConVisibilidad campo="description" texto={t('productos.descripcion_producto')} v={visibilidad} className="sm:col-span-2">
                <Area etiqueta={req(t('productos.descripcion_producto'))} rows={4} value={f.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} error={err('descripcion')} />
              </ConVisibilidad>
              <ConVisibilidad campo="photo" texto={t('productos.foto')} v={visibilidad} className="grid gap-1.5 sm:col-span-2">
                <span className="text-sm font-semibold text-tinta-2">{req(t('productos.foto'))}</span>
                <div className="flex flex-wrap items-center gap-4">
                  {f.foto?.storageKey ? (
                    <img src={urlImagen(f.foto.storageKey, 'SMALL')} alt={t('productos.foto_de', { nombre })} className="size-28 rounded-lg border border-linea bg-superficie-2 object-cover" />
                  ) : (
                    <span className="grid size-28 place-items-center rounded-lg border border-dashed border-linea-fuerte text-tinta-3"><Icono nombre="certificado" className="size-8" /></span>
                  )}
                  {editable && (
                    <label className={'inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm font-semibold ' + (err('foto') ? 'border-mal text-mal' : 'border-linea-fuerte text-tinta-2 hover:border-marca hover:text-marca')}>
                      <Icono nombre="subir" className="size-4" /> {subiendo ? t('comun.cargando') : f.foto ? t('productos.cambiar_foto') : t('productos.subir_foto')}
                      <input type="file" accept="image/png,image/jpeg" className="sr-only" aria-label={t('productos.foto')} onChange={(e) => void subirFoto(e.target.files?.[0])} />
                    </label>
                  )}
                </div>
                {err('foto') && <span className="text-sm text-mal">{err('foto')}</span>}
              </ConVisibilidad>
            </div>
          </Seccion>

          <Seccion id="origen" ayuda={t('productos.origen.ayuda')}>
            <ConVisibilidad campo="origin" texto={t('productos.secciones.origen')} v={visibilidad}>
            <Area etiqueta={req(t('productos.origen.texto'))} rows={3} value={f.origenTexto} onChange={(e) => cambiar({ origenTexto: e.target.value })} error={err('origenTexto')} />
            <div className="mt-5 grid gap-3">
              <span className="text-sm font-semibold text-tinta-2">{avisoOrigen ? t('productos.origen.puntos') : req(t('productos.origen.puntos'))}</span>
              {avisoOrigen}
              {editable && <p className="text-sm text-tinta-3">{t('productos.origen.instrucciones')}</p>}
              <Suspense fallback={<div className="h-80 rounded-caja bg-superficie-2" />}>
                <SelectorPuntos
                  puntos={f.puntos.map((p) => (p.lat !== null && p.lng !== null && !Number.isNaN(p.lat) && !Number.isNaN(p.lng) ? ([p.lng, p.lat] as [number, number]) : null))}
                  alAgregar={([lng, lat]) => editable && cambiar({ puntos: [...f.puntos, puntoNuevo(lng, lat)] })}
                  alMover={(i, [lng, lat]) => editable && cambiar({ puntos: f.puntos.map((p, j) => (j === i ? { ...p, lng, lat } : p)) })}
                />
              </Suspense>
              {errores.sinPuntos && <span className="text-sm text-mal">{t('productos.errores.sin_puntos')}</span>}
              {f.puntos.length > 0 && (
                <ol className="grid gap-3">
                  {f.puntos.map((p, i) => {
                    const ep = errores.puntos[p.clave] ?? {};
                    const e = (k: 'lat' | 'lng' | 'productores') => (ep[k] ? t(`productos.errores.${ep[k]}`, { defaultValue: t(`stock.errores.${ep[k]}`) }) : undefined);
                    return (
                      <li key={p.clave} aria-label={t('productos.origen.punto', { n: i + 1 })} className="grid gap-3 rounded-lg border border-linea p-3 sm:grid-cols-[2rem_1fr_8rem_8rem_8rem_auto] sm:items-end [&>*]:min-w-0">
                        <span className="grid size-7 place-items-center rounded-full bg-marca text-xs font-bold text-sobre-marca sm:mb-2">{i + 1}</span>
                        <Campo etiqueta={t('productos.origen.nombre_punto')} value={p.nombre} onChange={(x) => cambiarPunto(p.clave, { nombre: x.target.value })} />
                        <NumeroConUnidad etiqueta={t('productos.origen.latitud')} requerido valor={p.lat} alCambiar={(lat) => cambiarPunto(p.clave, { lat })} error={e('lat')} />
                        <NumeroConUnidad etiqueta={t('productos.origen.longitud')} requerido valor={p.lng} alCambiar={(lng) => cambiarPunto(p.clave, { lng })} error={e('lng')} />
                        <NumeroConUnidad etiqueta={t('productos.origen.productores')} valor={p.productores} alCambiar={(productores) => cambiarPunto(p.clave, { productores })} error={e('productores')} />
                        {editable && (
                          <button type="button" onClick={() => cambiar({ puntos: f.puntos.filter((x) => x.clave !== p.clave) })} className="justify-self-start rounded-md p-2 text-tinta-3 hover:bg-mal-suave hover:text-mal sm:mb-1" aria-label={t('productos.origen.quitar', { n: i + 1 })}>
                            <Icono nombre="borrar" className="size-4" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            </ConVisibilidad>
          </Seccion>

          <Seccion id="proceso">
            <ConVisibilidad campo="process.production" texto={t('productos.produccion')} v={visibilidad}>
              <Area etiqueta={req(t('productos.produccion'))} ayuda={t('productos.produccion_ayuda')} rows={4} value={f.produccion} onChange={(e) => cambiar({ produccion: e.target.value })} error={err('produccion')} />
            </ConVisibilidad>
          </Seccion>

          <Seccion id="responsabilidad">
            <ConVisibilidad campo="responsibility.laborPolicies" texto={t('productos.politicas')} v={visibilidad}>
              <Area etiqueta={req(t('productos.politicas'))} ayuda={t('productos.politicas_ayuda')} rows={4} value={f.politicasLaborales} onChange={(e) => cambiar({ politicasLaborales: e.target.value })} error={err('politicasLaborales')} />
            </ConVisibilidad>
          </Seccion>

          <Seccion id="sostenibilidad">
            <div className="grid gap-5">
              <ConVisibilidad campo="sustainability.production" texto={t('productos.sostenible_produccion')} v={visibilidad}>
                <Area etiqueta={req(t('productos.sostenible_produccion'))} ayuda={contador(f.sostenibleProduccion)} rows={4} value={f.sostenibleProduccion} onChange={(e) => cambiar({ sostenibleProduccion: e.target.value })} error={err('sostenibleProduccion')} />
              </ConVisibilidad>
              <ConVisibilidad campo="sustainability.packaging" texto={t('productos.sostenible_empaque')} v={visibilidad}>
                <Area etiqueta={t('productos.sostenible_empaque')} ayuda={contador(f.sostenibleEmpaque)} rows={3} value={f.sostenibleEmpaque} onChange={(e) => cambiar({ sostenibleEmpaque: e.target.value })} error={err('sostenibleEmpaque')} />
              </ConVisibilidad>
              <ConVisibilidad campo="sustainability.co2Footprint" texto={t('productos.huella')} v={visibilidad}>
                <Campo etiqueta={t('productos.huella')} value={f.huellaCo2} onChange={(e) => cambiar({ huellaCo2: e.target.value })} />
              </ConVisibilidad>
            </div>
          </Seccion>

          <Seccion id="ajustes">
            <div className="grid gap-5">
              <ConVisibilidad campo="settings.language" texto={t('productos.idioma')} v={visibilidad}>
                <Selector etiqueta={req(t('productos.idioma'))} ayuda={t('productos.idioma_ayuda')} error={err('idioma')} value={f.idioma} onChange={(e) => cambiar({ idioma: e.target.value as FormProducto['idioma'] })} className="sm:max-w-xs">
                  <option value="">{t('stock.elegir')}</option>
                  {IDIOMAS.map((i) => <option key={i} value={i}>{t(`productos.idiomas.${i}`)}</option>)}
                </Selector>
              </ConVisibilidad>
              <ConVisibilidad campo="settings.gdprText" texto={t('productos.gdpr')} v={visibilidad}>
                <Area etiqueta={t('productos.gdpr')} rows={3} value={f.gdpr} onChange={(e) => cambiar({ gdpr: e.target.value })} />
              </ConVisibilidad>
              <ConVisibilidad campo="settings.privacyPolicyText" texto={t('productos.privacidad')} v={visibilidad}>
                <Area etiqueta={t('productos.privacidad')} rows={3} value={f.privacidad} onChange={(e) => cambiar({ privacidad: e.target.value })} />
              </ConVisibilidad>
              <ConVisibilidad campo="settings.termsOfUseText" texto={t('productos.terminos')} v={visibilidad}>
                <Area etiqueta={t('productos.terminos')} rows={3} value={f.terminos} onChange={(e) => cambiar({ terminos: e.target.value })} />
              </ConVisibilidad>
            </div>
          </Seccion>
        </fieldset>
  );
}

function Requerido({ texto }: { texto: string }) {
  return (
    <>
      {texto}
      <span className="text-mal" aria-hidden="true"> *</span>
    </>
  );
}

/** Un campo de la ficha con su interruptor de visibilidad en la etiqueta (si corresponde). */
export function ConVisibilidad({ campo, texto, v, className, children }: { campo: string; texto: string; v?: Visibilidad; className?: string; children: ReactNode }) {
  const { t } = useTranslation();
  if (!v) return className ? <div className={className}>{children}</div> : <>{children}</>;
  const visible = !!v.visibles[campo];
  return (
    <div className={clsx('grid gap-2', className)}>
      <label className="flex cursor-pointer items-center gap-2 justify-self-end text-xs font-semibold text-tinta-2">
        <input type="checkbox" className="size-4 accent-[var(--marca)]" checked={visible} onChange={(e) => v.alternar(campo, e.target.checked)} aria-label={t('productos.etiquetas.mostrar_campo', { campo: texto })} />
        {visible ? t('productos.etiquetas.visible') : t('productos.etiquetas.oculto')}
      </label>
      <div className={clsx('grid gap-1.5 transition-opacity', !visible && 'opacity-55')}>{children}</div>
    </div>
  );
}

function Seccion({ id, ayuda, children }: { id: Seccion; ayuda?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-24 rounded-caja border border-linea bg-superficie p-5 shadow-suave sm:p-6">
      <h2 id={`${id}-titulo`} className="font-titulo text-xl font-semibold">{t(`productos.secciones.${id}`)}</h2>
      {ayuda && <p className="mt-1 text-sm text-tinta-2">{ayuda}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
