import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, emptyDb, seedDb } from '../shared/engine.js';
import { buildLeaseContract, maintenanceSplit, estimateValue, inPolygon } from '../shared/core.js';

const boot = async () => createEngine({ db: await seedDb(emptyDb()) });
const login = async (e, email) => (await e.handle('POST', '/api/auth/login', { body: { email, password: 'morada2026' } })).body.token;

test('búsqueda filtra por operación, zona y polígono', async () => {
  const e = await boot();
  const all = (await e.handle('GET', '/api/listings', { query: { op: 'venta', zone: 'altamira' } })).body;
  assert.ok(all.total > 0 && all.items.every(l => l.op === 'venta' && l.zone === 'altamira'));
  const poly = '10.40,-67.0;10.60,-67.0;10.60,-66.7;10.40,-66.7';
  const inside = (await e.handle('GET', '/api/listings', { query: { poly, limit: 60 } })).body;
  assert.ok(inside.items.every(l => l.city === 'Caracas'));
});

test('el particular tiene un aviso gratis y luego debe comprar', async () => {
  const e = await boot();
  const r = await e.handle('POST', '/api/auth/register', { body: { name: 'Ana', email: 'ana@x.com', password: '12345678', role: 'particular' } });
  const token = r.body.token;
  const body = { op: 'alquiler', type: 'apartamento', zone: 'chacao', priceUsd: 500, area: 70 };
  assert.equal((await e.handle('POST', '/api/listings', { token, body })).status, 200);
  assert.equal((await e.handle('POST', '/api/listings', { token, body })).status, 402);
  await e.handle('POST', '/api/me/slots', { token, body: { qty: 1 } });
  assert.equal((await e.handle('POST', '/api/listings', { token, body })).status, 200);
});

test('la red B2B y los contratos requieren Agency Pro Max', async () => {
  const e = await boot();
  const costa = await login(e, 'costa@morada.demo');
  assert.equal((await e.handle('GET', '/api/network/listings', { token: costa })).status, 402);
  assert.equal((await e.handle('POST', '/api/contracts', { token: costa, body: {} })).status, 402);
  const intl = await login(e, 'internacional@morada.demo');
  const net = (await e.handle('GET', '/api/network/listings', { token: intl })).body;
  const ref = await e.handle('POST', '/api/network/referrals', { token: intl, body: { listingId: net[0].id, split: 0.9 } });
  assert.equal(ref.body.split, 0.4);
});

test('pagos en bolívares se concilian a la tasa indicada', async () => {
  const e = await boot();
  const t = await login(e, 'agencia@morada.demo');
  const p = (await e.handle('POST', '/api/payments', { token: t, body: { tenant: 'X', amountUsd: 100, dueDate: '2026-12-01' } })).body;
  const r = (await e.handle('POST', `/api/payments/${p.id}/pay`, { token: t, body: { currency: 'ves', amount: 23650, rate: 236.5 } })).body;
  assert.equal(r.status, 'pagado');
});

test('reglas de la Ley 2026', () => {
  const c = buildLeaseContract({ rentUsd: 500, depositMonths: 6 }, 200);
  assert.equal(c.deposit, 3);
  assert.equal(c.warnings.length, 1);
  assert.deepEqual(maintenanceSplit(150, 500), { tenant: 150, landlord: 0 });
  assert.deepEqual(maintenanceSplit(151, 500), { tenant: 0, landlord: 151 });
});

test('AVM y geometría', () => {
  const v = estimateValue({ zone: 'altamira', area: 100 }, []);
  assert.equal(v.confidence, 'baja');
  assert.ok(v.estimate > 100000);
  assert.ok(inPolygon(0.5, 0.5, [[0, 0], [1, 0], [1, 1], [0, 1]]));
  assert.ok(!inPolygon(2, 2, [[0, 0], [1, 0], [1, 1], [0, 1]]));
});

test('lectura de la tasa BCV', async () => {
  const { parseBcvHtml, parseDolarApi, plausible, fetchOfficialRate } = await import('../shared/rates.js');
  const html = '<div id="dolar" class="col-sm-12"><div class="field-content"><div class="row recuadrotsmc"><div class="col-sm-6 col-xs-6"><span> USD</span></div><div class="col-sm-6 col-xs-6 centrado"><strong> 236,45780000 </strong></div></div></div></div>';
  assert.equal(parseBcvHtml(html), 236.46);
  assert.equal(parseBcvHtml('<html></html>'), null);
  assert.equal(parseDolarApi({ promedio: 240.12 }), 240.12);
  assert.ok(plausible(250, 236) && !plausible(500, 236));
  const fake = async url => url.includes('bcv') ? { ok: false, status: 503 } : { ok: true, json: async () => ({ promedio: 238.4 }) };
  assert.deepEqual(await fetchOfficialRate(fake), { rate: 238.4, source: 'dolarapi' });
  const e = createEngine({ db: await seedDb(emptyDb()), fetchRate: async () => ({ rate: 241.5, source: 'bcv' }) });
  const s = await e.refreshRate();
  assert.equal(s.rate, 241.5); assert.equal(s.rateSource, 'bcv');
});
