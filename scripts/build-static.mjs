// Genera una versión estática (modo demo, sin servidor) en dist/: el motor corre en el navegador.
// Uso: node scripts/build-static.mjs
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(join(ROOT, 'public'), OUT, { recursive: true });
await cp(join(ROOT, 'shared'), join(OUT, 'shared'), { recursive: true });

// Variante de página única con los estilos en línea (para alojamientos que solo admiten scripts externos).
const html = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
const css = (await Promise.all(['vendor/leaflet.css', 'vendor/MarkerCluster.css', 'styles.css', 'theme-portal.css'].map(f => readFile(join(ROOT, 'public', f), 'utf8')))).join('\n');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\n?/, '').replace(/<meta name="viewport"[^>]*>\n?/, '')
  .replace(/<link rel="stylesheet" href="(vendor\/[^"]+|styles\.css|theme-portal\.css)">\n?/g, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
await writeFile(join(OUT, 'inline.html'), `${head.trim()}\n<style>\n${css}\n</style>\n${body.trim()}\n`);
console.log('dist/ listo');
