import { useState, type FormEvent } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useIngresar } from '@/api/consultas';
import { Boton } from '@/componentes/ui/Boton';
import { Campo } from '@/componentes/ui/Campo';
import { Aviso } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { InterruptorTema, Logo, SelectorIdioma } from '@/componentes/ui/Preferencias';
import { enAnterior } from '@/util/entorno';

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
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-marca text-sobre-marca lg:block">
        <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_45%),radial-gradient(circle_at_80%_70%,white_0,transparent_40%)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo className="text-sobre-marca [&_rect]:fill-sobre-marca [&_path]:text-marca" />
          <div className="max-w-md">
            <p className="font-titulo text-4xl leading-tight font-medium">{t('acceso.subtitulo')}</p>
          </div>
          <p className="text-sm opacity-75">INATrace · v2</p>
        </div>
      </aside>

      <main className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible" />
          <div className="flex items-center gap-1">
            <SelectorIdioma />
            <InterruptorTema />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="font-titulo text-3xl font-semibold tracking-tight">{t('acceso.titulo')}</h1>
          <p className="mt-2 text-tinta-2 lg:hidden">{t('acceso.subtitulo')}</p>

          <form onSubmit={enviar} className="mt-8 grid gap-5" noValidate>
            {vencida && !ingresar.isError && <Aviso tono="aviso">{t('acceso.sesion_vencida')}</Aviso>}
            {ingresar.isError && <Aviso tono="mal">{t('acceso.error')}</Aviso>}
            <Campo etiqueta={t('acceso.correo')} type="email" autoComplete="username" required value={correo} onChange={(e) => setCorreo(e.target.value)} autoFocus />
            <Campo etiqueta={t('acceso.clave')} type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
            <Boton type="submit" disabled={ingresar.isPending || !correo || !clave} className="mt-1 w-full">
              {ingresar.isPending ? t('acceso.ingresando') : t('acceso.ingresar')}
            </Boton>
          </form>

          <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm">
            <a href={enAnterior('/reset-password')} className="text-marca hover:underline">
              {t('acceso.olvido')}
            </a>
            <a href={enAnterior('/login')} className="inline-flex items-center gap-1 text-tinta-3 hover:text-tinta">
              {t('acceso.version_actual')} <Icono nombre="externo" className="size-3.5" />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
