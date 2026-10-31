import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { productos, useBorrarFinal, useGuardarFinal } from '@/api/productos';
import type { ApiFinalProduct } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Area, Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useProducto } from './Marco';
import { Casilla, Tarjeta } from './piezas';

type FormFinal = { id?: number; nombre: string; descripcion: string; unidad: number | null; etiquetas: Set<number> };
const vacio = (): FormFinal => ({ nombre: '', descripcion: '', unidad: null, etiquetas: new Set() });

/**
 * Pestaña "Productos finales": lo que se vende hecho con este producto (p. ej. "Café tostado 250 g"),
 * con su unidad y las etiquetas de la vitrina que lo acompañan. Los usa el procesamiento final y los
 * pedidos. Edita la empresa dueña, como en la versión actual.
 */
export function FinalesProducto() {
  const { t } = useTranslation();
  const { producto, editable } = useProducto();
  const lista = useQuery(productos.finales(producto.id!));
  const borrar = useBorrarFinal(producto.id!);
  const [editando, setEditando] = useState<FormFinal | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok'; texto: string } | null>(null);

  async function eliminar(f: ApiFinalProduct) {
    if (!window.confirm(t('productos.finales.borrar_pregunta', { nombre: f.name }))) return;
    setAviso(null);
    try {
      await borrar.mutateAsync(f.id!);
      setAviso({ tono: 'ok', texto: t('productos.finales.borrado', { nombre: f.name }) });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  const items = lista.data?.items ?? [];
  return (
    <div className="grid gap-6">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <Tarjeta
        id="finales"
        titulo={t('productos.finales.titulo')}
        ayuda={t('productos.finales.ayuda')}
        acciones={editable && !editando && (
          <Boton chico onClick={() => setEditando(vacio())}>
            <Icono nombre="mas" className="size-4" /> {t('productos.finales.nuevo')}
          </Boton>
        )}
      >
        {editando && !editando.id && <FormularioFinal inicial={editando} alTerminar={(texto) => { setEditando(null); if (texto) setAviso({ tono: 'ok', texto }); }} />}
        {lista.isPending ? (
          <Cargando />
        ) : lista.isError ? (
          <EstadoError texto={lista.error.message} reintentar={() => void lista.refetch()} />
        ) : items.length === 0 ? (
          !editando && <p className="text-sm text-tinta-3">{t('productos.finales.vacio')}</p>
        ) : (
          <ul className="grid gap-3">
            {items.map((f) =>
              editando?.id === f.id ? (
                <li key={f.id}>
                  <FormularioFinal inicial={editando!} alTerminar={(texto) => { setEditando(null); if (texto) setAviso({ tono: 'ok', texto }); }} />
                </li>
              ) : (
                <li key={f.id} aria-label={f.name} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-linea p-4">
                  <div className="grid gap-1">
                    <p className="font-semibold">{f.name}</p>
                    {f.description && <p className="text-sm text-tinta-2">{f.description}</p>}
                    <p className="text-sm text-tinta-3">
                      {[f.measurementUnitType?.label, (f.labels ?? []).length ? t('productos.finales.con_etiquetas', { etiquetas: (f.labels ?? []).map((l) => l.title).join(', ') }) : t('productos.finales.sin_etiquetas')].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {editable && !editando && (
                    <div className="flex gap-1">
                      <Boton chico variante="fantasma" onClick={() => setEditando({ id: f.id, nombre: f.name ?? '', descripcion: f.description ?? '', unidad: f.measurementUnitType?.id ?? null, etiquetas: new Set((f.labels ?? []).map((l) => l.id!)) })}>
                        <Icono nombre="editar" className="size-4" /> {t('comun.editar')}
                      </Boton>
                      <Boton chico variante="fantasma" onClick={() => void eliminar(f)} disabled={borrar.isPending} aria-label={t('productos.finales.borrar', { nombre: f.name })}>
                        <Icono nombre="borrar" className="size-4" />
                      </Boton>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}

function FormularioFinal({ inicial, alTerminar }: { inicial: FormFinal; alTerminar: (texto?: string) => void }) {
  const { t } = useTranslation();
  const { producto } = useProducto();
  const unidades = useQuery(productos.unidades());
  const guardar = useGuardarFinal(producto.id!);
  const [f, setF] = useState(inicial);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const etiquetas = producto.labels ?? [];
  const faltan = { nombre: !f.nombre.trim(), descripcion: !f.descripcion.trim(), unidad: !f.unidad };
  const req = t('stock.errores.requerido');

  async function alGuardar() {
    setEnviado(true);
    setError(null);
    if (faltan.nombre || faltan.descripcion || faltan.unidad) return;
    try {
      await guardar.mutateAsync({
        id: f.id,
        name: f.nombre.trim(),
        description: f.descripcion.trim(),
        measurementUnitType: { id: f.unidad!, code: '', label: '' },
        labels: [...f.etiquetas].map((id) => ({ id })),
      });
      alTerminar(t('productos.finales.guardado', { nombre: f.nombre.trim() }));
    } catch (x) {
      setError((x as Error).message);
    }
  }

  return (
    <div className="mb-4 grid gap-4 rounded-lg border border-marca/40 bg-marca-suave/30 p-4" role="group" aria-label={f.id ? t('productos.finales.editar') : t('productos.finales.nuevo')}>
      {error && <Aviso tono="mal">{error}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <Campo etiqueta={t('productos.finales.nombre')} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} error={enviado && faltan.nombre && req} />
        <Selector etiqueta={t('productos.finales.unidad')} value={f.unidad ?? ''} onChange={(e) => setF({ ...f, unidad: e.target.value ? Number(e.target.value) : null })} error={enviado && faltan.unidad && req}>
          <option value="">{t('stock.elegir')}</option>
          {(unidades.data?.items ?? []).map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </Selector>
        <Area etiqueta={t('productos.finales.descripcion')} rows={2} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} error={enviado && faltan.descripcion && req} className="sm:col-span-2" />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold text-tinta-2">{t('productos.finales.etiquetas')}</legend>
        {etiquetas.length === 0 ? (
          <p className="text-sm text-tinta-3">{t('productos.finales.sin_etiquetas_producto')}</p>
        ) : (
          etiquetas.map((l) => (
            <Casilla key={l.id} marcada={f.etiquetas.has(l.id!)} alCambiar={(v) => { const s = new Set(f.etiquetas); if (v) s.add(l.id!); else s.delete(l.id!); setF({ ...f, etiquetas: s }); }}>
              {l.title || `#${l.id}`}{l.status === 'UNPUBLISHED' && <span className="text-tinta-3"> ({t('productos.etiquetas.no_publicada')})</span>}
            </Casilla>
          ))
        )}
      </fieldset>
      <div className="flex gap-2">
        <Boton onClick={() => void alGuardar()} disabled={guardar.isPending}>
          <Icono nombre="ok" className="size-4" /> {guardar.isPending ? t('productores.ficha.guardando') : t('comun.guardar')}
        </Boton>
        <Boton variante="secundario" onClick={() => alTerminar()}>{t('comun.cancelar')}</Boton>
      </div>
    </div>
  );
}
