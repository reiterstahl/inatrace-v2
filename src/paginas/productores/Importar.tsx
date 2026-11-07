import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { addUserCustomer } from '@/api/gen/sdk.gen';
import type { ApiUserCustomer, ApiUserCustomerImportResponse } from '@/api/gen/types.gen';
import { importarPlanilla, productores } from '@/api/productores';
import { ErrorApi, desenvolver } from '@/api/respuesta';
import { Boton, clasesBoton } from '@/componentes/ui/Boton';
import { Aviso } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useEmpresaActual } from '@/util/empresa';
import { nombreCompleto, ubicacionCorta } from '@/util/productor';

/** Plantilla según el país de la empresa, igual que la interfaz actual. */
function plantilla(codigoPais: string | undefined, idioma: string) {
  const base = import.meta.env.BASE_URL + 'plantillas/';
  if (codigoPais === 'RW') return base + 'Template_list_of_farmers_Rwanda_en.xlsx';
  if (codigoPais === 'HN') return base + 'Plantilla_listado_de_agricultores_Honduras_es.xlsx';
  return base + (idioma === 'es' ? 'Plantilla_listado_de_agricultores_otros_paises_es.xlsx' : 'Template_list_of_farmers_other_countries_en.xlsx');
}

export function ImportarProductores() {
  const { t, i18n } = useTranslation();
  const empresa = useEmpresaActual();
  const qc = useQueryClient();
  const perfil = useQuery({ ...productores.perfilEmpresa(empresa?.id ?? 0), enabled: !!empresa });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ApiUserCustomerImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resueltos, setResueltos] = useState<Record<number, 'aceptado' | 'rechazado'>>({});

  if (!empresa) return <Aviso tono="info">{t('productores.sin_empresa')}</Aviso>;

  async function importar() {
    if (!archivo || !empresa) return;
    setImportando(true);
    setError(null);
    setResultado(null);
    setResueltos({});
    try {
      setResultado(await importarPlanilla(empresa.id, archivo));
      void qc.invalidateQueries({ queryKey: ['productores', empresa.id] });
    } catch (e) {
      // El backend rechaza con 400 un archivo que no es una planilla válida (antes respondía 500).
      const invalido = e instanceof ErrorApi && e.estado === 'INVALID_REQUEST' && /xlsx|spreadsheet/i.test(e.message);
      setError(invalido ? t('productores.importacion.archivo_invalido') : (e as Error).message);
    } finally {
      setImportando(false);
    }
  }

  async function aceptar(p: ApiUserCustomer, i: number) {
    try {
      await desenvolver(addUserCustomer({ path: { companyId: empresa!.id }, body: p }));
      setResueltos((r) => ({ ...r, [i]: 'aceptado' }));
      void qc.invalidateQueries({ queryKey: ['productores', empresa!.id] });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const errores = resultado?.validationErrors ?? [];
  const duplicados = resultado?.duplicates ?? [];

  return (
    <div className="grid max-w-3xl gap-6">
      <header>
        <Link to="/productores" className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline">
          <Icono nombre="volver" className="size-4" /> {t('productores.titulo')}
        </Link>
        <h1 className="mt-2 font-titulo text-3xl font-semibold tracking-tight">{t('productores.importacion.titulo')}</h1>
        <p className="mt-1 text-tinta-2">{t('productores.importacion.intro')}</p>
      </header>

      <ol className="grid gap-4">
        <li className="rounded-caja border border-linea bg-superficie p-5 shadow-suave">
          <p className="font-semibold">1. {t('productores.importacion.paso_plantilla')}</p>
          <a href={plantilla(perfil.data?.headquarters?.country?.code, i18n.language)} download className={clasesBoton('secundario', true) + ' mt-3'}>
            <Icono nombre="descarga" className="size-4" /> {t('productores.importacion.descargar_plantilla')}
          </a>
        </li>
        <li className="rounded-caja border border-linea bg-superficie p-5 shadow-suave">
          <p className="font-semibold">2. {t('productores.importacion.paso_subir')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-linea-fuerte px-4 text-sm font-semibold hover:border-marca hover:text-marca">
              <Icono nombre="subir" className="size-4" />
              {archivo ? archivo.name : t('productores.importacion.elegir')}
              <input
                type="file"
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setError(f && !/\.xlsx?$/i.test(f.name) ? t('productores.importacion.solo_excel') : null);
                  setArchivo(f && /\.xlsx?$/i.test(f.name) ? f : null);
                }}
              />
            </label>
            <Boton onClick={importar} disabled={!archivo || importando}>
              {importando ? t('productores.importacion.importando') : t('productores.importacion.importar')}
            </Boton>
          </div>
        </li>
      </ol>

      {error && <Aviso tono="mal">{error}</Aviso>}

      {resultado && errores.length === 0 && (
        <Aviso tono={(resultado.successful ?? 0) > 0 ? 'ok' : 'aviso'} titulo={t('productores.importacion.resultado', { count: resultado.successful ?? 0 })}>
          {duplicados.length > 0 && t('productores.importacion.hay_duplicados', { count: duplicados.length })}
        </Aviso>
      )}

      {errores.length > 0 && (
        <section className="grid gap-3">
          <Aviso tono="mal" titulo={t('productores.importacion.con_errores')}>{t('productores.importacion.con_errores_texto')}</Aviso>
          <div className="overflow-hidden rounded-caja border border-linea bg-superficie">
            <table className="w-full text-left text-sm">
              <thead className="bg-superficie-2 text-tinta-2">
                <tr>
                  <th className="px-4 py-2 font-semibold">{t('productores.importacion.fila')}</th>
                  <th className="px-4 py-2 font-semibold">{t('productores.importacion.celda')}</th>
                  <th className="px-4 py-2 font-semibold">{t('productores.importacion.problema')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {errores.flatMap((f) =>
                  (f.columnValidationErrors ?? []).map((c, j) => (
                    <tr key={`${f.rowIndex}-${j}`}>
                      <td className="px-4 py-2 tabular-nums">{f.rowIndex}</td>
                      <td className="px-4 py-2 font-mono">{c.cellAddress}</td>
                      <td className="px-4 py-2">{t(`productores.importacion.errores.${c.errorType ?? 'INVALID_VALUE'}`)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {duplicados.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-titulo text-xl font-semibold">{t('productores.importacion.duplicados')}</h2>
          <p className="text-sm text-tinta-2">{t('productores.importacion.duplicados_texto')}</p>
          <ul className="grid gap-2">
            {duplicados.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-linea bg-superficie p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{nombreCompleto(p)}</p>
                  <p className="text-sm text-tinta-2">{ubicacionCorta(p.location?.address) || '—'}</p>
                </div>
                {resueltos[i] ? (
                  <span className={'rounded-full px-2.5 py-1 text-xs font-semibold ' + (resueltos[i] === 'aceptado' ? 'bg-ok-suave text-ok' : 'bg-superficie-2 text-tinta-3')}>
                    {t(`productores.importacion.${resueltos[i]}`)}
                  </span>
                ) : (
                  <div className="flex gap-2">
                    <Boton chico variante="secundario" onClick={() => setResueltos((r) => ({ ...r, [i]: 'rechazado' }))}>{t('productores.importacion.rechazar')}</Boton>
                    <Boton chico onClick={() => void aceptar(p, i)}>{t('productores.importacion.aceptar')}</Boton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
