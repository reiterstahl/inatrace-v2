import { useDeferredValue, useState } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useBorrarAccion } from '@/api/acciones';
import { procesamiento } from '@/api/procesamiento';
import type { ApiProcessingAction } from '@/api/gen/types.gen';
import { Boton, clasesBoton } from '@/componentes/ui/Boton';
import { Campo } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { nombreAccion } from '@/util/accion';
import { Tarjeta } from '../productos/piezas';
import { useEmpresaVista } from './Marco';
import { confirmar } from '@/componentes/ui/Confirmar';

const ruta = getRouteApi('/portal/empresa/acciones/');

/** «Cereza → Pergamino, Oro» o «Bolsa 340 g» según el tipo de acción. */
function recorrido(a: ApiProcessingAction): string {
  const final = (f?: { name?: string; product?: { name?: string } }) => (f ? [f.name, f.product?.name && `(${f.product.name})`].filter(Boolean).join(' ') : '');
  const entrada = a.inputSemiProduct?.name || final(a.inputFinalProduct);
  const salida = (a.outputSemiProducts ?? []).map((s) => s.name).filter(Boolean).join(', ') || final(a.outputFinalProduct) || final(a.qrCodeForFinalProduct);
  return [entrada, salida].filter(Boolean).join(' → ');
}

/**
 * Acciones de procesamiento de la empresa: qué procesos, traslados, pedidos y QR se pueden registrar
 * en stock. Las administra la administración de la empresa o del sistema.
 */
export function AccionesEmpresa() {
  const { t } = useTranslation();
  const { id, editable } = useEmpresaVista();
  const { guardada } = ruta.useSearch();
  const lista = useQuery(procesamiento.acciones(id));
  const borrar = useBorrarAccion();
  const [texto, setTexto] = useState('');
  const filtro = useDeferredValue(texto.trim().toLowerCase());
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok'; texto: string } | null>(guardada ? { tono: 'ok', texto: t('empresa.acciones.guardada', { nombre: guardada }) } : null);
  const items = (lista.data ?? []).filter((a) => !filtro || nombreAccion(a).toLowerCase().includes(filtro) || (a.prefix ?? '').toLowerCase().includes(filtro));

  async function eliminar(a: ApiProcessingAction) {
    const nombre = nombreAccion(a);
    if (!(await confirmar(t('empresa.acciones.borrar_pregunta', { nombre }), { accion: 'eliminar' }))) return;
    setAviso(null);
    try {
      await borrar.mutateAsync(a.id!);
      setAviso({ tono: 'ok', texto: t('empresa.acciones.borrada', { nombre }) });
    } catch {
      // El backend responde un error genérico (clave foránea): se explica la causa probable.
      setAviso({ tono: 'mal', texto: t('empresa.acciones.no_se_borra', { nombre }) });
    }
  }

  return (
    <div className="grid gap-5">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <Tarjeta
        id="acciones"
        titulo={t('empresa.acciones.titulo')}
        ayuda={editable ? t('empresa.acciones.ayuda') : t('empresa.acciones.ayuda_lectura')}
        acciones={editable && (
          <Link to="/empresa/acciones/nueva" className={clasesBoton('primario', true)}>
            <Icono nombre="mas" className="size-4" /> {t('empresa.acciones.nueva')}
          </Link>
        )}
      >
        <Campo etiqueta={t('empresa.acciones.buscar')} type="search" placeholder={t('empresa.acciones.buscar_placeholder')} value={texto} onChange={(e) => setTexto(e.target.value)} className="mb-4 sm:max-w-xs" />
        {lista.isPending ? (
          <Cargando />
        ) : lista.isError ? (
          <EstadoError texto={lista.error.message} reintentar={() => void lista.refetch()} />
        ) : items.length === 0 ? (
          <p className="text-sm text-tinta-3">{filtro ? t('empresa.acciones.sin_resultados') : t('empresa.acciones.vacio')}</p>
        ) : (
          <ul className="grid gap-3">
            {items.map((a) => (
              <li key={a.id} aria-label={nombreAccion(a)} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-linea p-4">
                <div className="grid min-w-0 gap-1">
                  <p className="font-semibold break-words">{nombreAccion(a)}</p>
                  <p className="text-sm text-tinta-2">{recorrido(a)}</p>
                  <p className="flex flex-wrap gap-2 text-xs">
                    {a.type && <span className="rounded-full bg-marca-suave px-2 py-0.5 font-semibold text-marca">{t(`empresa.acciones.tipos.${a.type}`)}</span>}
                    {a.prefix && <span className="rounded-full bg-superficie-2 px-2 py-0.5 font-mono font-semibold text-tinta-2">{a.prefix}</span>}
                  </p>
                </div>
                {editable && (
                  <div className="flex flex-wrap gap-1">
                    <Link to="/empresa/acciones/$accion" params={{ accion: String(a.id) }} className={clasesBoton('fantasma', true)}>
                      <Icono nombre="editar" className="size-4" /> {t('comun.editar')}
                    </Link>
                    <Boton chico variante="fantasma" onClick={() => void eliminar(a)} disabled={borrar.isPending} aria-label={t('empresa.acciones.borrar', { nombre: nombreAccion(a) })}>
                      <Icono nombre="borrar" className="size-4" />
                    </Boton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
