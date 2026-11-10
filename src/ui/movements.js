// The add-movement sheet and movement editor.
import { CLEAN_TO_STEP, GOALS, STEP_DEF, goalOfRange } from '../core/strength';
import { GROUPS, MUSCLES } from '../data/muscles';
import { LIB } from '../data/library';
import { S } from '../state/app';
import { V } from '../ui/view';
import { exByKey, rebuildCatalogue } from '../state/persist';
import { normCustomEx } from '../store/schema';
import { t, tf, tn } from '../i18n/index';
import { $, bwSplit, esc, flash, lvTag } from './dom';
import { addMovementToForm } from './workout-log';
import { cxKeyFor, dayShort, exLv, exNote, exOrder, groupName, groupOf, libLive, libOrder, libUsable, liftsOf, persist, persistCatalogue, persistExEdits, persistPlan, persistSettings, qMatch } from './shared';
import { dlgClose, dlgOpen } from './dialog';
import { fillForm } from './body';
import { libToCollection } from './guide';
import { render } from './nav';

export function loadDesc(ex){
  if(ex.unit==='sec') return t('load.seconds');
  if(ex.added) return t('load.bwkg');
  return 'kg';
}
export function shMsg(msg,err){ const m=$("shMsg"); if(!m) return; m.textContent=msg||''; m.className='sh-msg'+(err?' err':''); }
export function shShow(mode){
  const list=mode!=='form';
  $("shListMode").style.display=list?'':'none';
  $("shFormMode").style.display=list?'none':'';
  $("shTitle").textContent=t(list?(V.shManaging?'sh.title.manage':'sh.title.add'):'sh.title.new');
  if(list) shRenderList();
}
export function shOpen(){
  V.shManaging=false; shMsg('');
  $("shSearch").value='';
  dlgOpen("shWrap");
  shShow('list');
}
export function shClose(){ dlgClose("shWrap"); shMsg(''); }
export function shRenderList(){
  const box=$("shList"), q=($("shSearch").value||'').trim().toLowerCase();
  const dayKey=$("fDay").value;
  const onForm=k=>!!$("sets-"+k);
  const hit=ex=>!q || qMatch(q, ex.name+' '+ex.short+' '+ex.note);
  const row=ex=>{
    const pinned=(S.planExtras[dayKey]||[]).indexOf(ex.key)>=0;
    if(V.shManaging){
      const days=S.entries.filter(e=>liftsOf(e,ex.key).length).length;
      return `<div class="sh-row">
        <div class="nm">${esc(ex.name)}<span>${esc(loadDesc(ex))} · ${esc(days?tn('coll.sessions',days):t('coll.never'))}${ex.retired?' · '+esc(t('coll.hidden')):''}</span></div>
        <button class="sh-pin" data-edit="${esc(ex.key)}">${esc(t('btn.edit'))}</button>
        <button class="sh-add${ex.retired?'':' ghost'}" data-ret="${esc(ex.key)}">${esc(t(ex.retired?'btn.show':'btn.hide'))}</button>
      </div>`;
    }
    return `<div class="sh-row">
        <div class="nm">${esc(ex.name)}${lvTag(exLv(ex))}<span>${esc(loadDesc(ex))} · ${esc(exNote(ex))}</span></div>
        <button class="sh-pin${pinned?' on':''}" data-pin="${esc(ex.key)}" title="${esc(tf('sh.pintip',{day:dayShort(dayKey)}))}">${esc(tf('sh.pin',{day:dayShort(dayKey)}))}</button>
        <button class="sh-add" data-add="${esc(ex.key)}">${esc(t('btn.add'))}</button>
      </div>`;
  };
  const pool = S.catalogue.filter(hit).filter(ex=>V.shManaging || (!ex.retired && !onForm(ex.key))).sort(exOrder);
  const lrow=l=>{
    const ok=libUsable(l), eq=l.eq.length ? l.eq.map(x=>t('eq.'+x)).join(', ') : t('guide.bodyweight');
    return `<div class="sh-row${ok?'':' off'}">
        <div class="nm">${esc(t('lib.'+l.key))}${lvTag(l.lv)}<span>${esc(l.p.map(k=>t('mus.'+k)).join(', '))} · ${esc(ok ? eq : tf('guide.needs',{list:eq}))}</span></div>
        <button class="sh-pin" data-libpin="${l.key}" title="${esc(tf('sh.pintip',{day:dayShort(dayKey)}))}">${esc(tf('sh.pin',{day:dayShort(dayKey)}))}</button>
        <button class="sh-add" data-libadd="${l.key}">${esc(t('btn.add'))}</button>
      </div>`;
  };
  const found = (q && !V.shManaging) ? LIB.filter(l=>!libLive(l) && qMatch(q, t('lib.'+l.key)+' '+l.p.concat(l.s).map(k=>t('mus.'+k)).join(' ')+(l.lv?' '+t('lv.'+l.lv):'')))
    .sort((a,b)=>(libUsable(b)?1:0)-(libUsable(a)?1:0) || libOrder(a,b)).slice(0,60) : [];
  const libPart = found.length ? `<div class="sh-grp">${esc(t('sh.lib'))}</div>`+bwSplit(found, l=>l.lv, lrow, 'sh-grp')
    : (!q && !V.shManaging) ? `<div class="sh-empty">${esc(tf('sh.libhint',{n:LIB.length}))}</div>` : '';
  box.innerHTML = (pool.length || found.length)
    ? (pool.length ? `<div class="sh-grp">${esc(t('sh.yours'))}</div>`+bwSplit(pool, exLv, row, 'sh-grp') : '')+libPart
    : (!q && !V.shManaging) ? `<div class="sh-empty">${esc(tf('sh.libhint',{n:LIB.length}))}<br>${esc(t('sh.tapnew'))}</div>`
    : `<div class="sh-empty">${esc(tf('nomatch',{q:q}))}${V.shManaging?'':'<br>'+esc(t('sh.tapnew'))}</div>`+libPart;

}
export async function shLibPick(k, pin){
  const key=await libToCollection(k);
  if(key) shPick(key, pin);
}
export async function shPick(key, pin){
  const dayKey=$("fDay").value;
  if(pin){
    const list=S.planExtras[dayKey]||(S.planExtras[dayKey]=[]);
    if(list.indexOf(key)<0) list.push(key);
    await persistPlan();
  }
  addMovementToForm(key);
  shClose();
  if(pin) render();
  const ex=exByKey(key);
  flash(pin ? tf('msg.pinned',{name:(ex?ex.name:t('ex.movement')), day:dayShort(dayKey)})
            : tf('msg.exadded',{name:(ex?ex.name:t('ex.movement'))}));
}
export function unhide(key){ const ed=S.exEdits[key]; if(ed){ delete ed.retired; if(!Object.keys(ed).length) delete S.exEdits[key]; } }
export function unpinEverywhere(key){
  let touched=false;
  Object.keys(S.planExtras).forEach(dk=>{
    const i=S.planExtras[dk].indexOf(key);
    if(i>=0){ S.planExtras[dk].splice(i,1); if(!S.planExtras[dk].length) delete S.planExtras[dk]; touched=true; }
  });
  return touched;
}
export async function shRetire(key){
  const ex=exByKey(key); if(!ex) return;
  const hide=!ex.retired;
  if(hide) (S.exEdits[key]||(S.exEdits[key]={})).retired=true; else unhide(key);
  const unpinned = hide ? unpinEverywhere(key) : false;
  await persistExEdits(); if(unpinned) await persistPlan();
  const box=$("sets-"+key), tag=(box&&box.parentNode)?box.parentNode.querySelector('.xtag'):null;
  if(tag && hide){ tag.className='xtag'; tag.textContent=t('ex.added'); }
  shRenderList(); render();
  shMsg(tf(hide?'msg.hidden':'msg.shown',{name:ex.name}));
  flash(tf(hide?'msg.hidden.short':'msg.shown.short',{name:ex.name}));
}
export function shResetDel(){ V.shDelArmed=null; if(V.shDelTimer) clearTimeout(V.shDelTimer); const b=$("shDelete"); if(b) b.textContent=t('btn.remove'); }
export async function shDelete(){
  const key=V.shEditing; if(!key) return;
  const ex=exByKey(key); if(!ex) return;
  const days=S.entries.filter(e=>liftsOf(e,key).length).length;
  if(V.shDelArmed!==key){
    V.shDelArmed=key;
    $("shDelete").textContent=t('btn.tapagain');
    const what = days ? tn('sh.del.clears',days,{name:ex.name}) : tf('sh.del.removes',{name:ex.name});
    shMsg(what+' '+t('sh.del.custom')+' '+t('notreversible'), true);
    V.shDelTimer=setTimeout(shResetDel,4000);
    return;
  }
  shResetDel();
  S.entries.forEach(e=>{ if(e.lifts && e.lifts[key]) delete e.lifts[key]; });
  unpinEverywhere(key);
  if(Array.isArray(S.settings.chartEx)) S.settings.chartEx=S.settings.chartEx.filter(k=>k!==key);
  S.customEx=S.customEx.filter(x=>x.key!==key); delete S.exEdits[key];
  await persistCatalogue(); await persistExEdits(); await persistPlan(); await persistSettings(); await persist();
  shClose(); fillForm($("fDate").value); render();
  flash(tf('msg.removed',{name:ex.name})+(days?(' · '+tn('msg.cleared',days)):''));
}
export function shGroupSet(k){
  const g=$("shGroup"); if(!g) return;
  if(!g.children.length){
    g.innerHTML=GROUPS.map(x=>`<button type="button" data-g="${x.key}">${esc(groupName(x.key))}</button>`).join('');
    g.querySelectorAll('button').forEach(b=>b.onclick=()=>shGroupSet(b.dataset.g));
  }
  g.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.g===k));
}
export const shGroupGet = () => { const b=document.querySelector('#shGroup button.on'); return b?b.dataset.g:'other'; };
export function shMusDraw(prim, sec){
  const box=$("shMus"); if(!box) return;
  box.innerHTML=MUSCLES.map(m=>{
    const st=prim.indexOf(m.key)>=0 ? ' p' : (sec.indexOf(m.key)>=0 ? ' s' : '');
    return `<button type="button" class="mchip${st}" data-m="${m.key}">${esc(t('mus.'+m.key))}</button>`;
  }).join('');
  box.querySelectorAll('.mchip').forEach(b=>b.onclick=()=>{
    const was=b.classList.contains('p') ? 'p' : (b.classList.contains('s') ? 's' : '');
    b.classList.remove('p','s');
    if(was==='') b.classList.add(box.querySelectorAll('.mchip.p').length<3 ? 'p' : 's');
    else if(was==='p') b.classList.add('s');
  });
}
export function shMusRead(){
  const box=$("shMus"), pick=c=>box ? [...box.querySelectorAll('.mchip.'+c)].map(b=>b.dataset.m) : [];
  return {prim:pick('p'), sec:pick('s')};
}
export const shModeGet = () => { const b=document.querySelector('#shMode button.on'); return b?b.dataset.m:'kg'; };
export const shGoalGet = () => { const b=document.querySelector('#shGoal button.on'); return b?b.dataset.g:'off'; };
export function shGoalSet(g){ document.querySelectorAll('#shGoal button').forEach(b=>b.classList.toggle('on', b.dataset.g===g)); }
export function shRangeTyped(){
  const mn=parseInt($("shMin").value,10), mx=parseInt($("shMax").value,10);
  const g=goalOfRange(isNaN(mn)?null:mn, isNaN(mx)?null:mx);
  shGoalSet(g==='off' ? 'custom' : g);
  shCoachSync();
}
export function shGoalPick(g){
  const p=GOALS.find(x=>x.key===g);
  if(p){ $("shMin").value=p.min; $("shMax").value=p.max; }
  if(g!=='off' && $("shStep").value==='') $("shStep").value=STEP_DEF(shModeGet()==='sec'?'sec':null);
  shGoalSet(g); shCoachSync();
}
export function shCoachSync(){
  const sec=shModeGet()==='sec';
  if(sec && GOALS.some(x=>x.key===shGoalGet())) shGoalSet('custom');
  document.querySelectorAll('#shGoal button').forEach(b=>{ b.style.display=(sec && GOALS.some(x=>x.key===b.dataset.g))?'none':''; });
  const g=shGoalGet();
  $("shRangeRow").style.display = g==='off' ? 'none' : '';
  const mn=parseInt($("shMin").value,10), mx=parseInt($("shMax").value,10), st=parseFloat($("shStep").value);
  const unit=t(sec?'sh.coach.secs':'sh.coach.reps');
  let note;
  if(g==='off') note=t('sh.coach.off');
  else if(isNaN(mn) || isNaN(mx) || mn<1 || mx<mn) note=t('sh.coach.bad');
  else if(!(st>0)) note=tf('sh.coach.repsonly',{min:mn, max:mx, unit:unit, n:CLEAN_TO_STEP});
  else note=tf('sh.coach.on',{min:mn, max:mx, unit:unit, step:st, n:CLEAN_TO_STEP});
  $("shCoachNote").textContent=note;
}
export function shCoachFill(ex){
  const has = !!ex && ex.repMin!=null && ex.repMax!=null;
  $("shMin").value = has ? ex.repMin : '';
  $("shMax").value = has ? ex.repMax : '';
  $("shStep").value = (has && ex.step!=null) ? ex.step : '';
  shGoalSet(has ? goalOfRange(ex.repMin, ex.repMax) : 'off');
  shCoachSync();
}
export function shCoachRead(){
  if(shGoalGet()==='off') return {repMin:null, repMax:null, step:null};
  const mn=parseInt($("shMin").value,10), mx=parseInt($("shMax").value,10);
  if(isNaN(mn) || isNaN(mx) || mn<1 || mx<mn) return undefined;
  return {repMin:mn, repMax:mx, step:$("shStep").value};
}
export function shNew(){
  V.shEditing=null; shResetDel();
  $("shName").value=''; $("shShort").value=''; $("shNote").value=''; $("shDef").value='';
  shGroupSet('other');
  document.querySelectorAll('#shMode button').forEach(b=>b.classList.toggle('on', b.dataset.m==='kg'));
  shCoachFill(null); shMusDraw([],[]);
  $("shDelete").style.display='none';
  $("shCreate").textContent=t(V.shAddToDay?'sh.createadd':'sh.addcoll');
  shMsg(''); shShow('form');
  $("shName").focus();
}
export function shEdit(key){
  const ex=exByKey(key); if(!ex) return;
  V.shEditing=key; shResetDel();
  $("shName").value=ex.name; $("shShort").value=ex.short||''; $("shNote").value=ex.note||'';
  $("shDef").value=ex.def!=null?ex.def:'';
  shGroupSet(groupOf(ex));
  const mode = ex.unit==='sec' ? 'sec' : (ex.added ? 'bw' : 'kg');
  document.querySelectorAll('#shMode button').forEach(b=>b.classList.toggle('on', b.dataset.m===mode));
  shCoachFill(ex); shMusDraw(ex.prim||[], ex.sec||[]);
  $("shDelete").style.display='';
  $("shCreate").textContent=t('btn.saveshort');
  shMsg(''); shShow('form');
}
export async function shCreate(){
  const name=$("shName").value.trim();
  if(!name){ shMsg(t('msg.needname'),true); $("shName").focus(); return; }
  const short=$("shShort").value.trim(), note=$("shNote").value.trim();
  const coach=shCoachRead();
  if(coach===undefined){ shMsg(t('sh.coach.bad'),true); $("shMin").focus(); return; }

  const mode=shModeGet(), mus=shMusRead();
  if(V.shEditing){
    const ed=S.exEdits[V.shEditing]||(S.exEdits[V.shEditing]={});
    ed.name=name.slice(0,40);
    if(short) ed.short=short.slice(0,16); else delete ed.short;
    if(note) ed.note=note.slice(0,60); else delete ed.note;
    ed.group=shGroupGet();
    const own=S.customEx.find(x=>x.key===V.shEditing);
    if(own){
      const d=parseFloat($("shDef").value);
      own.added = mode==='bw'; own.unit = mode==='sec' ? 'sec' : null;
      own.def = (isNaN(d)||d<0) ? 0 : d;
      const chk=normCustomEx(Object.assign({}, own, coach, mus));
      if(chk){ own.repMin=chk.repMin; own.repMax=chk.repMax; own.step=chk.step; own.prim=chk.prim; own.sec=chk.sec; }
      await persistCatalogue();
    }
    await persistExEdits();
    shClose(); fillForm($("fDate").value); render();
    flash(tf('msg.renamed',{name:name}));
    return;
  }

  const lower=name.toLowerCase();
  const existing=S.catalogue.find(x=>x.name.toLowerCase()===lower);
  if(existing){
    if(existing.retired){ unhide(existing.key); await persistExEdits(); }
    if(V.shAddToDay) addMovementToForm(existing.key);
    shClose(); render();
    flash(tf('msg.already',{name:existing.name})+(V.shAddToDay?' — '+t('msg.addedthat'):''));
    return;
  }
  const def=normCustomEx({
    key: cxKeyFor(name), name, short:short, note:note, group: shGroupGet(),
    def: $("shDef").value, added: mode==='bw', unit: mode==='sec' ? 'sec' : null,
    repMin: coach.repMin, repMax: coach.repMax, step: coach.step,
    prim: mus.prim, sec: mus.sec
  });
  if(!def){ shMsg(t('msg.badname'),true); return; }
  S.customEx.push(def);
  const ok=await persistCatalogue();
  if(!ok){ S.customEx.pop(); rebuildCatalogue(); shMsg(t('msg.savefail.ex'),true); return; }
  if(V.shAddToDay) addMovementToForm(def.key);
  shClose();
  render();
  flash(V.shAddToDay ? tf('msg.created',{name:def.name})
                   : tf('msg.createdcoll',{name:def.name}));
}
