// Servidor de Morada: API JSON + archivos estáticos, sin dependencias externas.
import http from 'node:http';
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createEngine, emptyDb, seedDb } from './shared/engine.js';
import { fetchOfficialRate } from './shared/rates.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.MORADA_DATA || join(ROOT, 'data');
const DB_FILE = join(DATA_DIR, 'db.json');
const UPLOADS = join(DATA_DIR, 'uploads');
const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY = 30 * 1024 * 1024;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf', '.ico': 'image/x-icon' };
const DATA_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };

async function loadDb() {
  await mkdir(UPLOADS, { recursive: true });
  if (existsSync(DB_FILE)) return JSON.parse(await readFile(DB_FILE, 'utf8'));
  const db = await seedDb(emptyDb());
  await writeFile(DB_FILE, JSON.stringify(db));
  console.log('Base de datos inicial creada con datos de demostración.');
  return db;
}

const db = await loadDb();
let saving = Promise.resolve();
// Escritura atómica: archivo temporal + rename, serializada para evitar carreras.
const save = () => (saving = saving.then(async () => {
  const tmp = DB_FILE + '.tmp';
  await writeFile(tmp, JSON.stringify(db));
  await rename(tmp, DB_FILE);
}));

async function storeFile(dataUrl) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!m || !DATA_MIME[m[1]]) return null;
  const name = randomBytes(12).toString('hex') + DATA_MIME[m[1]];
  await writeFile(join(UPLOADS, name), Buffer.from(m[2], 'base64'));
  return '/uploads/' + name;
}

const engine = createEngine({ db, save, storeFile, fetchRate: () => fetchOfficialRate() });

// Tasa BCV: se consulta al arrancar y cada RATE_EVERY_HOURS horas (6 por defecto) si está en automático.
const RATE_EVERY = (Number(process.env.RATE_EVERY_HOURS) || 6) * 3600 * 1000;
async function rateTick() {
  if (!db.settings.rateAuto || process.env.RATE_AUTO === '0') return;
  const s = await engine.refreshRate().catch(e => ({ rateError: e.message }));
  console.log(s.rateError ? `Tasa BCV no actualizada: ${s.rateError}` : `Tasa BCV actualizada: ${s.rate} (${s.rateSource})`);
}
rateTick();
setInterval(rateTick, RATE_EVERY).unref();

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(Object.assign(new Error('bad json'), { status: 400 })); } });
    req.on('error', reject);
  });
}

async function serveStatic(res, file) {
  try {
    const s = await stat(file);
    if (!s.isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': file.includes('uploads') ? 'public, max-age=86400' : 'no-cache' });
    res.end(await readFile(file));
    return true;
  } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (path.startsWith('/api/')) {
    let body = {};
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try { body = await readBody(req); } catch (e) { res.writeHead(e.status || 400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.status === 413 ? 'Archivo demasiado grande.' : 'Solicitud no válida.' })); }
    }
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
    const out = await engine.handle(req.method, path, { query: Object.fromEntries(url.searchParams), body, token });
    res.writeHead(out.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(out.body));
  }

  const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
  if (safe.startsWith('/uploads/') && await serveStatic(res, join(UPLOADS, safe.slice(9)))) return;
  if (safe.startsWith('/shared/') && await serveStatic(res, join(ROOT, safe))) return;
  if (safe !== '/' && await serveStatic(res, join(ROOT, 'public', safe))) return;
  await serveStatic(res, join(ROOT, 'public', 'index.html')) || (res.writeHead(404), res.end());
});

server.listen(PORT, () => console.log(`Morada escuchando en http://localhost:${PORT}`));
