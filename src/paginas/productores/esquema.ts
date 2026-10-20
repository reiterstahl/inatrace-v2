import { z } from 'zod';
import type { ApiCountry, ApiDocument, ApiProductType, ApiUserCustomer } from '@/api/gen/types.gen';
import { formatoDireccion } from '@/util/productor';
import type { Punto } from '@/util/geo';

/**
 * Formulario de la ficha del productor y su traducción desde/hacia la API.
 *
 * Los números se editan como texto (se acepta coma decimal) y se convierten al guardar. Al
 * guardar se parte del productor original, así que los campos que la v2 todavía no edita
 * (p. ej. productos propios) no se pierden.
 */

const texto = z.string().trim().max(255);
const numero = z
  .string()
  .trim()
  .refine((v) => v === '' || Number.isFinite(Number(v.replace(',', '.'))), { message: 'numero' });

const parcela = z.object({
  id: z.number().optional(),
  plotName: texto.min(1, 'requerido'),
  cropId: z.number().nullable().refine((v) => v !== null, 'requerido'),
  numberOfPlants: numero,
  size: numero,
  unit: texto,
  organicStartOfTransition: z.string(),
  geoId: z.string().optional(),
  externalId: z.string().optional(),
  coordenadas: z.array(z.tuple([z.number(), z.number()])),
});

export const esquemaProductor = z
  .object({
    farmerCompanyInternalId: texto,
    name: texto,
    surname: texto.min(1, 'requerido'),
    gender: z.enum(['', 'FEMALE', 'MALE', 'DIVERSE', 'N_A']).refine((v) => v !== '', 'requerido'),
    phone: texto,
    email: texto.refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'correo'),
    hasSmartphone: z.boolean(),
    pais: z.number().nullable().refine((v) => v !== null, 'requerido'),
    dir: z.object({
      address: texto, city: texto, state: texto, zip: texto, otherAddress: texto,
      village: texto, cell: texto, sector: texto,
      hondurasFarm: texto, hondurasVillage: texto, hondurasMunicipality: texto, hondurasDepartment: texto,
    }),
    lat: numero,
    lng: numero,
    banco: z.object({ accountHolderName: texto, accountNumber: texto, bankName: texto, additionalInformation: z.string().max(2000) }),
    unidadArea: texto,
    areaTotal: numero,
    organico: z.boolean(),
    areaOrganica: numero,
    inicioTransicion: z.string(),
    cultivos: z.array(z.object({ productTypeId: z.number(), area: numero, plantas: numero })),
    miembroCooperativa: z.boolean(),
    asociaciones: z.array(z.number()),
    certificaciones: z.array(
      z.object({ id: z.number().optional(), type: texto.min(1, 'requerido'), description: z.string().max(2000), validity: z.string(), certificate: z.custom<ApiDocument>().nullable() }),
    ),
    parcelas: z.array(parcela),
    /** Código del país elegido: decide qué campos de dirección se piden. Lo agrega el validador de la página, no se edita. */
    codigoPais: z.string().optional(),
  })
  .superRefine((f, ctx) => {
    const falta = (camino: (string | number)[]) => ctx.addIssue({ code: 'custom', path: camino, message: 'requerido' });
    // Campos de dirección obligatorios según el país, como en la interfaz actual.
    const req: Record<string, (keyof typeof f.dir)[]> = {
      RW: ['village', 'cell', 'sector'],
      HN: ['hondurasVillage', 'hondurasMunicipality', 'hondurasDepartment'],
      general: ['city', 'state'],
    };
    for (const k of req[formatoDireccion(f.codigoPais)]!) if (!f.dir[k]) falta(['dir', k]);
    // Si se carga alguna superficie, hace falta saber en qué unidad.
    const hayArea = f.areaTotal !== '' || f.areaOrganica !== '' || f.cultivos.some((c) => c.area !== '');
    if (hayArea && !f.unidadArea) falta(['unidadArea']);
    // Latitud y longitud van juntas y dentro de rango.
    if ((f.lat === '') !== (f.lng === '')) falta([f.lat === '' ? 'lat' : 'lng']);
    const lat = Number(f.lat.replace(',', '.')), lng = Number(f.lng.replace(',', '.'));
    if (f.lat !== '' && Math.abs(lat) > 90) ctx.addIssue({ code: 'custom', path: ['lat'], message: 'rango' });
    if (f.lng !== '' && Math.abs(lng) > 180) ctx.addIssue({ code: 'custom', path: ['lng'], message: 'rango' });
  });

export type FormProductor = z.input<typeof esquemaProductor>;
export type FormParcela = FormProductor['parcelas'][number];

const t = (v?: string | null) => v ?? '';
const n = (v?: number | null) => (v === null || v === undefined ? '' : String(v));
const aNumero = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));

export const parcelaVacia = (): FormParcela => ({
  plotName: '', cropId: null, numberOfPlants: '', size: '', unit: '', organicStartOfTransition: '', coordenadas: [],
});

export function aFormulario(p: ApiUserCustomer | null, empresa: number): FormProductor {
  const a = p?.location?.address ?? {};
  const plantas = new Map((p?.farm?.farmPlantInformationList ?? []).map((x) => [x.productType?.id, x]));
  return {
    farmerCompanyInternalId: t(p?.farmerCompanyInternalId),
    name: t(p?.name),
    surname: t(p?.surname),
    gender: (p?.gender ?? '') as FormProductor['gender'],
    phone: t(p?.phone),
    email: t(p?.email),
    hasSmartphone: !!p?.hasSmartphone,
    pais: a.country?.id ?? null,
    dir: {
      address: t(a.address), city: t(a.city), state: t(a.state), zip: t(a.zip), otherAddress: t(a.otherAddress),
      village: t(a.village), cell: t(a.cell), sector: t(a.sector),
      hondurasFarm: t(a.hondurasFarm), hondurasVillage: t(a.hondurasVillage), hondurasMunicipality: t(a.hondurasMunicipality), hondurasDepartment: t(a.hondurasDepartment),
    },
    lat: n(p?.location?.latitude),
    lng: n(p?.location?.longitude),
    banco: { accountHolderName: t(p?.bank?.accountHolderName), accountNumber: t(p?.bank?.accountNumber), bankName: t(p?.bank?.bankName), additionalInformation: t(p?.bank?.additionalInformation) },
    unidadArea: t(p?.farm?.areaUnit),
    areaTotal: n(p?.farm?.totalCultivatedArea),
    organico: !!p?.farm?.organic,
    areaOrganica: n(p?.farm?.areaOrganicCertified),
    inicioTransicion: t(p?.farm?.startTransitionToOrganic).slice(0, 10),
    cultivos: (p?.productTypes ?? []).map((pt) => ({ productTypeId: pt.id!, area: n(plantas.get(pt.id)?.plantCultivatedArea), plantas: n(plantas.get(pt.id)?.numberOfPlants) })),
    miembroCooperativa: p ? (p.cooperatives ?? []).some((c) => c.company?.id === empresa) : true,
    asociaciones: (p?.associations ?? []).map((x) => x.company?.id).filter((x): x is number => typeof x === 'number'),
    certificaciones: (p?.certifications ?? []).map((c) => ({ id: c.id, type: t(c.type), description: t(c.description), validity: t(c.validity).slice(0, 10), certificate: c.certificate ?? null })),
    parcelas: (p?.plots ?? []).map((x) => ({
      id: x.id,
      plotName: t(x.plotName),
      cropId: x.crop?.id ?? null,
      numberOfPlants: n(x.numberOfPlants),
      size: n(x.size),
      unit: t(x.unit),
      organicStartOfTransition: t(x.organicStartOfTransition).slice(0, 10),
      geoId: x.geoId,
      externalId: x.externalId,
      coordenadas: (x.coordinates ?? []).filter((c) => typeof c.latitude === 'number' && typeof c.longitude === 'number').map((c) => [c.longitude!, c.latitude!] as Punto),
    })),
  };
}

export type Catalogos = { paises: ApiCountry[]; tiposProducto: ApiProductType[] };

/** Arma el productor para la API a partir del original (si existe) y del formulario. */
export function aApi(f: FormProductor, original: ApiUserCustomer | null, empresa: number, cat: Catalogos): ApiUserCustomer {
  const tipo = (id: number | null) => cat.tiposProducto.find((x) => x.id === id) ?? (id ? { id } : undefined);
  // El país siempre sale del catálogo (el backend lo identifica por id; código y nombre son de lectura).
  const pais = cat.paises.find((x) => x.id === f.pais);
  const formato = formatoDireccion(pais?.code);
  // Solo se mandan los campos de dirección del formato del país: si alguien cambia de país, no
  // quedan restos del formato anterior.
  const camposDir = { RW: ['village', 'cell', 'sector'], HN: ['hondurasFarm', 'hondurasVillage', 'hondurasMunicipality', 'hondurasDepartment'], general: ['address', 'city', 'state', 'zip', 'otherAddress'] }[formato] as (keyof FormProductor['dir'])[];
  const coops = (original?.cooperatives ?? []).filter((c) => c.company?.id !== empresa);
  const original_asoc = new Map((original?.associations ?? []).map((x) => [x.company?.id, x]));
  const original_parc = new Map((original?.plots ?? []).map((x) => [x.id, x]));

  return {
    ...(original ?? {}),
    companyId: original?.companyId ?? empresa,
    type: 'FARMER',
    farmerCompanyInternalId: f.farmerCompanyInternalId,
    name: f.name,
    surname: f.surname,
    gender: f.gender || undefined,
    phone: f.phone,
    email: f.email,
    hasSmartphone: f.hasSmartphone,
    location: {
      ...(original?.location ?? {}),
      latitude: aNumero(f.lat),
      longitude: aNumero(f.lng),
      address: { country: pais, ...Object.fromEntries(camposDir.map((k) => [k, f.dir[k]])) },
    },
    bank: { ...f.banco },
    farm: {
      ...(original?.farm ?? {}),
      areaUnit: f.unidadArea,
      totalCultivatedArea: aNumero(f.areaTotal),
      organic: f.organico,
      areaOrganicCertified: f.organico ? aNumero(f.areaOrganica) : undefined,
      startTransitionToOrganic: f.organico && f.inicioTransicion ? f.inicioTransicion : undefined,
      farmPlantInformationList: f.cultivos.map((c) => ({ productType: tipo(c.productTypeId), plantCultivatedArea: aNumero(c.area), numberOfPlants: aNumero(c.plantas) })),
    },
    productTypes: f.cultivos.map((c) => tipo(c.productTypeId)!).filter(Boolean),
    cooperatives: [
      ...coops,
      ...(f.miembroCooperativa
        ? [(original?.cooperatives ?? []).find((c) => c.company?.id === empresa) ?? { company: { id: empresa }, userCustomerType: 'FARMER' as const }]
        : []),
    ],
    associations: f.asociaciones.map((id) => original_asoc.get(id) ?? { company: { id } }),
    certifications: f.certificaciones.map((c) => ({ id: c.id, type: c.type, description: c.description, validity: c.validity || undefined, certificate: c.certificate ?? undefined })),
    plots: f.parcelas.map((x) => ({
      ...(x.id ? original_parc.get(x.id) ?? {} : {}),
      id: x.id,
      plotName: x.plotName,
      crop: tipo(x.cropId),
      numberOfPlants: aNumero(x.numberOfPlants),
      size: aNumero(x.size),
      unit: x.unit || undefined,
      organicStartOfTransition: x.organicStartOfTransition || undefined,
      externalId: x.externalId,
      coordinates: x.coordenadas.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
    })),
  };
}
