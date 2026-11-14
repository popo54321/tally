// The stretch and cardio picker sheet.
import { CD_LIB, SX_LIB, cdLibByKey, sxLibByKey } from '../data/library';
import { S } from '../state/app';
import { V } from '../ui/view';
import { activeCardio, activeStretches, cardioByKey, stretchByKey } from '../state/persist';
import { normCardio, normStretch } from '../store/schema';
import { t, tf, tn } from '../i18n/index';
import { $, esc, flash, lvTag } from './dom';
import { byName, cdKeyFor, cdToday, dayShort, libUsable, persistCardio, persistPlan, persistStretches, qMatch, sxIsReps, sxKeyFor, sxTarget, sxToday, sameName } from './shared';
import { cdOpen, drawCardio } from './cardio';
import { dayLogKeys, drawMob, sxOpen } from './mobility';
import { dlgClose, dlgOpen } from './dialog';

export const kpCfg = k => k==='sx'
  ? {lib:SX_LIB, mine:activeStretches, plan:S.planSx, today:sxToday, libName:l=>t('sxlib.'+l.key), owned:sxOwned, fromLib:sxFromLib, draw:()=>drawMob(), log:'mob'}
  : {lib:CD_LIB, mine:activeCardio,    plan:S.planCd, today:cdToday, libName:l=>t('cdlib.'+l.key), owned:cdOwned, fromLib:cdFromLib, draw:()=>drawCardio(), log:'cardio'};
export function kpOpen(kind){
  V.kpKind=kind;
  $("kpTitle").textContent=t(kind==='sx'?'kp.title.sx':'kp.title.cd');
  $("kpNew").textContent=t(kind==='sx'?'sx.new':'cdx.new');
  $("kpSearch").value=''; $("kpSearch").placeholder=t(kind==='sx'?'kp.search.sx':'kp.search.cd');
  kpRender(); dlgOpen("kpWrap");
}
export function kpClose(){ dlgClose("kpWrap"); }
export const sxSub = l => (l.mode==='reps' ? tn('mob.repsn',l.tgt) : tf('mob.holdn',{n:l.tgt}));
export function kpRender(){
  const c=kpCfg(V.kpKind), q=$("kpSearch").value.trim(), dayKey=$("fDay").value;
  const cur=S.entries.find(e=>e.date===$("fDate").value), log=(cur && cur[c.log]) || {};
  const shown=new Set(dayLogKeys(c.plan, c.today, log));
  const mine=c.mine().filter(x=>!shown.has(x.key) && (!q || qMatch(q, x.name))).sort((a,b)=>byName(a.name,b.name));
  const mineRow=x=>`<div class="sh-row"><div class="nm">${esc(x.name)}<span>${esc(V.kpKind==='sx' ? (sxTarget(x) ? (sxIsReps(x)?tn('mob.repsn',sxTarget(x)):tf('mob.holdn',{n:sxTarget(x)})) : t('mob.nohold')) : (x.mins?tf('cd.target',{n:x.mins}):t('cd.notarget')))}</span></div><button class="sh-add" data-kadd="${esc(x.key)}">${esc(t('btn.add'))}</button></div>`;
  const lib=c.lib.filter(l=>!c.owned(l) && (!q || qMatch(q, c.libName(l)+' '+(l.mus||[]).map(m=>t('mus.'+m)).join(' ')+(l.lv?' '+t('lv.'+l.lv):''))))
    .sort((a,b)=>(libUsable(b)?1:0)-(libUsable(a)?1:0) || (a.lv||0)-(b.lv||0) || byName(c.libName(a),c.libName(b)));
  const libRowK=l=>{ const ok=libUsable(l), eq=l.eq.length ? l.eq.map(x=>t('eq.'+x)).join(', ') : t('guide.noeq');
    const sub=V.kpKind==='sx' ? l.mus.map(m=>t('mus.'+m)).join(', ')+' · '+sxSub(l) : tf('cd.target',{n:l.mins});
    return `<div class="sh-row${ok?'':' off'}"><div class="nm">${esc(c.libName(l))}${V.kpKind==='sx'?lvTag(l.lv):''}<span>${esc(sub)} · ${esc(ok?eq:tf('guide.needs',{list:eq}))}</span></div><button class="sh-add" data-ladd="${esc(l.key)}">${esc(t('btn.add'))}</button></div>`; };
  $("kpList").innerHTML = (mine.length ? `<div class="sh-grp">${esc(t(V.kpKind==='sx'?'kp.mine.sx':'kp.mine.cd'))}</div>`+mine.map(mineRow).join('') : '')
    + (lib.length ? `<div class="sh-grp">${esc(t('sh.lib'))}</div>`+lib.map(libRowK).join('') : '')
    || `<div class="sh-empty">${esc(q?tf('nomatch',{q:q}):t('kp.empty'))}</div>`;
}
export async function kpPick(key){
  const c=kpCfg(V.kpKind), date=$("fDate").value;
  (c.today[date]||(c.today[date]=[])).push(key);
  kpClose(); c.draw();
  const x=V.kpKind==='sx'?stretchByKey(key):cardioByKey(key);
  flash(tf('msg.exadded',{name:x?x.name:''}));
}
export async function kpLibPick(libKey){ const key=await kpCfg(V.kpKind).fromLib(libKey); if(key) kpPick(key); }
export function kpNew(){ kpClose(); if(V.kpKind==='sx'){ V.sxPinDay=$("fDay").value; sxOpen(null); } else { V.cdPinDay=$("fDay").value; cdOpen(null); } }
export const sxOwned = l => S.stretches.find(x=>x.lib===l.key || sameName(x.name, t('sxlib.'+l.key))) || null;
export const cdOwned = l => S.cardios.find(x=>x.lib===l.key || sameName(x.name, t('cdlib.'+l.key))) || null;
export async function sxFromLib(k){
  const l=sxLibByKey(k); if(!l) return null;
  const have=sxOwned(l);
  if(have){ if(have.retired){ have.retired=false; await persistStretches(); } return have.key; }
  const name=t('sxlib.'+k), reps=l.mode==='reps';
  const x=normStretch({key:sxKeyFor(name), name:name, unit:reps?'reps':null, secs:reps?0:l.tgt, reps:reps?l.tgt:0, mus:l.mus, lib:k});
  if(!x) return null;
  S.stretches.push(x); await persistStretches(); return x.key;
}
export async function cdFromLib(k){
  const l=cdLibByKey(k); if(!l) return null;
  const have=cdOwned(l);
  if(have){ if(have.retired){ have.retired=false; await persistCardio(); } return have.key; }
  const name=t('cdlib.'+k);
  const x=normCardio({key:cdKeyFor(name), name:name, mins:l.mins, lib:k});
  if(!x) return null;
  S.cardios.push(x); await persistCardio(); return x.key;
}
