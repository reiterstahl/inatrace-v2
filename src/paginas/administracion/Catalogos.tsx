import { useDeferredValue, useState } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { catalogos, useBorrarItem, useGuardarItem } from '@/api/catalogos';
import { consultas } from '@/api/consultas';
import type { ApiMeasureUnitType } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Area, Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import {
  CATALOGOS, FORMA, IDIOMAS_CATALOGO, armarItem, codigoItem, formDesdeItem, nombreItem, permisosCatalogo, validarCatalogo,
  type Catalogo, type ErroresCatalogo, type FormCatalogo, type ItemCatalogo,
} from '@/util/catalogos';
import { Casilla, Tarjeta } from '../productos/piezas';

const ruta = getRouteApi('/portal/administracion/catalogos');
const OBLIGATORIO = <span className="text-mal" aria-hidden> *</span>;
type AvisoPantalla = { tono: 'ok' | 'mal'; texto: string } | null;

/** Detalle corto de cada elemento en la lista, según el catálogo. */
function detalle(cat: Catalogo, x: ItemCatalogo, t: (k: string) => string) {
  const r = x as Record<string, unknown>;
  if (cat === 'semiproductos') return (r.measurementUnitType as ApiMeasureUnitType | undefined)?.label ?? '';
  if (cat === 'unidades') return r.weight != null ? `${r.weight} kg` : '';
  if (cat === 'tipos-evidencia' || cat === 'campos-evidencia') return r.type ? t(`administracion.catalogos.tipos.${r.type}`) : '';
  return '';
}

/**
 * Catálogos del sistema: semiproductos, tipos de producto, tipos de instalación, unidades de medida y
 * tipos y campos de evidencia de procesamiento. La regional puede crear; editar y borrar es de la
 * administración del sistema (como el backend).
 */
export function CatalogosAdministracion() {
  const { t, i18n } = useTranslation();
  const { tipo: cat } = ruta.useSearch();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const permisos = permisosCatalogo(yo.role);
  const consulta = useQuery(catalogos.lista(cat, i18n.language));
  const borrar = useBorrarItem(cat);
  const [texto, setTexto] = useState('');
  const filtro = useDeferredValue(texto.trim().toLowerCase());
  const [editando, setEditando] = useState<ItemCatalogo | 'nuevo' | null>(null);
  const [aviso, setAviso] = useState<AvisoPantalla>(null);
  const items = (consulta.data ?? [])
    .filter((x) => !filtro || [nombreItem(x), codigoItem(x)].some((v) => v.toLowerCase().includes(filtro)))
    .sort((a, b) => nombreItem(a).localeCompare(nombreItem(b)));

  async function eliminar(x: ItemCatalogo) {
    const nombre = nombreItem(x);
    if (!window.confirm(t('administracion.catalogos.borrar_pregunta', { nombre }))) return;
    setAviso(null);
    try {
      await borrar.mutateAsync(x.id!);
      setAviso({ tono: 'ok', texto: t('administracion.catalogos.borrado', { nombre }) });
    } catch {
      // En uso: el backend responde un 500 genérico o, con H31, un 400 en inglés. Se explica en el idioma de la interfaz.
      setAviso({ tono: 'mal', texto: t('administracion.catalogos.no_se_borra', { nombre }) });
    }
  }

  return (
    <div className="grid gap-5">
      <nav aria-label={t('administracion.catalogos.titulo')} className="flex flex-wrap gap-2">
        {CATALOGOS.map((c) => (
          <Link
            key={c}
            to="/administracion/catalogos"
            search={{ tipo: c }}
            onClick={() => { setEditando(null); setAviso(null); setTexto(''); }}
            className="inline-flex h-9 items-center rounded-full border border-linea px-3.5 text-sm font-semibold text-tinta-2 hover:bg-superficie-2"
            activeOptions={{ includeSearch: true }}
            activeProps={{ className: '!border-marca-suave bg-marca-suave !text-marca', 'aria-current': 'page' }}
          >
            {t(`administracion.catalogos.nombres.${c}`)}
          </Link>
        ))}
      </nav>

      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      {editando ? (
        <EditorItem
          key={`${cat}-${editando === 'nuevo' ? 'nuevo' : editando.id}`}
          cat={cat}
          original={editando === 'nuevo' ? undefined : editando}
          editable={editando === 'nuevo' ? permisos.crear : permisos.editar}
          cerrar={(texto) => { setEditando(null); if (texto) setAviso({ tono: 'ok', texto }); }}
        />
      ) : (
        <Tarjeta
          id="catalogo"
          titulo={t(`administracion.catalogos.nombres.${cat}`)}
          ayuda={t(`administracion.catalogos.ayudas.${cat}`)}
          acciones={permisos.crear && (
            <Boton chico onClick={() => { setAviso(null); setEditando('nuevo'); }}>
              <Icono nombre="mas" className="size-4" /> {t('administracion.catalogos.nuevo')}
            </Boton>
          )}
        >
          <div className="grid gap-4">
            <Campo etiqueta={t('administracion.catalogos.buscar')} type="search" value={texto} onChange={(e) => setTexto(e.target.value)} className="sm:max-w-xs" />
            {consulta.isPending ? (
              <Cargando />
            ) : consulta.isError ? (
              <EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} />
            ) : items.length === 0 ? (
              <p className="text-tinta-3">{filtro ? t('administracion.catalogos.sin_resultados') : t('administracion.catalogos.vacio')}</p>
            ) : (
              <ul className="divide-y divide-linea" aria-label={t(`administracion.catalogos.nombres.${cat}`)}>
                {items.map((x) => {
                  const nombre = nombreItem(x);
                  const extra = detalle(cat, x, t);
                  return (
                    <li key={x.id} aria-label={nombre} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <span className="grid min-w-0 gap-0.5">
                        <span className="font-semibold break-words">{nombre}</span>
                        <span className="text-sm text-tinta-3">{[codigoItem(x), extra].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="flex gap-2">
                        <Boton chico variante="secundario" onClick={() => { setAviso(null); setEditando(x); }} aria-label={t(permisos.editar ? 'administracion.catalogos.editar_de' : 'administracion.catalogos.ver_de', { nombre })}>
                          <Icono nombre={permisos.editar ? 'editar' : 'lista'} className="size-4" /> {t(permisos.editar ? 'comun.editar' : 'administracion.catalogos.ver')}
                        </Boton>
                        {permisos.borrar && (
                          <Boton chico variante="fantasma" disabled={borrar.isPending} onClick={() => void eliminar(x)} aria-label={t('administracion.catalogos.borrar_de', { nombre })}>
                            <Icono nombre="borrar" className="size-4" />
                          </Boton>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}

/** Formulario de un elemento: los campos dependen del catálogo (ver FORMA). */
function EditorItem({ cat, original, editable, cerrar }: { cat: Catalogo; original?: ItemCatalogo; editable: boolean; cerrar: (texto?: string) => void }) {
  const { t, i18n } = useTranslation();
  const forma = FORMA[cat];
  const guardar = useGuardarItem(cat);
  const unidades = useQuery({ ...catalogos.lista('unidades', i18n.language), enabled: !!forma.unidad || !!forma.peso });
  const [f, setF] = useState<FormCatalogo>(() => formDesdeItem(cat, original));
  const [errores, setErrores] = useState<ErroresCatalogo | null>(null);
  const [falla, setFalla] = useState('');
  const cambiar = (c: Partial<FormCatalogo>) => {
    const nuevo = { ...f, ...c };
    setF(nuevo);
    if (errores) setErrores(validarCatalogo(cat, nuevo));
  };
  const texto = (l: (typeof IDIOMAS_CATALOGO)[number], k: 'nombre' | 'descripcion', v: string) => cambiar({ textos: { ...f.textos, [l]: { ...f.textos[l], [k]: v } } });
  const msg = (k: keyof ErroresCatalogo) => (errores?.[k] ? t(`administracion.catalogos.errores.${errores[k]}`) : undefined);
  const opcionesUnidad = (unidades.data ?? []).filter((u) => u.id !== original?.id).map((u) => ({ id: u.id!, nombre: nombreItem(u) }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const v = validarCatalogo(cat, f);
    setErrores(v);
    if (Object.keys(v).length) return;
    setFalla('');
    try {
      const item = armarItem(cat, original, f);
      await guardar.mutateAsync(item);
      // El aviso nombra el elemento como lo muestra la lista: en el idioma de la interfaz si tiene traducción.
      const idiomaUi = i18n.language.slice(0, 2).toUpperCase() as (typeof IDIOMAS_CATALOGO)[number];
      cerrar(t('administracion.catalogos.guardado', { nombre: f.textos[idiomaUi]?.nombre.trim() || nombreItem(item) }));
    } catch (x) {
      setFalla((x as Error).message);
    }
  }

  const titulo = original ? nombreItem(original) : t('administracion.catalogos.nuevo_de', { que: t(`administracion.catalogos.nombres.${cat}`).toLowerCase() });
  return (
    <Tarjeta id="editor" titulo={titulo} ayuda={editable ? undefined : t('administracion.catalogos.solo_lectura')}>
      <form onSubmit={enviar} noValidate className="grid gap-6">
        {falla && <Aviso tono="mal">{falla}</Aviso>}
        <fieldset disabled={!editable} className="grid min-w-0 gap-5">
          {(forma.codigo || forma.etiqueta) && (
            <div className="grid gap-5 sm:grid-cols-2">
              {forma.codigo && (
                <Campo
                  etiqueta={<>{t(cat === 'campos-evidencia' ? 'administracion.catalogos.nombre_campo' : 'administracion.catalogos.codigo')}{OBLIGATORIO}</>}
                  ayuda={forma.codigo === 'estricto' ? t('administracion.catalogos.codigo_ayuda') : undefined}
                  value={f.codigo}
                  onChange={(e) => cambiar({ codigo: forma.codigo === 'estricto' ? e.target.value.toUpperCase() : e.target.value })}
                  error={msg('codigo')}
                />
              )}
              {forma.etiqueta && <Campo etiqueta={<>{t('administracion.catalogos.etiqueta')}{OBLIGATORIO}</>} value={f.etiqueta} onChange={(e) => cambiar({ etiqueta: e.target.value })} error={msg('etiqueta')} />}
            </div>
          )}

          {forma.traducciones && (
            <div className="grid gap-3">
              <p className="text-sm text-tinta-2">{t('administracion.catalogos.traducciones_ayuda')}</p>
              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                {IDIOMAS_CATALOGO.map((l) => (
                  <div key={l} role="group" aria-label={t(`productos.idiomas.${l}`)} className="grid content-start gap-3 rounded-lg border border-linea p-3">
                    <Campo
                      etiqueta={<>{t(forma.traducciones === 'etiqueta' ? 'administracion.catalogos.etiqueta_en' : 'administracion.catalogos.nombre_en', { idioma: t(`productos.idiomas.${l}`) })}{l === 'EN' && OBLIGATORIO}</>}
                      value={f.textos[l].nombre}
                      onChange={(e) => texto(l, 'nombre', e.target.value)}
                      error={l === 'EN' ? msg('nombre') : undefined}
                    />
                    {forma.traducciones === 'nombre' && (
                      <Area
                        etiqueta={<>{t('administracion.catalogos.descripcion_en', { idioma: t(`productos.idiomas.${l}`) })}{l === 'EN' && forma.descripcionObligatoria && OBLIGATORIO}</>}
                        rows={2}
                        value={f.textos[l].descripcion}
                        onChange={(e) => texto(l, 'descripcion', e.target.value)}
                        error={l === 'EN' ? msg('descripcion') : undefined}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(forma.unidad || forma.peso || forma.tipos) && (
            <div className="grid gap-5 sm:grid-cols-2">
              {forma.unidad && (
                <Selector etiqueta={<>{t('administracion.catalogos.unidad')}{OBLIGATORIO}</>} value={f.unidad} onChange={(e) => cambiar({ unidad: e.target.value })} error={msg('unidad')}>
                  <option value="">{unidades.isPending ? t('comun.cargando') : t('stock.elegir')}</option>
                  {opcionesUnidad.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </Selector>
              )}
              {forma.peso && (
                <>
                  <Campo etiqueta={t('administracion.catalogos.peso')} ayuda={t('administracion.catalogos.peso_ayuda')} inputMode="decimal" value={f.peso} onChange={(e) => cambiar({ peso: e.target.value })} error={msg('peso')} />
                  <Selector etiqueta={t('administracion.catalogos.unidad_base')} value={f.unidadBase} onChange={(e) => cambiar({ unidadBase: e.target.value })}>
                    <option value="">{t('administracion.catalogos.ninguna')}</option>
                    {opcionesUnidad.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </Selector>
                </>
              )}
              {forma.tipos && (
                <Selector etiqueta={<>{t('administracion.catalogos.tipo')}{OBLIGATORIO}</>} value={f.tipo} onChange={(e) => cambiar({ tipo: e.target.value })} error={msg('tipo')}>
                  <option value="">{t('stock.elegir')}</option>
                  {forma.tipos.map((x) => <option key={x} value={x}>{t(`administracion.catalogos.tipos.${x}`)}</option>)}
                </Selector>
              )}
            </div>
          )}

          {forma.marcas && (
            <div className="grid gap-2">
              {forma.marcas.map((m) => (
                <Casilla key={m} marcada={f.marcas[m]} alCambiar={(v) => cambiar({ marcas: { ...f.marcas, [m]: v } })} deshabilitada={!editable}>
                  {t(`administracion.catalogos.marcas.${m}`)}
                </Casilla>
              ))}
            </div>
          )}
        </fieldset>

        <div className="flex flex-wrap gap-2">
          {editable && <Boton type="submit" disabled={guardar.isPending}>{t('comun.guardar')}</Boton>}
          <Boton type="button" variante="secundario" onClick={() => cerrar()}>{editable ? t('comun.cancelar') : t('administracion.catalogos.volver')}</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
