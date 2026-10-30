// Utilidades de interfaz: plantillas, notificaciones, modales, ilustraciones y animaciones.
import { fmtUsd, fmtVes, usdToVes, TYPES, zoneById, FEATURES } from './shared/core.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem('morada:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('morada:' + k, JSON.stringify(v)); } catch { /* almacenamiento no disponible */ } },
  del(k) { try { localStorage.removeItem('morada:' + k); } catch { /* */ } },
};

export function toast(msg, kind = 'ok') {
  const root = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast toast-' + kind;
  t.setAttribute('role', 'status');
  t.textContent = msg;
  root.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, 3800);
}

export function modal(html, { wide = false, onMount } = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-close></div><div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true"><button class="icon-btn modal-x" data-close aria-label="Cerrar">${icon('x')}</button><div class="modal-body">${html}</div></div>`;
  root.hidden = false;
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => root.classList.add('open'));
  const close = () => { root.classList.remove('open'); document.body.classList.remove('no-scroll'); setTimeout(() => { root.hidden = true; root.innerHTML = ''; }, 250); document.removeEventListener('keydown', onKey); };
  const onKey = e => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  $$('[data-close]', root).forEach(b => b.addEventListener('click', close));
  const body = $('.modal-body', root);
  onMount?.(body, close);
  $('input,select,textarea,button:not(.modal-x)', body)?.focus();
  return { el: body, close };
}

/* ------------------------------ Moneda ------------------------------ */

export const currency = {
  mode: store.get('currency', 'usd'),
  rate: 0,
  set(m) { this.mode = m; store.set('currency', m); document.dispatchEvent(new CustomEvent('currency')); },
};

export function price(usd, { op, small = false } = {}) {
  const suffix = op === 'alquiler' ? '<span class="per">/mes</span>' : '';
  if (currency.mode === 'ves') return `<span class="money">${fmtVes(usdToVes(usd, currency.rate))}${suffix}</span>${small ? '' : `<span class="money-alt">${fmtUsd(usd)}</span>`}`;
  return `<span class="money">${fmtUsd(usd)}${suffix}</span>${small ? '' : `<span class="money-alt">${fmtVes(usdToVes(usd, currency.rate))}</span>`}`;
}
export const priceText = usd => (currency.mode === 'ves' ? fmtVes(usdToVes(usd, currency.rate)) : fmtUsd(usd));
export const shortUsd = n => (n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);

/* ------------------------------ Íconos ------------------------------ */

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  shield: '<path d="M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  bed: '<path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 14h18M7 9V7h4v2"/>',
  bath: '<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM6 12V6a2 2 0 0 1 4 0"/>',
  area: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  car: '<path d="M5 16V11l2-5h10l2 5v5M5 16h14M5 16v2M19 16v2"/><circle cx="8" cy="13" r=".5"/><circle cx="16" cy="13" r=".5"/>',
  pin: '<path d="M12 21s-6-5.3-6-11a6 6 0 1 1 12 0c0 5.7-6 11-6 11Z"/><circle cx="12" cy="10" r="2"/>',
  chat: '<path d="M4 5h16v11H8l-4 4V5Z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  doc: '<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"/>',
  draw: '<path d="M4 20 8 6l8-2 4 8-6 8H4Z"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2ZM10 20a2 2 0 0 0 4 0"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7ZM3 7l12-4v4M16 13h2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10Z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
};
export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ------------------------------ Ilustraciones de avisos ------------------------------ */
// Cada aviso sin fotos recibe una ilustración generada a partir de su id (sin imágenes de terceros).

function prng(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}
const SKIES = [['#1d2b64', '#f8b26a'], ['#283c86', '#45a247'], ['#0f2027', '#2c5364'], ['#355c7d', '#f67280'], ['#3a6186', '#f2c94c'], ['#16222a', '#3a6073']];

export function artFor(l, idx = 0) {
  const r = prng(l.id + ':' + idx);
  const [s1, s2] = SKIES[Math.floor(r() * SKIES.length)];
  const W = 640, H = 420;
  let g = `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4efe6"/><stop offset="1" stop-color="#cfc6b8"/></linearGradient></defs>`;
  if (idx % 3 === 1) {
    // Interior: sala con ventanal
    const wall = ['#efe7dc', '#e3ebe8', '#ece6f2'][Math.floor(r() * 3)];
    g += `<rect width="${W}" height="${H}" fill="${wall}"/><rect x="70" y="50" width="300" height="210" fill="url(#s)" rx="4"/>`;
    g += `<path d="M70 210 L150 150 L220 190 L300 120 L370 175 V260 H70Z" fill="#2c4a3e" opacity=".75"/>`;
    g += `<rect x="70" y="50" width="300" height="210" fill="none" stroke="#fff" stroke-width="10"/><line x1="220" y1="50" x2="220" y2="260" stroke="#fff" stroke-width="6"/>`;
    g += `<rect y="300" width="${W}" height="120" fill="#b98c5f"/><rect x="380" y="235" width="210" height="80" rx="16" fill="${['#2f4858', '#86624a', '#3d5a80'][Math.floor(r() * 3)]}"/><rect x="395" y="205" width="80" height="50" rx="12" fill="#e9c46a"/><rect x="120" y="320" width="200" height="16" rx="6" fill="#3b2f2f" opacity=".5"/>`;
    g += `<circle cx="560" cy="120" r="34" fill="#d9d2c5"/><rect x="556" y="150" width="8" height="80" fill="#6b5e4e"/>`;
  } else if (idx % 3 === 2) {
    // Cocina
    g += `<rect width="${W}" height="${H}" fill="#f1efe9"/><rect y="250" width="${W}" height="170" fill="#55606e"/><rect y="236" width="${W}" height="18" fill="#d8d2c4"/>`;
    for (let i = 0; i < 5; i++) g += `<rect x="${30 + i * 120}" y="60" width="100" height="110" rx="6" fill="#fff" stroke="#d5cfc3"/>`;
    g += `<rect x="260" y="270" width="120" height="120" rx="6" fill="#2b2f36"/><circle cx="300" cy="300" r="10" fill="#666"/><circle cx="340" cy="300" r="10" fill="#666"/><rect x="430" y="190" width="40" height="46" rx="6" fill="#7fb069"/>`;
  } else {
    g += `<rect width="${W}" height="${H}" fill="url(#s)"/>`;
    // Cordillera de fondo (el Ávila)
    let m = `M0 ${H * 0.62}`;
    for (let x = 0; x <= W; x += 40) m += ` L${x} ${H * (0.38 + r() * 0.16)}`;
    g += `<path d="${m} L${W} ${H} L0 ${H}Z" fill="#1f3b2f" opacity=".55"/>`;
    let m2 = `M0 ${H * 0.7}`;
    for (let x = 0; x <= W; x += 60) m2 += ` L${x} ${H * (0.52 + r() * 0.12)}`;
    g += `<path d="${m2} L${W} ${H} L0 ${H}Z" fill="#183026" opacity=".75"/>`;
    g += `<circle cx="${80 + r() * 480}" cy="${60 + r() * 40}" r="${18 + r() * 14}" fill="#fff4d6" opacity=".85"/>`;
    const t = l.type;
    if (t === 'apartamento' || t === 'oficina') {
      const bw = 170 + r() * 60, bh = 230 + r() * 80, bx = 230 + r() * 120;
      g += `<rect x="${bx - 150}" y="${H - bh * 0.7}" width="110" height="${bh * 0.7}" fill="#2a3446" opacity=".7"/>`;
      g += `<rect x="${bx}" y="${H - bh}" width="${bw}" height="${bh}" fill="url(#b)"/>`;
      for (let y = H - bh + 18; y < H - 30; y += 26) for (let x = bx + 14; x < bx + bw - 20; x += 30) g += `<rect x="${x}" y="${y}" width="18" height="14" fill="${r() < 0.3 ? '#ffd27a' : '#5b7a99'}" opacity=".9"/>`;
      if (t === 'oficina') g += `<rect x="${bx}" y="${H - bh}" width="${bw}" height="${bh}" fill="#6fa8dc" opacity=".25"/>`;
    } else if (t === 'casa' || t === 'townhouse') {
      const n = t === 'townhouse' ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const w = t === 'townhouse' ? 140 : 280, x = (t === 'townhouse' ? 110 : 180) + i * 150, y = 220;
        g += `<rect x="${x}" y="${y}" width="${w}" height="160" fill="url(#b)"/><path d="M${x - 20} ${y} L${x + w / 2} ${y - 80} L${x + w + 20} ${y}Z" fill="#a4483a"/>`;
        g += `<rect x="${x + w / 2 - 22}" y="${y + 80}" width="44" height="80" fill="#6b4226"/><rect x="${x + 18}" y="${y + 40}" width="40" height="36" fill="#ffd27a" opacity=".8"/><rect x="${x + w - 58}" y="${y + 40}" width="40" height="36" fill="#5b7a99"/>`;
      }
    } else if (t === 'local') {
      g += `<rect x="120" y="170" width="400" height="210" fill="url(#b)"/><rect x="140" y="250" width="360" height="130" fill="#7fb3d5" opacity=".75"/><rect x="120" y="200" width="400" height="34" fill="${['#e76f51', '#2a9d8f', '#264653'][Math.floor(r() * 3)]}"/>`;
    } else if (t === 'galpon') {
      g += `<path d="M90 380 V220 L320 150 L550 220 V380Z" fill="#9aa5b1"/><rect x="250" y="270" width="140" height="110" fill="#5f6b78"/>`;
      for (let x = 100; x < 540; x += 22) g += `<line x1="${x}" y1="${230 - (x < 320 ? (x - 90) * 0.3 : (550 - x) * 0.3)}" x2="${x}" y2="380" stroke="#87929e" stroke-width="2"/>`;
    }
    // Vegetación tropical
    for (let i = 0; i < 3; i++) {
      const px = r() * W, ph = 90 + r() * 60;
      g += `<path d="M${px} ${H} q 6 -${ph / 2} 0 -${ph}" stroke="#4a3b2a" stroke-width="5" fill="none"/>`;
      for (let k = 0; k < 5; k++) g += `<path d="M${px} ${H - ph} q ${(k - 2) * 18} -12 ${(k - 2) * 34} ${10 + Math.abs(k - 2) * 8}" stroke="#2f6b3f" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    }
    g += `<rect y="${H - 26}" width="${W}" height="26" fill="#22332a"/>`;
  }
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${g}</svg>`);
}

export const photoOf = (l, i = 0) => (l.photos && l.photos.length ? l.photos[i % l.photos.length] : artFor(l, i));
export const photoCount = l => (l.photos && l.photos.length ? l.photos.length : 5);

/* ------------------------------ Tarjeta de aviso ------------------------------ */

export function card(l, { compact = false } = {}) {
  const z = zoneById(l.zone);
  const badges = [
    l.boosted === 'top' ? `<span class="chip chip-gold">${icon('star')} Top</span>` : l.boosted ? '<span class="chip chip-gold">Destacado</span>' : '',
    l.verification === 'verified' ? `<span class="chip chip-ok">${icon('shield')} Título verificado</span>` : '',
    l.project ? '<span class="chip">Obra nueva</span>' : '',
  ].join('');
  const ind = l.indicator ? `<span class="ind ind-${l.indicator.label}" title="Precio por m² frente a la mediana de la zona">${{ bajo: 'Bajo la media', justo: 'Precio en línea', alto: 'Sobre la media' }[l.indicator.label]}</span>` : '';
  return `<article class="card tilt ${l.boosted ? 'is-boosted' : ''} ${compact ? 'card-compact' : ''}" data-id="${l.id}">
    <a class="card-media" href="#/inmueble/${l.id}" aria-label="${esc(l.title)}">
      <img loading="lazy" src="${photoOf(l)}" alt="">
      <div class="card-badges">${badges}</div>
    </a>
    <button class="fav ${l.favorite ? 'on' : ''}" data-fav="${l.id}" aria-label="Guardar en favoritos" aria-pressed="${!!l.favorite}">${icon('heart')}</button>
    <div class="card-body">
      <div class="card-price">${price(l.priceUsd, { op: l.op, small: compact })}</div>
      <a class="card-title" href="#/inmueble/${l.id}">${esc(l.title)}</a>
      <div class="card-loc">${icon('pin')} ${esc(z?.name || '')}, ${esc(l.city)}</div>
      <div class="card-facts">
        <span>${icon('area')} ${l.area} m²</span>
        ${l.rooms ? `<span>${icon('bed')} ${l.rooms}</span>` : ''}
        ${l.baths ? `<span>${icon('bath')} ${l.baths}</span>` : ''}
        ${l.parking ? `<span>${icon('car')} ${l.parking}</span>` : ''}
      </div>
      ${compact ? '' : `<div class="card-foot">${ind}<span class="card-owner">${esc(l.owner?.name || '')}</span></div>`}
    </div>
  </article>`;
}

/* ------------------------------ Movimiento ------------------------------ */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let io;
export function reveal(root = document) {
  if (!('IntersectionObserver' in window) || reduced()) { $$('.rv', root).forEach(el => el.classList.add('in')); return; }
  io ||= new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  $$('.rv:not(.in)', root).forEach((el, i) => { el.style.setProperty('--d', (Number(el.dataset.d) || i % 4) * 70 + 'ms'); io.observe(el); });
  // Lo que ya está en pantalla aparece de inmediato.
  requestAnimationFrame(() => $$('.rv:not(.in)', root).forEach(el => { const b = el.getBoundingClientRect(); if (b.top < innerHeight && b.bottom > 0) el.classList.add('in'); }));
}

export function tilt(root = document) {
  if (reduced() || matchMedia('(hover: none)').matches) return;
  $$('.tilt', root).forEach(el => {
    if (el.dataset.tilt) return;
    el.dataset.tilt = 1;
    el.addEventListener('pointermove', e => {
      const b = el.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
      el.style.transform = `perspective(900px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
      el.style.setProperty('--gx', `${(x + 0.5) * 100}%`); el.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

export function countUp(root = document) {
  $$('[data-count]', root).forEach(el => {
    const target = Number(el.dataset.count), t0 = performance.now(), dur = reduced() ? 0 : 1200;
    const step = t => { const p = dur ? Math.min(1, (t - t0) / dur) : 1; el.textContent = Math.round(target * (1 - (1 - p) ** 3)).toLocaleString('es-VE') + (el.dataset.suffix || ''); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

// Recorta y comprime imágenes en el navegador antes de subirlas.
export function readImage(file, max = 1280, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
export const readFileAsDataUrl = file => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });

// Retira un mapa de Leaflet sin cortar una animación de zoom en curso (evita errores al cambiar de página).
export function disposeMap(map) {
  if (!map) return;
  const kill = () => { try { map.off(); map.remove(); } catch { /* ya retirado */ } };
  if (map._animatingZoom || map._panAnim?._inProgress) { map.stop(); setTimeout(kill, 400); } else kill();
}

export const featureList = l => (l.features || []).map(f => FEATURES[f]).filter(Boolean);
export const typeName = t => TYPES[t] || t;
export const fmtDate = s => (s ? new Date(s).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const formData = form => {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') { if (el.dataset.group) { (o[el.dataset.group] ||= []); if (el.checked) o[el.dataset.group].push(el.value); } else o[el.name] = el.checked; }
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else if (el.type !== 'file' && el.type !== 'submit' && el.type !== 'button') o[el.name] = el.value;
  }
  return o;
};
export { fmtUsd, fmtVes };
