import { Suspense, lazy, useState, type ReactNode } from 'react';
import { Link, getRouteApi, useBlocker, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { instalaciones as consultas, useGuardarInstalacion } from '@/api/instalaciones';
import { productores } from '@/api/productores';
import type { ApiFacility } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import {
  IDIOMAS_NOMBRE, OPCIONES, armarInstalacion, esRuanda, formDesdeInstalacion, nombreInstalacion, validarInstalacion,
  type ErroresInstalacion, type FormInstalacion,
} from '@/util/instalacion';
import { NumeroConUnidad } from '../stock/procesamiento/piezas';
import { Casilla, Tarjeta } from '../productos/piezas';
import { useEmpresaVista } from './Marco';

const SelectorPuntos = lazy(() => import('@/componentes/mapa/SelectorPuntos'));
const ruta = getRouteApi('/portal/empresa/instalaciones/$instalacion');

export function InstalacionNueva() {
  const { t } = useTranslation();
  const { id } = useEmpresaVista();
  const cadenas = useQuery(consultas.cadenasEmpresa(id));
  if (cadenas.isPending) return <Cargando />;
  if (cadenas.isError) return <EstadoError texto={cadenas.error.message} reintentar={() => void cadenas.refetch()} />;
  return <Formulario original={null} inicial={formDesdeInstalacion(null, cadenas.data)} titulo={t('empresa.instalaciones.nueva')} />;
}

export function InstalacionExistente() {
  const id = Number(ruta.useParams().instalacion);
  const consulta = useQuery(consultas.detalle(id));
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} />;
  return <Formulario key={id} original={consulta.data} inicial={formDesdeInstalacion(consulta.data)} titulo={nombreInstalacion(consulta.data)} />;
}

function Formulario({ original, inicial, titulo }: { original: ApiFacility | null; inicial: FormInstalacion; titulo: string }) {
  const { t, i18n } = useTranslation();
  const navegar = useNavigate();
  const { id: empresa, editable } = useEmpresaVista();
  const guardar = useGuardarInstalacion();
  const tipos = useQuery(consultas.tipos());
  const paises = useQuery(productores.paises());
  const cadenasEmpresa = useQuery(consultas.cadenasEmpresa(empresa));
  const finalesEmpresa = useQuery(consultas.finalesEmpresa(empresa));
  const [f, setF] = useState(inicial);
  const semis = useQuery(consultas.semiproductos(f.cadenas.map((c) => c.id!)));
  const [tocado, setTocado] = useState(false);
  const [errores, setErrores] = useState<ErroresInstalacion>({});
  const [aviso, setAviso] = useState<string | null>(null);
  // El mapa se rearma (y se encuadra) cuando las coordenadas se escriben a mano.
  const [version, setVersion] = useState(0);
  const cambiar = (c: Partial<FormInstalacion>) => {
    setF((x) => ({ ...x, ...c }));
    setTocado(true);
  };
  const msg = (k?: string) => (k ? t(`empresa.errores.${k}`, { defaultValue: t(`productos.errores.${k}`, { defaultValue: t(`stock.errores.${k}`) }) }) : undefined);
  const ruanda = esRuanda(f.codigoPais);

  useBlocker({ shouldBlockFn: () => tocado && !guardar.isPending && !window.confirm(t('stock.entrega.salir_sin_guardar')), enableBeforeUnload: () => tocado });

  async function alGuardar() {
    setAviso(null);
    const e = validarInstalacion(f);
    setErrores(e);
    if (Object.keys(e).length) {
      setAviso(t('stock.entrega.revisar'));
      return;
    }
    try {
      const i = armarInstalacion(original, f, { empresa, idioma: i18n.language, paises: paises.data ?? [], tipos: tipos.data ?? [] });
      await guardar.mutateAsync(i);
      setTocado(false);
      await navegar({ to: '/empresa/instalaciones', search: { guardada: nombreInstalacion(i) } });
    } catch (x) {
      setAviso((x as Error).message);
    }
  }

  function quitarCadena(id: number) {
    const nombre = f.cadenas.find((c) => c.id === id)?.name ?? '';
    if (!window.confirm(t('empresa.instalaciones.quitar_cadena_pregunta', { cadena: nombre }))) return;
    // Como la versión actual: los semiproductos se vacían (no dicen de qué cadena son) y se vuelven a elegir.
    cambiar({ cadenas: f.cadenas.filter((c) => c.id !== id), semis: [] });
  }

  if (!editable) return <Aviso tono="info" titulo={t('empresa.solo_lectura_titulo')}>{t('empresa.instalaciones.ayuda_lectura')}</Aviso>;

  return (
    <div className="grid gap-5">
      <header>
        <Link to="/empresa/instalaciones" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
          <Icono nombre="volver" className="size-4" /> {t('empresa.instalaciones.titulo')}
        </Link>
        <h2 className="mt-2 font-titulo text-2xl font-semibold break-words">{titulo}</h2>
        {original?.deactivated && <p className="mt-1 text-sm text-mal">{t('empresa.instalaciones.esta_desactivada')}</p>}
      </header>
      {aviso && <Aviso tono="mal">{aviso}</Aviso>}

      <Tarjeta id="datos-instalacion" titulo={t('empresa.instalaciones.secciones.datos')}>
        <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <Selector etiqueta={t('empresa.instalaciones.tipo')} value={f.tipo ?? ''} onChange={(e) => cambiar({ tipo: e.target.value ? Number(e.target.value) : null })} error={msg(errores.tipo)} className="sm:col-span-2 sm:max-w-sm">
            <option value="">{t('stock.elegir')}</option>
            {(tipos.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </Selector>
          {IDIOMAS_NOMBRE.map((x) => (
            <Campo key={x} etiqueta={t('empresa.instalaciones.nombre_en', { idioma: t(`productos.idiomas.${x}`) })} value={f.nombres[x]} onChange={(e) => cambiar({ nombres: { ...f.nombres, [x]: e.target.value } })} />
          ))}
          <p className={'text-sm sm:col-span-2 ' + (errores.nombre ? 'text-mal' : 'text-tinta-3')} role={errores.nombre ? 'alert' : undefined}>
            {errores.nombre ? t('empresa.instalaciones.sin_nombre') : t('empresa.instalaciones.nombre_ayuda')}
          </p>
        </div>
      </Tarjeta>

      <Tarjeta id="ubicacion-instalacion" titulo={t('empresa.instalaciones.secciones.ubicacion')}>
        <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <Selector etiqueta={t('empresa.pais')} value={f.pais ?? ''} error={msg(errores.pais)} className="sm:col-span-2 sm:max-w-sm" onChange={(e) => {
            const p = (paises.data ?? []).find((x) => x.id === Number(e.target.value));
            cambiar({ pais: p?.id ?? null, codigoPais: p?.code ?? '' });
          }}>
            <option value="">{t('stock.elegir')}</option>
            {(paises.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Selector>
          {ruanda ? (
            <>
              <Campo etiqueta={t('empresa.instalaciones.aldea')} value={f.aldea} onChange={(e) => cambiar({ aldea: e.target.value })} />
              <Campo etiqueta={t('empresa.instalaciones.celda')} value={f.celda} onChange={(e) => cambiar({ celda: e.target.value })} />
              <Campo etiqueta={t('empresa.instalaciones.sector')} value={f.sector} onChange={(e) => cambiar({ sector: e.target.value })} />
            </>
          ) : (
            <>
              <Campo etiqueta={t('empresa.direccion')} value={f.direccion} onChange={(e) => cambiar({ direccion: e.target.value })} className="sm:col-span-2" />
              <Campo etiqueta={t('empresa.ciudad')} value={f.ciudad} onChange={(e) => cambiar({ ciudad: e.target.value })} />
              <Campo etiqueta={t('empresa.region')} value={f.region} onChange={(e) => cambiar({ region: e.target.value })} />
              <Campo etiqueta={t('empresa.postal')} value={f.postal} onChange={(e) => cambiar({ postal: e.target.value })} />
            </>
          )}
          <div className="sm:col-span-2">
            <SiNo etiqueta={t('empresa.instalaciones.visible')} ayuda={t('empresa.instalaciones.visible_ayuda')} valor={f.visible} alCambiar={(visible) => cambiar({ visible })} error={msg(errores.visible)} />
          </div>
          {f.visible && (
            <div className="grid gap-3 sm:col-span-2">
              <p className="text-sm text-tinta-3">{t('empresa.instalaciones.mapa_instrucciones')}</p>
              <Suspense fallback={<div className="h-80 rounded-caja bg-superficie-2" />}>
                <SelectorPuntos
                  key={version}
                  etiqueta={t('empresa.instalaciones.mapa_punto')}
                  puntos={[f.lat !== null && f.lng !== null && !Number.isNaN(f.lat) && !Number.isNaN(f.lng) ? [f.lng, f.lat] : null]}
                  alAgregar={([lng, lat]) => cambiar({ lat, lng })}
                  alMover={(_, [lng, lat]) => cambiar({ lat, lng })}
                />
              </Suspense>
              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <NumeroConUnidad etiqueta={t('productos.origen.latitud')} requerido valor={f.lat} alCambiar={(lat) => { cambiar({ lat }); setVersion((v) => v + 1); }} error={msg(errores.lat)} />
                <NumeroConUnidad etiqueta={t('productos.origen.longitud')} requerido valor={f.lng} alCambiar={(lng) => { cambiar({ lng }); setVersion((v) => v + 1); }} error={msg(errores.lng)} />
              </div>
            </div>
          )}
        </div>
      </Tarjeta>

      <Tarjeta id="uso-instalacion" titulo={t('empresa.instalaciones.secciones.uso')}>
        <div className="grid gap-5">
          <SiNo etiqueta={t('empresa.instalaciones.acopio')} ayuda={t('empresa.instalaciones.acopio_ayuda')} valor={f.acopio} alCambiar={(acopio) => cambiar({ acopio })} error={msg(errores.acopio)} />
          <SiNo etiqueta={t('empresa.instalaciones.vende')} ayuda={t('empresa.instalaciones.vende_ayuda')} valor={f.vende} alCambiar={(vende) => cambiar({ vende })} error={msg(errores.vende)} />
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-semibold text-tinta-2">{t('empresa.instalaciones.opciones')}</legend>
            {OPCIONES.map((o) => (
              <Casilla key={o} marcada={f.opciones[o]} alCambiar={(v) => cambiar({ opciones: { ...f.opciones, [o]: v } })}>
                {t(`empresa.instalaciones.opcion.${o}`)}
              </Casilla>
            ))}
          </fieldset>
        </div>
      </Tarjeta>

      <Tarjeta id="productos-instalacion" titulo={t('empresa.instalaciones.secciones.productos')} ayuda={t('empresa.instalaciones.productos_ayuda')}>
        <div className="grid gap-6">
          <Fichas
            etiqueta={t('empresa.cadenas')}
            requerido
            error={msg(errores.cadenas)}
            elegidos={f.cadenas.map((c) => ({ id: c.id!, nombre: c.name ?? `#${c.id}` }))}
            opciones={(cadenasEmpresa.data ?? []).map((c) => ({ id: c.id!, nombre: c.name ?? `#${c.id}` }))}
            alAgregar={(id) => cambiar({ cadenas: [...f.cadenas, (cadenasEmpresa.data ?? []).find((c) => c.id === id)!] })}
            alQuitar={quitarCadena}
          />
          <Fichas
            etiqueta={t('empresa.instalaciones.semiproductos')}
            vacio={f.cadenas.length ? undefined : t('empresa.instalaciones.elegir_cadena')}
            elegidos={f.semis.map((s) => ({ id: s.id!, nombre: s.name ?? `#${s.id}` }))}
            opciones={(semis.data ?? []).map((s) => ({ id: s.id!, nombre: s.name ?? `#${s.id}` }))}
            alAgregar={(id) => cambiar({ semis: [...f.semis, (semis.data ?? []).find((s) => s.id === id)!] })}
            alQuitar={(id) => window.confirm(t('empresa.instalaciones.quitar_producto_pregunta')) && cambiar({ semis: f.semis.filter((s) => s.id !== id) })}
          />
          <Fichas
            etiqueta={t('empresa.instalaciones.finales')}
            elegidos={f.finales.map((x) => ({ id: x.id!, nombre: [x.name, x.product?.name].filter(Boolean).join(' · ') || `#${x.id}` }))}
            opciones={(finalesEmpresa.data ?? []).map((x) => ({ id: x.id!, nombre: [x.name, x.product?.name].filter(Boolean).join(' · ') || `#${x.id}` }))}
            alAgregar={(id) => cambiar({ finales: [...f.finales, (finalesEmpresa.data ?? []).find((x) => x.id === id)!] })}
            alQuitar={(id) => window.confirm(t('empresa.instalaciones.quitar_producto_pregunta')) && cambiar({ finales: f.finales.filter((x) => x.id !== id) })}
          />
        </div>
      </Tarjeta>

      {(tocado || !original) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-superficie/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm text-tinta-2">{original ? t('productores.ficha.cambios') : t('empresa.instalaciones.nueva_ayuda')}</p>
            <Boton onClick={() => void alGuardar()} disabled={guardar.isPending}>
              <Icono nombre="ok" className="size-4" /> {guardar.isPending ? t('productores.ficha.guardando') : t('comun.guardar')}
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}

/** Pregunta de sí o no, sin respuesta marcada hasta que se elige (como la versión actual). */
function SiNo({ etiqueta, ayuda, valor, alCambiar, error }: { etiqueta: string; ayuda?: string; valor: boolean | null; alCambiar: (v: boolean) => void; error?: string }) {
  const { t } = useTranslation();
  return (
    <fieldset className="grid gap-1.5" aria-invalid={error ? true : undefined}>
      <legend className="text-sm font-semibold text-tinta-2">{etiqueta} <span className="text-mal" aria-hidden>*</span></legend>
      <div className="flex gap-4">
        {([true, false] as const).map((v) => (
          <label key={String(v)} className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" className="size-4 accent-[var(--marca)]" checked={valor === v} onChange={() => alCambiar(v)} />
            {v ? t('comun.si') : t('comun.no')}
          </label>
        ))}
      </div>
      {error ? <p className="text-sm text-mal" role="alert">{error}</p> : ayuda ? <p className="text-sm text-tinta-3">{ayuda}</p> : null}
    </fieldset>
  );
}

/** Lista de elementos elegidos (como fichas) y un selector para sumar otro. */
function Fichas({ etiqueta, requerido, error, vacio, elegidos, opciones, alAgregar, alQuitar }: {
  etiqueta: string;
  requerido?: boolean;
  error?: string;
  vacio?: string;
  elegidos: { id: number; nombre: string }[];
  opciones: { id: number; nombre: string }[];
  alAgregar: (id: number) => void;
  alQuitar: (id: number) => void;
}) {
  const { t } = useTranslation();
  const [elegida, setElegida] = useState('');
  const disponibles = opciones.filter((o) => !elegidos.some((e) => e.id === o.id));
  const req: ReactNode = requerido ? <span className="text-mal" aria-hidden> *</span> : null;
  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold text-tinta-2">{etiqueta}{req}</span>
      {elegidos.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={etiqueta}>
          {elegidos.map((e) => (
            <li key={e.id} className="inline-flex items-center gap-1 rounded-full bg-marca-suave py-1 pr-1 pl-3 text-sm font-semibold text-marca">
              {e.nombre}
              <button type="button" onClick={() => alQuitar(e.id)} className="rounded-full p-1 hover:bg-marca/15" aria-label={t('empresa.quitar', { que: e.nombre })}>
                <Icono nombre="cerrar" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-tinta-3">{vacio ?? t('empresa.lista_vacia')}</p>
      )}
      {error && <p className="text-sm text-mal" role="alert">{error}</p>}
      {disponibles.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <Selector etiqueta={t('empresa.instalaciones.agregar_a', { que: etiqueta.toLowerCase() })} value={elegida} onChange={(e) => setElegida(e.target.value)} className="min-w-0 flex-1 sm:max-w-sm">
            <option value="">{t('stock.elegir')}</option>
            {disponibles.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </Selector>
          <Boton variante="secundario" disabled={!elegida} onClick={() => { alAgregar(Number(elegida)); setElegida(''); }} aria-label={t('empresa.instalaciones.agregar_a', { que: etiqueta.toLowerCase() })}>
            <Icono nombre="mas" className="size-4" /> {t('empresa.agregar')}
          </Boton>
        </div>
      )}
    </div>
  );
}
