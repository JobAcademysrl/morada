// Acceso y registro con selección del tipo de cliente.
import { post, session } from '../api.js';
import { $, $$, esc, icon, toast, formData } from '../ui.js';

const DEMO = [
  ['agencia@morada.demo', 'Agencia · Pro Max', 'Ávila Propiedades'],
  ['costa@morada.demo', 'Agencia · Professional', 'Costa Norte'],
  ['constructora@morada.demo', 'Constructora', 'Tepuy Desarrollos'],
  ['propietario@morada.demo', 'Propietaria particular', 'María F. Rojas'],
  ['internacional@morada.demo', 'Broker internacional', 'Bayfront Referral'],
  ['comprador@morada.demo', 'Comprador en España', 'Luis A. Pérez'],
  ['admin@morada.demo', 'Administración', 'Equipo legal'],
];

export async function auth(el, ctx) {
  const isRegister = ctx.path === '/registro';
  const next = ctx.query.next ? decodeURIComponent(ctx.query.next) : '#/panel';
  const role = ctx.query.role && ctx.meta.roles[ctx.query.role] && ctx.query.role !== 'admin' ? ctx.query.role : 'particular';
  el.innerHTML = `<div class="auth-wrap">
    <div class="auth-art"><div class="stack" style="gap:14px;max-width:420px"><span class="eyebrow" style="color:#ffe0a8">Morada</span><h2 style="color:#fff">${isRegister ? 'Una cuenta para cada forma de mover el mercado' : 'Bienvenido de vuelta'}</h2><p style="color:rgba(255,255,255,.82)">Propietarios, agencias certificadas, constructoras, brokers internacionales y compradores de la diáspora trabajan sobre los mismos avisos verificados.</p></div></div>
    <div class="auth-form"><div>
      <div class="stack" style="gap:6px"><h1 style="font-size:2rem">${isRegister ? 'Crear cuenta' : 'Entrar'}</h1><p class="muted">${isRegister ? '¿Ya tienes cuenta? <a href="#/entrar">Entra aquí</a>' : '¿Nuevo en Morada? <a href="#/registro">Crea tu cuenta</a>'}</p></div>
      <form id="af" class="stack" novalidate>
        ${isRegister ? `<div class="stack" style="gap:8px"><b style="font-size:.9rem">Soy…</b><div class="pills">${Object.entries(ctx.meta.roles).filter(([k]) => k !== 'admin').map(([k, v]) => `<label class="pill"><input type="radio" name="role" value="${k}" ${k === role ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>
        <label>Nombre y apellido<input class="input" name="name" required autocomplete="name"></label>
        <label data-pro>Empresa<input class="input" name="company" autocomplete="organization"></label>
        <label data-only="agencia">N° de afiliación CIV o cámara regional<input class="input" name="civ" placeholder="CIV-MET-0000"></label>
        <label data-only="internacional">Licencia o registro profesional<input class="input" name="license" placeholder="Real Estate Broker, REA, colegiación API…"></label>
        <label>Teléfono / WhatsApp<input class="input" name="phone" type="tel" autocomplete="tel" placeholder="+58 412 000 0000"></label>
        <label>País de residencia<input class="input" name="country" value="${role === 'internacional' || role === 'comprador' ? '' : 'Venezuela'}"></label>` : ''}
        <label>Correo electrónico<input class="input" name="email" type="email" required autocomplete="email"></label>
        <label>Contraseña<input class="input" name="password" type="password" required minlength="8" autocomplete="${isRegister ? 'new-password' : 'current-password'}"></label>
        <button class="btn btn-primary btn-block">${isRegister ? 'Crear cuenta' : 'Entrar'}</button>
      </form>
      ${isRegister ? '' : `<div class="stack" style="gap:8px"><span class="muted" style="font-size:.88rem">Cuentas de demostración (contraseña <span class="mono">morada2026</span>):</span><div class="demo-accounts">${DEMO.map(([e, r, n]) => `<button data-demo="${e}"><span><b>${r}</b> · ${esc(n)}</span><span class="faint mono" style="font-size:.78rem">${e}</span></button>`).join('')}</div></div>`}
    </div></div>
  </div>`;

  const f = $('#af', el);
  const syncRole = () => {
    if (!isRegister) return;
    const r = f.role.value;
    $$('[data-pro]', f).forEach(x => (x.hidden = !['agencia', 'constructora', 'internacional'].includes(r)));
    $$('[data-only]', f).forEach(x => (x.hidden = x.dataset.only !== r));
  };
  if (isRegister) $$('input[name=role]', f).forEach(i => i.addEventListener('change', syncRole));
  syncRole();

  const done = async r => {
    session.token = r.token; session.user = r.user;
    await ctx.refreshUser();
    toast(`Hola, ${r.user.name.split(' ')[0]}.`);
    if (ctx.query.plan && isRegister) location.hash = '#/panel/plan';
    else location.hash = next.startsWith('#') ? next : '#/panel';
  };
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = formData(f);
    try { await done(await post(isRegister ? '/api/auth/register' : '/api/auth/login', d)); }
    catch (err) { toast(err.message, 'err'); }
  });
  $$('[data-demo]', el).forEach(b => b.addEventListener('click', async () => {
    try { await done(await post('/api/auth/login', { email: b.dataset.demo, password: 'morada2026' })); }
    catch (err) { toast(err.message, 'err'); }
  }));
  $('input', f)?.focus();
  void icon;
}
