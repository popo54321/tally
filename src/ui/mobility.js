// Mobility card and the stretch editor.
import { MUSCLES } from '../data/muscles';
import { S } from '../state/app';
import { V } from '../ui/view';
import { activeStretches, stretchByKey } from '../state/persist';
import { fmtDMY } from '../core/dates';
import { normStretch } from '../store/schema';
import { num } from '../core/numbers';
import { t, tf, tn } from '../i18n/index';
import { $, esc, flash } from './dom';
import { cdToday, dayEntry, dayName, dayShort, mobSetsOf, persist, persistPlan, persistStretches, sxEff, sxIsReps, sxKeyFor, sxTarget, sxToday, sameName } from './shared';
import { dlgClose, dlgOpen } from './dialog';
import { drawCardio } from './cardio';
import { fmtClock } from './rest-timer';
import { render, stale } from './nav';
import { dropFromRoutines, routineFor } from '../state/routines';

export async function setMobLog(key, total, sets){
  const e=dayEntry(); if(!e) return;
  const m=Object.assign({}, e.mob||{}), ms=Object.assign({}, e.mobSets||{});
  if(total==null){ delete m[key]; delete ms[key]; }
  else{ m[key]=Math.max(0,Math.round(total)); if(sets>1) ms[key]=Math.min(50,Math.round(sets)); else delete ms[key]; }
  e.mob=Object.keys(m).length?m:null; e.mobSets=Object.keys(ms).length?ms:null;
  await persist();
  drawMob(); stale('history');
}
export function toggleMob(key){
  const cur=S.entries.find(e=>e.date===$("fDate").value);
  const on=!!(cur && cur.mob && (key in cur.mob));
  const s=sxEff(stretchByKey(key)), n=(s && s.sets) || 1, per=s ? sxTarget(s) : 0, done=on ? mobSetsOf(cur,key) : 0;
  if(on && done>=n) return setMobLog(key, null);
  return setMobLog(key, (on ? cur.mob[key] : 0)+per, done+1);
}
export function mobSetAdd(key, amount){
  const cur=S.entries.find(e=>e.date===$("fDate").value);
  const on=!!(cur && cur.mob && (key in cur.mob));
  return setMobLog(key, (on ? cur.mob[key] : 0)+amount, (on ? mobSetsOf(cur,key) : 0)+1);
}
export function mobRowEdit(row){
  const per=num(row.querySelector('.mobsec').value), n=num(row.querySelector('.mobn').value);
  if(per==null && n==null) return setMobLog(row.dataset.k, null);
  const s=sxEff(stretchByKey(row.dataset.k)), sets=Math.max(1, Math.round(n || (s && s.sets) || 1));
  return setMobLog(row.dataset.k, Math.max(0, per || 0)*sets, sets);
}
export function mobRowHtml(s0, mob, gone, ms){
  const s=sxEff(s0);
  const on=(s.key in mob);
  const reps=sxIsReps(s), tgt=sxTarget(s), sets=s.sets||1, done=on ? ((ms && ms[s.key]) || 1) : 0;
  const base = tgt ? (reps ? tn('mob.repsn',tgt) : tf('mob.holdn',{n:tgt})) : t(reps?'mob.noreps':'mob.nohold');
  const sub = base + (sets>1 ? ' × '+tn('mob.setsn',sets) : '') + (on && sets>1 ? ' · '+tf('mob.setsof',{n:done, of:sets}) : '');
  const go = (!reps && s.secs) ? '<button type="button" class="mobgo">'+esc(t('btn.start'))+'</button>' : '';
  const tip=t(sets>1 && done<sets ? 'mob.ticktip.set' : 'mob.ticktip');
  return `<div class="mobrow${on?' done':''}${on && done<sets?' part':''}" data-k="${esc(s.key)}">
    <button type="button" class="mobtick" title="${esc(tip)}" aria-label="${esc(tip)}" aria-pressed="${on ? (done<sets ? 'mixed' : 'true') : 'false'}">✓</button>
    <div class="mobname">${esc(s.name)}${gone?' <span class="xtag">'+esc(t('removed'))+'</span>':pinTag('sx', s.key)}<span>${esc(sub)}</span></div>
    <input class="mobsec" type="number" min="0" max="${reps?999:3600}" inputmode="numeric" placeholder="${tgt||0}" value="${on?Math.round(mob[s.key]/done):''}" aria-label="${esc(t(reps?'sx.reps':'sx.hold'))}"><span class="mobu">${esc(reps?t('unit.reps'):'s')}</span><span class="mobx">×</span><input class="mobn" type="number" min="1" max="50" inputmode="numeric" placeholder="${sets}" value="${on?done:''}" aria-label="${esc(t('sx.sets'))}">
    ${go}
    ${gone?'':'<button type="button" class="mobedit" title="'+esc(t('mob.edittip'))+'" aria-label="'+esc(t('mob.edittip'))+'">⋯</button>'}
  </div>`;
}
export function unpinLog(plan, key){ Object.keys(plan).forEach(d=>{ plan[d]=plan[d].filter(k=>k!==key); if(!plan[d].length) delete plan[d]; }); }
export function dayLogKeys(plan, today, log){
  const dayKey=$("fDay").value, date=$("fDate").value;
  return [...new Set([...(plan[dayKey]||[]), ...(today[date]||[]), ...Object.keys(log)])];
}
export const logPinned = (plan, key) => (plan[$("fDay").value]||[]).indexOf(key)>=0;
/** Which routine of the selected session a stretch or cardio comes from, or 'added' for just this day. */
export const pinTag = (kind, key) => { const r=routineFor($("fDay").value, kind, key); return r ? `<em class="xtag pin still">${esc(r.name)}</em>` : `<em class="xtag still">${esc(t('ex.added'))}</em>`; };
export function drawMob(){
  const wrap=$("mobWrap"); if(!wrap) return;
  const date=$("fDate").value;
  const cur=S.entries.find(e=>e.date===date);
  const mob=(cur && cur.mob)?cur.mob:{};
  const dd=$("mobDate"); if(dd) dd.textContent=fmtDMY(date);
  const keys=dayLogKeys(S.planSx, sxToday, mob);
  const list=keys.map(stretchByKey).filter(s=>s && !s.retired);
  const orphan=keys.filter(k=>!list.some(s=>s.key===k) && (k in mob));
  if(!list.length && !orphan.length){
    wrap.innerHTML='<div class="mobempty">'+esc(t(activeStretches().length?'mob.empty.day':'mob.empty1'))+'<br>'+esc(tf('mob.empty.add',{day:dayName($("fDay").value)}))+'</div>';
  }else{
    const ms=(cur && cur.mobSets) || {};
    wrap.innerHTML = list.map(s=>mobRowHtml(s,mob,false,ms)).join('')
      + orphan.map(k=>mobRowHtml({key:k, name:(stretchByKey(k)||{name:k}).name, secs:0, reps:0, unit:null}, mob, true, ms)).join('');
  }
  const n=Object.keys(mob).length;
  let secs=0, reps=0;
  Object.keys(mob).forEach(k=>{
    const st=stretchByKey(k);
    if(sxIsReps(st)) reps+=(mob[k]||0); else secs+=(mob[k]||0);
  });
  const parts=[tf('done.n',{n:n})];
  if(secs) parts.push(fmtClock(secs));
  if(reps) parts.push(tn('mob.repsn',reps));
  const summary = n ? parts.join(' · ') : t('nothingyet');
  const tot=$("mobTot"); if(tot) tot.textContent=summary;
  const hint=$("mobHint");
  if(hint) hint.innerHTML = n ? tf('mob.hint.done',{summary:'<b>'+esc(summary)+'</b>'})
                              : t('mob.hint.none');
}
export function sxMsg(msg,err){ const m=$("sxMsg"); if(!m) return; m.textContent=msg||''; m.className='sh-msg'+(err?' err':''); }
export function sxResetDel(){ V.sxDelArmed=false; if(V.sxDelTimer) clearTimeout(V.sxDelTimer); const b=$("sxDelete"); if(b) b.textContent=t('btn.remove'); }
export function sxModeSet(m){
  const reps = m==='reps';
  document.querySelectorAll('#sxMode button').forEach(b=>b.classList.toggle('on', b.dataset.m===m));
  const lab=$("sxNumLabel"); if(lab) lab.textContent=t(reps?'sx.reps':'sx.hold');
  const nt=$("sxNote"); if(nt) nt.textContent=t(reps?'sx.note.reps':'sx.note');
  const inp=$("sxSecs");
  if(inp){
    inp.max=reps?999:3600; inp.step=reps?1:5; inp.placeholder=reps?'10':'45';
    const cur = V.sxEditing ? stretchByKey(V.sxEditing) : null;
    const v = cur ? (reps ? cur.reps : cur.secs) : (reps ? 10 : 45);
    inp.value = v || '';
  }
}
export const sxModeGet = () => { const b=document.querySelector('#sxMode button.on'); return b?b.dataset.m:'sec'; };
export function sxOpen(key){
  V.sxEditing=key||null; sxResetDel();
  const s=key?stretchByKey(key):null;
  const mode = sxIsReps(s) ? 'reps' : 'sec';
  $("sxTitle").textContent=t(s?'sx.edit':'sx.new');
  $("sxName").value=s?s.name:'';
  sxModeSet(mode); sxMusSet(s?s.mus:[]); $("sxSets").value=s ? s.sets : 1;
  $("sxDelete").style.display=s?'':'none';
  sxMsg(''); dlgOpen("sxWrap");
  if(!s) $("sxName").focus();
}
export function sxClose(){ dlgClose("sxWrap"); sxResetDel(); sxMsg(''); V.sxEditing=null; V.sxPinDay=null; }
export const sxMusGet = () => [...document.querySelectorAll('#sxMus .mchip.on')].map(b=>b.dataset.m);
export function sxMusSet(list){ $("sxMus").innerHTML=MUSCLES.map(m=>`<button type="button" class="mchip${(list||[]).indexOf(m.key)>=0?' on':''}" data-m="${m.key}">${esc(t('mus.'+m.key))}</button>`).join(''); }
export async function sxSave(){
  const name=$("sxName").value.trim();
  if(!name){ sxMsg(t('msg.needname'),true); $("sxName").focus(); return; }
  const reps = sxModeGet()==='reps';
  const v = $("sxSecs").value;
  if(V.sxEditing){
    const s=stretchByKey(V.sxEditing); if(!s){ sxClose(); return; }
    const upd=normStretch({key:s.key, name:name, unit:reps?'reps':null,
      secs:reps?s.secs:v, reps:reps?v:s.reps, sets:$("sxSets").value, mus:sxMusGet(), lib:s.lib, retired:s.retired});
    if(!upd){ sxMsg(t('msg.badname'),true); return; }
    Object.assign(s, upd);
  }else{
    if(S.stretches.some(x=>sameName(x.name, name))){ sxMsg(t('msg.onlist'),true); return; }
    const s=normStretch({key:sxKeyFor(name), name:name, unit:reps?'reps':null,
      secs:reps?0:v, reps:reps?v:0, sets:$("sxSets").value, mus:sxMusGet()});
    if(!s){ sxMsg(t('msg.badname'),true); return; }
    S.stretches.push(s);
    if(V.sxPinDay){ const d=$("fDate").value; (sxToday[d]||(sxToday[d]=[])).push(s.key); }
  }
  const ok=await persistStretches();
  if(!ok){ sxMsg(t('msg.savefail'),true); return; }
  sxClose(); drawMob();
}
export async function sxDelete(){
  if(!V.sxEditing) return;
  const s=stretchByKey(V.sxEditing); if(!s) return;
  const days=S.entries.filter(e=>e.mob && (s.key in e.mob)).length;
  if(!V.sxDelArmed){
    V.sxDelArmed=true;
    $("sxDelete").textContent=t('btn.tapagain');
    sxMsg(days ? tn('del.clears',days,{name:s.name})+' '+t('notreversible') : tf('del.removes',{name:s.name}), true);
    V.sxDelTimer=setTimeout(sxResetDel, 4000);
    return;
  }
  sxResetDel();
  S.stretches=S.stretches.filter(x=>x.key!==s.key);
  if(dropFromRoutines('sx', s.key)) await persistPlan();
  S.entries.forEach(e=>{ if(e.mob && (s.key in e.mob)){ delete e.mob[s.key]; if(!Object.keys(e.mob).length) e.mob=null; } });
  await persistStretches(); await persist();
  sxClose(); render();
  flash(tf('msg.removed',{name:s.name}));
}
