import { useTranslation } from 'react-i18next';
import { IDIOMAS, cambiarIdioma, type Idioma } from '@/i18n';
import { useTema } from '@/util/tema';
import { Icono } from './Icono';

export function SelectorIdioma({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();
  return (
    <label className={'relative inline-flex items-center gap-1.5 text-sm text-tinta-2 ' + className}>
      <Icono nombre="idioma" className="size-4" />
      <span className="sr-only">{t('comun.idioma')}</span>
      <select
        value={i18n.language}
        onChange={(e) => cambiarIdioma(e.target.value as Idioma)}
        className="cursor-pointer appearance-none bg-transparent py-1 pr-1 font-medium text-inherit focus:outline-none"
      >
        {IDIOMAS.map((l) => (
          <option key={l} value={l}>
            {t(`idiomas.${l}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function InterruptorTema() {
  const { t } = useTranslation();
  const [, modo, alternar] = useTema();
  const texto = modo === 'oscuro' ? t('comun.tema_claro') : t('comun.tema_oscuro');
  return (
    <button type="button" onClick={alternar} className="grid size-9 place-items-center rounded-lg text-tinta-2 hover:bg-superficie-2" title={texto} aria-label={texto}>
      <Icono nombre={modo === 'oscuro' ? 'sol' : 'luna'} className="size-[1.1rem]" />
    </button>
  );
}

export function Logo({ className = '', compacto }: { className?: string; compacto?: boolean }) {
  return (
    <span className={'inline-flex items-center gap-2 font-titulo text-lg font-semibold tracking-tight ' + className}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-marca" />
        <path d="M9 21c0-6 4-10 13-11-1 9-5 13-11 13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="text-sobre-marca" />
        <path d="M9 23l6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="text-sobre-marca" />
      </svg>
      <span className={compacto ? 'max-sm:hidden' : 'max-[380px]:hidden'}>
        {/* «v2» como superíndice, pegado al nombre: nunca baja a otra línea. */}
        <span className="whitespace-nowrap">
          INATrace<sup className="ml-0.5 rounded bg-marca-suave px-1 py-px font-sans text-[0.6rem] leading-none font-bold text-marca">v2</sup>
        </span>
      </span>
    </span>
  );
}
