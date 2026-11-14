// Settings > Sync: backup file, export, import, undo, Copy for your AI, version line.
import { MEAS } from '../data/measurements';
import { S } from '../state/app';
import { STORE } from '../store/kv';
import { UKEY, normCardio, normCustomEx, normEntries, normExEdits, normGym, normSettings, normStretch, normTheme } from '../store/schema';
import { V } from '../ui/view';
import { calcCalibration } from '../core/trend';
import { dnum, localDate, weekdayKey, within7 } from '../core/dates';
import { exByKey, stretchByKey } from '../state/persist';
import { fmtSigned } from '../core/numbers';
import { kcalOf } from '../core/nutrition';
import { t, tf, tn } from '../i18n/index';
import { $, cap, flash, isObj } from './dom';
import { APP_VERSION, calRecommend, DAYS, activeGroups, deltaOf, didGroup, entriesInWindow, exportObject, fmtSets, groupName, groupTarget, kcalFloor, kcalTargetFor, lastSessionOf, liftsOf, measName, normPlan, normPlanSets, persist, persistCardio, persistCatalogue, persistExEdits, persistGym, persistPlan, persistSettings, persistStretches, planKeys, planLogsInit, protOk, protTarget, saveUndo, sessionEx, sessionTarget, sxIsReps, trained } from './shared';
import { fillForm, profileTDEE } from './body';
import { markBackedUp } from './backup';
import { persistTheme } from './theme';
import { render } from './nav';
import { routinesFromBackup } from '../state/routines';
import { routineNameFor } from './routines';

export function drawVersion(){
  const el=$("appVer"); if(!el) return;
  const android=!!window.AndroidFile;
  const line=tf('ver.line',{name:t('ver.app'), v:APP_VERSION,
    where:t(android ? 'ver.android' : location.protocol==='file:' ? 'ver.file' : 'ver.web')});
  el.textContent=line;
  if(!android && window.caches && caches.keys) caches.keys().then(ks=>{
    const k=ks.find(x=>/^tally-[0-9a-f]{12}$/.test(x));
    if(k) el.textContent=line+' · '+tf('ver.build',{id:k.slice(6,13)});
  }).catch(()=>{});
}
export function exportPayload(){ return JSON.stringify(exportObject()); }
export function doExport(){
  const box=$("exportBox");
  if(box.classList.contains('show')){ box.classList.remove('show'); return; }
  box.value = S.entries.length ? exportPayload() : t('sync.nothing');
  box.classList.add('show'); box.focus(); box.select();
}
export function smsg(msg,err){ const m=$("syncMsg"); if(!m) return; m.textContent=msg||''; m.className='syncmsg'+(err?' err':''); }
export function pickFile(){ smsg(''); $("importFile").click(); }
export function onFilePicked(ev){
  const f=ev.target.files && ev.target.files[0];
  ev.target.value='';
  if(!f) return;
  const rd=new FileReader();
  rd.onerror=()=>smsg(t('sync.readfail'),true);
  rd.onload=()=>{
    const txt=String(rd.result||'').trim();
    if(!txt){ smsg(t('sync.emptyfile'),true); return; }
    $("importBox").value=txt;
    $("importBox").classList.add('show');
    $("loadBtn").classList.add('show');
    resetImportBtn();
    smsg(tf('sync.fileloaded',{name:f.name, n:txt.length}));
  };
  rd.readAsText(f);
}
export function saveBackupFile(){
  if(!S.entries.length){ smsg(t('sync.nothingyet'),true); return; }
  const payload=exportPayload(), name='tally-'+localDate()+'.json';
  if(window.AndroidFile && typeof window.AndroidFile.save==='function'){
    const written=window.AndroidFile.save(name,payload);
    smsg(written?tf('sync.savedto',{path:written}):t('sync.writefail'), !written);
    if(written) markBackedUp();
    return;
  }
  const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  smsg(tf('sync.saved',{name:name}));
  markBackedUp();
}
export function goalLabel(r){ return r>0?('+'+r+' kg/week'):r<0?('\u2212'+Math.abs(r)+' kg/week'):'maintain'; }
export function periodLabel(p){ return p==='all'?'all logged days':(p+' days'); }
export function weeklySlope(list){
  const p=list.filter(e=>e.weight!=null).map(e=>({t:dnum(e.date),w:e.weight}));
  if(p.length<2) return null;
  const n=p.length,tb=p.reduce((s,q)=>s+q.t,0)/n,wb=p.reduce((s,q)=>s+q.w,0)/n;
  let nu=0,de=0; p.forEach(q=>{nu+=(q.t-tb)*(q.w-wb);de+=(q.t-tb)**2;});
  return de>0?(nu/de)*7:null;
}
export function buildAiReport(){
  const gen=localDate();
  const weighed=S.entries.filter(e=>e.weight!=null);
  const first=S.entries.length?S.entries[0].date:'n/a', last=S.entries.length?S.entries[S.entries.length-1].date:'n/a';
  const L=[];
  L.push('=== TRAINING REPORT FOR ANALYSIS ===');
  L.push('Generated: '+gen+'  |  Data span: '+first+' \u2192 '+last+'  |  '+S.entries.length+' entries');
  L.push('Ask: read the plan and selected goal, then assess how the recent weeks track against them. The raw JSON at the end is complete - use it for anything the summary omits.');
  L.push('');
  L.push('--- CURRENT PLAN & SELECTED GOAL ---');
  L.push('Selected goal (calibration): '+goalLabel(S.settings.calRate)+'   [options: \u22120.5 / \u22120.25 / maintain / +0.25 / +0.5]');
  L.push('Calibration window selected: '+periodLabel(S.settings.calPeriod));
  L.push('Chart window selected: '+periodLabel(V.chartPeriod));
  L.push('Calorie target currently set: '+S.settings.kcalTarget+' kcal/day'+(S.settings.kcalOwn?' (set by hand)':' (from the estimate or default)'));
  L.push('Protein target (daily): '+protTarget()+' g, '+(S.settings.protFloor!=null?'set by hand':'automatic for '+(S.settings.sex||'sex not set'))+'; anything from '+protOk()+' g counts as fine');
  L.push('');
  L.push('--- HOW THESE NUMBERS WERE DERIVED ---');
  L.push('All figures below are estimates from population formulas, not measurements. Not medical advice.');
  const bfMan=S.entries.filter(e=>e.bfSrc==='manual').length;
  L.push('Body fat: US Navy girth method (Hodgdon & Beckett), '+(S.settings.sex||'male')+' equation, from logged girths and height. Roughly +/-3-4 points against DEXA.'
    + (bfMan?(' NOTE: '+bfMan+' entr'+(bfMan===1?'y was':'ies were')+' entered by hand instead (scale, DEXA or calipers) and are not girth estimates.'):''));
  const pt=profileTDEE();
  if(pt) L.push('Starting energy estimate: Mifflin-St Jeor resting rate '+pt.bmr+' kcal (weight '+pt.weight.toFixed(1)+' kg, height '+pt.height+' cm, age '+pt.age+', '+(S.settings.sex||'male')+') x '+pt.mult+' activity = '+pt.tdee+' kcal.');
  L.push('Adaptive maintenance: robust weight trend over the window (Theil-Sen: median of pairwise slopes, so single odd weigh-ins barely move it) x 7700 kcal/kg, subtracted from mean logged intake, with a +/- range from weigh-in scatter, span and intake variation. Blended with the formula estimate (Mifflin-St Jeor x activity, assumed +/-10%), each weighted by how certain it is, so early estimates lean on the formula and later ones on the logs. Short windows are distorted by water and glycogen.');
  L.push('Daily target: maintenance + (goal kg/week x 7700 / 7), floored at '+kcalFloor()+' kcal.');
  L.push('Protein: one fixed daily target, 100 g for women and 140 g for men (120 g until sex is set). That is about 1.6 g/kg of a healthy weight for nearly every height; 75% of it matches the 1.2 g/kg low end of current guidelines.');
  const planLine=DAYS.map(d=>{
    const ks=sessionEx(d.key);
    return cap(d.key)+' '+(ks.length?ks.map(k=>{const x=exByKey(k);return x?x.short:k;}).join(' + '):'rest');
  }).join(' \u00b7 ');
  L.push('Plan: '+planLine+'.');
  L.push('');
  const d7=deltaOf(e=>e.weight,7), d30=deltaOf(e=>e.weight,30);
  const slopeAll=weeklySlope(weighed);
  const cal=calcCalibration(entriesInWindow());
  L.push('--- WEIGHT & ENERGY ---');
  L.push('Latest weight: '+(weighed.length?weighed[weighed.length-1].weight.toFixed(1)+' kg ('+weighed[weighed.length-1].date+')':'n/a'));
  L.push('7-day change: '+(d7?fmtSigned(d7.delta,' kg'):'n/a')+'    30-day change: '+(d30?fmtSigned(d30.delta,' kg'):'n/a'));
  L.push('Trend, all data: '+fmtSigned(slopeAll,' kg/week',2));
  if(cal.slope!=null) L.push('Trend, calibration window ('+periodLabel(S.settings.calPeriod)+'): '+fmtSigned(cal.slope*7,' kg/week',2));
  if(cal.tdee!=null){
    const cr=calRecommend(), rec=cr.target;
    L.push('Estimated maintenance (TDEE): '+Math.round(cr.tdee/10)*10+' kcal, likely range +/-'+Math.max(30, Math.round(cr.sd/10)*10)+' kcal'
      +(cr.formula!=null ? ' (blend: '+Math.round(cr.logShare*100)+'% from logs, rest from the formula estimate '+cr.formula+' kcal)' : ' (from logs only; no profile for a formula estimate)'));
    L.push('Back-calculated from logs alone: '+Math.round(cal.tdee/10)*10+' kcal +/-'+Math.round(cal.sd/10)*10+' (robust trend line through the weigh-ins)');
    L.push('Mean intake logged (window): '+Math.round(cal.meanK)+' kcal');
    L.push('Recommended intake for the selected goal: '+rec+' kcal   (currently set: '+S.settings.kcalTarget+')');
  } else {
    L.push('Maintenance estimate: not enough overlapping weight+kcal in the selected window yet.');
  }
  L.push('');
  const wk=S.entries.filter(e=>within7(e.date));
  const pAll=S.entries.filter(e=>e.prot!=null);
  const protMean=pAll.length?Math.round(pAll.reduce((s,e)=>s+e.prot,0)/pAll.length):null;
  let lowP=null; pAll.forEach(e=>{ if(lowP==null||e.prot<lowP.prot) lowP=e; });
  const wkP=wk.filter(e=>e.prot!=null), wkPhit=wkP.filter(e=>e.prot>=protOk()).length;
  const wkK=wk.filter(e=>kcalOf(e)!=null), wkKmean=wkK.length?Math.round(wkK.reduce((s,e)=>s+kcalOf(e),0)/wkK.length):null;
  L.push('--- PROTEIN & ADHERENCE ---');
  L.push('Protein at or above the fine level (\u2265'+protOk()+' g), last 7 days: '+wkPhit+' / '+wkP.length+' logged');
  L.push('Mean protein (all logged): '+(protMean!=null?protMean+' g':'n/a')+'    Lowest: '+(lowP?lowP.prot+' g on '+lowP.date+' \u2190 the limiter':'n/a'));
  L.push('Mean energy, last 7 days: '+(wkKmean!=null?wkKmean+' kcal':'n/a'));
  const sess=wk.filter(e=>trained(e)).length;
  const cc=g=>wk.filter(e=>didGroup(e,g)).length;
  L.push('Sessions, last 7 days: '+sess+' / '+sessionTarget()
    +(activeGroups().length?('   ('+activeGroups().map(g=>groupName(g.key).toLowerCase()+' '+cc(g.key)+'/'+groupTarget(g.key)).join(' \u00b7 ')+')'):''));
  const mobDays=wk.filter(e=>e.mob && Object.keys(e.mob).length);
  let mobSecs=0, mobReps=0;
  mobDays.forEach(e=>Object.keys(e.mob).forEach(k=>{
    const st=stretchByKey(k); if(sxIsReps(st)) mobReps+=(e.mob[k]||0); else mobSecs+=(e.mob[k]||0); }));
  L.push('Mobility, last 7 days: '+mobDays.length+' day(s), '+Math.round(mobSecs/60)+' min held'
    +(mobReps?(', '+mobReps+' reps'):''));
  if(mobDays.length){
    const per={};
    S.entries.filter(e=>e.mob).forEach(e=>Object.keys(e.mob).forEach(k=>{ per[k]=per[k]||{n:0,s:0}; per[k].n++; per[k].s+=e.mob[k]||0; }));
    L.push('Mobility by stretch (all logged): '+Object.keys(per).map(k=>{
      const st=stretchByKey(k), nm=st?st.name:k;
      const unit = per[k].s ? (sxIsReps(st) ? (' ('+per[k].s+' reps)') : (' ('+Math.round(per[k].s/60)+' min)')) : '';
      return nm+' \u00d7'+per[k].n+unit;
    }).join(' \u00b7 '));
  }
  L.push('');
  L.push('--- STRENGTH (latest logged session per movement) ---');
  const pk=planKeys();
  const logged=S.catalogue.filter(ex=>S.entries.some(e=>liftsOf(e,ex.key).length))
    .sort((a,b)=>(pk.indexOf(a.key)<0?99:pk.indexOf(a.key))-(pk.indexOf(b.key)<0?99:pk.indexOf(b.key)));
  if(logged.length){ logged.forEach(ex=>{ const s=lastSessionOf(ex.key); const d=[...S.entries].reverse().find(e=>liftsOf(e,ex.key).length);
    L.push(ex.name+(pk.indexOf(ex.key)<0?' [off plan]':'')+': '+fmtSets(ex.key,s)+'  ('+(d?d.date:'?')+')'); }); }
  else L.push('No movements logged yet.');
  L.push('');
  L.push('--- BODY MEASUREMENTS (cm) ---');
  const measE=S.entries.filter(e=>e.meas);
  if(measE.length){
    const lm=measE[measE.length-1], fm=measE[0];
    L.push('Latest ('+lm.date+'): '+MEAS.map(m=>measName(m.key)+' '+(lm.meas[m.key]!=null?lm.meas[m.key]:'-')).join(' \u00b7 '));
    const dl=MEAS.map(m=>{ const a=fm.meas[m.key], b=lm.meas[m.key]; return (a!=null&&b!=null)?measName(m.key)+' '+fmtSigned(b-a,'',1):null; }).filter(Boolean);
    if(dl.length) L.push('Change since '+fm.date+': '+dl.join(' \u00b7 '));
    const bfE=S.entries.filter(e=>e.bf!=null);
    if(bfE.length) L.push('Body fat (Navy est, latest): '+bfE[bfE.length-1].bf.toFixed(1)+'%');
  } else L.push('No measurements logged.');
  L.push('');
  L.push('--- DATA QUALITY FLAGS ---');
  const flags=[];
  const fasts=S.entries.filter(e=>e.fast).map(e=>e.date+' ('+(e.kcal!=null?e.kcal+' kcal':'nothing logged, counted as 0')+')');
  if(fasts.length) L.push('Fasting days, marked by the user (real data, not errors): '+fasts.join(', '));
  L.push('Low-calorie days are taken as logged. A day with no food logged and no fasting mark is left out of averages, not counted as 0.');
  S.entries.forEach(e=>{ const w=weekdayKey(e.date); if(e.day&&e.day!==w) flags.push(e.date+': tagged \''+e.day+'\' but that date is '+w+' - counts toward the wrong weekly pattern'); });
  const dsince=d=>d?Math.round(dnum(gen)-dnum(d)):null;
  const lastW=weighed.length?weighed[weighed.length-1].date:null;
  const lastM=measE.length?measE[measE.length-1].date:null;
  if(lastW) flags.push('Weight last logged '+dsince(lastW)+' day(s) ago ('+lastW+')');
  if(lastM) flags.push('Measurements last logged '+dsince(lastM)+' day(s) ago ('+lastM+')'+(dsince(lastM)>14?' - stale':''));
  else flags.push('No measurements on record.');
  flags.forEach(f=>L.push('- '+f));
  L.push('');
  L.push('--- RAW DATA (JSON, complete, loss-less) ---');
  L.push(JSON.stringify(exportObject({selection:{chartPeriod:V.chartPeriod}})));
  L.push('');
  L.push('=== END REPORT ===');
  return L.join('\n');
}
export function copyForAi(){
  if(!S.entries.length){ smsg(t('sync.noreport'),true); return; }
  const box=$("aiBox");
  const text=buildAiReport();
  box.value=text; box.classList.add('show'); box.focus(); box.select();
  const done=function(n){ smsg(tf('sync.reportready',{n:n})); };
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){done(text.length);}, function(){done(text.length);}); }
    else { try{ document.execCommand('copy'); }catch(e){} done(text.length); }
  }catch(e){ done(text.length); }
}
export function doImport(){
  const box=$("importBox"), btn=$("loadBtn");
  const showing=box.classList.toggle('show');
  btn.classList.toggle('show', showing);
  if(showing){ box.value=''; box.focus(); }
}
export function resetImportBtn(){ V.importArmed=false; if(V.importTimer) clearTimeout(V.importTimer); const b=$("loadBtn"); if(b) b.textContent=t('sync.load'); }
export async function loadImport(){
  const raw=$("importBox").value.trim();
  if(!raw){ smsg(t('sync.noload'),true); return; }
  let data;
  try{ data=JSON.parse(raw); }
  catch(e){ resetImportBtn(); smsg(t('sync.notvalid'),true); return; }
  const list = Array.isArray(data) ? data : (data && Array.isArray(data.entries) ? data.entries : null);
  if(!list){ resetImportBtn(); smsg(t('sync.noentries'),true); return; }
  const incoming=normEntries(list);
  const btn=$("loadBtn");
  if(!V.importArmed){
    V.importArmed=true; if(btn) btn.textContent=tf('sync.tapreplace',{a:S.entries.length, b:incoming.length});
    smsg(tf('sync.readn',{n:incoming.length, seen:list.length, have:S.entries.length}));
    V.importTimer=setTimeout(()=>{ resetImportBtn(); smsg(t('sync.timedout')); },8000);
    return;
  }
  resetImportBtn();
  await saveUndo();
  await applyImport(Array.isArray(data) ? {entries:list} : data);
  $("importBox").classList.remove('show'); $("loadBtn").classList.remove('show'); $("exportBox").classList.remove('show');
  smsg(tn('sync.imported',S.entries.length));
  flash(tn('sync.imported',S.entries.length));
}
export async function applyImport(data){
  S.entries=normEntries(data.entries);
  if(Array.isArray(data.exercises)){
    const byKey=new Map(S.customEx.map(x=>[x.key,x]));
    data.exercises.forEach(x=>{ const c=normCustomEx(x); if(c) byKey.set(c.key,c); });
    S.customEx=[...byKey.values()];
    await persistCatalogue();
  }
  if(Array.isArray(data.stretches)){
    const byKey=new Map(S.stretches.map(s=>[s.key,s]));
    data.stretches.forEach(x=>{ const s=normStretch(x); if(s) byKey.set(s.key,s); });
    S.stretches=[...byKey.values()];
    await persistStretches();
  }
  if(isObj(data.exEdits)){ S.exEdits=Object.assign(S.exEdits, normExEdits(data.exEdits)); await persistExEdits(); }
  if(Array.isArray(data.cardio)){ const bk=new Map(S.cardios.map(c=>[c.key,c])); data.cardio.forEach(x=>{ const c=normCardio(x); if(c) bk.set(c.key,c); }); S.cardios=[...bk.values()]; await persistCardio(); }
  if(isObj(data.theme)){ S.theme=normTheme(data.theme); await persistTheme(); }
  if(isObj(data.gym)){ S.gym=normGym(data.gym); await persistGym(); }
  if(isObj(data.plan) || isObj(data.routines)){
    const p=isObj(data.plan) ? data.plan : {};
    S.planExtras=normPlan(p); S.planSets=normPlanSets(p.sets); planLogsInit(p);
    S.routines=routinesFromBackup(data, routineNameFor); await persistPlan();
  }
  if(isObj(data.settings)){ S.settings=normSettings(data.settings); await persistSettings(); }
  await persist();
  fillForm($("fDate").value); render();
}
export function drawUndo(){
  const b=$("undoBtn"); if(!b) return;
  b.style.display=S.undoSnap ? '' : 'none';
  if(S.undoSnap && !V.undoArmed) b.textContent=tn('sync.undo',S.undoSnap.n);
}
export async function undoImport(){
  if(!S.undoSnap) return;
  if(!V.undoArmed){
    V.undoArmed=true; $("undoBtn").textContent=t('sync.undo.again');
    V.undoTimer=setTimeout(()=>{ V.undoArmed=false; drawUndo(); },4000);
    return;
  }
  clearTimeout(V.undoTimer); V.undoArmed=false;
  const snap=S.undoSnap; S.undoSnap=null;
  try{ await STORE.set(UKEY,''); }catch(e){}
  await applyImport(snap.data);
  drawUndo();
  smsg(tn('sync.undone',S.entries.length)); flash(tn('sync.undone',S.entries.length));
}
