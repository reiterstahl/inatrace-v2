import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { InterruptorTema, Logo, SelectorIdioma } from '@/componentes/ui/Preferencias';

/** Pantallas sin sesión (ingreso, registro, contraseña): panel de marca a la izquierda y el formulario. */
export function MarcoAcceso({ titulo, subtitulo, children }: { titulo: ReactNode; subtitulo?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
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
          <h1 className="font-titulo text-3xl font-semibold tracking-tight">{titulo}</h1>
          {subtitulo && <p className="mt-2 text-tinta-2">{subtitulo}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}
