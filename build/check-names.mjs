// Fails if the not-yet-typed old code (src/legacy) uses a name that is neither defined nor imported,
// which happens easily while moving code out of it.
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src/legacy/app.js');
const program = ts.createProgram([FILE], { allowJs: true, checkJs: true, noEmit: true, target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, lib: ['lib.es2021.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'], skipLibCheck: true });
const sf = program.getSourceFile(FILE);
const missing = ts.getPreEmitDiagnostics(program, sf).filter(d => d.code === 2304 || d.code === 2552)   // cannot find name
  .map(d => { const { line } = sf.getLineAndCharacterOfPosition(d.start); return `src/legacy/app.js:${line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`; });
if (missing.length) { console.error('Names used but not defined or imported:\n' + missing.join('\n')); process.exit(1); }
console.log('names ok');
