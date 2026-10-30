// API de Morada en Supabase Edge Functions: el mismo motor de shared/engine.js, con
// persistencia en Postgres (tabla morada_kv), archivos en Storage y cobros con Stripe.
// El motor se importa de shared/ fijado a un commit: tras cambiar shared/, haz push y actualiza el SHA de abajo.
import postgres from 'npm:postgres@3.4.5';
import { createEngine, emptyDb, seedDb, hashPassword, checkPassword } from 'https://raw.githubusercontent.com/JobAcademysrl/morada/5c2c2b0f4b6bc182020c35aa5d6a79bf58add895/shared/engine.js';
import { fetchOfficialRate } from 'https://raw.githubusercontent.com/JobAcademysrl/morada/5c2c2b0f4b6bc182020c35aa5d6a79bf58add895/shared/rates.js';

const env = (k: string) => Deno.env.get(k) || '';
const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const STRIPE_KEY = env('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = env('STRIPE_WEBHOOK_SECRET');
const SITE_URL = env('SITE_URL') || 'https://jobacademysrl.github.io/morada/';
const RATE_EVERY = (Number(env('RATE_EVERY_HOURS')) || 6) * 3600 * 1000;

const sql = postgres(env('SUPABASE_DB_URL'), { prepare: false, max: 3, idle_timeout: 20 });
type Sql = typeof sql;

/* ------------------------------ Estado en Postgres ------------------------------ */

const db: Record<string, any> = {};
const snap: Record<string, string> = {};
let version = -1;
let q: Sql = sql; // conexión de la transacción en curso

async function ensureFresh(tx: Sql, known?: number) {
  const v = known ?? Number((await tx`select version from morada_meta where id = 1`)[0]?.version ?? 0);
  if (v === version) return;
  const rows = await tx`select k, v from morada_kv`;
  for (const k of Object.keys(db)) delete db[k];
  for (const k of Object.keys(snap)) delete snap[k];
  for (const r of rows) { db[r.k] = r.v; snap[r.k] = JSON.stringify(r.v); }
  version = v;
}

async function save() {
  let changed = false;
  for (const [k, val] of Object.entries(db)) {
    const s = JSON.stringify(val);
    if (s === snap[k]) continue;
    await q`insert into morada_kv (k, v) values (${k}, ${sql.json(val)}) on conflict (k) do update set v = excluded.v, updated_at = now()`;
    snap[k] = s; changed = true;
  }
  if (changed) version = Number((await q`update morada_meta set version = version + 1 where id = 1 returning version`)[0].version);
}

// Escrituras serializadas: una a la vez por instancia y con bloqueo de fila entre instancias.
let chain: Promise<unknown> = Promise.resolve();
function write<T>(fn: () => Promise<T>): Promise<T> {
  const run = () => sql.begin(async (tx: Sql) => {
    const v = Number((await tx`select version from morada_meta where id = 1 for update`)[0].version);
    await ensureFresh(tx, v);
    q = tx;
    try { return await fn(); } finally { q = sql; }
  }).catch((e: unknown) => { version = -1; throw e; });
  const p = chain.then(run, run);
  chain = p.catch(() => {});
  return p as Promise<T>;
}

/* ------------------------------ Archivos ------------------------------ */

const MIME_EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };
const storageHeaders = { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY };

// Fotos en el bucket público "photos"; documentos legales en el bucket privado "docs".
async function storeFile(dataUrl: string, kind = 'img') {
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!m || !MIME_EXT[m[1]]) return null;
  const bucket = kind === 'doc' ? 'docs' : 'photos';
  const name = crypto.randomUUID().replaceAll('-', '') + MIME_EXT[m[1]];
  const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${name}`, { method: 'POST', headers: { ...storageHeaders, 'Content-Type': m[1] }, body: bytes });
  if (!r.ok) throw new Error('storage ' + r.status + ' ' + (await r.text()));
  return bucket === 'docs' ? `sb://docs/${name}` : `${SUPABASE_URL}/storage/v1/object/public/photos/${name}`;
}

async function signFile(url: string) {
  if (!url?.startsWith('sb://docs/')) return url;
  const name = url.slice('sb://docs/'.length);
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/docs/${name}`, { method: 'POST', headers: { ...storageHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 900 }) });
  if (!r.ok) return null;
  const j = await r.json();
  return `${SUPABASE_URL}/storage/v1${j.signedURL}`;
}

/* ------------------------------ Stripe ------------------------------ */

async function stripe(path: string, params?: Record<string, string>) {
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method: params ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'Stripe ' + r.status);
  return j;
}

const allowedReturn = (u: string) => !!u && (u.startsWith(SITE_URL) || /^http:\/\/localhost(:\d+)?\//.test(u));

const card = STRIPE_KEY ? {
  async create(o: any, returnUrl: string) {
    const base = allowedReturn(returnUrl) ? returnUrl : SITE_URL;
    const u = (db.users || []).find((x: any) => x.id === o.userId);
    const s = await stripe('checkout/sessions', {
      mode: 'payment',
      success_url: base + '#/panel/facturas',
      cancel_url: base + '#/panel/facturas',
      client_reference_id: o.id,
      'metadata[order_id]': o.id,
      ...(u?.email ? { customer_email: u.email } : {}),
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(Math.round(o.amountUsd * 100)),
      'line_items[0][price_data][product_data][name]': `Morada · ${o.title || o.kind}`,
    });
    return { id: s.id, url: s.url };
  },
  async fetch(id: string) {
    const s = await stripe('checkout/sessions/' + encodeURIComponent(id));
    return { paid: s.payment_status === 'paid' };
  },
} : null;

const enc = new TextEncoder();
async function verifyStripe(raw: string, header: string) {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')).map(([k, ...v]) => [k, v.join('=')]));
  const sigs = header.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 600) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${raw}`)))].map(b => b.toString(16).padStart(2, '0')).join('');
  return sigs.includes(mac);
}

/* ------------------------------ Motor ------------------------------ */

const engine = createEngine({ db, save, storeFile, signFile, fetchRate: () => fetchOfficialRate(), payments: { card } });

let booted = false;
async function boot() {
  if (booted) return;
  await write(async () => {
    if (!db.users) {
      Object.assign(db, await seedDb(emptyDb()));
      console.log('Base de datos inicial creada con datos de demostración.');
    }
    // La contraseña del administrador sale del secreto MORADA_ADMIN_PASSWORD; sin él la cuenta queda bloqueada.
    const admin = db.users.find((u: any) => u.role === 'admin');
    const pass = env('MORADA_ADMIN_PASSWORD');
    if (admin && env('MORADA_ADMIN_EMAIL')) admin.email = env('MORADA_ADMIN_EMAIL').toLowerCase();
    if (admin && !(pass && await checkPassword(pass, admin.password))) admin.password = await hashPassword(pass || crypto.randomUUID() + crypto.randomUUID());
    db.settings.rateAuto ??= true;
    await save();
  });
  booted = true;
}

async function maybeRefreshRate() {
  const s = db.settings;
  if (!s?.rateAuto || Date.now() - Date.parse(s.rateUpdatedAt || 0) < RATE_EVERY || Date.now() - Date.parse(s.rateErrorAt || 0) < 3600 * 1000) return;
  await write(() => engine.refreshRate()).catch(e => console.error('tasa', e));
}

/* ------------------------------ HTTP ------------------------------ */

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/(functions\/v1\/)?api(?=\/)/, '');
  try {
    await boot();
    if (path === '/stripe-webhook' && req.method === 'POST') {
      const raw = await req.text();
      if (!STRIPE_WEBHOOK_SECRET || !(await verifyStripe(raw, req.headers.get('stripe-signature') || ''))) return json(400, { error: 'firma no válida' });
      const ev = JSON.parse(raw);
      const s = ev.data?.object;
      if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(ev.type) && s?.payment_status === 'paid') {
        await write(() => engine.settle(s.metadata?.order_id || s.client_reference_id, s.id));
      }
      return json(200, { received: true });
    }
    if (!path.startsWith('/api/')) return json(404, { error: 'Recurso no encontrado.' });
    let body = {};
    if (req.method !== 'GET') {
      const text = await req.text();
      try { body = text ? JSON.parse(text) : {}; } catch { return json(400, { error: 'Solicitud no válida.' }); }
    }
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || null;
    const query = Object.fromEntries(url.searchParams);
    if (req.method === 'GET') {
      await ensureFresh(sql);
      if (path === '/api/meta') await maybeRefreshRate();
      const out = await engine.handle('GET', path, { query, body, token });
      return json(out.status, out.body);
    }
    const out = await write(async () => {
      const r = await engine.handle(req.method, path, { query, body, token });
      if (r.status >= 500) version = -1; // estado en memoria dudoso: se recarga
      return r;
    });
    return json(out.status, out.body);
  } catch (e) {
    console.error(e);
    return json(500, { error: 'Error interno.' });
  }
});
