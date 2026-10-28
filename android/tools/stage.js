const fs = require('fs');
const path = require('path');
const { withCsp, check } = require('./csp');

const OUT = process.argv[2];
if (!OUT) { console.error('usage: node tools/stage.js <outdir>'); process.exit(1); }
const ROOT = path.join(__dirname, '..');

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name), d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyTree(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
const SRC = path.resolve(process.argv[3] || path.join(ROOT, 'app/assets/index.html'));
copyTree(path.join(path.dirname(SRC), 'fonts'), path.join(OUT, 'assets/fonts'));
copyTree(path.join(ROOT, 'app/res'), path.join(OUT, 'res'));

const PAGE = path.join(OUT, 'assets/index.html');
const raw = fs.readFileSync(SRC, 'utf8');
const page = /http-equiv="Content-Security-Policy"/.test(raw) ? raw : withCsp(raw, { fonts: 'local' });
const c = check(page);
if (!c.ok) { console.error('stage: the staged page fails its own policy (' + (c.why || c.missing + ' script(s) unlisted') + ')'); process.exit(1); }
fs.writeFileSync(PAGE, page);
console.log('stage: ' + OUT + ' from ' + path.relative(process.cwd(), SRC) + '  [Tally Pro, Content-Security-Policy checked]');
