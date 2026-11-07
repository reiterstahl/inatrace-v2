import { useState, type FormEvent } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { consultas, useGuardarPerfil } from '@/api/consultas';
import { Boton } from '@/componentes/ui/Boton';
import { Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso } from '@/componentes/ui/Estados';
import { InterruptorTema } from '@/componentes/ui/Preferencias';
import { IDIOMAS, aApi, cambiarIdioma, deApi, type Idioma } from '@/i18n';

export function Perfil() {
  const { t } = useTranslation();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const guardar = useGuardarPerfil();
  const [nombre, setNombre] = useState(yo.name ?? '');
  const [apellido, setApellido] = useState(yo.surname ?? '');
  const [idioma, setIdioma] = useState<Idioma>(deApi(yo.language) ?? 'es');
  const cambio = nombre !== (yo.name ?? '') || apellido !== (yo.surname ?? '') || idioma !== (deApi(yo.language) ?? 'es');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    await guardar.mutateAsync({ name: nombre.trim(), surname: apellido.trim(), language: aApi(idioma) });
    cambiarIdioma(idioma);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-titulo text-3xl font-semibold tracking-tight">{t('perfil.titulo')}</h1>
        {/* En el celular la barra no tiene lugar para el tema: queda acá. */}
        <div className="sm:hidden">
          <InterruptorTema />
        </div>
      </div>

      <form onSubmit={enviar} className="mt-8 grid gap-6 rounded-caja border border-linea bg-superficie p-6 shadow-suave">
        <h2 className="font-semibold">{t('perfil.datos')}</h2>
        {guardar.isSuccess && !cambio && <Aviso tono="ok">{t('comun.guardado')}</Aviso>}
        {guardar.isError && <Aviso tono="mal">{guardar.error.message}</Aviso>}
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta={t('perfil.nombre')} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} autoComplete="given-name" />
          <Campo etiqueta={t('perfil.apellido')} value={apellido} onChange={(e) => setApellido(e.target.value)} maxLength={100} autoComplete="family-name" />
          <Campo etiqueta={t('perfil.correo')} value={yo.email ?? ''} readOnly className="sm:col-span-2" />
          <Selector etiqueta={t('perfil.idioma')} value={idioma} onChange={(e) => setIdioma(e.target.value as Idioma)}>
            {IDIOMAS.map((l) => (
              <option key={l} value={l}>
                {t(`idiomas.${l}`)}
              </option>
            ))}
          </Selector>
          <div className="grid gap-1.5">
            <span className="text-sm font-semibold text-tinta-2">{t('perfil.rol')}</span>
            <p className="flex h-11 items-center gap-2">
              <span className="rounded-full bg-marca-suave px-2.5 py-1 text-sm font-semibold text-marca">{t(`perfil.roles.${yo.role ?? 'USER'}`)}</span>
              {yo.status && <span className="text-sm text-tinta-3">{t(`perfil.estados.${yo.status}`)}</span>}
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Boton type="submit" disabled={!cambio || guardar.isPending}>
            {t('comun.guardar')}
          </Boton>
        </div>
      </form>
    </div>
  );
}
