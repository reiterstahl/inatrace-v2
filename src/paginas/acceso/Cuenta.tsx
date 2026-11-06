import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas } from '@/api/consultas';
import { haySesion, useConfirmarCorreo, usePedirRestablecer, useRegistrar, useRestablecer } from '@/api/cuenta';
import { ErrorApi } from '@/api/respuesta';
import { Boton } from '@/componentes/ui/Boton';
import { Campo } from '@/componentes/ui/Campo';
import { Aviso, Cargando } from '@/componentes/ui/Estados';
import { CLAVE_MAX, CLAVE_MIN, validarClave, validarRegistro, type ErroresRegistro, type FormRegistro } from '@/util/cuenta';
import { MarcoAcceso } from './MarcoAcceso';

/** Las condiciones de uso de la plataforma: el mismo enlace que la versión actual. */
const CONDICIONES = 'https://www.nachhaltige-agrarlieferketten.org/en/privacy/';
const estado = (e: unknown) => (e instanceof ErrorApi ? e.estado : '');

function VolverAlIngreso() {
  const { t } = useTranslation();
  return <Link to="/ingreso" className="mt-6 text-sm font-semibold text-marca hover:underline">{t('cuenta.ir_al_ingreso')}</Link>;
}

/** Crear una cuenta: queda sin activar hasta que confirma el correo y la administración la activa. */
export function Registro() {
  const { t, i18n } = useTranslation();
  const registrar = useRegistrar();
  const [f, setF] = useState<FormRegistro>({ nombre: '', apellido: '', correo: '', clave: '', repetir: '', acepta: false });
  const [errores, setErrores] = useState<ErroresRegistro | null>(null);
  const cambiar = (c: Partial<FormRegistro>) => {
    const nuevo = { ...f, ...c };
    setF(nuevo);
    if (errores) setErrores(validarRegistro(nuevo));
  };
  const msg = (k: keyof FormRegistro) => (errores?.[k] ? t(`cuenta.errores.${errores[k]}`, { min: CLAVE_MIN, max: CLAVE_MAX }) : undefined);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const v = validarRegistro(f);
    setErrores(v);
    if (Object.keys(v).length) return;
    try {
      const idioma = i18n.language.slice(0, 2).toUpperCase() as 'ES' | 'EN' | 'DE' | 'RW';
      await registrar.mutateAsync({ name: f.nombre.trim(), surname: f.apellido.trim(), email: f.correo.trim(), password: f.clave, language: idioma });
    } catch {
      /* el mensaje sale de registrar.error */
    }
  }

  if (registrar.isSuccess) {
    return (
      <MarcoAcceso titulo={t('cuenta.registro.listo_titulo')}>
        <Aviso tono="ok">{t('cuenta.registro.listo', { correo: f.correo.trim() })}</Aviso>
        <VolverAlIngreso />
      </MarcoAcceso>
    );
  }
  // El backend responde «User already exists» (INVALID_REQUEST) o «Invalid password» (VALIDATION_ERROR).
  const falla = registrar.error
    ? estado(registrar.error) === 'INVALID_REQUEST' ? t('cuenta.registro.ya_existe') : estado(registrar.error) === 'VALIDATION_ERROR' ? t('cuenta.errores.clave_corta', { min: CLAVE_MIN, max: CLAVE_MAX }) : registrar.error.message
    : '';

  return (
    <MarcoAcceso titulo={t('cuenta.registro.titulo')} subtitulo={t('cuenta.registro.subtitulo')}>
      <form onSubmit={enviar} className="mt-8 grid gap-4" noValidate>
        {falla && <Aviso tono="mal">{falla}{estado(registrar.error) === 'INVALID_REQUEST' && <> <Link to="/olvide-clave" className="font-semibold underline">{t('acceso.olvido')}</Link></>}</Aviso>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('perfil.nombre')} autoComplete="given-name" value={f.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} error={msg('nombre')} />
          <Campo etiqueta={t('perfil.apellido')} autoComplete="family-name" value={f.apellido} onChange={(e) => cambiar({ apellido: e.target.value })} error={msg('apellido')} />
        </div>
        <Campo etiqueta={t('acceso.correo')} type="email" autoComplete="email" value={f.correo} onChange={(e) => cambiar({ correo: e.target.value })} error={msg('correo')} />
        <Campo etiqueta={t('acceso.clave')} type="password" autoComplete="new-password" ayuda={t('cuenta.clave_ayuda', { min: CLAVE_MIN, max: CLAVE_MAX })} value={f.clave} onChange={(e) => cambiar({ clave: e.target.value })} error={msg('clave')} />
        <Campo etiqueta={t('cuenta.repetir')} type="password" autoComplete="new-password" value={f.repetir} onChange={(e) => cambiar({ repetir: e.target.value })} error={msg('repetir')} />
        <div className="grid gap-1">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={f.acepta} onChange={(e) => cambiar({ acepta: e.target.checked })} className="mt-0.5 size-4 accent-[var(--marca)]" />
            <span>
              {t('cuenta.registro.acepto')}{' '}
              <a href={CONDICIONES} target="_blank" rel="noopener noreferrer" className="font-semibold text-marca underline">{t('cuenta.registro.condiciones')}</a>
            </span>
          </label>
          {errores?.acepta && <p className="text-sm text-mal" role="alert">{t('cuenta.errores.aceptar')}</p>}
        </div>
        <Boton type="submit" disabled={registrar.isPending} className="mt-1 w-full">{registrar.isPending ? t('cuenta.registro.creando') : t('cuenta.registro.crear')}</Boton>
      </form>
      <p className="mt-6 text-sm text-tinta-2">
        {t('cuenta.registro.ya_tienes')} <Link to="/ingreso" className="font-semibold text-marca hover:underline">{t('acceso.ingresar')}</Link>
      </p>
    </MarcoAcceso>
  );
}

const rutaConfirmar = getRouteApi('/confirm-email/$token');

/**
 * El enlace del correo de confirmación (misma ruta que la versión actual, bajo /v2). El código se usa
 * una sola vez: la confirmación corre al abrir la página, y no se repite.
 */
export function ConfirmarCorreo() {
  const { t } = useTranslation();
  const { token } = rutaConfirmar.useParams();
  const confirmar = useConfirmarCorreo();
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    confirmar.mutate(token);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MarcoAcceso titulo={t('cuenta.confirmar.titulo')}>
      <div className="mt-6">
        {confirmar.isSuccess ? (
          <Aviso tono="ok">{t('cuenta.confirmar.listo')}</Aviso>
        ) : confirmar.isError ? (
          <Aviso tono="mal">{estado(confirmar.error) === 'AUTH_ERROR' ? t('cuenta.enlace_invalido') : confirmar.error.message}</Aviso>
        ) : (
          <Cargando />
        )}
      </div>
      <VolverAlIngreso />
    </MarcoAcceso>
  );
}

/** Pedir el enlace para restablecer la contraseña. La respuesta no revela si el correo tiene cuenta. */
export function OlvideClave() {
  const { t } = useTranslation();
  const pedir = usePedirRestablecer();
  const [correo, setCorreo] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await pedir.mutateAsync(correo.trim());
      setEnviado(true);
    } catch (x) {
      // El backend rechaza las cuentas sin confirmar o desactivadas: se responde igual que a las demás.
      if (estado(x) === 'INVALID_REQUEST') setEnviado(true);
      else setError((x as Error).message);
    }
  }

  return (
    <MarcoAcceso titulo={t('cuenta.olvido.titulo')} subtitulo={enviado ? undefined : t('cuenta.olvido.subtitulo')}>
      {enviado ? (
        <Aviso tono="ok">{t('cuenta.olvido.enviado', { correo: correo.trim() })}</Aviso>
      ) : (
        <form onSubmit={enviar} className="mt-8 grid gap-5" noValidate>
          {error && <Aviso tono="mal">{error}</Aviso>}
          <Campo etiqueta={t('acceso.correo')} type="email" autoComplete="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} autoFocus />
          <Boton type="submit" disabled={pedir.isPending || !correo.trim()} className="w-full">{t('cuenta.olvido.enviar')}</Boton>
        </form>
      )}
      <VolverAlIngreso />
    </MarcoAcceso>
  );
}

const rutaRestablecer = getRouteApi('/reset-password/$token');

/**
 * El enlace del correo para restablecer (misma ruta que la versión actual, bajo /v2). Si la cuenta está
 * activa, el backend abre la sesión y se entra al portal; si espera su activación, solo cambia la clave.
 */
export function RestablecerClave() {
  const { t } = useTranslation();
  const { token } = rutaRestablecer.useParams();
  const restablecer = useRestablecer();
  const qc = useQueryClient();
  const navegar = useNavigate();
  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [errores, setErrores] = useState<ReturnType<typeof validarClave> | null>(null);
  const [sinSesion, setSinSesion] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const v = validarClave(clave, repetir);
    setErrores(v);
    if (Object.keys(v).length) return;
    try {
      await restablecer.mutateAsync({ token, password: clave });
    } catch {
      return;
    }
    if (await haySesion()) {
      await qc.invalidateQueries({ queryKey: consultas.perfil().queryKey });
      await navegar({ to: '/' });
    } else {
      setSinSesion(true);
    }
  }

  const falla = restablecer.error
    ? estado(restablecer.error) === 'AUTH_ERROR' ? t('cuenta.enlace_invalido') : estado(restablecer.error) === 'VALIDATION_ERROR' ? t('cuenta.errores.clave_corta', { min: CLAVE_MIN, max: CLAVE_MAX }) : restablecer.error.message
    : '';
  const msg = (k: 'clave' | 'repetir') => (errores?.[k] ? t(`cuenta.errores.${errores[k]}`, { min: CLAVE_MIN, max: CLAVE_MAX }) : undefined);

  if (sinSesion) {
    return (
      <MarcoAcceso titulo={t('cuenta.restablecer.titulo')}>
        <Aviso tono="ok">{t('cuenta.restablecer.listo_sin_sesion')}</Aviso>
        <VolverAlIngreso />
      </MarcoAcceso>
    );
  }
  return (
    <MarcoAcceso titulo={t('cuenta.restablecer.titulo')} subtitulo={t('cuenta.restablecer.subtitulo')}>
      <form onSubmit={enviar} className="mt-8 grid gap-5" noValidate>
        {falla && <Aviso tono="mal">{falla}</Aviso>}
        <Campo etiqueta={t('cuenta.restablecer.nueva')} type="password" autoComplete="new-password" ayuda={t('cuenta.clave_ayuda', { min: CLAVE_MIN, max: CLAVE_MAX })} value={clave} onChange={(e) => setClave(e.target.value)} error={msg('clave')} autoFocus />
        <Campo etiqueta={t('cuenta.repetir')} type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} error={msg('repetir')} />
        <Boton type="submit" disabled={restablecer.isPending} className="w-full">{t('cuenta.restablecer.guardar')}</Boton>
      </form>
      <VolverAlIngreso />
    </MarcoAcceso>
  );
}
