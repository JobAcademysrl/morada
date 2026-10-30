// Panel por tipo de cuenta: avisos, CRM, pagos bivaluta, contratos Ley 2026, red B2B, planes y administración.
import { get, post, patch, del } from '../api.js';
import { $, $$, esc, icon, toast, modal, fmtDate, formData, card, reveal, tilt } from '../ui.js';
import { fmtUsd, fmtVes, zoneById, LEAD_STAGES, ZONES, LAW, DOC_KINDS } from '../shared/core.js';
import { plansHtml } from './home.js';
import { boostModal } from './listing.js';

const PUBLISHERS = ['particular', 'agencia', 'constructora', 'admin'];
const PROS = ['agencia', 'constructora', 'internacional'];

function tabsFor(u, plan) {
  const t = [['resumen', 'Resumen', 'chart']];
  if (PUBLISHERS.includes(u.role) || u.role === 'internacional') t.push(['avisos', 'Mis avisos', 'list'], ['contactos', 'Contactos', 'chat']);
  if (PROS.includes(u.role) || u.role === 'admin') {
    t.push(['pagos', 'Pagos USD / Bs.', 'wallet', !plan.ledger], ['contratos', 'Contratos Ley 2026', 'doc', !plan.contracts], ['red', 'Red internacional', 'globe', !plan.network], ['plan', 'Plan y facturación', 'star']);
  }
  if (u.role === 'particular') t.push(['pagos', 'Pagos USD / Bs.', 'wallet', true], ['contratos', 'Contratos Ley 2026', 'doc', true]);
  t.push(['busquedas', 'Búsquedas guardadas', 'bell'], ['solicitudes', 'Mis solicitudes', 'key'], ['perfil', 'Perfil', 'user']);
  if (u.role === 'admin') t.push(['admin', 'Administración', 'shield']);
  return t;
}

export default async function panel(el, ctx) {
  if (!ctx.requireAuth()) return;
  await ctx.refreshUser();
  const u = ctx.user, plan = ctx.plan;
  const tabs = tabsFor(u, plan);
  const tab = tabs.some(t => t[0] === ctx.params[0]) ? ctx.params[0] : 'resumen';
  el.innerHTML = `<section class="wrap" style="padding-block:32px 60px">
    <div class="row between" style="margin-bottom:26px"><div class="stack" style="gap:4px"><span class="eyebrow">${esc(ctx.meta.roles[u.role])}${u.plan ? ' · plan ' + esc(ctx.plan.name) : ''}</span><h1 style="font-size:clamp(1.7rem,3.6vw,2.4rem)">Hola, ${esc((u.company || u.name).split(' ')[0])}</h1></div>
    <div class="row">${PUBLISHERS.includes(u.role) ? `<a class="btn btn-primary" href="#/publicar">${icon('plus')} Publicar</a>` : ''}<button class="btn btn-ghost" id="logout">Cerrar sesión</button></div></div>
    <div class="dash"><nav class="dash-nav" aria-label="Secciones del panel">${tabs.map(([k, label, ic, locked]) => `<a href="#/panel/${k}" class="${k === tab ? 'on' : ''}">${icon(ic)} ${label}${locked ? `<span class="lock tag">${k === 'red' || k === 'contratos' ? 'Pro Max' : 'Pro'}</span>` : ''}</a>`).join('')}</nav><div id="tab" class="stack" style="gap:20px;min-width:0"></div></div></section>`;
  $('#logout', el).addEventListener('click', () => ctx.logout());
  const box = $('#tab', el);
  const locked = tabs.find(t => t[0] === tab)?.[3];
  if (locked) return upsell(box, tab, ctx);
  await TABS[tab](box, ctx);
  reveal(box); tilt(box);
}

const reload = ctx => ctx.go(location.hash);

function upsell(box, tab, ctx) {
  const info = {
    pagos: ['Conciliación de pagos bivaluta', 'Registra cánones en dólares, recibe pagos en bolívares a la tasa BCV del día y detecta morosidad de más de 3 meses (Art. 23).', 'Professional'],
    contratos: ['Generador de contratos Ley 2026', 'Contratos de arrendamiento con canon en divisas, depósito máximo de 3 meses, regla del 30 % y domicilio digital, listos para firma electrónica.', 'Agency Pro Max'],
    red: ['Red de co-corretaje internacional', 'Agencias de Miami, Madrid, Roma y Milán refieren compradores a tus inmuebles con acuerdo estándar y comisión protegida.', 'Agency Pro Max'],
  }[tab];
  const pro = PROS.includes(ctx.user.role);
  box.innerHTML = `<div class="panel stack"><span class="eyebrow">Disponible en ${info[2]}</span><h2>${info[0]}</h2><p class="muted" style="max-width:60ch">${info[1]}</p>${pro ? '<a class="btn btn-primary" href="#/panel/plan" style="justify-self:start">Mejorar mi plan</a>' : '<p class="muted">Estas herramientas son para agencias y constructoras. Crea una cuenta profesional para usarlas.</p><a class="btn" href="#/registro?role=agencia" style="justify-self:start">Crear cuenta de agencia</a>'}</div>`;
}

const TABS = {
  async resumen(box, ctx) {
    const u = ctx.user;
    const [mine, leads, searches] = await Promise.all([
      PUBLISHERS.includes(u.role) || u.role === 'internacional' ? get('/api/listings?owner=me&limit=60') : { items: [], total: 0 },
      PUBLISHERS.includes(u.role) || u.role === 'internacional' ? get('/api/leads') : [],
      get('/api/searches'),
    ]);
    const views = mine.items.reduce((s, l) => s + (l.views || 0), 0);
    const fresh = leads.filter(l => l.stage === 'nuevo').length;
    const q = ctx.quota;
    box.innerHTML = `<div class="kpis">
      <div class="kpi rv"><span>Avisos activos</span><b>${mine.items.filter(l => l.status === 'active').length}${q?.limit != null ? `<span class="faint" style="font-size:.9rem"> / ${q.limit}</span>` : ''}</b></div>
      <div class="kpi rv"><span>Visitas a tus avisos</span><b>${views.toLocaleString('es-VE')}</b></div>
      <div class="kpi rv"><span>Contactos nuevos</span><b>${fresh}</b></div>
      <div class="kpi rv"><span>Búsquedas con novedades</span><b>${searches.filter(s => s.fresh).length}</b></div>
    </div>
    ${u.role === 'comprador' ? `<div class="panel stack rv"><h3>Comprar desde el exterior</h3><p class="muted">Guarda búsquedas, contrata una due diligence a precio fijo y paga las arras en escrow.</p><div class="row"><a class="btn btn-primary" href="#/buscar?verified=1">Ver inmuebles verificados</a><a class="btn" href="#/inversores">Cómo funciona</a></div></div>` : ''}
    ${leads.length ? `<div class="stack rv"><div class="row between"><h3>Últimos contactos</h3><a class="btn btn-sm" href="#/panel/contactos">Ver todos</a></div><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Inmueble</th><th>Tipo</th><th>Etapa</th><th>Fecha</th></tr></thead><tbody>${leads.slice(0, 5).map(l => `<tr><td><b>${esc(l.name)}</b>${l.prequal?.usdFunds ? ' <span class="tag tag-ok">Fondos USD</span>' : ''}</td><td><a href="#/inmueble/${l.listingId}">${esc(l.listing?.title || l.listingId)}</a></td><td>${l.kind === 'visita' ? 'Visita' : 'Información'}</td><td><span class="tag">${LEAD_STAGES[l.stage]}</span></td><td>${fmtDate(l.createdAt)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    ${mine.items.length ? `<div class="stack rv"><h3>Rendimiento por aviso</h3><div class="bars">${mine.items.slice().sort((a, b) => b.views - a.views).slice(0, 6).map(l => { const max = Math.max(1, ...mine.items.map(x => x.views)); return `<div class="bar-row"><a href="#/inmueble/${l.id}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.title)}</a><div class="track"><i style="width:${(l.views / max) * 100}%"></i></div><span class="mono" style="text-align:right">${l.views} · ${l.contacts}✉</span></div>`; }).join('')}</div></div>` : ''}
    ${searches.length ? `<div class="stack rv"><h3>Búsquedas guardadas</h3>${searchList(searches)}</div>` : ''}`;
    bindSearches(box, ctx);
  },

  async avisos(box, ctx) {
    const r = await get('/api/listings?owner=me&limit=60&sort=recientes');
    if (!r.items.length) { box.innerHTML = `<div class="panel empty">${icon('plus')}<h3>Aún no tienes avisos</h3><a class="btn btn-primary" href="#/publicar">Publicar mi primer inmueble</a></div>`; return; }
    const ver = { verified: '<span class="tag tag-ok">Verificado</span>', pending: '<span class="tag tag-warn">En revisión</span>', rejected: '<span class="tag tag-bad">Rechazado</span>', none: '<span class="tag">Sin documentos</span>' };
    box.innerHTML = `<div class="row between"><h2 style="font-size:1.6rem">Mis avisos (${r.total})</h2>${ctx.quota?.limit != null ? `<span class="muted">${ctx.quota.remaining} disponibles en tu plan</span>` : ''}</div>
      <div class="table-wrap"><table><thead><tr><th>Aviso</th><th class="num">Precio</th><th>Estado</th><th>Título</th><th class="num">Visitas</th><th class="num">Contactos</th><th>Acciones</th></tr></thead><tbody>
      ${r.items.map(l => `<tr data-id="${l.id}"><td><a href="#/inmueble/${l.id}"><b>${esc(l.title)}</b></a><div class="faint" style="font-size:.8rem">${l.id} · ${esc(zoneById(l.zone)?.name || '')}${l.boosted ? ' · <span style="color:var(--accent)">destacado</span>' : ''}</div></td>
        <td class="num mono">${fmtUsd(l.priceUsd)}${l.op === 'alquiler' ? '/mes' : ''}</td>
        <td><select class="input" data-status style="min-height:34px;padding:4px 8px;width:auto"><option value="active" ${l.status === 'active' ? 'selected' : ''}>Activo</option><option value="paused" ${l.status === 'paused' ? 'selected' : ''}>Pausado</option><option value="sold" ${l.status === 'sold' ? 'selected' : ''}>${l.op === 'alquiler' ? 'Alquilado' : 'Vendido'}</option></select></td>
        <td>${ver[l.verification] || ver.none}</td><td class="num mono">${l.views}</td><td class="num mono">${l.contacts}</td>
        <td><div class="row" style="gap:6px;flex-wrap:nowrap"><a class="btn btn-sm" href="#/editar/${l.id}">Editar</a><button class="btn btn-sm" data-boost>${icon('bolt')}</button><button class="btn btn-sm" data-docs>${icon('doc')}</button><button class="btn btn-sm btn-ghost" data-del aria-label="Eliminar">${icon('x')}</button></div></td></tr>`).join('')}
      </tbody></table></div>`;
    $$('tr[data-id]', box).forEach(tr => {
      const l = r.items.find(x => x.id === tr.dataset.id);
      $('[data-status]', tr).addEventListener('change', async e => { try { await patch('/api/listings/' + l.id, { status: e.target.value }); toast('Estado actualizado.'); } catch (err) { toast(err.message, 'err'); e.target.value = l.status; } });
      $('[data-boost]', tr).addEventListener('click', () => boostModal(l, ctx, () => reload(ctx)));
      $('[data-docs]', tr).addEventListener('click', () => docsModal(l, ctx));
      $('[data-del]', tr).addEventListener('click', () => modal(`<h3>¿Eliminar este aviso?</h3><p class="muted">“${esc(l.title)}” dejará de mostrarse y no se puede recuperar.</p><div class="row"><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="yes">Eliminar</button></div>`, { onMount(b, close) { $('#yes', b).addEventListener('click', async () => { await del('/api/listings/' + l.id); close(); toast('Aviso eliminado.'); reload(ctx); }); } }));
    });
  },

  async contactos(box, ctx) {
    const leads = await get('/api/leads');
    const crm = !!ctx.plan?.crm || ctx.user.role === 'admin';
    if (!leads.length) { box.innerHTML = `<div class="panel empty">${icon('chat')}<h3>Todavía no recibiste contactos</h3><p>Los mensajes y solicitudes de visita de tus avisos aparecerán aquí.</p></div>`; return; }
    const leadCard = l => `<div class="lead" draggable="${crm}" data-lead="${l.id}"><div class="row between"><b>${esc(l.name)}</b><span class="faint" style="font-size:.75rem">${fmtDate(l.createdAt)}</span></div><a href="#/inmueble/${l.listingId}" class="faint" style="font-size:.8rem">${esc(l.listing?.title || l.listingId)}</a><p style="font-size:.85rem">${esc(l.message || '')}</p><div class="row">${l.kind === 'visita' ? `<span class="tag tag-warn">Visita ${l.visitDate ? fmtDate(l.visitDate) : ''}</span>` : ''}${l.prequal?.usdFunds ? '<span class="tag tag-ok">Fondos en USD</span>' : ''}${l.prequal?.income ? `<span class="tag">$${esc(l.prequal.income)}</span>` : ''}${l.billedUsd ? `<span class="tag">Lead calificado · $${l.billedUsd}</span>` : ''}</div><div class="row faint" style="font-size:.8rem">${l.phone ? `<a target="_blank" rel="noopener" href="https://wa.me/${l.phone.replace(/\D/g, '')}">WhatsApp ${esc(l.phone)}</a>` : ''}${l.email ? `<span style="user-select:all">${esc(l.email)}</span>` : ''}</div>${crm ? `<select class="input" data-stage style="min-height:32px;padding:2px 8px;font-size:.82rem">${Object.entries(LEAD_STAGES).map(([k, v]) => `<option value="${k}" ${l.stage === k ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}</div>`;
    if (!crm) {
      box.innerHTML = `<div class="row between"><h2 style="font-size:1.6rem">Contactos (${leads.length})</h2></div><div class="panel stack" style="gap:6px"><b>Organiza tus clientes en un embudo</b><p class="muted" style="font-size:.92rem">Con el plan Professional mueves cada contacto entre etapas, agregas notas y ves tu tasa de cierre.</p>${PROS.includes(ctx.user.role) ? '<a class="btn btn-sm" href="#/panel/plan" style="justify-self:start">Ver planes</a>' : ''}</div><div class="grid grid-3">${leads.map(leadCard).join('')}</div>`;
      return;
    }
    const stages = ['nuevo', 'contactado', 'visita', 'oferta', 'cerrado'];
    const closed = leads.filter(l => l.stage === 'cerrado').length;
    box.innerHTML = `<div class="row between"><h2 style="font-size:1.6rem">Embudo de clientes</h2><span class="muted">${leads.length} contactos · ${Math.round((closed / leads.length) * 100)} % cerrados</span></div>
      <p class="muted" style="font-size:.9rem">Arrastra las tarjetas entre columnas o cambia la etapa en el selector.</p>
      <div class="kanban">${stages.map(s => `<div class="kcol" data-col="${s}"><h4><span>${LEAD_STAGES[s]}</span><span>${leads.filter(l => l.stage === s).length}</span></h4>${leads.filter(l => l.stage === s).map(leadCard).join('')}</div>`).join('')}</div>
      ${leads.some(l => l.stage === 'perdido') ? `<details><summary class="muted">Perdidos (${leads.filter(l => l.stage === 'perdido').length})</summary><div class="grid grid-3" style="margin-top:10px">${leads.filter(l => l.stage === 'perdido').map(leadCard).join('')}</div></details>` : ''}`;
    const move = async (id, stage) => { try { await patch('/api/leads/' + id, { stage }); reload(ctx); } catch (e) { toast(e.message, 'err'); } };
    $$('[data-stage]', box).forEach(s => s.addEventListener('change', e => move(e.target.closest('[data-lead]').dataset.lead, e.target.value)));
    $$('[data-lead]', box).forEach(c => c.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', c.dataset.lead)));
    $$('[data-col]', box).forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); if (id) move(id, col.dataset.col); });
    });
  },

  async pagos(box, ctx) {
    const r = await get('/api/payments');
    const status = { pagado: 'tag-ok', parcial: 'tag-warn', vencido: 'tag-bad', pendiente: '' };
    box.innerHTML = `<div class="row between"><h2 style="font-size:1.6rem">Conciliación de pagos</h2><span class="rate mono">Tasa BCV ${r.rate.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs./USD</span></div>
      ${r.alerts.length ? r.alerts.map(a => `<div class="panel" style="border-color:var(--danger)"><b style="color:var(--danger)">${esc(a.tenant)} acumula ${a.months} cánones vencidos.</b><p class="muted" style="font-size:.9rem">Con más de ${LAW.evictionArrearsMonths} meses consecutivos la ley permite pedir la resolución por vía arbitral o judicial expedita (Art. 23).</p></div>`).join('') : ''}
      <div class="kpis"><div class="kpi"><span>Por cobrar</span><b>${fmtUsd(r.items.reduce((s, p) => s + Math.max(0, p.balance), 0))}</b></div><div class="kpi"><span>Cobrado este ciclo</span><b>${fmtUsd(r.items.reduce((s, p) => s + p.paidUsd, 0))}</b></div><div class="kpi"><span>Cuotas vencidas</span><b>${r.items.filter(p => p.status === 'vencido').length}</b></div></div>
      <div class="table-wrap"><table><thead><tr><th>Inquilino</th><th>Inmueble</th><th>Vence</th><th class="num">Canon</th><th class="num">Pagado</th><th class="num">Saldo</th><th>Estado</th><th></th></tr></thead><tbody>
      ${r.items.map(p => `<tr><td><b>${esc(p.tenant)}</b></td><td>${esc(p.property)}</td><td>${fmtDate(p.dueDate)}</td><td class="num mono">${fmtUsd(p.amountUsd)}</td><td class="num mono">${fmtUsd(p.paidUsd)}</td><td class="num mono">${p.balance > 0 ? `${fmtUsd(p.balance)}<div class="faint" style="font-size:.75rem">${fmtVes(p.balanceVes)}</div>` : '—'}</td><td><span class="tag ${status[p.status]}">${p.status}</span></td><td>${p.status !== 'pagado' ? `<button class="btn btn-sm" data-pay="${p.id}">Registrar pago</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>
      <form class="panel stack" id="new-pay"><h3>Nueva cuota de alquiler</h3><div class="form-grid"><label>Inquilino<input class="input" name="tenant" required></label><label>Inmueble<input class="input" name="property"></label><label>Canon (USD)<input class="input" type="number" min="1" name="amountUsd" required></label><label>Vencimiento<input class="input" type="date" name="dueDate" required></label></div><button class="btn btn-primary" style="justify-self:start">Agregar cuota</button></form>`;
    $('#new-pay', box).addEventListener('submit', async e => { e.preventDefault(); try { await post('/api/payments', formData(e.target)); toast('Cuota agregada.'); reload(ctx); } catch (err) { toast(err.message, 'err'); } });
    $$('[data-pay]', box).forEach(b => b.addEventListener('click', () => {
      const p = r.items.find(x => x.id === b.dataset.pay);
      modal(`<h3>Registrar pago de ${esc(p.tenant)}</h3><p class="muted">Saldo: <b class="mono">${fmtUsd(p.balance)}</b> · ${fmtVes(p.balanceVes)}</p><form id="pf" class="stack"><div class="seg" role="group"><button type="button" class="on" data-c="usd">Dólares</button><button type="button" data-c="ves">Bolívares</button></div><label>Monto<input class="input" type="number" step="0.01" min="0" name="amount" value="${p.balance}" required></label><label>Tasa BCV del día<input class="input" type="number" step="0.01" name="rate" value="${r.rate}"></label><p class="mono" id="pf-eq"></p><button class="btn btn-primary">Registrar</button></form>`, {
        onMount(body, close) {
          const f = $('#pf', body); let cur = 'usd';
          const eq = () => { const a = Number(f.amount.value) || 0, rt = Number(f.rate.value) || r.rate; $('#pf-eq', body).textContent = cur === 'ves' ? `= ${fmtUsd(a / rt)} acreditados` : `= ${fmtVes(a * rt)}`; };
          $$('[data-c]', body).forEach(x => x.addEventListener('click', () => { cur = x.dataset.c; $$('[data-c]', body).forEach(y => y.classList.toggle('on', y === x)); f.amount.value = cur === 'ves' ? (p.balance * r.rate).toFixed(2) : p.balance; eq(); }));
          f.addEventListener('input', eq); eq();
          f.addEventListener('submit', async e => { e.preventDefault(); try { await post(`/api/payments/${p.id}/pay`, { currency: cur, amount: Number(f.amount.value), rate: Number(f.rate.value) }); close(); toast('Pago conciliado.'); reload(ctx); } catch (err) { toast(err.message, 'err'); } });
        },
      });
    }));
  },

  async contratos(box, ctx) {
    const list = await get('/api/contracts');
    const u = ctx.user;
    box.innerHTML = `<div class="stack" style="gap:4px"><h2 style="font-size:1.6rem">Contrato de arrendamiento de vivienda</h2><p class="muted">Conforme a la ${LAW.name}, ${LAW.gazette}.</p></div>
      <div class="grid grid-2" style="align-items:start">
        <form class="panel stack" id="cf"><div class="form-grid">
          <label>Arrendador<input class="input" name="landlordName" value="${esc(u.company || u.name)}"></label><label>C.I. / RIF arrendador<input class="input" name="landlordId" placeholder="J-12345678-9"></label>
          <label>Arrendatario<input class="input" name="tenantName" placeholder="Nombre completo"></label><label>C.I. arrendatario<input class="input" name="tenantId" placeholder="V-12345678"></label>
          <label class="span-all">Dirección del inmueble<input class="input" name="address" placeholder="Av. Principal de Los Palos Grandes, Edif. ..."></label>
          <label>Ciudad<input class="input" name="city" value="Caracas"></label><label>Inicio<input class="input" type="date" name="startDate"></label>
          <label>Canon (USD/mes)<input class="input" type="number" name="rentUsd" value="650"></label><label>Depósito (meses)<input class="input" type="number" name="depositMonths" min="0" max="6" value="2"></label>
          <label>Duración (meses)<input class="input" type="number" name="termMonths" value="12"></label><label>Día de pago<input class="input" type="number" name="payDay" min="1" max="28" value="5"></label>
          <label>Correo arrendador<input class="input" type="email" name="landlordEmail" value="${esc(u.email)}"></label><label>Correo arrendatario<input class="input" type="email" name="tenantEmail"></label>
        </div><button class="btn btn-primary" style="justify-self:start">Guardar contrato</button></form>
        <div class="stack"><div id="warn"></div><article class="contract" id="preview"></article></div>
      </div>
      ${list.length ? `<div class="stack"><h3>Contratos guardados</h3><div class="table-wrap"><table><thead><tr><th>Arrendatario</th><th>Inmueble</th><th class="num">Canon</th><th>Estado</th><th>Firmas</th><th></th></tr></thead><tbody>${list.map(c => `<tr><td>${esc(c.data.tenantName || '—')}</td><td>${esc(c.data.address || '—')}</td><td class="num mono">${fmtUsd(c.doc.rent)}</td><td><span class="tag ${c.status === 'firmado' ? 'tag-ok' : 'tag-warn'}">${c.status}</span></td><td>${c.signatures.map(s => `<span class="tag">${s.party}</span>`).join(' ') || '—'}</td><td class="row" style="gap:6px">${['arrendador', 'arrendatario'].filter(p => !c.signatures.some(s => s.party === p)).map(p => `<button class="btn btn-sm" data-sign="${c.id}" data-party="${p}">Firmar como ${p}</button>`).join('')}<button class="btn btn-sm btn-ghost" data-view="${c.id}">Ver</button></td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
    const f = $('#cf', box);
    const paintDoc = doc => `<h3>${doc.title}</h3>${doc.sections.map(([h, t]) => `<h4>${h}</h4><p>${esc(t)}</p>`).join('')}`;
    let t;
    const preview = async () => { const doc = await post('/api/contracts/preview', formData(f)); $('#preview', box).innerHTML = paintDoc(doc); $('#warn', box).innerHTML = doc.warnings.map(w => `<div class="panel" style="border-color:var(--accent);padding:12px 16px"><b style="color:var(--accent)">${esc(w)}</b></div>`).join(''); };
    f.addEventListener('input', () => { clearTimeout(t); t = setTimeout(preview, 200); });
    preview();
    f.addEventListener('submit', async e => { e.preventDefault(); try { await post('/api/contracts', formData(f)); toast('Contrato guardado como borrador.'); reload(ctx); } catch (err) { toast(err.message, 'err'); } });
    $$('[data-sign]', box).forEach(b => b.addEventListener('click', async () => { await post(`/api/contracts/${b.dataset.sign}/sign`, { party: b.dataset.party }); toast('Firma electrónica registrada.'); reload(ctx); }));
    $$('[data-view]', box).forEach(b => b.addEventListener('click', () => { const c = list.find(x => x.id === b.dataset.view); modal(`<article class="contract" style="max-height:none">${paintDoc(c.doc)}${c.signatures.map(s => `<p class="faint mono" style="font-size:.78rem">Firmado por ${s.party} · ${fmtDate(s.at)} · ${s.hash}</p>`).join('')}</article>`, { wide: true }); }));
  },

  async red(box, ctx) {
    const [listings, refs] = await Promise.all([get('/api/network/listings'), get('/api/network/referrals')]);
    const stat = { propuesto: 'tag-warn', aceptado: 'tag-ok', visita: 'tag-ok', oferta: 'tag-ok', cerrado: 'tag-ok', rechazado: 'tag-bad' };
    const next = r => r.direction === 'recibido' && r.status === 'propuesto' ? [['aceptado', 'Aceptar acuerdo'], ['rechazado', 'Rechazar']] : { aceptado: [['visita', 'Hoja de visita firmada']], visita: [['oferta', 'Registrar oferta']], oferta: [['cerrado', 'Cerrar operación']] }[r.status] || [];
    box.innerHTML = `<div class="stack" style="gap:4px"><h2 style="font-size:1.6rem">Red de co-corretaje</h2><p class="muted">Acuerdos Broker-to-Broker: la agencia que refiere al comprador recibe entre 20 % y 40 % de la comisión; la plataforma retiene una tarifa del 15 % sobre esa parte.</p></div>
      <div class="stack"><h3>Acuerdos (${refs.length})</h3>${refs.length ? `<div class="table-wrap"><table><thead><tr><th>Inmueble</th><th>Contraparte</th><th>Comprador</th><th class="num">Tu parte</th><th>Estado</th><th></th></tr></thead><tbody>${refs.map(r => `<tr><td><a href="#/inmueble/${r.listingId}">${esc(r.listingTitle)}</a><div class="faint" style="font-size:.78rem">${r.direction}</div></td><td>${esc(r.counterpart?.name || '')}</td><td>${esc(r.buyerName)}${r.buyerCountry ? ` · ${esc(r.buyerCountry)}` : ''}</td><td class="num mono">${fmtUsd(r.direction === 'enviado' ? r.economics.referrer : r.economics.listingAgent)}<div class="faint" style="font-size:.75rem">${Math.round(r.split * 100)} % referido</div></td><td><span class="tag ${stat[r.status]}">${r.status}</span></td><td class="row" style="gap:6px">${next(r).map(([s, label]) => `<button class="btn btn-sm" data-ref="${r.id}" data-to="${s}">${label}</button>`).join('')}<button class="btn btn-sm btn-ghost" data-tl="${r.id}">Historial</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aún no hay acuerdos. Refiere un comprador a uno de los inmuebles abiertos a la red.</p>'}</div>
      <div class="stack"><h3>Inmuebles abiertos a co-corretaje (${listings.length})</h3>${listings.length ? `<div class="grid grid-3">${listings.slice(0, 9).map(l => `<div>${card(l)}</div>`).join('')}</div>` : '<p class="muted">No hay inmuebles de otras agencias abiertos a la red en este momento.</p>'}</div>`;
    $$('[data-ref]', box).forEach(b => b.addEventListener('click', async () => { try { await patch('/api/network/referrals/' + b.dataset.ref, { status: b.dataset.to }); toast('Acuerdo actualizado.'); reload(ctx); } catch (e) { toast(e.message, 'err'); } }));
    $$('[data-tl]', box).forEach(b => b.addEventListener('click', () => { const r = refs.find(x => x.id === b.dataset.tl); modal(`<h3>Historial del acuerdo</h3><div class="timeline">${r.timeline.map(t => `<div><b>${esc(t.event)}</b><div class="faint">${fmtDate(t.at)}</div></div>`).join('')}</div><p class="muted" style="font-size:.9rem">Comisión total ${fmtUsd(r.commission)} · referido ${fmtUsd(r.economics.referrer)} · agencia del inmueble ${fmtUsd(r.economics.listingAgent)} · plataforma ${fmtUsd(r.economics.platform)}</p>`); }));
  },

  async plan(box, ctx) {
    const orders = await get('/api/me/orders');
    box.innerHTML = `<div class="stack" style="gap:4px"><h2 style="font-size:1.6rem">Tu plan: ${esc(ctx.plan.name)}</h2><p class="muted">Cambia de plan cuando quieras. El cobro es mensual en USD. Pago simulado en esta versión.</p></div>${plansHtml(ctx.meta, ctx.user.plan)}
      <div class="stack"><h3>Movimientos</h3>${orders.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Monto</th></tr></thead><tbody>${orders.map(o => `<tr><td>${fmtDate(o.createdAt)}</td><td>${{ plan: 'Plan ', boost: 'Visibilidad ', slot: 'Avisos adicionales: ', diligence: 'Due diligence ', lead: 'Lead calificado ' }[o.kind] || ''}${esc(String(o.item))}</td><td class="num mono">${fmtUsd(o.amountUsd)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sin movimientos todavía.</p>'}</div>`;
  },

  async busquedas(box, ctx) {
    const s = await get('/api/searches');
    box.innerHTML = `<h2 style="font-size:1.6rem">Búsquedas guardadas</h2>${s.length ? searchList(s) : `<div class="panel empty">${icon('bell')}<h3>Sin búsquedas guardadas</h3><p>Desde los resultados pulsa “Guardar búsqueda” para recibir los avisos nuevos.</p><a class="btn" href="#/buscar">Buscar inmuebles</a></div>`}`;
    bindSearches(box, ctx);
  },

  async solicitudes(box) {
    const [sent, dd] = await Promise.all([get('/api/leads/sent'), get('/api/diligence')]);
    box.innerHTML = `<h2 style="font-size:1.6rem">Mis solicitudes</h2>
      <div class="stack"><h3>Due diligence contratadas</h3>${dd.length ? `<div class="table-wrap"><table><thead><tr><th>Inmueble</th><th>Paquete</th><th class="num">Precio</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>${dd.map(d => `<tr><td><a href="#/inmueble/${d.listingId}">${esc(d.listingTitle)}</a></td><td>${esc(d.package)}</td><td class="num mono">${fmtUsd(d.priceUsd)}</td><td><span class="tag tag-warn">${d.status}</span></td><td>${fmtDate(d.createdAt)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Ninguna todavía. Puedes contratarla desde la ficha de cualquier inmueble.</p>'}</div>
      <div class="stack"><h3>Mensajes enviados</h3>${sent.length ? `<div class="table-wrap"><table><thead><tr><th>Inmueble</th><th>Tipo</th><th>Fecha</th></tr></thead><tbody>${sent.map(l => `<tr><td><a href="#/inmueble/${l.listingId}">${esc(l.listing || l.listingId)}</a></td><td>${l.kind === 'visita' ? 'Visita' : 'Información'}</td><td>${fmtDate(l.createdAt)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Los mensajes que envíes con tu sesión iniciada aparecerán aquí.</p>'}</div>`;
  },

  async perfil(box, ctx) {
    const u = ctx.user;
    const pro = PROS.includes(u.role);
    box.innerHTML = `<form class="panel stack" id="pf"><h2 style="font-size:1.6rem">Perfil</h2><div class="form-grid">
      <label>Nombre<input class="input" name="name" value="${esc(u.name)}"></label>${pro ? `<label>Empresa<input class="input" name="company" value="${esc(u.company)}"></label>` : ''}
      <label>Teléfono / WhatsApp<input class="input" name="phone" value="${esc(u.phone)}"></label><label>País<input class="input" name="country" value="${esc(u.country)}"></label>
      ${u.role === 'agencia' ? `<label>N° de afiliación CIV / cámara regional<input class="input" name="civ" value="${esc(u.civ)}"></label>` : ''}
      ${u.role === 'internacional' ? `<label>Licencia o registro profesional<input class="input" name="license" value="${esc(u.license)}"></label>` : ''}
      </div>${u.role === 'agencia' ? `<label class="check"><input type="checkbox" name="preani" ${u.preani ? 'checked' : ''}> Agentes certificados PREANI (CIV / UCAB)</label>
      <div class="stack" style="gap:8px"><b>Zonas que atiendes</b><span class="muted" style="font-size:.88rem">Los contactos de estas zonas se asignan a tu equipo.</span><div class="pills">${ZONES.map(z => `<label class="pill"><input type="checkbox" name="zones" data-group="zones" value="${z.id}" ${u.zones.includes(z.id) ? 'checked' : ''}><span>${esc(z.name)}</span></label>`).join('')}</div></div>` : ''}
      <button class="btn btn-primary" style="justify-self:start">Guardar</button></form>`;
    $('#pf', box).addEventListener('submit', async e => { e.preventDefault(); try { await patch('/api/me', formData(e.target)); toast('Perfil actualizado.'); await ctx.refreshUser(); } catch (err) { toast(err.message, 'err'); } });
  },

  async admin(box, ctx) {
    const [queue, stats] = await Promise.all([get('/api/admin/queue'), get('/api/admin/stats')]);
    box.innerHTML = `<h2 style="font-size:1.6rem">Administración</h2>
      <div class="kpis"><div class="kpi"><span>Usuarios</span><b>${stats.users}</b></div><div class="kpi"><span>Avisos activos</span><b>${stats.listings}</b></div><div class="kpi"><span>Ingreso recurrente (MRR)</span><b>${fmtUsd(stats.mrr)}</b></div><div class="kpi"><span>Contactos generados</span><b>${stats.leads}</b></div></div>
      <div class="panel stack" style="gap:12px"><div class="row between"><h3>Tasa oficial BCV</h3><span class="tag ${ctx.meta.rateError ? 'tag-bad' : 'tag-ok'}">${ctx.meta.rateError ? 'Última lectura fallida' : 'Al día'}</span></div>
        <p class="muted" style="font-size:.9rem"><b class="mono">${ctx.meta.rate.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs./USD</b> · fuente: ${esc(ctx.meta.rateSourceLabel)} · ${new Date(ctx.meta.rateUpdatedAt).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        ${ctx.meta.rateError ? `<p style="color:var(--danger);font-size:.85rem">Intento del ${new Date(ctx.meta.rateErrorAt).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })}: ${esc(ctx.meta.rateError)}. Se mantiene la última tasa válida.</p>` : ''}
        <label class="check"><input type="checkbox" id="rate-auto" ${ctx.meta.rateAuto ? 'checked' : ''}> Actualizar automáticamente cada 6 horas desde el BCV (respaldo: DolarApi)</label>
        <div class="row"><button class="btn" id="rate-now" type="button">Leer tasa ahora</button></div>
        <form class="row" id="rate-f" style="align-items:end"><label style="flex:1">Cargar manualmente (Bs. por USD)<input class="input" name="rate" type="number" step="0.01" value="${ctx.meta.rate}"></label><button class="btn btn-primary">Guardar tasa</button></form></div>
      <div class="stack"><h3>Cola de verificación de títulos (${queue.length})</h3>${queue.length ? queue.map(l => `<div class="panel stack" data-q="${l.id}"><div class="row between"><div><a href="#/inmueble/${l.id}"><b>${esc(l.title)}</b></a><div class="faint" style="font-size:.85rem">${l.id} · ${esc(l.owner?.name || '')} · ${esc(l.address)}</div></div><span class="tag tag-warn">En revisión</span></div><div class="docs-list">${(l.docs || []).map(d => `<div class="doc-row"><span>${icon('doc')} ${esc(DOC_KINDS[d.kind] || d.kind)}</span>${d.url ? `<a class="btn btn-sm" target="_blank" rel="noopener" href="${esc(d.url)}">Abrir</a>` : `<span class="faint">${esc(d.name)}</span>`}</div>`).join('')}</div><input class="input" placeholder="Nota para el anunciante (opcional)" data-note><div class="row"><button class="btn btn-trust" data-ok>${icon('shield')} Otorgar sello</button><button class="btn" data-ko>Rechazar</button></div></div>`).join('') : '<p class="muted">No hay expedientes pendientes.</p>'}</div>
      <div class="grid grid-2"><div class="stack"><h3>Ingresos por línea</h3><div class="bars">${Object.entries(stats.revenue).map(([k, v]) => { const max = Math.max(1, ...Object.values(stats.revenue)); return `<div class="bar-row"><span>${{ plan: 'Planes', boost: 'Visibilidad', slot: 'Avisos particulares', diligence: 'Due diligence', lead: 'Pago por lead' }[k] || k}</span><div class="track"><i style="width:${(v / max) * 100}%"></i></div><span class="mono" style="text-align:right">${fmtUsd(v)}</span></div>`; }).join('') || '<p class="muted">Sin ingresos registrados.</p>'}</div></div>
      <div class="stack"><h3>Usuarios por tipo</h3><div class="bars">${Object.entries(stats.byRole).map(([k, v]) => `<div class="bar-row"><span>${esc(ctx.meta.roles[k])}</span><div class="track"><i style="width:${(v / stats.users) * 100}%"></i></div><span class="mono" style="text-align:right">${v}</span></div>`).join('')}</div></div></div>
      ${stats.services.length ? `<div class="stack"><h3>Solicitudes de servicios para el hogar</h3><div class="table-wrap"><table><thead><tr><th>Servicio</th><th>Nombre</th><th>Teléfono</th><th>Ciudad</th><th>Fecha</th></tr></thead><tbody>${stats.services.map(s => `<tr><td>${esc(ctx.meta.services[s.category])}</td><td>${esc(s.name)}</td><td>${esc(s.phone)}</td><td>${esc(s.city)}</td><td>${fmtDate(s.createdAt)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
    const after = async msg => { const { refreshMeta } = await import('../app.js'); await refreshMeta(); toast(msg); reload(ctx); };
    $('#rate-f', box).addEventListener('submit', async e => { e.preventDefault(); try { await post('/api/admin/rate', { rate: Number(e.target.rate.value) }); await after('Tasa guardada.'); } catch (err) { toast(err.message, 'err'); } });
    $('#rate-now', box).addEventListener('click', async () => { try { const r = await post('/api/admin/rate/refresh'); await after(`Tasa leída: ${r.rate} Bs./USD.`); } catch (err) { toast(err.message, 'err'); } });
    $('#rate-auto', box).addEventListener('change', async e => { try { await post('/api/admin/rate/auto', { auto: e.target.checked }); await after(e.target.checked ? 'Actualización automática activada.' : 'Actualización automática desactivada.'); } catch (err) { toast(err.message, 'err'); } });
    $$('[data-q]', box).forEach(p => {
      const go = async approve => { await post(`/api/admin/listings/${p.dataset.q}/verify`, { approve, note: $('[data-note]', p).value }); toast(approve ? 'Sello otorgado.' : 'Expediente rechazado.'); reload(ctx); };
      $('[data-ok]', p).addEventListener('click', () => go(true));
      $('[data-ko]', p).addEventListener('click', () => go(false));
    });
  },
};

function searchList(s) {
  return `<div class="docs-list">${s.map(x => `<div class="doc-row" data-sid="${x.id}"><span class="stack" style="gap:2px"><b>${esc(x.name)}</b><span class="faint" style="font-size:.82rem">${x.total} resultados${x.fresh ? ` · <span style="color:var(--trust)">${x.fresh} nuevos</span>` : ''}</span></span><span class="row" style="gap:6px"><button class="btn btn-sm" data-open>Ver</button><button class="btn btn-sm btn-ghost" data-rm aria-label="Eliminar">${icon('x')}</button></span></div>`).join('')}</div>`;
}
function bindSearches(box, ctx) {
  $$('[data-sid]', box).forEach(row => {
    $('[data-open]', row).addEventListener('click', async () => {
      const list = await get('/api/searches');
      const s = list.find(x => x.id === row.dataset.sid);
      await post(`/api/searches/${s.id}/seen`);
      ctx.go('#/buscar?' + new URLSearchParams(s.query));
    });
    $('[data-rm]', row).addEventListener('click', async () => { await del('/api/searches/' + row.dataset.sid); row.remove(); toast('Búsqueda eliminada.'); });
  });
}

function docsModal(l, ctx) {
  const pending = [];
  modal(`<span class="eyebrow">Expediente · ${l.id}</span><h3>Documentos para el sello de título verificado</h3><div class="docs-list">${Object.entries(DOC_KINDS).map(([k, v]) => `<div class="doc-row"><span>${v}</span><label class="btn btn-sm" style="cursor:pointer"><span>Subir</span><input type="file" hidden data-k="${k}" accept="application/pdf,image/*"></label></div>`).join('')}</div><button class="btn btn-primary" id="send">Enviar a revisión</button>`, {
    onMount(body, close) {
      $$('[data-k]', body).forEach(i => i.addEventListener('change', async () => {
        const f = i.files[0]; if (!f) return;
        const { readFileAsDataUrl, readImage } = await import('../ui.js');
        const { mode } = await import('../api.js');
        const dataUrl = mode.server ? (f.type.startsWith('image/') ? await readImage(f, 1600, 0.8) : await readFileAsDataUrl(f)) : null;
        pending.push({ kind: i.dataset.k, name: f.name, dataUrl });
        i.previousElementSibling.textContent = 'Cargado ✓';
      }));
      $('#send', body).addEventListener('click', async () => {
        if (!pending.length) { toast('Elige al menos un archivo.', 'err'); return; }
        try { const r = await post(`/api/listings/${l.id}/documents`, { docs: pending }); close(); toast(r.listing.verification === 'pending' ? 'Expediente enviado a revisión legal.' : r.listing.verificationNote); reload(ctx); }
        catch (e) { toast(e.message, 'err'); }
      });
    },
  });
}
