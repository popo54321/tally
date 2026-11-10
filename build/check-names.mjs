// Fails if a not-yet-typed .js file under src/ uses a name that is neither defined nor imported,
// which happens easily while moving code between files.
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
import fs from 'node:fs';
const FILES = [];
(function walk(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); fs.statSync(p).isDirectory() ? walk(p) : (n.endsWith('.js') && !['boot.js', 'sw.js'].includes(n)) && FILES.push(p); } })(path.join(ROOT, 'src'));
const program = ts.createProgram(FILES, { allowJs: true, checkJs: true, noEmit: true, target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, lib: ['lib.es2021.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'], skipLibCheck: true });
const missing = FILES.flatMap(f => { const sf = program.getSourceFile(f);
  return ts.getPreEmitDiagnostics(program, sf).filter(d => d.code === 2304 || d.code === 2552)   // cannot find name
    .map(d => { const { line } = sf.getLineAndCharacterOfPosition(d.start); return `${path.relative(ROOT, f)}:${line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`; }); });
if (missing.length) { console.error('Names used but not defined or imported:\n' + missing.join('\n')); process.exit(1); }
console.log(`names ok (${FILES.length} files)`);
