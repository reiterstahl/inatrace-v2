import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useIngresar } from '@/api/consultas';
import { Boton } from '@/componentes/ui/Boton';
import { Campo } from '@/componentes/ui/Campo';
import { Aviso } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { enAnterior } from '@/util/entorno';
import { MarcoAcceso } from './MarcoAcceso';

export function Ingreso() {
  const { t } = useTranslation();
  const { volver, vencida } = useSearch({ from: '/ingreso' });
  const navegar = useNavigate();
  const ingresar = useIngresar();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    try {
      await ingresar.mutateAsync({ username: correo.trim(), password: clave });
      // volver es una ruta interna validada (empieza con "/"): nunca un sitio externo.
      await navegar({ to: volver ?? '/' });
    } catch {
      /* el mensaje sale de ingresar.isError */
    }
  }

  return (
    <MarcoAcceso titulo={t('acceso.titulo')} subtitulo={<span className="lg:hidden">{t('acceso.subtitulo')}</span>}>
      <form onSubmit={enviar} className="mt-8 grid gap-5" noValidate>
        {vencida && !ingresar.isError && <Aviso tono="aviso">{t('acceso.sesion_vencida')}</Aviso>}
        {ingresar.isError && <Aviso tono="mal">{t('acceso.error')}</Aviso>}
        <Campo etiqueta={t('acceso.correo')} type="email" autoComplete="username" required value={correo} onChange={(e) => setCorreo(e.target.value)} autoFocus />
        <Campo etiqueta={t('acceso.clave')} type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
        <Boton type="submit" disabled={ingresar.isPending || !correo || !clave} className="mt-1 w-full">
          {ingresar.isPending ? t('acceso.ingresando') : t('acceso.ingresar')}
        </Boton>
      </form>

      <div className="mt-6 grid gap-3 text-sm">
        <div className="flex flex-wrap justify-between gap-3">
          <Link to="/olvide-clave" className="text-marca hover:underline">{t('acceso.olvido')}</Link>
          <Link to="/registro" className="font-semibold text-marca hover:underline">{t('acceso.crear_cuenta')}</Link>
        </div>
        <a href={enAnterior('/login')} className="inline-flex items-center gap-1 text-tinta-3 hover:text-tinta">
          {t('acceso.version_actual')} <Icono nombre="externo" className="size-3.5" />
        </a>
      </div>
    </MarcoAcceso>
  );
}
