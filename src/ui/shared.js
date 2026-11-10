// Helpers the pages share: plan and session lookups, wording for loads and records, thin links to state/persist.
import * as P from '../state/persist';
import * as core from '../core/index';
import * as schema from '../store/schema';
import { CD_LIB, LIB, SX_LIB, libByKey } from '../data/library';
import { CLEAN_TO_STEP, recordsOf, repInc } from '../core/strength';
import { GROUPS, GROUP_KEYS, MUSCLE_KEYS } from '../data/muscles';
import { PLAN_SETS_DEF, normEntry } from '../store/schema';
import { S } from '../state/app';
import { cardioByKey, exByKey, stretchByKey } from '../state/persist';
import { localDate } from '../core/dates';
import { muscleVolume, weekStart } from '../core/volume';
import { t, tf } from '../i18n/index';
import { $, esc, flash } from './dom';

export const APP_VERSION = '9.0';
export const kcalFloor = () => core.kcalFloor(S.settings.sex);
export const kcalBand = target => core.kcalBand(target, S.settings.sex);
export const kcalState = (avg, target) => core.kcalState(avg, target, S.settings.sex);
export const actName  = k => t('act.'+k+'.name');
export const actHours = k => t('act.'+k+'.hours');
export const actNote  = k => t('act.'+k+'.note');
export const ACTIVITY_HELP = ['hour','hard','week','lower'];
export const colName = v => t('col.'+String(v).replace(/^--/,''));
export const MAX_SERIES = 8;
export const ALL_LIBS = () => LIB.concat(SX_LIB, CD_LIB);
export const exLv = ex => { const l=ex && ex.lib ? libByKey(ex.lib) : null; return l ? l.lv : null; };
export const byName = (a,b) => String(a).localeCompare(String(b), undefined, {sensitivity:'base', numeric:true});
export const libOrder = (a,b) => (a.lv||0)-(b.lv||0) || byName(t('lib.'+a.key), t('lib.'+b.key));
export const exOrder = (a,b) => (exLv(a)||0)-(exLv(b)||0) || byName(a.name, b.name);
export const qWords = x => { const w=String(x||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); return w.concat(w.slice(1).map((v,i)=>w[i]+v)); };
export const qMatch = (q, text) => { const h=qWords(text); return String(q||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).every(p=>h.some(w=>w.indexOf(p)===0)); };
export const libAvailable = (l, have) => l.eq.every(q=>have.indexOf(q)>=0);
export function cxKeyFor(name){
  let base = 'cx_'+String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,28);
  if(base==='cx_') base='cx_move';
  let k=base, n=1;
  while(S.catByKey.has(k)) k=base+(++n);
  return k;
}
export function cdKeyFor(name){
  let base='cd_'+String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,28);
  if(base==='cd_') base='cd_session';
  let k=base, n=1;
  while(S.cardios.some(c=>c.key===k)) k=base+(++n);
  return k;
}
export const sxIsReps = s => !!(s && s.unit==='reps');
export const sxTarget = s => !s ? 0 : (sxIsReps(s) ? (s.reps||0) : (s.secs||0));
export function sxKeyFor(name){
  let base='sx_'+String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,28);
  if(base==='sx_') base='sx_stretch';
  let k=base, n=1;
  while(S.stretches.some(s=>s.key===k)) k=base+(++n);
  return k;
}
export const exNote = ex => (ex && ex.note) ? ex.note : t('ex.defaultnote');
export const DAYS = ['sun','mon','tue','wed','thu','fri','sat'].map(key=>({key}));
export const dayName = k => t('day.'+k);
export const dayShort = k => t('day.short.'+k);
export function dayLabel(k){
  const ks=sessionEx(k);
  if(!ks.length) return dayName(k)+' · '+t('day.rest');
  return dayName(k)+' · '+ks.map(x=>{ const e=exByKey(x); return e?e.short:x; }).join(' + ');
}
export const normPlan = p => schema.normPlan(p, exByKey);
export const normPlanSets = p => schema.normPlanSets(p, exByKey);
export const plannedSets = (dayKey, key) => (S.planSets[dayKey] && S.planSets[dayKey][key]) || null;
export function sessionEx(dayKey){
  return (S.planExtras[dayKey]||[]).filter((k,i,a)=>{ const ex=exByKey(k); return ex && !ex.retired && a.indexOf(k)===i; });
}
export const planKeys = () => { const s=new Set(); DAYS.forEach(d=>sessionEx(d.key).forEach(k=>s.add(k))); return [...s]; };
export const LINE_COLORS = ['#0d59d1','#f7801e','#ffc21a','#e11d2a','#8b2fc9','#1b9fd8','#2fb84a','#d6006e','#141430'];
export const effAge = () => core.effAge(S.settings.age, S.settings.ageSet);
export const protAuto = () => core.protAuto(S.settings.sex);
export const protTarget = () => core.protTarget(S.settings.sex, S.settings.protFloor);
export const protOk = () => core.protOk(S.settings.sex, S.settings.protFloor);
export const load = P.loadDays;
export async function persist(){ const ok=await P.saveDays(); if(!ok) flash(t('msg.savefail'),true); return ok; }
export const loadSettings = P.loadSettings, persistSettings = P.saveSettings;
export const loadCatalogue = P.loadCatalogue, persistCatalogue = P.saveCatalogue;
export const prettyKey = k => P.prettyKey(k, t('ex.movement'));
export const recoverMovements = () => P.recoverMovements(t('ex.movement'), t('msg.recoverednote'));
export const loadExEdits = P.loadExEdits, persistExEdits = P.saveExEdits, loadPlan = P.loadPlan;
export const loadStretches = P.loadStretches, persistStretches = P.saveStretches, recoverStretches = () => P.recoverStretches(t('ex.movement'));
export const loadCardio = P.loadCardio, persistCardio = P.saveCardio, loadGym = P.loadGym, persistGym = P.saveGym;
export const recoverCardio = () => P.recoverCardio(t('ex.movement'));
export const sxToday = {}, cdToday = {};
export const planLogsInit = P.planLogsInit, planObject = P.planObject, persistPlan = P.savePlan;
export const liftsOf = (e,k)=> (e.lifts && e.lifts[k]) ? e.lifts[k] : [];
export const groupName = k => t('grp.'+(GROUP_KEYS.indexOf(k)>=0?k:'other'));
export const groupOf = ex => (ex && GROUP_KEYS.indexOf(ex.group)>=0) ? ex.group : 'other';
export function didGroup(e,group){
  return Object.keys(e.lifts||{}).some(k=>{ const ex=exByKey(k); return ex && groupOf(ex)===group && liftsOf(e,k).length>0; });
}
export function groupTarget(group){
  return DAYS.filter(d=>sessionEx(d.key).some(k=>{ const ex=exByKey(k); return ex && groupOf(ex)===group; })).length;
}
export const sessionTarget = () => DAYS.filter(d=>sessionEx(d.key).length>0).length;
export const activeGroups = () => GROUPS.filter(g=>groupTarget(g.key)>0);
export const trained = e => !!(e.lifts && Object.keys(e.lifts).length);
export const lastNumOf = get => core.lastNumOf(S.entries, get);
export function lastSessionOf(key, dayKey){
  if(dayKey){ for(let i=S.entries.length-1;i>=0;i--){ const e=S.entries[i]; if(e.day===dayKey){ const s=liftsOf(e,key); if(s.length) return s; } } }
  for(let i=S.entries.length-1;i>=0;i--){ const s=liftsOf(S.entries[i],key); if(s.length) return s; }
  return null;
}
export const deltaOf = (get, days) => core.deltaOf(S.entries, get, days);
export const sessionsBefore = (key, date) => S.entries.filter(e=>e.date<date).map(e=>liftsOf(e,key)).filter(s=>s.length);
export function fmtLoad(ex, kg){
  if(ex.added) return kg>0 ? 'BW+'+kg : 'BW';
  if(ex.unit==='sec' && !kg) return '';
  return kg+' kg';
}
export function coachLine(ex, plan){
  const sec=ex.unit==='sec';
  const v={min:ex.repMin, max:ex.repMax, unit:t(sec?'sh.coach.secs':'sh.coach.reps'), step:ex.step, n:CLEAN_TO_STEP,
           inc:repInc(ex), left:Math.max(1, CLEAN_TO_STEP-(plan.run||0)), aim:plan.targets[0],
           last:plan.last ? plan.last.reps.map(r=>sec?r+'s':r).join(', ') : ''};
  const msg = plan.kind==='reps' && sec ? tf('coach.secs', v) : tf('coach.'+plan.kind, v);
  const L = plan.kind==='first' ? '' : fmtLoad(ex, plan.load);
  return `<b>${esc(t('coach.next'))}</b> · ${L?`<b>${esc(L)}</b> · `:''}${esc(msg)}`;
}
export function recordsLine(ex, r){
  const b=[];
  if(r.bwReps) b.push(`${esc(t('rec.bwreps'))} <b>BW × ${r.bwReps.reps}</b>`);
  if(r.heavy)  b.push(`${esc(t(ex.added?'rec.heavy':'rec.best'))} <b>${esc(fmtLoad(ex,r.heavy.kg))} × ${r.heavy.reps}</b>`);
  if(r.e1rm)   b.push(`${esc(t('rec.e1rm'))} <b>${r.e1rm.e.toFixed(1)} kg</b>`);
  if(r.hold)   b.push(`${esc(t('rec.hold'))} <b>${r.hold.reps}s</b>`);
  return b.join(' · ');
}
export function recordsBeaten(ex, was, now){
  return core.recordsBeatenKinds(was, now).map(k => k==='heavy' ? fmtLoad(ex, now.heavy.kg)+' × '+now.heavy.reps
    : k==='e1rm' ? t('rec.e1rm')+' '+now.e1rm.e.toFixed(1)+' kg' : k==='bwReps' ? 'BW × '+now.bwReps.reps : now.hold.reps+'s');
}
export function recordsNewOn(date){
  const day=S.entries.find(e=>e.date===date); if(!day || !day.lifts) return '';
  const out=[];
  Object.keys(day.lifts).forEach(key=>{
    const ex=exByKey(key); if(!ex) return;
    const all=S.entries.map(e=>({date:e.date, sets:liftsOf(e,key)})).filter(s=>s.sets.length);
    const others=all.filter(s=>s.date!==date), mine=all.filter(s=>s.date===date);
    if(!others.length || !mine.length) return;
    const bits=recordsBeaten(ex, recordsOf(ex, others), recordsOf(ex, mine));
    if(bits.length) out.push((ex.short||ex.name)+' '+bits.join(', '));
  });
  return out.length ? tf('rec.new',{list:out.join(' · ')}) : '';
}
export function fmtSets(key, sets){
  if(!sets || !sets.length) return '—';
  const ex=exByKey(key)||{}, sec=ex.unit==='sec';
  const rp = r => sec ? r+'s' : r;
  const ld = s => s.variant!=null ? s.variant : ex.added ? (s.kg>0 ? 'BW+'+s.kg : 'BW') : (sec && !s.kg) ? '' : s.kg+'kg';
  const first=ld(sets[0]);
  if(sets.every(s=>ld(s)===first)) return (first ? first+' — ' : '')+sets.map(s=>rp(s.reps)).join(', ');
  return sets.map(s=>{ const l=ld(s); return (l ? l+'×' : '')+rp(s.reps); }).join('  ');
}
export const loadBackupDate = P.loadBackupDate;
export const fmtSetsN = n => (n%1 ? n.toFixed(1) : String(n));
export function libOwned(l){
  const nm=t('lib.'+l.key).toLowerCase();
  return S.catalogue.find(x=>x.lib===l.key || x.name.toLowerCase()===nm) || null;
}
export const libLive = l => { const o=libOwned(l); return !!o && !o.retired; };
export const libUsable = l => !S.gym.set || libAvailable(l, S.gym.have);
export function weekVolume(){
  const today=localDate(), start=weekStart(today), todayIdx=new Date(today+'T12:00:00').getDay();
  const done=muscleVolume(S.entries.filter(e=>e.date>=start && e.date<=today), exByKey);
  const cur=S.entries.find(e=>e.date===today);
  const plan={}; MUSCLE_KEYS.forEach(k=>plan[k]=0);
  DAYS.forEach((d,i)=>{
    if(i<todayIdx) return;
    sessionEx(d.key).forEach(k=>{
      if(i===todayIdx && cur && liftsOf(cur,k).length) return;
      const ex=exByKey(k), last=lastSessionOf(k), n=plannedSets(d.key,k) || (last ? last.length : PLAN_SETS_DEF);
      (ex.prim||[]).forEach(m=>{ if(m in plan) plan[m]+=n; });
      (ex.sec||[]).forEach(m=>{ if(m in plan) plan[m]+=n/2; });
    });
  });
  const proj={}; MUSCLE_KEYS.forEach(k=>proj[k]=done.vol[k]+plan[k]);
  return {vol:done.vol, proj:proj, untagged:done.untagged, planned:planKeys().length>0, lastDay:todayIdx===6};
}
export function dayEntry(){
  const date=$("fDate").value;
  if(!date) return null;
  if(S.loadFailed){ flash(t('msg.loadfail.save'),true); return null; }
  let e=S.entries.find(x=>x.date===date);
  if(!e){
    e=normEntry({date:date, day:$("fDay").value}); if(!e) return null;
    S.entries.push(e); S.entries.sort((a,b)=>a.date.localeCompare(b.date));
  }
  return e;
}
export const mobSetsOf = (e, k) => (e && e.mobSets && e.mobSets[k]) || 1;
export const cdSetsOf = (e, k) => (e && e.cardioSets && e.cardioSets[k]) || 1;
export const sxName = k => { const s=stretchByKey(k); return s ? s.name : prettyKey(k); };
export const cdName = k => { const c=cardioByKey(k); return c ? c.name : prettyKey(k); };
export const measName = k => t('m.'+k).replace(/\s*\(.*\)$/,'').toLowerCase();
export const entriesInWindow = () => core.entriesInWindow(S.entries, S.settings.calPeriod);
export const kcalTargetFor = tdee => core.kcalTargetFor(tdee, S.settings.sex, S.settings.calRate);
export const calRecommend = () => core.calRecommend(S.entries, S.settings);
export const bfNeeds = () => core.bfNeeds(S.settings.sex);
export const bfNeedsText = () => { const n=bfNeeds().map(k=>t('m.'+k).toLowerCase()); return n.length>1 ? n.slice(0,-1).join(', ')+' and '+n[n.length-1] : (n[0]||''); };
export const exportObject = P.exportObject;
export const saveUndo = P.saveUndo, loadUndo = P.loadUndo;
