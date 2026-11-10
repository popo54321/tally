// Fails if any file imports from a folder its layer may not use (see src/README.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const ALLOWED = {
  core: ['core', 'data'],
  data: ['data'],
  i18n: [],
  store: ['core', 'data', 'store'],
  state: ['core', 'data', 'store', 'state'],
  ui: ['core', 'data', 'store', 'state', 'ui', 'i18n', 'platform'],
  platform: ['core', 'data', 'platform'],
  '.': null,      // main.ts wires everything together
};

const files = [];
(function walk(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); fs.statSync(p).isDirectory() ? walk(p) : /\.(ts|js|mjs)$/.test(n) && files.push(p); } })(SRC);

const bad = [];
for (const f of files) {
  const rel = path.relative(SRC, f), layer = rel.includes(path.sep) ? rel.split(path.sep)[0] : '.';
  const allowed = ALLOWED[layer];
  if (allowed === undefined) { bad.push(`${rel}: folder "${layer}" is not a known layer`); continue; }
  if (allowed === null) continue;
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]|\bimport\s+['"](\.[^'"]+)['"]/g)) {
    const target = path.relative(SRC, path.resolve(path.dirname(f), m[1] || m[2]));
    const tl = target.split(path.sep)[0];
    if (tl !== layer && !allowed.includes(tl)) bad.push(`${rel}: may not import from ${tl}/ (${m[1] || m[2]})`);
  }
}
if (bad.length) { console.error('Layer rules broken:\n' + bad.join('\n')); process.exit(1); }
console.log(`layers ok (${files.length} files)`);
