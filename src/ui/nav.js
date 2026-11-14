// Pages and the week strip at the top: switching pages and redrawing only what is stale.
import { S } from '../state/app';
import { V } from '../ui/view';
import { exByKey } from '../state/persist';
import { localDate, weekdayKey } from '../core/dates';
import { t } from '../i18n/index';
import { $, esc } from './dom';
import { DAYS, dayLabel, dayShort, sessionEx } from './shared';
import { drawBMR, drawBodyStats, drawCalibration, drawProtein, fillForm, refreshManualTarget } from './body';
import { drawBackup } from './backup';
import { drawBody, drawCdTrend, drawStrength, drawSxTrend, drawWeight, syncChartSegs } from './charts';
import { drawColl } from './collection';
import { drawGuide } from './guide';
import { drawGym } from './gym';
import { drawHistory } from './history';
import { drawInstall, drawUpdate } from './install';
import { drawPlates } from './plates';
import { drawProg } from './progression';
import { drawReview } from './review';
import { drawTheme } from './theme';
import { drawUndo, drawVersion } from './sync';
import { foldApplyAll } from './fold';

export const PAGES=['body','workout','guide','gym','settings','history'];
export function showPage(k){
  if(PAGES.indexOf(k)<0) k='body';
  V.curPage=k;
  PAGES.forEach(p=>{ const el=$('pg-'+p); if(el) el.classList.toggle('on', p===k); });
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on', b.dataset.pg===k));
  const bar=$("dayBar"); if(bar) bar.classList.toggle('off', k!=='body' && k!=='workout');
  drawPage(k);
  window.scrollTo(0,0);
}
export function shiftDay(n){
  const d=$("fDate").value||localDate();
  const nd=new Date(d+'T12:00:00'); nd.setDate(nd.getDate()+n);
  const ds=localDate(nd);
  $("fDate").value=ds; fillForm(ds); render();
}
export const PAGE_DRAW = {
  body:     () => { drawBodyStats(); drawWeight(S.entries.filter(e=>e.weight!=null)); drawBody(); drawCalibration(); refreshManualTarget(); drawProtein(); drawBMR(); },
  workout:  () => { drawPlates(); drawStrength(); drawSxTrend(); drawCdTrend(); drawProg(); drawColl(); },
  guide:    () => drawGuide(),
  gym:      () => drawGym(),
  settings: () => { drawTheme(); drawUndo(); drawVersion(); },
  history:  () => { drawReview(); drawHistory(); }
};
export const stalePages = new Set();
export function drawPage(k){ if(stalePages.delete(k)) PAGE_DRAW[k](); }
export function stale(k){ stalePages.add(k); if(k===V.curPage) drawPage(k); }
export function render(){
  drawSched(); drawBackup(); drawInstall(); drawUpdate(); syncChartSegs(); foldApplyAll();
  PAGES.forEach(p=>stalePages.add(p));
  drawPage(V.curPage);
}
export function drawSched(){
  const sel=$("fDay");
  if(sel){
    const keep=sel.value;
    sel.innerHTML=DAYS.map(d=>`<option value="${d.key}">${esc(dayLabel(d.key))}</option>`).join('');
    if(keep && DAYS.some(d=>d.key===keep)) sel.value=keep;
  }
  const wrap=$("sched"); if(!wrap) return;
  const today=weekdayKey($("fDate") && $("fDate").value ? $("fDate").value : localDate());
  wrap.innerHTML=DAYS.map(d=>{
    const ks=sessionEx(d.key);
    const names=ks.map(k=>{ const e=exByKey(k); return esc(e?e.short:k); });
    const body = names.length ? names.slice(0,3).join('<br>')+(names.length>3?'<br>+'+(names.length-3):'') : esc(t('day.restlower'));
    return `<div class="day${ks.length?'':' rest'}${d.key===today?' today':''}" data-day="${d.key}">`
      +`<b>${esc(dayShort(d.key))}</b>${body}</div>`;
  }).join('');

}
