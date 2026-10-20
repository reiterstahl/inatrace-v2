import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addUserCustomer,
  deleteUserCustomer,
  exportFarmerDataByCompany,
  exportUserCustomerGeoData,
  getActive,
  getActiveMapLayers,
  getAssociations,
  getCompany,
  getCompanyName,
  getCompanyProductTypes,
  getCountries,
  getUserCustomer,
  getUserCustomersForCompanyAndType,
  getUserCustomersPlotsForCompany,
  importFarmersSpreadsheet,
  listCompanies,
  updateUserCustomer,
  uploadDocument,
  uploadUserCustomerGeoData,
} from './gen/sdk.gen';
import type { ApiUserCustomer } from './gen/types.gen';
import { desenvolver, ErrorApi } from './respuesta';

export const POR_PAGINA = 20;

export type OrdenProductores = { campo: 'BY_NAME' | 'BY_SURNAME' | 'BY_ID'; sentido: 'ASC' | 'DESC' };
export type FiltroProductores = { texto: string; buscarPor: 'BY_NAME' | 'BY_SURNAME'; orden: OrdenProductores; pagina: number };

/**
 * Lo que solo existe en el backend mejorado (capas, catálogo de certificaciones, GIS) puede no
 * estar en un INATrace estándar: si la ruta no existe, se sigue sin esa parte.
 */
async function opcional<T>(p: Promise<T>, siFalta: T): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ErrorApi && (e.noEncontrado || e.http === 405)) return siFalta;
    throw e;
  }
}

export const productores = {
  empresa: (id: number) =>
    queryOptions({
      queryKey: ['empresa', id, 'nombre'],
      queryFn: () => desenvolver(getCompanyName({ path: { id } })),
      staleTime: 60 * 60_000,
    }),

  /** Perfil completo de la empresa (país de la sede, etc.). */
  perfilEmpresa: (id: number) =>
    queryOptions({
      queryKey: ['empresa', id, 'perfil'],
      queryFn: () => desenvolver(getCompany({ path: { id } })),
      staleTime: 30 * 60_000,
    }),

  /** Para la administración del sistema, que no pertenece a una empresa: todas. */
  todasLasEmpresas: () =>
    queryOptions({
      queryKey: ['empresas', 'todas'],
      queryFn: () => desenvolver(listCompanies({ query: { limit: 500 } })),
      staleTime: 10 * 60_000,
    }),

  lista: (empresa: number, f: FiltroProductores) =>
    queryOptions({
      queryKey: ['productores', empresa, f],
      queryFn: () =>
        desenvolver(
          getUserCustomersForCompanyAndType({
            path: { companyId: empresa, type: 'FARMER' },
            query: {
              query: f.texto.trim() || undefined,
              searchBy: f.buscarPor,
              sortBy: f.orden.campo,
              sort: f.orden.sentido,
              limit: POR_PAGINA,
              offset: (f.pagina - 1) * POR_PAGINA,
            },
          }),
        ),
      placeholderData: keepPreviousData, // al paginar o buscar, la tabla no parpadea
    }),

  parcelasDeEmpresa: (empresa: number) =>
    queryOptions({
      queryKey: ['parcelas', empresa],
      queryFn: () => desenvolver(getUserCustomersPlotsForCompany({ path: { companyId: empresa } })),
    }),

  ficha: (id: number) =>
    queryOptions({
      queryKey: ['productor', id],
      queryFn: () => desenvolver(getUserCustomer({ path: { id } })),
    }),

  // ---------- Catálogos ----------
  paises: () =>
    queryOptions({
      queryKey: ['catalogo', 'paises'],
      queryFn: async () => (await desenvolver(getCountries({ query: { limit: 500, sortBy: 'name', sort: 'ASC' } }))).items ?? [],
      staleTime: Infinity,
    }),
  tiposProducto: (empresa: number) =>
    queryOptions({
      queryKey: ['catalogo', 'tipos-producto', empresa],
      queryFn: async () => (await desenvolver(getCompanyProductTypes({ path: { id: empresa }, query: { limit: 500 } }))).items ?? [],
      staleTime: 30 * 60_000,
    }),
  asociaciones: (empresa: number) =>
    queryOptions({
      queryKey: ['catalogo', 'asociaciones', empresa],
      queryFn: async () => (await desenvolver(getAssociations({ path: { id: empresa }, query: { limit: 500 } }))).items ?? [],
      staleTime: 30 * 60_000,
    }),
  tiposCertificacion: () =>
    queryOptions({
      queryKey: ['catalogo', 'tipos-certificacion'],
      queryFn: () => opcional(desenvolver(getActive()), []),
      staleTime: 30 * 60_000,
    }),
  capasMapa: () =>
    queryOptions({
      queryKey: ['catalogo', 'capas-mapa'],
      queryFn: () => opcional(desenvolver(getActiveMapLayers()), []),
      staleTime: 30 * 60_000,
    }),
};

// ---------- Escrituras ----------

/** Quita los null y las cadenas vacías, como hace la interfaz actual antes de guardar. */
export function limpiarProductor(p: ApiUserCustomer): ApiUserCustomer {
  const limpiar = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.map(limpiar);
    if (o && typeof o === 'object') {
      return Object.fromEntries(
        Object.entries(o)
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => [k, limpiar(v)]),
      );
    }
    return o;
  };
  return limpiar({ ...p, type: 'FARMER' }) as ApiUserCustomer;
}

export function useGuardarProductor(empresa: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ApiUserCustomer) =>
      p.id
        ? desenvolver(updateUserCustomer({ body: limpiarProductor(p) }))
        : desenvolver(addUserCustomer({ path: { companyId: empresa }, body: limpiarProductor(p) })),
    onSuccess: (guardado) => {
      void qc.invalidateQueries({ queryKey: ['productores', empresa] });
      void qc.invalidateQueries({ queryKey: ['parcelas', empresa] });
      if (guardado?.id) qc.setQueryData(['productor', guardado.id], guardado);
    },
  });
}

export function useBorrarProductor(empresa: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => desenvolver(deleteUserCustomer({ path: { id } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['productores', empresa] });
      void qc.invalidateQueries({ queryKey: ['parcelas', empresa] });
    },
  });
}

/** Sube un archivo al almacenamiento del backend y devuelve el documento creado. */
export async function subirDocumento(archivo: File) {
  return desenvolver(uploadDocument({ body: { file: archivo } }));
}

export async function importarPlanilla(empresa: number, archivo: File) {
  const doc = await subirDocumento(archivo);
  const r = await importFarmersSpreadsheet({ path: { companyId: empresa, documentId: doc.id! } });
  if (!r.response?.ok || !r.data) throw new ErrorApi('No se pudo importar la planilla.', 'ERROR', r.response?.status ?? 0);
  return r.data;
}

export async function subirGeoDatos(productor: number, archivo: File) {
  return desenvolver(uploadUserCustomerGeoData({ path: { id: productor }, body: { file: archivo } }));
}

/** Descarga un archivo binario de la API y lo guarda con el nombre dado. */
async function descargar(peticion: Promise<{ data?: unknown; response?: Response }>, nombre: string) {
  const r = await peticion;
  if (!r.response?.ok || !(r.data instanceof Blob)) throw new ErrorApi('No se pudo descargar el archivo.', 'ERROR', r.response?.status ?? 0);
  const url = URL.createObjectURL(r.data);
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const exportarProductores = (empresa: number) =>
  descargar(exportFarmerDataByCompany({ path: { companyId: empresa }, parseAs: 'blob' }), 'productores.zip');

export const exportarGeoDatos = (productor: number) =>
  descargar(exportUserCustomerGeoData({ path: { id: productor }, parseAs: 'blob' }), `parcelas-productor-${productor}.geojson`);
