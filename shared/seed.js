// Datos de demostración deterministas: cuentas de prueba y avisos ficticios.
import { ZONES, FEATURES, listingTitle, RENT_YIELD_MONTHLY } from './core.js';

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_PASSWORD = 'morada2026';

export const DEMO_USERS = [
  { id: 'u-admin', role: 'admin', name: 'Equipo Morada', email: 'admin@morada.demo', plan: 'promax' },
  { id: 'u-avila', role: 'agencia', name: 'Ávila Propiedades', company: 'Ávila Propiedades C.A.', email: 'agencia@morada.demo', phone: '+584121234567', plan: 'promax', civ: 'CIV-MET-0412', preani: true, zones: ['altamira', 'la-castellana', 'los-palos-grandes', 'country-club', 'chacao'] },
  { id: 'u-costa', role: 'agencia', name: 'Costa Norte Bienes Raíces', company: 'Costa Norte Bienes Raíces', email: 'costa@morada.demo', phone: '+584141112233', plan: 'professional', civ: 'CI-ANZ-0088', zones: ['lecheria', 'pampatar'] },
  { id: 'u-lago', role: 'agencia', name: 'Lago & Llano Inmobiliaria', company: 'Lago & Llano Inmobiliaria', email: 'lago@morada.demo', phone: '+584161234000', plan: 'starter', civ: 'CI-ZUL-0231', zones: ['tierra-negra', '5-de-julio', 'el-vinedo', 'prebo', 'la-trigalena', 'barquisimeto-este'] },
  { id: 'u-tepuy', role: 'constructora', name: 'Tepuy Desarrollos', company: 'Tepuy Desarrollos C.A.', email: 'constructora@morada.demo', phone: '+584241230099', plan: 'professional' },
  { id: 'u-maria', role: 'particular', name: 'María Fernanda Rojas', email: 'propietario@morada.demo', phone: '+584125550101', plan: null, extraSlots: 1 },
  { id: 'u-bridge', role: 'internacional', name: 'Bayfront Referral Group', company: 'Bayfront Referral Group LLC', email: 'internacional@morada.demo', phone: '+13055550188', plan: 'promax', country: 'Estados Unidos', license: 'FL-BK-3390XX' },
  { id: 'u-luis', role: 'comprador', name: 'Luis Andrés Pérez', email: 'comprador@morada.demo', phone: '+34611222333', country: 'España' },
];

const DESCRIPTIONS = [
  'Inmueble luminoso con excelente ventilación cruzada, cocina empotrada y áreas sociales amplias. Edificio con conserjería y bajo costo de condominio.',
  'Ubicación privilegiada a pocos pasos de comercios, transporte y zonas verdes. Ideal para familias o como inversión de renta.',
  'Remodelado recientemente con acabados de primera: porcelanato, closets de madera y baños modernos. Listo para mudarse.',
  'Conjunto residencial cerrado con vigilancia, áreas recreativas y estacionamiento techado. Comunidad tranquila y organizada.',
  'Vista abierta y despejada, mucha iluminación natural. Agua garantizada con tanque propio y respaldo eléctrico en áreas comunes.',
  'Oportunidad de inversión: precio por debajo del promedio de la zona y documentos en regla para una venta ágil.',
];

const STREETS = ['Av. Principal', 'Calle 3', 'Av. Francisco de Miranda', 'Transversal 2', 'Calle La Joya', 'Av. Luis Roche', 'Calle El Parque', 'Av. Bolívar', 'Calle Los Mangos', 'Av. Las Delicias'];

export function seedListings() {
  const r = rng(2026);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const owners = { Caracas: ['u-avila', 'u-avila', 'u-tepuy'], Lechería: ['u-costa'], Margarita: ['u-costa'], Valencia: ['u-lago', 'u-tepuy'], Maracaibo: ['u-lago'], Mérida: ['u-lago'], Barquisimeto: ['u-lago'] };
  const featureKeys = Object.keys(FEATURES);
  const out = [];
  let n = 1;
  const now = Date.parse('2026-10-25T12:00:00Z');
  for (const z of ZONES) {
    const count = z.city === 'Caracas' ? 6 : 4;
    for (let i = 0; i < count; i++) {
      const op = r() < 0.62 ? 'venta' : 'alquiler';
      const type = r() < 0.6 ? 'apartamento' : pick(['casa', 'townhouse', 'oficina', 'local', 'apartamento', 'casa', 'terreno', 'galpon']);
      const isHome = ['apartamento', 'casa', 'townhouse'].includes(type);
      const area = Math.round(type === 'terreno' ? 300 + r() * 900 : type === 'galpon' ? 400 + r() * 1200 : type === 'casa' ? 180 + r() * 320 : type === 'local' ? 40 + r() * 160 : 55 + r() * 170);
      const rooms = isHome ? Math.max(1, Math.min(5, Math.round(area / 45))) : 0;
      const baths = isHome ? Math.max(1, Math.min(4, Math.round(rooms * 0.8))) : type === 'terreno' ? 0 : 1;
      const typeF = { apartamento: 1, casa: 0.92, townhouse: 0.97, oficina: 1.05, local: 1.15, terreno: 0.35, galpon: 0.45 }[type];
      const noise = 0.78 + r() * 0.44;
      const sale = z.base * typeF * noise * area;
      const priceUsd = op === 'venta' ? Math.round(sale / 1000) * 1000 : Math.round((sale * RENT_YIELD_MONTHLY) / 10) * 10;
      const feats = featureKeys.filter(() => r() < 0.3);
      if (type === 'apartamento' && r() < 0.8 && !feats.includes('ascensor')) feats.push('ascensor');
      const owner = pick(owners[z.city] || ['u-avila']);
      const verification = r() < 0.45 ? 'verified' : r() < 0.15 ? 'pending' : 'none';
      const createdAt = new Date(now - Math.floor(r() * 60) * 86400000).toISOString();
      const l = {
        id: 'm' + String(1000 + n++),
        ownerId: owner,
        op, type,
        zone: z.id, city: z.city,
        address: `${pick(STREETS)}, ${z.name}`,
        lat: Math.round((z.lat + (r() - 0.5) * 0.018) * 1e5) / 1e5,
        lng: Math.round((z.lng + (r() - 0.5) * 0.018) * 1e5) / 1e5,
        priceUsd, area, rooms, baths,
        parking: isHome ? Math.floor(r() * 3) : type === 'oficina' ? 1 : 0,
        floor: type === 'apartamento' || type === 'oficina' ? 1 + Math.floor(r() * 14) : 0,
        state: r() < 0.2 ? 'nuevo' : r() < 0.8 ? 'bueno' : 'reformar',
        year: 1975 + Math.floor(r() * 50),
        condoFee: type === 'apartamento' ? Math.round(30 + r() * 120) : 0,
        features: feats,
        payments: ['usd', ...(r() < 0.7 ? ['ves'] : []), ...(r() < 0.35 ? ['usdt'] : []), ...(r() < 0.5 ? ['zelle'] : [])],
        description: pick(DESCRIPTIONS) + ' ' + pick(DESCRIPTIONS),
        photos: [],
        docs: verification !== 'none' ? [{ kind: 'titulo', name: 'documento-propiedad.pdf', url: null, uploadedAt: createdAt }, { kind: 'gravamen', name: 'certificado-gravamen.pdf', url: null, uploadedAt: createdAt }] : [],
        verification,
        verificationNote: verification === 'verified' ? 'Título y gravamen revisados por el equipo legal.' : '',
        boost: r() < 0.15 ? { kind: r() < 0.5 ? 'top' : 'destacado', until: '2026-12-31T00:00:00Z' } : null,
        coBroke: owner === 'u-avila' && op === 'venta' && r() < 0.7,
        coBrokeCommission: 0.05,
        status: 'active',
        views: Math.floor(r() * 900),
        contacts: Math.floor(r() * 25),
        createdAt, updatedAt: createdAt,
        demo: true,
      };
      if (owner === 'u-tepuy') { l.state = 'nuevo'; l.project = { name: `Residencias ${z.name}`, units: 12 + Math.floor(r() * 60), delivery: pick(['2027-T2', '2027-T4', '2028-T1']) }; l.op = 'venta'; l.priceUsd = Math.round((z.base * typeF * 1.1 * area) / 1000) * 1000; }
      l.title = listingTitle(l);
      out.push(l);
    }
  }
  // La propietaria particular publica dos avisos (1 gratis + 1 adicional comprado).
  for (const zone of ['el-hatillo', 'merida-centro']) {
    const l = out.find(x => x.zone === zone && x.ownerId !== 'u-tepuy' && ['apartamento', 'casa', 'townhouse'].includes(x.type));
    if (l) { l.ownerId = 'u-maria'; l.coBroke = false; l.boost = null; }
  }
  return out;
}

export function seedLeads() {
  return [
    { id: 'lead-4', listingId: 'm1001', ownerId: 'u-avila', name: 'José Gregorio Lira', email: 'jg.lira@example.com', phone: '+584265550144', message: 'Quiero comprar con pago en USDT. ¿Aceptan?', kind: 'info', stage: 'nuevo', prequal: { income: '4000+', usdFunds: true, timeline: '1m' }, createdAt: '2026-10-28T09:15:00Z', notes: '' },
    { id: 'lead-5', listingId: 'm1002', ownerId: 'u-avila', name: 'Daniela Rivas', email: 'dani.rivas@example.com', phone: '+393331234567', message: 'Vivo en Milán. ¿Podemos hacer la visita por videollamada?', kind: 'visita', visitDate: '2026-11-03T16:00', stage: 'oferta', prequal: { income: '2000-4000', usdFunds: true, timeline: '3m' }, createdAt: '2026-10-20T11:00:00Z', notes: 'Ofertó $5.000 menos.' },
    { id: 'lead-1', listingId: 'm1001', ownerId: 'u-avila', name: 'Carolina Méndez', email: 'carolina@example.com', phone: '+584141000001', message: '¿Sigue disponible? Me interesa agendar visita este sábado.', kind: 'visita', stage: 'nuevo', prequal: { income: '2000-4000', usdFunds: true, timeline: '3m' }, createdAt: '2026-10-27T15:00:00Z', notes: '' },
    { id: 'lead-2', listingId: 'm1002', ownerId: 'u-avila', name: 'Andrés Salazar', email: 'andres@example.com', phone: '+584121000002', message: 'Vivo en Madrid, compro para mis padres. ¿Tiene título verificado?', kind: 'info', stage: 'contactado', prequal: { income: '4000+', usdFunds: true, timeline: '1m' }, createdAt: '2026-10-26T10:00:00Z', notes: 'Pidió fascículo digital.' },
    { id: 'lead-3', listingId: 'm1003', ownerId: 'u-avila', name: 'Gabriela Ortiz', email: 'gaby@example.com', phone: '+584241000003', message: 'Busco alquiler con depósito de 2 meses.', kind: 'info', stage: 'visita', prequal: null, createdAt: '2026-10-24T18:30:00Z', notes: '' },
  ];
}
