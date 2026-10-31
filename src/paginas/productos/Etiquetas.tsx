import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, getRouteApi, useBlocker, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { etiquetas, useBorrarEtiqueta, useCrearEtiqueta, useGuardarEtiqueta, usePublicarEtiqueta } from '@/api/etiquetas';
import type { ApiProductLabel, ApiProductLabelCompanyDocument, ApiProductLabelContent } from '@/api/gen/types.gen';
import { urlDocumento } from '@/api/respuesta';
import { Boton, clasesBoton } from '@/componentes/ui/Boton';
import { Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import {
  CAMPOS_ETIQUETA, MEDIOS, armarCampos, armarVistaPrevia, guardarVistaPrevia, idVistaPrevia, validarMedios, visiblesDesde,
  type CategoriaMedio, type Visibles,
} from '@/util/etiqueta';
import { IDIOMAS, SECCIONES, armarContenido, formDesdeProducto, seccionesConError, sinErroresProducto, validarProducto, type ErroresProducto, type FormProducto } from '@/util/producto';
import { armarVitrina, formDesdeVitrina, validarVitrina, type ErroresVitrina, type FormVitrina } from '@/util/vitrinaProducto';
import { CamposFicha, ConVisibilidad, type Visibilidad } from './Ficha';
import { useProducto } from './Marco';
import { BarraGuardar, Casilla, Tarjeta } from './piezas';
import { EditorVitrina } from './Vitrina';

type Idioma = NonNullable<ApiProductLabel['language']>;
const rutaEditor = getRouteApi('/portal/productos/$id/etiquetas/$etiqueta');

export function Estado({ publicada }: { publicada: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', publicada ? 'bg-ok-suave text-ok' : 'bg-superficie-2 text-tinta-2')}>
      <span className={clsx('size-1.5 rounded-full', publicada ? 'bg-ok' : 'bg-tinta-3')} />
      {publicada ? t('productos.etiquetas.publicada') : t('productos.etiquetas.sin_publicar')}
    </span>
  );
}

/** Pestaña "Etiquetas": las vitrinas del producto (cada QR abre una). */
export function EtiquetasProducto() {
  const { t, i18n } = useTranslation();
  const { producto, editable } = useProducto();
  const lista = useQuery(etiquetas.lista(producto.id!));
  const crear = useCrearEtiqueta(producto.id!);
  const navegar = useNavigate();
  const delUsuario = i18n.language.slice(0, 2).toUpperCase() as Idioma;
  const [nueva, setNueva] = useState<{ titulo: string; idioma: Idioma } | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alCrear() {
    setEnviado(true);
    setError(null);
    if (!nueva?.titulo.trim()) return;
    try {
      const id = await crear.mutateAsync({ titulo: nueva.titulo.trim(), idioma: nueva.idioma });
      await navegar({ to: '/productos/$id/etiquetas/$etiqueta', params: { id: String(producto.id), etiqueta: String(id) } });
    } catch (x) {
      setError((x as Error).message);
    }
  }

  const items = lista.data ?? [];
  return (
    <Tarjeta
      id="etiquetas"
      titulo={t('productos.etiquetas.titulo')}
      ayuda={t('productos.etiquetas.ayuda')}
      acciones={editable && !nueva && (
        <Boton chico onClick={() => { setEnviado(false); setNueva({ titulo: '', idioma: producto.settings?.language ?? ((IDIOMAS as string[]).includes(delUsuario) ? delUsuario : 'EN') }); }}>
          <Icono nombre="mas" className="size-4" /> {t('productos.etiquetas.nueva')}
        </Boton>
      )}
    >
      {nueva && (
        <div role="group" aria-label={t('productos.etiquetas.nueva')} className="mb-4 grid gap-4 rounded-lg border border-marca/40 bg-marca-suave/30 p-4">
          {error && <Aviso tono="mal">{error}</Aviso>}
          <p className="text-sm text-tinta-2">{t('productos.etiquetas.nueva_ayuda')}</p>
          <div className="grid gap-4 sm:grid-cols-[1fr_14rem] [&>*]:min-w-0">
            <Campo etiqueta={t('productos.etiquetas.nombre')} value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} error={enviado && !nueva.titulo.trim() && t('stock.errores.requerido')} placeholder={t('productos.etiquetas.nombre_placeholder')} />
            <Selector etiqueta={t('productos.etiquetas.idioma')} value={nueva.idioma} onChange={(e) => setNueva({ ...nueva, idioma: e.target.value as Idioma })}>
              {IDIOMAS.map((i) => <option key={i} value={i}>{t(`productos.idiomas.${i}`)}</option>)}
            </Selector>
          </div>
          <div className="flex gap-2">
            <Boton onClick={() => void alCrear()} disabled={crear.isPending}>
              <Icono nombre="ok" className="size-4" /> {crear.isPending ? t('productores.ficha.guardando') : t('productos.etiquetas.crear')}
            </Boton>
            <Boton variante="secundario" onClick={() => setNueva(null)}>{t('comun.cancelar')}</Boton>
          </div>
        </div>
      )}
      {lista.isPending ? (
        <Cargando />
      ) : lista.isError ? (
        <EstadoError texto={lista.error.message} reintentar={() => void lista.refetch()} />
      ) : items.length === 0 ? (
        <p className="text-sm text-tinta-3">{t('productos.etiquetas.vacio')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((e) => (
            <li key={e.id} aria-label={e.title || `#${e.id}`} className="grid gap-3 rounded-lg border border-linea p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link to="/productos/$id/etiquetas/$etiqueta" params={{ id: String(producto.id), etiqueta: String(e.id) }} className="font-semibold hover:text-marca hover:underline">
                  {e.title || `#${e.id}`}
                </Link>
                <Estado publicada={e.status === 'PUBLISHED'} />
              </div>
              <p className="text-sm text-tinta-2">{e.language ? t(`productos.idiomas.${e.language}`) : '—'}</p>
              {e.status === 'PUBLISHED' && e.uuid && (
                <a href={`${import.meta.env.BASE_URL}p-cd/${e.uuid}/EMPTY`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-sm font-semibold text-marca hover:underline">
                  {t('productos.etiquetas.ver_publica')} <Icono nombre="externo" className="size-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

/** Editor de una etiqueta. */
export function EditorEtiqueta() {
  const id = Number(rutaEditor.useParams().etiqueta);
  const etiqueta = useQuery(etiquetas.etiqueta(id));
  const contenido = useQuery(etiquetas.contenido(id));
  const medios = useQuery(etiquetas.medios(id));
  const consultas = [etiqueta, contenido, medios];
  const fallida = consultas.find((c) => c.isError);
  if (fallida) return <EstadoError texto={fallida.error!.message} reintentar={() => consultas.forEach((c) => void c.refetch())} />;
  if (!etiqueta.data || !contenido.data || !medios.data) return <Cargando />;
  return <FormEtiqueta key={id} etiqueta={etiqueta.data} contenido={contenido.data} medios={medios.data} />;
}

const SECCIONES_EXTRA = ['empresa', 'apariencia', 'pestanas', 'precios', 'recorrido', 'medios'] as const;

function FormEtiqueta({ etiqueta, contenido, medios: mediosIniciales }: { etiqueta: ApiProductLabel; contenido: ApiProductLabelContent; medios: ApiProductLabelCompanyDocument[] }) {
  const { t } = useTranslation();
  const { producto, editable } = useProducto();
  const navegar = useNavigate();
  const guardar = useGuardarEtiqueta(producto.id!);
  const publicar = usePublicarEtiqueta(producto.id!);
  const borrar = useBorrarEtiqueta(producto.id!);
  const [titulo, setTitulo] = useState(etiqueta.title ?? '');
  const [visibles, setVisibles] = useState<Visibles>(() => visiblesDesde(etiqueta));
  const [f, setF] = useState<FormProducto>(() => formDesdeProducto(contenido));
  const [vitrina, setVitrina] = useState<FormVitrina>(() => formDesdeVitrina(contenido));
  const [medios, setMedios] = useState(mediosIniciales);
  const [mediosTocados, setMediosTocados] = useState(false);
  const [tocado, setTocado] = useState(false);
  const [errores, setErrores] = useState<{ ficha: ErroresProducto; vitrina: ErroresVitrina; medios: string | null; titulo: boolean }>({ ficha: { puntos: {} }, vitrina: {}, medios: null, titulo: false });
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok' | 'info'; texto: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const publicada = etiqueta.status === 'PUBLISHED';
  const tocar = () => setTocado(true);
  const visibilidad: Visibilidad = { visibles, alternar: (campo, v) => { setVisibles((x) => ({ ...x, [campo]: v })); tocar(); } };
  const conError = seccionesConError(errores.ficha);
  const nombre = titulo.trim() || `#${etiqueta.id}`;

  useBlocker({ shouldBlockFn: () => tocado && !guardar.isPending && !borrar.isPending && !window.confirm(t('stock.entrega.salir_sin_guardar')), enableBeforeUnload: () => tocado });

  /** El contenido tal como quedaría con lo que hay en el editor. */
  const contenidoNuevo = () => armarVitrina(vitrina, armarContenido(f, contenido));

  async function alGuardar() {
    setAviso(null);
    const e = { ficha: validarProducto(f), vitrina: validarVitrina(vitrina), medios: validarMedios(medios), titulo: !titulo.trim() };
    setErrores(e);
    if (!sinErroresProducto(e.ficha) || Object.keys(e.vitrina).length || e.medios || e.titulo) {
      setAviso({ tono: 'mal', texto: t('stock.entrega.revisar') });
      return;
    }
    try {
      await guardar.mutateAsync({
        etiqueta: { ...etiqueta, title: titulo.trim(), fields: armarCampos(visibles, etiqueta.fields) },
        contenido: contenidoNuevo(),
        medios: mediosTocados ? medios : null,
      });
      setTocado(false);
      setMediosTocados(false);
      setAviso({ tono: 'ok', texto: t('productos.etiquetas.guardada') });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  function vistaPrevia() {
    guardarVistaPrevia(armarVistaPrevia({ etiqueta, titulo: nombre, contenido: contenidoNuevo(), visibles, aparienciaProducto: producto.businessToCustomerSettings, medios, producto: producto.id! }));
    window.open(`${import.meta.env.BASE_URL}p-cd/${idVistaPrevia(etiqueta.id!)}/EMPTY`, '_blank', 'noopener');
  }

  async function alternarPublicacion() {
    setAviso(null);
    try {
      await publicar.mutateAsync({ id: etiqueta.id!, publicar: !publicada });
      setAviso({ tono: 'ok', texto: publicada ? t('productos.etiquetas.retirada') : t('productos.etiquetas.publicada_ok') });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  async function eliminar() {
    if (!window.confirm(t('productos.etiquetas.borrar_pregunta', { nombre }))) return;
    try {
      await borrar.mutateAsync(etiqueta.id!);
      setTocado(false);
      await navegar({ to: '/productos/$id/etiquetas', params: { id: String(producto.id) } });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  useEffect(() => {
    document.title = `${nombre} · ${producto.name} · INATrace v2`;
  }, [nombre, producto.name]);

  return (
    <div className="grid gap-6">
      <section aria-label={t('productos.etiquetas.cabecera')} className="grid gap-4 rounded-caja border border-linea bg-superficie p-5 shadow-suave sm:p-6">
        <Campo etiqueta={t('productos.etiquetas.nombre')} value={titulo} onChange={(e) => { setTitulo(e.target.value); tocar(); }} disabled={!editable} error={errores.titulo && t('stock.errores.requerido')} className="sm:max-w-lg" />
        <div className="flex flex-wrap gap-2">
          <Boton chico variante="secundario" onClick={vistaPrevia}>
            <Icono nombre="externo" className="size-4" /> {t('productos.etiquetas.vista_previa')}
          </Boton>
          {publicada && etiqueta.uuid && (
            <a href={`${import.meta.env.BASE_URL}p-cd/${etiqueta.uuid}/EMPTY`} target="_blank" rel="noopener" className={clasesBoton('secundario', true)}>
              <Icono nombre="qr" className="size-4" /> {t('productos.etiquetas.ver_publica')}
            </a>
          )}
          {editable && (
            <Boton chico variante={publicada ? 'secundario' : 'primario'} onClick={() => void alternarPublicacion()} disabled={tocado || publicar.isPending} title={tocado ? t('productos.etiquetas.guarda_antes') : undefined}>
              <Icono nombre={publicada ? 'cerrar' : 'ok'} className="size-4" /> {publicada ? t('productos.etiquetas.retirar') : t('productos.etiquetas.publicar')}
            </Boton>
          )}
          {editable && (
            <Boton chico variante="peligro" onClick={() => void eliminar()} disabled={borrar.isPending}>
              <Icono nombre="borrar" className="size-4" /> {t('productos.etiquetas.borrar')}
            </Boton>
          )}
        </div>
        {editable && tocado && <p className="text-sm text-tinta-3">{t('productos.etiquetas.guarda_antes')}</p>}
      </section>

      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <p className="text-sm text-tinta-2">{t('productos.etiquetas.editor_ayuda')}</p>

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <nav aria-label={t('productos.indice')} className="hidden lg:block">
          <ul className="sticky top-24 grid gap-0.5 text-sm">
            {[...SECCIONES, ...SECCIONES_EXTRA].map((s) => (
              <li key={s}>
                <a href={`#${s}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-tinta-2 hover:bg-superficie-2 hover:text-tinta">
                  {(SECCIONES as readonly string[]).includes(s) ? t(`productos.secciones.${s}`) : t(`productos.etiquetas.secciones.${s}`)}
                  {((conError as Set<string>).has(s) || (s === 'medios' && errores.medios)) && <span className="size-2 rounded-full bg-mal" aria-label={t('productores.ficha.con_errores')} />}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid min-w-0 gap-6">
          <CamposFicha f={f} cambiar={(c) => { setF((x) => ({ ...x, ...c })); tocar(); }} errores={errores.ficha} editable={editable} nombre={nombre} visibilidad={visibilidad} alAvisar={(texto) => setAviso({ tono: 'mal', texto })} alSubir={setSubiendo} />
          <EmpresaEtiqueta contenido={contenido} visibilidad={visibilidad} editable={editable} />
          <EditorVitrina f={vitrina} cambiar={(c) => { setVitrina((x) => ({ ...x, ...c })); tocar(); }} errores={errores.vitrina} editable={editable} visibilidad={visibilidad} />
          <Medios medios={medios} error={errores.medios} editable={editable} alCambiar={(m) => { setMedios(m); setMediosTocados(true); tocar(); }} />
        </div>
      </div>

      {editable && tocado && <BarraGuardar texto={t('productores.ficha.cambios')} guardando={guardar.isPending} alGuardar={() => void alGuardar()} deshabilitado={subiendo} />}
    </div>
  );
}

/** Datos de la empresa dueña: se editan en la ficha de la empresa; aquí solo se elige qué mostrar. */
function EmpresaEtiqueta({ contenido, visibilidad, editable }: { contenido: ApiProductLabelContent; visibilidad: Visibilidad; editable: boolean }) {
  const { t } = useTranslation();
  const c = contenido.company ?? {};
  const sede = c.headquarters;
  const direccion = [sede?.address, sede?.city, sede?.state, sede?.zip, sede?.country?.name].filter(Boolean).join(', ');
  const valor = (campo: string): ReactNode => {
    switch (campo) {
      case 'company.logo':
        return c.logo?.storageKey ? <img src={urlDocumento(c.logo.storageKey)} alt={t('productos.etiquetas.empresa.logo')} className="h-14 w-auto rounded border border-linea bg-superficie-2" /> : null;
      case 'company.headquarters':
        return direccion || null;
      default: {
        const v = campo.startsWith('company.mediaLinks.') ? c.mediaLinks?.[campo.split('.').pop()!] : (c as Record<string, unknown>)[campo.split('.')[1]!];
        return typeof v === 'string' && v.trim() ? v : null;
      }
    }
  };
  return (
    <Tarjeta id="empresa" titulo={t('productos.etiquetas.secciones.empresa')} ayuda={t('productos.etiquetas.empresa.ayuda')}>
      <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        {CAMPOS_ETIQUETA.filter((x) => x.seccion === 'company').map(({ nombre }) => {
          const texto = t(`productos.etiquetas.empresa.${nombre.split('.').pop()}`);
          const v = valor(nombre);
          return (
            <ConVisibilidad key={nombre} campo={nombre} texto={texto} v={visibilidad} className="rounded-lg border border-linea p-3">
              <span className="text-sm font-semibold text-tinta-2">{texto}</span>
              <span className="break-words text-sm">{v ?? <span className="text-tinta-3">{t('productos.etiquetas.empresa.vacio')}</span>}</span>
            </ConVisibilidad>
          );
        })}
      </fieldset>
    </Tarjeta>
  );
}

/** Videos, fotos de productores y registros de producción de las empresas de la cadena. */
function Medios({ medios, error, editable, alCambiar }: { medios: ApiProductLabelCompanyDocument[]; error: string | null; editable: boolean; alCambiar: (m: ApiProductLabelCompanyDocument[]) => void }) {
  const { t } = useTranslation();
  const grupos = useMemo(() => MEDIOS.map((c) => [c, medios.filter((m) => m.category === c)] as [CategoriaMedio, ApiProductLabelCompanyDocument[]]), [medios]);
  return (
    <Tarjeta id="medios" titulo={t('productos.etiquetas.secciones.medios')} ayuda={t('productos.etiquetas.medios.ayuda')}>
      {error && <div className="mb-4"><Aviso tono="mal">{t(`productos.etiquetas.medios.${error}`)}</Aviso></div>}
      {medios.length === 0 ? (
        <p className="text-sm text-tinta-3">{t('productos.etiquetas.medios.vacio')}</p>
      ) : (
        <div className="grid gap-5">
          {grupos.filter(([, l]) => l.length).map(([c, lista]) => (
            <fieldset key={c} className="grid gap-2">
              <legend className="mb-1 text-sm font-semibold text-tinta-2">{t(`productos.etiquetas.medios.${c}`)}</legend>
              {lista.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <Casilla marcada={!!m.active} deshabilitada={!editable} alCambiar={(v) => alCambiar(medios.map((x) => (x.id === m.id ? { ...x, active: v } : x)))}>
                    {m.name || m.description || `#${m.id}`}
                  </Casilla>
                  {m.type === 'LINK' && m.link ? (
                    <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-tinta-3 hover:text-marca" aria-label={t('productos.etiquetas.medios.abrir', { nombre: m.name ?? '' })}>
                      <Icono nombre="externo" className="size-4" />
                    </a>
                  ) : m.document?.storageKey ? (
                    <a href={urlDocumento(m.document.storageKey)} target="_blank" rel="noopener" className="text-tinta-3 hover:text-marca" aria-label={t('productos.etiquetas.medios.abrir', { nombre: m.name ?? '' })}>
                      <Icono nombre="externo" className="size-4" />
                    </a>
                  ) : null}
                </div>
              ))}
            </fieldset>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}
