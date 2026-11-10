// Small number helpers shared by every calculation.

/** A number from any input, or null when it is not one. */
export const num = (v: unknown): number | null => { const n = parseFloat(v as string); return isNaN(n) ? null : n; };

export const roundTo = (v: number, dp?: number | null): number => { const f = Math.pow(10, dp == null ? 1 : dp); return Math.round(v * f) / f; };

/** '+1.2 kg', '−0.4 kg' (true minus sign) or '±0.0 kg'; 'n/a' when there is no value. */
export function fmtSigned(v: number | null | undefined, u?: string, dp?: number): string {
  if (v == null) return 'n/a';
  const r = roundTo(v, dp);
  return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r).toFixed(dp == null ? 1 : dp) + (u || '');
}

/**
 * The meal-sum box: '480+650', '2*150', '1200-90'. Multiplication and division first, then left to right.
 * Returns the total to one decimal, or null when the text is not a sum it understands.
 */
export function calcVal(v: unknown): number | null {
  const s = String(v == null ? '' : v).replace(/\s+/g, '');
  if (!s) return null;
  const tok = s.match(/\d+\.?\d*|\.\d+|[+\-*/]/g);
  if (!tok || tok.join('') !== s) return null;
  const flat: (number | string)[] = [];
  for (let i = 0; i < tok.length; i++) {
    const x = tok[i];
    if (x === '*' || x === '/') {
      const a = flat.pop(), b = parseFloat(tok[++i]);
      if (typeof a !== 'number' || isNaN(a) || isNaN(b) || (x === '/' && b === 0)) return null;
      flat.push(x === '*' ? a * b : a / b);
    } else if (x === '+' || x === '-') flat.push(x);
    else flat.push(parseFloat(x));
  }
  let acc: number | null = null, op = '+';
  for (const x of flat) {
    if (x === '+' || x === '-') { op = x; continue; }
    if (typeof x !== 'number' || isNaN(x)) return null;
    acc = (acc == null) ? (op === '-' ? -x : x) : (op === '+' ? acc + x : acc - x);
  }
  return (acc == null || !isFinite(acc)) ? null : Math.round(acc * 10) / 10;
}
