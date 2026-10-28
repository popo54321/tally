const crypto = require('crypto');

function inlineScripts(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
}
const sha = s => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";

function policy(html, opts) {
  const google = opts && opts.fonts === 'google';
  return [
    "default-src 'self'",
    'script-src ' + inlineScripts(html).map(sha).join(' '),
    "style-src 'self' 'unsafe-inline'" + (google ? ' https://fonts.googleapis.com' : ''),
    "font-src 'self'" + (google ? ' https://fonts.gstatic.com' : ''),
    "img-src 'self' data:",
    "connect-src 'none'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

const CHARSET = '<meta charset="utf-8">\n';

function withCsp(html, opts) {
  if (/http-equiv="Content-Security-Policy"/.test(html)) throw new Error('csp: the page already has a policy');
  if (html.split(CHARSET).length !== 2) throw new Error('csp: the charset meta is missing or not unique');
  if (!inlineScripts(html).length) throw new Error('csp: no inline script found to hash');
  const meta = '<meta http-equiv="Content-Security-Policy" content="' + policy(html, opts) + '">\n';
  const out = html.replace(CHARSET, () => CHARSET + meta);
  if (policy(out, opts) !== policy(html, opts)) throw new Error('csp: the scripts changed while the policy was added');
  return out;
}

function check(html) {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  if (!m) return { ok: false, why: 'no policy' };
  const listed = (m[1].match(/'sha256-[^']+'/g) || []);
  const missing = inlineScripts(html).map(sha).filter(h => listed.indexOf(h) < 0);
  return { ok: !missing.length && /connect-src 'none'/.test(m[1]), policy: m[1], missing: missing.length };
}

module.exports = { withCsp, check, inlineScripts };
