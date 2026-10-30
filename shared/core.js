// Dominio de Morada: catálogos, planes, valoración (AVM), Ley de Arrendamiento 2026,
// conversión bivaluta y cálculos financieros. Módulo puro: corre igual en Node y en el navegador.

export const OPERATIONS = { venta: 'Venta', alquiler: 'Alquiler' };

export const TYPES = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  townhouse: 'Townhouse',
  oficina: 'Oficina',
  local: 'Local comercial',
  terreno: 'Terreno',
  galpon: 'Galpón',
};

export const STATES = { nuevo: 'A estrenar', bueno: 'Buen estado', reformar: 'Para remodelar' };

// Características pensadas para el mercado venezolano (agua, electricidad, seguridad).
export const FEATURES = {
  ascensor: 'Ascensor',
  planta: 'Planta eléctrica',
  tanque: 'Tanque de agua',
  pozo: 'Pozo de agua',
  vigilancia: 'Vigilancia 24h',
  piscina: 'Piscina',
  amoblado: 'Amoblado',
  mascotas: 'Acepta mascotas',
  terraza: 'Terraza / balcón',
  vista: 'Vista al Ávila / mar',
  gimnasio: 'Gimnasio',
  paneles: 'Paneles solares',
};

export const PAYMENTS = { usd: 'USD efectivo / transferencia', ves: 'Bolívares (tasa BCV)', usdt: 'USDT / stablecoin', zelle: 'Zelle' };

export const DOC_KINDS = {
  titulo: 'Documento de propiedad registrado (SAREN)',
  gravamen: 'Certificado de gravamen / libertad',
  catastral: 'Cédula catastral vigente',
  solvencia: 'Solvencia municipal (derecho de frente)',
  condominio: 'Solvencia de condominio',
};

// Zonas: coordenadas aproximadas del centro y precio base de referencia (USD/m², demo).
export const ZONES = [
  { id: 'altamira', name: 'Altamira', city: 'Caracas', lat: 10.4966, lng: -66.8486, base: 1150 },
  { id: 'la-castellana', name: 'La Castellana', city: 'Caracas', lat: 10.5006, lng: -66.8556, base: 1250 },
  { id: 'los-palos-grandes', name: 'Los Palos Grandes', city: 'Caracas', lat: 10.4992, lng: -66.8424, base: 1100 },
  { id: 'country-club', name: 'Country Club', city: 'Caracas', lat: 10.5051, lng: -66.8655, base: 1550 },
  { id: 'las-mercedes', name: 'Las Mercedes', city: 'Caracas', lat: 10.4815, lng: -66.8590, base: 1050 },
  { id: 'chacao', name: 'Chacao', city: 'Caracas', lat: 10.4933, lng: -66.8540, base: 950 },
  { id: 'el-hatillo', name: 'El Hatillo', city: 'Caracas', lat: 10.4247, lng: -66.8253, base: 820 },
  { id: 'la-florida', name: 'La Florida', city: 'Caracas', lat: 10.5003, lng: -66.8740, base: 720 },
  { id: 'el-cafetal', name: 'El Cafetal', city: 'Caracas', lat: 10.4642, lng: -66.8286, base: 760 },
  { id: 'santa-fe', name: 'Santa Fe', city: 'Caracas', lat: 10.4603, lng: -66.8708, base: 800 },
  { id: 'prados-del-este', name: 'Prados del Este', city: 'Caracas', lat: 10.4560, lng: -66.8870, base: 740 },
  { id: 'el-vinedo', name: 'El Viñedo', city: 'Valencia', lat: 10.1886, lng: -68.0050, base: 600 },
  { id: 'prebo', name: 'Prebo', city: 'Valencia', lat: 10.2050, lng: -68.0120, base: 650 },
  { id: 'la-trigalena', name: 'La Trigaleña', city: 'Valencia', lat: 10.2240, lng: -68.0070, base: 560 },
  { id: 'tierra-negra', name: 'Tierra Negra', city: 'Maracaibo', lat: 10.6730, lng: -71.6200, base: 470 },
  { id: '5-de-julio', name: '5 de Julio', city: 'Maracaibo', lat: 10.6610, lng: -71.6150, base: 500 },
  { id: 'lecheria', name: 'Lechería', city: 'Lechería', lat: 10.1890, lng: -64.6930, base: 720 },
  { id: 'merida-centro', name: 'Mérida Norte', city: 'Mérida', lat: 8.6050, lng: -71.1400, base: 450 },
  { id: 'pampatar', name: 'Pampatar', city: 'Margarita', lat: 11.0020, lng: -63.7980, base: 620 },
  { id: 'barquisimeto-este', name: 'Barquisimeto Este', city: 'Barquisimeto', lat: 10.0670, lng: -69.2900, base: 500 },
];

export const CITIES = [...new Set(ZONES.map(z => z.city))];
export const zoneById = id => ZONES.find(z => z.id === id);

// Planes para profesionales (estudio de factibilidad, sección "Business Plan").
export const PLANS = {
  prueba: { id: 'prueba', name: 'Prueba', price: 0, listings: 3, featured: 0, crm: false, ledger: false, contracts: false, network: false, badge: false },
  starter: { id: 'starter', name: 'Starter', price: 35, listings: 25, featured: 1, crm: false, ledger: false, contracts: false, network: false, badge: false },
  professional: { id: 'professional', name: 'Professional', price: 75, listings: 75, featured: 5, crm: true, ledger: true, contracts: false, network: false, badge: false },
  promax: { id: 'promax', name: 'Agency Pro Max', price: 140, listings: Infinity, featured: 20, crm: true, ledger: true, contracts: true, network: true, badge: true },
};

// Particulares: 1 aviso gratis; avisos adicionales se compran por unidad.
export const PRIVATE_FREE_LISTINGS = 1;
export const PRIVATE_EXTRA_PRICE = 9;

// Métodos de cobro. "card" requiere Stripe en el servidor; los locales se activan cuando el
// administrador carga sus datos de cobro y se confirman a mano con la referencia del cliente.
export const PAY_METHODS = {
  card: { id: 'card', name: 'Tarjeta internacional', currency: 'usd', desc: 'Visa, Mastercard, Amex. Pago seguro con Stripe.' },
  pago_movil: { id: 'pago_movil', name: 'Pago Móvil', currency: 'ves', desc: 'En bolívares a la tasa BCV del día.' },
  transferencia: { id: 'transferencia', name: 'Transferencia en bolívares', currency: 'ves', desc: 'Desde cualquier banco venezolano.' },
  zelle: { id: 'zelle', name: 'Zelle', currency: 'usd', desc: 'En dólares desde una cuenta en EE. UU.' },
  usdt: { id: 'usdt', name: 'USDT', currency: 'usd', desc: 'Stablecoin en la red indicada.' },
};
// Campos de los datos de cobro que el administrador completa para cada método local.
export const PAY_FIELDS = {
  pago_movil: [['bank', 'Banco'], ['phone', 'Teléfono'], ['id', 'Cédula / RIF']],
  transferencia: [['bank', 'Banco'], ['account', 'Número de cuenta'], ['holder', 'Titular'], ['id', 'Cédula / RIF']],
  zelle: [['email', 'Correo Zelle'], ['holder', 'Titular']],
  usdt: [['network', 'Red (TRC20, BEP20…)'], ['address', 'Dirección']],
};

export const BOOSTS = {
  destacado: { id: 'destacado', name: 'Destacado', price: 12, days: 15, desc: 'Etiqueta y borde destacado en resultados' },
  top: { id: 'top', name: 'Top en zona', price: 25, days: 15, desc: 'Primeras posiciones en tu zona y en el mapa' },
  newsletter: { id: 'newsletter', name: 'Newsletter diáspora', price: 40, days: 7, desc: 'Envío a compradores en Miami, Madrid, Roma y Milán' },
};

export const DILIGENCE = {
  basico: { id: 'basico', name: 'Básico', price: 90, items: ['Certificado de gravamen', 'Revisión del documento de propiedad'] },
  completo: { id: 'completo', name: 'Completo', price: 160, items: ['Certificado de gravamen', 'Tracto sucesivo (cadena de títulos)', 'Conformidad catastral', 'Solvencia municipal'] },
  premium: { id: 'premium', name: 'Premium inversor', price: 250, items: ['Todo lo del plan Completo', 'Validación documental SAREN', 'Inspección física con informe fotográfico', 'Acompañamiento a la firma'] },
};

export const ROLES = {
  particular: 'Propietario particular',
  agencia: 'Agencia / agente inmobiliario',
  constructora: 'Constructora / desarrollador',
  internacional: 'Agencia internacional',
  comprador: 'Comprador / inversor (diáspora)',
  admin: 'Administrador',
};

export const LEAD_STAGES = { nuevo: 'Nuevo', contactado: 'Contactado', visita: 'Visita agendada', oferta: 'Oferta', cerrado: 'Cerrado', perdido: 'Perdido' };

export const SERVICE_CATEGORIES = { mudanza: 'Mudanzas', seguro: 'Seguro de hogar', diseno: 'Diseño interior', remodelacion: 'Remodelación', limpieza: 'Limpieza', legal: 'Abogado / gestoría' };

export const SEGMENTS = [
  { id: 'particular', title: 'Propietarios', text: 'Publica tu inmueble gratis, recibe contactos verificados y cobra el alquiler en dólares o bolívares con respaldo de la nueva ley.' },
  { id: 'agencia', title: 'Agencias y agentes', text: 'CRM con embudo de clientes, contratos conformes a la Gaceta 7.065, conciliación bivaluta y sindicación de tus inmuebles.' },
  { id: 'constructora', title: 'Constructoras', text: 'Vitrina de obra nueva y leads precalificados por ingreso y disponibilidad de divisas: pagas por contacto útil.' },
  { id: 'internacional', title: 'Brokers internacionales', text: 'Red de co-corretaje con agencias certificadas CIV: refiere compradores y cobra tu parte con contrato estándar.' },
  { id: 'comprador', title: 'Diáspora e inversores', text: 'Títulos verificados, due diligence a precio fijo y pago protegido en escrow hasta el registro en SAREN.' },
];

/* ------------------------------ Moneda ------------------------------ */

export function fmtUsd(n, opts = {}) {
  if (n == null || isNaN(n)) return '—';
  return '$' + Math.round(n).toLocaleString('es-VE', opts);
}

export function fmtVes(n) {
  if (n == null || isNaN(n)) return '—';
  return 'Bs. ' + n.toLocaleString('es-VE', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export const usdToVes = (usd, rate) => Math.round(usd * rate * 100) / 100;
export const vesToUsd = (ves, rate) => (rate ? Math.round((ves / rate) * 100) / 100 : 0);

/* ------------------------------ Geometría ------------------------------ */

export function inBbox(lat, lng, [w, s, e, n]) {
  return lat >= s && lat <= n && lng >= w && lng <= e;
}

// Ray casting: poly = [[lat, lng], ...]
export function inPolygon(lat, lng, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ------------------------------ AVM ------------------------------ */

const median = arr => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const TYPE_FACTOR = { apartamento: 1, casa: 0.92, townhouse: 0.97, oficina: 1.05, local: 1.15, terreno: 0.35, galpon: 0.45 };
const STATE_FACTOR = { nuevo: 1.08, bueno: 1, reformar: 0.82 };
const FEATURE_PREMIUM = { planta: 0.03, tanque: 0.02, pozo: 0.03, vigilancia: 0.02, piscina: 0.03, ascensor: 0.02, vista: 0.03, paneles: 0.02, gimnasio: 0.01, terraza: 0.02, amoblado: 0.04 };
// Alquiler mensual ≈ 0,55 % del valor de venta (rentabilidad bruta ~6,6 % anual).
export const RENT_YIELD_MONTHLY = 0.0055;

export function zoneBasePpm2(zoneId, op) {
  const z = zoneById(zoneId);
  if (!z) return null;
  return op === 'alquiler' ? z.base * RENT_YIELD_MONTHLY : z.base;
}

// Valoración automática: mediana USD/m² de comparables (misma zona, operación y tipo similar),
// ajustada por estado y equipamiento. Si no hay comparables usa el precio base de la zona.
export function estimateValue({ zone, op = 'venta', type = 'apartamento', area, state = 'bueno', features = [], parking = 0 }, listings = []) {
  const a = Number(area) || 0;
  if (!a || !zoneById(zone)) return null;
  const comps = listings
    .filter(l => l.zone === zone && l.op === op && l.area > 0 && l.status === 'active' && (TYPE_FACTOR[l.type] ?? 1) === (TYPE_FACTOR[type] ?? 1))
    .map(l => ({ l, ppm2: l.priceUsd / l.area, diff: Math.abs(l.area - a) }))
    .sort((x, y) => x.diff - y.diff)
    .slice(0, 8);
  let ppm2 = comps.length >= 3 ? median(comps.map(c => c.ppm2)) : zoneBasePpm2(zone, op) * (TYPE_FACTOR[type] ?? 1);
  let factor = STATE_FACTOR[state] ?? 1;
  for (const f of features) factor += FEATURE_PREMIUM[f] ?? 0;
  factor += Math.min(Number(parking) || 0, 3) * 0.015;
  const estimate = ppm2 * a * factor;
  const spread = comps.length >= 5 ? 0.08 : 0.14;
  return {
    estimate: Math.round(estimate),
    low: Math.round(estimate * (1 - spread)),
    high: Math.round(estimate * (1 + spread)),
    ppm2: Math.round(ppm2 * factor * 100) / 100,
    confidence: comps.length >= 5 ? 'alta' : comps.length >= 3 ? 'media' : 'baja',
    comps: comps.map(c => ({ id: c.l.id, title: c.l.title, priceUsd: c.l.priceUsd, area: c.l.area, ppm2: Math.round(c.ppm2 * 100) / 100 })),
  };
}

// Indicador de precio frente a la zona: 'bajo' | 'justo' | 'alto'.
export function priceIndicator(listing, zoneMedianPpm2) {
  if (!zoneMedianPpm2 || !listing.area) return null;
  const r = listing.priceUsd / listing.area / zoneMedianPpm2;
  return { ratio: Math.round(r * 100) / 100, label: r < 0.92 ? 'bajo' : r > 1.08 ? 'alto' : 'justo' };
}

/* ------------------------------ Ley 2026 ------------------------------ */
// Ley del Régimen Especial de Arrendamiento de Inmuebles Destinados a Vivienda,
// Gaceta Oficial N° 7.065 Extraordinario (7 de agosto de 2026).

export const LAW = {
  name: 'Ley del Régimen Especial de Arrendamiento de Inmuebles Destinados a Vivienda',
  gazette: 'Gaceta Oficial N° 7.065 Extraordinario del 7 de agosto de 2026',
  maxDepositMonths: 3,
  tenantMaintenanceThreshold: 0.3,
  evictionArrearsMonths: 3,
  preferenceYears: 2,
  preferenceReplyDays: 15,
};

export function rentalTerms(rentUsd, rate) {
  return {
    maxDepositUsd: rentUsd * LAW.maxDepositMonths,
    maxDepositVes: usdToVes(rentUsd * LAW.maxDepositMonths, rate),
    tenantMaintenanceCapUsd: Math.round(rentUsd * LAW.tenantMaintenanceThreshold * 100) / 100,
    rentVes: usdToVes(rentUsd, rate),
  };
}

// Quién paga una reparación según el umbral del 30 % del canon (Art. 19-20).
export function maintenanceSplit(costUsd, rentUsd) {
  const cap = rentUsd * LAW.tenantMaintenanceThreshold;
  return costUsd <= cap ? { tenant: costUsd, landlord: 0 } : { tenant: 0, landlord: costUsd };
}

export function buildLeaseContract(d, rate) {
  const rent = Number(d.rentUsd) || 0;
  const deposit = Math.min(Number(d.depositMonths) || 0, LAW.maxDepositMonths);
  const months = Number(d.termMonths) || 12;
  const t = rentalTerms(rent, rate);
  const today = new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
  const warn = [];
  if ((Number(d.depositMonths) || 0) > LAW.maxDepositMonths) warn.push(`El depósito se redujo a ${LAW.maxDepositMonths} meses de canon, límite máximo del Art. 16.`);
  const sections = [
    ['Partes', `Entre ${d.landlordName || '[ARRENDADOR]'}, titular de la cédula/RIF ${d.landlordId || '[C.I./RIF]'}, en adelante EL ARRENDADOR, y ${d.tenantName || '[ARRENDATARIO]'}, titular de la cédula ${d.tenantId || '[C.I.]'}, en adelante EL ARRENDATARIO, se celebra el presente contrato de arrendamiento de vivienda conforme a la ${LAW.name} (${LAW.gazette}).`],
    ['Inmueble', `EL ARRENDADOR da en arrendamiento el inmueble ubicado en ${d.address || '[DIRECCIÓN]'}, destinado exclusivamente a vivienda principal del ARRENDATARIO y su grupo familiar.`],
    ['Duración', `El contrato tendrá una duración de ${months} meses contados a partir del ${d.startDate || '[FECHA DE INICIO]'}, prorrogable por acuerdo escrito de las partes.`],
    ['Canon (Art. 12 y 14)', `Las partes fijan libremente un canon mensual de ${fmtUsd(rent)} (dólares de los Estados Unidos de América). EL ARRENDATARIO podrá pagar su equivalente en bolívares a la tasa oficial del Banco Central de Venezuela vigente el día del pago (referencia a la firma: ${fmtVes(t.rentVes)} a ${rate} Bs./USD). El pago vence el día ${d.payDay || 5} de cada mes.`],
    ['Depósito en garantía (Art. 16)', `EL ARRENDATARIO entrega un depósito equivalente a ${deposit} ${deposit === 1 ? 'mes' : 'meses'} de canon (${fmtUsd(rent * deposit)}), que no excede el límite legal de ${LAW.maxDepositMonths} meses y será devuelto al término del contrato, deducidos los daños imputables debidamente comprobados.`],
    ['Mantenimiento (Art. 19-20)', `Las reparaciones cuyo costo sea igual o inferior al 30 % del canon mensual (hasta ${fmtUsd(t.tenantMaintenanceCapUsd)}) corren por cuenta del ARRENDATARIO. Las de costo superior y las reparaciones mayores corren por cuenta del ARRENDADOR.`],
    ['Domicilio digital (Art. 21)', `Las partes eligen como domicilio para notificaciones legales los correos electrónicos ${d.landlordEmail || '[CORREO ARRENDADOR]'} y ${d.tenantEmail || '[CORREO ARRENDATARIO]'}; las notificaciones enviadas a ellos surten plenos efectos legales.`],
    ['Preferencia ofertiva (Art. 22)', `Si EL ARRENDADOR decide vender, EL ARRENDATARIO solvente con más de ${LAW.preferenceYears} años de relación arrendaticia tendrá derecho de preferencia y dispondrá de ${LAW.preferenceReplyDays} días continuos para responder a la oferta.`],
    ['Resolución (Art. 23)', `La falta de pago de más de ${LAW.evictionArrearsMonths} mensualidades consecutivas facultará al ARRENDADOR para solicitar la resolución del contrato por la vía arbitral o judicial expedita prevista en la ley.`],
    ['Firma', `Hecho en ${d.city || 'Caracas'}, el ${today}, en dos ejemplares de un mismo tenor y a un solo efecto. Firma electrónica avanzada disponible en la plataforma Morada.`],
  ];
  return { title: 'Contrato de arrendamiento de vivienda', sections, warnings: warn, deposit, rent, rate };
}

/* ------------------------------ Finanzas ------------------------------ */

// Cuota de un préstamo amortizable (francés). Sirve para préstamos puente / buy-to-let
// de fondos de deuda privada (9-13 % anual en divisa, 3-5 años según el estudio).
export function loanPayment(principal, annualRate, years) {
  const r = annualRate / 12, n = years * 12;
  if (!principal || !n) return 0;
  if (!r) return principal / n;
  return (principal * r) / (1 - (1 + r) ** -n);
}

export function referralSplit(commissionUsd, splitPct, platformPct = 0.15) {
  const referrer = commissionUsd * splitPct;
  const platform = referrer * platformPct;
  return { referrer: Math.round((referrer - platform) * 100) / 100, platform: Math.round(platform * 100) / 100, listingAgent: Math.round((commissionUsd - referrer) * 100) / 100 };
}

/* ------------------------------ Utilidades ------------------------------ */

export const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function listingTitle(l) {
  const t = TYPES[l.type] || 'Inmueble';
  const z = zoneById(l.zone);
  const rooms = l.rooms && ['apartamento', 'casa', 'townhouse'].includes(l.type) ? ` de ${l.rooms} hab.` : '';
  return `${t}${rooms} en ${z ? z.name : l.city}`;
}
