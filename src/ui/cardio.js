// Cardio card and the cardio editor.
import { S } from '../state/app';
import { V } from '../ui/view';
import { activeCardio, cardioByKey } from '../state/persist';
import { fmtDMY } from '../core/dates';
import { normCardio } from '../store/schema';
import { num } from '../core/numbers';
import { t, tf, tn } from '../i18n/index';
import { $, esc, flash } from './dom';
import { cdKeyFor, cdSetsOf, cdToday, dayEntry, dayName, persist, persistCardio, persistPlan, prettyKey } from './shared';
import { dayLogKeys, logPinned, pinTag, unpinLog } from './mobility';
import { dlgClose, dlgOpen } from './dialog';
import { render, stale } from './nav';
import { timerStart } from './rest-timer';

export async function setCardioLog(key, total, sets){
  const e=dayEntry(); if(!e) return;
  const m=Object.assign({}, e.cardio||{}), ms=Object.assign({}, e.cardioSets||{});
  if(total==null){ delete m[key]; delete ms[key]; }
  else{ m[key]=Math.max(0,Math.round(total)); if(sets>1) ms[key]=Math.min(50,Math.round(sets)); else delete ms[key]; }
  e.cardio=Object.keys(m).length?m:null; e.cardioSets=Object.keys(ms).length?ms:null;
  await persist();
  drawCardio(); stale('history');
}
export function toggleCardio(key){
  const cur=S.entries.find(e=>e.date===$("fDate").value);
  const on=!!(cur && cur.cardio && (key in cur.cardio));
  const c=cardioByKey(key), n=(c && c.sets) || 1, per=c ? (c.mins||0) : 0, done=on ? cdSetsOf(cur,key) : 0;
  if(on && done>=n) return setCardioLog(key, null);
  return setCardioLog(key, (on ? cur.cardio[key] : 0)+per, done+1);
}
export function cdSetAdd(key, mins){
  const cur=S.entries.find(e=>e.date===$("fDate").value);
  const on=!!(cur && cur.cardio && (key in cur.cardio));
  return setCardioLog(key, (on ? cur.cardio[key] : 0)+mins, (on ? cdSetsOf(cur,key) : 0)+1);
}
export function cdRowEdit(row){
  const per=num(row.querySelector('.mobsec').value), n=num(row.querySelector('.mobn').value);
  if(per==null && n==null) return setCardioLog(row.dataset.k, null);
  const c=cardioByKey(row.dataset.k), sets=Math.max(1, Math.round(n || (c && c.sets) || 1));
  return setCardioLog(row.dataset.k, Math.max(0, per || 0)*sets, sets);
}
export function startCardioTimer(key){
  const c=cardioByKey(key);
  if(!c || !c.mins){ flash(t('msg.needmins')); return; }
  timerStart({kind:'cardio', key:key, label:c.name, hold:c.mins*60, lead:S.settings.mobLead||0});
}
export function cdRowHtml(c, log, gone, ms){
  const on=(c.key in log), sets=c.sets||1, done=on ? ((ms && ms[c.key]) || 1) : 0;
  const sub=(c.mins ? tf('cd.target',{n:c.mins}) : t('cd.notarget')) + (sets>1 ? ' × '+tn('mob.setsn',sets) : '') + (on && sets>1 ? ' · '+tf('mob.setsof',{n:done, of:sets}) : '');
  const tip=t(sets>1 && done<sets ? 'mob.ticktip.set' : 'mob.ticktip');
  return `<div class="mobrow${on?' done':''}${on && done<sets?' part':''}" data-k="${esc(c.key)}">
    <button type="button" class="mobtick" title="${esc(tip)}" aria-label="${esc(tip)}" aria-pressed="${on ? (done<sets ? 'mixed' : 'true') : 'false'}">✓</button>
    <div class="mobname">${esc(c.name)}${gone?' <span class="xtag">'+esc(t('removed'))+'</span>':pinTag(logPinned(S.planCd,c.key), $("fDay").value)}<span>${esc(sub)}</span></div>
    <input class="mobsec" type="number" min="0" max="600" inputmode="numeric" placeholder="${c.mins||0}" value="${on?Math.round(log[c.key]/done):''}" aria-label="${esc(t('cdx.mins'))}"><span class="mobu">${esc(t('unit.min'))}</span><span class="mobx">×</span><input class="mobn" type="number" min="1" max="50" inputmode="numeric" placeholder="${sets}" value="${on?done:''}" aria-label="${esc(t('sx.sets'))}">
    ${c.mins?'<button type="button" class="mobgo">'+esc(t('btn.start'))+'</button>':''}
    ${gone?'':'<button type="button" class="mobedit" title="'+esc(t('mob.edittip'))+'" aria-label="'+esc(t('mob.edittip'))+'">⋯</button>'}
  </div>`;
}
export function drawCardio(){
  const wrap=$("cdWrap"); if(!wrap) return;
  const date=$("fDate").value;
  const cur=S.entries.find(e=>e.date===date);
  const log=(cur && cur.cardio)?cur.cardio:{};
  const dd=$("cdDate"); if(dd) dd.textContent=fmtDMY(date);
  const keys=dayLogKeys(S.planCd, cdToday, log);
  const list=keys.map(cardioByKey).filter(c=>c && !c.retired);
  const orphan=keys.filter(k=>!list.some(c=>c.key===k) && (k in log));
  if(!list.length && !orphan.length){
    wrap.innerHTML='<div class="mobempty">'+esc(t(activeCardio().length?'cd.empty.day':'cd.empty1'))+'<br>'+esc(tf('cd.empty.add',{day:dayName($("fDay").value)}))+'</div>';
  }else{
    const ms=(cur && cur.cardioSets) || {};
    wrap.innerHTML = list.map(c=>cdRowHtml(c,log,false,ms)).join('')
      + orphan.map(k=>cdRowHtml({key:k, name:(cardioByKey(k)||{name:prettyKey(k)}).name, mins:0}, log, true, ms)).join('');
  }
  const n=Object.keys(log).length;
  const mins=Object.keys(log).reduce((a,k)=>a+(log[k]||0),0);
  const tot=$("cdTot");
  if(tot) tot.textContent = n ? (tf('done.n',{n:n})+(mins?(' · '+mins+' '+t('unit.min')):'')) : t('nothingyet');
}
export function cdMsg(msg,err){ const m=$("cdMsg"); if(!m) return; m.textContent=msg||''; m.className='sh-msg'+(err?' err':''); }
export function cdResetDel(){ V.cdDelArmed=false; if(V.cdDelTimer) clearTimeout(V.cdDelTimer); const b=$("cdDelete"); if(b) b.textContent=t('btn.remove'); }
export function cdOpen(key){
  V.cdEditing=key||null; cdResetDel();
  const c=key?cardioByKey(key):null;
  $("cdTitle").textContent=t(c?'cdx.edit':'cdx.new');
  $("cdName").value=c?c.name:'';
  $("cdMins").value=c?(c.mins||''):'30'; $("cdSets").value=c ? c.sets : 1;
  $("cdDelete").style.display=c?'':'none';
  cdMsg(''); dlgOpen("cdWrapSheet");
  if(!c) $("cdName").focus();
}
export function cdClose(){ dlgClose("cdWrapSheet"); V.cdPinDay=null; cdResetDel(); cdMsg(''); V.cdEditing=null; }
export async function cdSave(){
  const name=$("cdName").value.trim();
  if(!name){ cdMsg(t('msg.needname'),true); $("cdName").focus(); return; }
  if(V.cdEditing){
    const c=cardioByKey(V.cdEditing); if(!c){ cdClose(); return; }
    const upd=normCardio({key:c.key, name:name, mins:$("cdMins").value, sets:$("cdSets").value, lib:c.lib, retired:c.retired});
    if(!upd){ cdMsg(t('msg.badname'),true); return; }
    Object.assign(c, upd);
  }else{
    if(S.cardios.some(x=>x.name.toLowerCase()===name.toLowerCase())){ cdMsg(t('msg.onlist'),true); return; }
    const c=normCardio({key:cdKeyFor(name), name:name, mins:$("cdMins").value, sets:$("cdSets").value});
    if(!c){ cdMsg(t('msg.badname'),true); return; }
    S.cardios.push(c);
    if(V.cdPinDay){ (S.planCd[V.cdPinDay]||(S.planCd[V.cdPinDay]=[])).push(c.key); await persistPlan(); }
  }
  const ok=await persistCardio();
  if(!ok){ cdMsg(t('msg.savefail'),true); return; }
  cdClose(); drawCardio();
}
export async function cdDelete(){
  if(!V.cdEditing) return;
  const c=cardioByKey(V.cdEditing); if(!c) return;
  const days=S.entries.filter(e=>e.cardio && (c.key in e.cardio)).length;
  if(!V.cdDelArmed){
    V.cdDelArmed=true;
    $("cdDelete").textContent=t('btn.tapagain');
    cdMsg(days ? tn('del.clears',days,{name:c.name})+' '+t('notreversible') : tf('del.removes',{name:c.name}), true);
    V.cdDelTimer=setTimeout(cdResetDel, 4000);
    return;
  }
  cdResetDel();
  S.cardios=S.cardios.filter(x=>x.key!==c.key);
  unpinLog(S.planCd, c.key); await persistPlan();
  S.entries.forEach(e=>{ if(e.cardio && (c.key in e.cardio)){ delete e.cardio[c.key]; if(!Object.keys(e.cardio).length) e.cardio=null; } });
  await persistCardio(); await persist();
  cdClose(); render();
  flash(tf('msg.removed',{name:c.name}));
}
