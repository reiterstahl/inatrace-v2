import { useEffect, useState } from 'react';
import { Link, getRouteApi, useBlocker, useNavigate } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { cadenas, useGuardarCadena } from '@/api/cadenas';
import { consultas } from '@/api/consultas';
import type { ApiValueChain } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Area, Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { LISTAS_CADENA, armarCadena, formDesdeCadena, permisosCadena, validarCadena, type ErroresCadena, type FormCadena } from '@/util/cadena';
import { Fichas } from '../empresa/piezas';
import { Tarjeta } from '../productos/piezas';
import { confirmarSalida } from '@/componentes/ui/Confirmar';

const ruta = getRouteApi('/portal/administracion/cadenas/$id');
const idioma = (l: string) => l.slice(0, 2).toUpperCase() as 'ES' | 'EN' | 'DE' | 'RW';

export function CadenaNueva() {
  return <FormularioCadena />;
}

export function CadenaExistente() {
  const { t, i18n } = useTranslation();
  const id = Number(ruta.useParams().id);
  const consulta = useQuery(cadenas.detalle(id, idioma(i18n.language)));
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <EstadoError titulo={t('administracion.cadenas.no_existe')} texto={consulta.error.message} reintentar={() => void consulta.refetch()} />;
  return <FormularioCadena key={id} original={consulta.data} />;
}

function FormularioCadena({ original }: { original?: ApiValueChain }) {
  const { t, i18n } = useTranslation();
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const catalogos = useQuery(cadenas.catalogos(idioma(i18n.language)));
  const guardar = useGuardarCadena();
  const navegar = useNavigate();
  const [f, setF] = useState<FormCadena>(() => formDesdeCadena(original));
  const [errores, setErrores] = useState<ErroresCadena | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);
  const p = permisosCadena(yo.role, original);
  const editable = original ? p.editar : p.crear;
  const cambiar = (c: Partial<FormCadena>) => {
    setF((x) => ({ ...x, ...c }));
    setTocado(true);
  };
  useEffect(() => {
    if (errores) setErrores(validarCadena(f));
  }, [f]); // eslint-disable-line react-hooks/exhaustive-deps

  useBlocker({ shouldBlockFn: async () => tocado && !guardar.isPending && !(await confirmarSalida(t('stock.entrega.salir_sin_guardar'))), enableBeforeUnload: () => tocado });

  async function alGuardar() {
    setAviso(null);
    const e = validarCadena(f);
    setErrores(e);
    if (Object.keys(e).length) {
      setAviso(t('stock.entrega.revisar'));
      return;
    }
    try {
      await guardar.mutateAsync(armarCadena(original, f));
      setTocado(false);
      await navegar({ to: '/administracion/cadenas', search: { guardada: f.nombre.trim() } });
    } catch (x) {
      setAviso((x as Error).message);
    }
  }

  // Nombres de lo ya elegido: del catálogo o, si no está ahí, de la propia cadena.
  const nombresDe = (lista: (typeof LISTAS_CADENA)[number]) => {
    const propios = new Map((original?.[lista] ?? []).map((x) => [x.id!, ('label' in x && x.label) || ('name' in x && x.name) || `#${x.id}`]));
    const cat = new Map((catalogos.data?.[lista] ?? []).map((x) => [x.id, x.nombre]));
    return f[lista].map((id) => ({ id, nombre: cat.get(id) ?? propios.get(id) ?? `#${id}` }));
  };
  const req = (k: keyof ErroresCadena) => (errores?.[k] ? t('administracion.usuarios.requerido') : undefined);

  const volver = (
    <Link to="/administracion/cadenas" className="inline-flex items-center gap-1.5 text-sm font-semibold text-marca hover:underline">
      <Icono nombre="volver" className="size-4" /> {t('administracion.pestanas.cadenas')}
    </Link>
  );

  return (
    <div className="grid gap-5">
      {volver}
      <h2 className="font-titulo text-2xl font-semibold tracking-tight break-words">{original ? original.name : t('administracion.cadenas.nueva')}</h2>
      {!editable && (
        <Aviso tono="info">{original?.valueChainStatus === 'DISABLED' && yo.role === 'SYSTEM_ADMIN' ? t('administracion.cadenas.desactivada_lectura') : t('administracion.cadenas.solo_lectura')}</Aviso>
      )}
      {aviso && <Aviso tono="mal">{aviso}</Aviso>}
      {catalogos.isError && <EstadoError texto={catalogos.error.message} reintentar={() => void catalogos.refetch()} />}

      <fieldset disabled={!editable} className="grid min-w-0 gap-5">
        <Tarjeta id="basico" titulo={t('administracion.cadenas.basico')}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Campo etiqueta={<>{t('administracion.cadenas.nombre')} <span className="text-mal" aria-hidden>*</span></>} value={f.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} maxLength={255} error={req('nombre')} />
            <Selector etiqueta={<>{t('administracion.cadenas.tipo_producto')} <span className="text-mal" aria-hidden>*</span></>} value={f.tipoProducto} onChange={(e) => cambiar({ tipoProducto: e.target.value })} error={req('tipoProducto')}>
              <option value="">{catalogos.isPending ? t('comun.cargando') : t('stock.elegir')}</option>
              {(catalogos.data?.tiposProducto ?? []).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              {original?.productType?.id && !catalogos.data?.tiposProducto.some((o) => o.id === original.productType!.id) && <option value={original.productType.id}>{original.productType.name}</option>}
            </Selector>
            <Area etiqueta={<>{t('administracion.cadenas.descripcion')} <span className="text-mal" aria-hidden>*</span></>} value={f.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} rows={3} error={req('descripcion')} className="sm:col-span-2" />
          </div>
        </Tarjeta>

        <Tarjeta id="configuracion" titulo={t('administracion.cadenas.configuracion')} ayuda={t('administracion.cadenas.configuracion_ayuda')}>
          <div className="grid gap-6">
            {LISTAS_CADENA.map((lista) => (
              <Fichas
                key={lista}
                etiqueta={t(`administracion.cadenas.listas.${lista}`)}
                elegidos={nombresDe(lista)}
                opciones={editable ? catalogos.data?.[lista] ?? [] : []}
                alAgregar={(id) => cambiar({ [lista]: [...f[lista], id] })}
                alQuitar={(id) => cambiar({ [lista]: f[lista].filter((x) => x !== id) })}
              />
            ))}
          </div>
        </Tarjeta>
      </fieldset>

      {editable && (
        <div className="sticky bottom-4 z-10 flex justify-end">
          <Boton onClick={() => void alGuardar()} disabled={guardar.isPending || (!!original && !tocado)}>{t('comun.guardar')}</Boton>
        </div>
      )}
    </div>
  );
}
