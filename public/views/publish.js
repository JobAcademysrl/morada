// Asistente de publicación por pasos, con mapa para ubicar el inmueble, sugerencia de precio y carga de documentos.
import { get, post, patch, mode } from '../api.js';
import { disposeMap, $, $$, esc, icon, toast, modal, readImage, readFileAsDataUrl, store, fmtUsd, formData, price } from '../ui.js';
import { ZONES, zoneById, listingTitle } from '../shared/core.js';

const STEPS = ['Operación', 'Ubicación', 'Características', 'Precio', 'Fotos', 'Documentos', 'Revisar'];

export default async function publish(el, ctx) {
  if (!ctx.requireAuth()) return;
  const { meta } = ctx;
  const editId = ctx.path.startsWith('/editar') ? ctx.params[0] : null;
  await ctx.refreshUser();
  let d;
  if (editId) {
    const r = await get('/api/listings/' + editId);
    if (!r.listing.mine) { el.innerHTML = '<section class="wrap section empty"><h2>No puedes editar este aviso</h2></section>'; return; }
    d = { ...r.listing, docsNew: [] };
  } else {
    d = store.get('draft') || { op: 'venta', type: 'apartamento', zone: '', features: [], payments: ['usd', 'ves'], photos: [], state: 'bueno', rooms: 2, baths: 1, parking: 1 };
    d.docsNew = [];
  }
  let step = 0;
  const quota = ctx.quota;
  const canNetwork = !!ctx.plan?.network;

  if (!editId && quota && quota.remaining === 0) {
    const isPrivate = ['particular', 'comprador'].includes(ctx.user.role);
    el.innerHTML = `<section class="wrap wrap-narrow section"><div class="panel stack"><span class="eyebrow">Límite alcanzado</span><h2>Tienes ${quota.active} de ${quota.limit} avisos activos</h2>
      <p class="muted">${isPrivate ? `Tu primer aviso es gratis. Cada aviso adicional cuesta $${meta.privateExtraPrice} y queda activo hasta que lo marques como vendido o alquilado.` : 'Mejora tu plan para publicar más inmuebles o pausa uno de tus avisos actuales.'}</p>
      <div class="row">${isPrivate ? `<button class="btn btn-primary" id="buy">Comprar 1 aviso por $${meta.privateExtraPrice}</button>` : '<a class="btn btn-primary" href="#/panel/plan">Ver planes</a>'}<a class="btn" href="#/panel/avisos">Gestionar mis avisos</a></div><p class="faint" style="font-size:.82rem">Pago simulado en esta versión.</p></div></section>`;
    $('#buy', el)?.addEventListener('click', async () => { try { await post('/api/me/slots', { qty: 1 }); toast('Aviso adicional disponible.'); await ctx.refreshUser(); ctx.go('#/publicar'); } catch (e) { toast(e.message, 'err'); } });
    return;
  }

  el.innerHTML = `<section class="wrap wrap-narrow" style="padding-block:32px 60px">
    <div class="page-head" style="padding-top:0"><span class="eyebrow">${editId ? 'Editar aviso ' + editId : 'Nuevo aviso'}</span><h1 style="font-size:clamp(1.8rem,4vw,2.6rem)">${editId ? 'Actualiza tu inmueble' : 'Publica tu inmueble'}</h1>
    ${quota && quota.limit != null && !editId ? `<p class="muted">Usarás 1 de tus ${quota.remaining} avisos disponibles.</p>` : ''}</div>
    <div class="steps" id="steps">${STEPS.map((s, i) => `<button data-s="${i}"><span class="mono faint" style="font-size:.72rem">${i + 1}</span>${s}</button>`).join('')}</div>
    <form class="panel stack" id="wiz" novalidate></form>
    <div class="row between" style="margin-top:16px"><button class="btn" id="back">← Atrás</button><button class="btn btn-primary" id="next">Continuar →</button></div>
  </section>`;

  const form = $('#wiz', el);
  let pickMap = null;

  const saveDraft = () => { if (!editId) { const { docsNew, ...rest } = d; store.set('draft', { ...rest, photos: rest.photos.length > 4 ? rest.photos.slice(0, 4) : rest.photos }); } };
  const collect = () => { const v = formData(form); for (const [k, val] of Object.entries(v)) d[k] = val; if (form.querySelector('[data-group="features"]')) d.features = v.features || []; if (form.querySelector('[data-group="payments"]')) d.payments = v.payments || []; };

  const views = [
    () => `<div class="stack"><b>¿Qué quieres hacer?</b><div class="pills">${Object.entries(meta.operations).map(([k, v]) => `<label class="pill"><input type="radio" name="op" value="${k}" ${d.op === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>
      <div class="stack"><b>Tipo de inmueble</b><div class="pills">${Object.entries(meta.types).map(([k, v]) => `<label class="pill"><input type="radio" name="type" value="${k}" ${d.type === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>
      ${ctx.user.role === 'constructora' ? `<div class="form-grid"><label>Proyecto (obra nueva)<input class="input" name="projectName" value="${esc(d.project?.name || '')}" placeholder="Residencias El Parque"></label><label>Unidades<input class="input" type="number" name="projectUnits" value="${esc(d.project?.units || '')}"></label><label>Entrega<input class="input" name="projectDelivery" value="${esc(d.project?.delivery || '')}" placeholder="2027-T4"></label></div>` : ''}`,
    () => `<div class="form-grid"><label>Zona<select class="input" name="zone" id="zone" required><option value="">Elige la zona</option>${meta.cities.map(c => `<optgroup label="${esc(c)}">${ZONES.filter(z => z.city === c).map(z => `<option value="${z.id}" ${d.zone === z.id ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <label>Dirección (calle, edificio)<input class="input" name="address" value="${esc(d.address || '')}" placeholder="Av. Principal, Edif. Los Samanes"></label></div>
      <div class="stack" style="gap:6px"><span class="muted" style="font-size:.88rem">Toca el mapa para fijar la ubicación exacta. Los compradores verán un área aproximada.</span><div class="pick-map" id="pick"></div></div>`,
    () => `<div class="form-grid">
      <label>Superficie (m²) *<input class="input" type="number" min="1" name="area" required value="${esc(d.area || '')}"></label>
      <label>Habitaciones<input class="input" type="number" min="0" name="rooms" value="${esc(d.rooms ?? '')}"></label>
      <label>Baños<input class="input" type="number" min="0" name="baths" value="${esc(d.baths ?? '')}"></label>
      <label>Estacionamientos<input class="input" type="number" min="0" name="parking" value="${esc(d.parking ?? '')}"></label>
      <label>Piso<input class="input" type="number" min="0" name="floor" value="${esc(d.floor ?? '')}"></label>
      <label>Año de construcción<input class="input" type="number" min="1900" max="2030" name="year" value="${esc(d.year ?? '')}"></label>
      <label>Condominio (USD/mes)<input class="input" type="number" min="0" name="condoFee" value="${esc(d.condoFee ?? '')}"></label>
      <label>Estado<select class="input" name="state">${Object.entries(meta.states).map(([k, v]) => `<option value="${k}" ${d.state === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <div class="stack" style="gap:8px"><b>Servicios y equipamiento</b><div class="pills">${Object.entries(meta.features).map(([k, v]) => `<label class="pill"><input type="checkbox" name="features" data-group="features" value="${k}" ${d.features.includes(k) ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>
      <label>Título del aviso<input class="input" name="title" maxlength="90" value="${esc(d.title || '')}" placeholder="Se genera automáticamente si lo dejas vacío"></label>
      <label>Descripción<textarea class="input" name="description" rows="5" placeholder="Cuenta lo que hace especial al inmueble: iluminación, vista, servicios, vecindario.">${esc(d.description || '')}</textarea></label>`,
    () => `<div class="form-grid"><label>Precio en USD${d.op === 'alquiler' ? ' por mes' : ''} *<input class="input" type="number" min="1" name="priceUsd" id="priceUsd" required value="${esc(d.priceUsd || '')}"></label><div class="stack" style="gap:2px;align-self:end"><span class="faint" style="font-size:.85rem">Equivalente a tasa BCV</span><b class="mono" id="ves-eq">—</b></div></div>
      <div class="avm-box" id="avm"><span class="muted">Calculando un precio sugerido con comparables…</span></div>
      <div class="stack" style="gap:8px"><b>Formas de pago que aceptas</b><div class="pills">${Object.entries(meta.payments).map(([k, v]) => `<label class="pill"><input type="checkbox" name="payments" data-group="payments" value="${k}" ${d.payments.includes(k) ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>
      ${d.op === 'alquiler' ? `<p class="muted" style="font-size:.9rem">${icon('doc')} Según la ley de 2026 podrás pedir como máximo 3 meses de depósito (<b class="mono" id="dep">—</b>).</p>` : ''}
      ${canNetwork && d.op === 'venta' ? `<label class="check"><input type="checkbox" name="coBroke" ${d.coBroke ? 'checked' : ''}> Abrir a la red de co-corretaje internacional</label><label>Comisión total del inmueble (%)<input class="input" type="number" step="0.5" min="1" max="10" name="coBrokePct" value="${((d.coBrokeCommission || 0.05) * 100).toFixed(1)}"></label>` : ''}`,
    () => `<div class="dropzone" id="drop" tabindex="0" role="button">${icon('camera')}<b>Arrastra fotos o toca para elegirlas</b><span style="font-size:.85rem">JPG o PNG, hasta 12 fotos. Las reducimos automáticamente para que carguen rápido.</span><input type="file" id="files" accept="image/*" multiple hidden></div>
      <span class="faint" id="photo-count" style="font-size:.85rem"></span>
      <div class="thumbs" id="thumbs"></div>
      <p class="faint" style="font-size:.85rem">Si no subes fotos mostraremos una ilustración del inmueble. Los avisos con fotos reciben más contactos.</p>`,
    () => `<p class="muted">Sube el expediente para obtener el sello <b>Título verificado SAREN</b>. Es confidencial: solo lo ven nuestro equipo legal, quien contrata una due diligence y las agencias de la red.</p>
      <div class="docs-list">${Object.entries(meta.docKinds).map(([k, v]) => { const has = (d.docs || []).some(x => x.kind === k) || d.docsNew.some(x => x.kind === k); return `<div class="doc-row"><span>${icon('doc')} ${v}${['titulo', 'gravamen'].includes(k) ? ' <span class="faint">(obligatorio para el sello)</span>' : ''}</span><label class="btn btn-sm" style="cursor:pointer">${has ? `${icon('check')} Cargado` : 'Subir'}<input type="file" data-doc="${k}" accept="application/pdf,image/*" hidden></label></div>`; }).join('')}</div>
      <p class="faint" style="font-size:.85rem">Puedes publicar ahora y subir los documentos después desde tu panel.</p>`,
    () => {
      const z = zoneById(d.zone);
      const t = d.title || (z ? listingTitle({ ...d, area: Number(d.area), rooms: Number(d.rooms) }) : '');
      return `<div class="grid grid-2" style="align-items:start"><div class="stack"><span class="eyebrow">Vista previa</span><h3>${esc(t)}</h3><p class="muted">${esc(d.address || '')}${z ? ` · ${esc(z.name)}, ${esc(z.city)}` : ''}</p><div class="big-price">${d.priceUsd ? price(Number(d.priceUsd), { op: d.op }) : ''}</div><p class="muted">${d.area || '—'} m² · ${d.rooms || 0} hab. · ${d.baths || 0} baños · ${d.parking || 0} puestos</p></div>
        <div class="stack"><div class="doc-row"><span>Fotos</span><b>${d.photos.length || 'Ilustración'}</b></div><div class="doc-row"><span>Documentos nuevos</span><b>${d.docsNew.length}</b></div><div class="doc-row"><span>Pagos aceptados</span><b>${d.payments.length}</b></div>
        <label class="check"><input type="checkbox" name="paused" ${d.status === 'paused' ? 'checked' : ''}> Guardar como pausado (no visible)</label></div></div>`;
    },
  ];

  function paint() {
    form.innerHTML = views[step]();
    $$('#steps button', el).forEach((b, i) => { b.classList.toggle('on', i === step); b.classList.toggle('done', i < step); });
    $('#back', el).style.visibility = step ? 'visible' : 'hidden';
    $('#next', el).innerHTML = step === STEPS.length - 1 ? `${icon('check')} ${editId ? 'Guardar cambios' : 'Publicar aviso'}` : 'Continuar →';
    disposeMap(pickMap); pickMap = null;
    if (step === 1) mountMap();
    if (step === 3) mountPrice();
    if (step === 4) mountPhotos();
    if (step === 5) mountDocs();
    $('input,select,textarea', form)?.focus({ preventScroll: true });
  }

  function validate() {
    collect();
    if (step === 1 && !d.zone) return 'Elige la zona del inmueble.';
    if (step === 2 && !(Number(d.area) > 0)) return 'Indica la superficie en m².';
    if (step === 3 && !(Number(d.priceUsd) > 0)) return 'Indica el precio en USD.';
    return null;
  }

  function mountMap() {
    const L = window.L;
    const z = zoneById(d.zone);
    pickMap = L.map($('#pick', form)).setView(d.lat ? [d.lat, d.lng] : z ? [z.lat, z.lng] : [10.49, -66.85], z || d.lat ? 15 : 11);
    if (mode.server) L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO' }).addTo(pickMap);
    else ZONES.forEach(zz => L.marker([zz.lat, zz.lng], { interactive: false, icon: L.divIcon({ className: '', html: `<span class="zone-label">${esc(zz.name)}</span>`, iconSize: [0, 0] }) }).addTo(pickMap));
    let pin = null;
    const place = (lat, lng) => { d.lat = Math.round(lat * 1e5) / 1e5; d.lng = Math.round(lng * 1e5) / 1e5; pin ? pin.setLatLng([lat, lng]) : (pin = L.marker([lat, lng], { icon: L.divIcon({ className: 'pm-wrap', html: '<span class="pm b">Aquí</span>', iconSize: [0, 0] }) }).addTo(pickMap)); };
    if (d.lat) place(d.lat, d.lng);
    pickMap.on('click', e => place(e.latlng.lat, e.latlng.lng));
    $('#zone', form).addEventListener('change', e => { const zz = zoneById(e.target.value); if (zz) { pickMap.setView([zz.lat, zz.lng], 15); place(zz.lat, zz.lng); } });
    setTimeout(() => pickMap?.invalidateSize(), 60);
  }

  function mountPrice() {
    const inp = $('#priceUsd', form);
    const upd = () => { const v = Number(inp.value) || 0; $('#ves-eq', form).textContent = v ? 'Bs. ' + (v * meta.rate).toLocaleString('es-VE', { maximumFractionDigits: 0 }) : '—'; const dep = $('#dep', form); if (dep) dep.textContent = fmtUsd(v * 3); };
    inp.addEventListener('input', upd); upd();
    post('/api/valuation', { zone: d.zone, op: d.op, type: d.type, area: d.area, state: d.state, features: d.features, parking: d.parking }).then(r => {
      const box = $('#avm', form);
      if (!box) return;
      const est = d.op === 'alquiler' ? r.estimate : r.estimate;
      box.innerHTML = `<b>Precio sugerido: ${fmtUsd(r.low)} – ${fmtUsd(r.high)}${d.op === 'alquiler' ? ' al mes' : ''}</b><span class="muted" style="font-size:.88rem">Basado en ${r.comps.length || 'los precios base de'} ${r.comps.length ? 'comparables' : 'la zona'} · confianza ${r.confidence} · ${fmtUsd(r.ppm2)}/m²</span><button type="button" class="btn btn-sm btn-trust" style="justify-self:start" id="use-avm">Usar ${fmtUsd(est)}</button>`;
      $('#use-avm', form).addEventListener('click', () => { inp.value = Math.round(est / (d.op === 'alquiler' ? 10 : 1000)) * (d.op === 'alquiler' ? 10 : 1000); upd(); });
    }).catch(() => { const box = $('#avm', form); if (box) box.hidden = true; });
  }

  function mountPhotos() {
    const thumbs = $('#thumbs', form), input = $('#files', form), drop = $('#drop', form);
    // Miniaturas: arrastrar para ordenar, flechas para mover y estrella para elegir la portada.
    const move = (from, to) => { if (to < 0 || to >= d.photos.length || from === to) return; const [p] = d.photos.splice(from, 1); d.photos.splice(to, 0, p); paintThumbs(); saveDraft(); };
    const paintThumbs = () => {
      thumbs.innerHTML = d.photos.map((p, i) => `<figure draggable="true" data-i="${i}" class="${i === 0 ? 'cover' : ''}"><img src="${p}" alt="Foto ${i + 1}" draggable="false">
        <button type="button" class="icon-btn" data-rm="${i}" aria-label="Quitar foto ${i + 1}">${icon('x')}</button>
        <div class="thumb-cover">${i === 0 ? '<span class="chip chip-gold">Portada</span>' : `<button type="button" class="chip" data-cover="${i}">${icon('star')} Portada</button>`}</div>
        <div class="thumb-bar"><span class="row" style="gap:4px"><button type="button" class="chip" data-mv="${i}" data-to="${i - 1}" aria-label="Mover a la izquierda" ${i === 0 ? 'disabled' : ''}>‹</button><button type="button" class="chip" data-mv="${i}" data-to="${i + 1}" aria-label="Mover a la derecha" ${i === d.photos.length - 1 ? 'disabled' : ''}>›</button></span></div></figure>`).join('');
      $('#photo-count', form).textContent = d.photos.length ? `${d.photos.length} de 12 fotos · arrastra para ordenar` : '';
      $$('[data-rm]', thumbs).forEach(b => b.addEventListener('click', () => { d.photos.splice(Number(b.dataset.rm), 1); paintThumbs(); saveDraft(); }));
      $$('[data-cover]', thumbs).forEach(b => b.addEventListener('click', () => move(Number(b.dataset.cover), 0)));
      $$('[data-mv]', thumbs).forEach(b => b.addEventListener('click', () => move(Number(b.dataset.mv), Number(b.dataset.to))));
      $$('figure', thumbs).forEach(f => {
        f.addEventListener('dragstart', e => { e.dataTransfer.setData('text/x-photo', f.dataset.i); f.classList.add('dragging'); });
        f.addEventListener('dragend', () => f.classList.remove('dragging'));
        f.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/x-photo')) { e.preventDefault(); f.classList.add('over'); } });
        f.addEventListener('dragleave', () => f.classList.remove('over'));
        f.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); f.classList.remove('over'); const from = e.dataTransfer.getData('text/x-photo'); if (from !== '') move(Number(from), Number(f.dataset.i)); });
      });
    };
    const add = async files => {
      const list = [...files].filter(f => f.type.startsWith('image/'));
      if (list.length > 12 - d.photos.length) toast(`Solo caben 12 fotos: agregamos las primeras ${Math.max(0, 12 - d.photos.length)}.`, 'err');
      drop.classList.add('busy');
      for (const f of list.slice(0, 12 - d.photos.length)) {
        if (!f.type.startsWith('image/')) continue;
        try { d.photos.push(await readImage(f, mode.server ? 1600 : 900, mode.server ? 0.82 : 0.7)); } catch { toast('No pudimos leer ' + f.name, 'err'); }
      }
      drop.classList.remove('busy');
      input.value = '';
      paintThumbs(); saveDraft();
    };
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', e => (e.key === 'Enter' || e.key === ' ') && input.click());
    input.addEventListener('change', () => add(input.files));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); add(e.dataTransfer.files); });
    paintThumbs();
  }

  function mountDocs() {
    $$('[data-doc]', form).forEach(inp => inp.addEventListener('change', async () => {
      const f = inp.files[0];
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) { toast('El archivo supera 8 MB.', 'err'); return; }
      const dataUrl = f.type.startsWith('image/') ? await readImage(f, 1600, 0.8) : await readFileAsDataUrl(f);
      d.docsNew = d.docsNew.filter(x => x.kind !== inp.dataset.doc);
      d.docsNew.push({ kind: inp.dataset.doc, name: f.name, dataUrl: mode.server ? dataUrl : null });
      inp.parentElement.firstChild.replaceWith(document.createRange().createContextualFragment(`${icon('check')} Cargado`));
    }));
  }

  async function submit() {
    collect();
    const body = {
      op: d.op, type: d.type, zone: d.zone, address: d.address, lat: d.lat, lng: d.lng, priceUsd: Number(d.priceUsd), area: Number(d.area),
      rooms: d.rooms, baths: d.baths, parking: d.parking, floor: d.floor, year: d.year, condoFee: d.condoFee, state: d.state,
      features: d.features, payments: d.payments, title: d.title, description: d.description, photos: d.photos,
      coBroke: !!d.coBroke, coBrokeCommission: d.coBrokePct ? Number(d.coBrokePct) / 100 : d.coBrokeCommission,
      status: d.paused ? 'paused' : 'active',
      project: ctx.user.role === 'constructora' && d.projectName ? { name: d.projectName, units: d.projectUnits, delivery: d.projectDelivery } : d.project || null,
    };
    const btn = $('#next', el);
    btn.disabled = true;
    try {
      const r = editId ? await patch('/api/listings/' + editId, body) : await post('/api/listings', body);
      if (d.docsNew.length) await post(`/api/listings/${r.listing.id}/documents`, { docs: d.docsNew });
      if (!editId) store.del('draft');
      toast(editId ? 'Cambios guardados.' : 'Aviso publicado.');
      await ctx.refreshUser();
      if (!editId) {
        modal(`<span class="eyebrow">Publicado · ${r.listing.id}</span><h3>Tu aviso ya está en línea</h3><p class="muted">${d.docsNew.length ? 'El expediente pasó a revisión legal. Te avisaremos cuando tenga el sello.' : 'Sube el documento de propiedad y el gravamen para obtener el sello de título verificado.'}</p><div class="row"><a class="btn btn-primary" href="#/inmueble/${r.listing.id}" data-close>Ver el aviso</a><a class="btn" href="#/panel/avisos" data-close>Ir a mis avisos</a></div>`);
      }
      ctx.go('#/inmueble/' + r.listing.id);
    } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
  }

  $('#next', el).addEventListener('click', () => {
    const err = validate();
    if (err) { toast(err, 'err'); return; }
    saveDraft();
    if (step === STEPS.length - 1) submit(); else { step++; paint(); scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  $('#back', el).addEventListener('click', () => { collect(); step = Math.max(0, step - 1); paint(); });
  $$('#steps button', el).forEach(b => b.addEventListener('click', () => { const t = Number(b.dataset.s); if (t > step) { const err = validate(); if (err) { toast(err, 'err'); return; } } else collect(); step = t; paint(); }));
  form.addEventListener('submit', e => e.preventDefault());
  paint();
  return () => disposeMap(pickMap);
}
