import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { productos, useGuardarProducto } from '@/api/productos';
import type { ApiDocument, ApiProductCompany } from '@/api/gen/types.gen';
import { urlDocumento } from '@/api/respuesta';
import { Boton } from '@/componentes/ui/Boton';
import { Area, Campo, Selector } from '@/componentes/ui/Campo';
import { Aviso } from '@/componentes/ui/Estados';
import { Icono } from '@/componentes/ui/Icono';
import { useAdministraEmpresas, useProducto } from './Marco';
import { BarraGuardar, CampoArchivo, Tarjeta } from './piezas';
import { confirmar } from '@/componentes/ui/Confirmar';

type Rol = NonNullable<ApiProductCompany['type']>;
/** Orden de los grupos, como en la versión actual (ROASTER existe en el backend pero no allí). */
export const ROLES: Rol[] = ['OWNER', 'PRODUCER', 'ASSOCIATION', 'PROCESSOR', 'TRADER', 'EXPORTER', 'IMPORTER', 'ROASTER', 'BUYER'];

/**
 * Pestaña "Empresas": quién participa en la cadena del producto y los acuerdos de uso de datos.
 *  - Asociar o quitar empresas lo hace la administración del sistema o regional (el backend ignora
 *    el cambio de cualquier otra persona); siempre tiene que quedar al menos una dueña.
 *  - Los acuerdos los carga la empresa dueña.
 */
export function EmpresasProducto() {
  const { t } = useTranslation();
  const { producto, editable } = useProducto();
  const admin = useAdministraEmpresas();
  const guardar = useGuardarProducto();
  const [aviso, setAviso] = useState<{ tono: 'mal' | 'ok'; texto: string } | null>(null);
  const asociadas = producto.associatedCompanies ?? [];

  async function guardarEmpresas(nuevas: ApiProductCompany[], texto: string) {
    setAviso(null);
    try {
      await guardar.mutateAsync({ ...producto, associatedCompanies: nuevas.map((a) => ({ company: { id: a.company?.id }, type: a.type })) as ApiProductCompany[] });
      setAviso({ tono: 'ok', texto });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  async function quitar(a: ApiProductCompany) {
    const nombre = a.company?.name ?? `#${a.company?.id}`;
    if (a.type === 'OWNER' && asociadas.filter((x) => x.type === 'OWNER').length <= 1) {
      setAviso({ tono: 'mal', texto: t('productos.empresas.ultima_duena') });
      return;
    }
    if (!(await confirmar(t('productos.empresas.quitar_pregunta', { nombre }), { accion: 'quitar' }))) return;
    await guardarEmpresas(asociadas.filter((x) => x !== a), t('productos.empresas.quitada', { nombre }));
  }

  return (
    <div className="grid gap-6">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      <Tarjeta id="asociadas" titulo={t('productos.empresas.titulo')} ayuda={admin.puede ? t('productos.empresas.ayuda_admin') : t('productos.empresas.ayuda')}>
        <div className="grid gap-5">
          {ROLES.filter((r) => r !== 'ROASTER' || asociadas.some((a) => a.type === r)).map((rol) => {
            const del = asociadas.filter((a) => a.type === rol);
            return (
              <section key={rol} aria-label={t(`productos.empresas.roles.${rol}`)} className="grid gap-2">
                <h3 className="text-sm font-semibold text-tinta-2">{t(`productos.empresas.roles.${rol}`)}</h3>
                {del.length === 0 ? (
                  <p className="text-sm text-tinta-3">{t('productos.empresas.ninguna')}</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {del.map((a) => (
                      <li key={`${rol}-${a.company?.id}`} className="inline-flex items-center gap-1 rounded-full border border-linea bg-superficie-2 py-1 pl-3 pr-1 text-sm">
                        {a.company?.name ?? `#${a.company?.id}`}
                        {admin.puede ? (
                          <button type="button" onClick={() => void quitar(a)} disabled={guardar.isPending} className="rounded-full p-1.5 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('productos.empresas.quitar', { nombre: a.company?.name })}>
                            <Icono nombre="cerrar" className="size-3.5" />
                          </button>
                        ) : (
                          <span className="w-2" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        {admin.puede && <AgregarEmpresa sistema={admin.sistema} ocupado={guardar.isPending} alAgregar={(company, type) => void guardarEmpresas([...asociadas, { company, type }], t('productos.empresas.agregada', { nombre: company.name }))} existentes={asociadas} />}
      </Tarjeta>
      {/* Se rearma al volver del guardado (los acuerdos nuevos reciben su id). */}
      <Acuerdos key={producto.dataSharingAgreements?.map((d) => d.id).join() ?? ''} editable={editable} alAvisar={setAviso} />
    </div>
  );
}

function AgregarEmpresa({ sistema, ocupado, alAgregar, existentes }: { sistema: boolean; ocupado: boolean; alAgregar: (c: { id: number; name?: string }, r: Rol) => void; existentes: ApiProductCompany[] }) {
  const { t } = useTranslation();
  const [rol, setRol] = useState<Rol>('BUYER');
  const [texto, setTexto] = useState('');
  const buscado = useDeferredValue(texto.trim());
  const consulta = useQuery({ ...productos.empresas(buscado, sistema), enabled: buscado.length >= 2 });
  const ya = (id?: number) => existentes.some((a) => a.type === rol && a.company?.id === id);
  return (
    <div className="mt-6 grid gap-3 rounded-lg border border-dashed border-linea-fuerte p-4">
      <h3 className="font-semibold">{t('productos.empresas.agregar')}</h3>
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr] [&>*]:min-w-0">
        <Selector etiqueta={t('productos.empresas.rol')} value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
          {ROLES.filter((r) => r !== 'ROASTER').map((r) => <option key={r} value={r}>{t(`productos.empresas.roles.${r}`)}</option>)}
        </Selector>
        <Campo etiqueta={t('productos.empresas.buscar')} type="search" placeholder={t('productos.empresas.buscar_placeholder')} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      {buscado.length >= 2 && (
        <ul className="grid gap-1" aria-label={t('productos.empresas.resultados')}>
          {(consulta.data?.items ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-superficie-2">
              <span className="text-sm">{c.name}</span>
              <Boton chico variante="secundario" disabled={ocupado || ya(c.id)} onClick={() => { alAgregar({ id: c.id!, name: c.name }, rol); setTexto(''); }}>
                <Icono nombre="mas" className="size-4" /> {ya(c.id) ? t('productos.empresas.ya_esta') : t('productos.empresas.agregar_como', { rol: t(`productos.empresas.roles.${rol}`) })}
              </Boton>
            </li>
          ))}
          {consulta.data && consulta.data.items?.length === 0 && <li className="px-3 py-2 text-sm text-tinta-3">{t('productos.empresas.sin_resultados')}</li>}
        </ul>
      )}
    </div>
  );
}

type Acuerdo = { clave: string; id?: number; descripcion: string; doc: ApiDocument | null };

/** Acuerdos de uso de datos (descripción y documento), como en la versión actual. */
function Acuerdos({ editable, alAvisar }: { editable: boolean; alAvisar: (a: { tono: 'mal' | 'ok'; texto: string } | null) => void }) {
  const { t } = useTranslation();
  const { producto } = useProducto();
  const guardar = useGuardarProducto();
  const [lista, setLista] = useState<Acuerdo[]>(() => (producto.dataSharingAgreements ?? []).map((a) => ({ clave: `a${a.id}`, id: a.id, descripcion: a.description ?? '', doc: a.document ?? null })));
  const [tocado, setTocado] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const cambiar = (l: Acuerdo[]) => {
    setLista(l);
    setTocado(true);
  };
  const incompletos = lista.filter((a) => !a.descripcion.trim() || !a.doc);

  async function alGuardar() {
    setEnviado(true);
    alAvisar(null);
    if (incompletos.length) {
      alAvisar({ tono: 'mal', texto: t('stock.entrega.revisar') });
      return;
    }
    try {
      await guardar.mutateAsync({ ...producto, dataSharingAgreements: lista.map((a) => ({ id: a.id, description: a.descripcion.trim(), document: a.doc ?? undefined })) });
      setTocado(false);
      alAvisar({ tono: 'ok', texto: t('productos.guardado') });
    } catch (x) {
      alAvisar({ tono: 'mal', texto: (x as Error).message });
    }
  }

  return (
    <Tarjeta
      id="acuerdos"
      titulo={t('productos.acuerdos.titulo')}
      ayuda={t('productos.acuerdos.ayuda')}
      acciones={editable && (
        <Boton chico variante="secundario" onClick={() => cambiar([...lista, { clave: `n${Date.now()}`, descripcion: '', doc: null }])}>
          <Icono nombre="mas" className="size-4" /> {t('productos.acuerdos.agregar')}
        </Boton>
      )}
    >
      {lista.length === 0 ? (
        <p className="text-sm text-tinta-3">{t('productos.acuerdos.vacio')}</p>
      ) : (
        <ol className="grid gap-3">
          {lista.map((a, i) => (
            <li key={a.clave} aria-label={t('productos.acuerdos.uno', { n: i + 1 })} className="grid gap-4 rounded-lg border border-linea p-4 sm:grid-cols-[1fr_16rem_auto] [&>*]:min-w-0">
              {editable ? (
                <>
                  <Area etiqueta={t('productos.acuerdos.descripcion')} rows={2} value={a.descripcion} error={enviado && !a.descripcion.trim() ? t('stock.errores.requerido') : undefined} onChange={(e) => cambiar(lista.map((x) => (x.clave === a.clave ? { ...x, descripcion: e.target.value } : x)))} />
                  <div className="grid content-start gap-1">
                    <CampoArchivo etiqueta={t('productos.acuerdos.documento')} tipos={['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg']} doc={a.doc} alCambiar={(doc) => cambiar(lista.map((x) => (x.clave === a.clave ? { ...x, doc } : x)))} />
                    {enviado && !a.doc && <p className="text-sm text-mal">{t('stock.errores.requerido')}</p>}
                  </div>
                  <button type="button" onClick={() => cambiar(lista.filter((x) => x.clave !== a.clave))} className="self-start justify-self-start rounded-md p-2 text-tinta-3 hover:bg-mal-suave hover:text-mal" aria-label={t('productos.acuerdos.quitar', { n: i + 1 })}>
                    <Icono nombre="borrar" className="size-4" />
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm">{a.descripcion}</p>
                  {a.doc?.storageKey ? (
                    <a href={urlDocumento(a.doc.storageKey)} download={a.doc.name ?? true} className="inline-flex items-center gap-1.5 text-sm font-semibold text-marca hover:underline">
                      <Icono nombre="descarga" className="size-4" /> {a.doc.name ?? t('productos.acuerdos.documento')}
                    </a>
                  ) : <span />}
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      {editable && tocado && <BarraGuardar texto={t('productores.ficha.cambios')} guardando={guardar.isPending} alGuardar={() => void alGuardar()} />}
    </Tarjeta>
  );
}
