import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { POR_PAGINA_CONOCIMIENTO, conocimiento, useBorrarEntrada, useGuardarEntrada } from '@/api/conocimiento';
import { subirDocumento } from '@/api/productores';
import { urlDocumento } from '@/api/respuesta';
import { Boton } from '@/componentes/ui/Boton';
import { Area, Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { HtmlSeguro } from '@/componentes/ui/HtmlSeguro';
import { Icono } from '@/componentes/ui/Icono';
import { MAXIMOS, TEMAS, armarEntrada, enlaceValido, entradaVacia, formDesdeEntrada, normalizarEnlace, sinErroresEntrada, validarEntrada, type ErroresEntrada, type FormEntrada, type Tema } from '@/util/conocimiento';
import { useAdministraEmpresas, useProducto } from './Marco';
import { Tarjeta } from './piezas';

const TIPOS_DOC = ['pdf', 'png', 'jpg', 'jpeg'];

/**
 * Base de conocimiento del producto: entradas sobre equidad, calidad y origen, con documentos y un
 * video. La administra la empresa dueña (o la administración del sistema).
 */
export function ConocimientoProducto() {
  const { t } = useTranslation();
  const { producto, editable } = useProducto();
  const { sistema } = useAdministraEmpresas();
  const puede = editable || sistema;
  const qc = useQueryClient();
  const [tema, setTema] = useState<Tema | undefined>();
  const [pagina, setPagina] = useState(1);
  const lista = useQuery({ ...conocimiento.lista(producto.id!, { tema, pagina }), enabled: puede });
  const borrar = useBorrarEntrada();
  const [editando, setEditando] = useState<FormEntrada | null>(null);
  const [abriendo, setAbriendo] = useState<number | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok'; texto: string } | null>(null);
  const terminar = (texto?: string) => {
    setEditando(null);
    if (texto) setAviso({ tono: 'ok', texto });
  };

  async function abrir(id: number) {
    setAviso(null);
    setAbriendo(id);
    try {
      setEditando(formDesdeEntrada(await qc.fetchQuery(conocimiento.entrada(id))));
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    } finally {
      setAbriendo(null);
    }
  }

  async function eliminar(id: number, titulo: string) {
    if (!window.confirm(t('productos.conocimiento.borrar_pregunta', { titulo }))) return;
    setAviso(null);
    try {
      await borrar.mutateAsync(id);
      setAviso({ tono: 'ok', texto: t('productos.conocimiento.borrada', { titulo }) });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  if (!puede) return <Aviso tono="info">{t('productos.conocimiento.sin_permiso')}</Aviso>;

  const items = lista.data?.items ?? [];
  const total = lista.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_CONOCIMIENTO));
  const filtro = (activo: boolean) => clsx('h-9 rounded-lg px-3 text-sm font-semibold', activo ? 'bg-marca text-sobre-marca' : 'bg-superficie-2 text-tinta-2 hover:text-tinta');
  const filtrar = (x?: Tema) => {
    setTema(x);
    setPagina(1);
  };

  return (
    <div className="grid gap-5">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <Tarjeta
        id="conocimiento"
        titulo={t('productos.conocimiento.titulo')}
        ayuda={t('productos.conocimiento.ayuda')}
        acciones={!editando && (
          <Boton chico onClick={() => { setAviso(null); setEditando(entradaVacia()); }}>
            <Icono nombre="mas" className="size-4" /> {t('productos.conocimiento.nueva')}
          </Boton>
        )}
      >
        {editando && !editando.id && <FormularioEntrada producto={producto.id!} inicial={editando} alTerminar={terminar} />}
        <div role="group" aria-label={t('productos.conocimiento.filtro')} className="mb-4 flex flex-wrap gap-2">
          <button type="button" aria-pressed={!tema} className={filtro(!tema)} onClick={() => filtrar(undefined)}>{t('productos.conocimiento.todas')}</button>
          {TEMAS.map((x) => (
            <button key={x} type="button" aria-pressed={tema === x} className={filtro(tema === x)} onClick={() => filtrar(x)}>{t(`productos.conocimiento.temas.${x}`)}</button>
          ))}
        </div>
        {lista.isPending ? (
          <Cargando />
        ) : lista.isError ? (
          <EstadoError texto={lista.error.message} reintentar={() => void lista.refetch()} />
        ) : items.length === 0 ? (
          <p className="text-sm text-tinta-3">{tema ? t('productos.conocimiento.sin_resultados') : t('productos.conocimiento.vacio')}</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-tinta-2">{t('productos.conocimiento.total', { count: total })}</p>
            <ul className="grid gap-3">
              {items.map((e) =>
                editando?.id === e.id ? (
                  <li key={e.id}><FormularioEntrada producto={producto.id!} inicial={editando!} alTerminar={terminar} /></li>
                ) : (
                  <li key={e.id} aria-label={e.title || `#${e.id}`} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-linea p-4">
                    <div className="grid min-w-0 gap-1">
                      <p className="font-semibold break-words">{e.title || <span className="text-tinta-3">{t('productos.conocimiento.sin_titulo')}</span>}</p>
                      <p className="flex flex-wrap items-center gap-2 text-sm text-tinta-2">
                        {e.type && <span className="rounded-full bg-marca-suave px-2 py-0.5 text-xs font-semibold text-marca">{t(`productos.conocimiento.temas.${e.type}`)}</span>}
                        {e.date && <span>{e.date}</span>}
                        {e.youtubeUrl && <span className="inline-flex items-center gap-1"><Icono nombre="externo" className="size-3.5" /> {t('productos.conocimiento.con_video')}</span>}
                      </p>
                    </div>
                    {!editando && (
                      <div className="flex gap-1">
                        <Boton chico variante="fantasma" onClick={() => void abrir(e.id!)} disabled={abriendo !== null}>
                          <Icono nombre="editar" className="size-4" /> {abriendo === e.id ? t('comun.cargando') : t('comun.editar')}
                        </Boton>
                        <Boton chico variante="fantasma" onClick={() => void eliminar(e.id!, e.title || `#${e.id}`)} disabled={borrar.isPending} aria-label={t('productos.conocimiento.borrar', { titulo: e.title || `#${e.id}` })}>
                          <Icono nombre="borrar" className="size-4" />
                        </Boton>
                      </div>
                    )}
                  </li>
                ),
              )}
            </ul>
            {paginas > 1 && (
              <nav aria-label={t('productos.lotes.paginas')} className="mt-4 flex items-center justify-end gap-2 text-sm">
                <Boton chico variante="secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} aria-label={t('productos.lotes.anterior')}><Icono nombre="izquierda" className="size-4" /></Boton>
                <span>{pagina} / {paginas}</span>
                <Boton chico variante="secundario" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)} aria-label={t('productos.lotes.siguiente')}><Icono nombre="derecha" className="size-4" /></Boton>
              </nav>
            )}
          </>
        )}
      </Tarjeta>
    </div>
  );
}

function FormularioEntrada({ producto, inicial, alTerminar }: { producto: number; inicial: FormEntrada; alTerminar: (texto?: string) => void }) {
  const { t } = useTranslation();
  const guardar = useGuardarEntrada(producto);
  const [f, setF] = useState(inicial);
  const [errores, setErrores] = useState<ErroresEntrada>({});
  const [error, setError] = useState<string | null>(null);
  const [previa, setPrevia] = useState(false);
  const cambiar = (c: Partial<FormEntrada>) => setF((x) => ({ ...x, ...c }));
  const msg = (k?: string, max?: number) => (k ? t(`productos.conocimiento.errores.${k}`, { max, defaultValue: t(`stock.errores.${k}`) }) : undefined);
  const contador = (texto: string, max: number) => t('productos.caracteres', { n: texto.trim().length, max });

  async function alGuardar() {
    setError(null);
    const e = validarEntrada(f);
    setErrores(e);
    if (!sinErroresEntrada(e)) return;
    try {
      await guardar.mutateAsync(armarEntrada(f));
      alTerminar(t('productos.conocimiento.guardada', { titulo: f.titulo.trim() }));
    } catch (x) {
      setError((x as Error).message);
    }
  }

  return (
    <div role="group" aria-label={f.id ? t('productos.conocimiento.editar') : t('productos.conocimiento.nueva')} className="mb-4 grid gap-4 rounded-lg border border-marca/40 bg-marca-suave/30 p-4">
      {error && <Aviso tono="mal">{error}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr_10rem] [&>*]:min-w-0">
        {f.id ? (
          <div className="grid content-start gap-1.5">
            <span className="text-sm font-semibold text-tinta-2">{t('productos.conocimiento.tema')}</span>
            <p className="flex h-11 items-center">{f.tema && t(`productos.conocimiento.temas.${f.tema}`)}</p>
            <p className="text-sm text-tinta-3">{t('productos.conocimiento.tema_fijo')}</p>
          </div>
        ) : (
          <Selector etiqueta={t('productos.conocimiento.tema')} value={f.tema} onChange={(e) => cambiar({ tema: e.target.value as Tema | '' })} error={msg(errores.tema)}>
            <option value="">{t('stock.elegir')}</option>
            {TEMAS.map((x) => <option key={x} value={x}>{t(`productos.conocimiento.temas.${x}`)}</option>)}
          </Selector>
        )}
        <Campo etiqueta={t('productos.conocimiento.titulo_entrada')} value={f.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} error={msg(errores.titulo, MAXIMOS.titulo)} />
        <Campo etiqueta={t('productos.conocimiento.fecha')} type="date" value={f.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} />
      </div>
      <Area etiqueta={t('productos.conocimiento.resumen')} rows={4} value={f.resumen} onChange={(e) => cambiar({ resumen: e.target.value })} error={msg(errores.resumen, MAXIMOS.resumen)} ayuda={contador(f.resumen, MAXIMOS.resumen)} />
      <Area etiqueta={t('productos.conocimiento.contenido')} rows={8} value={f.contenido} onChange={(e) => cambiar({ contenido: e.target.value })} error={msg(errores.contenido, MAXIMOS.contenido)} ayuda={`${contador(f.contenido, MAXIMOS.contenido)} · ${t('productos.conocimiento.html')}`} />
      <Campo etiqueta={t('productos.conocimiento.video')} type="url" inputMode="url" placeholder="https://youtu.be/…" value={f.video} onChange={(e) => cambiar({ video: e.target.value })} error={msg(errores.video, MAXIMOS.video)} ayuda={t('productos.conocimiento.video_ayuda')} />
      <Documentos docs={f.documentos} alCambiar={(documentos) => cambiar({ documentos })} />

      <div className="flex flex-wrap gap-2">
        <Boton onClick={() => void alGuardar()} disabled={guardar.isPending}>
          <Icono nombre="ok" className="size-4" /> {guardar.isPending ? t('productores.ficha.guardando') : t('comun.guardar')}
        </Boton>
        <Boton variante="secundario" onClick={() => alTerminar()}>{t('comun.cancelar')}</Boton>
        <Boton variante="fantasma" onClick={() => setPrevia((v) => !v)} aria-expanded={previa}>
          <Icono nombre="lista" className="size-4" /> {previa ? t('productos.conocimiento.ocultar_previa') : t('productos.conocimiento.ver_previa')}
        </Boton>
      </div>
      {previa && <VistaPrevia f={f} />}
    </div>
  );
}

/** Documentos adjuntos (PDF o imagen), en el orden en que se suben. */
function Documentos({ docs, alCambiar }: { docs: FormEntrada['documentos']; alCambiar: (d: FormEntrada['documentos']) => void }) {
  const { t } = useTranslation();
  const [estado, setEstado] = useState<{ subiendo?: boolean; error?: string }>({});

  async function subir(archivos: File[]) {
    if (!archivos.length) return;
    const malo = archivos.find((a) => !TIPOS_DOC.includes(a.name.split('.').pop()?.toLowerCase() ?? ''));
    if (malo) {
      setEstado({ error: t('productos.vitrina.archivo_tipo', { tipos: TIPOS_DOC.join(', ').toUpperCase() }) });
      return;
    }
    setEstado({ subiendo: true });
    try {
      const nuevos = [];
      for (const a of archivos) nuevos.push(await subirDocumento(a));
      alCambiar([...docs, ...nuevos]);
      setEstado({});
    } catch (e) {
      setEstado({ error: (e as Error).message });
    }
  }

  return (
    <div className="grid content-start gap-1.5">
      <span className="text-sm font-semibold text-tinta-2">{t('productos.conocimiento.documentos')}</span>
      {docs.length > 0 && (
        <ul className="grid gap-2">
          {docs.map((d, i) => (
            <li key={d.storageKey ?? d.id ?? i} className="flex items-center justify-between gap-2 rounded-lg border border-linea bg-superficie px-3 py-2 text-sm">
              <a href={urlDocumento(d.storageKey)} target="_blank" rel="noreferrer" className="min-w-0 truncate text-marca hover:underline">{d.name ?? d.storageKey}</a>
              <button type="button" onClick={() => alCambiar(docs.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('productos.vitrina.quitar', { que: d.name ?? d.storageKey })}>
                <Icono nombre="borrar" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-linea-fuerte px-3 text-sm font-semibold text-tinta-2 hover:border-marca hover:text-marca">
        <Icono nombre="subir" className="size-4" /> {estado.subiendo ? t('comun.cargando') : t('productos.conocimiento.agregar_documento')}
        <input type="file" multiple accept={TIPOS_DOC.map((x) => '.' + x).join(',')} className="sr-only" aria-label={t('productos.conocimiento.documentos')} onChange={(e) => { void subir([...(e.target.files ?? [])]); e.target.value = ''; }} />
      </label>
      {estado.error ? <p className="text-sm text-mal" role="alert">{estado.error}</p> : <p className="text-sm text-tinta-3">{t('productos.conocimiento.documentos_ayuda')}</p>}
    </div>
  );
}

/** Cómo se lee la entrada, con el HTML saneado. */
function VistaPrevia({ f }: { f: FormEntrada }) {
  const { t } = useTranslation();
  // Solo enlaces http(s): lo guardado pudo llegar por la API sin pasar por esta validación.
  const video = enlaceValido(f.video) ? normalizarEnlace(f.video) : '';
  return (
    <article aria-label={t('productos.conocimiento.previa')} className="grid gap-4 rounded-lg border border-linea bg-superficie p-5">
      <header>
        {f.tema && <p className="text-xs font-semibold tracking-wide text-marca uppercase">{t(`productos.conocimiento.temas.${f.tema}`)}</p>}
        <h3 className="mt-1 font-titulo text-2xl font-semibold break-words">{f.titulo.trim() || t('productos.conocimiento.sin_titulo')}</h3>
        {f.fecha && <p className="mt-1 text-sm text-tinta-3">{f.fecha}</p>}
      </header>
      {f.resumen.trim() && <HtmlSeguro html={f.resumen} className="font-semibold" />}
      {f.contenido.trim() && <HtmlSeguro html={f.contenido} />}
      {(video || f.documentos.length > 0) && (
        <ul className="grid gap-1 text-sm">
          {video && <li><a href={video} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-marca hover:underline"><Icono nombre="externo" className="size-4" /> {t('productos.conocimiento.ver_video')}</a></li>}
          {f.documentos.map((d, i) => (
            <li key={d.storageKey ?? i}><a href={urlDocumento(d.storageKey)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-marca hover:underline"><Icono nombre="descarga" className="size-4" /> {d.name ?? d.storageKey}</a></li>
          ))}
        </ul>
      )}
    </article>
  );
}
