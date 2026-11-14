// Workout sets card: the session picker, movements and their set rows.
import { PLAN_SETS_DEF } from '../store/schema';
import { S } from '../state/app';
import { coachNext } from '../core/strength';
import { exByKey } from '../state/persist';
import { num } from '../core/numbers';
import { t, tf } from '../i18n/index';
import { $, esc } from './dom';
import { DAYS, coachLine, dayName, dayShort, exNote, lastSessionOf, liftsOf, persistPlan, plannedSets, sessionEx, sessionsBefore } from './shared';
import { drawGuide } from './guide';
import { render } from './nav';
import { startRest } from './rest-timer';
import { daySupersets, routineFor } from '../state/routines';

export function appendExBlock(wrap, ex, dayKey){
  const rt=routineFor(dayKey,'lift',ex.key);
  const onDate=$("fDate").value, curE=S.entries.find(e=>e.date===onDate);
  const plan=(curE && liftsOf(curE,ex.key).length) ? null : coachNext(ex, sessionsBefore(ex.key, onDate));
  const rchip=(ex.repMin!=null && ex.repMax!=null) ? `<span class="rtag">${ex.repMin}–${ex.repMax}${ex.unit==='sec'?'s':''}</span>` : '';
  const mark=rt ? `<em class="xtag pin still" title="${esc(tf('rt.fromtip',{name:rt.name}))}">${esc(rt.name)}</em>` : `<em class="xtag still">${esc(t('ex.added'))}</em>`;
  const block=document.createElement('div'); block.className='ex';
  block.innerHTML=`<div class="ex-head">
      <div class="ex-name">${esc(ex.name)} ${rchip}${mark}<span> · ${esc(exNote(ex))}</span></div>
      <div class="ex-ctl">
        <button class="addset" data-ex="${esc(ex.key)}">+ ${esc(t('ex.set'))}</button>
        <button class="exdrop" data-ex="${esc(ex.key)}" title="${esc(t('ex.droptip'))}" aria-label="${esc(t('ex.droptip'))}">✕</button>
      </div>
    </div>${plan?`<div class="coachline">${coachLine(ex,plan)}</div>`:''}<div class="sets" id="sets-${esc(ex.key)}"></div>`;
  block.querySelector('.addset').onclick=()=>{
    const rows=$("sets-"+ex.key).querySelectorAll('.setrow');
    addSetRow(ex, rows.length ? rows[rows.length-1].querySelector('.kg').value : ex.def, '');
  };
  block.querySelector('.exdrop').onclick=()=>dropMovement(ex.key, dayKey);
  wrap.appendChild(block);
  return block;
}
export function prefillEx(ex, dayKey, cur){
  const sameDay = cur && cur.lifts && cur.lifts[ex.key];
  if(sameDay && sameDay.length){ sameDay.forEach(s=>addSetRow(ex, s.kg, s.reps)); return; }
  const plan=coachNext(ex, sessionsBefore(ex.key, $("fDate").value));
  const want=plannedSets(dayKey, ex.key), n=want||PLAN_SETS_DEF;
  if(plan && (want || plan.kind==='first')){ for(let i=0;i<n;i++) addSetRow(ex, plan.load, '', plan.targets[Math.min(i, plan.targets.length-1)]); return; }
  if(plan){ plan.targets.forEach(r=>addSetRow(ex, plan.load, '', r)); return; }
  const last=lastSessionOf(ex.key, dayKey);
  if(last && last.length){ const k=want||last.length; for(let i=0;i<k;i++) addSetRow(ex, last[Math.min(i, last.length-1)].kg, ''); }
  else for(let i=0;i<n;i++) addSetRow(ex, ex.def, '');
}
export function buildExForm(cur, dayKey){
  const wrap=$("exWrap"); wrap.innerHTML='';
  const skip=SKIP[$("fDate").value]||new Set();
  const keys=sessionEx(dayKey).filter(k=>!skip.has(k) || (cur && cur.lifts && cur.lifts[k]));
  if(cur && cur.lifts) Object.keys(cur.lifts).forEach(k=>{ if(exByKey(k) && keys.indexOf(k)<0) keys.push(k); });
  // supersets: each movement but the last points to the next; rest comes after the last one
  SS_NEXT=new Map(); SS_LAST=new Map();
  const groups=daySupersets(dayKey).map(g=>g.filter(k=>keys.indexOf(k)>=0)).filter(g=>g.length>1);
  groups.forEach(g=>{ g.forEach((k,i)=>{ if(i<g.length-1) SS_NEXT.set(k,g[i+1]); }); SS_LAST.set(g[g.length-1], g.map(k=>{ const e=exByKey(k); return e?(e.short||e.name):k; }).join(' + ')); });
  if(!keys.length){
    const known=DAYS.some(d=>d.key===dayKey);
    wrap.innerHTML=`<div class="restnote">${esc(tf('log.restnote',{day:known?dayName(dayKey):t('day.rest')}))}<br>${t('log.restnote2')}<br>${t('log.restnote3')}</div>`;
    return;
  }
  keys.forEach(k=>{ const ex=exByKey(k); if(ex) appendExBlock(wrap, ex, dayKey); });
  keys.forEach(k=>{ const ex=exByKey(k); if(ex) prefillEx(ex, dayKey, cur); });
  groups.forEach(g=>{
    const blocks=g.map(k=>$("sets-"+k)).filter(Boolean).map(b=>b.parentNode);
    if(blocks.length<2) return;
    const grp=document.createElement('div'); grp.className='ssgroup';
    grp.innerHTML=`<div class="sslbl">${esc(t('ss.label'))}</div>`;
    wrap.insertBefore(grp, blocks[0]);
    blocks.forEach(b=>grp.appendChild(b));
  });
}
export function addMovementToForm(key){
  const ex=exByKey(key); if(!ex) return false;
  if($("sets-"+key)) return false;
  const wrap=$("exWrap");
  const note=wrap.querySelector('.restnote'); if(note) note.remove();
  const dayKey=$("fDay").value;
  appendExBlock(wrap, ex, dayKey);
  prefillEx(ex, dayKey, S.entries.find(e=>e.date===$("fDate").value));
  return true;
}
export async function dropMovement(key, dayKey){
  const box=$("sets-"+key);
  if(box && box.parentNode) box.parentNode.remove();
  // only for this day: the routine itself is changed in the Routines card
  const date=$("fDate").value; (SKIP[date]||(SKIP[date]=new Set())).add(key);
  if(!$("exWrap").children.length) buildExForm(S.entries.find(e=>e.date===$("fDate").value), dayKey);
}
/** Movements dropped from a day's log (until the app restarts), by date. */
const SKIP={};
/** Supersets in the current log: key → next movement in the round; last movement → names for the rest timer. */
let SS_NEXT=new Map(), SS_LAST=new Map();
/** In a superset, '→' jumps to the same set of the next movement, so the rest only comes after the round. */
export function ssNext(key, row){
  const box=$("sets-"+key), nb=$("sets-"+SS_NEXT.get(key)); if(!box || !nb) return;
  const i=[...box.querySelectorAll('.setrow')].indexOf(row), rows=nb.querySelectorAll('.setrow');
  const target=rows[Math.min(Math.max(i,0), rows.length-1)];
  if(!target){ nb.parentNode.scrollIntoView({behavior:'smooth', block:'center'}); return; }
  target.scrollIntoView({behavior:'smooth', block:'center'});
  const rp=target.querySelector('.rp'); if(rp) rp.focus({preventScroll:true});
}
export function addSetRow(ex, loadVal, reps, aim){
  const box=$("sets-"+ex.key); if(!box) return;
  const row=document.createElement('div'); row.className='setrow';
  const repPh = aim!=null ? String(aim) : (ex.unit==='sec' ? 'sec' : 'reps');
  row.innerHTML=`<span class="setn"></span>
    <input class="kg" type="number" min="0" step="0.5" inputmode="decimal" value="${loadVal==null?'':loadVal}"><span class="u">${ex.added?'+kg':'kg'}</span>
    <span class="x">×</span>
    <input class="rp${aim!=null?' aim':''}" type="number" min="0" inputmode="numeric" placeholder="${repPh}" value="${reps}">
    ${SS_NEXT.has(ex.key) ? `<button class="rmnext" title="${esc(t('ss.nexttip'))}" aria-label="${esc(t('ss.nexttip'))}">→</button>` : `<button class="rmrest" title="${esc(t(SS_LAST.has(ex.key)?'ss.resttip':'ex.resttip'))}" aria-label="${esc(t(SS_LAST.has(ex.key)?'ss.resttip':'ex.resttip'))}">⏱</button>`}
    <button class="rmset" title="${esc(t('btn.remove'))}" aria-label="${esc(t('btn.remove'))}">✕</button>`;
  if(SS_NEXT.has(ex.key)) row.querySelector('.rmnext').onclick=()=>ssNext(ex.key, row);
  else row.querySelector('.rmrest').onclick=()=>startRest(null, SS_LAST.get(ex.key)||ex.short||ex.name);
  row.querySelector('.rmset').onclick=()=>{ row.remove(); renumber(ex); };
  box.appendChild(row); renumber(ex);
}
export function renumber(ex){ const box=$("sets-"+ex.key); if(box) box.querySelectorAll('.setrow').forEach((r,i)=>r.querySelector('.setn').textContent=i+1); }
export function readExForm(){
  const lifts={};
  S.catalogue.forEach(ex=>{
    const box=$("sets-"+ex.key); if(!box) return;
    const arr=[];
    box.querySelectorAll('.setrow').forEach(r=>{
      const reps=num(r.querySelector('.rp').value);
      if(reps && reps>0){ let kg=num(r.querySelector('.kg').value); if(kg==null) kg=ex.def||0; arr.push({kg:kg, reps:reps}); }
    });
    if(arr.length) lifts[ex.key]=arr;
  });
  return lifts;
}
