import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HtmlSeguro } from '@/componentes/ui/HtmlSeguro';
import { Icono } from '@/componentes/ui/Icono';
import { useVitrina } from './datos';

const CAMPO = { terminos: 'settings.termsOfUseText', privacidad: 'settings.privacyPolicyText' } as const;

export function Legal({ tipo }: { tipo: keyof typeof CAMPO }) {
  const d = useVitrina();
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link to="/p-cd/$etiqueta/$qr" params={d.params} className="inline-flex items-center gap-2 text-sm font-medium text-marca hover:underline">
        <Icono nombre="volver" className="size-4" /> {t('vitrina.legal.volver')}
      </Link>
      <h1 className="mt-6 font-titulo text-3xl font-semibold tracking-tight">{t(`vitrina.legal.${tipo}`)}</h1>
      <HtmlSeguro html={d.campo(CAMPO[tipo])} className="mt-6" />
    </main>
  );
}
