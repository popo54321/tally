// Tiny static server for the tests.
//   /old/...  the frozen 8.1 app (legacy/index.html), other files from the repo root
//   /new/...  the rebuilt app (dist/index.html once it exists), other files from dist/ then the repo root
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };

function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\.\.+/g, '');
  const m = clean.match(/^\/(old|new)(\/.*)?$/);
  if (!m) return null;
  let rest = (m[2] || '/').replace(/^\/+/, '');
  if (rest === '' || rest === 'index.html') return m[1] === 'old' ? [path.join(ROOT, 'legacy/index.html')] : [path.join(ROOT, 'dist/index.html')];
  return m[1] === 'new' ? [path.join(ROOT, 'dist', rest), path.join(ROOT, rest)] : [path.join(ROOT, rest)];
}

export function start(port = 0) {
  const server = http.createServer((req, res) => {
    const files = resolve(req.url || '/') || [];
    const file = files.find(f => f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile());
    if (!file) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(ok => server.listen(port, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start(+process.argv[2] || 8790).then(({ url }) => console.log('serving', url + '/old/', 'and', url + '/new/'));
}
