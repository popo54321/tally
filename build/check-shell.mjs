// Guards the Android app shell. The app updates its own files without an install only while the shell stays
// the same (see android/.../Updater.java). If native code or the manifest changes, decide: raise
// android/app/shell-version when the page needs the change (then a full install is offered), and record the
// new fingerprint either way:   node build/check-shell.mjs --update
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const A = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../android/app');
const JAVA = path.join(A, 'java/com/bodyandiron/traininglog');
const files = [path.join(A, 'AndroidManifest.xml'), ...fs.readdirSync(JAVA).filter(f => f.endsWith('.java')).sort().map(f => path.join(JAVA, f))];
const h = crypto.createHash('sha256');
for (const f of files) h.update(path.relative(A, f) + '\n' + fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') + '\n');
const now = h.digest('hex');
const shell = fs.readFileSync(path.join(A, 'shell-version'), 'utf8').trim();
const inJava = (fs.readFileSync(path.join(JAVA, 'Updater.java'), 'utf8').match(/static final int SHELL = (\d+);/) || [])[1];
const hashFile = path.join(A, 'shell-hash');
if (process.argv.includes('--update')) { fs.writeFileSync(hashFile, `${shell} ${now}\n`); console.log(`shell ${shell}: fingerprint recorded`); process.exit(0); }
const bad = [];
if (inJava !== shell) bad.push(`Updater.java says SHELL = ${inJava}, android/app/shell-version says ${shell}: make them the same`);
const [recShell, recHash] = (fs.existsSync(hashFile) ? fs.readFileSync(hashFile, 'utf8').trim() : '').split(' ');
if (recHash !== now) bad.push('the Android shell changed (native code or manifest). If the page relies on the change, raise android/app/shell-version (and SHELL in Updater.java); then record it: node build/check-shell.mjs --update');
else if (recShell !== shell) bad.push('shell-version changed without recording it: node build/check-shell.mjs --update');
if (bad.length) { console.error('Shell check:\n- ' + bad.join('\n- ')); process.exit(1); }
console.log(`shell ${shell} ok`);
