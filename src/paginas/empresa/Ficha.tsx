import { useState, type ReactNode } from 'react';
import { useBlocker } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { empresa as consultasEmpresa, useGuardarEmpresa } from '@/api/empresa';
import { productores } from '@/api/productores';
import { subirImagen } from '@/api/productos';
import { urlImagen } from '@/api/respuesta';
import { Boton } from '@/componentes/ui/Boton';
import { Area, Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import {
  REDES, armarEmpresa, clave, formDesdeEmpresa, validarEmpresa,
  type Certificacion, type ErroresEmpresa, type FormEmpresa, type Productor, type Registro, type Video,
} from '@/util/fichaEmpresa';
import { CampoArchivo, Casilla } from '../productos/piezas';
import { useEmpresaVista } from './Marco';

const SECCIONES = ['datos', 'sede', 'descripcion', 'operacion', 'certificaciones', 'videos', 'registros', 'productores', 'redes'] as const;
type Seccion = (typeof SECCIONES)[number];
const DOCS = ['pdf', 'png', 'jpg', 'jpeg'];

/** Sección del índice a la que pertenece cada error. */
const seccionDe = (k: string): Seccion => {
  const lista = k.split('.')[0] ?? k;
  if ((SECCIONES as readonly string[]).includes(lista)) return lista as Seccion;
  if (['nombre', 'abreviatura', 'logo'].includes(k)) return 'datos';
  if (['direccion', 'postal'].includes(k)) return 'sede';
  if (['cadenas', 'moneda'].includes(k)) return 'operacion';
  return 'descripcion';
};

export function FichaEmpresa() {
  const { ficha } = useEmpresaVista();
  return <Formulario key={ficha.id} />;
}

function Formulario() {
  const { t } = useTranslation();
  const { ficha, editable } = useEmpresaVista();
  const guardar = useGuardarEmpresa();
  const paises = useQuery(productores.paises());
  const monedas = useQuery(consultasEmpresa.monedas());
  const tipos = useQuery(productores.tiposCertificacion());
  const [f, setF] = useState<FormEmpresa>(() => formDesdeEmpresa(ficha));
  const [tocado, setTocado] = useState(false);
  const [errores, setErrores] = useState<ErroresEmpresa>({});
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok'; texto: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const cambiar = (c: Partial<FormEmpresa>) => {
    setF((x) => ({ ...x, ...c }));
    setTocado(true);
  };
  const err = (k: string) => {
    const v = errores[k];
    if (!v) return undefined;
    const [codigo, max] = v.startsWith('largo_') ? ['largo', v.slice(6)] : [v, undefined];
    return t(`empresa.errores.${codigo}`, { max, defaultValue: t(`stock.errores.${codigo}`) });
  };
  const conError = new Set(Object.keys(errores).map(seccionDe));

  useBlocker({ shouldBlockFn: () => tocado && !guardar.isPending && !window.confirm(t('stock.entrega.salir_sin_guardar')), enableBeforeUnload: () => tocado });

  async function alGuardar() {
    setAviso(null);
    const e = validarEmpresa(f);
    setErrores(e);
    if (Object.keys(e).length) {
      setAviso({ tono: 'mal', texto: t('stock.entrega.revisar') });
      return;
    }
    try {
      await guardar.mutateAsync(armarEmpresa(ficha, f, { paises: paises.data ?? [], monedas: monedas.data ?? [] }));
      setTocado(false);
      setAviso({ tono: 'ok', texto: t('empresa.guardada') });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  async function subirLogo(archivo?: File) {
    if (!archivo) return;
    if (!/^image\/(png|jpe?g)$/.test(archivo.type)) {
      setAviso({ tono: 'mal', texto: t('productos.foto_tipo') });
      return;
    }
    setSubiendo(true);
    try {
      cambiar({ logo: await subirImagen(archivo) });
    } catch (e) {
      setAviso({ tono: 'mal', texto: (e as Error).message });
    } finally {
      setSubiendo(false);
    }
  }

  const req = (texto: string) => <>{texto} <span className="text-mal" aria-hidden>*</span></>;
  const contador = (texto: string, max: number) => t('productos.caracteres', { n: texto.trim().length, max });

  return (
    <div className="grid gap-6">
      {!editable && <Aviso tono="info" titulo={t('empresa.solo_lectura_titulo')}>{t('empresa.solo_lectura')}</Aviso>}
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <nav aria-label={t('productos.indice')} className="hidden lg:block">
          <ul className="sticky top-24 grid gap-0.5 text-sm">
            {SECCIONES.map((s) => (
              <li key={s}>
                <a href={`#${s}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-tinta-2 hover:bg-superficie-2 hover:text-tinta">
                  {t(`empresa.secciones.${s}`)}
                  {conError.has(s) && <span className="size-2 rounded-full bg-mal" aria-label={t('productores.ficha.con_errores')} />}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <fieldset disabled={!editable} className="grid min-w-0 gap-6">
          <Seccion id="datos">
            <div className="grid gap-5 sm:grid-cols-[1fr_12rem] [&>*]:min-w-0">
              <Campo etiqueta={req(t('empresa.nombre'))} value={f.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} error={err('nombre')} />
              <Campo etiqueta={t('empresa.abreviatura')} ayuda={t('empresa.abreviatura_ayuda')} value={f.abreviatura} onChange={(e) => cambiar({ abreviatura: e.target.value })} error={err('abreviatura')} />
              <div className="grid gap-1.5 sm:col-span-2">
                <span className="text-sm font-semibold text-tinta-2">{req(t('empresa.logo'))}</span>
                <div className="flex flex-wrap items-center gap-4">
                  {f.logo?.storageKey ? (
                    <img src={urlImagen(f.logo.storageKey, 'SMALL')} alt={t('empresa.logo')} className="size-24 rounded-lg border border-linea bg-superficie-2 object-contain" />
                  ) : (
                    <span className="grid size-24 place-items-center rounded-lg border border-dashed border-linea-fuerte text-tinta-3"><Icono nombre="web" className="size-7" /></span>
                  )}
                  {editable && (
                    <label className={'inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm font-semibold ' + (err('logo') ? 'border-mal text-mal' : 'border-linea-fuerte text-tinta-2 hover:border-marca hover:text-marca')}>
                      <Icono nombre="subir" className="size-4" /> {subiendo ? t('comun.cargando') : f.logo ? t('empresa.cambiar_logo') : t('empresa.subir_logo')}
                      <input type="file" accept="image/png,image/jpeg" className="sr-only" aria-label={t('empresa.logo')} onChange={(e) => void subirLogo(e.target.files?.[0])} />
                    </label>
                  )}
                </div>
                {err('logo') && <span className="text-sm text-mal">{err('logo')}</span>}
              </div>
            </div>
          </Seccion>

          <Seccion id="sede">
            <div className="grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
              <Campo etiqueta={req(t('empresa.direccion'))} value={f.direccion} onChange={(e) => cambiar({ direccion: e.target.value })} error={err('direccion')} className="sm:col-span-2" />
              <Campo etiqueta={t('empresa.ciudad')} value={f.ciudad} onChange={(e) => cambiar({ ciudad: e.target.value })} />
              <Campo etiqueta={t('empresa.region')} value={f.region} onChange={(e) => cambiar({ region: e.target.value })} />
              <Campo etiqueta={t('empresa.postal')} value={f.postal} onChange={(e) => cambiar({ postal: e.target.value })} error={err('postal')} />
              <Selector etiqueta={t('empresa.pais')} value={f.pais ?? ''} onChange={(e) => cambiar({ pais: e.target.value ? Number(e.target.value) : null })}>
                <option value="">{t('stock.elegir')}</option>
                {(paises.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Selector>
            </div>
          </Seccion>

          <Seccion id="descripcion">
            <div className="grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
              <Area etiqueta={req(t('empresa.acerca'))} rows={5} value={f.acerca} onChange={(e) => cambiar({ acerca: e.target.value })} error={err('acerca')} ayuda={contador(f.acerca, 2000)} className="sm:col-span-2" />
              <Campo etiqueta={t('empresa.gerente')} value={f.gerente} onChange={(e) => cambiar({ gerente: e.target.value })} />
              <Campo etiqueta={req(t('empresa.correo'))} type="email" value={f.correo} onChange={(e) => cambiar({ correo: e.target.value })} error={err('correo')} />
              <Campo etiqueta={req(t('empresa.telefono'))} type="tel" value={f.telefono} onChange={(e) => cambiar({ telefono: e.target.value })} error={err('telefono')} />
              <Campo etiqueta={t('empresa.web')} type="url" placeholder="https://…" value={f.web} onChange={(e) => cambiar({ web: e.target.value })} />
              <Area etiqueta={t('empresa.entrevista')} rows={4} value={f.entrevista} onChange={(e) => cambiar({ entrevista: e.target.value })} error={err('entrevista')} ayuda={contador(f.entrevista, 2000)} className="sm:col-span-2" />
            </div>
          </Seccion>

          <Seccion id="operacion">
            <Operacion f={f} cambiar={cambiar} err={err} editable={editable} monedas={monedas.data ?? []} req={req} />
          </Seccion>

          <Seccion id="certificaciones">
            <Lista<Certificacion>
              items={f.certificaciones}
              alCambiar={(certificaciones) => cambiar({ certificaciones })}
              nuevo={() => ({ clave: clave(), tipo: '', descripcion: '', certificado: null, vigencia: '' })}
              textoAgregar={t('empresa.agregar_certificacion')}
              etiqueta={(i) => t('empresa.certificacion_n', { n: i + 1 })}
              editable={editable}
              render={(c, set) => (
                <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                  <Selector etiqueta={t('empresa.tipo_certificacion')} value={c.tipo} onChange={(e) => set({ tipo: e.target.value })}>
                    <option value="">{t('stock.elegir')}</option>
                    {(tipos.data ?? []).map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
                    {c.tipo && !(tipos.data ?? []).some((x) => x.code === c.tipo) && <option value={c.tipo}>{c.tipo}</option>}
                  </Selector>
                  <Campo etiqueta={t('empresa.vigencia')} type="date" value={c.vigencia} onChange={(e) => set({ vigencia: e.target.value })} />
                  <Campo etiqueta={req(t('empresa.descripcion_doc'))} value={c.descripcion} onChange={(e) => set({ descripcion: e.target.value })} error={err(`certificaciones.${c.clave}.descripcion`)} className="sm:col-span-2" />
                  <ConError error={err(`certificaciones.${c.clave}.certificado`)} className="sm:col-span-2">
                    <CampoArchivo etiqueta={t('empresa.certificado')} tipos={DOCS} doc={c.certificado} alCambiar={(certificado) => set({ certificado })} deshabilitado={!editable} ayuda={t('empresa.certificado_ayuda')} />
                  </ConError>
                </div>
              )}
            />
          </Seccion>

          <Seccion id="videos">
            <Lista<Video>
              items={f.videos}
              alCambiar={(videos) => cambiar({ videos })}
              nuevo={() => ({ clave: clave(), descripcion: '', enlace: '' })}
              textoAgregar={t('empresa.agregar_video')}
              etiqueta={(i) => t('empresa.video_n', { n: i + 1 })}
              editable={editable}
              render={(v, set) => (
                <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                  <Campo etiqueta={req(t('empresa.descripcion_doc'))} value={v.descripcion} onChange={(e) => set({ descripcion: e.target.value })} error={err(`videos.${v.clave}.descripcion`)} />
                  <Campo etiqueta={req(t('empresa.enlace_video'))} type="url" placeholder="https://youtu.be/…" value={v.enlace} onChange={(e) => set({ enlace: e.target.value })} error={err(`videos.${v.clave}.enlace`)} />
                </div>
              )}
            />
          </Seccion>

          <Seccion id="registros">
            <Lista<Registro>
              items={f.registros}
              alCambiar={(registros) => cambiar({ registros })}
              nuevo={() => ({ clave: clave(), descripcion: '', doc: null })}
              textoAgregar={t('empresa.agregar_registro')}
              etiqueta={(i) => t('empresa.registro_n', { n: i + 1 })}
              editable={editable}
              render={(r, set) => (
                <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                  <Campo etiqueta={req(t('empresa.descripcion_doc'))} value={r.descripcion} onChange={(e) => set({ descripcion: e.target.value })} error={err(`registros.${r.clave}.descripcion`)} />
                  <ConError error={err(`registros.${r.clave}.doc`)}>
                    <CampoArchivo etiqueta={t('empresa.documento')} tipos={DOCS} doc={r.doc} alCambiar={(doc) => set({ doc })} deshabilitado={!editable} ayuda={t('empresa.certificado_ayuda')} />
                  </ConError>
                </div>
              )}
            />
          </Seccion>

          <Seccion id="productores">
            <Lista<Productor>
              items={f.productores}
              alCambiar={(productores) => cambiar({ productores })}
              nuevo={() => ({ clave: clave(), nombre: '', descripcion: '', cita: '', doc: null })}
              textoAgregar={t('empresa.agregar_productor')}
              etiqueta={(i) => t('empresa.productor_n', { n: i + 1 })}
              editable={editable}
              render={(p, set) => (
                <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                  <Campo etiqueta={req(t('empresa.nombre_productor'))} value={p.nombre} onChange={(e) => set({ nombre: e.target.value })} error={err(`productores.${p.clave}.nombre`)} />
                  <ConError error={err(`productores.${p.clave}.doc`)}>
                    <CampoArchivo etiqueta={t('empresa.foto_productor')} tipos={['png', 'jpg', 'jpeg']} imagen doc={p.doc} alCambiar={(doc) => set({ doc })} deshabilitado={!editable} />
                  </ConError>
                  <Area etiqueta={req(t('empresa.descripcion_doc'))} rows={3} value={p.descripcion} onChange={(e) => set({ descripcion: e.target.value })} error={err(`productores.${p.clave}.descripcion`)} />
                  <Area etiqueta={t('empresa.cita')} rows={3} value={p.cita} onChange={(e) => set({ cita: e.target.value })} error={err(`productores.${p.clave}.cita`)} />
                </div>
              )}
            />
          </Seccion>

          <Seccion id="redes">
            <div className="grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
              {REDES.map((r) => (
                <Campo key={r} etiqueta={t(`empresa.redes.${r}`)} type="url" placeholder="https://…" value={f.redes[r]} onChange={(e) => cambiar({ redes: { ...f.redes, [r]: e.target.value } })} />
              ))}
            </div>
          </Seccion>
        </fieldset>
      </div>

      {editable && tocado && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-superficie/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm text-tinta-2">{t('productores.ficha.cambios')}</p>
            <Boton onClick={() => void alGuardar()} disabled={guardar.isPending || subiendo}>
              <Icono nombre="ok" className="size-4" /> {guardar.isPending ? t('productores.ficha.guardando') : t('comun.guardar')}
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}

function Operacion({ f, cambiar, err, editable, monedas, req }: {
  f: FormEmpresa;
  cambiar: (c: Partial<FormEmpresa>) => void;
  err: (k: string) => string | undefined;
  editable: boolean;
  monedas: { id?: number; code: string; label: string }[];
  req: (texto: string) => ReactNode;
}) {
  const { t } = useTranslation();
  const activas = useQuery({ ...consultasEmpresa.cadenasActivas(), enabled: editable });
  const [elegida, setElegida] = useState('');
  const disponibles = (activas.data ?? []).filter((c) => !f.cadenas.some((x) => x.id === c.id));

  function agregar() {
    const c = disponibles.find((x) => String(x.id) === elegida);
    if (!c) return;
    cambiar({ cadenas: [...f.cadenas, c] });
    setElegida('');
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <span className="text-sm font-semibold text-tinta-2">{req(t('empresa.cadenas'))}</span>
        {f.cadenas.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label={t('empresa.cadenas')}>
            {f.cadenas.map((c) => (
              <li key={c.id} className="inline-flex items-center gap-1 rounded-full bg-marca-suave py-1 pr-1 pl-3 text-sm font-semibold text-marca">
                {c.name}
                {editable && (
                  <button type="button" onClick={() => window.confirm(t('empresa.quitar_cadena_pregunta', { cadena: c.name })) && cambiar({ cadenas: f.cadenas.filter((x) => x.id !== c.id) })} className="rounded-full p-1 hover:bg-marca/15" aria-label={t('empresa.quitar_cadena', { cadena: c.name })}>
                    <Icono nombre="cerrar" className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-tinta-3">{t('empresa.sin_cadenas')}</p>
        )}
        {err('cadenas') && <p className="text-sm text-mal" role="alert">{err('cadenas')}</p>}
        {editable && disponibles.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <Selector etiqueta={t('empresa.agregar_cadena')} value={elegida} onChange={(e) => setElegida(e.target.value)} className="min-w-0 flex-1 sm:max-w-xs">
              <option value="">{t('stock.elegir')}</option>
              {disponibles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Selector>
            <Boton variante="secundario" onClick={agregar} disabled={!elegida}>
              <Icono nombre="mas" className="size-4" /> {t('empresa.agregar')}
            </Boton>
          </div>
        )}
      </div>
      <Selector etiqueta={req(t('empresa.moneda'))} ayuda={t('empresa.moneda_ayuda')} value={f.moneda ?? ''} onChange={(e) => cambiar({ moneda: e.target.value ? Number(e.target.value) : null })} error={err('moneda')} className="sm:max-w-xs">
        <option value="">{t('stock.elegir')}</option>
        {monedas.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.label}</option>)}
      </Selector>
      <Casilla marcada={f.beyco} alCambiar={(beyco) => cambiar({ beyco })} deshabilitada={!editable}>
        <span className="font-semibold">{t('empresa.beyco')}</span>
        <span className="block text-tinta-3">{t('empresa.beyco_ayuda')}</span>
      </Casilla>
    </div>
  );
}

/** Lista editable de elementos con su número, para agregar y quitar. */
function Lista<T extends { clave: string }>({ items, alCambiar, nuevo, textoAgregar, etiqueta, editable, render }: {
  items: T[];
  alCambiar: (items: T[]) => void;
  nuevo: () => T;
  textoAgregar: string;
  etiqueta: (i: number) => string;
  editable: boolean;
  render: (item: T, set: (c: Partial<T>) => void) => ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3">
      {items.length === 0 && <p className="text-sm text-tinta-3">{t('empresa.lista_vacia')}</p>}
      {items.map((x, i) => (
        <div key={x.clave} role="group" aria-label={etiqueta(i)} className="grid gap-3 rounded-lg border border-linea p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-tinta-2">{etiqueta(i)}</span>
            {editable && (
              <button type="button" onClick={() => alCambiar(items.filter((y) => y.clave !== x.clave))} className="rounded-md p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('empresa.quitar', { que: etiqueta(i) })}>
                <Icono nombre="borrar" className="size-4" />
              </button>
            )}
          </div>
          {render(x, (c) => alCambiar(items.map((y) => (y.clave === x.clave ? { ...y, ...c } : y))))}
        </div>
      ))}
      {editable && (
        <Boton chico variante="secundario" onClick={() => alCambiar([...items, nuevo()])} className="w-fit">
          <Icono nombre="mas" className="size-4" /> {textoAgregar}
        </Boton>
      )}
    </div>
  );
}

function ConError({ error, className, children }: { error?: string; className?: string; children: ReactNode }) {
  return (
    <div className={'grid content-start gap-1.5 ' + (className ?? '')}>
      {children}
      {error && <p className="text-sm text-mal" role="alert">{error}</p>}
    </div>
  );
}

function Seccion({ id, children }: { id: Seccion; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-24 rounded-caja border border-linea bg-superficie p-5 shadow-suave sm:p-6">
      <h2 id={`${id}-titulo`} className="font-titulo text-xl font-semibold">{t(`empresa.secciones.${id}`)}</h2>
      {t(`empresa.ayudas.${id}`, { defaultValue: '' }) && <p className="mt-1 text-sm text-tinta-2">{t(`empresa.ayudas.${id}`)}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
