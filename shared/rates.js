// Lectura automática de la tasa oficial del BCV. Dos fuentes: la página del BCV y DolarApi (JSON).
// Las funciones de parseo son puras para poder probarlas sin red.

export const RATE_SOURCES = {
  bcv: { url: 'https://www.bcv.org.ve/', label: 'Banco Central de Venezuela' },
  dolarapi: { url: 'https://ve.dolarapi.com/v1/dolares/oficial', label: 'DolarApi (oficial BCV)' },
};

const toNumber = s => Number(String(s).trim().replace(/\./g, '').replace(',', '.'));

// En la portada del BCV la tasa del dólar está en <div id="dolar"> ... <strong> 236,45780000 </strong>.
export function parseBcvHtml(html) {
  const block = /id=["']dolar["'][\s\S]{0,1500}?<strong>\s*([\d.,]+)\s*<\/strong>/i.exec(html);
  const n = block ? toNumber(block[1]) : NaN;
  return n > 0 ? Math.round(n * 100) / 100 : null;
}

export function parseDolarApi(json) {
  const n = Number(json?.promedio ?? json?.venta ?? json?.compra);
  return n > 0 ? Math.round(n * 100) / 100 : null;
}

// Una tasa nueva que difiere más de 40 % de la anterior se descarta: suele ser un error de lectura.
export function plausible(next, prev) {
  if (!(next > 0)) return false;
  if (!(prev > 0)) return true;
  return Math.abs(next / prev - 1) <= 0.4;
}

export async function fetchOfficialRate(fetchFn = globalThis.fetch, order = ['bcv', 'dolarapi']) {
  const errors = [];
  for (const id of order) {
    try {
      const res = await fetchFn(RATE_SOURCES[id].url, { headers: { 'User-Agent': 'Morada/1.0 (+tasa BCV)' }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rate = id === 'bcv' ? parseBcvHtml(await res.text()) : parseDolarApi(await res.json());
      if (rate) return { rate, source: id };
      throw new Error('formato no reconocido');
    } catch (e) { errors.push(`${RATE_SOURCES[id].label}: ${e.message === 'fetch failed' || e.name === 'TimeoutError' ? 'sin conexión con la fuente' : e.message}`); }
  }
  throw new Error(errors.join(' · '));
}
