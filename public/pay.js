// Cobro desde la interfaz. En modo demo (sin pasarela) la compra se aplica al instante;
// con pasarela el usuario elige método: tarjeta (Stripe) o pago local verificado por el equipo.
import { get, post } from './api.js';
import { $, $$, esc, icon, toast, modal, store, fmtUsd, fmtVes } from './ui.js';

// Paga y llama a done(respuesta) solo cuando la compra quedó aplicada.
// El importe lo calcula el servidor (por ejemplo, un destacado incluido en el plan cuesta 0).
export async function pay(ctx, { path, body = {}, done }) {
  if (!ctx.meta.checkout?.live) return done?.(await post(path, body));
  const [{ quote }, opts] = await Promise.all([post(path, { ...body, quote: true }), get('/api/pay/options')]);
  const { amountUsd, title } = quote;
  if (amountUsd === 0) return done?.(await post(path, body));
  if (!opts.methods.length) {
    modal(`<span class="eyebrow">Pago</span><h3>${esc(title)}</h3><p class="muted">Los pagos en línea no están disponibles en este momento. Escríbenos y te ayudamos a completar la compra.</p>`);
    return;
  }
  const ves = usd => fmtVes(Math.round(usd * opts.rate * 100) / 100);
  modal(`<span class="eyebrow">Pago seguro</span><h3>${esc(title)}</h3>
    <p class="row between pay-total"><span class="muted">Total</span><b class="mono">${fmtUsd(amountUsd)}</b></p>
    <div class="pay-methods">${opts.methods.map(m => `<button class="pay-method" data-m="${m.id}"><span class="stack" style="gap:2px"><b>${esc(m.name)}</b><span class="faint">${esc(m.desc)}</span></span><span class="mono">${m.currency === 'ves' ? ves(amountUsd) : fmtUsd(amountUsd)}</span></button>`).join('')}</div>
    <div id="pay-step"></div>`, {
    onMount(el, close) {
      const step = $('#pay-step', el);
      $$('[data-m]', el).forEach(b => b.addEventListener('click', async () => {
        $$('[data-m]', el).forEach(x => x.classList.toggle('on', x === b));
        const m = opts.methods.find(x => x.id === b.dataset.m);
        if (m.id === 'card') {
          b.disabled = true;
          try {
            const r = await post(path, { ...body, method: 'card', returnUrl: location.href.split('#')[0] });
            store.set('pendingOrder', r.order.id);
            location.href = r.checkoutUrl;
          } catch (e) { b.disabled = false; toast(e.message, 'err'); }
          return;
        }
        const amount = m.currency === 'ves' ? `${ves(amountUsd)} <span class="faint">(${fmtUsd(amountUsd)} a ${opts.rate.toLocaleString('es-VE')} Bs./USD)</span>` : fmtUsd(amountUsd);
        step.innerHTML = `<div class="panel stack" style="gap:10px;margin-top:14px"><b>1. Envía ${amount}</b>
          <div class="pay-info">${m.fields.map(([k, label]) => `<span class="faint">${esc(label)}</span><span class="mono" style="user-select:all;overflow-wrap:anywhere">${esc(m.info?.[k] || '')}</span>`).join('')}</div>
          <form class="stack" id="pay-ref" style="gap:10px"><label><b>2. Escribe la referencia del pago</b><input class="input" name="reference" required minlength="4" maxlength="120" placeholder="${m.id === 'usdt' ? 'Hash de la transacción' : 'Número de referencia u operación'}"></label>
          <button class="btn btn-primary">${icon('check')} Ya pagué, enviar para verificar</button>
          <p class="faint" style="font-size:.82rem;margin:0">Nuestro equipo confirma el pago, normalmente en menos de 24 horas. Verás el estado en Mi panel › Mis pagos.</p></form></div>`;
        $('#pay-ref', step).addEventListener('submit', async e => {
          e.preventDefault();
          try {
            await post(path, { ...body, method: m.id, reference: e.target.reference.value });
            close(); toast('Pago enviado. Te avisaremos cuando quede confirmado.');
            ctx.go('#/panel/facturas');
          } catch (err) { toast(err.message, 'err'); }
        });
        $('input', step).focus();
      }));
    },
  });
}

// Al volver de Stripe: consulta la orden y la confirma si el pago se completó.
export async function checkReturn(ctx) {
  const id = store.get('pendingOrder');
  if (!id || !ctx.user) return;
  store.del('pendingOrder');
  try {
    const o = await post(`/api/orders/${id}/refresh`);
    if (o.status === 'paid') { toast('Pago confirmado. ¡Gracias!'); await ctx.refreshUser(); }
    else if (o.status === 'pending') toast('Estamos esperando la confirmación del pago con tarjeta.');
  } catch { /* la orden se puede revisar en Mis pagos */ }
}
