import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useBorrarCliente, useGuardarCliente } from '@/api/clientes';
import { ordenes } from '@/api/ordenes';
import { productores } from '@/api/productores';
import type { ApiCompanyCustomer } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { CAMPOS_DIRECCION, armarCliente, formDesdeCliente, lugarCliente, validarCliente, type ErroresCliente, type FormCliente } from '@/util/cliente';
import { formatoDireccion } from '@/util/productor';
import { Tarjeta } from '../productos/piezas';
import { useEmpresaVista } from './Marco';
import { confirmar } from '@/componentes/ui/Confirmar';

/**
 * Clientes de la empresa: las empresas que le compran y a las que se asignan los pedidos de
 * clientes. Los administra cualquier persona de la empresa (como el backend).
 */
export function ClientesEmpresa() {
  const { t } = useTranslation();
  const { id } = useEmpresaVista();
  const lista = useQuery(ordenes.clientes(id));
  const borrar = useBorrarCliente();
  const [texto, setTexto] = useState('');
  const filtro = useDeferredValue(texto.trim().toLowerCase());
  const [editando, setEditando] = useState<ApiCompanyCustomer | 'nuevo' | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok'; texto: string } | null>(null);
  const items = (lista.data ?? []).filter((c) => !filtro || [c.name, c.officialCompanyName, c.vatId].some((x) => x?.toLowerCase().includes(filtro)));
  const terminar = (texto?: string) => {
    setEditando(null);
    if (texto) setAviso({ tono: 'ok', texto });
  };

  async function eliminar(c: ApiCompanyCustomer) {
    if (!(await confirmar(t('empresa.clientes.borrar_pregunta', { nombre: c.name }), { accion: 'eliminar' }))) return;
    setAviso(null);
    try {
      await borrar.mutateAsync(c.id!);
      setAviso({ tono: 'ok', texto: t('empresa.clientes.borrado', { nombre: c.name }) });
    } catch {
      // El backend responde un error genérico (clave foránea): se explica la causa probable.
      setAviso({ tono: 'mal', texto: t('empresa.clientes.no_se_borra', { nombre: c.name }) });
    }
  }

  return (
    <div className="grid gap-5">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <Tarjeta
        id="clientes"
        titulo={t('empresa.clientes.titulo')}
        ayuda={t('empresa.clientes.ayuda')}
        acciones={!editando && (
          <Boton chico onClick={() => { setAviso(null); setEditando('nuevo'); }}>
            <Icono nombre="mas" className="size-4" /> {t('empresa.clientes.nuevo')}
          </Boton>
        )}
      >
        {editando === 'nuevo' && <Formulario empresa={id} original={null} alTerminar={terminar} />}
        <Campo etiqueta={t('empresa.clientes.buscar')} type="search" placeholder={t('empresa.clientes.buscar_placeholder')} value={texto} onChange={(e) => setTexto(e.target.value)} className="mb-4 sm:max-w-xs" />
        {lista.isPending ? (
          <Cargando />
        ) : lista.isError ? (
          <EstadoError texto={lista.error.message} reintentar={() => void lista.refetch()} />
        ) : items.length === 0 ? (
          <p className="text-sm text-tinta-3">{filtro ? t('empresa.clientes.sin_resultados') : t('empresa.clientes.vacio')}</p>
        ) : (
          <ul className="grid gap-3">
            {items.map((c) =>
              editando !== 'nuevo' && editando?.id === c.id ? (
                <li key={c.id}><Formulario empresa={id} original={c} alTerminar={terminar} /></li>
              ) : (
                <li key={c.id} aria-label={c.name} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-linea p-4">
                  <div className="grid min-w-0 gap-1">
                    <p className="font-semibold break-words">{c.name}</p>
                    <p className="text-sm text-tinta-2">{[c.officialCompanyName, c.vatId && t('empresa.clientes.nif_de', { nif: c.vatId }), lugarCliente(c)].filter(Boolean).join(' · ')}</p>
                    {(c.contact || c.email || c.phone) && <p className="text-sm text-tinta-3 break-words">{[c.contact, c.email, c.phone].filter(Boolean).join(' · ')}</p>}
                  </div>
                  {!editando && (
                    <div className="flex gap-1">
                      <Boton chico variante="fantasma" onClick={() => { setAviso(null); setEditando(c); }}>
                        <Icono nombre="editar" className="size-4" /> {t('comun.editar')}
                      </Boton>
                      <Boton chico variante="fantasma" onClick={() => void eliminar(c)} disabled={borrar.isPending} aria-label={t('empresa.clientes.borrar', { nombre: c.name })}>
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

function Formulario({ empresa, original, alTerminar }: { empresa: number; original: ApiCompanyCustomer | null; alTerminar: (texto?: string) => void }) {
  const { t } = useTranslation();
  const paises = useQuery(productores.paises());
  const guardar = useGuardarCliente();
  const [f, setF] = useState<FormCliente>(() => formDesdeCliente(original));
  const [errores, setErrores] = useState<ErroresCliente>({});
  const [error, setError] = useState<string | null>(null);
  const cambiar = (c: Partial<FormCliente>) => setF((x) => ({ ...x, ...c }));
  const msg = (k?: string) => {
    if (!k) return undefined;
    const [codigo, max] = k.startsWith('largo_') ? ['largo', k.slice(6)] : [k, undefined];
    return t(`empresa.errores.${codigo}`, { max, defaultValue: t(`stock.errores.${codigo}`) });
  };
  const campos = CAMPOS_DIRECCION[formatoDireccion(f.codigoPais)];

  async function alGuardar() {
    setError(null);
    const e = validarCliente(f);
    setErrores(e);
    if (Object.keys(e).length) return;
    try {
      await guardar.mutateAsync(armarCliente(original, f, empresa, paises.data ?? []));
      alTerminar(t('empresa.clientes.guardado', { nombre: f.nombre.trim() }));
    } catch (x) {
      setError((x as Error).message);
    }
  }

  const req = (texto: string) => <>{texto} <span className="text-mal" aria-hidden>*</span></>;
  return (
    <div role="group" aria-label={original ? t('empresa.clientes.editar') : t('empresa.clientes.nuevo')} className="mb-4 grid gap-4 rounded-lg border border-marca/40 bg-marca-suave/30 p-4">
      {error && <Aviso tono="mal">{error}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <Campo etiqueta={req(t('empresa.clientes.nombre'))} value={f.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} error={msg(errores.nombre)} />
        <Campo etiqueta={t('empresa.clientes.oficial')} value={f.oficial} onChange={(e) => cambiar({ oficial: e.target.value })} />
        <Campo etiqueta={t('empresa.clientes.nif')} value={f.nif} onChange={(e) => cambiar({ nif: e.target.value })} />
        <Campo etiqueta={t('empresa.clientes.contacto')} value={f.contacto} onChange={(e) => cambiar({ contacto: e.target.value })} />
        <Campo etiqueta={t('empresa.clientes.correo')} type="email" value={f.correo} onChange={(e) => cambiar({ correo: e.target.value })} error={msg(errores.correo)} />
        <Campo etiqueta={t('empresa.clientes.telefono')} type="tel" value={f.telefono} onChange={(e) => cambiar({ telefono: e.target.value })} />
        <Selector etiqueta={req(t('empresa.pais'))} value={f.pais ?? ''} error={msg(errores.pais)} onChange={(e) => {
          const p = (paises.data ?? []).find((x) => x.id === Number(e.target.value));
          cambiar({ pais: p?.id ?? null, codigoPais: p?.code ?? '' });
        }}>
          <option value="">{t('stock.elegir')}</option>
          {(paises.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Selector>
        {campos.map((k) => (
          <Campo key={k} etiqueta={t(`empresa.clientes.dir.${k}`)} value={f.dir[k]} onChange={(e) => cambiar({ dir: { ...f.dir, [k]: e.target.value } })} error={k === 'zip' ? msg(errores.zip) : undefined} />
        ))}
      </div>
      <div className="flex gap-2">
        <Boton onClick={() => void alGuardar()} disabled={guardar.isPending}>
          <Icono nombre="ok" className="size-4" /> {guardar.isPending ? t('productores.ficha.guardando') : t('comun.guardar')}
        </Boton>
        <Boton variante="secundario" onClick={() => alTerminar()}>{t('comun.cancelar')}</Boton>
      </div>
    </div>
  );
}
