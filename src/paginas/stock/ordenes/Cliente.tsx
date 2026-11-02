import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link, useBlocker, useNavigate } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas } from '@/api/consultas';
import { ordenes, useCrearPedidoCliente } from '@/api/ordenes';
import { stock } from '@/api/stock';
import type { ApiProcessingAction } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Aviso, Cargando } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { enAnterior } from '@/util/entorno';
import { nombreInstalacion } from '@/util/formato';
import {
  accionesParaInstalacion,
  armarPedidoCliente,
  itemNuevo,
  loteDeItem,
  pedidoClienteNuevo,
  sinErroresPedido,
  validarPedidoCliente,
  type ErroresPedidoCliente,
  type FormPedidoCliente,
  type ItemPedido,
} from '@/util/pedidoCliente';
import { Bloque, CONTROL } from '../entregas/campos';
import { Etiqueta, MensajeError, NumeroConUnidad } from '../procesamiento/piezas';

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Pedido de un cliente (orden de producto): qué productos finales quiere, a qué instalación propia
 * llegan y a quién se le piden. Cada ítem queda como una orden emitida que completa el proveedor.
 */
export function PedidoClienteNuevo() {
  const { t } = useTranslation();
  const empresa = useEmpresaActual();
  const instalaciones = useQuery({ ...stock.instalaciones(empresa?.id ?? 0), enabled: !!empresa });
  const acciones = useQuery({ ...ordenes.accionesDeProductoFinal(empresa?.id ?? 0), enabled: !!empresa });
  const clientes = useQuery({ ...ordenes.clientes(empresa?.id ?? 0), enabled: !!empresa });

  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;
  if (instalaciones.isPending || acciones.isPending || clientes.isPending) return <Cargando />;

  const faltan = (acciones.data ?? []).length === 0 ? 'acciones' : (clientes.data ?? []).length === 0 ? 'clientes' : null;
  return (
    <div className="grid gap-6 pb-24">
      <header>
        <Link to="/stock/ordenes" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
          <Icono nombre="volver" className="size-4" /> {t('stock.pestanas.ordenes')}
        </Link>
        <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{t('stock.ord.cli.titulo')}</h1>
        <p className="mt-1 max-w-2xl text-tinta-2">{t('stock.ord.cli.descripcion')}</p>
      </header>
      {faltan ? (
        <Aviso tono="info" titulo={t(`stock.ord.cli.sin_${faltan}`)}>
          {t(`stock.ord.cli.sin_${faltan}_texto`)}{' '}
          {faltan === 'acciones' ? (
            <Link to="/empresa/acciones" className="font-semibold underline">{t('empresa.acciones.ir')}</Link>
          ) : (
            <a href={enAnterior('/my-customers')} className="font-semibold underline">{t('portal.version_actual')}</a>
          )}
        </Aviso>
      ) : (
        <Formulario empresa={empresa.id} instalaciones={instalaciones.data ?? []} acciones={acciones.data ?? []} clientes={clientes.data ?? []} />
      )}
    </div>
  );
}

type Datos = {
  empresa: number;
  instalaciones: NonNullable<FormPedidoCliente['instalacion']>[];
  acciones: ApiProcessingAction[];
  clientes: NonNullable<FormPedidoCliente['cliente']>[];
};

function Formulario({ empresa, instalaciones, acciones, clientes }: Datos) {
  const { t } = useTranslation();
  const navegar = useNavigate();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const crear = useCrearPedidoCliente();
  const [f, setF] = useState<FormPedidoCliente>(pedidoClienteNuevo);
  const [tocado, setTocado] = useState(false);
  const [errores, setErrores] = useState<ErroresPedidoCliente>({ porItem: {} });
  const [aviso, setAviso] = useState<string | null>(null);
  const ids = { numero: useId(), cliente: useId(), instalacion: useId(), entrega: useId() };
  const cambiar = (c: Partial<FormPedidoCliente>) => {
    setF((x) => ({ ...x, ...c }));
    setTocado(true);
  };
  const cambiarItem = (clave: string, c: Partial<ItemPedido>) => cambiar({ items: f.items.map((i) => (i.clave === clave ? { ...i, ...c } : i)) });
  const err = (k: Exclude<keyof ErroresPedidoCliente, 'porItem'>) => (errores[k] ? t(`stock.errores.${errores[k]}`, { defaultValue: t(`stock.ord.cli.errores.${errores[k]}`) }) : undefined);
  // Solo instalaciones que manejan algún producto final que se pueda pedir.
  const conProductos = instalaciones.filter((i) => accionesParaInstalacion(acciones, i).length > 0);
  const posibles = accionesParaInstalacion(acciones, f.instalacion);

  useBlocker({ shouldBlockFn: () => tocado && !crear.isPending && !window.confirm(t('stock.entrega.salir_sin_guardar')), enableBeforeUnload: () => tocado });
  useEffect(() => {
    document.title = `${t('stock.ord.cli.titulo')} · INATrace v2`;
  }, [t]);

  async function alGuardar() {
    setAviso(null);
    const e = validarPedidoCliente(f);
    setErrores(e);
    if (!sinErroresPedido(e)) {
      setAviso(t('stock.entrega.revisar'));
      return;
    }
    try {
      await crear.mutateAsync(armarPedidoCliente(f, { usuario: yo.id!, hoy: hoy() }));
      setTocado(false);
      await navegar({ to: '/stock/ordenes' });
    } catch (x) {
      setAviso((x as Error).message);
    }
  }

  return (
    <>
      {aviso && <Aviso tono="mal">{aviso}</Aviso>}
      <Bloque titulo={t('stock.ord.cli.el_pedido')}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo id={ids.numero} etiqueta={t('stock.ord.numero_orden')} error={err('numero')}>
            <input id={ids.numero} value={f.numero} aria-invalid={!!err('numero')} onChange={(e) => cambiar({ numero: e.target.value })} className={CONTROL + ' h-11'} />
          </Campo>
          <Campo id={ids.cliente} etiqueta={t('stock.ord.cli.cliente')} error={err('cliente')}>
            <select id={ids.cliente} value={f.cliente?.id ?? ''} aria-invalid={!!err('cliente')} onChange={(e) => cambiar({ cliente: clientes.find((c) => c.id === Number(e.target.value)) ?? null })} className={CONTROL + ' h-11'}>
              <option value="">{t('stock.elegir')}</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Campo>
          <Campo id={ids.instalacion} etiqueta={t('stock.ord.instalacion_recibe')} error={err('instalacion')}>
            <select
              id={ids.instalacion}
              value={f.instalacion?.id ?? ''}
              aria-invalid={!!err('instalacion')}
              // Cambiar de instalación cambia los productos que se pueden pedir: los ítems se reinician.
              onChange={(e) => cambiar({ instalacion: conProductos.find((i) => i.id === Number(e.target.value)) ?? null, items: [itemNuevo()] })}
              className={CONTROL + ' h-11'}
            >
              <option value="">{t('stock.elegir')}</option>
              {conProductos.map((i) => <option key={i.id} value={i.id}>{nombreInstalacion(i)}</option>)}
            </select>
          </Campo>
          <Campo id={ids.entrega} etiqueta={t('stock.ord.cli.fecha_limite')} error={err('entrega')}>
            <input id={ids.entrega} type="date" value={f.entrega} aria-invalid={!!err('entrega')} onChange={(e) => cambiar({ entrega: e.target.value })} className={CONTROL + ' h-11'} />
          </Campo>
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input type="checkbox" className="size-4 accent-[var(--marca)]" checked={f.soloMujeres} onChange={(e) => cambiar({ soloMujeres: e.target.checked })} />
            {t('stock.ord.cli.solo_mujeres')}
          </label>
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input type="checkbox" className="size-4 accent-[var(--marca)]" checked={f.soloOrganico} onChange={(e) => cambiar({ soloOrganico: e.target.checked })} />
            {t('stock.ord.cli.solo_organico')}
          </label>
        </div>
      </Bloque>

      <Bloque titulo={t('stock.ord.cli.productos')}>
        {!f.instalacion ? (
          <p className="text-tinta-2">{t('stock.ord.primero_instalacion')}</p>
        ) : (
          <div className="grid gap-4">
            {f.items.map((i, n) => (
              <ItemTarjeta
                key={i.clave}
                n={n + 1}
                item={i}
                empresa={empresa}
                acciones={posibles}
                lote={loteDeItem(f.numero, i)}
                errores={errores.porItem[i.clave] ?? {}}
                alCambiar={(c) => cambiarItem(i.clave, c)}
                alQuitar={f.items.length > 1 ? () => cambiar({ items: f.items.filter((x) => x.clave !== i.clave) }) : undefined}
              />
            ))}
            <Boton variante="secundario" className="justify-self-start" onClick={() => cambiar({ items: [...f.items, itemNuevo()] })}>
              <Icono nombre="mas" className="size-4" /> {t('stock.ord.cli.agregar')}
            </Boton>
            <MensajeError>{err('items')}</MensajeError>
          </div>
        )}
      </Bloque>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-linea bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <Boton onClick={() => void alGuardar()} disabled={crear.isPending}>
            <Icono nombre="ok" className="size-4" /> {crear.isPending ? t('comun.cargando') : t('comun.guardar')}
          </Boton>
        </div>
      </div>
    </>
  );
}

function ItemTarjeta({
  n,
  item,
  empresa,
  acciones,
  lote,
  errores,
  alCambiar,
  alQuitar,
}: {
  n: number;
  item: ItemPedido;
  empresa: number;
  acciones: ApiProcessingAction[];
  lote: string;
  errores: Partial<Record<'accion' | 'proveedor' | 'cantidad' | 'precio' | 'moneda', string>>;
  alCambiar: (c: Partial<ItemPedido>) => void;
  alQuitar?: () => void;
}) {
  const { t } = useTranslation();
  const ids = { accion: useId(), proveedor: useId(), moneda: useId() };
  const final = item.accion?.inputFinalProduct;
  const vendedoras = useQuery({ ...ordenes.vendedoras(empresa, { final: final?.id }), enabled: !!final?.id });
  const err = (k: keyof typeof errores) => (errores[k] ? t(`stock.errores.${errores[k]}`) : undefined);

  // Si hay un solo proveedor posible, queda elegido.
  const lista = vendedoras.data ?? [];
  useEffect(() => {
    if (!item.proveedor && lista.length === 1) alCambiar({ proveedor: lista[0]! });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista.length, item.proveedor]);

  return (
    <fieldset className="grid gap-4 rounded-caja border border-linea p-4 sm:grid-cols-2 [&>*]:min-w-0" aria-label={t('stock.ord.cli.item', { n })}>
      <legend className="sr-only">{t('stock.ord.cli.item', { n })}</legend>
      <div className="flex items-center justify-between sm:col-span-2">
        <span className="font-semibold">{t('stock.ord.cli.item', { n })}</span>
        {alQuitar && (
          <button type="button" onClick={alQuitar} className="rounded-md p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('stock.ord.cli.quitar', { n })}>
            <Icono nombre="borrar" className="size-4" />
          </button>
        )}
      </div>
      <Campo id={ids.accion} etiqueta={t('stock.ord.cli.producto_final')} error={err('accion')}>
        <select id={ids.accion} value={item.accion?.id ?? ''} aria-invalid={!!err('accion')} onChange={(e) => alCambiar({ accion: acciones.find((a) => a.id === Number(e.target.value)) ?? null, proveedor: null })} className={CONTROL + ' h-11'}>
          <option value="">{t('stock.elegir')}</option>
          {acciones.map((a) => <option key={a.id} value={a.id}>{a.inputFinalProduct?.name ?? a.name}</option>)}
        </select>
      </Campo>
      <Campo id={ids.proveedor} etiqueta={t('stock.ord.cli.pedir_a')} error={err('proveedor')}>
        <select id={ids.proveedor} value={item.proveedor?.id ?? ''} disabled={!final} aria-invalid={!!err('proveedor')} onChange={(e) => alCambiar({ proveedor: lista.find((x) => x.id === Number(e.target.value)) ?? null })} className={CONTROL + ' h-11'}>
          <option value="">{final ? t('stock.elegir') : t('stock.ord.cli.primero_producto')}</option>
          {lista.map((x) => <option key={x.id} value={x.id}>{[x.company?.name, nombreInstalacion(x)].filter(Boolean).join(' — ')}</option>)}
        </select>
        {final && vendedoras.isSuccess && lista.length === 0 && <p className="text-sm text-tinta-3">{t('stock.ord.cli.sin_proveedores')}</p>}
      </Campo>
      <NumeroConUnidad etiqueta={t('stock.ord.cantidad_pedida')} requerido valor={item.cantidad} alCambiar={(cantidad) => alCambiar({ cantidad })} unidad={final?.measurementUnitType?.label} error={err('cantidad')} />
      <NumeroConUnidad etiqueta={t('stock.ord.cli.precio')} requerido valor={item.precio} alCambiar={(precio) => alCambiar({ precio })} unidad={item.moneda.trim().toUpperCase() || undefined} error={err('precio')} />
      <Campo id={ids.moneda} etiqueta={t('stock.entrega.moneda')} error={err('moneda')}>
        <input id={ids.moneda} value={item.moneda} maxLength={3} aria-invalid={!!err('moneda')} onChange={(e) => alCambiar({ moneda: e.target.value.toUpperCase() })} className={CONTROL + ' h-11 uppercase'} />
      </Campo>
      <div className="grid content-start gap-1.5">
        <span className="text-sm font-semibold text-tinta-2">{t('stock.ord.cli.lote')}</span>
        <span className="flex min-h-11 items-center rounded-lg bg-superficie-2 px-3.5 text-sm break-words">{lote || '—'}</span>
      </div>
    </fieldset>
  );
}

function Campo({ id, etiqueta, error, children }: { id: string; etiqueta: string; error?: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <Etiqueta htmlFor={id} requerido>{etiqueta}</Etiqueta>
      {children}
      <MensajeError>{error}</MensajeError>
    </div>
  );
}
