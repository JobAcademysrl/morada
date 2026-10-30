// Búsqueda: lista + mapa sincronizados, filtros facetados, dibujo de zona y búsquedas guardadas.
import { get, post, mode } from '../api.js';
import { disposeMap, $, $$, esc, icon, card, toast, modal, shortUsd, reveal, tilt, priceText, currency } from '../ui.js';
import { ZONES, zoneById, usdToVes } from '../shared/core.js';
import { VENEZUELA } from '../vendor/venezuela.js';

const FILTER_KEYS = ['op', 'type', 'city', 'zone', 'q', 'pmin', 'pmax', 'amin', 'amax', 'rooms', 'baths', 'fmin', 'state', 'features', 'payments', 'verified', 'parking', 'project', 'sort', 'bbox', 'poly', 'page'];

export default async function search(el, ctx) {
  const { meta } = ctx;
  const q = Object.fromEntries(Object.entries(ctx.query).filter(([k, v]) => FILTER_KEYS.includes(k) && v !== ''));
  q.op ||= 'venta';
  const L = window.L;

  el.innerHTML = `
  <div class="search-page" id="sp">
    <section class="results" id="results">
      <div class="filters-bar">
        <div class="filters-row">
          <div class="seg" role="group" aria-label="Operación"><button data-op="venta">Comprar</button><button data-op="alquiler">Alquilar</button></div>
          <button class="btn btn-sm fx-toggle" id="fx-toggle" aria-expanded="false" aria-controls="fx">${icon('search')} Filtros <span id="fx-n"></span></button>
          <input class="input grow fx-q" id="f-q" placeholder="Palabra clave: piscina, Las Mercedes…" value="${esc(q.q || '')}" aria-label="Palabra clave">
        </div>
        <div class="filters-row fx" id="fx">
          <select class="input" id="f-place" aria-label="Ciudad o zona"><option value="">Toda Venezuela</option>${meta.cities.map(c => `<optgroup label="${esc(c)}"><option value="city:${esc(c)}">${esc(c)} (todas)</option>${ZONES.filter(z => z.city === c).map(z => `<option value="zone:${z.id}">${esc(z.name)}</option>`).join('')}</optgroup>`).join('')}</select>
          <select class="input" id="f-type" aria-label="Tipo"><option value="">Tipo</option>${Object.entries(meta.types).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <input class="input" id="f-pmin" type="number" min="0" inputmode="numeric" placeholder="Desde $" style="width:110px" aria-label="Precio mínimo en USD" value="${esc(q.pmin || '')}">
          <input class="input" id="f-pmax" type="number" min="0" inputmode="numeric" placeholder="Hasta $" style="width:110px" aria-label="Precio máximo en USD" value="${esc(q.pmax || '')}">
          <select class="input" id="f-rooms" aria-label="Habitaciones"><option value="">Hab.</option>${[1, 2, 3, 4].map(n => `<option value="${n}">${n}+ hab.</option>`).join('')}</select>
          <button class="btn btn-sm" id="more">${icon('menu')} Más filtros <span id="more-n"></span></button>
        </div>
        <div class="filters-row between">
          <span id="count" class="muted" aria-live="polite"></span>
          <div class="row" style="gap:8px">
            <select class="input" id="f-sort" aria-label="Ordenar"><option value="relevancia">Relevancia</option><option value="recientes">Más recientes</option><option value="precio-asc">Precio: menor a mayor</option><option value="precio-desc">Precio: mayor a menor</option><option value="ppm2-asc">Menor precio por m²</option><option value="m2-desc">Más metros</option></select>
            <button class="btn btn-sm" id="save" aria-label="Guardar búsqueda">${icon('bell')}<span class="hide-sm"> Guardar búsqueda</span></button>
          </div>
        </div>
      </div>
      <div class="results-grid" id="grid"></div>
      <div class="pager" id="pager"></div>
    </section>
    <section class="mapbox" aria-label="Mapa de resultados">
      <div id="map"></div>
      <div class="map-tools">
        <button class="btn btn-sm" id="draw">${icon('draw')} Dibujar zona</button>
        <button class="btn btn-sm" id="clear-poly" hidden>${icon('x')} Borrar zona</button>
        <label class="btn btn-sm" style="gap:8px"><input type="checkbox" id="follow" ${q.bbox ? 'checked' : ''}> Buscar al mover el mapa</label>
      </div>
      <div class="map-hint" id="hint" hidden></div>
    </section>
    <button class="btn btn-primary map-toggle" id="map-toggle">${icon('map')} Ver mapa</button>
  </div>`;

  // Valores iniciales de los controles
  $$('[data-op]', el).forEach(b => b.classList.toggle('on', b.dataset.op === q.op));
  $('#f-place', el).value = q.zone && !q.zone.includes(',') ? 'zone:' + q.zone : q.city ? 'city:' + q.city : '';
  $('#f-type', el).value = q.type && !q.type.includes(',') ? q.type : '';
  $('#f-rooms', el).value = q.rooms || '';
  $('#f-sort', el).value = q.sort || 'relevancia';

  /* ------------------------------ Mapa ------------------------------ */
  const map = L.map($('#map', el), { zoomControl: false, maxZoom: 18, minZoom: 5, attributionControl: true, preferCanvas: false }).setView([8.2, -66.2], 6);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const isLight = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')) === 'light';
  let tiles = null;
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const vecStyle = () => ({ color: tok('--line-2'), weight: 1.2, fillColor: tok('--surface-2'), fillOpacity: 1 });
  const baseVector = L.geoJSON(VENEZUELA, { style: vecStyle, interactive: false });
  const labels = L.layerGroup(ZONES.map(z => L.marker([z.lat, z.lng], { interactive: false, icon: L.divIcon({ className: 'zone-label-wrap', html: `<span class="zone-label">${esc(z.name)}</span>`, iconSize: [0, 0] }) })));
  const paintBase = () => {
    if (tiles) map.removeLayer(tiles);
    if (!map.hasLayer(baseVector)) { baseVector.addTo(map); labels.addTo(map); map.attributionControl.addAttribution('Contorno: Natural Earth'); }
    else baseVector.setStyle(vecStyle());
    if (mode.server) {
      // Teselas de CARTO sobre datos de OpenStreetMap (requieren conexión).
      tiles = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${isLight() ? 'light_all' : 'dark_all'}/{z}/{x}/{y}{r}.png`, { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO' }).addTo(map);
    }
  };
  paintBase();
  const onTheme = () => paintBase();
  document.addEventListener('theme', onTheme);

  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 50, spiderfyOnMaxZoom: true,
    iconCreateFunction: c => L.divIcon({ html: `<span class="cl">${c.getChildCount()}</span>`, className: 'pm-wrap', iconSize: [44, 44] }),
  });
  map.addLayer(cluster);
  const markerById = new Map();
  let polyLayer = null, drawing = null;

  const pinLabel = m => {
    if (currency.mode === 'ves') { const v = usdToVes(m.priceUsd, currency.rate); return 'Bs.' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.round(v / 1000) + 'k'); }
    return m.op === 'alquiler' ? `$${m.priceUsd.toLocaleString('es-VE')}` : shortUsd(m.priceUsd);
  };
  function paintMarkers(markers) {
    cluster.clearLayers(); markerById.clear();
    const ms = markers.map(m => {
      const mk = L.marker([m.lat, m.lng], { icon: L.divIcon({ className: 'pm-wrap', html: `<span class="pm ${m.verified ? 'v' : ''} ${m.boosted ? 'b' : ''}" data-pm="${m.id}">${pinLabel(m)}</span>`, iconSize: [0, 0] }) });
      mk.on('click', async () => {
        try {
          const r = await get('/api/listings/' + m.id);
          L.popup({ offset: [0, -20], maxWidth: 260, minWidth: 240, autoPanPadding: [30, 80] }).setLatLng([m.lat, m.lng]).setContent(card(r.listing, { compact: true })).openOn(map);
        } catch (e) { toast(e.message, 'err'); }
      });
      markerById.set(m.id, mk);
      return mk;
    });
    cluster.addLayers(ms);
  }

  /* ------------------------------ Consulta ------------------------------ */
  let lastFit = '';
  let reqSeq = 0;
  const filterKey = o => JSON.stringify(Object.fromEntries(Object.entries(o).filter(([k]) => !['bbox', 'page', 'sort'].includes(k))));
  async function run({ fit = true } = {}) {
    const seq = ++reqSeq;
    const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== '' && v != null));
    try { history.replaceState(null, '', '#/buscar?' + params); } catch { /* entorno sin historial */ }
    const r = await get('/api/listings?limit=24&' + params);
    if (seq !== reqSeq) return;
    const z = q.zone && zoneById(q.zone);
    $('#count', el).innerHTML = `<b>${r.total.toLocaleString('es-VE')}</b> ${q.op === 'alquiler' ? 'en alquiler' : 'en venta'}${z ? ` en ${esc(z.name)}` : q.city ? ` en ${esc(q.city)}` : ''}${q.poly ? ' dentro de tu zona' : q.bbox ? ' en el área del mapa' : ''}`;
    $('#grid', el).innerHTML = r.items.length ? r.items.map((l, i) => `<div class="rv" data-d="${i % 3}">${card(l)}</div>`).join('') : `<div class="empty" style="grid-column:1/-1">${icon('search')}<h3>Sin resultados con estos filtros</h3><p>Prueba quitar filtros, ampliar el rango de precio o mover el mapa.</p><button class="btn" id="reset">Limpiar filtros</button></div>`;
    $('#reset', el)?.addEventListener('click', () => { for (const k of Object.keys(q)) if (k !== 'op') delete q[k]; syncControls(); clearPoly(); run(); });
    $('#pager', el).innerHTML = r.pages > 1 ? Array.from({ length: r.pages }, (_, i) => `<button class="btn btn-sm ${r.page === i + 1 ? 'btn-primary' : ''}" data-page="${i + 1}">${i + 1}</button>`).join('') : '';
    $$('[data-page]', el).forEach(b => b.addEventListener('click', () => { q.page = b.dataset.page; run({ fit: false }); $('#results', el).scrollTo({ top: 0, behavior: 'smooth' }); scrollTo({ top: 0, behavior: 'smooth' }); }));
    paintMarkers(r.markers);
    const key = filterKey(q);
    if (fit && !q.bbox && r.markers.length && key !== lastFit) {
      map.fitBounds(L.latLngBounds(r.markers.map(m => [m.lat, m.lng])).pad(0.15), { maxZoom: 14, animate: true });
    }
    lastFit = key;
    const n = ['amin', 'amax', 'baths', 'fmin', 'state', 'features', 'payments', 'verified', 'parking', 'project'].filter(k => q[k]).length;
    $('#more-n', el).textContent = n ? `(${n})` : '';
    const all = n + ['q', 'zone', 'city', 'type', 'pmin', 'pmax', 'rooms'].filter(k => q[k]).length;
    $('#fx-n', el).textContent = all ? `(${all})` : '';
    reveal(el); tilt(el);
    // Resaltar marcador al pasar sobre la tarjeta
    $$('#grid .card', el).forEach(c => {
      c.addEventListener('mouseenter', () => $(`[data-pm="${c.dataset.id}"]`, el)?.classList.add('hl'));
      c.addEventListener('mouseleave', () => $(`[data-pm="${c.dataset.id}"]`, el)?.classList.remove('hl'));
    });
  }

  const set = (k, v) => { if (v === '' || v == null || (Array.isArray(v) && !v.length)) delete q[k]; else q[k] = Array.isArray(v) ? v.join(',') : String(v); delete q.page; };
  function syncControls() {
    $$('[data-op]', el).forEach(b => b.classList.toggle('on', b.dataset.op === q.op));
    $('#f-q', el).value = q.q || ''; $('#f-pmin', el).value = q.pmin || ''; $('#f-pmax', el).value = q.pmax || '';
    $('#f-type', el).value = q.type || ''; $('#f-rooms', el).value = q.rooms || '';
    $('#f-place', el).value = q.zone ? 'zone:' + q.zone : q.city ? 'city:' + q.city : '';
  }

  $$('[data-op]', el).forEach(b => b.addEventListener('click', () => { set('op', b.dataset.op); delete q.pmin; delete q.pmax; syncControls(); run(); }));
  let tq;
  $('#f-q', el).addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { set('q', e.target.value.trim()); run(); }, 300); });
  $('#f-place', el).addEventListener('change', e => { const [k, v] = e.target.value.split(':'); delete q.zone; delete q.city; delete q.bbox; $('#follow', el).checked = false; if (k) set(k, v); run(); });
  $('#f-type', el).addEventListener('change', e => { set('type', e.target.value); run(); });
  $('#f-rooms', el).addEventListener('change', e => { set('rooms', e.target.value); run(); });
  $('#f-sort', el).addEventListener('change', e => { set('sort', e.target.value === 'relevancia' ? '' : e.target.value); run({ fit: false }); });
  for (const id of ['pmin', 'pmax']) $('#f-' + id, el).addEventListener('change', e => { set(id, e.target.value); run(); });

  /* Móvil: los filtros se pliegan detrás de un botón */
  $('#fx-toggle', el).addEventListener('click', () => {
    const open = !el.querySelector('.filters-bar').classList.contains('fx-open');
    el.querySelector('.filters-bar').classList.toggle('fx-open', open);
    $('#fx-toggle', el).setAttribute('aria-expanded', open);
  });

  /* Más filtros */
  $('#more', el).addEventListener('click', () => {
    const feats = (q.features || '').split(','), pays = (q.payments || '').split(',');
    modal(`<h3>Más filtros</h3>
      <form id="mf" class="stack">
        <div class="form-grid">
          <label>Superficie mínima (m²)<input class="input" name="amin" type="number" min="0" value="${esc(q.amin || '')}"></label>
          <label>Superficie máxima (m²)<input class="input" name="amax" type="number" min="0" value="${esc(q.amax || '')}"></label>
          <label>Baños<select class="input" name="baths"><option value="">Cualquiera</option>${[1, 2, 3].map(n => `<option ${q.baths == n ? 'selected' : ''} value="${n}">${n}+</option>`).join('')}</select></label>
          <label>Piso desde<select class="input" name="fmin"><option value="">Cualquiera</option>${[1, 3, 5, 8].map(n => `<option ${q.fmin == n ? 'selected' : ''} value="${n}">Piso ${n}+</option>`).join('')}</select></label>
          <label>Estado<select class="input" name="state"><option value="">Cualquiera</option>${Object.entries(meta.states).map(([k, v]) => `<option ${q.state === k ? 'selected' : ''} value="${k}">${v}</option>`).join('')}</select></label>
        </div>
        <div class="stack" style="gap:8px"><b>Servicios y equipamiento</b><div class="pills">${Object.entries(meta.features).map(([k, v]) => `<label class="pill"><input type="checkbox" name="features" data-group="features" value="${k}" ${feats.includes(k) ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>
        <div class="stack" style="gap:8px"><b>Forma de pago aceptada</b><div class="pills">${Object.entries(meta.payments).map(([k, v]) => `<label class="pill"><input type="checkbox" name="payments" data-group="payments" value="${k}" ${pays.includes(k) ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>
        <div class="stack" style="gap:10px">
          <label class="check"><input type="checkbox" name="verified" ${q.verified ? 'checked' : ''}> Solo con título verificado</label>
          <label class="check"><input type="checkbox" name="parking" ${q.parking ? 'checked' : ''}> Con estacionamiento</label>
          <label class="check"><input type="checkbox" name="project" ${q.project ? 'checked' : ''}> Solo obra nueva</label>
        </div>
        <div class="row between"><button type="button" class="btn btn-ghost" id="mf-clear">Limpiar</button><button class="btn btn-primary">Ver resultados</button></div>
      </form>`, {
      onMount(body, close) {
        const f = $('#mf', body);
        $('#mf-clear', body).addEventListener('click', () => { f.reset(); $$('input[type=checkbox]', f).forEach(c => (c.checked = false)); $$('input[type=number],select', f).forEach(i => (i.value = '')); });
        f.addEventListener('submit', e => {
          e.preventDefault();
          const fd = new FormData(f);
          for (const k of ['amin', 'amax', 'baths', 'fmin', 'state']) set(k, fd.get(k));
          set('features', fd.getAll('features')); set('payments', fd.getAll('payments'));
          for (const k of ['verified', 'parking', 'project']) set(k, fd.get(k) ? '1' : '');
          close(); run();
        });
      },
    });
  });

  /* Guardar búsqueda con alerta */
  $('#save', el).addEventListener('click', async () => {
    if (!ctx.requireAuth()) return;
    const z = q.zone && zoneById(q.zone);
    const name = `${meta.operations[q.op]}${q.type ? ' · ' + meta.types[q.type] : ''}${z ? ' · ' + z.name : q.city ? ' · ' + q.city : ''}${q.pmax ? ' · hasta ' + shortUsd(Number(q.pmax)) : ''}`;
    try { const { page, ...query } = q; await post('/api/searches', { name, query }); toast('Búsqueda guardada. Verás los avisos nuevos en tu panel.'); }
    catch (e) { toast(e.message, 'err'); }
  });

  /* Mapa: seguir el área visible */
  const onMove = () => {
    if (!$('#follow', el).checked || drawing) return;
    const b = map.getBounds();
    q.bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(n => n.toFixed(4)).join(',');
    delete q.page;
    run({ fit: false });
  };
  map.on('moveend', onMove);
  $('#follow', el).addEventListener('change', e => { if (e.target.checked) { delete q.zone; delete q.city; syncControls(); onMove(); } else { delete q.bbox; run(); } });

  /* Dibujar zona */
  const hint = $('#hint', el);
  function clearPoly() { if (polyLayer) map.removeLayer(polyLayer); polyLayer = null; delete q.poly; $('#clear-poly', el).hidden = true; }
  function showPoly(points) {
    if (polyLayer) map.removeLayer(polyLayer);
    polyLayer = L.polygon(points, { color: tok('--accent') || '#f4a640', weight: 2, dashArray: '6 4', fillOpacity: 0.12 }).addTo(map);
    $('#clear-poly', el).hidden = false;
  }
  function finishDraw() {
    if (!drawing) return;
    const pts = drawing.points;
    map.off('click', drawing.onClick); map.off('dblclick', finishDraw);
    if (drawing.line) map.removeLayer(drawing.line);
    drawing = null; map.doubleClickZoom.enable();
    $('#draw', el).classList.remove('on'); $('#draw', el).innerHTML = `${icon('draw')} Dibujar zona`;
    hint.hidden = true;
    if (pts.length < 3) { toast('Marca al menos 3 puntos para formar la zona.', 'err'); return; }
    showPoly(pts);
    q.poly = pts.map(([a, b]) => `${a.toFixed(5)},${b.toFixed(5)}`).join(';');
    delete q.bbox; delete q.zone; delete q.city; $('#follow', el).checked = false; syncControls();
    run({ fit: false });
    map.fitBounds(polyLayer.getBounds().pad(0.2));
  }
  $('#draw', el).addEventListener('click', () => {
    if (drawing) return finishDraw();
    clearPoly();
    drawing = { points: [], line: null };
    map.doubleClickZoom.disable();
    $('#draw', el).classList.add('on'); $('#draw', el).innerHTML = `${icon('check')} Terminar zona`;
    hint.hidden = false; hint.textContent = 'Toca el mapa para marcar los vértices. Pulsa “Terminar zona” al acabar.';
    drawing.onClick = e => {
      drawing.points.push([e.latlng.lat, e.latlng.lng]);
      if (drawing.line) map.removeLayer(drawing.line);
      drawing.line = L.polyline([...drawing.points, drawing.points[0]], { color: '#f4a640', weight: 2, dashArray: '4 4' }).addTo(map);
      hint.textContent = `${drawing.points.length} punto${drawing.points.length > 1 ? 's' : ''}. ${drawing.points.length >= 3 ? 'Pulsa “Terminar zona” o haz doble clic.' : 'Sigue marcando.'}`;
    };
    map.on('click', drawing.onClick); map.on('dblclick', finishDraw);
  });
  $('#clear-poly', el).addEventListener('click', () => { clearPoly(); run(); });
  if (q.poly) showPoly(q.poly.split(';').map(p => p.split(',').map(Number)));

  /* Móvil: alternar lista y mapa */
  const sp = $('#sp', el);
  $('#map-toggle', el).addEventListener('click', () => {
    const on = !sp.classList.contains('show-map');
    sp.classList.toggle('show-map', on);
    $('#map-toggle', el).innerHTML = on ? `${icon('list')} Ver lista` : `${icon('map')} Ver mapa`;
    setTimeout(() => map.invalidateSize(), 420);
  });

  setTimeout(() => map.invalidateSize(), 50);
  await run();
  if (q.bbox) { const [w, s, e, n] = q.bbox.split(',').map(Number); map.fitBounds([[s, w], [n, e]]); }
  return () => { document.removeEventListener('theme', onTheme); disposeMap(map); };
}
export { priceText };
