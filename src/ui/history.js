// History page.
import { HIST_PAGE, V } from '../ui/view';
import { S } from '../state/app';
import { fmtDM } from '../core/dates';
import { stretchByKey } from '../state/persist';
import { t, tn } from '../i18n/index';
import { $, esc, flash } from './dom';
import { DAYS, dayShort, persist, sxIsReps } from './shared';
import { fillForm } from './body';
import { fmtClock } from './rest-timer';
import { render } from './nav';

export function drawHistory(){
  const body=$("histBody"), more=$("histMore");
  if(!S.entries.length){ $("histEmpty").style.display='block'; body.innerHTML=''; more.style.display='none'; return; }
  $("histEmpty").style.display='none';
  const no='<span class="dash">·</span>';
  const mobCell=e=>{
    const m=e.mob||{}, n=Object.keys(m).length;
    if(!n) return no;
    let secs=0, reps=0;
    Object.keys(m).forEach(k=>{ const st=stretchByKey(k); if(sxIsReps(st)) reps+=(m[k]||0); else secs+=(m[k]||0); });
    const bits=[];
    if(secs) bits.push(fmtClock(secs));
    if(reps) bits.push(reps+'\u00d7');
    return '<span class="chk">'+n+'</span>'+(bits.length?' <span class="dash">'+bits.join(' ')+'</span>':'');
  };
  const rows=S.entries.slice(-V.histShown).reverse();
  body.innerHTML=rows.map(e=>{
    const d=DAYS.some(x=>x.key===e.day) ? e.day : null;
    return `<tr>
    <td>${fmtDM(e.date)}</td>
    <td>${d?esc(dayShort(d)):'·'}</td>
    <td class="w">${e.weight!=null?e.weight.toFixed(1):'·'}</td>
    <td>${e.bf!=null?e.bf.toFixed(1):'·'}</td>
    <td>${e.kcal!=null?e.kcal:e.fast?esc(t('hist.fast')):'·'}</td>
    <td>${e.prot!=null?e.prot:'·'}</td>
    <td>${mobCell(e)}</td>
    <td><button class="del" data-d="${e.date}" title="${esc(t('hist.del'))}" aria-label="${esc(t('hist.del'))}">✕</button></td></tr>`;
  }).join('');
  const left=S.entries.length-rows.length;
  more.style.display=left ? '' : 'none';
  if(left) more.textContent=tn('hist.more',Math.min(HIST_PAGE,left));
}
export async function removeEntry(date, btn){
  if(S.loadFailed){ flash(t('msg.loadfail.del'),true); return; }
  if(V.delArmed!==date){
    if(V.delTimer) clearTimeout(V.delTimer);
    document.querySelectorAll('.del').forEach(x=>{ x.textContent='✕'; x.style.color=''; });
    if(btn){ btn.textContent=t('msg.deleteq'); btn.style.color='var(--rust)'; }
    V.delArmed=date; V.delTimer=setTimeout(()=>{ V.delArmed=null; if(btn){ btn.textContent='✕'; btn.style.color=''; } },3000);
    return;
  }
  clearTimeout(V.delTimer); V.delArmed=null;
  S.entries=S.entries.filter(e=>e.date!==date);
  await persist(); fillForm($("fDate").value); render();
}
