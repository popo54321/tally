// Small screen helpers: finding elements, escaping text for HTML, the Saved/Imported message, filling in wording.
import { V } from '../ui/view';
import { fmtSigned, roundTo } from '../core/numbers';
import { t } from '../i18n/index';

export const lvTag = lv => lv ? `<span class="lvtag lv${lv}">${esc(t('lv.'+lv))}</span>` : '';
export function bwSplit(list, lvOf, rowFn, hdCls){
  const w=list.filter(x=>!lvOf(x)), b=list.filter(x=>lvOf(x));
  return w.map(rowFn).join('') + (b.length ? `<div class="${hdCls}">${esc(t('lib.bwhead'))}</div>`+b.map(rowFn).join('') : '');
}
export const $ = id => document.getElementById(id);
export const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
export const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function applyLang(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent=t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-html]').forEach(el=>{ el.innerHTML=t(el.getAttribute('data-i18n-html')); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{ el.placeholder=t(el.getAttribute('data-i18n-ph')); });
  document.querySelectorAll('[data-i18n-title]').forEach(el=>{ el.title=t(el.getAttribute('data-i18n-title')); if(!/[A-Za-z0-9]/.test(el.textContent)) el.setAttribute('aria-label', el.title); });
}
export function fmtDelta(lbl, d, unit){
  if(!d) return `<div>Δ ${esc(lbl)}: <span style="color:var(--ink-faint)">—</span></div>`;
  const r=roundTo(d.delta), cls = r>0?'up':r<0?'down':'';
  return `<div>Δ ${esc(lbl)}: <b class="${cls}">${fmtSigned(r,' '+unit)}</b></div>`;
}
export function setDot(id,v,good,mid){ const e=$(id); if(e) e.className='dot '+(v>=good?'ok':v>=mid?'mid':'no'); }
export const isObj = x => !!x && typeof x==='object' && !Array.isArray(x);
export function flash(msg,err){
  const els=['savedMsg','savedMsg2'].map($).filter(Boolean);
  els.forEach(m=>{ m.textContent=msg; m.style.color=err?'var(--rust)':'var(--orange)'; m.classList.add('show'); });
  clearTimeout(V.flashTimer);
  V.flashTimer=setTimeout(()=>els.forEach(m=>m.classList.remove('show')),2400);
}
