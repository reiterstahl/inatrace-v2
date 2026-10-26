import type { ApiCountry, ApiPlot, ApiProductType, ApiUserCustomer } from '@/api/gen/types.gen';

/** Datos ficticios para el modo simulado. Personas, cooperativa y parcelas son inventadas. */
export const EMPRESA_DEMO = { id: 1, name: 'Cooperativa Flor de la Sierra' };

export const paises: ApiCountry[] = [
  { id: 90, code: 'GT', name: 'Guatemala', latitude: 15.78, longitude: -90.23 },
  { id: 95, code: 'HN', name: 'Honduras', latitude: 15.2, longitude: -86.24 },
  { id: 180, code: 'RW', name: 'Rwanda', latitude: -1.94, longitude: 29.87 },
];

export const tiposProducto: ApiProductType[] = [
  { id: 1, name: 'Café', code: 'COFFEE' },
  { id: 2, name: 'Cacao', code: 'COCOA' },
];

const cuadrado = (lng: number, lat: number, d = 0.002) => [
  { latitude: lat, longitude: lng }, { latitude: lat, longitude: lng + d }, { latitude: lat + d, longitude: lng + d }, { latitude: lat + d, longitude: lng },
];

const gt = { id: 90, code: 'GT', name: 'Guatemala' };

export const productoresIniciales: ApiUserCustomer[] = [
  {
    id: 101, companyId: 1, type: 'FARMER', farmerCompanyInternalId: 'FS-001', name: 'María', surname: 'López', gender: 'FEMALE', phone: '+502 5555 0101', hasSmartphone: true,
    location: { latitude: 15.32, longitude: -91.47, address: { city: 'Huehuetenango', state: 'Huehuetenango', country: gt } },
    farm: { areaUnit: 'ha', totalCultivatedArea: 2.5, organic: true, areaOrganicCertified: 2, farmPlantInformationList: [{ productType: tiposProducto[0], plantCultivatedArea: 2.5, numberOfPlants: 5200 }] },
    productTypes: [tiposProducto[0]!],
    cooperatives: [{ id: 1, company: { id: 1 }, userCustomerType: 'FARMER' }],
    plots: [{ id: 1001, plotName: 'La Loma', crop: tiposProducto[0], size: 1.5, unit: 'ha', geoId: 'demo-geoid-1001', coordinates: cuadrado(-91.47, 15.32, 0.012) }],
  },
  {
    id: 102, companyId: 1, type: 'FARMER', farmerCompanyInternalId: 'FS-002', name: 'Pedro', surname: 'Ajcá', gender: 'MALE', phone: '+502 5555 0102', bank: { bankName: 'Banrural', accountNumber: '3-099-12345-6', accountHolderName: 'Pedro Ajcá' },
    location: { address: { city: 'Chiantla', state: 'Huehuetenango', country: gt } },
    farm: { areaUnit: 'mz', totalCultivatedArea: 4 },
    productTypes: [tiposProducto[0]!],
    cooperatives: [{ id: 2, company: { id: 1 }, userCustomerType: 'FARMER' }],
    plots: [],
  },
  {
    id: 103, companyId: 1, type: 'FARMER', farmerCompanyInternalId: 'FS-003', name: 'Rosa', surname: 'Cux', gender: 'FEMALE',
    location: { latitude: 14.84, longitude: -91.52, address: { city: 'Quetzaltenango', state: 'Quetzaltenango', country: gt } },
    productTypes: [tiposProducto[0]!],
    cooperatives: [{ id: 3, company: { id: 1 }, userCustomerType: 'FARMER' }],
    plots: [{ id: 1002, plotName: 'El Mirador', crop: tiposProducto[0], size: 0.8, unit: 'ha', coordinates: cuadrado(-91.52, 14.84) }],
  },
];

export const capasMapa = [
  { id: 1, code: 'SATELITE', label: 'Imagen satelital', type: 'ARCGIS_REST', url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer', opacity: 1, visibleByDefault: false, enabled: true, sortOrder: 1 },
];

export const tiposCertificacion = [
  { id: 1, code: 'ORGANIC', label: 'Orgánico', enabled: true },
  { id: 2, code: 'FAIRTRADE', label: 'Comercio justo', enabled: true },
];

export const parcelasDe = (lista: ApiUserCustomer[]): ApiPlot[] => lista.flatMap((p) => (p.plots ?? []).map((pl) => ({ ...pl, farmerId: p.id })));
