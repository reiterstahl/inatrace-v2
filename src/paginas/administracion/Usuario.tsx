import { useEffect, useState, type FormEvent } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { administracion, useGuardarCuenta } from '@/api/administracion';
import { productores } from '@/api/productores';
import type { ApiUserGet } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { IDIOMAS, aApi, deApi, type Idioma } from '@/i18n';
import { validarPersona, type ErroresPersona } from '@/util/administracion';
import { elegirEmpresa } from '@/util/empresa';
import { Tarjeta } from '../productos/piezas';
import { AccionesPersona, TONO_ESTADO_USUARIO, nombrePersona } from './Usuarios';

const ruta = getRouteApi('/portal/administracion/usuarios/$id');

/** Ficha de una persona para la administración: datos, estado y rol, y sus empresas. */
export function UsuarioAdministracion() {
  const { t } = useTranslation();
  const id = Number(ruta.useParams().id);
  const consulta = useQuery(administracion.usuario(id));
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'mal'; texto: string } | null>(null);

  const volver = (
    <Link to="/administracion/usuarios" className="inline-flex items-center gap-1.5 text-sm font-semibold text-marca hover:underline">
      <Icono nombre="volver" className="size-4" /> {t('administracion.usuarios.volver')}
    </Link>
  );
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <div className="grid gap-4">{volver}<EstadoError texto={consulta.error.message} reintentar={() => void consulta.refetch()} /></div>;
  const u = consulta.data;

  return (
    <div className="grid gap-5">
      {volver}
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="font-titulo text-2xl font-semibold tracking-tight break-words">{nombrePersona(u)}</h2>
        {u.role && <span className="rounded-full bg-marca-suave px-2.5 py-0.5 text-xs font-semibold text-marca">{t(`perfil.roles.${u.role}`)}</span>}
        {u.status && <span className={'rounded-full px-2.5 py-0.5 text-xs font-semibold ' + TONO_ESTADO_USUARIO[u.status]}>{t(`perfil.estados.${u.status}`)}</span>}
      </header>
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <AccionesPersona usuario={u} alTerminar={setAviso} />
      </div>
      <DatosPersona key={`${u.id}-${u.name}-${u.surname}-${u.language}`} usuario={u} />
      <EmpresasPersona usuario={u} />
    </div>
  );
}

function DatosPersona({ usuario: u }: { usuario: ApiUserGet }) {
  const { t } = useTranslation();
  const guardar = useGuardarCuenta();
  const [nombre, setNombre] = useState(u.name ?? '');
  const [apellido, setApellido] = useState(u.surname ?? '');
  const [idioma, setIdioma] = useState<Idioma>(deApi(u.language) ?? 'en');
  const [errores, setErrores] = useState<ErroresPersona | null>(null);
  const [listo, setListo] = useState(false);
  const cambio = nombre !== (u.name ?? '') || apellido !== (u.surname ?? '') || idioma !== (deApi(u.language) ?? 'en');
  useEffect(() => {
    if (errores) setErrores(validarPersona({ nombre, apellido }));
  }, [nombre, apellido]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const v = validarPersona({ nombre, apellido });
    setErrores(v);
    if (Object.keys(v).length) return;
    setListo(false);
    await guardar.mutateAsync({ id: u.id, name: nombre.trim(), surname: apellido.trim(), language: aApi(idioma) });
    setListo(true);
  }

  return (
    <Tarjeta id="datos" titulo={t('administracion.usuarios.datos')}>
      <form onSubmit={enviar} noValidate className="grid gap-5">
        {listo && !cambio && <Aviso tono="ok">{t('comun.guardado')}</Aviso>}
        {guardar.isError && <Aviso tono="mal">{guardar.error.message}</Aviso>}
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta={t('perfil.nombre')} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} error={errores?.nombre && t('administracion.usuarios.requerido')} />
          <Campo etiqueta={t('perfil.apellido')} value={apellido} onChange={(e) => setApellido(e.target.value)} maxLength={100} error={errores?.apellido && t('administracion.usuarios.requerido')} />
          <Campo etiqueta={t('perfil.correo')} value={u.email ?? ''} readOnly />
          <Selector etiqueta={t('perfil.idioma')} value={idioma} onChange={(e) => setIdioma(e.target.value as Idioma)}>
            {IDIOMAS.map((l) => <option key={l} value={l}>{t(`idiomas.${l}`)}</option>)}
          </Selector>
        </div>
        <div className="flex justify-end">
          <Boton type="submit" disabled={!cambio || guardar.isPending}>{t('comun.guardar')}</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

/** Empresas de la persona (para la regional, solo las que comparten). Se abren para trabajar con ellas. */
function EmpresasPersona({ usuario: u }: { usuario: ApiUserGet }) {
  const { t } = useTranslation();
  const ids = u.companyIds ?? [];
  const nombres = useQueries({ queries: ids.map((id) => productores.empresa(id)) });
  const qc = useQueryClient();
  const navegar = useNavigate();

  async function abrir(id: number) {
    elegirEmpresa(id);
    void qc.invalidateQueries({ queryKey: ['productores'] });
    await navegar({ to: '/empresa/usuarios' });
  }

  return (
    <Tarjeta id="empresas" titulo={t('administracion.usuarios.empresas')} ayuda={t('administracion.usuarios.empresas_ayuda')}>
      {ids.length === 0 ? (
        <p className="text-tinta-3">{t('administracion.usuarios.sin_empresas')}</p>
      ) : (
        <ul className="divide-y divide-linea">
          {ids.map((id, i) => {
            const nombre = nombres[i]?.data?.name ?? `#${id}`;
            return (
              <li key={id} aria-label={nombre} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{nombre}</span>
                  {(u.companyIdsAdmin ?? []).includes(id) && <span className="rounded-full bg-superficie-2 px-2 py-0.5 text-xs font-semibold text-tinta-2">{t('administracion.usuarios.administra')}</span>}
                </span>
                <Boton chico variante="secundario" onClick={() => void abrir(id)} aria-label={t('administracion.empresas.abrir_de', { nombre })}>
                  <Icono nombre="flecha" className="size-4" /> {t('administracion.empresas.abrir')}
                </Boton>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}
