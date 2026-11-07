// Llena una COPIA AISLADA de INATrace con datos sintéticos, por su API, para verla "con vida":
//   · ~40 productores y 6 acopiadores con ubicación, banco y parcelas (polígonos) en zonas cafetaleras
//     de Guatemala,
//   · ~170 entregas en los últimos 12 meses (más en cosecha), con pagos (parte confirmados),
//   · procesamientos de pergamino a oro en la bodega, clientes compradores y lotes de la etiqueta.
// Todo es inventado: los nombres son combinaciones comunes y los correos usan example.org.
// Es reproducible (azar con semilla fija) y no vuelve a sembrar si ya lo hizo (FORZAR=1 para repetir).
//
// Pensado para la COPIA AISLADA de desarrollo, nunca para una instancia institucional.
// Uso:
//   INATRACE_API=http://127.0.0.1:8381 INATRACE_USUARIO=… INATRACE_CLAVE=… node scripts/sembrar-lleno.mjs

const API = process.env.INATRACE_API ?? 'http://127.0.0.1:8381';
const C = {
  empresa: Number(process.env.DEMO_EMPRESA ?? 1),
  acopio: Number(process.env.DEMO_INSTALACION ?? 5), // recibe cereza y pergamino
  bodega: Number(process.env.DEMO_INSTALACION_PROC ?? 6), // recibe pergamino y oro; ahí se trilla
  cereza: Number(process.env.DEMO_CEREZA ?? 3),
  pergamino: Number(process.env.DEMO_PERGAMINO ?? 4),
  oro: Number(process.env.DEMO_ORO ?? 5),
  trillado: Number(process.env.DEMO_ACCION_TRILLADO ?? 2),
  producto: Number(process.env.DEMO_PRODUCTO ?? 1),
  productores: Number(process.env.DEMO_PRODUCTORES ?? 40),
  acopiadores: 6,
  entregas: Number(process.env.DEMO_ENTREGAS ?? 170),
};
const MARCA = '@example.org';

if (!process.env.INATRACE_USUARIO || !process.env.INATRACE_CLAVE) {
  console.error('Faltan INATRACE_USUARIO e INATRACE_CLAVE.');
  process.exit(1);
}

// ---------- Cliente mínimo con cookies ----------
let cookies = '';
async function llamar(metodo, ruta, cuerpo) {
  const r = await fetch(API + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', Cookie: cookies }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const nuevas = r.headers.getSetCookie?.() ?? [];
  if (nuevas.length) cookies = nuevas.map((c) => c.split(';')[0]).join('; ');
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.status !== 'OK') throw new Error(`${metodo} ${ruta} → ${r.status} ${d.status ?? ''}: ${d.errorMessage ?? JSON.stringify(d).slice(0, 300)}`);
  return d.data;
}
const paso = (t) => console.log('·', t);
const fallas = [];
async function intentar(que, fn) {
  try {
    return await fn();
  } catch (e) {
    fallas.push(`${que}: ${e.message}`);
    return undefined;
  }
}

// ---------- Azar reproducible ----------
let semilla = Number(process.env.SEMILLA ?? 20261107);
const azar = () => ((semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const entre = (a, b) => a + azar() * (b - a);
const entero = (a, b) => Math.floor(entre(a, b + 1));
const uno = (lista) => lista[Math.floor(azar() * lista.length)];
const redondo = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- Datos de base (inventados) ----------
const NOMBRES_F = ['María', 'Rosa', 'Ana', 'Juana', 'Marta', 'Elena', 'Lucía', 'Sandra', 'Carmen', 'Olga', 'Isabel', 'Patricia', 'Delfina', 'Petrona', 'Catalina', 'Aura', 'Norma', 'Gloria'];
const NOMBRES_M = ['José', 'Juan', 'Pedro', 'Carlos', 'Miguel', 'Luis', 'Francisco', 'Domingo', 'Mario', 'Santiago', 'Diego', 'Andrés', 'Tomás', 'Mateo', 'Felipe', 'Gaspar', 'Esteban', 'Ricardo'];
const APELLIDOS = ['López', 'Pérez', 'García', 'Ramírez', 'Hernández', 'Morales', 'Méndez', 'Jiménez', 'Ajcá', 'Xicará', 'Cux', 'Tzul', 'Velásquez', 'Ordóñez', 'Gómez', 'Chávez', 'Sic', 'Coy', 'Tum', 'Barrios', 'Escobar', 'Fuentes', 'Cifuentes', 'Recinos'];
const ZONAS = [
  { depto: 'Huehuetenango', muni: 'La Libertad', aldeas: ['El Injerto', 'Peña Roja', 'La Esperanza'], lat: 15.515, lng: -91.866 },
  { depto: 'Huehuetenango', muni: 'La Democracia', aldeas: ['Chichimes', 'El Jícaro', 'Camojallito'], lat: 15.62, lng: -91.885 },
  { depto: 'Huehuetenango', muni: 'Cuilco', aldeas: ['Agua Dulce', 'El Rodeo', 'Sabinito'], lat: 15.407, lng: -91.95 },
  { depto: 'San Marcos', muni: 'San Pablo', aldeas: ['Toquián Grande', 'Santa Elena', 'El Naranjo'], lat: 14.93, lng: -92.0 },
  { depto: 'Sololá', muni: 'San Lucas Tolimán', aldeas: ['Pampojilá', 'Xejuyú', 'Panimaché'], lat: 14.632, lng: -91.14 },
  { depto: 'Sololá', muni: 'Santiago Atitlán', aldeas: ['Cerro de Oro', 'Chukmuk', 'Panabaj'], lat: 14.638, lng: -91.23 },
  { depto: 'Sacatepéquez', muni: 'San Miguel Dueñas', aldeas: ['Las Cruces', 'El Rosario', 'San José Calderas'], lat: 14.522, lng: -90.799 },
  { depto: 'Chimaltenango', muni: 'San Martín Jilotepeque', aldeas: ['Choatalún', 'Las Lomas', 'Xesuj'], lat: 14.78, lng: -90.79 },
  { depto: 'Alta Verapaz', muni: 'Cobán', aldeas: ['Chicoyou', 'Sasís', 'Chirrepec'], lat: 15.47, lng: -90.37 },
  { depto: 'Jalapa', muni: 'Mataquescuintla', aldeas: ['Soledad Grande', 'Las Trojes', 'El Paraíso'], lat: 14.53, lng: -90.185 },
];
const BANCOS = ['Banrural', 'Banco Industrial', 'BAM', 'Bantrab', 'Cooperativa Fénix'];

/** Polígono de 4 a 6 puntos alrededor de un centro, de tamaño aproximado en hectáreas. */
function poligono(lat, lng, ha) {
  const r = Math.sqrt((ha * 10000) / Math.PI) / 111000; // radio en grados
  const n = entero(4, 6);
  const giro = entre(0, Math.PI * 2);
  return Array.from({ length: n }, (_, i) => {
    const a = giro + (i / n) * Math.PI * 2;
    const k = entre(0.75, 1.2);
    return { latitude: redondo(lat + Math.sin(a) * r * k, 6), longitude: redondo(lng + (Math.cos(a) * r * k) / Math.cos((lat * Math.PI) / 180), 6) };
  });
}

// ---------- Inicio ----------
await llamar('POST', '/api/user/login', { username: process.env.INATRACE_USUARIO, password: process.env.INATRACE_CLAVE });
const yo = await llamar('GET', '/api/user/profile');
paso(`Sesión iniciada (${yo.email})`);

const existentes = (await llamar('GET', `/api/company/userCustomers/${C.empresa}/FARMER?limit=1000`)).items ?? [];
if (existentes.some((p) => (p.email ?? '').endsWith(MARCA)) && process.env.FORZAR !== '1') {
  console.log('Esta copia ya tiene los datos sintéticos (productores con correo @example.org). FORZAR=1 para sembrar otra vez.');
  process.exit(0);
}

const paises = await llamar('GET', '/api/common/countries?limit=500');
const pais = (codigo) => (paises.items ?? paises).find((p) => p.code === codigo);
const guatemala = pais('GT');
const cafe = (await llamar('GET', '/api/chain/product-type/list?limit=50').catch(() => ({ items: [] }))).items?.find((x) => x.code === 'COFFEE');

// ---------- 1. Productores y acopiadores ----------
const usados = new Set();
function persona(tipo) {
  for (;;) {
    const mujer = azar() < 0.42;
    const nombre = uno(mujer ? NOMBRES_F : NOMBRES_M);
    const apellido = `${uno(APELLIDOS)} ${uno(APELLIDOS)}`;
    const clave = `${nombre} ${apellido}`;
    if (usados.has(clave)) continue;
    usados.add(clave);
    const zona = uno(ZONAS);
    const aldea = uno(zona.aldeas);
    const correo = `${sinTildes(nombre)}.${sinTildes(apellido.split(' ')[0])}${entero(1, 99)}${MARCA}`;
    const cuerpo = {
      type: tipo,
      name: nombre,
      surname: apellido,
      gender: mujer ? 'FEMALE' : 'MALE',
      phone: `+502 ${entero(3, 5)}${entero(100, 999)} ${entero(1000, 9999)}`,
      email: correo,
      hasSmartphone: azar() < 0.6,
      location: { address: { address: `Caserío ${aldea}`, city: zona.muni, state: zona.depto, village: aldea, country: guatemala }, publiclyVisible: azar() < 0.3 },
      bank: azar() < 0.7 ? { accountHolderName: `${nombre} ${apellido}`, accountNumber: String(entero(1e9, 9e9)), bankName: uno(BANCOS) } : undefined,
      cooperatives: [{ company: { id: C.empresa }, userCustomerType: tipo }],
      productTypes: cafe ? [{ id: cafe.id }] : [],
    };
    if (tipo === 'FARMER') {
      cuerpo.farm = { areaUnit: 'ha', totalCultivatedArea: 0, organic: azar() < 0.25 };
      const parcelas = entero(1, 2);
      cuerpo.plots = Array.from({ length: parcelas }, (_, i) => {
        const ha = redondo(entre(0.4, 3.5), 1);
        const lat = zona.lat + entre(-0.04, 0.04);
        const lng = zona.lng + entre(-0.04, 0.04);
        cuerpo.farm.totalCultivatedArea = redondo(cuerpo.farm.totalCultivatedArea + ha, 1);
        return { plotName: `${uno(['Parcela', 'Finca', 'Lote'])} ${uno(['El Mirador', 'La Cumbre', 'Los Pinos', 'El Encino', 'La Ceiba', 'Las Brisas', 'El Manantial', 'San Isidro', 'La Joya', 'El Porvenir'])}${parcelas > 1 ? ` ${i + 1}` : ''}`, crop: cafe ? { id: cafe.id } : undefined, unit: 'ha', size: ha, coordinates: poligono(lat, lng, ha) };
      });
    }
    return cuerpo;
  }
}

const productores = [];
for (let i = 0; i < C.productores; i++) {
  const p = await intentar('productor', () => llamar('POST', `/api/company/userCustomers/add/${C.empresa}`, persona('FARMER')));
  if (p) productores.push(p);
}
paso(`${productores.length} productores con ${productores.reduce((n, p) => n + (p.plots?.length ?? 0), 0)} parcelas`);
const acopiadores = ((await llamar('GET', `/api/company/userCustomers/${C.empresa}/COLLECTOR?limit=1000`)).items ?? []).filter((a) => (a.email ?? '').endsWith(MARCA));
for (let i = acopiadores.length; i < C.acopiadores; i++) {
  const a = await intentar('acopiador', () => llamar('POST', `/api/company/userCustomers/add/${C.empresa}`, persona('COLLECTOR')));
  if (a) acopiadores.push(a);
}
paso(`${acopiadores.length} acopiadores`);

// ---------- 2. Entregas de los últimos 12 meses ----------
const hoy = new Date();
const COSECHA = [11, 12, 1, 2, 3]; // meses de cosecha: más entregas
function fechaAlAzar() {
  for (;;) {
    const dias = entero(3, 360);
    const f = new Date(hoy.getTime() - dias * 86400000);
    if (COSECHA.includes(f.getMonth() + 1) || azar() < 0.35) return f.toISOString().slice(0, 10);
  }
}
const entregas = [];
for (let i = 0; i < C.entregas && productores.length; i++) {
  const p = uno(productores);
  const fecha = fechaAlAzar();
  const enBodega = azar() < 0.3; // pergamino que llega directo a la bodega
  const semi = enBodega ? C.pergamino : azar() < 0.8 ? C.cereza : C.pergamino;
  const esCereza = semi === C.cereza;
  const bruto = redondo(esCereza ? entre(150, 1400) : entre(80, 700));
  const tara = azar() < 0.5 ? redondo(bruto * entre(0.01, 0.03)) : undefined;
  const neto = bruto - (tara ?? 0);
  const despues = azar() < 0.06;
  const cuerpo = {
    orderType: 'PURCHASE_ORDER',
    identifier: `PT-${p.surname}-${fecha}`,
    totalQuantity: neto,
    fulfilledQuantity: neto,
    availableQuantity: neto,
    facility: { id: enBodega ? C.bodega : C.acopio },
    producerUserCustomer: { id: p.id },
    representativeOfProducerUserCustomer: acopiadores.length && azar() < 0.2 ? { id: uno(acopiadores).id } : undefined,
    plots: (p.plots ?? []).slice(0, 1).map((x) => ({ id: x.id })),
    productionDate: fecha,
    semiProduct: { id: semi },
    creatorId: yo.id,
    totalGrossQuantity: bruto,
    tare: tara,
    pricePerUnit: despues ? undefined : redondo(esCereza ? entre(0.95, 1.4) : entre(3.4, 4.6), 2),
    priceDeterminedLater: despues,
    currency: 'USD',
    organic: azar() < 0.25,
    womenShare: p.gender === 'FEMALE' || azar() < 0.1,
    preferredWayOfPayment: uno(['CASH', 'CASH', 'BANK_TRANSFER', 'CHEQUE']),
  };
  const e = await intentar('entrega', () => llamar('PUT', '/api/chain/stock-order', cuerpo));
  if (e) entregas.push({ id: e.id ?? e, fecha, cuerpo });
}
paso(`${entregas.length} entregas`);

// ---------- 3. Pagos (los más viejos, casi todos; parte confirmados) ----------
// El backend exige el comprobante: se sube un único PDF de ejemplo y se usa en todos.
function pdfDeEjemplo() {
  const texto = 'Recibo de ejemplo - dato sintetico de demostracion (INATrace v2)';
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const flujo = `BT /F1 12 Tf 30 100 Td (${texto}) Tj ET`;
  objetos[3] = `<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`;
  let pdf = '%PDF-1.4\n';
  const posiciones = objetos.map((o, i) => {
    const pos = pdf.length;
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return pos;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}
async function subirComprobante() {
  const fd = new FormData();
  fd.append('file', new Blob([pdfDeEjemplo()], { type: 'application/pdf' }), 'recibo-ejemplo.pdf');
  const r = await fetch(API + '/api/common/document', { method: 'POST', headers: { Cookie: cookies }, body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.status !== 'OK') throw new Error(`subir comprobante → ${r.status} ${d.errorMessage ?? ''}`);
  return d.data;
}
const comprobante = await intentar('comprobante', subirComprobante);
let pagos = 0;
let confirmados = 0;
for (const e of entregas) {
  const dias = (hoy - new Date(e.fecha)) / 86400000;
  if (dias < 20 || azar() > 0.75) continue;
  const o = await intentar('leer entrega', () => llamar('GET', `/api/chain/stock-order/${e.id}`));
  if (!o?.cost) continue;
  const parcial = azar() < 0.25;
  const pagoFecha = new Date(new Date(e.fecha).getTime() + entero(1, 15) * 86400000).toISOString().slice(0, 10);
  const pago = {
    stockOrder: { id: o.id },
    payingCompany: { id: C.empresa },
    recipientType: 'USER_CUSTOMER',
    recipientUserCustomer: o.producerUserCustomer ? { id: o.producerUserCustomer.id } : undefined,
    representativeOfRecipientUserCustomer: o.representativeOfProducerUserCustomer ? { id: o.representativeOfProducerUserCustomer.id } : undefined,
    preferredWayOfPayment: o.preferredWayOfPayment,
    formalCreationTime: pagoFecha,
    paymentPurposeType: parcial ? 'ADVANCE_PAYMENT' : 'FIRST_INSTALLMENT',
    paymentType: o.representativeOfProducerUserCustomer ? 'CASH_VIA_COLLECTOR' : 'CASH',
    amount: redondo(parcial ? o.cost * 0.5 : o.cost, 2),
    currency: o.currency ?? 'USD',
    receiptNumber: `R-${String(1000 + pagos).padStart(5, '0')}`,
    receiptDocumentType: 'RECEIPT',
    receiptDocument: comprobante,
    paymentStatus: 'UNCONFIRMED',
  };
  const creado = await intentar('pago', () => llamar('PUT', '/api/chain/payment', pago));
  if (creado === undefined) continue;
  pagos++;
  if (azar() < 0.6) {
    const id = creado.id ?? creado;
    const leido = await intentar('leer pago', () => llamar('GET', `/api/chain/payment/${id}`));
    if (leido && (await intentar('confirmar pago', () => llamar('PUT', '/api/chain/payment', { ...leido, paymentStatus: 'CONFIRMED' }))) !== undefined) confirmados++;
  }
}
paso(`${pagos} pagos (${confirmados} confirmados)`);

// ---------- 4. Trillado en la bodega: pergamino → oro (rinde ~80 %) ----------
const semiOro = await llamar('GET', `/api/chain/semi-product/${C.oro}`).catch(() => null);
const deBodega = entregas.filter((e) => e.cuerpo.facility.id === C.bodega && e.cuerpo.semiProduct.id === C.pergamino).sort((a, b) => a.fecha.localeCompare(b.fecha));
let procesos = 0;
for (let i = 0; i + 2 < deBodega.length && procesos < 8; i += 3) {
  const grupo = deBodega.slice(i, i + 3);
  const lotes = [];
  for (const g of grupo) {
    const o = await intentar('leer lote', () => llamar('GET', `/api/chain/stock-order/${g.id}`));
    if (o?.availableQuantity > 0) lotes.push(o);
  }
  if (!lotes.length) continue;
  const fecha = grupo.at(-1).fecha;
  const entra = lotes.reduce((n, o) => n + o.availableQuantity, 0);
  const sale = redondo(entra * entre(0.78, 0.82));
  const ok = await intentar('trillado', () =>
    llamar('PUT', '/api/chain/processing-order', {
      processingAction: { id: C.trillado },
      processingDate: fecha,
      inputTransactions: lotes.map((o) => ({
        company: { id: C.empresa },
        sourceStockOrder: o,
        semiProduct: { id: C.pergamino },
        sourceFacility: { id: C.bodega },
        status: 'EXECUTED',
        isProcessing: true,
        inputMeasureUnitType: o.measureUnitType,
        inputQuantity: o.availableQuantity,
        outputQuantity: o.availableQuantity,
      })),
      targetStockOrders: [
        {
          company: { id: C.empresa },
          creatorId: yo.id,
          facility: { id: C.bodega },
          semiProduct: { id: C.oro },
          measureUnitType: semiOro?.measurementUnitType,
          orderType: 'PROCESSING_ORDER',
          totalQuantity: sale,
          fulfilledQuantity: sale,
          availableQuantity: sale,
          productionDate: fecha,
          internalLotNumber: `TRI-${fecha.replaceAll('-', '')}-${procesos + 1}`,
        },
      ],
    }),
  );
  if (ok !== undefined) procesos++;
}
paso(`${procesos} trillados`);

// ---------- 5. Clientes compradores ----------
const CLIENTES = [
  { nombre: 'Rösterei Nordlicht', oficial: 'Rösterei Nordlicht GmbH', pais: 'DE', ciudad: 'Hamburgo', contacto: 'Compras de café verde' },
  { nombre: 'Tostadores del Pacífico', oficial: 'Tostadores del Pacífico S.A.', pais: 'MX', ciudad: 'Guadalajara', contacto: 'Abastecimiento' },
  { nombre: 'Maple Roast Co.', oficial: 'Maple Roast Company Ltd.', pais: 'CA', ciudad: 'Montreal', contacto: 'Green coffee buyer' },
  { nombre: 'Kaffee Kooperative Süd', oficial: 'Kaffee Kooperative Süd eG', pais: 'DE', ciudad: 'Múnich', contacto: 'Einkauf' },
  { nombre: 'Café Sakura', oficial: 'Sakura Coffee Trading K.K.', pais: 'JP', ciudad: 'Osaka', contacto: 'Import department' },
  { nombre: 'Brew & Bean', oficial: 'Brew and Bean LLC', pais: 'US', ciudad: 'Portland', contacto: 'Sourcing' },
];
const yaClientes = (await llamar('GET', `/api/company/companyCustomers/list/${C.empresa}?limit=500`)).items ?? [];
let clientes = 0;
for (const c of CLIENTES) {
  if (yaClientes.some((x) => x.name === c.nombre)) continue;
  const ok = await intentar('cliente', () =>
    llamar('POST', '/api/company/companyCustomers', {
      companyId: C.empresa,
      name: c.nombre,
      officialCompanyName: c.oficial,
      contact: c.contacto,
      email: `compras.${sinTildes(c.nombre).replace(/[^a-z]+/g, '')}${MARCA}`,
      phone: `+${entero(1, 99)} ${entero(100, 999)} ${entero(100000, 999999)}`,
      location: { address: `${uno(['Hafenstraße', 'Main Street', 'Avenida Central', 'Rue du Port'])} ${entero(1, 120)}`, city: c.ciudad, country: pais(c.pais) },
    }),
  );
  if (ok !== undefined) clientes++;
}
paso(`${clientes} clientes`);

// ---------- 6. Lotes de la etiqueta publicada ----------
const etiquetas = (await llamar('GET', `/api/product/${C.producto}/labels`)) ?? [];
const etiqueta = etiquetas.find((e) => e.status === 'PUBLISHED') ?? etiquetas[0];
let lotes = 0;
if (etiqueta) {
  const ya = (await llamar('GET', `/api/product/label/${etiqueta.id}/batches`).catch(() => [])) ?? [];
  for (let i = 0; i < 8; i++) {
    const numero = `L2026${String(i + 1).padStart(2, '0')}`;
    if ((ya.items ?? ya).some?.((b) => b.number === numero)) continue;
    const produccion = new Date(hoy.getTime() - entero(20, 300) * 86400000).toISOString().slice(0, 10);
    const vence = new Date(new Date(produccion).getTime() + 365 * 86400000).toISOString().slice(0, 10);
    const zonas = [uno(ZONAS), uno(ZONAS)];
    const ok = await intentar('lote', () =>
      llamar('POST', '/api/product/label_batch/create', {
        labelId: etiqueta.id,
        number: numero,
        productionDate: produccion,
        expiryDate: vence,
        checkAuthenticity: true,
        traceOrigin: true,
        locations: zonas.map((z) => ({ latitude: redondo(z.lat, 4), longitude: redondo(z.lng, 4), pinName: `${z.muni}, ${z.depto}`, numberOfFarmers: entero(5, 40) })),
      }),
    );
    if (ok !== undefined) lotes++;
  }
}
paso(`${lotes} lotes en la etiqueta «${etiqueta?.title ?? '—'}»`);

if (fallas.length) {
  console.log(`\n${fallas.length} operaciones fallaron (las primeras):`);
  for (const f of [...new Set(fallas)].slice(0, 12)) console.log('  -', f);
}
