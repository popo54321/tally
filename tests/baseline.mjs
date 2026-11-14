// The baseline version (tests/baseline.json) unpacked into tests/.baseline/: its built app (index.html) for the
// picture checks, and its src/ for the calculation checks. Unpacked again only when the baseline moves.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BASE_DIR = path.join(ROOT, 'tests/.baseline');
export const baseline = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/baseline.json'), 'utf8'));

export function ensureBaseline() {
  const { ref } = baseline(), mark = path.join(BASE_DIR, '.ref');
  if (fs.existsSync(mark) && fs.readFileSync(mark, 'utf8') === ref) return BASE_DIR;
  fs.rmSync(BASE_DIR, { recursive: true, force: true });
  fs.mkdirSync(BASE_DIR, { recursive: true });
  let tar;
  try { tar = execFileSync('git', ['archive', ref, 'index.html', 'src'], { cwd: ROOT, maxBuffer: 1 << 28 }); }
  catch (e) { throw new Error(`baseline ${ref} is not in this checkout (in CI, fetch the full history): ${e.message}`); }
  execFileSync('tar', ['-x', '-C', BASE_DIR], { input: tar });
  fs.writeFileSync(mark, ref);
  return BASE_DIR;
}
/** The version number a built index.html says it is. */
export const versionOf = file => (fs.readFileSync(file, 'utf8').match(/APP_VERSION = ["']([0-9.]+)/) || [])[1] || '';
