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

export function appendExBlock(wrap, ex, dayKey){
  const pinned=(S.planExtras[dayKey]||[]).indexOf(ex.key)>=0;
  const onDate=$("fDate").value, curE=S.entries.find(e=>e.date===onDate);
  const plan=(curE && liftsOf(curE,ex.key).length) ? null : coachNext(ex, sessionsBefore(ex.key, onDate));
  const rchip=(ex.repMin!=null && ex.repMax!=null) ? `<span class="rtag">${ex.repMin}–${ex.repMax}${ex.unit==='sec'?'s':''}</span>` : '';
  const mark=`<button type="button" class="xtag${pinned?' pin':''}" title="${esc(pinned?t('ex.unpintip'):tf('ex.pintip',{day:dayShort(dayKey)}))}">${esc(t(pinned?'ex.pinned':'ex.added'))}</button>`;
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
    rememberSets(ex);
  };
  block.querySelector('.exdrop').onclick=()=>dropMovement(ex.key, dayKey);
  block.querySelector('.xtag').onclick=()=>togglePin(ex.key, dayKey);
  wrap.appendChild(block);
  return block;
}
export async function togglePin(key, dayKey){
  const list=S.planExtras[dayKey]||(S.planExtras[dayKey]=[]);
  const i=list.indexOf(key);
  if(i>=0){ list.splice(i,1); if(!list.length) delete S.planExtras[dayKey]; } else list.push(key);
  await persistPlan();
  const box=$("sets-"+key), tag=(box&&box.parentNode)?box.parentNode.querySelector('.xtag'):null;
  if(tag){
    const on=(S.planExtras[dayKey]||[]).indexOf(key)>=0;
    tag.className='xtag'+(on?' pin':'');
    tag.textContent=t(on?'ex.pinned':'ex.added');
    tag.title=on?t('ex.unpintip'):tf('ex.pintip',{day:dayShort(dayKey)});
  }
  render();
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
  const keys=sessionEx(dayKey);
  if(cur && cur.lifts) Object.keys(cur.lifts).forEach(k=>{ if(exByKey(k) && keys.indexOf(k)<0) keys.push(k); });
  if(!keys.length){
    const known=DAYS.some(d=>d.key===dayKey);
    wrap.innerHTML=`<div class="restnote">${esc(tf('log.restnote',{day:known?dayName(dayKey):t('day.rest')}))}<br>${t('log.restnote2')}<br>${t('log.restnote3')}</div>`;
    return;
  }
  keys.forEach(k=>{ const ex=exByKey(k); if(ex) appendExBlock(wrap, ex, dayKey); });
  keys.forEach(k=>{ const ex=exByKey(k); if(ex) prefillEx(ex, dayKey, cur); });
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
  const list=S.planExtras[dayKey]||[];
  const i=list.indexOf(key);
  if(i>=0){ list.splice(i,1); if(!list.length) delete S.planExtras[dayKey]; await persistPlan(); render(); }
  if(!$("exWrap").children.length) buildExForm(S.entries.find(e=>e.date===$("fDate").value), dayKey);
}
export function addSetRow(ex, loadVal, reps, aim){
  const box=$("sets-"+ex.key); if(!box) return;
  const row=document.createElement('div'); row.className='setrow';
  const repPh = aim!=null ? String(aim) : (ex.unit==='sec' ? 'sec' : 'reps');
  row.innerHTML=`<span class="setn"></span>
    <input class="kg" type="number" min="0" step="0.5" inputmode="decimal" value="${loadVal==null?'':loadVal}"><span class="u">${ex.added?'+kg':'kg'}</span>
    <span class="x">×</span>
    <input class="rp${aim!=null?' aim':''}" type="number" min="0" inputmode="numeric" placeholder="${repPh}" value="${reps}">
    <button class="rmrest" title="${esc(t('ex.resttip'))}" aria-label="${esc(t('ex.resttip'))}">⏱</button>
    <button class="rmset" title="${esc(t('btn.remove'))}" aria-label="${esc(t('btn.remove'))}">✕</button>`;
  row.querySelector('.rmrest').onclick=()=>startRest(null, ex.short||ex.name);
  row.querySelector('.rmset').onclick=()=>{ row.remove(); renumber(ex); rememberSets(ex); };
  box.appendChild(row); renumber(ex);
}
export async function rememberSets(ex){
  const dayKey=$("fDay").value, box=$("sets-"+ex.key);
  if(!box || (S.planExtras[dayKey]||[]).indexOf(ex.key)<0) return;
  const n=box.querySelectorAll('.setrow').length;
  if(n<1 || plannedSets(dayKey, ex.key)===n) return;
  (S.planSets[dayKey]||(S.planSets[dayKey]={}))[ex.key]=n;
  await persistPlan(); drawGuide();
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
