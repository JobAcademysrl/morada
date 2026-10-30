// API de Morada. La misma lógica atiende al servidor Node (persistencia en disco)
// y al modo demo del navegador (persistencia en localStorage).
import {
  PLANS, BOOSTS, DILIGENCE, ROLES, LEAD_STAGES, ZONES, CITIES, TYPES, FEATURES, STATES, PAYMENTS, DOC_KINDS,
  SERVICE_CATEGORIES, PRIVATE_FREE_LISTINGS, PRIVATE_EXTRA_PRICE, OPERATIONS, LAW,
  estimateValue, priceIndicator, inBbox, inPolygon, buildLeaseContract, usdToVes, vesToUsd, listingTitle, zoneById, referralSplit,
} from './core.js';
import { DEMO_USERS, DEMO_PASSWORD, seedListings, seedLeads } from './seed.js';
import { plausible, RATE_SOURCES } from './rates.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, msg) => { throw new HttpError(status, msg); };

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const randomId = (prefix = '', bytes = 9) => prefix + hex(globalThis.crypto.getRandomValues(new Uint8Array(bytes)).buffer);

async function hashPassword(password, salt = randomId('', 16)) {
  const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 60000 }, key, 256);
  return `${salt}:${hex(bits)}`;
}
async function checkPassword(password, stored) {
  const [salt] = String(stored).split(':');
  return (await hashPassword(password, salt)) === stored;
}

const now = () => new Date().toISOString();
const clean = s => (s == null ? '' : String(s).trim().slice(0, 4000));
const num = (v, d = null) => (v === '' || v == null || isNaN(Number(v)) ? d : Number(v));
const publicUser = u => u && ({ id: u.id, role: u.role, name: u.name, company: u.company || '', phone: u.phone || '', email: u.email, plan: u.plan || null, civ: u.civ || '', preani: !!u.preani, country: u.country || 'Venezuela', license: u.license || '', zones: u.zones || [], extraSlots: u.extraSlots || 0, createdAt: u.createdAt });
const ownerCard = u => u && ({ id: u.id, name: u.company || u.name, role: u.role, phone: u.phone || '', civ: u.civ || '', preani: !!u.preani, badge: !!PLANS[u.plan]?.badge });

export function emptyDb() {
  return { version: 1, users: [], sessions: {}, listings: [], leads: [], favorites: {}, searches: [], contracts: [], payments: [], referrals: [], diligence: [], services: [], orders: [], settings: { rate: 236.5, rateUpdatedAt: '2026-10-28T12:00:00Z', rateAuto: true, rateSource: 'manual', rateError: null } };
}

export async function seedDb(db) {
  const createdAt = '2026-09-01T12:00:00Z';
  const hash = await hashPassword(DEMO_PASSWORD);
  db.users = DEMO_USERS.map(u => ({ ...u, password: hash, createdAt }));
  db.listings = seedListings();
  // Los contactos de ejemplo se asignan a los primeros avisos de la agencia de demostración.
  const avila = db.listings.filter(l => l.ownerId === 'u-avila');
  const map = {};
  db.leads = seedLeads().map(l => {
    map[l.listingId] ||= avila[Object.keys(map).length % avila.length].id;
    return { ...l, listingId: map[l.listingId], ownerId: 'u-avila' };
  });
  db.payments = [
    { id: 'pay-1', ownerId: 'u-avila', tenant: 'Gabriela Ortiz', property: 'Apto. Los Palos Grandes', dueDate: '2026-10-05', amountUsd: 650, paidCurrency: 'ves', paidAmount: 650 * 236.5, rate: 236.5, paidAt: '2026-10-04', createdAt },
    { id: 'pay-2', ownerId: 'u-avila', tenant: 'Ricardo Lugo', property: 'Apto. Altamira', dueDate: '2026-10-05', amountUsd: 900, paidCurrency: 'usd', paidAmount: 500, rate: 236.5, paidAt: '2026-10-07', createdAt },
    { id: 'pay-3', ownerId: 'u-avila', tenant: 'Ricardo Lugo', property: 'Apto. Altamira', dueDate: '2026-11-05', amountUsd: 900, paidCurrency: null, paidAmount: 0, rate: null, paidAt: null, createdAt },
  ];
  return db;
}

/* ------------------------------ Router ------------------------------ */

const routes = [];
const route = (method, pattern, handler, opts = {}) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ method, re, keys, handler, ...opts });
};

export function createEngine({ db, save = () => {}, storeFile = async dataUrl => dataUrl, fetchRate = null }) {
  db.settings = { rateAuto: true, rateSource: 'manual', rateError: null, ...db.settings };
  const ctx = { db, save, storeFile, fetchRate };
  // Actualiza la tasa desde la fuente oficial; la usa el servidor de forma periódica y el botón del administrador.
  async function refreshRate() {
    if (!fetchRate) throw new HttpError(501, 'La lectura automática de la tasa solo está disponible con el servidor.');
    try {
      const r = await fetchRate();
      if (!plausible(r.rate, db.settings.rate)) throw new Error(`valor fuera de rango (${r.rate})`);
      Object.assign(db.settings, { rate: r.rate, rateUpdatedAt: now(), rateSource: r.source, rateError: null });
    } catch (e) { db.settings.rateError = e.message; db.settings.rateErrorAt = now(); }
    await save();
    return db.settings;
  }
  ctx.refreshRate = refreshRate;

  async function handle(method, path, { query = {}, body = {}, token = null } = {}) {
    try {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = path.match(r.re);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        const user = token ? db.users.find(u => u.id === db.sessions[token]?.userId) || null : null;
        if (r.auth && !user) fail(401, 'Inicia sesión para continuar.');
        if (r.roles && !r.roles.includes(user.role)) fail(403, 'Tu tipo de cuenta no tiene acceso a esta función.');
        const res = await r.handler({ ...ctx, params, query, body: body || {}, user, token });
        if (r.write !== false && method !== 'GET') await save();
        return { status: res?.__status || 200, body: res?.__status ? res.body : res };
      }
      fail(404, 'Recurso no encontrado.');
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
      console.error(e);
      return { status: 500, body: { error: 'Error interno.' } };
    }
  }
  return { handle, db, refreshRate };
}

/* ------------------------------ Helpers de dominio ------------------------------ */

function planOf(u) { return PLANS[u?.plan] || PLANS.prueba; }
function needFeature(u, feature) {
  if (u.role === 'admin') return;
  if (!planOf(u)[feature]) fail(402, `Esta función requiere un plan superior (${feature === 'network' || feature === 'contracts' ? 'Agency Pro Max' : 'Professional o Pro Max'}).`);
}
function listingQuota(u, db) {
  const active = db.listings.filter(l => l.ownerId === u.id && l.status !== 'sold' && l.status !== 'deleted').length;
  const limit = u.role === 'particular' || u.role === 'comprador' ? PRIVATE_FREE_LISTINGS + (u.extraSlots || 0) : u.role === 'admin' ? Infinity : planOf(u).listings;
  return { active, limit: limit === Infinity ? null : limit, remaining: limit === Infinity ? null : Math.max(0, limit - active) };
}
function zoneMedians(db) {
  const acc = {};
  for (const l of db.listings) {
    if (l.status !== 'active' || !l.area) continue;
    const k = `${l.zone}|${l.op}`;
    (acc[k] ||= []).push(l.priceUsd / l.area);
  }
  const out = {};
  for (const [k, arr] of Object.entries(acc)) {
    const s = arr.sort((a, b) => a - b), m = s.length >> 1;
    out[k] = { median: s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2, count: s.length };
  }
  return out;
}
const isBoosted = l => l.boost && Date.parse(l.boost.until) > Date.now();

function decorate(l, db, medians, user) {
  const owner = db.users.find(u => u.id === l.ownerId);
  const med = medians?.[`${l.zone}|${l.op}`]?.median;
  return {
    ...l,
    docs: undefined,
    docCount: (l.docs || []).length,
    owner: ownerCard(owner),
    boosted: isBoosted(l) ? l.boost.kind : null,
    priceVes: usdToVes(l.priceUsd, db.settings.rate),
    ppm2: l.area ? Math.round((l.priceUsd / l.area) * 100) / 100 : null,
    indicator: med ? priceIndicator(l, med) : null,
    favorite: user ? (db.favorites[user.id] || []).includes(l.id) : false,
    mine: user ? user.id === l.ownerId : false,
  };
}

function sanitizeListing(b, prev = {}) {
  const zone = zoneById(b.zone ?? prev.zone);
  if (!zone) fail(400, 'Selecciona una zona válida.');
  const op = OPERATIONS[b.op ?? prev.op] ? (b.op ?? prev.op) : fail(400, 'Operación no válida.');
  const type = TYPES[b.type ?? prev.type] ? (b.type ?? prev.type) : fail(400, 'Tipo de inmueble no válido.');
  const priceUsd = num(b.priceUsd ?? prev.priceUsd);
  if (!priceUsd || priceUsd <= 0) fail(400, 'Indica un precio en USD.');
  const area = num(b.area ?? prev.area);
  if (!area || area <= 0) fail(400, 'Indica la superficie en m².');
  const lat = num(b.lat ?? prev.lat, zone.lat), lng = num(b.lng ?? prev.lng, zone.lng);
  const l = {
    op, type, zone: zone.id, city: zone.city,
    address: clean(b.address ?? prev.address) || zone.name,
    lat, lng, priceUsd, area,
    rooms: num(b.rooms ?? prev.rooms, 0), baths: num(b.baths ?? prev.baths, 0), parking: num(b.parking ?? prev.parking, 0),
    floor: num(b.floor ?? prev.floor, 0), year: num(b.year ?? prev.year, null), condoFee: num(b.condoFee ?? prev.condoFee, 0),
    state: STATES[b.state ?? prev.state] ? (b.state ?? prev.state) : 'bueno',
    features: (b.features ?? prev.features ?? []).filter(f => FEATURES[f]),
    payments: (b.payments ?? prev.payments ?? ['usd']).filter(p => PAYMENTS[p]),
    description: clean(b.description ?? prev.description),
    coBroke: !!(b.coBroke ?? prev.coBroke),
    coBrokeCommission: Math.min(0.1, Math.max(0.01, num(b.coBrokeCommission ?? prev.coBrokeCommission, 0.05))),
    project: (b.project ?? prev.project) ? { name: clean((b.project ?? prev.project).name), units: num((b.project ?? prev.project).units, 0), delivery: clean((b.project ?? prev.project).delivery) } : null,
  };
  l.title = clean(b.title ?? prev.title) || listingTitle(l);
  if (!l.payments.length) l.payments = ['usd'];
  return l;
}

async function storePhotos(photos, storeFile) {
  const out = [];
  for (const p of (photos || []).slice(0, 12)) {
    if (typeof p !== 'string') continue;
    if (p.startsWith('data:image/')) out.push(await storeFile(p, 'img'));
    else if (p.startsWith('/uploads/') || p.startsWith('data:')) out.push(p);
  }
  return out;
}

function filterListings(db, q) {
  const feats = q.features ? String(q.features).split(',').filter(Boolean) : [];
  const pays = q.payments ? String(q.payments).split(',').filter(Boolean) : [];
  const bbox = q.bbox ? String(q.bbox).split(',').map(Number) : null;
  const poly = q.poly ? String(q.poly).split(';').map(p => p.split(',').map(Number)).filter(p => p.length === 2 && p.every(x => !isNaN(x))) : null;
  const text = q.q ? String(q.q).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : '';
  const pmin = num(q.pmin), pmax = num(q.pmax), amin = num(q.amin), amax = num(q.amax), rooms = num(q.rooms), baths = num(q.baths), fmin = num(q.fmin);
  return db.listings.filter(l => {
    if (q.owner) { if (l.ownerId !== q.owner || l.status === 'deleted') return false; }
    else if (l.status !== 'active') return false;
    if (q.op && l.op !== q.op) return false;
    if (q.type && !String(q.type).split(',').includes(l.type)) return false;
    if (q.city && l.city !== q.city) return false;
    if (q.zone && !String(q.zone).split(',').includes(l.zone)) return false;
    if (pmin != null && l.priceUsd < pmin) return false;
    if (pmax != null && l.priceUsd > pmax) return false;
    if (amin != null && l.area < amin) return false;
    if (amax != null && l.area > amax) return false;
    if (rooms != null && l.rooms < rooms) return false;
    if (baths != null && l.baths < baths) return false;
    if (fmin != null && l.floor < fmin) return false;
    if (q.state && l.state !== q.state) return false;
    if (q.verified === '1' && l.verification !== 'verified') return false;
    if (q.project === '1' && !l.project) return false;
    if (q.cobroke === '1' && !l.coBroke) return false;
    if (q.parking === '1' && !l.parking) return false;
    if (feats.length && !feats.every(f => l.features.includes(f))) return false;
    if (pays.length && !pays.some(p => l.payments.includes(p))) return false;
    if (bbox && bbox.length === 4 && !inBbox(l.lat, l.lng, bbox)) return false;
    if (poly && poly.length >= 3 && !inPolygon(l.lat, l.lng, poly)) return false;
    if (text) {
      const z = zoneById(l.zone);
      const hay = `${l.title} ${l.description} ${l.address} ${z?.name} ${l.city} ${l.project?.name || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (!text.split(/\s+/).every(w => hay.includes(w))) return false;
    }
    return true;
  });
}

const SORTS = {
  relevancia: (a, b) => (isBoosted(b) ? (b.boost.kind === 'top' ? 2 : 1) : 0) - (isBoosted(a) ? (a.boost.kind === 'top' ? 2 : 1) : 0) || (b.verification === 'verified') - (a.verification === 'verified') || b.createdAt.localeCompare(a.createdAt),
  recientes: (a, b) => b.createdAt.localeCompare(a.createdAt),
  'precio-asc': (a, b) => a.priceUsd - b.priceUsd,
  'precio-desc': (a, b) => b.priceUsd - a.priceUsd,
  'm2-desc': (a, b) => b.area - a.area,
  'ppm2-asc': (a, b) => a.priceUsd / a.area - b.priceUsd / b.area,
};

/* ------------------------------ Rutas ------------------------------ */

route('GET', '/api/health', () => ({ ok: true }));

route('GET', '/api/meta', ({ db }) => ({
  zones: ZONES, cities: CITIES, types: TYPES, features: FEATURES, states: STATES, payments: PAYMENTS, docKinds: DOC_KINDS,
  plans: Object.values(PLANS).map(p => ({ ...p, listings: p.listings === Infinity ? null : p.listings })),
  boosts: BOOSTS, diligence: DILIGENCE, roles: ROLES, leadStages: LEAD_STAGES, services: SERVICE_CATEGORIES, operations: OPERATIONS, law: LAW,
  privateFree: PRIVATE_FREE_LISTINGS, privateExtraPrice: PRIVATE_EXTRA_PRICE,
  rate: db.settings.rate, rateUpdatedAt: db.settings.rateUpdatedAt, rateSource: db.settings.rateSource, rateSourceLabel: RATE_SOURCES[db.settings.rateSource]?.label || 'Carga manual', rateAuto: db.settings.rateAuto, rateError: db.settings.rateError, rateErrorAt: db.settings.rateErrorAt,
  stats: { listings: db.listings.filter(l => l.status === 'active').length, verified: db.listings.filter(l => l.status === 'active' && l.verification === 'verified').length, pros: db.users.filter(u => ['agencia', 'constructora', 'internacional'].includes(u.role)).length, cities: CITIES.length },
}), { write: false });

/* Autenticación */

route('POST', '/api/auth/register', async ({ db, body }) => {
  const email = clean(body.email).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Correo electrónico no válido.');
  if (String(body.password || '').length < 8) fail(400, 'La contraseña debe tener al menos 8 caracteres.');
  if (!ROLES[body.role] || body.role === 'admin') fail(400, 'Selecciona un tipo de cuenta.');
  if (!clean(body.name)) fail(400, 'Indica tu nombre.');
  if (db.users.some(u => u.email === email)) fail(409, 'Ya existe una cuenta con ese correo.');
  const u = {
    id: randomId('u-', 6), role: body.role, name: clean(body.name), company: clean(body.company), email, phone: clean(body.phone),
    country: clean(body.country) || 'Venezuela', civ: clean(body.civ), preani: !!body.preani, license: clean(body.license),
    plan: ['agencia', 'constructora', 'internacional'].includes(body.role) ? 'prueba' : null, extraSlots: 0, zones: [],
    password: await hashPassword(String(body.password)), createdAt: now(),
  };
  db.users.push(u);
  const token = randomId('t', 18);
  db.sessions[token] = { userId: u.id, createdAt: now() };
  return { token, user: publicUser(u) };
});

route('POST', '/api/auth/login', async ({ db, body }) => {
  const u = db.users.find(x => x.email === clean(body.email).toLowerCase());
  if (!u || !(await checkPassword(String(body.password || ''), u.password))) fail(401, 'Correo o contraseña incorrectos.');
  const token = randomId('t', 18);
  db.sessions[token] = { userId: u.id, createdAt: now() };
  return { token, user: publicUser(u) };
});

route('POST', '/api/auth/logout', ({ db, token }) => { if (token) delete db.sessions[token]; return { ok: true }; });

route('GET', '/api/me', ({ db, user }) => ({ user: publicUser(user), quota: listingQuota(user, db), plan: { ...planOf(user), listings: planOf(user).listings === Infinity ? null : planOf(user).listings } }), { auth: true, write: false });

route('PATCH', '/api/me', ({ user, body }) => {
  for (const k of ['name', 'company', 'phone', 'civ', 'license', 'country']) if (body[k] != null) user[k] = clean(body[k]);
  if (body.preani != null) user.preani = !!body.preani;
  if (Array.isArray(body.zones)) user.zones = body.zones.filter(z => zoneById(z));
  return { user: publicUser(user) };
}, { auth: true });

// Checkout simulado: en producción se conecta a la pasarela de pago.
route('POST', '/api/me/plan', ({ db, user, body }) => {
  if (!['agencia', 'constructora', 'internacional'].includes(user.role)) fail(403, 'Los planes son para cuentas profesionales.');
  const p = PLANS[body.plan];
  if (!p || p.id === 'prueba') fail(400, 'Plan no válido.');
  user.plan = p.id;
  db.orders.push({ id: randomId('o-', 6), userId: user.id, kind: 'plan', item: p.id, amountUsd: p.price, createdAt: now() });
  return { user: publicUser(user) };
}, { auth: true });

route('POST', '/api/me/slots', ({ db, user, body }) => {
  const qty = Math.max(1, Math.min(10, num(body.qty, 1)));
  user.extraSlots = (user.extraSlots || 0) + qty;
  db.orders.push({ id: randomId('o-', 6), userId: user.id, kind: 'slot', item: qty, amountUsd: qty * PRIVATE_EXTRA_PRICE, createdAt: now() });
  return { user: publicUser(user), quota: listingQuota(user, db) };
}, { auth: true, roles: ['particular', 'comprador'] });

route('GET', '/api/me/orders', ({ db, user }) => db.orders.filter(o => o.userId === user.id).reverse(), { auth: true, write: false });

/* Avisos */

route('GET', '/api/listings', ({ db, query, user }) => {
  if (query.owner === 'me') { if (!user) fail(401, 'Inicia sesión.'); query = { ...query, owner: user.id }; }
  const all = filterListings(db, query);
  const medians = zoneMedians(db);
  const sort = SORTS[query.sort] || SORTS.relevancia;
  all.sort(sort);
  const limit = Math.min(60, num(query.limit, 18)), page = Math.max(1, num(query.page, 1));
  const facets = { type: {}, zone: {}, op: {} };
  for (const l of all) { facets.type[l.type] = (facets.type[l.type] || 0) + 1; facets.zone[l.zone] = (facets.zone[l.zone] || 0) + 1; facets.op[l.op] = (facets.op[l.op] || 0) + 1; }
  const prices = all.map(l => l.priceUsd);
  return {
    total: all.length, page, pages: Math.max(1, Math.ceil(all.length / limit)),
    items: all.slice((page - 1) * limit, page * limit).map(l => decorate(l, db, medians, user)),
    markers: all.map(l => ({ id: l.id, lat: l.lat, lng: l.lng, priceUsd: l.priceUsd, op: l.op, boosted: isBoosted(l), verified: l.verification === 'verified' })),
    facets, priceRange: prices.length ? [Math.min(...prices), Math.max(...prices)] : null,
  };
}, { write: false });

route('GET', '/api/listings/:id', ({ db, params, user }) => {
  const l = db.listings.find(x => x.id === params.id && x.status !== 'deleted');
  if (!l) fail(404, 'Este aviso no existe o fue retirado.');
  const mine = user && (user.id === l.ownerId || user.role === 'admin');
  if (l.status !== 'active' && !mine) fail(404, 'Este aviso no está disponible.');
  if (!mine) l.views = (l.views || 0) + 1;
  const medians = zoneMedians(db);
  const avm = estimateValue({ ...l }, db.listings.filter(x => x.id !== l.id));
  const similar = filterListings(db, { op: l.op, zone: l.zone }).filter(x => x.id !== l.id).slice(0, 4);
  const canSeeDocs = mine || (user && planOf(user).network) || (user && db.diligence.some(d => d.listingId === l.id && d.userId === user.id));
  return {
    listing: { ...decorate(l, db, medians, user), docs: canSeeDocs ? l.docs : (l.docs || []).map(d => ({ kind: d.kind })) },
    zoneStats: medians[`${l.zone}|${l.op}`] || null,
    avm, similar: similar.map(x => decorate(x, db, medians, user)),
    canSeeDocs: !!canSeeDocs,
  };
});

route('POST', '/api/listings', async ({ db, user, body, storeFile }) => {
  const quota = listingQuota(user, db);
  if (quota.remaining === 0) fail(402, user.role === 'particular' ? 'Usaste tu aviso gratuito. Compra un aviso adicional para publicar otro.' : `Tu plan ${planOf(user).name} permite ${quota.limit} avisos activos. Mejora tu plan para publicar más.`);
  const base = sanitizeListing(body);
  if (base.coBroke && user.role !== 'admin' && !planOf(user).network) base.coBroke = false;
  const l = {
    id: 'm' + (Math.max(1000, ...db.listings.map(x => Number(String(x.id).slice(1)) || 0)) + 1),
    ownerId: user.id, ...base,
    photos: await storePhotos(body.photos, storeFile),
    docs: [], verification: 'none', verificationNote: '', boost: null,
    status: body.status === 'paused' ? 'paused' : 'active', views: 0, contacts: 0, createdAt: now(), updatedAt: now(),
  };
  db.listings.push(l);
  return { listing: decorate(l, db, zoneMedians(db), user) };
}, { auth: true });

function ownListing(db, user, id) {
  const l = db.listings.find(x => x.id === id && x.status !== 'deleted');
  if (!l) fail(404, 'Aviso no encontrado.');
  if (l.ownerId !== user.id && user.role !== 'admin') fail(403, 'Solo el anunciante puede modificar este aviso.');
  return l;
}

route('PATCH', '/api/listings/:id', async ({ db, user, params, body, storeFile }) => {
  const l = ownListing(db, user, params.id);
  if (body.status && ['active', 'paused', 'sold'].includes(body.status) && Object.keys(body).length === 1) {
    if (body.status === 'active' && l.status !== 'active') {
      const q = listingQuota(user, db);
      if (q.remaining === 0 && l.status === 'sold') fail(402, 'No te quedan avisos disponibles en tu plan.');
    }
    l.status = body.status;
  } else {
    Object.assign(l, sanitizeListing(body, l));
    if (l.coBroke && user.role !== 'admin' && !planOf(user).network) l.coBroke = false;
    if (body.photos) l.photos = await storePhotos(body.photos, storeFile);
    if (body.status && ['active', 'paused'].includes(body.status)) l.status = body.status;
  }
  l.updatedAt = now();
  return { listing: decorate(l, db, zoneMedians(db), user) };
}, { auth: true });

route('DELETE', '/api/listings/:id', ({ db, user, params }) => {
  const l = ownListing(db, user, params.id);
  l.status = 'deleted';
  return { ok: true };
}, { auth: true });

route('POST', '/api/listings/:id/boost', ({ db, user, params, body }) => {
  const l = ownListing(db, user, params.id);
  const b = BOOSTS[body.kind];
  if (!b) fail(400, 'Opción de visibilidad no válida.');
  const featuredUsed = db.listings.filter(x => x.ownerId === user.id && isBoosted(x) && x.id !== l.id).length;
  const included = planOf(user).featured;
  const free = ['agencia', 'constructora', 'internacional'].includes(user.role) && featuredUsed < included && b.id !== 'newsletter';
  l.boost = { kind: b.id === 'newsletter' ? (l.boost?.kind || 'destacado') : b.id, until: new Date(Date.now() + b.days * 86400000).toISOString(), newsletter: b.id === 'newsletter' || l.boost?.newsletter };
  db.orders.push({ id: randomId('o-', 6), userId: user.id, kind: 'boost', item: `${b.id}:${l.id}`, amountUsd: free ? 0 : b.price, createdAt: now() });
  return { listing: decorate(l, db, zoneMedians(db), user), charged: free ? 0 : b.price, includedInPlan: free };
}, { auth: true });

route('POST', '/api/listings/:id/documents', async ({ db, user, params, body, storeFile }) => {
  const l = ownListing(db, user, params.id);
  const docs = Array.isArray(body.docs) ? body.docs : [];
  if (!docs.length) fail(400, 'Adjunta al menos un documento.');
  for (const d of docs.slice(0, 10)) {
    if (!DOC_KINDS[d.kind]) continue;
    const url = d.dataUrl ? await storeFile(d.dataUrl, 'doc') : null;
    l.docs = (l.docs || []).filter(x => x.kind !== d.kind);
    l.docs.push({ kind: d.kind, name: clean(d.name) || d.kind, url, uploadedAt: now() });
  }
  const hasCore = ['titulo', 'gravamen'].every(k => l.docs.some(d => d.kind === k));
  l.verification = hasCore ? 'pending' : 'none';
  l.verificationNote = hasCore ? 'Expediente en revisión por el equipo legal.' : 'Faltan el documento de propiedad y el certificado de gravamen.';
  return { listing: { ...decorate(l, db, zoneMedians(db), user), docs: l.docs } };
}, { auth: true });

/* Contactos (leads) */

route('POST', '/api/listings/:id/leads', ({ db, params, body, user }) => {
  const l = db.listings.find(x => x.id === params.id && x.status === 'active');
  if (!l) fail(404, 'Aviso no disponible.');
  const name = clean(body.name) || user?.name;
  const email = clean(body.email) || user?.email;
  const phone = clean(body.phone) || user?.phone;
  if (!name || (!email && !phone)) fail(400, 'Indica tu nombre y un correo o teléfono.');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Correo no válido.');
  const owner = db.users.find(u => u.id === l.ownerId);
  const lead = {
    id: randomId('lead-', 6), listingId: l.id, ownerId: l.ownerId, fromUserId: user?.id || null,
    name, email, phone, message: clean(body.message), kind: body.kind === 'visita' ? 'visita' : 'info',
    visitDate: clean(body.visitDate) || null,
    prequal: body.prequal ? { income: clean(body.prequal.income), usdFunds: !!body.prequal.usdFunds, timeline: clean(body.prequal.timeline) } : null,
    stage: 'nuevo', notes: '', createdAt: now(),
  };
  // Pago por lead calificado para constructoras: se cobra solo si el lead está precalificado.
  if (owner?.role === 'constructora' && lead.prequal?.usdFunds) {
    lead.billedUsd = 6;
    db.orders.push({ id: randomId('o-', 6), userId: owner.id, kind: 'lead', item: lead.id, amountUsd: 6, createdAt: now() });
  }
  db.leads.push(lead);
  l.contacts = (l.contacts || 0) + 1;
  return { ok: true, leadId: lead.id, whatsapp: owner?.phone ? owner.phone.replace(/\D/g, '') : null };
});

route('GET', '/api/leads', ({ db, user }) => {
  const mine = db.leads.filter(l => l.ownerId === user.id || user.role === 'admin').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mine.map(ld => ({ ...ld, listing: (({ id, title, priceUsd, op, zone }) => ({ id, title, priceUsd, op, zone }))(db.listings.find(x => x.id === ld.listingId) || {}) }));
}, { auth: true, write: false });

route('GET', '/api/leads/sent', ({ db, user }) => db.leads.filter(l => l.fromUserId === user.id).map(ld => ({ ...ld, listing: db.listings.find(x => x.id === ld.listingId)?.title })), { auth: true, write: false });

route('PATCH', '/api/leads/:id', ({ db, user, params, body }) => {
  const ld = db.leads.find(x => x.id === params.id);
  if (!ld || (ld.ownerId !== user.id && user.role !== 'admin')) fail(404, 'Contacto no encontrado.');
  if (body.stage) {
    if (!LEAD_STAGES[body.stage]) fail(400, 'Etapa no válida.');
    if (body.stage !== 'nuevo' && body.stage !== ld.stage) needFeature(user, 'crm');
    ld.stage = body.stage;
  }
  if (body.notes != null) ld.notes = clean(body.notes);
  ld.updatedAt = now();
  return ld;
}, { auth: true });

/* Favoritos y búsquedas guardadas */

route('GET', '/api/favorites', ({ db, user }) => {
  const ids = db.favorites[user.id] || [];
  const medians = zoneMedians(db);
  return db.listings.filter(l => ids.includes(l.id) && l.status === 'active').map(l => decorate(l, db, medians, user));
}, { auth: true, write: false });

route('POST', '/api/favorites/:id', ({ db, user, params }) => {
  const list = (db.favorites[user.id] ||= []);
  const i = list.indexOf(params.id);
  if (i >= 0) list.splice(i, 1); else list.push(params.id);
  return { favorite: i < 0 };
}, { auth: true });

route('GET', '/api/searches', ({ db, user }) => db.searches.filter(s => s.userId === user.id).map(s => {
  const matches = filterListings(db, s.query);
  return { ...s, total: matches.length, fresh: matches.filter(l => l.createdAt > s.seenAt).length };
}), { auth: true, write: false });

route('POST', '/api/searches', ({ db, user, body }) => {
  const s = { id: randomId('s-', 6), userId: user.id, name: clean(body.name) || 'Mi búsqueda', query: body.query || {}, alert: body.alert !== false, createdAt: now(), seenAt: now() };
  db.searches.push(s);
  return s;
}, { auth: true });

route('POST', '/api/searches/:id/seen', ({ db, user, params }) => {
  const s = db.searches.find(x => x.id === params.id && x.userId === user.id);
  if (s) s.seenAt = now();
  return { ok: true };
}, { auth: true });

route('DELETE', '/api/searches/:id', ({ db, user, params }) => {
  db.searches = db.searches.filter(s => !(s.id === params.id && s.userId === user.id));
  return { ok: true };
}, { auth: true });

/* Valoración y mercado */

route('POST', '/api/valuation', ({ db, body }) => {
  const r = estimateValue({ zone: body.zone, op: body.op || 'venta', type: body.type || 'apartamento', area: body.area, state: body.state, features: body.features || [], parking: body.parking }, db.listings);
  if (!r) fail(400, 'Indica zona y superficie.');
  const rent = estimateValue({ zone: body.zone, op: 'alquiler', type: body.type || 'apartamento', area: body.area, state: body.state, features: body.features || [], parking: body.parking }, db.listings);
  return { ...r, rate: db.settings.rate, estimateVes: usdToVes(r.estimate, db.settings.rate), rent: rent && { estimate: rent.estimate, low: rent.low, high: rent.high }, grossYield: rent && r.estimate ? Math.round((rent.estimate * 12 / r.estimate) * 1000) / 10 : null };
}, { write: false });

route('GET', '/api/market', ({ db }) => {
  const medians = zoneMedians(db);
  return ZONES.map(z => ({ ...z, sale: medians[`${z.id}|venta`] || null, rent: medians[`${z.id}|alquiler`] || null }));
}, { write: false });

/* Contratos Ley 2026 */

route('POST', '/api/contracts/preview', ({ db, body }) => buildLeaseContract(body, db.settings.rate), { write: false });

route('POST', '/api/contracts', ({ db, user, body }) => {
  needFeature(user, 'contracts');
  const doc = buildLeaseContract(body, db.settings.rate);
  const c = { id: randomId('c-', 6), ownerId: user.id, data: body, doc, status: 'borrador', signatures: [], createdAt: now() };
  db.contracts.push(c);
  return c;
}, { auth: true });

route('GET', '/api/contracts', ({ db, user }) => db.contracts.filter(c => c.ownerId === user.id).reverse(), { auth: true, write: false });

route('POST', '/api/contracts/:id/sign', ({ db, user, params, body }) => {
  const c = db.contracts.find(x => x.id === params.id && x.ownerId === user.id);
  if (!c) fail(404, 'Contrato no encontrado.');
  const party = body.party === 'arrendatario' ? 'arrendatario' : 'arrendador';
  if (!c.signatures.some(s => s.party === party)) c.signatures.push({ party, name: clean(body.name) || party, at: now(), hash: randomId('sig-', 12) });
  c.status = c.signatures.length >= 2 ? 'firmado' : 'pendiente de firma';
  return c;
}, { auth: true });

/* Conciliación de pagos bivaluta */

function paymentView(p, rate) {
  const paidUsd = !p.paidAmount ? 0 : p.paidCurrency === 'ves' ? vesToUsd(p.paidAmount, p.rate || rate) : p.paidAmount;
  const balance = Math.round((p.amountUsd - paidUsd) * 100) / 100;
  const overdue = balance > 0.5 && new Date(p.dueDate) < new Date();
  return { ...p, paidUsd, balance, balanceVes: usdToVes(Math.max(balance, 0), rate), status: balance <= 0.5 ? 'pagado' : paidUsd > 0 ? 'parcial' : overdue ? 'vencido' : 'pendiente' };
}

route('GET', '/api/payments', ({ db, user }) => {
  needFeature(user, 'ledger');
  const list = db.payments.filter(p => p.ownerId === user.id).map(p => paymentView(p, db.settings.rate)).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const arrears = {};
  for (const p of list) if (p.status === 'vencido') arrears[p.tenant] = (arrears[p.tenant] || 0) + 1;
  return { items: list, rate: db.settings.rate, alerts: Object.entries(arrears).filter(([, n]) => n >= LAW.evictionArrearsMonths).map(([tenant, n]) => ({ tenant, months: n })) };
}, { auth: true, write: false });

route('POST', '/api/payments', ({ db, user, body }) => {
  needFeature(user, 'ledger');
  const amountUsd = num(body.amountUsd);
  if (!clean(body.tenant) || !amountUsd || !body.dueDate) fail(400, 'Indica inquilino, monto en USD y fecha de vencimiento.');
  const p = { id: randomId('pay-', 6), ownerId: user.id, tenant: clean(body.tenant), property: clean(body.property), dueDate: clean(body.dueDate), amountUsd, paidCurrency: null, paidAmount: 0, rate: null, paidAt: null, createdAt: now() };
  db.payments.push(p);
  return paymentView(p, db.settings.rate);
}, { auth: true });

route('POST', '/api/payments/:id/pay', ({ db, user, params, body }) => {
  needFeature(user, 'ledger');
  const p = db.payments.find(x => x.id === params.id && x.ownerId === user.id);
  if (!p) fail(404, 'Cuota no encontrada.');
  const currency = body.currency === 'ves' ? 'ves' : 'usd';
  const amount = num(body.amount);
  if (!amount || amount <= 0) fail(400, 'Monto no válido.');
  const rate = num(body.rate, db.settings.rate);
  const prevUsd = !p.paidAmount ? 0 : p.paidCurrency === 'ves' ? vesToUsd(p.paidAmount, p.rate) : p.paidAmount;
  const addUsd = currency === 'ves' ? vesToUsd(amount, rate) : amount;
  // Se guarda el acumulado en USD para conservar la trazabilidad con tasas distintas.
  p.paidCurrency = 'usd'; p.paidAmount = Math.round((prevUsd + addUsd) * 100) / 100; p.rate = rate; p.paidAt = now().slice(0, 10);
  (p.history ||= []).push({ currency, amount, rate, usd: addUsd, at: now() });
  return paymentView(p, db.settings.rate);
}, { auth: true });

/* Red de co-corretaje B2B (Agency Pro Max) */

route('GET', '/api/network/listings', ({ db, user, query }) => {
  needFeature(user, 'network');
  const medians = zoneMedians(db);
  return filterListings(db, { ...query, cobroke: '1' }).filter(l => l.ownerId !== user.id).map(l => decorate(l, db, medians, user));
}, { auth: true, write: false });

route('POST', '/api/network/referrals', ({ db, user, body }) => {
  needFeature(user, 'network');
  const l = db.listings.find(x => x.id === body.listingId && x.coBroke && x.status === 'active');
  if (!l) fail(404, 'El inmueble no está abierto a co-corretaje.');
  if (l.ownerId === user.id) fail(400, 'No puedes referir clientes a tu propio aviso.');
  const split = Math.min(0.4, Math.max(0.2, num(body.split, 0.3)));
  const commission = l.priceUsd * (l.coBrokeCommission || 0.05);
  const r = {
    id: randomId('ref-', 6), listingId: l.id, listingTitle: l.title, fromId: user.id, toId: l.ownerId,
    buyerName: clean(body.buyerName) || 'Comprador', buyerCountry: clean(body.buyerCountry), notes: clean(body.notes),
    split, commission, economics: referralSplit(commission, split), status: 'propuesto',
    timeline: [{ at: now(), by: user.id, event: 'Acuerdo de referido propuesto (Broker-to-Broker Referral Agreement)' }], createdAt: now(),
  };
  db.referrals.push(r);
  return r;
}, { auth: true });

route('GET', '/api/network/referrals', ({ db, user }) => db.referrals.filter(r => r.fromId === user.id || r.toId === user.id).map(r => ({
  ...r, direction: r.fromId === user.id ? 'enviado' : 'recibido',
  counterpart: ownerCard(db.users.find(u => u.id === (r.fromId === user.id ? r.toId : r.fromId))),
})).reverse(), { auth: true, write: false });

const REF_FLOW = { aceptado: ['propuesto'], visita: ['aceptado'], oferta: ['visita', 'aceptado'], cerrado: ['oferta'], rechazado: ['propuesto', 'aceptado', 'visita', 'oferta'] };
route('PATCH', '/api/network/referrals/:id', ({ db, user, params, body }) => {
  const r = db.referrals.find(x => x.id === params.id && (x.fromId === user.id || x.toId === user.id));
  if (!r) fail(404, 'Referido no encontrado.');
  const to = body.status;
  if (!REF_FLOW[to] || !REF_FLOW[to].includes(r.status)) fail(400, 'Cambio de estado no permitido.');
  if (['aceptado', 'rechazado'].includes(to) && r.status === 'propuesto' && user.id !== r.toId) fail(403, 'Solo la agencia del inmueble puede aceptar el acuerdo.');
  r.status = to;
  r.timeline.push({ at: now(), by: user.id, event: { aceptado: 'Acuerdo firmado por ambas agencias', visita: 'Hoja de visita firmada', oferta: 'Oferta presentada', cerrado: 'Operación cerrada: comisión liquidada', rechazado: 'Acuerdo rechazado' }[to] });
  return r;
}, { auth: true });

/* Due diligence notarial */

route('POST', '/api/diligence', ({ db, user, body }) => {
  const pkg = DILIGENCE[body.package];
  const l = db.listings.find(x => x.id === body.listingId && x.status === 'active');
  if (!pkg || !l) fail(400, 'Selecciona inmueble y paquete.');
  const d = { id: randomId('dd-', 6), userId: user.id, listingId: l.id, listingTitle: l.title, package: pkg.id, priceUsd: pkg.price, status: 'en curso', steps: pkg.items.map(i => ({ item: i, done: false })), createdAt: now() };
  db.diligence.push(d);
  db.orders.push({ id: randomId('o-', 6), userId: user.id, kind: 'diligence', item: `${pkg.id}:${l.id}`, amountUsd: pkg.price, createdAt: now() });
  return d;
}, { auth: true });

route('GET', '/api/diligence', ({ db, user }) => db.diligence.filter(d => d.userId === user.id || user.role === 'admin').reverse(), { auth: true, write: false });

/* Servicios para el hogar */

route('POST', '/api/services', ({ db, body, user }) => {
  if (!SERVICE_CATEGORIES[body.category]) fail(400, 'Selecciona un servicio.');
  if (!clean(body.name) || !clean(body.phone)) fail(400, 'Indica nombre y teléfono.');
  const s = { id: randomId('sv-', 6), userId: user?.id || null, category: body.category, name: clean(body.name), phone: clean(body.phone), city: clean(body.city), notes: clean(body.notes), createdAt: now() };
  db.services.push(s);
  return { ok: true, id: s.id };
});

/* Administración */

route('GET', '/api/admin/queue', ({ db }) => db.listings.filter(l => l.verification === 'pending' && l.status !== 'deleted').map(l => ({ ...l, owner: ownerCard(db.users.find(u => u.id === l.ownerId)) })), { auth: true, roles: ['admin'], write: false });

route('POST', '/api/admin/listings/:id/verify', ({ db, params, body }) => {
  const l = db.listings.find(x => x.id === params.id);
  if (!l) fail(404, 'Aviso no encontrado.');
  l.verification = body.approve ? 'verified' : 'rejected';
  l.verificationNote = clean(body.note) || (body.approve ? 'Título y gravamen revisados por el equipo legal.' : 'Documentación incompleta o inconsistente.');
  return { ok: true, verification: l.verification };
}, { auth: true, roles: ['admin'] });

route('POST', '/api/admin/rate', ({ db, body }) => {
  const rate = num(body.rate);
  if (!rate || rate <= 0) fail(400, 'Tasa no válida.');
  Object.assign(db.settings, { rate, rateUpdatedAt: now(), rateSource: 'manual', rateError: null });
  if (body.auto != null) db.settings.rateAuto = !!body.auto;
  return db.settings;
}, { auth: true, roles: ['admin'] });

route('POST', '/api/admin/rate/auto', ({ db, body }) => { db.settings.rateAuto = !!body.auto; return db.settings; }, { auth: true, roles: ['admin'] });
route('POST', '/api/admin/rate/refresh', async ({ refreshRate, db }) => { const s = await refreshRate(); if (s.rateError) fail(502, 'No se pudo leer la tasa. ' + s.rateError); return db.settings; }, { auth: true, roles: ['admin'] });

route('GET', '/api/admin/stats', ({ db }) => {
  const revenue = {};
  for (const o of db.orders) revenue[o.kind] = (revenue[o.kind] || 0) + o.amountUsd;
  const byRole = {};
  for (const u of db.users) byRole[u.role] = (byRole[u.role] || 0) + 1;
  return {
    users: db.users.length, byRole, listings: db.listings.filter(l => l.status === 'active').length,
    pending: db.listings.filter(l => l.verification === 'pending').length, leads: db.leads.length, referrals: db.referrals.length,
    services: db.services.slice(-20).reverse(), diligence: db.diligence.length, revenue,
    mrr: db.users.reduce((s, u) => s + (PLANS[u.plan]?.price || 0), 0),
    recentUsers: db.users.slice(-8).reverse().map(publicUser),
  };
}, { auth: true, roles: ['admin'], write: false });
