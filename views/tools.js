// Herramientas públicas: valorador, precios por zona, guía para la diáspora, profesionales, ley 2026, favoritos y servicios.
import { get, post } from '../api.js';
import { $, $$, esc, icon, toast, card, formData, priceText } from '../ui.js';
import { ZONES, fmtUsd, fmtVes, LAW, rentalTerms, maintenanceSplit, DILIGENCE } from '../shared/core.js';
import { plansHtml } from './home.js';

const head = (eyebrow, title, lead) => `<div class="page-head rv"><span class="eyebrow">${eyebrow}</span><h1 style="font-size:clamp(2rem,5vw,3.4rem)">${title}</h1>${lead ? `<p class="muted" style="font-size:1.1rem;max-width:62ch">${lead}</p>` : ''}</div>`;
const zoneOptions = (meta, sel) => meta.cities.map(c => `<optgroup label="${esc(c)}">${ZONES.filter(z => z.city === c).map(z => `<option value="${z.id}" ${z.id === sel ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</optgroup>`).join('');

export async function valuation(el, ctx) {
  const { meta } = ctx;
  el.innerHTML = `<section class="wrap section" style="padding-top:20px">
    ${head('Valoración automática', '¿Cuánto vale tu inmueble?', 'Estimamos el precio de venta y el alquiler mensual con los avisos comparables de tu zona, ajustados por estado y equipamiento.')}
    <div class="grid grid-2" style="align-items:start">
      <form class="panel stack rv" id="vf"><div class="form-grid">
        <label>Zona<select class="input" name="zone">${zoneOptions(meta, 'altamira')}</select></label>
        <label>Tipo<select class="input" name="type">${Object.entries(meta.types).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label>Superficie (m²)<input class="input" type="number" name="area" min="10" value="110"></label>
        <label>Estacionamientos<input class="input" type="number" name="parking" min="0" value="1"></label>
        <label class="span-all">Estado<select class="input" name="state">${Object.entries(meta.states).map(([k, v]) => `<option value="${k}" ${k === 'bueno' ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
        <div class="pills">${Object.entries(meta.features).map(([k, v]) => `<label class="pill"><input type="checkbox" name="features" data-group="features" value="${k}" ${['planta', 'tanque'].includes(k) ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div>
        <button class="btn btn-primary" style="justify-self:start">${icon('chart')} Calcular valor</button>
      </form>
      <div class="stack rv" id="vr"></div>
    </div></section>`;
  const f = $('#vf', el);
  const run = async () => {
    try {
      const r = await post('/api/valuation', formData(f));
      $('#vr', el).innerHTML = `<div class="panel panel-solid stack"><span class="faint">Valor de venta estimado</span><span class="result-big">${fmtUsd(r.low)} – ${fmtUsd(r.high)}</span><span class="mono muted">Punto medio ${fmtUsd(r.estimate)} · ${fmtVes(r.estimateVes)}</span>
        <div class="form-grid"><div class="stack" style="gap:2px"><span class="faint">Alquiler estimado</span><b class="mono">${r.rent ? `${fmtUsd(r.rent.low)} – ${fmtUsd(r.rent.high)}/mes` : '—'}</b></div><div class="stack" style="gap:2px"><span class="faint">Rentabilidad bruta</span><b class="mono">${r.grossYield ?? '—'} %</b></div><div class="stack" style="gap:2px"><span class="faint">Precio por m²</span><b class="mono">${fmtUsd(r.ppm2)}</b></div><div class="stack" style="gap:2px"><span class="faint">Confianza</span><b>${r.confidence}</b></div></div>
        ${r.comps.length ? `<hr class="divider"><b>Comparables usados</b><div class="docs-list">${r.comps.map(c => `<a class="doc-row" href="#/inmueble/${c.id}" style="text-decoration:none"><span>${esc(c.title)} · ${c.area} m²</span><span class="mono">${fmtUsd(c.ppm2)}/m²</span></a>`).join('')}</div>` : '<p class="muted">Pocos avisos en la zona: usamos el precio de referencia del sector.</p>'}
        <div class="row"><a class="btn btn-primary" href="#/publicar">Publicar con este precio</a><a class="btn" href="#/buscar?op=venta&zone=${f.zone.value}">Ver la zona</a></div></div>`;
    } catch (e) { toast(e.message, 'err'); }
  };
  f.addEventListener('submit', e => { e.preventDefault(); run(); });
  run();
}

export async function market(el) {
  const m = await get('/api/market');
  const sale = m.filter(z => z.sale).sort((a, b) => b.sale.median - a.sale.median);
  const rent = m.filter(z => z.rent).sort((a, b) => b.rent.median - a.rent.median);
  const maxS = Math.max(...sale.map(z => z.sale.median)), maxR = Math.max(...rent.map(z => z.rent.median));
  el.innerHTML = `<section class="wrap section" style="padding-top:20px">${head('Precios por zona', 'Cuánto cuesta el metro cuadrado', 'Mediana calculada con los avisos activos. Se actualiza con cada publicación.')}
    <div class="grid grid-2" style="align-items:start">
      <div class="panel stack rv"><h3>Venta · USD por m²</h3><div class="bars">${sale.map(z => `<a class="bar-row" href="#/buscar?op=venta&zone=${z.id}" style="text-decoration:none"><span>${esc(z.name)} <span class="faint">· ${esc(z.city)}</span></span><div class="track"><i style="width:${(z.sale.median / maxS) * 100}%"></i></div><span class="mono" style="text-align:right">${fmtUsd(z.sale.median)}</span></a>`).join('')}</div></div>
      <div class="panel stack rv"><h3>Alquiler · USD por m² al mes</h3><div class="bars">${rent.map(z => `<a class="bar-row" href="#/buscar?op=alquiler&zone=${z.id}" style="text-decoration:none"><span>${esc(z.name)} <span class="faint">· ${esc(z.city)}</span></span><div class="track"><i style="width:${(z.rent.median / maxR) * 100}%"></i></div><span class="mono" style="text-align:right">$${z.rent.median.toFixed(2)}</span></a>`).join('')}</div></div>
    </div><p class="faint" style="margin-top:16px;font-size:.85rem">Los avisos de esta versión son de demostración; los valores ilustran el cálculo.</p></section>`;
}

export async function investors(el, ctx) {
  const feat = await get('/api/listings?verified=1&op=venta&limit=4&sort=ppm2-asc');
  el.innerHTML = `<section class="wrap section" style="padding-top:20px">${head('Diáspora e inversores', 'Comprar en Venezuela desde Miami, Madrid o Milán', 'Una ruta segura para invertir sin depender de una hipoteca bancaria que hoy no existe: título verificado, due diligence a precio fijo y pago protegido.')}
    <div class="flow rv">
      <div><b>Elige un inmueble verificado</b><span class="muted">Filtra por “Título verificado”. El expediente incluye documento de propiedad, gravamen y cédula catastral.</span></div>
      <div><b>Contrata la due diligence</b><span class="muted">Desde $90. Un abogado revisa el tracto sucesivo y la libertad de gravámenes en el Registro Público.</span></div>
      <div><b>Deposita en escrow</b><span class="muted">Arras y saldo en una cuenta segregada en el exterior o en stablecoin con firma múltiple.</span></div>
      <div><b>Firma y registro</b><span class="muted">Los fondos se liberan al vendedor solo cuando el documento queda protocolizado en el SAREN.</span></div>
    </div>
    <div class="grid grid-2 section" style="padding-bottom:0">
      <div class="stack rv"><h2>Cómo se financia</h2><p class="muted">Un banco europeo no puede inscribir una hipoteca sobre un inmueble en Venezuela ni ejecutarla allí. Las alternativas reales son tres:</p>
        <div class="docs-list"><div class="doc-row"><span><b>Préstamo con garantía en tu país</b><br><span class="faint">Préstamo personal o hipoteca sobre un inmueble que ya tienes en Italia o España.</span></span></div><div class="doc-row"><span><b>Deuda privada en divisas</b><br><span class="faint">Préstamo puente o buy-to-let a 3-5 años, 9 %-13 % anual, garantizado con prenda sobre una sociedad tenedora.</span></span></div><div class="doc-row"><span><b>Sociedad tenedora en el exterior</b><br><span class="faint">LLC en Delaware, S.L. en España o S.A. en Panamá dueña de la sociedad venezolana: compras sus cuotas y pagas fuera del país.</span></span></div></div>
        <p class="faint" style="font-size:.85rem">Información general, no constituye asesoría legal ni financiera. Cada operación debe revisarse con un abogado y respetar el régimen de sanciones aplicable.</p></div>
      <div class="stack rv"><h2>Paquetes de due diligence</h2>${Object.values(DILIGENCE).map(p => `<div class="panel stack" style="gap:6px"><div class="row between"><b>${p.name}</b><span class="mono">$${p.price}</span></div><span class="muted" style="font-size:.9rem">${p.items.join(' · ')}</span></div>`).join('')}</div>
    </div>
    <div class="section" style="padding-bottom:0"><div class="row between" style="margin-bottom:20px"><h2>Verificados con menor precio por m²</h2><a class="btn" href="#/buscar?verified=1&sort=ppm2-asc">Ver más</a></div><div class="grid grid-4">${feat.items.map(l => `<div class="rv">${card(l)}</div>`).join('')}</div></div>
    <div class="cta-band rv" style="margin-top:60px"><h2>¿Eres agencia en el exterior?</h2><p>Únete a la red de co-corretaje: refiere a tus clientes a agencias certificadas CIV y cobra entre el 20 % y el 40 % de la comisión.</p><a class="btn btn-primary" href="#/registro?role=internacional" style="justify-self:start">Crear cuenta internacional</a></div>
  </section>`;
  void ctx;
}

export async function professionals(el, ctx) {
  el.innerHTML = `<section class="wrap section" style="padding-top:20px">${head('Agencias, agentes y constructoras', 'El sistema de trabajo de tu inmobiliaria', 'Deja las hojas de cálculo y los chats sueltos: avisos, clientes, contratos y cobros en un solo lugar.')}
    <div class="grid grid-3 rv" style="margin-bottom:60px">${[
      ['chat', 'Contactos centralizados', 'Mensajes del portal y WhatsApp en un embudo. Cada contacto se asigna al agente de la zona.'],
      ['doc', 'Contratos Ley 2026', 'Canon en divisas, depósito hasta 3 meses, regla del 30 % y domicilio digital, con firma electrónica.'],
      ['wallet', 'Cobros en USD y Bs.', 'Registra pagos en bolívares a la tasa BCV del día y detecta morosidad de más de 3 meses.'],
      ['chart', 'Valoración por comparables', 'Capta exclusivas con un precio defendible ante el propietario.'],
      ['globe', 'Red internacional', 'Compradores de la diáspora referidos por brokers de Estados Unidos, España e Italia.'],
      ['shield', 'Sello de título verificado', 'Tus inmuebles con expediente revisado aparecen primero y generan más confianza.'],
    ].map(([i, t, p]) => `<div class="panel stack" style="gap:8px">${icon(i)}<b>${t}</b><span class="muted" style="font-size:.92rem">${p}</span></div>`).join('')}</div>
    ${plansHtml(ctx.meta, ctx.user?.plan)}
    <div class="panel stack rv" style="margin-top:28px"><h3>Constructoras: pago por lead calificado</h3><p class="muted">Publica tu obra nueva y paga $6 solo por contactos que declaran tener fondos en divisas disponibles. Los demás contactos no tienen costo.</p><a class="btn" style="justify-self:start" href="#/registro?role=constructora">Crear cuenta de constructora</a></div></section>`;
}

export async function law(el, ctx) {
  const rate = ctx.meta.rate;
  el.innerHTML = `<section class="wrap section" style="padding-top:20px">${head(LAW.gazette, 'La nueva ley de alquileres, en simple', `${LAW.name}. Lo esencial para propietarios e inquilinos y una calculadora con los límites legales.`)}
    <div class="law-grid rv">${[
      ['Art. 12', 'Canon libre', 'Propietario e inquilino fijan el precio según el mercado. Se acabaron las tablas de la SUNAVI.'],
      ['Art. 14', 'Contrato en divisas', 'El canon puede pactarse en USD o EUR. El inquilino puede pagar en bolívares a la tasa oficial del BCV.'],
      ['Art. 16', 'Depósito hasta 3 meses', 'Nadie puede exigir más de tres cánones como garantía.'],
      ['Art. 19-20', 'Regla del 30 %', 'Reparaciones de hasta el 30 % del canon mensual las paga el inquilino; las mayores, el propietario.'],
      ['Art. 21', 'Notificaciones digitales', 'Las partes pueden elegir un correo como domicilio válido para notificaciones legales.'],
      ['Art. 22', 'Preferencia de compra', 'Solo para el inquilino solvente con más de 2 años; tiene 15 días para responder.'],
      ['Art. 23', 'Desalojo por morosidad', 'Con más de 3 meses consecutivos sin pagar hay vías arbitrales y judiciales rápidas.'],
    ].map(([a, t, p]) => `<div class="law-item"><span class="art">${a}</span><b>${t}</b><span class="muted" style="font-size:.92rem">${p}</span></div>`).join('')}</div>
    <div class="grid grid-2 section" style="padding-bottom:0;align-items:start">
      <form class="panel stack rv" id="lc"><h3>Calculadora</h3><div class="form-grid"><label>Canon mensual (USD)<input class="input" type="number" name="rent" value="600" min="1"></label><label>Costo de una reparación (USD)<input class="input" type="number" name="repair" value="150" min="0"></label></div></form>
      <div class="panel panel-solid stack rv" id="lr"></div>
    </div>
    <p class="faint" style="margin-top:20px;font-size:.85rem">Resumen informativo. Para casos concretos consulta el texto de la Gaceta Oficial y a un abogado.</p></section>`;
  const f = $('#lc', el);
  const paint = () => {
    const rent = Number(f.rent.value) || 0, repair = Number(f.repair.value) || 0;
    const t = rentalTerms(rent, rate), s = maintenanceSplit(repair, rent);
    $('#lr', el).innerHTML = `<div class="row between"><span class="muted">Canon en bolívares hoy</span><b class="mono">${fmtVes(t.rentVes)}</b></div><div class="row between"><span class="muted">Depósito máximo</span><b class="mono">${fmtUsd(t.maxDepositUsd)} · ${fmtVes(t.maxDepositVes)}</b></div><div class="row between"><span class="muted">Tope de reparaciones del inquilino</span><b class="mono">${fmtUsd(t.tenantMaintenanceCapUsd)}</b></div><hr class="divider"><div class="row between"><span>La reparación de ${fmtUsd(repair)} la paga</span><span class="tag ${s.tenant ? 'tag-warn' : 'tag-ok'}">${s.tenant ? 'el inquilino' : 'el propietario'}</span></div><a class="btn" href="#/panel/contratos" style="justify-self:start">Generar contrato</a>`;
  };
  f.addEventListener('input', paint); paint();
}

export async function favorites(el, ctx) {
  if (!ctx.requireAuth()) return;
  const list = await get('/api/favorites');
  el.innerHTML = `<section class="wrap section" style="padding-top:20px">${head('Favoritos', 'Inmuebles guardados')}${list.length ? `<div class="grid grid-4">${list.map(l => `<div class="rv">${card(l)}</div>`).join('')}</div>` : `<div class="panel empty">${icon('heart')}<h3>Aún no guardaste inmuebles</h3><p>Toca el corazón en cualquier aviso para guardarlo aquí.</p><a class="btn btn-primary" href="#/buscar">Buscar</a></div>`}</section>`;
}

export async function services(el, ctx) {
  const { meta } = ctx;
  el.innerHTML = `<section class="wrap section" style="padding-top:20px">${head('Servicios para el hogar', 'Mudanza, seguro y remodelación con proveedores de confianza', 'Cuéntanos qué necesitas y te contactan hasta tres proveedores de tu ciudad.')}
    <div class="grid grid-2" style="align-items:start"><div class="grid grid-2 rv">${Object.entries(meta.services).map(([k, v]) => `<label class="panel check" style="cursor:pointer"><input type="radio" name="cat" value="${k}" form="sf" ${k === 'mudanza' ? 'checked' : ''}> <b>${v}</b></label>`).join('')}</div>
    <form class="panel stack rv" id="sf"><label>Nombre<input class="input" name="name" required value="${esc(ctx.user?.name || '')}"></label><label>Teléfono / WhatsApp<input class="input" name="phone" required value="${esc(ctx.user?.phone || '')}"></label><label>Ciudad<select class="input" name="city">${meta.cities.map(c => `<option>${esc(c)}</option>`).join('')}</select></label><label>Detalles<textarea class="input" name="notes" rows="3" placeholder="Fecha de la mudanza, metros, tipo de trabajo…"></textarea></label><button class="btn btn-primary">Pedir presupuestos</button></form></div></section>`;
  $('#sf', el).addEventListener('submit', async e => {
    e.preventDefault();
    const d = formData(e.target);
    try { await post('/api/services', { ...d, category: $('input[name=cat]:checked', el).value }); e.target.innerHTML = `<div class="stack" style="text-align:center;justify-items:center"><span class="avatar" style="background:var(--trust)">${icon('check')}</span><b>Solicitud enviada</b><p class="muted">Los proveedores te escribirán por WhatsApp en las próximas horas.</p></div>`; }
    catch (err) { toast(err.message, 'err'); }
  });
  void priceText; void $$;
}
