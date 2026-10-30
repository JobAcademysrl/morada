// Ficha del inmueble: galería, precio bivaluta, indicador frente a la zona, contacto y servicios.
import { get, post } from '../api.js';
import { disposeMap, $, $$, esc, icon, card, price, toast, modal, photoOf, photoCount, featureList, typeName, fmtDate, formData, priceText } from '../ui.js';
import { zoneById, fmtUsd, fmtVes, usdToVes, rentalTerms, loanPayment, LAW, STATES, PAYMENTS, DOC_KINDS, DILIGENCE, BOOSTS, referralSplit } from '../shared/core.js';

export default async function listing(el, ctx) {
  const id = ctx.params[0];
  const { listing: l, zoneStats, avm, similar, canSeeDocs } = await get('/api/listings/' + id);
  const z = zoneById(l.zone);
  const rate = ctx.meta.rate;
  const n = photoCount(l);
  const isRent = l.op === 'alquiler';
  const u = ctx.user;
  const ownerName = l.owner?.name || 'Anunciante';
  const waText = encodeURIComponent(`Hola, vi en Morada el aviso "${l.title}" (${l.id}) y me interesa. ¿Sigue disponible?`);
  const ratio = l.indicator?.ratio || 1;
  const meterPos = Math.max(4, Math.min(96, 50 + (ratio - 1) * 160));
  const terms = isRent ? rentalTerms(l.priceUsd, rate) : null;

  el.innerHTML = `
  <div class="wrap" style="padding-block:24px 0">
    <div class="row between" style="margin-bottom:14px">
      <a class="btn btn-sm btn-ghost" href="#/buscar?op=${l.op}&zone=${l.zone}">← ${isRent ? 'Alquileres' : 'Ventas'} en ${esc(z?.name || l.city)}</a>
      <div class="row" style="gap:8px">
        <button class="btn btn-sm" id="share">${icon('share')} Compartir</button>
        <button class="btn btn-sm fav-inline ${l.favorite ? 'on' : ''}" data-fav="${l.id}" aria-pressed="${!!l.favorite}">${icon('heart')} Guardar</button>
      </div>
    </div>
    <div class="gallery rv">${Array.from({ length: Math.min(5, n) }, (_, i) => `<button data-ph="${i}" aria-label="Ver foto ${i + 1}"><img src="${photoOf(l, i)}" alt="" ${i ? 'loading="lazy"' : ''}>${i === 4 && n > 5 ? `<span class="more">+${n - 5} fotos</span>` : ''}</button>`).join('')}</div>
  </div>

  <div class="wrap section" style="padding-top:28px">
    <div class="detail">
      <div class="stack" style="gap:28px;min-width:0">
        <div class="stack" style="gap:10px">
          <div class="row" style="gap:8px">
            <span class="tag">${isRent ? 'Alquiler' : 'Venta'}</span><span class="tag">${typeName(l.type)}</span>
            ${l.verification === 'verified' ? `<span class="tag tag-ok">${icon('shield')} Título verificado SAREN</span>` : l.verification === 'pending' ? '<span class="tag tag-warn">Expediente en revisión</span>' : ''}
            ${l.project ? `<span class="tag tag-warn">Obra nueva · entrega ${esc(l.project.delivery)}</span>` : ''}
            ${l.boosted ? '<span class="tag tag-warn">Destacado</span>' : ''}
          </div>
          <h1 style="font-size:clamp(1.8rem,4vw,2.8rem)">${esc(l.title)}</h1>
          <p class="muted">${icon('pin')} ${esc(l.address)}, ${esc(l.city)}</p>
        </div>

        <div class="facts rv">
          <div><span>Superficie</span><b>${l.area} m²</b></div>
          ${l.rooms ? `<div><span>Habitaciones</span><b>${l.rooms}</b></div>` : ''}
          ${l.baths ? `<div><span>Baños</span><b>${l.baths}</b></div>` : ''}
          <div><span>Estacionamientos</span><b>${l.parking || 0}</b></div>
          ${l.floor ? `<div><span>Piso</span><b>${l.floor}</b></div>` : ''}
          <div><span>Estado</span><b style="font-family:var(--body)">${STATES[l.state] || '—'}</b></div>
          ${l.year ? `<div><span>Año</span><b>${l.year}</b></div>` : ''}
          ${l.condoFee ? `<div><span>Condominio</span><b>${fmtUsd(l.condoFee)}/mes</b></div>` : ''}
          <div><span>Precio por m²</span><b>${fmtUsd(l.ppm2)}</b></div>
          <div><span>Código</span><b>${l.id}</b></div>
        </div>

        <div class="stack rv"><h3>Descripción</h3><p style="white-space:pre-line;max-width:70ch">${esc(l.description || 'El anunciante no agregó una descripción.')}</p>
          ${l.project ? `<p class="muted">Proyecto <b>${esc(l.project.name)}</b>: ${l.project.units} unidades, entrega prevista ${esc(l.project.delivery)}.</p>` : ''}
        </div>

        ${featureList(l).length ? `<div class="stack rv"><h3>Servicios y equipamiento</h3><div class="feat-list">${featureList(l).map(f => `<span class="tag">${icon('check')} ${f}</span>`).join('')}</div></div>` : ''}

        <div class="stack rv"><h3>Formas de pago aceptadas</h3><div class="feat-list">${l.payments.map(p => `<span class="tag">${icon('wallet')} ${PAYMENTS[p]}</span>`).join('')}</div></div>

        <div class="panel rv stack">
          <div class="row between"><h3>¿Es un buen precio?</h3>${avm ? `<span class="tag">Confianza ${avm.confidence}</span>` : ''}</div>
          ${zoneStats ? `<p class="muted">Mediana de ${isRent ? 'alquiler' : 'venta'} en ${esc(z.name)}: <b class="mono">${fmtUsd(zoneStats.median)}/m²${isRent ? ' al mes' : ''}</b> sobre ${zoneStats.count} avisos. Este inmueble: <b class="mono">${fmtUsd(l.ppm2)}/m²</b>.</p>
          <div class="meter"><i style="left:${meterPos}%"></i><span style="left:${meterPos}%">${Math.round((ratio - 1) * 100) > 0 ? '+' : ''}${Math.round((ratio - 1) * 100)} %</span></div>
          <div class="meter-legend"><span>Bajo la media</span><span>En línea</span><span>Sobre la media</span></div>` : '<p class="muted">Aún no hay suficientes avisos en la zona para comparar.</p>'}
          ${avm ? `<p class="muted">Valor estimado por comparables: <b class="mono">${fmtUsd(avm.low)} – ${fmtUsd(avm.high)}</b>${isRent ? ' al mes' : ''}.</p>` : ''}
        </div>

        ${isRent ? `<div class="panel rv stack">
          <span class="eyebrow">Ley de arrendamiento 2026</span><h3>Lo que establece la ley para este alquiler</h3>
          <div class="form-grid">
            <div class="stack" style="gap:2px"><span class="faint">Canon en bolívares hoy</span><b class="mono">${fmtVes(terms.rentVes)}</b></div>
            <div class="stack" style="gap:2px"><span class="faint">Depósito máximo (3 meses)</span><b class="mono">${fmtUsd(terms.maxDepositUsd)}</b></div>
            <div class="stack" style="gap:2px"><span class="faint">Reparaciones a cargo del inquilino</span><b class="mono">hasta ${fmtUsd(terms.tenantMaintenanceCapUsd)}</b></div>
          </div>
          <p class="muted" style="font-size:.9rem">Puedes pagar en dólares o en bolívares a la tasa BCV del día del pago (Art. 14). Tras 2 años como inquilino solvente tienes preferencia para comprar (Art. 22). <a href="#/ley-2026">Leer la guía completa</a></p>
        </div>` : `<div class="panel rv stack" id="fin">
          <span class="eyebrow">Financiamiento</span><h3>Simula un préstamo puente en divisas</h3>
          <p class="muted" style="font-size:.92rem">En Venezuela no hay hipoteca bancaria accesible y los bancos europeos no inscriben hipotecas en el SAREN. Los fondos de deuda privada ofrecen préstamos de 3 a 5 años entre 9 % y 13 % anual en dólares.</p>
          <div class="form-grid">
            <label>Entrada (%)<input class="input" id="fin-down" type="range" min="20" max="80" step="5" value="40"><span class="mono" id="fin-down-v"></span></label>
            <label>Tasa anual<select class="input" id="fin-rate">${[9, 10, 11, 12, 13].map(r => `<option ${r === 11 ? 'selected' : ''} value="${r}">${r} %</option>`).join('')}</select></label>
            <label>Plazo<select class="input" id="fin-years">${[3, 4, 5].map(y => `<option ${y === 5 ? 'selected' : ''} value="${y}">${y} años</option>`).join('')}</select></label>
          </div>
          <div class="row between"><div class="stack" style="gap:2px"><span class="faint">Cuota mensual estimada</span><span class="result-big" id="fin-out"></span></div><div class="stack" style="gap:2px;text-align:right"><span class="faint">Monto financiado</span><b class="mono" id="fin-loan"></b></div></div>
        </div>`}

        <div class="panel rv stack">
          <div class="row between"><h3>Expediente legal</h3>${l.verification === 'verified' ? `<span class="tag tag-ok">${icon('shield')} Verificado</span>` : ''}</div>
          ${l.docs && l.docs.length ? `<div class="docs-list">${l.docs.map(d => `<div class="doc-row"><span>${icon('doc')} ${esc(DOC_KINDS[d.kind] || d.kind)}</span>${canSeeDocs && d.url ? `<a class="btn btn-sm" href="${esc(d.url)}" target="_blank" rel="noopener">Ver</a>` : canSeeDocs ? `<span class="faint">${esc(d.name || '')}</span>` : `<span class="faint">${icon('key')} Confidencial</span>`}</div>`).join('')}</div>` : '<p class="muted">El anunciante aún no cargó documentos.</p>'}
          ${l.verificationNote ? `<p class="faint" style="font-size:.88rem">${esc(l.verificationNote)}</p>` : ''}
          ${!canSeeDocs ? `<p class="muted" style="font-size:.92rem">El expediente es visible para quien contrata una due diligence o para agencias de la red Pro Max.</p>` : ''}
          <div class="grid grid-3" style="gap:10px">${Object.values(DILIGENCE).map(p => `<button class="btn" data-dd="${p.id}" style="height:auto;padding:12px;display:grid;justify-items:start;gap:4px;white-space:normal;text-align:left;border-radius:14px"><b>${p.name} · $${p.price}</b><span class="faint" style="font-size:.8rem;font-weight:400">${p.items.slice(0, 2).join(', ')}${p.items.length > 2 ? '…' : ''}</span></button>`).join('')}</div>
        </div>

        <div class="stack rv"><h3>Ubicación</h3><div class="mini-map" id="mini-map"></div><p class="faint" style="font-size:.85rem">La ubicación exacta se comparte al agendar la visita.</p></div>
      </div>

      <aside class="detail-aside">
        <div class="panel panel-solid stack">
          <div class="big-price">${price(l.priceUsd, { op: l.op })}</div>
          ${l.indicator ? `<span class="ind ind-${l.indicator.label}" style="justify-self:start">${{ bajo: 'Bajo la media de la zona', justo: 'En línea con la zona', alto: 'Sobre la media de la zona' }[l.indicator.label]}</span>` : ''}
          <hr class="divider">
          <div class="owner-card"><span class="avatar">${esc(ownerName[0])}</span><div class="stack" style="gap:2px;min-width:0"><b>${esc(ownerName)}</b><span class="faint" style="font-size:.85rem">${esc(ctx.meta.roles[l.owner?.role] || '')}${l.owner?.civ ? ` · ${esc(l.owner.civ)}` : ''}</span>${l.owner?.badge ? `<span class="tag tag-ok" style="justify-self:start">${icon('shield')} Agencia verificada</span>` : ''}</div></div>
          ${l.mine ? `<div class="stack" style="gap:8px"><a class="btn btn-primary btn-block" href="#/editar/${l.id}">Editar aviso</a><button class="btn btn-block" id="boost">${icon('bolt')} Dar visibilidad</button><a class="btn btn-block" href="#/panel/avisos">Ver estadísticas</a><p class="faint" style="font-size:.85rem">${l.views} visitas · ${l.contacts} contactos</p></div>` : `
          <form class="stack" id="lead" style="gap:10px">
            <div class="seg" role="group"><button type="button" class="on" data-kind="info">Pedir información</button><button type="button" data-kind="visita">Agendar visita</button></div>
            <input class="input" name="name" placeholder="Nombre" required value="${esc(u?.name || '')}" aria-label="Nombre">
            <input class="input" name="email" type="email" placeholder="Correo" value="${esc(u?.email || '')}" aria-label="Correo">
            <input class="input" name="phone" type="tel" placeholder="Teléfono / WhatsApp" value="${esc(u?.phone || '')}" aria-label="Teléfono">
            <input class="input" name="visitDate" type="datetime-local" hidden aria-label="Fecha de la visita">
            <textarea class="input" name="message" rows="3" aria-label="Mensaje">Hola, me interesa este inmueble (${l.id}). ¿Sigue disponible?</textarea>
            <details><summary class="muted" style="cursor:pointer;font-size:.9rem">Precalificarme (respuesta más rápida)</summary>
              <div class="stack" style="gap:10px;margin-top:10px">
                <label>Ingreso mensual (USD)<select class="input" name="income"><option value="">Prefiero no decir</option><option>0-1000</option><option>1000-2000</option><option>2000-4000</option><option>4000+</option></select></label>
                <label>¿Cuándo quieres ${isRent ? 'mudarte' : 'comprar'}?<select class="input" name="timeline"><option value="1m">Este mes</option><option value="3m">En 3 meses</option><option value="6m">En 6 meses o más</option></select></label>
                <label class="check"><input type="checkbox" name="usdFunds"> Tengo los fondos en divisas disponibles</label>
              </div>
            </details>
            <button class="btn btn-primary btn-block">${icon('chat')} Enviar mensaje</button>
          </form>
          <div class="row" style="gap:8px">
            ${l.owner?.phone ? `<a class="btn btn-trust" style="flex:1" target="_blank" rel="noopener" href="https://wa.me/${l.owner.phone.replace(/\D/g, '')}?text=${waText}">WhatsApp</a><button class="btn" style="flex:1" id="show-phone">${icon('phone')} Ver teléfono</button>` : ''}
          </div>
          ${u && ctx.plan?.network && l.coBroke ? `<button class="btn btn-block" id="refer">${icon('globe')} Referir comprador (co-corretaje)</button>` : ''}`}
        </div>
        <div class="panel stack" style="gap:8px"><b>${icon('shield')} Compra protegida</b><p class="muted" style="font-size:.9rem">Si compras desde el exterior, deposita las arras en escrow. Se liberan al vendedor solo cuando el documento queda protocolizado en el SAREN.</p><a href="#/inversores" class="btn btn-sm">Cómo funciona</a></div>
      </aside>
    </div>
  </div>

  ${similar.length ? `<section class="wrap section" style="padding-top:0"><div class="section-head"><h2>Similares en ${esc(z?.name || '')}</h2></div><div class="grid grid-4">${similar.map(s => `<div class="rv">${card(s)}</div>`).join('')}</div></section>` : ''}`;

  /* Galería y visor */
  $$('[data-ph]', el).forEach(b => b.addEventListener('click', () => lightbox(l, Number(b.dataset.ph))));

  /* Mini mapa */
  const L = window.L;
  const mm = L.map($('#mini-map', el), { scrollWheelZoom: false, zoomControl: true }).setView([l.lat, l.lng], 15);
  if (ctx.meta && (await import('../api.js')).mode.server) {
    const light = (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')) === 'light';
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/${light ? 'light_all' : 'dark_all'}/{z}/{x}/{y}{r}.png`, { subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO' }).addTo(mm);
  }
  L.circle([l.lat, l.lng], { radius: 260, color: '#f4a640', weight: 2, fillOpacity: 0.18 }).addTo(mm);
  L.marker([l.lat, l.lng], { icon: L.divIcon({ className: 'pm-wrap', html: `<span class="pm b">${esc(z?.name || '')}</span>`, iconSize: [0, 0] }) }).addTo(mm);

  /* Financiamiento */
  if (!isRent) {
    const calc = () => {
      const down = Number($('#fin-down', el).value) / 100;
      const loan = l.priceUsd * (1 - down);
      const pay = loanPayment(loan, Number($('#fin-rate', el).value) / 100, Number($('#fin-years', el).value));
      $('#fin-down-v', el).textContent = `${Math.round(down * 100)} % · ${fmtUsd(l.priceUsd * down)}`;
      $('#fin-out', el).textContent = priceText(pay);
      $('#fin-loan', el).textContent = fmtUsd(loan);
    };
    ['#fin-down', '#fin-rate', '#fin-years'].forEach(s => $(s, el).addEventListener('input', calc));
    calc();
  }

  /* Contacto */
  const form = $('#lead', el);
  if (form) {
    let kind = 'info';
    $$('[data-kind]', form).forEach(b => b.addEventListener('click', () => { kind = b.dataset.kind; $$('[data-kind]', form).forEach(x => x.classList.toggle('on', x === b)); form.visitDate.hidden = kind !== 'visita'; }));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const d = formData(form);
      if (kind === 'visita' && !d.visitDate) { toast('Elige fecha y hora para la visita.', 'err'); return; }
      try {
        await post(`/api/listings/${l.id}/leads`, { name: d.name, email: d.email, phone: d.phone, message: d.message, kind, visitDate: d.visitDate, prequal: d.income || d.usdFunds ? { income: d.income, usdFunds: d.usdFunds, timeline: d.timeline } : null });
        form.innerHTML = `<div class="stack" style="text-align:center;justify-items:center;padding:12px 0"><span class="avatar" style="background:var(--trust)">${icon('check')}</span><b>${kind === 'visita' ? 'Solicitud de visita enviada' : 'Mensaje enviado'}</b><p class="muted" style="font-size:.9rem">${esc(ownerName)} recibió tus datos y te contactará. Puedes escribirle también por WhatsApp.</p></div>`;
      } catch (err) { toast(err.message, 'err'); }
    });
  }
  $('#show-phone', el)?.addEventListener('click', e => { e.currentTarget.outerHTML = `<span class="btn mono" style="flex:1;user-select:all">${esc(l.owner.phone)}</span>`; });

  $('#share', el).addEventListener('click', async () => {
    const url = location.href;
    try { await navigator.clipboard.writeText(url); toast('Enlace copiado.'); }
    catch { modal(`<h3>Compartir</h3><input class="input" readonly value="${esc(url)}" onfocus="this.select()">`); }
  });

  /* Due diligence */
  $$('[data-dd]', el).forEach(b => b.addEventListener('click', () => {
    const p = DILIGENCE[b.dataset.dd];
    modal(`<span class="eyebrow">Due diligence notarial</span><h3>Paquete ${p.name} · $${p.price}</h3><ul class="stack" style="padding-left:18px;margin:0;gap:6px">${p.items.map(i => `<li>${i}</li>`).join('')}</ul><p class="muted" style="font-size:.9rem">Un abogado acreditado revisa el expediente en el Registro Público de ${esc(z?.name || l.city)} y te entrega un informe en 5 a 10 días hábiles. Al contratarlo tendrás acceso al expediente digital del inmueble.</p><p class="faint" style="font-size:.82rem">Pago simulado en esta versión.</p><button class="btn btn-primary" id="dd-go">Contratar por $${p.price}</button>`, {
      onMount(body, close) {
        $('#dd-go', body).addEventListener('click', async () => {
          if (!ctx.requireAuth()) { close(); return; }
          try { await post('/api/diligence', { listingId: l.id, package: p.id }); close(); toast('Due diligence contratada. Sigue el avance en tu panel.'); ctx.go(location.hash); }
          catch (err) { toast(err.message, 'err'); }
        });
      },
    });
  }));

  /* Visibilidad para el anunciante */
  $('#boost', el)?.addEventListener('click', () => boostModal(l, ctx));

  /* Co-corretaje */
  $('#refer', el)?.addEventListener('click', () => {
    const commission = l.priceUsd * (l.coBrokeCommission || 0.05);
    modal(`<span class="eyebrow">Broker-to-Broker Referral Agreement</span><h3>Referir un comprador</h3>
      <p class="muted" style="font-size:.92rem">Comisión del inmueble: ${Math.round((l.coBrokeCommission || 0.05) * 100)} % (${fmtUsd(commission)}). Elige la parte que corresponde a tu agencia (20 % a 40 %).</p>
      <form id="ref" class="stack"><label>Nombre del comprador<input class="input" name="buyerName" required></label><label>País de residencia<input class="input" name="buyerCountry" placeholder="España, Estados Unidos, Italia…"></label>
      <label>Tu parte de la comisión: <b id="sp-v">30 %</b><input class="input" type="range" name="split" min="20" max="40" step="5" value="30"></label>
      <div class="panel" id="sp-eco" style="font-size:.9rem"></div><button class="btn btn-primary">Proponer acuerdo</button></form>`, {
      onMount(body, close) {
        const f = $('#ref', body);
        const paint = () => { const s = Number(f.split.value) / 100; const e = referralSplit(commission, s); $('#sp-v', body).textContent = `${f.split.value} %`; $('#sp-eco', body).innerHTML = `<div class="row between"><span>Tu agencia recibe</span><b class="mono">${fmtUsd(e.referrer)}</b></div><div class="row between"><span>Agencia del inmueble</span><b class="mono">${fmtUsd(e.listingAgent)}</b></div><div class="row between faint"><span>Tarifa de la plataforma</span><span class="mono">${fmtUsd(e.platform)}</span></div>`; };
        f.split.addEventListener('input', paint); paint();
        f.addEventListener('submit', async e => { e.preventDefault(); try { await post('/api/network/referrals', { listingId: l.id, buyerName: f.buyerName.value, buyerCountry: f.buyerCountry.value, split: Number(f.split.value) / 100 }); close(); toast('Acuerdo propuesto. La agencia lo verá en su panel.'); } catch (err) { toast(err.message, 'err'); } });
      },
    });
  });

  return () => disposeMap(mm);
}

export function boostModal(l, ctx, after) {
  modal(`<span class="eyebrow">Visibilidad</span><h3>Destaca “${esc(l.title)}”</h3>
    <div class="stack" style="gap:10px">${Object.values(BOOSTS).map(b => `<button class="btn" data-b="${b.id}" style="height:auto;padding:14px 16px;justify-content:space-between;border-radius:14px;white-space:normal;text-align:left"><span class="stack" style="gap:2px"><b>${b.name} · ${b.days} días</b><span class="faint" style="font-weight:400;font-size:.85rem">${b.desc}</span></span><b class="mono">$${b.price}</b></button>`).join('')}</div>
    <p class="faint" style="font-size:.82rem">Los planes profesionales incluyen destacados sin costo. Pago simulado en esta versión.</p>`, {
    onMount(body, close) {
      $$('[data-b]', body).forEach(b => b.addEventListener('click', async () => {
        try { const r = await post(`/api/listings/${l.id}/boost`, { kind: b.dataset.b }); close(); toast(r.includedInPlan ? 'Destacado activado (incluido en tu plan).' : `Destacado activado. Cargo: $${r.charged}.`); after ? after() : ctx.go(location.hash); }
        catch (err) { toast(err.message, 'err'); }
      }));
    },
  });
}

function lightbox(l, start) {
  const n = photoCount(l);
  let i = start;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = `<button class="icon-btn lb-x" aria-label="Cerrar">${icon('x')}</button><button class="icon-btn lb-prev" aria-label="Anterior">‹</button><img alt=""><button class="icon-btn lb-next" aria-label="Siguiente">›</button>`;
  const img = box.querySelector('img');
  const show = () => { img.src = photoOf(l, i); };
  const close = () => { box.remove(); document.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') { i = (i + 1) % n; show(); } if (e.key === 'ArrowLeft') { i = (i - 1 + n) % n; show(); } };
  box.querySelector('.lb-x').onclick = close;
  box.querySelector('.lb-prev').onclick = () => { i = (i - 1 + n) % n; show(); };
  box.querySelector('.lb-next').onclick = () => { i = (i + 1) % n; show(); };
  box.addEventListener('click', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', key);
  document.body.append(box); show();
}
export { usdToVes, fmtDate };
