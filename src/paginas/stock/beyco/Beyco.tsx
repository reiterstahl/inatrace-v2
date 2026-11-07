import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, getRouteApi, useBlocker, useNavigate } from '@tanstack/react-router';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { stock } from '@/api/stock';
import { beyco, conectadoABeyco, conectarBeyco, irAAutorizar, olvidarBeyco, tomarPendiente, useEnviarABeyco } from '@/api/beyco';
import { ErrorApi } from '@/api/respuesta';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import {
  CERTIFICADOS, ESPECIES, GRADOS, INCOTERMS, MONEDAS, PROCESOS, SEGMENTOS, UNIDADES_PRECIO, VARIEDADES,
  armarOferta, completarNombres, conEspecialidad, ofertaDesdeCampos, resolverVuelta, sinErroresOferta, validarOferta,
  type CafeBeyco, type ErroresCafe, type ErroresOferta, type OfertaBeyco,
} from '@/util/beyco';
import { Bloque, CONTROL } from '../entregas/campos';
import { Etiqueta, MensajeError, NumeroConUnidad } from '../procesamiento/piezas';
import { confirmarSalida } from '@/componentes/ui/Confirmar';

const rutaVuelta = getRouteApi('/portal/stock/beyco');
const rutaOferta = getRouteApi('/portal/stock/beyco/oferta');

// ---------- Vuelta desde Beyco ----------

/** Beyco vuelve acá después de autorizar: se valida el `state`, se pide el token y se sigue a la oferta. */
export function VueltaBeyco() {
  const { t } = useTranslation();
  const q = rutaVuelta.useSearch();
  const navegar = useNavigate();
  const [motivo, setMotivo] = useState<string | null>(null);
  const hecho = useRef(false);

  useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    const r = resolverVuelta(q, tomarPendiente());
    if (!r.ok) {
      setMotivo(r.motivo);
      return;
    }
    conectarBeyco(r.pendiente.empresa, r.code)
      .then(() => navegar({ to: '/stock/beyco/oferta', search: { lotes: r.pendiente.lotes.join(',') }, replace: true }))
      .catch((e: Error) => setMotivo(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!motivo) return <Cargando />;
  return (
    <div className="grid max-w-2xl gap-4">
      <Aviso tono="mal" titulo={t('stock.beyco.error_titulo')}>{t(`stock.beyco.errores.${motivo}`, { defaultValue: motivo })}</Aviso>
      <Link to="/stock/todo" className="text-sm font-semibold text-marca hover:underline">{t('stock.beyco.volver_stock')}</Link>
    </div>
  );
}

// ---------- Oferta ----------

export function OfertaBeycoPagina() {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  const { lotes } = rutaOferta.useSearch();
  const ids = (lotes ?? '').split(',').map(Number).filter((n) => n > 0);
  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  if (!ids.length) return <EstadoError texto={t('stock.beyco.sin_lotes')} />;
  if (!conectadoABeyco(empresa.id)) {
    return (
      <div className="grid max-w-2xl gap-4">
        <header>
          <Link to="/stock/todo" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
            <Icono nombre="volver" className="size-4" /> {t('stock.pestanas.stock')}
          </Link>
          <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{t('stock.beyco.titulo')}</h1>
        </header>
        <Aviso tono="info" titulo={t('stock.beyco.conectar_titulo')}>{t('stock.beyco.conectar_texto')}</Aviso>
        <Boton className="justify-self-start" onClick={() => irAAutorizar(empresa.id, ids)}>
          <Icono nombre="externo" className="size-4" /> {t('stock.beyco.conectar')}
        </Boton>
      </div>
    );
  }
  return <CargarOferta empresa={empresa.id} lotes={ids} />;
}

function CargarOferta({ empresa, lotes }: { empresa: number; lotes: number[] }) {
  const campos = useQuery(beyco.campos(empresa, lotes));
  // Los lotes, para nombrar los cafés que el backend deja sin nombre (las entregas).
  const ordenes = useQueries({ queries: lotes.map((id) => stock.entrega(id)) });
  if (campos.isPending || ordenes.some((o) => o.isPending)) return <Cargando />;
  if (campos.isError) return <EstadoError texto={campos.error.message} reintentar={() => void campos.refetch()} />;
  return <Formulario empresa={empresa} inicial={completarNombres(ofertaDesdeCampos(campos.data), ordenes.map((o) => o.data))} />;
}

function Formulario({ empresa, inicial }: { empresa: number; inicial: OfertaBeyco }) {
  const { t } = useTranslation();
  const navegar = useNavigate();
  const enviar = useEnviarABeyco(empresa);
  const [f, setF] = useState<OfertaBeyco>(inicial);
  const [tocado, setTocado] = useState(false);
  const [errores, setErrores] = useState<ErroresOferta>({ cafes: {} });
  const [aviso, setAviso] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const ids = { titulo: useId(), disponible: useId(), direccion: useId(), pais: useId() };
  const cambiar = (c: Partial<OfertaBeyco>) => {
    setF((x) => ({ ...x, ...c }));
    setTocado(true);
  };
  const cambiarCafe = (clave: string, c: Partial<CafeBeyco>) => cambiar({ cafes: f.cafes.map((x) => (x.clave === clave ? { ...x, ...c } : x)) });
  const err = (k: Exclude<keyof ErroresOferta, 'cafes'>) => (errores[k] ? t(`stock.beyco.errores.${errores[k]}`, { defaultValue: t(`stock.errores.${errores[k]}`) }) : undefined);

  useBlocker({ shouldBlockFn: async () => tocado && !enviar.isPending && !listo && !(await confirmarSalida(t('stock.entrega.salir_sin_guardar'))), enableBeforeUnload: () => tocado && !listo });
  useEffect(() => {
    document.title = `${t('stock.beyco.titulo')} · INATrace v2`;
  }, [t]);

  async function alEnviar() {
    setAviso(null);
    const e = validarOferta(f);
    setErrores(e);
    if (!sinErroresOferta(e)) {
      setAviso(t('stock.entrega.revisar'));
      return;
    }
    try {
      await enviar.mutateAsync(armarOferta(f));
      setListo(true);
      setTocado(false);
    } catch (x) {
      const m = (x as Error).message;
      // Beyco caído o con una respuesta inválida: el backend responde 503 (UPSTREAM_HTTP_ERROR).
      const caido = x instanceof ErrorApi && (x.http === 503 || x.estado === 'UPSTREAM_HTTP_ERROR');
      setAviso(m === 'sin_sesion_beyco' ? t('stock.beyco.errores.sin_sesion_beyco') : caido ? t('stock.beyco.errores.no_responde') : m);
    }
  }

  if (listo) {
    return (
      <div className="grid max-w-2xl gap-4">
        <Aviso tono="ok" titulo={t('stock.beyco.enviada_titulo')}>{t('stock.beyco.enviada_texto')}</Aviso>
        <Link to="/stock/todo" className="text-sm font-semibold text-marca hover:underline">{t('stock.beyco.volver_stock')}</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/stock/todo" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
            <Icono nombre="volver" className="size-4" /> {t('stock.pestanas.stock')}
          </Link>
          <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{t('stock.beyco.titulo')}</h1>
          <p className="mt-1 max-w-2xl text-tinta-2">{t('stock.beyco.descripcion', { count: f.cafes.length })}</p>
        </div>
        <Boton variante="fantasma" onClick={() => { olvidarBeyco(); void navegar({ to: '/stock/todo' }); }}>
          <Icono nombre="salir" className="size-4" /> {t('stock.beyco.desconectar')}
        </Boton>
      </header>
      {aviso && <Aviso tono="mal">{aviso}</Aviso>}

      <Bloque titulo={t('stock.beyco.la_oferta')}>
        <div className="grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
          <Campo id={ids.titulo} etiqueta={t('stock.beyco.titulo_oferta')} error={err('titulo')} ayuda={t('stock.beyco.titulo_ayuda', { n: f.titulo.trim().length })}>
            <input id={ids.titulo} value={f.titulo} maxLength={120} aria-invalid={!!err('titulo')} onChange={(e) => cambiar({ titulo: e.target.value })} className={CONTROL + ' h-11'} />
          </Campo>
          <Campo id={ids.disponible} etiqueta={t('stock.beyco.disponible')} error={err('disponible')}>
            <input id={ids.disponible} type="date" value={f.disponible} aria-invalid={!!err('disponible')} onChange={(e) => cambiar({ disponible: e.target.value })} className={CONTROL + ' h-11'} />
          </Campo>
          <Campo id={ids.direccion} etiqueta={t('stock.beyco.puerto')} error={err('direccion')}>
            <input id={ids.direccion} value={f.direccion} aria-invalid={!!err('direccion')} onChange={(e) => cambiar({ direccion: e.target.value })} className={CONTROL + ' h-11'} />
          </Campo>
          <Campo id={ids.pais} etiqueta={t('stock.beyco.pais_puerto')} error={err('pais')}>
            <input id={ids.pais} value={f.pais} aria-invalid={!!err('pais')} onChange={(e) => cambiar({ pais: e.target.value })} className={CONTROL + ' h-11'} />
          </Campo>
          <NumeroConUnidad etiqueta={t('stock.beyco.latitud')} requerido valor={f.latitud} alCambiar={(latitud) => cambiar({ latitud })} error={err('latitud')} />
          <NumeroConUnidad etiqueta={t('stock.beyco.longitud')} requerido valor={f.longitud} alCambiar={(longitud) => cambiar({ longitud })} error={err('longitud')} />
        </div>
      </Bloque>

      {f.cafes.map((c, n) => (
        <Cafe key={c.clave} n={n + 1} cafe={c} errores={errores.cafes[c.clave] ?? {}} alCambiar={(x) => cambiarCafe(c.clave, x)} />
      ))}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-linea bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <Boton onClick={() => void alEnviar()} disabled={enviar.isPending}>
            <Icono nombre="ok" className="size-4" /> {enviar.isPending ? t('comun.cargando') : t('stock.beyco.enviar')}
          </Boton>
        </div>
      </div>
    </div>
  );
}

function Cafe({ n, cafe: c, errores, alCambiar }: { n: number; cafe: CafeBeyco; errores: ErroresCafe; alCambiar: (c: Partial<CafeBeyco>) => void }) {
  const { t } = useTranslation();
  const ids = { nombre: useId(), cosecha: useId(), region: useId(), pais: useId(), incoterm: useId(), incotermOtro: useId(), especie: useId(), proceso: useId(), unidad: useId(), moneda: useId(), variedadOtra: useId(), gradoOtro: useId() };
  const err = (k: keyof CafeBeyco) => (errores[k] ? t(`stock.beyco.errores.${errores[k]}`, { defaultValue: t(`stock.errores.${errores[k]}`) }) : undefined);
  const op = (v: string) => t(`stock.beyco.op.${v}`, { defaultValue: v });
  const select = <V extends string>(id: string, valor: V | '', opciones: V[], alElegir: (v: V | '') => void, k: keyof CafeBeyco, opcional = false) => (
    <select id={id} value={valor} aria-invalid={!!err(k)} onChange={(e) => alElegir(e.target.value as V | '')} className={CONTROL + ' h-11'}>
      <option value="">{opcional ? t('stock.beyco.sin_indicar') : t('stock.elegir')}</option>
      {opciones.map((v) => <option key={v} value={v}>{op(v)}</option>)}
    </select>
  );

  return (
    <Bloque titulo={t('stock.beyco.cafe', { n, lote: c.lote })}>
      <div className="grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
        <Campo id={ids.nombre} etiqueta={t('stock.beyco.nombre_cafe')} error={err('nombre')}>
          <input id={ids.nombre} value={c.nombre} aria-invalid={!!err('nombre')} onChange={(e) => alCambiar({ nombre: e.target.value })} className={CONTROL + ' h-11'} />
        </Campo>
        <Campo id={ids.cosecha} etiqueta={t('stock.beyco.cosecha')} error={err('cosecha')}>
          <input id={ids.cosecha} type="date" value={c.cosecha} aria-invalid={!!err('cosecha')} onChange={(e) => alCambiar({ cosecha: e.target.value })} className={CONTROL + ' h-11'} />
        </Campo>
        <NumeroConUnidad etiqueta={t('stock.beyco.cantidad')} requerido valor={c.cantidad} alCambiar={(cantidad) => alCambiar({ cantidad })} unidad="kg" error={err('cantidad')} />
        <NumeroConUnidad etiqueta={t('stock.beyco.precio')} requerido valor={c.precio} alCambiar={(precio) => alCambiar({ precio })} error={err('precio')} />
        <Campo id={ids.unidad} etiqueta={t('stock.beyco.unidad_precio')} error={err('unidadPrecio')}>{select(ids.unidad, c.unidadPrecio, UNIDADES_PRECIO, (v) => alCambiar({ unidadPrecio: v }), 'unidadPrecio')}</Campo>
        <Campo id={ids.moneda} etiqueta={t('stock.entrega.moneda')} error={err('moneda')}>{select(ids.moneda, c.moneda, MONEDAS, (v) => alCambiar({ moneda: v }), 'moneda')}</Campo>
        <Campo id={ids.pais} etiqueta={t('stock.beyco.pais_origen')} error={err('pais')}>
          <input id={ids.pais} value={c.pais} aria-invalid={!!err('pais')} onChange={(e) => alCambiar({ pais: e.target.value })} className={CONTROL + ' h-11'} />
        </Campo>
        <Campo id={ids.region} etiqueta={t('stock.beyco.region')} opcional>
          <input id={ids.region} value={c.region} onChange={(e) => alCambiar({ region: e.target.value })} className={CONTROL + ' h-11'} />
        </Campo>
        <Campo id={ids.incoterm} etiqueta={t('stock.beyco.incoterm')} error={err('incoterm')}>{select(ids.incoterm, c.incoterm, INCOTERMS, (v) => alCambiar({ incoterm: v }), 'incoterm')}</Campo>
        {c.incoterm === 'Other' && (
          <Campo id={ids.incotermOtro} etiqueta={t('stock.beyco.incoterm_otro')} error={err('incotermOtro')}>
            <input id={ids.incotermOtro} value={c.incotermOtro} aria-invalid={!!err('incotermOtro')} onChange={(e) => alCambiar({ incotermOtro: e.target.value })} className={CONTROL + ' h-11'} />
          </Campo>
        )}
        <Campo id={ids.especie} etiqueta={t('stock.beyco.especie')} error={err('especie')}>{select(ids.especie, c.especie, ESPECIES, (v) => alCambiar({ especie: v }), 'especie')}</Campo>
        <Campo id={ids.proceso} etiqueta={t('stock.beyco.proceso')} opcional>{select(ids.proceso, c.proceso, PROCESOS, (v) => alCambiar({ proceso: v }), 'proceso', true)}</Campo>
        <NumeroConUnidad etiqueta={t('stock.beyco.zaranda_min')} requerido valor={c.zarandaMin} alCambiar={(zarandaMin) => alCambiar({ zarandaMin })} error={err('zarandaMin')} />
        <NumeroConUnidad etiqueta={t('stock.beyco.zaranda_max')} requerido valor={c.zarandaMax} alCambiar={(zarandaMax) => alCambiar({ zarandaMax })} error={err('zarandaMax')} />
        <NumeroConUnidad etiqueta={t('stock.beyco.taza')} requerido valor={c.taza} alCambiar={(taza) => alCambiar({ taza, segmentos: conEspecialidad(c.segmentos, taza) })} error={err('taza')} ayuda={t('stock.beyco.taza_ayuda')} />
      </div>
      <div className="mt-5 grid gap-5">
        <Opciones etiqueta={t('stock.beyco.variedades')} valores={c.variedades} opciones={VARIEDADES} alCambiar={(variedades) => alCambiar({ variedades })} error={err('variedades')} />
        {c.variedades.includes('Other') && (
          <Campo id={ids.variedadOtra} etiqueta={t('stock.beyco.variedad_otra')} error={err('variedadOtra')}>
            <input id={ids.variedadOtra} value={c.variedadOtra} aria-invalid={!!err('variedadOtra')} onChange={(e) => alCambiar({ variedadOtra: e.target.value })} className={CONTROL + ' h-11'} />
          </Campo>
        )}
        <Opciones etiqueta={t('stock.beyco.segmentos')} valores={c.segmentos} opciones={SEGMENTOS} alCambiar={(segmentos) => alCambiar({ segmentos })} error={err('segmentos')} />
        <Opciones etiqueta={t('stock.beyco.grados')} valores={c.grados} opciones={GRADOS} alCambiar={(grados) => alCambiar({ grados })} error={err('grados')} />
        {c.grados.includes('Other') && (
          <Campo id={ids.gradoOtro} etiqueta={t('stock.beyco.grado_otro')} error={err('gradoOtro')}>
            <input id={ids.gradoOtro} value={c.gradoOtro} aria-invalid={!!err('gradoOtro')} onChange={(e) => alCambiar({ gradoOtro: e.target.value })} className={CONTROL + ' h-11'} />
          </Campo>
        )}
        <Opciones etiqueta={t('stock.beyco.certificados')} valores={c.certificados} opciones={CERTIFICADOS} alCambiar={(certificados) => alCambiar({ certificados })} opcional />
      </div>
    </Bloque>
  );
}

/** Selección múltiple como botones que se activan; accesible como grupo de interruptores. */
function Opciones<V extends string>({ etiqueta, valores, opciones, alCambiar, error, opcional }: { etiqueta: string; valores: V[]; opciones: V[]; alCambiar: (v: V[]) => void; error?: string; opcional?: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="grid gap-1.5" role="group" aria-labelledby={id}>
      <span id={id} className="text-sm font-semibold text-tinta-2">
        {etiqueta}
        {!opcional && <span className="text-mal" aria-hidden="true"> *</span>}
      </span>
      <div className="flex flex-wrap gap-2">
        {opciones.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={valores.includes(v)}
            onClick={() => alCambiar(valores.includes(v) ? valores.filter((x) => x !== v) : [...valores, v])}
            className="h-9 rounded-lg border border-linea-fuerte px-3 text-sm font-medium text-tinta-2 hover:border-marca aria-pressed:border-marca aria-pressed:bg-marca aria-pressed:text-sobre-marca"
          >
            {t(`stock.beyco.op.${v}`, { defaultValue: v })}
          </button>
        ))}
      </div>
      <MensajeError>{error}</MensajeError>
    </div>
  );
}

function Campo({ id, etiqueta, error, children, opcional, ayuda }: { id: string; etiqueta: string; error?: string; children: ReactNode; opcional?: boolean; ayuda?: string }) {
  return (
    <div className="grid content-start gap-1.5">
      <Etiqueta htmlFor={id} requerido={!opcional}>{etiqueta}</Etiqueta>
      {children}
      {ayuda && !error && <span className="text-xs text-tinta-3">{ayuda}</span>}
      <MensajeError>{error}</MensajeError>
    </div>
  );
}
