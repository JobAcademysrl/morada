// Arranque de la aplicación: enrutador por hash, cabecera, pie y estado de sesión.
import { init, get, post, session, mode, resetDemo } from './api.js';
import { $, $$, esc, icon, toast, currency, store, reveal, tilt } from './ui.js';
import { fmtVes } from './shared/core.js';
import home from './views/home.js';
import search from './views/search.js';
import listing from './views/listing.js';
import publish from './views/publish.js';
import panel from './views/panel.js';
import { auth } from './views/auth.js';
import { valuation, market, investors, professionals, law, favorites, services } from './views/tools.js';
import { pay, checkReturn } from './pay.js';

export const ctx = {
  meta: null,
  get user() { return session.user; },
  go(hash) { if (location.hash === hash) render(); else location.hash = hash; },
  async refreshUser() {
    if (!session.token) { session.user = null; return null; }
    try { const r = await get('/api/me'); session.user = r.user; ctx.quota = r.quota; ctx.plan = r.plan; }
    catch { session.user = null; session.token = null; }
    paintHeader();
    return session.user;
  },
  async logout() { try { await post('/api/auth/logout'); } catch { /* */ } session.token = null; session.user = null; paintHeader(); ctx.go('#/'); toast('Sesión cerrada.'); },
  requireAuth(next) {
    if (session.user) return true;
    ctx.go('#/entrar?next=' + encodeURIComponent(next || location.hash));
    return false;
  },
};

const ROUTES = [
  [/^\/?$/, home],
  [/^\/buscar$/, search],
  [/^\/inmueble\/([\w-]+)$/, listing],
  [/^\/publicar$/, publish],
  [/^\/editar\/([\w-]+)$/, publish],
  [/^\/panel(?:\/([\w-]+))?$/, panel],
  [/^\/entrar$/, auth],
  [/^\/registro$/, auth],
  [/^\/valorar$/, valuation],
  [/^\/mercado$/, market],
  [/^\/inversores$/, investors],
  [/^\/profesionales$/, professionals],
  [/^\/ley-2026$/, law],
  [/^\/favoritos$/, favorites],
  [/^\/servicios$/, services],
];

let cleanup = null;
let renderSeq = 0;

export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

async function render() {
  const seq = ++renderSeq;
  const { path, query } = parseHash();
  const view = $('#view');
  cleanup?.(); cleanup = null;
  let match = null, fn = null;
  for (const [re, f] of ROUTES) { const m = path.match(re); if (m) { match = m; fn = f; break; } }
  $('#mobile-nav').classList.remove('open');
  document.body.classList.remove('no-scroll');
  $$('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + location.hash.slice(1)));
  const isHome = fn === home;
  $('#header').classList.toggle('always', !isHome);
  document.body.dataset.view = path.split('/')[1] || 'home';
  $('#footer').hidden = fn === search;
  view.classList.remove('entering');
  if (!fn) { view.innerHTML = `<section class="wrap section empty"><h2>Página no encontrada</h2><p>La dirección no existe.</p><a class="btn btn-primary" href="#/">Volver al inicio</a></section>`; return; }
  try {
    const out = await fn(view, { ...ctx, params: match.slice(1), query, path });
    if (seq !== renderSeq) return;
    cleanup = typeof out === 'function' ? out : null;
  } catch (e) {
    console.error(e);
    view.innerHTML = `<section class="wrap section empty"><h2>No pudimos cargar esta página</h2><p>${esc(e.message)}</p><a class="btn" href="#/">Ir al inicio</a></section>`;
  }
  void view.offsetWidth;
  view.classList.add('entering');
  if (!query.keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
  reveal(view); tilt(view);
}

/* ------------------------------ Cabecera y pie ------------------------------ */

function paintHeader() {
  const u = session.user;
  $('#user-slot').innerHTML = u
    ? `<a class="btn btn-sm btn-ghost" href="#/panel" title="${esc(u.name)}">${icon('user')}<span class="hide-sm">Mi panel</span></a>`
    : `<a class="btn btn-sm btn-ghost" href="#/entrar" aria-label="Entrar">${icon('user')}<span class="hide-sm">Entrar</span></a>`;
  $('#publish-btn').innerHTML = `${icon('plus')}<span>Publicar</span>`;
  $('#fav-link').innerHTML = icon('heart');
  $('#burger').innerHTML = icon('menu');
  $('#rate').innerHTML = `BCV <b>${currency.rate.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</b> Bs./USD`;
  $$('[data-cur]').forEach(b => b.classList.toggle('on', b.dataset.cur === currency.mode));
  const theme = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  $('#theme-btn').innerHTML = icon(theme === 'light' ? 'moon' : 'sun');
  $('#mobile-nav').innerHTML = [...$$('#nav a').map(a => a.outerHTML), u ? '<a href="#/panel">Mi panel</a>' : '<a href="#/entrar">Entrar o registrarse</a>', '<a href="#/mercado">Precios por zona</a>', '<a href="#/ley-2026">Ley de arrendamiento 2026</a>', '<a href="#/servicios">Servicios para el hogar</a>', '<a href="#/favoritos">Favoritos</a>', `<button type="button" id="m-theme">${theme === 'light' ? 'Tema oscuro' : 'Tema claro'}</button>`].join('');
  $('#m-theme').addEventListener('click', () => $('#theme-btn').click());
}

function paintFooter() {
  $('#footer').innerHTML = `<div class="wrap footer-grid">
    <div class="stack"><a class="logo" href="#/" aria-label="Morada, inicio"><svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--logo-bg, #0074c1)"/><path d="M7 24V13.5L12 8.5l4 4 4-4 5 5V24" fill="none" stroke="var(--logo-fg, #fff)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="20.5" r="2.4" fill="#e50013"/></svg><span class="logo-word">morada<b>.ve</b></span></a><p>Portal inmobiliario para Venezuela y su diáspora. Precios en dólares y bolívares, títulos verificados y herramientas profesionales para agencias.</p><p class="faint">Los avisos de ejemplo son ficticios. La tasa BCV mostrada es una referencia configurable.</p></div>
    <div><h4>Buscar</h4><a href="#/buscar?op=venta">Comprar</a><a href="#/buscar?op=alquiler">Alquilar</a><a href="#/buscar?project=1&op=venta">Obra nueva</a><a href="#/mercado">Precios por zona</a></div>
    <div><h4>Herramientas</h4><a href="#/valorar">¿Cuánto vale mi casa?</a><a href="#/ley-2026">Ley de arrendamiento 2026</a><a href="#/inversores">Comprar desde el exterior</a><a href="#/servicios">Servicios para el hogar</a></div>
    <div><h4>Profesionales</h4><a href="#/profesionales">Planes para agencias</a><a href="#/publicar">Publicar un aviso</a><a href="#/panel">Mi panel</a><a href="#/registro?role=internacional">Red internacional</a></div>
  </div>`;
}

function bindChrome() {
  $$('[data-cur]').forEach(b => b.addEventListener('click', () => { currency.set(b.dataset.cur); paintHeader(); }));
  document.addEventListener('currency', () => render());
  $('#theme-btn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next; store.set('theme', next); paintHeader();
    document.dispatchEvent(new CustomEvent('theme'));
  });
  $('#burger').addEventListener('click', () => { const m = $('#mobile-nav'); const open = !m.classList.contains('open'); m.classList.toggle('open', open); $('#burger').setAttribute('aria-expanded', open); document.body.classList.toggle('no-scroll', open); });
  const header = $('#header'), bar = $('#progress');
  const onScroll = () => {
    header.classList.toggle('solid', scrollY > 30);
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  // Elección de plan desde cualquier tabla de precios
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-plan]');
    if (!b) return;
    const u = session.user;
    if (!u) { ctx.go('#/registro?role=agencia&plan=' + b.dataset.plan); return; }
    if (!['agencia', 'constructora', 'internacional'].includes(u.role)) { toast('Los planes son para cuentas de agencia, constructora o broker internacional.', 'err'); return; }
    try { await pay(ctx, { path: '/api/me/plan', body: { plan: b.dataset.plan }, done: async () => { await ctx.refreshUser(); toast(`Plan ${ctx.plan.name} activado.`); render(); } }); }
    catch (err) { toast(err.message, 'err'); }
  });
  // Favoritos desde cualquier tarjeta
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-fav]');
    if (!b) return;
    e.preventDefault();
    if (!session.user) { toast('Inicia sesión para guardar favoritos.'); ctx.go('#/entrar?next=' + encodeURIComponent(location.hash)); return; }
    try { const r = await post('/api/favorites/' + b.dataset.fav); b.classList.toggle('on', r.favorite); b.setAttribute('aria-pressed', r.favorite); toast(r.favorite ? 'Guardado en favoritos.' : 'Eliminado de favoritos.'); }
    catch (err) { toast(err.message, 'err'); }
  });
}

async function boot() {
  const theme = store.get('theme');
  if (theme) document.documentElement.dataset.theme = theme;
  await init();
  ctx.meta = await get('/api/meta');
  currency.rate = ctx.meta.rate;
  if (session.token) await ctx.refreshUser();
  await checkReturn(ctx);
  bindChrome(); paintHeader(); paintFooter();
  if (!mode.server) {
    const b = $('#demo-banner');
    b.hidden = false;
    b.innerHTML = `Modo demostración: los datos se guardan en este navegador. <button id="reset-demo">Restablecer datos</button>`;
    $('#reset-demo').addEventListener('click', resetDemo);
  }
  addEventListener('hashchange', render);
  render();
}

export const refreshMeta = async () => { ctx.meta = await get('/api/meta'); currency.rate = ctx.meta.rate; paintHeader(); };
export { paintHeader, fmtVes };
boot();
