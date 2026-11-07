import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { elegirEmpresa, useEmpresaActual, useEmpresas } from '@/util/empresa';
import { Icono } from './ui/Icono';

/** Empresa con la que se trabaja. Solo se muestra si hay más de una para elegir. */
export function SelectorEmpresa() {
  const { t } = useTranslation();
  const { empresas } = useEmpresas();
  const actual = useEmpresaActual();
  const qc = useQueryClient();
  if (!actual) return null;
  if (empresas.length < 2) {
    return <span className="mr-2 hidden max-w-44 truncate text-sm font-semibold text-tinta-2 lg:inline" title={actual.nombre}>{actual.nombre}</span>;
  }
  return (
    <label className="mr-1 inline-flex max-w-56 items-center gap-1.5 rounded-lg px-2 text-sm text-tinta-2 hover:bg-superficie-2">
      <Icono nombre="web" className="size-4 shrink-0" />
      <span className="sr-only">{t('portal.empresa')}</span>
      <select
        value={actual.id}
        onChange={(e) => {
          elegirEmpresa(Number(e.target.value));
          // Lo cargado de la empresa anterior no sirve para la nueva.
          void qc.invalidateQueries({ queryKey: ['productores'] });
        }}
        className="h-9 min-w-0 cursor-pointer truncate bg-transparent font-semibold text-tinta outline-none"
      >
        {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
      </select>
    </label>
  );
}
