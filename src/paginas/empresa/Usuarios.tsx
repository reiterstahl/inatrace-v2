import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { empresa as consultasEmpresa, useAccionUsuario } from '@/api/empresa';
import { stock } from '@/api/stock';
import type { ApiCompanyUser, ApiUserBase } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { ROLES_EMPRESA, dejaSinAdministracion, type RolEmpresa } from '@/util/fichaEmpresa';
import { Tarjeta } from '../productos/piezas';
import { useEmpresaVista } from './Marco';
import { confirmar } from '@/componentes/ui/Confirmar';

const nombreDe = (u: ApiCompanyUser | ApiUserBase) => [u.name, u.surname].filter(Boolean).join(' ') || u.email || `#${u.id}`;

/**
 * Personas de la empresa y su rol. Sumar, cambiar de rol y quitar lo hace la administración del
 * sistema o regional, como en la versión actual; la v2 además no deja a la empresa sin nadie que la
 * administre (el backend no lo impide).
 */
export function UsuariosEmpresa() {
  const { t } = useTranslation();
  const { id, gestionaUsuarios, regional, yo } = useEmpresaVista();
  const lista = useQuery(stock.usuariosEmpresa(id));
  const accion = useAccionUsuario(id);
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok'; texto: string } | null>(null);
  const usuarios = lista.data ?? [];

  async function ejecutar(a: Parameters<typeof accion.mutateAsync>[0], ok: string) {
    setAviso(null);
    try {
      await accion.mutateAsync(a);
      setAviso({ tono: 'ok', texto: ok });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  function cambiarRol(u: ApiCompanyUser, rol: RolEmpresa) {
    if (dejaSinAdministracion(usuarios, u.id!, rol)) {
      setAviso({ tono: 'mal', texto: t('empresa.usuarios.ultima_admin') });
      return;
    }
    void ejecutar({ accion: 'SET_USER_COMPANY_ROLE', usuario: u.id!, rol }, t('empresa.usuarios.rol_cambiado', { nombre: nombreDe(u), rol: t(`empresa.roles.${rol}`) }));
  }

  async function quitar(u: ApiCompanyUser) {
    if (dejaSinAdministracion(usuarios, u.id!)) {
      setAviso({ tono: 'mal', texto: t('empresa.usuarios.ultima_admin') });
      return;
    }
    if (!(await confirmar(t(u.id === yo ? 'empresa.usuarios.quitarme_pregunta' : 'empresa.usuarios.quitar_pregunta', { nombre: nombreDe(u) }), { accion: 'quitar' }))) return;
    void ejecutar({ accion: 'REMOVE_USER_FROM_COMPANY', usuario: u.id! }, t('empresa.usuarios.quitada', { nombre: nombreDe(u) }));
  }

  return (
    <div className="grid gap-5">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <Tarjeta id="usuarios" titulo={t('empresa.usuarios.titulo')} ayuda={gestionaUsuarios ? t('empresa.usuarios.ayuda_admin') : t('empresa.usuarios.ayuda')}>
        {lista.isPending ? (
          <Cargando />
        ) : lista.isError ? (
          <EstadoError texto={lista.error.message} reintentar={() => void lista.refetch()} />
        ) : usuarios.length === 0 ? (
          <p className="text-sm text-tinta-3">{t('empresa.usuarios.vacio')}</p>
        ) : (
          <ul className="grid gap-2">
            {usuarios.map((u) => (
              <li key={u.id} aria-label={nombreDe(u)} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-linea p-3">
                <div className="min-w-0">
                  <p className="font-semibold break-words">{nombreDe(u)} {u.id === yo && <span className="text-sm font-normal text-tinta-3">({t('empresa.usuarios.vos')})</span>}</p>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-tinta-2">
                    <span className="break-all">{u.email}</span>
                    {u.status && u.status !== 'ACTIVE' && <span className="rounded-full bg-superficie-2 px-2 py-0.5 text-xs font-semibold text-tinta-3">{t(`empresa.estados.${u.status}`)}</span>}
                  </p>
                </div>
                {gestionaUsuarios ? (
                  <div className="flex items-end gap-1">
                    <Selector etiqueta={<span className="sr-only">{t('empresa.usuarios.rol_de', { nombre: nombreDe(u) })}</span>} value={u.companyRole ?? ''} onChange={(e) => cambiarRol(u, e.target.value as RolEmpresa)} disabled={accion.isPending}>
                      {!u.companyRole && <option value="">—</option>}
                      {ROLES_EMPRESA.map((r) => <option key={r} value={r}>{t(`empresa.roles.${r}`)}</option>)}
                    </Selector>
                    <Boton chico variante="fantasma" onClick={() => quitar(u)} disabled={accion.isPending} aria-label={t('empresa.usuarios.quitar', { nombre: nombreDe(u) })} className="mb-1">
                      <Icono nombre="borrar" className="size-4" />
                    </Boton>
                  </div>
                ) : (
                  <span className={clsx('rounded-full px-2.5 py-1 text-xs font-semibold', u.companyRole === 'COMPANY_ADMIN' ? 'bg-marca-suave text-marca' : 'bg-superficie-2 text-tinta-2')}>
                    {u.companyRole ? t(`empresa.roles.${u.companyRole}`) : '—'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
      {gestionaUsuarios && (
        <Sumar
          regional={regional}
          miembros={new Set(usuarios.map((u) => u.id!))}
          ocupado={accion.isPending}
          alSumar={(u, rol) => ejecutar({ accion: 'ADD_USER_TO_COMPANY', usuario: u.id!, rol }, t('empresa.usuarios.sumada', { nombre: nombreDe(u) }))}
        />
      )}
    </div>
  );
}

function Sumar({ regional, miembros, ocupado, alSumar }: { regional: boolean; miembros: Set<number>; ocupado: boolean; alSumar: (u: ApiUserBase, rol: RolEmpresa) => Promise<void> }) {
  const { t } = useTranslation();
  const [texto, setTexto] = useState('');
  const busqueda = useDeferredValue(texto.trim());
  const [rol, setRol] = useState<RolEmpresa>('COMPANY_USER');
  const resultados = useQuery(consultasEmpresa.buscarUsuarios(busqueda, regional));
  const candidatos = (resultados.data ?? []).filter((u) => !miembros.has(u.id!));

  return (
    <Tarjeta id="sumar" titulo={t('empresa.usuarios.sumar')} ayuda={t('empresa.usuarios.sumar_ayuda')}>
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem] [&>*]:min-w-0">
        <Campo etiqueta={t('empresa.usuarios.buscar')} type="search" placeholder={t('empresa.usuarios.buscar_placeholder')} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <Selector etiqueta={t('empresa.usuarios.rol')} value={rol} onChange={(e) => setRol(e.target.value as RolEmpresa)}>
          {ROLES_EMPRESA.map((r) => <option key={r} value={r}>{t(`empresa.roles.${r}`)}</option>)}
        </Selector>
      </div>
      {busqueda.length >= 2 && (
        <div className="mt-4">
          {resultados.isPending ? (
            <Cargando />
          ) : resultados.isError ? (
            <EstadoError texto={resultados.error.message} reintentar={() => void resultados.refetch()} />
          ) : candidatos.length === 0 ? (
            <p className="text-sm text-tinta-3">{t('empresa.usuarios.sin_resultados')}</p>
          ) : (
            <ul className="grid gap-2" aria-label={t('empresa.usuarios.resultados')}>
              {candidatos.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-linea p-3 text-sm">
                  <span className="min-w-0 break-words"><span className="font-semibold">{nombreDe(u)}</span> · {u.email}</span>
                  <Boton chico variante="secundario" disabled={ocupado} onClick={() => void alSumar(u, rol).then(() => setTexto(''))} aria-label={t('empresa.usuarios.sumar_a', { nombre: nombreDe(u) })}>
                    <Icono nombre="mas" className="size-4" /> {t('empresa.agregar')}
                  </Boton>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
