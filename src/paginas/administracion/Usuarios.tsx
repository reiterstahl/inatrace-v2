import { useDeferredValue, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { administracion, useAccionCuenta } from '@/api/administracion';
import { consultas } from '@/api/consultas';
import { POR_PAGINA } from '@/api/productores';
import type { ApiUserBase } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { ESTADOS_USUARIO, ROLES_USUARIO, accionesUsuario, type AccionUsuario, type EstadoUsuario, type RolUsuario } from '@/util/administracion';

export const TONO_ESTADO_USUARIO: Record<EstadoUsuario, string> = {
  ACTIVE: 'bg-ok-suave text-ok',
  CONFIRMED_EMAIL: 'bg-aviso-suave text-aviso',
  UNCONFIRMED: 'bg-aviso-suave text-aviso',
  DEACTIVATED: 'bg-superficie-2 text-tinta-3',
};

export const nombrePersona = (u: Pick<ApiUserBase, 'name' | 'surname' | 'email'>) => [u.name, u.surname].filter(Boolean).join(' ') || u.email || '—';

/** Botones de las acciones sobre una persona, con confirmación; los usa la lista y la ficha. */
export function AccionesPersona({ usuario, alTerminar }: { usuario: ApiUserBase; alTerminar: (aviso: { tono: 'ok' | 'mal'; texto: string }) => void }) {
  const { t } = useTranslation();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const accion = useAccionCuenta();
  const nombre = nombrePersona(usuario);

  async function ejecutar(a: AccionUsuario) {
    if (!window.confirm(t(`administracion.usuarios.acciones.${a}_pregunta`, { nombre }))) return;
    try {
      await accion.mutateAsync({ accion: a, usuario: usuario.id! });
      alTerminar({ tono: 'ok', texto: t(`administracion.usuarios.acciones.${a}_hecho`, { nombre }) });
    } catch (x) {
      alTerminar({ tono: 'mal', texto: (x as Error).message });
    }
  }

  return accionesUsuario(usuario, yo).map((a) => (
    <Boton key={a} chico variante={a === 'DEACTIVATE_USER' || a.startsWith('UNSET') ? 'fantasma' : 'secundario'} disabled={accion.isPending} onClick={() => void ejecutar(a)} aria-label={t(`administracion.usuarios.acciones.${a}_de`, { nombre })}>
      {t(`administracion.usuarios.acciones.${a}`)}
    </Boton>
  ));
}

/**
 * Personas de la instancia: buscar por nombre, apellido o correo, filtrar por estado y rol, y
 * confirmar, activar, desactivar o cambiar el rol. La regional ve las de sus empresas y las que
 * todavía no tienen empresa, y solo confirma y activa.
 */
export function UsuariosAdministracion() {
  const { t } = useTranslation();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const sistema = yo.role === 'SYSTEM_ADMIN';
  const [texto, setTexto] = useState('');
  const busqueda = useDeferredValue(texto);
  const [estado, setEstado] = useState<EstadoUsuario | ''>('');
  const [rol, setRol] = useState<RolUsuario | ''>('');
  const [pagina, setPagina] = useState(1);
  const consulta = useQuery(administracion.usuarios({ texto: busqueda, estado: estado || undefined, rol: rol || undefined, pagina }, sistema));
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'mal'; texto: string } | null>(null);

  const items = consulta.data?.items ?? [];
  const total = consulta.data?.count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const filtrado = !!(busqueda.trim() || estado || rol);

  return (
    <div className="grid gap-5">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta={t('administracion.usuarios.buscar')} type="search" placeholder={t('administracion.usuarios.buscar_placeholder')} value={texto} onChange={(e) => { setTexto(e.target.value); setPagina(1); }} className="sm:w-64" />
        <Selector etiqueta={t('administracion.usuarios.estado')} value={estado} onChange={(e) => { setEstado(e.target.value as EstadoUsuario | ''); setPagina(1); }} className="sm:w-48">
          <option value="">{t('administracion.empresas.todos')}</option>
          {ESTADOS_USUARIO.map((s) => <option key={s} value={s}>{t(`perfil.estados.${s}`)}</option>)}
        </Selector>
        <Selector etiqueta={t('administracion.usuarios.rol')} value={rol} onChange={(e) => { setRol(e.target.value as RolUsuario | ''); setPagina(1); }} className="sm:w-56">
          <option value="">{t('administracion.empresas.todos')}</option>
          {ROLES_USUARIO.map((r) => <option key={r} value={r}>{t(`perfil.roles.${r}`)}</option>)}
        </Selector>
      </div>

      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} />
      ) : items.length === 0 ? (
        <p className="text-tinta-3">{filtrado ? t('administracion.usuarios.sin_resultados') : t('administracion.usuarios.vacio')}</p>
      ) : (
        <>
          <p className="text-sm text-tinta-3">{t('administracion.usuarios.total', { count: total })}</p>
          <ul className="grid gap-3">
            {items.map((u) => (
              <li key={u.id} aria-label={nombrePersona(u)} className="flex flex-wrap items-center justify-between gap-3 rounded-caja border border-linea bg-superficie p-4 shadow-suave">
                <Link to="/administracion/usuarios/$id" params={{ id: String(u.id) }} className="grid min-w-0 gap-0.5 hover:text-marca">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold break-words">{nombrePersona(u)}</span>
                    {u.role && u.role !== 'USER' && <span className="rounded-full bg-marca-suave px-2.5 py-0.5 text-xs font-semibold text-marca">{t(`perfil.roles.${u.role}`)}</span>}
                    {u.status && <span className={'rounded-full px-2.5 py-0.5 text-xs font-semibold ' + TONO_ESTADO_USUARIO[u.status]}>{t(`perfil.estados.${u.status}`)}</span>}
                  </span>
                  <span className="text-sm break-all text-tinta-2">{u.email}</span>
                </Link>
                <div className="flex flex-wrap gap-2">
                  <AccionesPersona usuario={u} alTerminar={setAviso} />
                </div>
              </li>
            ))}
          </ul>
          {paginas > 1 && (
            <nav aria-label={t('productos.lotes.paginas')} className="flex items-center justify-end gap-2 text-sm">
              <Boton chico variante="secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} aria-label={t('productos.lotes.anterior')}><Icono nombre="izquierda" className="size-4" /></Boton>
              <span>{pagina} / {paginas}</span>
              <Boton chico variante="secundario" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)} aria-label={t('productos.lotes.siguiente')}><Icono nombre="derecha" className="size-4" /></Boton>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
