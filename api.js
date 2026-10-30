// Cliente de la API. Si no hay servidor (por ejemplo en una vista estática), usa el mismo
// motor dentro del navegador con persistencia en localStorage: "modo demo".
import { createEngine, emptyDb, seedDb } from './shared/engine.js';
import { store } from './ui.js';

const DB_KEY = 'db-v1';
// En GitHub Pages la API vive en Supabase; con el servidor Node es el mismo origen.
const API = /\.github\.io$/.test(location.hostname) ? 'https://gjyipfrmneqnosgsyqoa.supabase.co/functions/v1/api' : '';
let local = null;
export const mode = { server: false };

async function detectServer() {
  try {
    const r = await fetch(API + '/api/health', { cache: 'no-store' });
    const j = await r.json();
    return j && j.ok === true;
  } catch { return false; }
}

async function bootLocal() {
  let db = store.get(DB_KEY);
  if (!db || db.version !== 1) db = await seedDb(emptyDb());
  let warned = false;
  const save = () => {
    try { localStorage.setItem('morada:' + DB_KEY, JSON.stringify(db)); }
    catch { if (!warned) { warned = true; console.warn('Almacenamiento local lleno o no disponible: los cambios se guardan solo en esta sesión.'); } }
  };
  save();
  local = createEngine({ db, save });
}

export async function init() {
  mode.server = await detectServer();
  if (!mode.server) await bootLocal();
  return mode;
}

export const session = {
  get token() { return store.get('token'); },
  set token(t) { if (t) store.set('token', t); else store.del('token'); },
  user: null,
};

export async function api(method, path, body) {
  const [p, qs] = path.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  let status, data;
  if (mode.server) {
    const res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(session.token ? { Authorization: 'Bearer ' + session.token } : {}) },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    });
    status = res.status;
    data = await res.json().catch(() => ({ error: 'Respuesta no válida del servidor.' }));
  } else {
    const out = await local.handle(method, p, { query, body: body ? JSON.parse(JSON.stringify(body)) : {}, token: session.token });
    status = out.status; data = JSON.parse(JSON.stringify(out.body));
  }
  if (status === 401 && session.token && !path.startsWith('/api/auth')) { session.token = null; session.user = null; }
  if (status >= 400) { const e = new Error(data?.error || 'Error'); e.status = status; throw e; }
  return data;
}

export const get = p => api('GET', p);
export const post = (p, b) => api('POST', p, b);
export const patch = (p, b) => api('PATCH', p, b);
export const del = p => api('DELETE', p);

export function resetDemo() { store.del(DB_KEY); store.del('token'); location.hash = '#/'; location.reload(); }
