// Builds the app into one file, as the web host and the Android app expect:
//   dist/index.html  page + styles + scripts all inline, with its security policy filled in
//   dist/sw.js       the offline helper, with a cache name that changes whenever any shipped file changes
// Usage: node build/build.mjs            (normal build)
//        node build/build.mjs --check    (also fail if dist/ would change, for CI)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src'), DIST = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

// The app's code: everything reachable from src/main.ts, joined into one classic script.
const bundle = await esbuild.build({
  entryPoints: [path.join(SRC, 'main.ts')], bundle: true, write: false, format: 'iife',
  target: ['chrome90', 'safari15'], charset: 'utf8', legalComments: 'none', minify: false,
  logLevel: 'warning',
});
const appJs = bundle.outputFiles[0].text.replace(/\n$/, '');

let html = read('index.html');
const fill = (marker, text) => {
  if (html.split(marker).length !== 2) throw new Error('build: marker ' + marker + ' must appear exactly once');
  html = html.replace(marker, () => text.replace(/\n$/, ''));
};
fill('<!--BOOT-->', read('platform/boot.js'));
fill('<!--FONTS-->', read('styles/fonts.css'));
fill('<!--APP_CSS-->', read('styles/app.css'));
fill('<!--APP_JS-->', appJs);
if (/<\/script>/i.test(appJs)) throw new Error('build: the app code contains </script>, which would end the inline script early');

// Security policy: the browser runs only the inline scripts whose fingerprints are listed here.
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const sha = s => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";
const policy = ["default-src 'self'", 'script-src ' + scripts.map(sha).join(' '), "style-src 'self' 'unsafe-inline'", "font-src 'self'",
  "img-src 'self' data:", "connect-src 'none'", "worker-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"].join('; ');
fill('<!--CSP-->', '<meta http-equiv="Content-Security-Policy" content="' + policy + '">');

// Offline helper: its cache name is a fingerprint of every file it stores, so phones fetch a fresh copy after each release.
const SHIPPED = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'icon.svg', 'icon-maskable.svg',
  ...fs.readdirSync(path.join(ROOT, 'fonts')).sort().map(f => 'fonts/' + f)];
const h = crypto.createHash('sha256').update(html);
for (const f of SHIPPED) h.update(fs.readFileSync(path.join(ROOT, f)));
const sw = read('platform/sw.js').replace('__CACHE__', 'tally-' + h.digest('hex').slice(0, 12));

const out = { 'index.html': html, 'sw.js': sw };
if (process.argv.includes('--check')) {
  const stale = Object.keys(out).filter(f => !fs.existsSync(path.join(DIST, f)) || fs.readFileSync(path.join(DIST, f), 'utf8') !== out[f]);
  if (stale.length) { console.error('build --check: dist/ is out of date: ' + stale.join(', ')); process.exit(1); }
} else {
  fs.mkdirSync(DIST, { recursive: true });
  for (const f in out) fs.writeFileSync(path.join(DIST, f), out[f]);
}
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KB, ${scripts.length} scripts) and dist/sw.js`);
