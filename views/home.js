// Portada: cielo del Ávila en capas con parallax, buscador, historia con scroll fijo y segmentos.
import { get } from '../api.js';
import { $, $$, esc, icon, card, price, countUp, reveal, tilt, shortUsd } from '../ui.js';
import { ZONES, SEGMENTS, PLANS, fmtUsd, LAW, zoneById } from '../shared/core.js';

// Perfil de montaña generado con suma de senos: cada capa tiene su propio ritmo.
function ridge(seed, base, amp, w = 1600, h = 400) {
  let d = `M0 ${h}`;
  for (let x = 0; x <= w; x += 16) {
    const y = base - amp * (0.55 * Math.sin(x / 210 + seed) + 0.3 * Math.sin(x / 83 + seed * 2.1) + 0.15 * Math.sin(x / 37 + seed * 3.7));
    d += ` L${x} ${y.toFixed(1)}`;
  }
  return d + ` L${w} ${h} Z`;
}
function skyline(seed, w = 1600, h = 400) {
  let d = `M0 ${h}`, x = 0, s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  while (x < w) {
    const bw = 22 + rnd() * 50, bh = 30 + rnd() * (x > 500 && x < 1100 ? 160 : 90);
    d += ` L${x.toFixed(0)} ${h - bh} L${(x + bw).toFixed(0)} ${h - bh}`;
    x += bw + rnd() * 6;
    d += ` L${x.toFixed(0)} ${h}`;
  }
  return d + ` L${w} ${h} Z`;
}

export default async function home(el, ctx) {
  const { meta } = ctx;
  const [feat, market] = await Promise.all([get('/api/listings?limit=8&verified=1'), get('/api/market')]);
  const zonesWithData = market.filter(z => z.sale).sort((a, b) => b.sale.median - a.sale.median);
  const ticker = zonesWithData.map(z => `<span>${esc(z.name)} <b>${fmtUsd(z.sale.median)}/m²</b></span>`).join('');

  el.innerHTML = `
  <section class="hero" id="hero">
    <div class="sky"></div>
    <div class="sun" data-depth="0.5"></div>
    <svg class="cable" data-depth="0.35" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
      <path id="cable-path" d="M-20 720 Q 700 520 1620 260" stroke="rgba(255,255,255,.35)" stroke-width="1.5" fill="none"/>
      <g id="cabin"><rect x="-9" y="0" width="18" height="14" rx="3" fill="#ffd08a"/><line x1="0" y1="-10" x2="0" y2="0" stroke="rgba(255,255,255,.6)"/></g>
    </svg>
    <div class="layer" data-depth="0.25" style="bottom:22%"><svg viewBox="0 0 1600 400" preserveAspectRatio="none"><path d="${ridge(1.2, 230, 110)}" fill="var(--ridge-1)" opacity=".8"/></svg></div>
    <div class="layer" data-depth="0.15" style="bottom:8%"><svg viewBox="0 0 1600 400" preserveAspectRatio="none"><path d="${ridge(4.1, 270, 80)}" fill="var(--ridge-2)"/></svg></div>
    <div class="layer" data-depth="0.06" style="bottom:-2%"><svg viewBox="0 0 1600 400" preserveAspectRatio="none"><path d="${skyline(7)}" fill="var(--ridge-3)"/></svg></div>
    <div class="hero-fade"></div>
    <div class="wrap">
      <div class="hero-inner" id="hero-inner">
        <span class="eyebrow">Caracas · Valencia · Maracaibo · Lechería · Margarita</span>
        <h1>Tu próxima casa en Venezuela, <em>con el título en regla</em>.</h1>
        <p class="hero-lead">Compra, vende o alquila con precios en dólares y su equivalente en bolívares a tasa BCV. Avisos verificados ante el SAREN, valoración automática y contratos según la nueva ley de arrendamiento.</p>
        <form class="searchbox" id="hero-search" autocomplete="off">
          <div class="row between">
            <div class="seg" role="tablist" aria-label="Operación">
              <button type="button" class="on" data-op="venta">Comprar</button>
              <button type="button" data-op="alquiler">Alquilar</button>
              <button type="button" data-op="obra">Obra nueva</button>
            </div>
            <a href="#/valorar" class="btn btn-sm btn-ghost" style="color:#fff">${icon('chart')} Valorar mi inmueble</a>
          </div>
          <div class="searchbox-row">
            <div class="ac"><input class="input" id="hs-q" name="q" placeholder="Zona, ciudad o urbanización: Altamira, Lechería…" aria-label="Dónde buscas"><div class="ac-list" id="hs-ac" hidden></div></div>
            <select class="input" id="hs-type" name="type" aria-label="Tipo de inmueble"><option value="">Todos los tipos</option>${Object.entries(meta.types).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
            <select class="input" id="hs-pmax" name="pmax" aria-label="Precio máximo"></select>
            <button class="btn btn-primary" type="submit">${icon('search')} Buscar</button>
          </div>
        </form>
        <div class="hero-stats">
          <div><b data-count="${meta.stats.listings}">${meta.stats.listings}</b><span>avisos activos</span></div>
          <div><b data-count="${meta.stats.verified}">${meta.stats.verified}</b><span>con título verificado</span></div>
          <div><b data-count="${meta.stats.pros}">${meta.stats.pros}</b><span>agencias y constructoras</span></div>
          <div><b>${LAW.maxDepositMonths} meses</b><span>depósito máximo por ley</span></div>
        </div>
      </div>
    </div>
  </section>

  <div class="marquee" aria-label="Precio mediano por metro cuadrado"><div class="marquee-track">${ticker}<span>Tasa BCV <b>${meta.rate.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.</b></span>${ticker}<span>Tasa BCV <b>${meta.rate.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.</b></span></div></div>

  <section class="section wrap">
    <div class="row between rv" style="align-items:end;margin-bottom:28px">
      <div class="section-head" style="margin:0"><span class="eyebrow">Selección verificada</span><h2>Inmuebles con expediente revisado</h2><p>Documento de propiedad y certificado de gravamen revisados por nuestro equipo legal antes de mostrar el sello.</p></div>
      <a class="btn" href="#/buscar?verified=1">Ver todos ${icon('arrow')}</a>
    </div>
    <div class="grid grid-4">${feat.items.map((l, i) => `<div class="rv" data-d="${i % 4}">${card(l)}</div>`).join('')}</div>
  </section>

  <section class="section wrap">
    <div class="section-head rv"><span class="eyebrow">Cómo funciona</span><h2>Del primer clic a la firma en el registro</h2></div>
    <div class="story" id="story">
      <div class="story-visual" aria-hidden="true">
        <div class="frame on" data-frame="0">${mockMap()}</div>
        <div class="frame" data-frame="1">${mockAvm()}</div>
        <div class="frame" data-frame="2">${mockDocs()}</div>
        <div class="frame" data-frame="3">${mockEscrow(meta.rate)}</div>
      </div>
      <div class="story-steps">
        ${[
          ['Busca dibujando sobre el mapa', 'Traza tu zona con el dedo o el ratón y filtra por lo que de verdad importa en Venezuela: planta eléctrica, tanque o pozo de agua, vigilancia y forma de pago.'],
          ['Sabe si el precio es justo', 'Cada aviso compara su precio por m² con la mediana de la zona. El valorador automático usa comparables reales para estimar venta y alquiler.'],
          ['Título verificado ante el SAREN', 'El anunciante carga documento de propiedad, gravamen, cédula catastral y solvencias. El equipo legal revisa el tracto sucesivo y otorga el sello.'],
          ['Paga protegido, en dólares o bolívares', 'Para compradores en el exterior: depósito en escrow que se libera solo cuando el documento queda protocolizado. Alquileres conciliados a tasa BCV.'],
        ].map(([t, p], i) => `<div class="story-step ${i === 0 ? 'on' : ''}" data-step="${i}"><span class="num mono">${String(i + 1).padStart(2, '0')} / 04</span><h3 style="font-size:1.8rem">${t}</h3><p>${p}</p></div>`).join('')}
      </div>
    </div>
  </section>

  <section class="hscroll" id="hscroll">
    <div class="hscroll-sticky">
      <div class="wrap"><div class="section-head" style="margin-bottom:28px"><span class="eyebrow">Para quién es Morada</span><h2>Una plataforma, cinco tipos de cliente</h2></div></div>
      <div class="hscroll-track" id="hs-track">
        ${SEGMENTS.map(s => `<article class="seg-card"><div class="stack"><span class="k">${esc(meta.roles[s.id])}</span><h3>${s.title}</h3><p>${s.text}</p></div><a class="btn ${s.id === 'agencia' ? 'btn-primary' : ''}" href="${s.id === 'comprador' ? '#/inversores' : s.id === 'agencia' ? '#/profesionales' : '#/registro?role=' + s.id}">${{ particular: 'Publicar gratis', agencia: 'Ver planes', constructora: 'Mostrar mi proyecto', internacional: 'Unirme a la red', comprador: 'Comprar desde el exterior' }[s.id]} ${icon('arrow')}</a></article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section wrap">
    <div class="section-head rv"><span class="eyebrow">Mercado</span><h2>Precio mediano por m² en venta</h2><p>Calculado con los avisos activos de cada zona. Toca una zona para ver sus inmuebles.</p></div>
    <div class="zones">${zonesWithData.slice(0, 12).map((z, i) => `<a class="zone rv" data-d="${i % 4}" href="#/buscar?op=venta&zone=${z.id}"><span class="faint">${esc(z.city)}</span><b>${esc(z.name)}</b><span class="num">${fmtUsd(z.sale.median)}<span class="per">/m²</span></span><span class="faint" style="font-size:.8rem">${z.sale.count} avisos${z.rent ? ` · alquiler ${fmtUsd(z.rent.median * 80)}/mes (80 m²)` : ''}</span></a>`).join('')}</div>
  </section>

  <section class="section wrap">
    <div class="grid grid-2" style="align-items:center">
      <div class="stack rv"><span class="eyebrow">Gaceta Oficial N° 7.065</span><h2>La nueva ley de alquileres, aplicada en cada contrato</h2><p class="muted">Desde agosto de 2026 el canon se pacta libremente y puede fijarse en dólares. Morada calcula los límites legales y genera el contrato por ti.</p><div class="row"><a class="btn btn-primary" href="#/ley-2026">Leer la guía</a><a class="btn" href="#/buscar?op=alquiler">Ver alquileres</a></div></div>
      <div class="law-grid">
        ${[['Art. 14', 'Canon en USD', 'El inquilino puede pagar en bolívares a tasa BCV del día.'], ['Art. 16', '3 meses', 'Depósito en garantía máximo.'], ['Art. 19-20', '30 %', 'Reparaciones hasta el 30 % del canon las paga el inquilino.'], ['Art. 22', '15 días', 'Para ejercer la preferencia de compra tras 2 años.']].map(([a, b, c], i) => `<div class="law-item rv" data-d="${i}"><span class="art">${a}</span><b class="num" style="font-size:1.5rem">${b}</b><span class="muted">${c}</span></div>`).join('')}
      </div>
    </div>
  </section>

  <section class="section wrap">
    <div class="section-head rv"><span class="eyebrow">Planes profesionales</span><h2>Herramientas de trabajo, no solo avisos</h2><p>CRM, contratos, conciliación bivaluta y red de co-corretaje internacional. Los particulares publican su primer aviso gratis.</p></div>
    ${plansHtml(meta)}
  </section>

  <section class="section wrap">
    <div class="cta-band rv">
      <span class="eyebrow">Para propietarios</span>
      <h2>Publica tu inmueble en cinco minutos</h2>
      <p>Sube fotos desde el teléfono, marca la ubicación en el mapa y recibe una sugerencia de precio con comparables de tu zona.</p>
      <div class="row"><a class="btn btn-primary" href="#/publicar">${icon('plus')} Publicar gratis</a><a class="btn" href="#/valorar">Primero, valorar</a></div>
    </div>
  </section>`;

  /* Buscador */
  const form = $('#hero-search', el);
  let op = 'venta';
  const pmax = $('#hs-pmax', el);
  const fillPrices = () => {
    const steps = op === 'alquiler' ? [300, 500, 800, 1200, 2000, 3500] : [40000, 70000, 100000, 150000, 250000, 400000, 700000];
    pmax.innerHTML = `<option value="">Precio máximo</option>` + steps.map(s => `<option value="${s}">Hasta ${shortUsd(s)}${op === 'alquiler' ? '/mes' : ''}</option>`).join('');
  };
  fillPrices();
  $$('[data-op]', form).forEach(b => b.addEventListener('click', () => { op = b.dataset.op; $$('[data-op]', form).forEach(x => x.classList.toggle('on', x === b)); fillPrices(); }));
  const q = $('#hs-q', el), ac = $('#hs-ac', el);
  let picked = null, acIdx = -1;
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const options = [...meta.cities.map(c => ({ label: c, kind: 'Ciudad', city: c })), ...ZONES.map(z => ({ label: z.name, kind: z.city, zone: z.id }))];
  const paintAc = () => {
    const v = norm(q.value.trim());
    const list = v ? options.filter(o => norm(o.label).includes(v)).slice(0, 6) : [];
    ac.hidden = !list.length;
    ac.innerHTML = list.map((o, i) => `<button type="button" data-i="${i}" class="${i === acIdx ? 'on' : ''}"><span>${esc(o.label)}</span><span class="faint">${esc(o.kind)}</span></button>`).join('');
    $$('button', ac).forEach(b => b.addEventListener('mousedown', e => { e.preventDefault(); picked = list[b.dataset.i]; q.value = picked.label; ac.hidden = true; }));
    return list;
  };
  q.addEventListener('input', () => { picked = null; acIdx = -1; paintAc(); });
  q.addEventListener('keydown', e => {
    const list = paintAc();
    if (e.key === 'ArrowDown') { acIdx = Math.min(list.length - 1, acIdx + 1); paintAc(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { acIdx = Math.max(0, acIdx - 1); paintAc(); e.preventDefault(); }
    if (e.key === 'Enter' && acIdx >= 0 && list[acIdx]) { picked = list[acIdx]; q.value = picked.label; ac.hidden = true; e.preventDefault(); }
  });
  q.addEventListener('blur', () => setTimeout(() => (ac.hidden = true), 120));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const p = new URLSearchParams();
    p.set('op', op === 'obra' ? 'venta' : op);
    if (op === 'obra') p.set('project', '1');
    const exact = picked || options.find(o => norm(o.label) === norm(q.value.trim()));
    if (exact?.zone) p.set('zone', exact.zone); else if (exact?.city) p.set('city', exact.city); else if (q.value.trim()) p.set('q', q.value.trim());
    if ($('#hs-type', el).value) p.set('type', $('#hs-type', el).value);
    if (pmax.value) p.set('pmax', pmax.value);
    ctx.go('#/buscar?' + p);
  });

  countUp(el);

  /* Parallax del cielo, teleférico y desvanecimiento del contenido */
  const hero = $('#hero', el), inner = $('#hero-inner', el), layers = $$('[data-depth]', hero);
  const cablePath = $('#cable-path', el), cabin = $('#cabin', el);
  const len = cablePath.getTotalLength();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, t0 = performance.now();
  const frame = now => {
    const y = scrollY, h = hero.offsetHeight;
    if (y < h * 1.2) {
      layers.forEach(l => { l.style.transform = `translate3d(0, ${y * Number(l.dataset.depth)}px, 0)`; });
      const k = Math.min(1, y / (h * 0.75));
      inner.style.opacity = String(1 - k * 0.9);
      inner.style.transform = `translate3d(0, ${y * 0.18}px, 0) scale(${1 - k * 0.04})`;
    }
    if (!reduced) {
      const p = (((now - t0) / 26000) % 1);
      const pt = cablePath.getPointAtLength(p * len);
      cabin.setAttribute('transform', `translate(${pt.x} ${pt.y + 10})`);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  /* Historia: el paso visible activa su escena */
  const steps = $$('.story-step', el), frames = $$('.frame', el);
  const sio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const i = Number(e.target.dataset.step);
    steps.forEach(s => s.classList.toggle('on', s === e.target));
    frames.forEach(f => f.classList.toggle('on', Number(f.dataset.frame) === i));
  }), { rootMargin: matchMedia('(max-width: 860px)').matches ? '-62% 0px -20% 0px' : '-45% 0px -45% 0px' });
  steps.forEach(s => sio.observe(s));

  /* Segmentos: desplazamiento horizontal ligado al scroll vertical */
  const hs = $('#hscroll', el), track = $('#hs-track', el);
  const sizeH = () => {
    if (innerWidth <= 860 || reduced) { hs.style.height = ''; track.style.transform = ''; return; }
    const extra = track.scrollWidth - innerWidth + 80;
    hs.style.height = `${innerHeight + Math.max(0, extra)}px`;
  };
  const onScroll = () => {
    if (innerWidth <= 860 || reduced) return;
    const r = hs.getBoundingClientRect();
    const max = hs.offsetHeight - innerHeight;
    const p = Math.min(1, Math.max(0, -r.top / (max || 1)));
    track.style.transform = `translate3d(${-p * Math.max(0, track.scrollWidth - innerWidth + 80)}px,0,0)`;
  };
  sizeH();
  addEventListener('resize', sizeH);
  addEventListener('scroll', onScroll, { passive: true });

  reveal(el); tilt(el);
  return () => { cancelAnimationFrame(raf); sio.disconnect(); removeEventListener('resize', sizeH); removeEventListener('scroll', onScroll); };
}

export function plansHtml(meta, current) {
  const features = {
    prueba: ['3 avisos activos', 'Contactos por correo y WhatsApp', 'Estadísticas básicas'],
    starter: ['25 avisos activos', '1 aviso destacado incluido', 'Estadísticas por aviso', 'Perfil de agencia'],
    professional: ['75 avisos activos', '5 avisos destacados incluidos', 'CRM con embudo de clientes', 'Conciliación de pagos USD / Bs.', 'Asignación de leads por zona'],
    promax: ['Avisos ilimitados', '20 destacados incluidos', 'Red de co-corretaje internacional', 'Generador de contratos Ley 2026', 'Sello de agencia verificada', 'Acceso a expedientes de la red'],
  };
  return `<div class="plans">${Object.values(PLANS).filter(p => p.id !== 'prueba').map((p, i) => `
    <div class="plan rv ${p.id === 'promax' ? 'hot' : ''}" data-d="${i}">
      ${p.id === 'promax' ? '<span class="tag tag-warn ribbon">Red B2B</span>' : ''}
      <div class="stack" style="gap:6px"><h3>${p.name}</h3><span class="price-big">$${p.price}<small> /mes</small></span></div>
      <ul>${features[p.id].map(f => `<li>${icon('check')}<span>${f}</span></li>`).join('')}</ul>
      ${current === p.id ? '<span class="tag tag-ok">Tu plan actual</span>' : `<button class="btn ${p.id === 'promax' ? 'btn-primary' : ''} btn-block" data-plan="${p.id}">Elegir ${p.name}</button>`}
    </div>`).join('')}
    <div class="plan rv" data-d="3"><div class="stack" style="gap:6px"><h3>Particulares</h3><span class="price-big">$0<small> primer aviso</small></span></div><ul><li>${icon('check')}<span>1 aviso gratis</span></li><li>${icon('check')}<span>Avisos adicionales a $${meta.privateExtraPrice}</span></li><li>${icon('check')}<span>Destacar desde $12</span></li><li>${icon('check')}<span>Sello de título verificado</span></li></ul><a class="btn btn-block" href="#/publicar">Publicar gratis</a></div>
  </div>`;
}

function mockMap() {
  const pins = [[22, 30, '$185k', 1], [48, 22, '$96k'], [64, 48, '$240k', 0, 1], [36, 62, '$72k'], [74, 28, '$1,2k/mes'], [56, 72, '$130k', 1]];
  return `<div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 30%,var(--surface-2),transparent 60%),var(--bg-2)">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><path d="M0 70 C 20 60, 40 80, 60 62 S 90 50, 100 58" stroke="var(--line-2)" fill="none" stroke-width=".6"/><path d="M10 0 C 20 30, 30 40, 26 100" stroke="var(--line)" fill="none" stroke-width="1.4"/><path d="M0 40 L100 34" stroke="var(--line)" stroke-width="1"/><polygon points="30,18 70,16 80,52 50,70 24,50" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width=".5" stroke-dasharray="2 1"/></svg>
    ${pins.map(([x, y, t, v, b]) => `<span class="pm ${v ? 'v' : ''} ${b ? 'b' : ''}" style="position:absolute;left:${x}%;top:${y}%">${t}</span>`).join('')}
  </div>`;
}
function mockAvm() {
  return `<div class="mock"><div class="mock-card"><span class="faint" style="font-size:.8rem">Valor estimado · Altamira · 110 m²</span><span class="money">$118.000 – $134.500</span><div class="meter" style="margin:24px 0 6px"><i style="left:46%"></i><span style="left:46%">Este aviso</span></div><div class="meter-legend"><span>Bajo</span><span>Justo</span><span>Alto</span></div></div><div class="mock-card"><span class="faint" style="font-size:.8rem">Comparables usados</span>${[['Apto. 4 hab.', '$1.265/m²'], ['Apto. 3 hab.', '$1.209/m²'], ['Apto. 5 hab.', '$1.081/m²']].map(([a, b]) => `<div class="row between"><span>${a}</span><span class="mono">${b}</span></div>`).join('')}</div></div>`;
}
function mockDocs() {
  const docs = [['Documento de propiedad', 1], ['Certificado de gravamen', 1], ['Cédula catastral', 1], ['Solvencia municipal', 0]];
  return `<div class="mock"><div class="mock-card"><div class="row between"><b>Expediente digital</b><span class="tag tag-ok">${icon('shield')} Verificado</span></div>${docs.map(([d, ok]) => `<div class="row between" style="font-size:.9rem"><span>${d}</span>${ok ? `<span style="color:var(--trust)">${icon('check')}</span>` : '<span class="faint">opcional</span>'}</div>`).join('')}<div class="mock-bar"><i style="width:82%"></i></div><span class="faint" style="font-size:.78rem">Tracto sucesivo revisado · Registro Público de Chacao</span></div></div>`;
}
function mockEscrow(rate) {
  return `<div class="mock"><div class="mock-card"><span class="faint" style="font-size:.8rem">Pago en escrow</span><span class="money">$12.000</span><span class="faint" style="font-size:.8rem">Arras · se libera al protocolizar en SAREN</span><div class="mock-bar"><i style="width:66%"></i></div><div class="row between" style="font-size:.85rem"><span>Depositado</span><span>Documentos</span><span class="faint">Firma</span></div></div><div class="mock-card"><span class="faint" style="font-size:.8rem">Canon de alquiler · noviembre</span><div class="row between"><span class="money" style="font-size:1.1rem">$650</span><span class="mono faint">≈ Bs. ${(650 * rate).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</span></div><span class="tag tag-ok" style="justify-self:start">Pagado en bolívares a tasa BCV</span></div></div>`;
}
export { price, zoneById };
