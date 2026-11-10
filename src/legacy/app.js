// The 8.1 code, moving out piece by piece into the folders described in src/README.md.
import { localDate, daysAgo, within7, dnum, validDate, weekdayKey, fmtDMY, fmtDM, fmtTick } from '../core/dates';
import { num, roundTo, fmtSigned, calcVal } from '../core/numbers';
import * as core from '../core/index';
import { DEF_TARGET, CAL_RATES, CAL_PERIODS, ACTIVITY, mifflinBMR, kcalOf, protOf } from '../core/nutrition';
import { bfNavy } from '../core/body';
import { trendWeights, weekTrendChange, calcCalibration } from '../core/trend';
import { GOALS, goalOfRange, STEP_DEF, CLEAN_TO_STEP, repInc, workSets, coachNext, E1RM_MAX_REPS, e1rm, recordsOf, BW_FALLBACK, exVolume, sessionMetric } from '../core/strength';
import { VOL_LO, VOL_HI, VOL_PRESETS, volBand, muscleVolume, weekStart, weekState } from '../core/volume';
import { MUSCLES, MUSCLE_KEYS, muscleList, muscleGrp, GROUPS, GROUP_KEYS } from '../data/muscles';
import { FONTS, THEME_VARS, THEME_PRESETS, HEXRE, TEXT_SCALES } from '../data/themes';
import { EQUIP, EQUIP_GROUPS } from '../data/equipment';
import { LIB, SX_LIB, CD_LIB, libByKey, sxLibByKey, cdLibByKey } from '../data/library';
import { hexRgb, rgbHex, luminance, contrast, legibleFaint } from '../core/colour';
import { STORE } from '../store/kv';
import { t, tf, tn } from '../i18n/index';
import { DaysStore } from '../store/days';
import * as schema from '../store/schema';
import { SKEY, XKEY, PKEY, SXKEY, EKEY, TKEY, CDKEY, GKEY, BKEY, UKEY, ABOUT_KEY, RETIRED_KEYS, KNOWN_SETTINGS, SAFE_KEY, CX_KEY, CD_KEY, SX_KEY, DEF_REST, PLAN_SETS_DEF,
  normEntry, normEntries, mergeDay, normPlates, normSettings, normTheme, normCustomEx, normExEdits, normCardio, normStretch, normDayLists, everyDay, normGym } from '../store/schema';
import { MEAS } from '../data/measurements';
import { LB, PL_KG, PL_LB, PL_ALL, PL_DEF, PL_BARS, PL_BAR_IDS, plateKg, plateSolve } from '../core/plates';
const APP_VERSION = '8.1';
const kcalFloor = () => core.kcalFloor(settings.sex);
const kcalBand = target => core.kcalBand(target, settings.sex);
const kcalState = (avg, target) => core.kcalState(avg, target, settings.sex);
const actName  = k => t('act.'+k+'.name');
const actHours = k => t('act.'+k+'.hours');
const actNote  = k => t('act.'+k+'.note');
const ACTIVITY_HELP = ['hour','hard','week','lower'];


const colName = v => t('col.'+String(v).replace(/^--/,''));
const MAX_SERIES = 8;

let customEx = [];
let exEdits = {};
let CATALOGUE = [], CAT_BY_KEY = new Map();
function rebuildCatalogue(){
  CATALOGUE=customEx.map(e=>{ const ed=exEdits[e.key]; return ed ? Object.assign({}, e, ed) : e; });
  CAT_BY_KEY=new Map(CATALOGUE.map(e=>[e.key,e]));
}
rebuildCatalogue();
const exByKey = k => CAT_BY_KEY.get(k);





const ALL_LIBS = () => LIB.concat(SX_LIB, CD_LIB);
const lvTag = lv => lv ? `<span class="lvtag lv${lv}">${esc(t('lv.'+lv))}</span>` : '';
const exLv = ex => { const l=ex && ex.lib ? libByKey(ex.lib) : null; return l ? l.lv : null; };
const byName = (a,b) => String(a).localeCompare(String(b), undefined, {sensitivity:'base', numeric:true});
const libOrder = (a,b) => (a.lv||0)-(b.lv||0) || byName(t('lib.'+a.key), t('lib.'+b.key));
const exOrder = (a,b) => (exLv(a)||0)-(exLv(b)||0) || byName(a.name, b.name);
function bwSplit(list, lvOf, rowFn, hdCls){
  const w=list.filter(x=>!lvOf(x)), b=list.filter(x=>lvOf(x));
  return w.map(rowFn).join('') + (b.length ? `<div class="${hdCls}">${esc(t('lib.bwhead'))}</div>`+b.map(rowFn).join('') : '');
}
const qWords = x => { const w=String(x||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); return w.concat(w.slice(1).map((v,i)=>w[i]+v)); };
const qMatch = (q, text) => { const h=qWords(text); return String(q||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).every(p=>h.some(w=>w.indexOf(p)===0)); };
const libAvailable = (l, have) => l.eq.every(q=>have.indexOf(q)>=0);

function cxKeyFor(name){
  let base = 'cx_'+String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,28);
  if(base==='cx_') base='cx_move';
  let k=base, n=1;
  while(CAT_BY_KEY.has(k)) k=base+(++n);
  return k;
}

let cardios = [];
function cdKeyFor(name){
  let base='cd_'+String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,28);
  if(base==='cd_') base='cd_session';
  let k=base, n=1;
  while(cardios.some(c=>c.key===k)) k=base+(++n);
  return k;
}
const cardioByKey = k => cardios.find(c=>c.key===k);
const activeCardio = () => cardios.filter(c=>!c.retired);
let stretches = [];
const sxIsReps = s => !!(s && s.unit==='reps');
const sxTarget = s => !s ? 0 : (sxIsReps(s) ? (s.reps||0) : (s.secs||0));
function sxKeyFor(name){
  let base='sx_'+String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,28);
  if(base==='sx_') base='sx_stretch';
  let k=base, n=1;
  while(stretches.some(s=>s.key===k)) k=base+(++n);
  return k;
}
const stretchByKey = k => stretches.find(s=>s.key===k);
const exNote = ex => (ex && ex.note) ? ex.note : t('ex.defaultnote');
const activeStretches = () => stretches.filter(s=>!s.retired);

const DAYS = ['sun','mon','tue','wed','thu','fri','sat'].map(key=>({key}));
const dayName = k => t('day.'+k);
const dayShort = k => t('day.short.'+k);
function dayLabel(k){
  const ks=sessionEx(k);
  if(!ks.length) return dayName(k)+' · '+t('day.rest');
  return dayName(k)+' · '+ks.map(x=>{ const e=exByKey(x); return e?e.short:x; }).join(' + ');
}
let planExtras = {};
const normPlan = p => schema.normPlan(p, exByKey);
let planSets = {};
const normPlanSets = p => schema.normPlanSets(p, exByKey);
const plannedSets = (dayKey, key) => (planSets[dayKey] && planSets[dayKey][key]) || null;
function sessionEx(dayKey){
  return (planExtras[dayKey]||[]).filter((k,i,a)=>{ const ex=exByKey(k); return ex && !ex.retired && a.indexOf(k)===i; });
}
const planKeys = () => { const s=new Set(); DAYS.forEach(d=>sessionEx(d.key).forEach(k=>s.add(k))); return [...s]; };

const LINE_COLORS = ['#0d59d1','#f7801e','#ffc21a','#e11d2a','#8b2fc9','#1b9fd8','#2fb84a','#d6006e','#141430'];

let entries = [];
let settings = normSettings({});
const effAge = () => core.effAge(settings.age, settings.ageSet);
const protAuto = () => core.protAuto(settings.sex);
const protTarget = () => core.protTarget(settings.sex, settings.protFloor);
const protOk = () => core.protOk(settings.sex, settings.protFloor);
let chartPeriod = 28;

function chartWindowStart(){
  if(chartPeriod==='all' || !entries.length) return null;
  return dnum(entries[entries.length-1].date)-(chartPeriod-1);
}
function inChartWin(dateStr){ const s=chartWindowStart(); return s===null || dnum(dateStr)>=s; }
function windowSeries(series){
  const s=chartWindowStart();
  if(s===null) return series;
  return series.map(z=>Object.assign({},z,{points:z.points.filter(p=>dnum(p.date)>=s)}));
}
function setChartPeriod(p){ chartPeriod=(p==='all')?'all':+p; syncChartSegs(); render(); }
function syncChartSegs(){ document.querySelectorAll('.chartseg button').forEach(b=>b.classList.toggle('on', b.dataset.p===String(chartPeriod))); }

const $ = id => document.getElementById(id);
function calcHint(id){
  const el=$(id), out=$(id+'Sum'); if(!el||!out) return;
  const raw=el.value.trim(), v=calcVal(raw);
  out.textContent = (v!=null && /[+*/-]/.test(raw.slice(1))) ? '= '+v : '';
  calcLeft(id, raw ? calcVal(raw.replace(/[+*/-]+$/,'')) : 0);
}
// Under Energy and Protein: the day's target and what is left of it, updated as you type.
function calcLeft(id, v){
  const out=$(id+'Left'); if(!out) return;
  const kcal=id==='fKcal', tgt=kcal ? settings.kcalTarget : protTarget(), unit=kcal ? ' kcal' : ' g';
  if(v==null){ out.textContent=''; return; }
  const left=Math.round(tgt-v), head=tf(kcal ? 'f.left.kcal' : 'f.left.prot',{n:tgt.toLocaleString()});
  const tail = left>0 ? tf('f.left.left',{n:left.toLocaleString()+unit}) : left===0 ? t('f.left.exact') : tf(kcal ? 'f.left.over' : 'f.left.done',{n:(-left).toLocaleString()+unit});
  out.className='calcleft'+(kcal && left<0 ? ' over' : '');
  out.innerHTML=esc(head)+' · <b>'+esc(tail)+'</b>';
}
function calcSettle(id){
  const el=$(id); if(!el) return;
  const v=calcVal(el.value);
  if(v!=null && /[+*/-]/.test(el.value.trim().slice(1))) el.value=v;
  calcHint(id);
}
function calcAdd(id){
  const el=$(id); if(!el) return;
  el.value = el.value.trim().replace(/[+*/-]$/,'') + '+';
  el.focus();
  try{ el.setSelectionRange(el.value.length, el.value.length); }catch(e){}
  calcHint(id);
}
const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let loadFailed=false;


async function purgeOldNamespace(){
  try{
    const have=(await STORE.list('tally:')) || [];
    const old=((await STORE.list('training-log:')) || []).concat(RETIRED_KEYS.filter(k=>have.indexOf(k)>=0));
    for(const k of old){ try{ await STORE.set(k,''); }catch(e){} }
    if(typeof localStorage!=='undefined'){ old.forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} }); }
    return old.length;
  }catch(e){ return 0; }
}
const DAYS_STORE = new DaysStore(STORE, () => localDate());
async function load(){
  loadFailed=false; entries=[];
  const r=await DAYS_STORE.load();
  if(r.failed){ loadFailed=true; return; }
  entries=normEntries(r.days);
  // First start after the update (copy the 8.1 days into the new layout) or a month old enough to pack.
  if(r.needsWrite){ try{ await DAYS_STORE.save(entries); }catch(e){ console.error('day storage update failed',e); } }
}
async function persist(){
  try{ await DAYS_STORE.save(entries); return true; }
  catch(e){ console.error('save failed',e); flash(t('msg.savefail'),true); return false; }
}
async function loadSettings(){
  try{
    const v=await STORE.get(SKEY); if(!v) return;
    const s=JSON.parse(v)||{};
    settings=normSettings(s);
    const canon=o=>JSON.stringify(KNOWN_SETTINGS.map(k=>(o&&o[k]!==undefined)?o[k]:null));
    if(Object.keys(s).length!==KNOWN_SETTINGS.length || canon(s)!==canon(settings)) await persistSettings();
  }catch(e){}
}
async function persistSettings(){ try{ await STORE.set(SKEY, JSON.stringify(settings)); }catch(e){} }

async function loadCatalogue(){
  customEx=[];
  try{
    const v=await STORE.get(XKEY);
    if(v){ const a=JSON.parse(v);
      if(Array.isArray(a)){ const seen=new Set();
        a.forEach(x=>{ const c=normCustomEx(x); if(c && !seen.has(c.key)){ seen.add(c.key); customEx.push(c); } });
      } }
  }catch(e){ console.error('movement catalogue read failed',e); }
  rebuildCatalogue();
}
async function persistCatalogue(){
  rebuildCatalogue();
  try{ await STORE.set(XKEY, JSON.stringify(customEx)); return true; }
  catch(e){ console.error('catalogue save failed',e); return false; }
}
function prettyKey(k){
  const s=String(k).replace(/^(cx|sx|cd)_/,'').replace(/[_-]+/g,' ').trim();
  return s ? s.charAt(0).toUpperCase()+s.slice(1) : t('ex.movement');
}
async function recoverMovements(){
  const seen=new Set();
  entries.forEach(e=>Object.keys(e.lifts||{}).forEach(k=>{ if(!exByKey(k)) seen.add(k); }));
  if(!seen.size) return 0;
  seen.forEach(k=>{
    const looksCustom=/^cx_/.test(k);
    const def=normCustomEx({
      key: looksCustom ? k : 'cx_'+String(k).replace(/[^a-z0-9]/g,'').slice(0,28),
      name: prettyKey(k),
      short: prettyKey(k).toLowerCase().slice(0,16),
      note:t('msg.recoverednote'), def:0, added:false, group:'other'
    });
    if(!def) return;
    if(!looksCustom){ if(!CX_KEY.test(k)) return; def.key=k; }
    if(!customEx.some(x=>x.key===def.key)) customEx.push(def);
  });
  rebuildCatalogue();
  await persistCatalogue();
  return seen.size;
}
const PAGES=['body','workout','guide','gym','settings','history'];
let curPage='body';
function showPage(k){
  if(PAGES.indexOf(k)<0) k='body';
  curPage=k;
  PAGES.forEach(p=>{ const el=$('pg-'+p); if(el) el.classList.toggle('on', p===k); });
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on', b.dataset.pg===k));
  const bar=$("dayBar"); if(bar) bar.classList.toggle('off', k!=='body' && k!=='workout');
  drawPage(k);
  window.scrollTo(0,0);
}
function shiftDay(n){
  const d=$("fDate").value||localDate();
  const nd=new Date(d+'T12:00:00'); nd.setDate(nd.getDate()+n);
  const ds=localDate(nd);
  $("fDate").value=ds; fillForm(ds); render();
}

function applyLang(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent=t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-html]').forEach(el=>{ el.innerHTML=t(el.getAttribute('data-i18n-html')); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{ el.placeholder=t(el.getAttribute('data-i18n-ph')); });
  document.querySelectorAll('[data-i18n-title]').forEach(el=>{ el.title=t(el.getAttribute('data-i18n-title')); if(!/[A-Za-z0-9]/.test(el.textContent)) el.setAttribute('aria-label', el.title); });
}

let theme = {font:'min', colors:{}, scale:1};
function activePreset(){
  const cur=theme.colors||{};
  const hit=THEME_PRESETS.find(p=>{
    const pk=Object.keys(p.colors), ck=Object.keys(cur);
    return pk.length===ck.length && pk.every(k=>cur[k]===p.colors[k]);
  });
  return hit?hit.key:null;
}
const themeColor = v => theme.colors[v] || (THEME_VARS.find(x=>x.v===v)||{}).def;
function applyTheme(){
  const root=document.documentElement;
  THEME_VARS.forEach(v=>{
    const c=theme.colors[v.v];
    if(c) root.style.setProperty(v.v, c); else root.style.removeProperty(v.v);
  });
  const f=FONTS.find(x=>x.key===theme.font)||FONTS[0];
  root.style.setProperty('--font-body', f.body);
  root.style.setProperty('--font-display', f.display);
  root.style.setProperty('--font-mono', f.mono);
  root.style.setProperty('--display-weight', f.displayWeight);
  root.style.setProperty('--display-spacing', f.displaySpacing);
  root.style.setProperty('--display-transform', f.displayTransform);
  root.style.setProperty('--txt-faint', legibleFaint(themeColor('--ink-faint'), themeColor('--ink'), [themeColor('--panel'), themeColor('--panel-2')]));
  root.style.zoom = theme.scale===1 ? '' : String(theme.scale);
  drawTextSize();
}
function drawTextSize(){
  const v=$("sizeVal"); if(!v) return;
  const i=TEXT_SCALES.indexOf(theme.scale);
  v.textContent=Math.round(theme.scale*100)+'%';
  $("sizeDown").disabled = i<=0; $("sizeUp").disabled = i>=TEXT_SCALES.length-1; $("sizeReset").disabled = theme.scale===1;
}
async function textScale(step){
  const cur=Math.max(0, TEXT_SCALES.indexOf(theme.scale)), i=step===0 ? TEXT_SCALES.indexOf(1) : Math.max(0, Math.min(TEXT_SCALES.length-1, (TEXT_SCALES.indexOf(theme.scale)<0 ? TEXT_SCALES.indexOf(1) : cur)+step));
  theme.scale=TEXT_SCALES[i]; await persistTheme(); render();
}
async function loadTheme(){
  try{ const v=await STORE.get(TKEY); if(v) theme=normTheme(JSON.parse(v)); }
  catch(e){ console.error('theme read failed',e); }
  applyTheme();
}
async function persistTheme(){
  applyTheme();
  try{ await STORE.set(TKEY, JSON.stringify(theme)); return true; }
  catch(e){ console.error('theme save failed',e); return false; }
}
async function setFont(k){
  if(!FONTS.some(f=>f.key===k)) return;
  theme.font=k; await persistTheme(); drawTheme();
}
async function setThemeColor(v,c){
  if(!THEME_VARS.some(x=>x.v===v) || !HEXRE.test(c)) return;
  theme.colors[v]=c.toLowerCase(); await persistTheme(); drawTheme();
}
function repaintCharts(){
  drawWeight(entries.filter(e=>e.weight!=null));
  drawStrength(); drawSxTrend(); drawCdTrend(); drawBody();
}
async function applyPreset(k){
  const p=THEME_PRESETS.find(x=>x.key===k); if(!p) return;
  theme.colors={};
  Object.keys(p.colors).forEach(v=>{ if(THEME_VARS.some(x=>x.v===v)) theme.colors[v]=p.colors[v]; });
  await persistTheme(); drawTheme(); repaintCharts();
  flash(tf('msg.preset',{name:t('pre.'+p.key)}));
}
async function resetTheme(){
  theme.colors={}; await persistTheme(); drawTheme(); repaintCharts();
  flash(t('msg.colreset'));
}
function drawTheme(){
  const fs=$("segFont");
  if(fs){
    fs.innerHTML=FONTS.map(f=>`<button type="button" data-f="${f.key}"${f.key===theme.font?' class="on"':''}>${esc(t('font.'+f.key+'.name'))}</button>`).join('');
    fs.querySelectorAll('button').forEach(b=>b.onclick=()=>setFont(b.dataset.f));
  }
  const f=FONTS.find(x=>x.key===theme.font)||FONTS[0];
  const fn=$("fontNote"); if(fn) fn.innerHTML=`<b>${esc(t('font.'+f.key+'.name'))}</b> — ${esc(t('font.'+f.key+'.note'))}`;

  const ps=$("segPreset"), on=activePreset();
  if(ps){
    ps.innerHTML=THEME_PRESETS.map(p=>`<button type="button" data-p="${p.key}"${p.key===on?' class="on"':''}>${esc(t('pre.'+p.key))}</button>`).join('');
    ps.querySelectorAll('button').forEach(b=>b.onclick=()=>applyPreset(b.dataset.p));
  }
  const grid=$("colGrid");
  if(grid){
    const cur=v=>theme.colors[v] || (THEME_VARS.find(x=>x.v===v)||{}).def;
    grid.innerHTML=THEME_VARS.map(v=>
      `<label class="colrow"><input type="color" data-v="${v.v}" value="${cur(v.v)}">`
      +`<span class="colname">${esc(colName(v.v))}<i>${cur(v.v)}</i></span></label>`).join('');
    grid.querySelectorAll('input[type=color]').forEach(i=>{
      i.oninput=()=>{ document.documentElement.style.setProperty(i.dataset.v, i.value); i.parentNode.querySelector('.colname i').textContent=i.value; };
      i.onchange=async()=>{ await setThemeColor(i.dataset.v, i.value); repaintCharts(); };
    });
  }
}

async function loadExEdits(){
  exEdits={};
  try{ const v=await STORE.get(EKEY); if(v) exEdits=normExEdits(JSON.parse(v)); }
  catch(e){ console.error('movement edits read failed',e); }
  rebuildCatalogue();
}
async function persistExEdits(){
  rebuildCatalogue();
  try{ await STORE.set(EKEY, JSON.stringify(exEdits)); return true; }
  catch(e){ console.error('movement edits save failed',e); return false; }
}
async function loadPlan(){
  planExtras={};
  planSets={};
  planRaw=null;
  try{ const v=await STORE.get(PKEY); if(v){ const p=JSON.parse(v); planRaw=p; planExtras=normPlan(p); planSets=normPlanSets(p && p.sets); } }
  catch(e){ console.error('plan read failed',e); }
}
async function loadStretches(){
  stretches=[];
  try{
    const v=await STORE.get(SXKEY);
    if(v!=null){ const a=JSON.parse(v);
      if(Array.isArray(a)){ const used=new Set();
        a.forEach(x=>{ const s=normStretch(x); if(s && !used.has(s.key)){ used.add(s.key); stretches.push(s); } });
      } }
  }catch(e){ console.error('stretch list read failed',e); }
}
async function recoverStretches(){
  const seen=new Set();
  entries.forEach(e=>Object.keys(e.mob||{}).forEach(k=>{ if(!stretchByKey(k)) seen.add(k); }));
  if(!seen.size) return 0;
  seen.forEach(k=>{
    const s=normStretch({key:k, name:prettyKey(k), secs:0});
    if(s && !stretchByKey(s.key)) stretches.push(s);
  });
  await persistStretches();
  return seen.size;
}
async function persistStretches(){
  try{ await STORE.set(SXKEY, JSON.stringify(stretches)); return true; }
  catch(e){ console.error('stretch list save failed',e); return false; }
}
async function loadCardio(){
  cardios=[];
  try{
    const v=await STORE.get(CDKEY);
    if(v!=null){ const a=JSON.parse(v);
      if(Array.isArray(a)){ const used=new Set();
        a.forEach(x=>{ const c=normCardio(x); if(c && !used.has(c.key)){ used.add(c.key); cardios.push(c); } }); } }
  }catch(e){ console.error('cardio list read failed',e); }
}
async function persistCardio(){
  try{ await STORE.set(CDKEY, JSON.stringify(cardios)); return true; }
  catch(e){ console.error('cardio list save failed',e); return false; }
}
let gym = {set:false, have:[], own:[]};
async function loadGym(){
  try{ const v=await STORE.get(GKEY); gym=normGym(v!=null ? JSON.parse(v) : null); }
  catch(e){ console.error('gym read failed',e); gym=normGym(null); }
}
async function persistGym(){
  try{ await STORE.set(GKEY, JSON.stringify(gym)); return true; }
  catch(e){ console.error('gym save failed',e); return false; }
}
async function recoverCardio(){
  const seen=new Set();
  entries.forEach(e=>Object.keys(e.cardio||{}).forEach(k=>{ if(!cardioByKey(k)) seen.add(k); }));
  if(!seen.size) return 0;
  seen.forEach(k=>{ const c=normCardio({key:k, name:prettyKey(k), mins:0}); if(c) cardios.push(c); });
  await persistCardio();
  return seen.size;
}
let planSx = {}, planCd = {}, planRaw = null;
const sxToday = {}, cdToday = {};
function planLogsInit(p){
  planSx = (p && p.sx!==undefined) ? normDayLists(p.sx, stretchByKey) : everyDay(activeStretches().map(x=>x.key));
  planCd = (p && p.cd!==undefined) ? normDayLists(p.cd, cardioByKey) : everyDay(activeCardio().map(x=>x.key));
}
const planObject = () => Object.assign({}, planExtras, {sets:planSets, sx:planSx, cd:planCd});
async function persistPlan(){
  Object.keys(planSets).forEach(d=>{
    Object.keys(planSets[d]).forEach(k=>{ if((planExtras[d]||[]).indexOf(k)<0) delete planSets[d][k]; });
    if(!Object.keys(planSets[d]).length) delete planSets[d];
  });
  try{ await STORE.set(PKEY, JSON.stringify(planObject())); return true; }
  catch(e){ console.error('plan save failed',e); return false; }
}

const liftsOf = (e,k)=> (e.lifts && e.lifts[k]) ? e.lifts[k] : [];
const groupName = k => t('grp.'+(GROUP_KEYS.indexOf(k)>=0?k:'other'));
const groupOf = ex => (ex && GROUP_KEYS.indexOf(ex.group)>=0) ? ex.group : 'other';
function didGroup(e,group){
  return Object.keys(e.lifts||{}).some(k=>{ const ex=exByKey(k); return ex && groupOf(ex)===group && liftsOf(e,k).length>0; });
}
function groupTarget(group){
  return DAYS.filter(d=>sessionEx(d.key).some(k=>{ const ex=exByKey(k); return ex && groupOf(ex)===group; })).length;
}
const sessionTarget = () => DAYS.filter(d=>sessionEx(d.key).length>0).length;
const activeGroups = () => GROUPS.filter(g=>groupTarget(g.key)>0);
const trained = e => !!(e.lifts && Object.keys(e.lifts).length);
const lastNumOf = get => core.lastNumOf(entries, get);
function lastSessionOf(key, dayKey){
  if(dayKey){ for(let i=entries.length-1;i>=0;i--){ const e=entries[i]; if(e.day===dayKey){ const s=liftsOf(e,key); if(s.length) return s; } } }
  for(let i=entries.length-1;i>=0;i--){ const s=liftsOf(entries[i],key); if(s.length) return s; }
  return null;
}
const deltaOf = (get, days) => core.deltaOf(entries, get, days);

const sessionsBefore = (key, date) => entries.filter(e=>e.date<date).map(e=>liftsOf(e,key)).filter(s=>s.length);
function fmtLoad(ex, kg){
  if(ex.added) return kg>0 ? 'BW+'+kg : 'BW';
  if(ex.unit==='sec' && !kg) return '';
  return kg+' kg';
}
function coachLine(ex, plan){
  const sec=ex.unit==='sec';
  const v={min:ex.repMin, max:ex.repMax, unit:t(sec?'sh.coach.secs':'sh.coach.reps'), step:ex.step, n:CLEAN_TO_STEP,
           inc:repInc(ex), left:Math.max(1, CLEAN_TO_STEP-(plan.run||0)), aim:plan.targets[0],
           last:plan.last ? plan.last.reps.map(r=>sec?r+'s':r).join(', ') : ''};
  const msg = plan.kind==='reps' && sec ? tf('coach.secs', v) : tf('coach.'+plan.kind, v);
  const L = plan.kind==='first' ? '' : fmtLoad(ex, plan.load);
  return `<b>${esc(t('coach.next'))}</b> · ${L?`<b>${esc(L)}</b> · `:''}${esc(msg)}`;
}

function recordsLine(ex, r){
  const b=[];
  if(r.bwReps) b.push(`${esc(t('rec.bwreps'))} <b>BW × ${r.bwReps.reps}</b>`);
  if(r.heavy)  b.push(`${esc(t(ex.added?'rec.heavy':'rec.best'))} <b>${esc(fmtLoad(ex,r.heavy.kg))} × ${r.heavy.reps}</b>`);
  if(r.e1rm)   b.push(`${esc(t('rec.e1rm'))} <b>${r.e1rm.e.toFixed(1)} kg</b>`);
  if(r.hold)   b.push(`${esc(t('rec.hold'))} <b>${r.hold.reps}s</b>`);
  return b.join(' · ');
}
function recordsBeaten(ex, was, now){
  return core.recordsBeatenKinds(was, now).map(k => k==='heavy' ? fmtLoad(ex, now.heavy.kg)+' × '+now.heavy.reps
    : k==='e1rm' ? t('rec.e1rm')+' '+now.e1rm.e.toFixed(1)+' kg' : k==='bwReps' ? 'BW × '+now.bwReps.reps : now.hold.reps+'s');
}
function recordsNewOn(date){
  const day=entries.find(e=>e.date===date); if(!day || !day.lifts) return '';
  const out=[];
  Object.keys(day.lifts).forEach(key=>{
    const ex=exByKey(key); if(!ex) return;
    const all=entries.map(e=>({date:e.date, sets:liftsOf(e,key)})).filter(s=>s.sets.length);
    const others=all.filter(s=>s.date!==date), mine=all.filter(s=>s.date===date);
    if(!others.length || !mine.length) return;
    const bits=recordsBeaten(ex, recordsOf(ex, others), recordsOf(ex, mine));
    if(bits.length) out.push((ex.short||ex.name)+' '+bits.join(', '));
  });
  return out.length ? tf('rec.new',{list:out.join(' · ')}) : '';
}

function fmtSets(key, sets){
  if(!sets || !sets.length) return '—';
  const ex=exByKey(key)||{}, sec=ex.unit==='sec';
  const rp = r => sec ? r+'s' : r;
  const ld = s => s.variant!=null ? s.variant : ex.added ? (s.kg>0 ? 'BW+'+s.kg : 'BW') : (sec && !s.kg) ? '' : s.kg+'kg';
  const first=ld(sets[0]);
  if(sets.every(s=>ld(s)===first)) return (first ? first+' — ' : '')+sets.map(s=>rp(s.reps)).join(', ');
  return sets.map(s=>{ const l=ld(s); return (l ? l+'×' : '')+rp(s.reps); }).join('  ');
}

let plGoal=null;
const plBarOf = () => settings.plates.bar;
const plBarKg = id => id==='own' ? (settings.plates.barOwn||0) : PL_BARS.find(b=>b.id===id).kg;
const plFmt = (kg, unit) => { const v=unit==='lb' ? kg/LB : kg; return (Math.round(v*100)/100).toString(); };
const plLabel = id => plFmt(plateKg(id), id.slice(0,2))+' '+id.slice(0,2);
function drawPlates(){
  const P=settings.plates, card=$("cardPlates"); if(!card) return;
  const unit=P.unit, bar=plBarOf();
  const gi=$("plGoal"); if(document.activeElement!==gi) gi.value=plGoal==null ? '' : String(plGoal);
  document.querySelectorAll('#plUnit button').forEach(b=>b.classList.toggle('on', b.dataset.u===unit));
  const chip=(id, lbl, on)=>`<button type="button" class="exchip${on?' on':''}" data-id="${esc(id)}"><span class="sw"${on?' style="background:var(--line)"':''}></span>${esc(lbl)}</button>`;
  $("plBar").innerHTML=PL_BARS.map(b=>b.id==='own'
      ? chip('own', t('pl.bar.own'), bar==='own')+(bar==='own' ? `<input class="plown" id="plOwn" type="number" min="0" max="100" step="0.5" inputmode="decimal" placeholder="kg" aria-label="${esc(t('pl.bar.ownkg'))}" value="${P.barOwn==null?'':P.barOwn}">` : '')
      : chip(b.id, b.id==='none' ? t('pl.bar.none') : plLabel(b.id), bar===b.id)).join('');
  $("plBar").querySelectorAll('.exchip').forEach(b=>b.onclick=()=>plSetBar(b.dataset.id));
  const own=$("plOwn"); if(own) own.onchange=async()=>{ const v=num(own.value); P.barOwn=(v!=null && v>=0 && v<=100) ? Math.round(v*100)/100 : null; await persistSettings(); drawPlates(); };
  const pchips=(list, u)=>list.map(v=>chip(u+v, plFmt(u==='lb'?v*LB:v, u), P.have.indexOf(u+v)>=0)).join('');
  $("plKg").innerHTML=pchips(PL_KG,'kg'); $("plLb").innerHTML=pchips(PL_LB,'lb');
  card.querySelectorAll('#plKg .exchip, #plLb .exchip').forEach(b=>b.onclick=()=>plToggle(b.dataset.id));
  $("plSetupSum").textContent=tf('pl.setup',{n:P.have.length});
  $("plOut").innerHTML=plResultHtml(unit, bar);
  const alt=$("plUse"); if(alt) alt.onclick=()=>{ plGoal=+alt.dataset.v; drawPlates(); };
}
function plResultHtml(unit, bar){
  const P=settings.plates, other=unit==='kg' ? 'lb' : 'kg';
  if(plGoal==null || !(plGoal>0)) return `<div class="sxnote">${esc(t('pl.empty'))}</div>`;
  if(bar==='own' && settings.plates.barOwn==null) return `<div class="sxnote">${esc(t('pl.ownfirst'))}</div>`;
  const goalKg=unit==='lb' ? plGoal*LB : plGoal, barKg=plBarKg(bar);
  if(goalKg>(unit==='lb' ? 2000*LB : 1000)) return `<div class="sxnote">${esc(t('pl.big'))}</div>`;
  const r=plateSolve(goalKg, barKg, P.have);
  if(r.err==='under') return `<div class="sxnote">${esc(tf('pl.under',{bar:plFmt(barKg,unit)+' '+unit}))}</div>`;
  if(r.err==='none') return `<div class="sxnote">${esc(t('pl.noplates'))}</div>`;
  if(r.err==='big') return `<div class="sxnote">${esc(t('pl.big'))}</div>`;
  const m=r.main, groups=[];
  m.side.forEach(p=>{ const g=groups.find(x=>x.id===p.id); if(g) g.n++; else groups.push({id:p.id, n:1}); });
  const maxKg=Math.max(25, ...m.side.map(p=>p.kg));
  const viz=m.side.length ? '<div class="plviz"><span class="sleeve"></span>'+m.side.map(p=>`<span class="plate${p.id.slice(0,2)==='lb'?' lb':''}" style="height:${Math.round(26+70*Math.sqrt(p.kg/maxKg))}px">${esc(plFmt(p.kg, p.id.slice(0,2)))}</span>`).join('')+'<span class="collar"></span></div>' : '';
  const list=m.side.length ? groups.map(g=>(g.n>1 ? g.n+' × ' : '')+plLabel(g.id)).join(' + ') : t('pl.nothing');
  const tot=plFmt(m.totalKg,unit)+' '+unit, totO=plFmt(m.totalKg,other)+' '+other;
  let h=`<div class="plres"><div class="plhead">${esc(t(m.side.length ? 'pl.each' : 'pl.eachnone'))}</div>${viz}<div class="pllist">${esc(list)}</div>`
    +`<div class="pltot">${esc(tf(bar==='none' ? 'pl.totnobar' : 'pl.tot',{tot, other:totO, bar:plFmt(barKg,unit)+' '+unit, side:plFmt(m.side.reduce((a,p)=>a+p.kg,0),unit)+' '+unit}))}</div>`;
  if(!r.exact){
    h+=`<div class="plalt"><span>${esc(tf('pl.notexact',{goal:plGoal+' '+unit}))}</span>`;
    if(r.alt){ const v=Math.round((unit==='lb' ? r.alt.totalKg/LB : r.alt.totalKg)*100)/100; h+=`<button type="button" class="plbtn" id="plUse" data-v="${v}">${esc(tf('pl.useup',{w:v+' '+unit}))}</button>`; }
    h+='</div>';
  }
  return h+'</div>';
}
async function plSetBar(id){
  const P=settings.plates;
  P.bar=id;
  await persistSettings(); drawPlates();
}
async function plToggle(id){
  const P=settings.plates, i=P.have.indexOf(id);
  if(i>=0) P.have.splice(i,1); else P.have=PL_ALL.filter(x=>x===id || P.have.indexOf(x)>=0);
  await persistSettings(); drawPlates();
}
function appendExBlock(wrap, ex, dayKey){
  const pinned=(planExtras[dayKey]||[]).indexOf(ex.key)>=0;
  const onDate=$("fDate").value, curE=entries.find(e=>e.date===onDate);
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
async function togglePin(key, dayKey){
  const list=planExtras[dayKey]||(planExtras[dayKey]=[]);
  const i=list.indexOf(key);
  if(i>=0){ list.splice(i,1); if(!list.length) delete planExtras[dayKey]; } else list.push(key);
  await persistPlan();
  const box=$("sets-"+key), tag=(box&&box.parentNode)?box.parentNode.querySelector('.xtag'):null;
  if(tag){
    const on=(planExtras[dayKey]||[]).indexOf(key)>=0;
    tag.className='xtag'+(on?' pin':'');
    tag.textContent=t(on?'ex.pinned':'ex.added');
    tag.title=on?t('ex.unpintip'):tf('ex.pintip',{day:dayShort(dayKey)});
  }
  render();
}
function prefillEx(ex, dayKey, cur){
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
function buildExForm(cur, dayKey){
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
function addMovementToForm(key){
  const ex=exByKey(key); if(!ex) return false;
  if($("sets-"+key)) return false;
  const wrap=$("exWrap");
  const note=wrap.querySelector('.restnote'); if(note) note.remove();
  const dayKey=$("fDay").value;
  appendExBlock(wrap, ex, dayKey);
  prefillEx(ex, dayKey, entries.find(e=>e.date===$("fDate").value));
  return true;
}
async function dropMovement(key, dayKey){
  const box=$("sets-"+key);
  if(box && box.parentNode) box.parentNode.remove();
  const list=planExtras[dayKey]||[];
  const i=list.indexOf(key);
  if(i>=0){ list.splice(i,1); if(!list.length) delete planExtras[dayKey]; await persistPlan(); render(); }
  if(!$("exWrap").children.length) buildExForm(entries.find(e=>e.date===$("fDate").value), dayKey);
}
function addSetRow(ex, loadVal, reps, aim){
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
async function rememberSets(ex){
  const dayKey=$("fDay").value, box=$("sets-"+ex.key);
  if(!box || (planExtras[dayKey]||[]).indexOf(ex.key)<0) return;
  const n=box.querySelectorAll('.setrow').length;
  if(n<1 || plannedSets(dayKey, ex.key)===n) return;
  (planSets[dayKey]||(planSets[dayKey]={}))[ex.key]=n;
  await persistPlan(); drawGuide();
}
function renumber(ex){ const box=$("sets-"+ex.key); if(box) box.querySelectorAll('.setrow').forEach((r,i)=>r.querySelector('.setn').textContent=i+1); }
function readExForm(){
  const lifts={};
  CATALOGUE.forEach(ex=>{
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

let shManaging=false;
function loadDesc(ex){
  if(ex.unit==='sec') return t('load.seconds');
  if(ex.added) return t('load.bwkg');
  return 'kg';
}
function shMsg(msg,err){ const m=$("shMsg"); if(!m) return; m.textContent=msg||''; m.className='sh-msg'+(err?' err':''); }
function shShow(mode){
  const list=mode!=='form';
  $("shListMode").style.display=list?'':'none';
  $("shFormMode").style.display=list?'none':'';
  $("shTitle").textContent=t(list?(shManaging?'sh.title.manage':'sh.title.add'):'sh.title.new');
  if(list) shRenderList();
}
let dlgReturn=null;
function dlgOpen(id){
  dlgReturn=document.activeElement;
  const w=$(id); w.classList.add('show');
  const d=w.firstElementChild; if(d && d.focus) d.focus({preventScroll:true});
}
function dlgClose(id){
  const w=$(id); if(!w || !w.classList.contains('show')) return;
  w.classList.remove('show');
  if(dlgReturn && document.contains(dlgReturn) && dlgReturn.focus) dlgReturn.focus({preventScroll:true});
  dlgReturn=null;
}
const aboutHtml = () => ['why','parts','logging','origin','gym','yours'].map(k=>`<section class="ab-sec${k==='parts'?' key':''}">${t('about.'+k)}</section>`).join('');
function abOpen(){ $("abText").innerHTML=aboutHtml(); $("abText").scrollTop=0; dlgOpen("abWrap"); }
function abClose(){ dlgClose("abWrap"); }
async function abNever(){ try{ await STORE.set(ABOUT_KEY,'1'); }catch(e){} abClose(); }
async function abMaybeShow(){ let seen=null; try{ seen=await STORE.get(ABOUT_KEY); }catch(e){} if(!seen) abOpen(); }
function tallyBack(){
  const open=[['abWrap',abClose],['kpWrap',kpClose],['shWrap',shClose],['sxWrap',sxClose],['cdWrapSheet',cdClose],['dpWrap',dpClose]]
    .find(([id])=>{ const el=$(id); return el && el.classList.contains('show'); });
  if(!open) return false;
  open[1](); return true;
}
let kpKind='sx', sxPinDay=null, cdPinDay=null;
const kpCfg = k => k==='sx'
  ? {lib:SX_LIB, mine:activeStretches, plan:planSx, today:sxToday, libName:l=>t('sxlib.'+l.key), owned:sxOwned, fromLib:sxFromLib, draw:()=>drawMob(), log:'mob'}
  : {lib:CD_LIB, mine:activeCardio,    plan:planCd, today:cdToday, libName:l=>t('cdlib.'+l.key), owned:cdOwned, fromLib:cdFromLib, draw:()=>drawCardio(), log:'cardio'};
function kpOpen(kind){
  kpKind=kind;
  $("kpTitle").textContent=t(kind==='sx'?'kp.title.sx':'kp.title.cd');
  $("kpNew").textContent=t(kind==='sx'?'sx.new':'cdx.new');
  $("kpSearch").value=''; $("kpSearch").placeholder=t(kind==='sx'?'kp.search.sx':'kp.search.cd');
  kpRender(); dlgOpen("kpWrap");
}
function kpClose(){ dlgClose("kpWrap"); }
const sxSub = l => (l.mode==='reps' ? tn('mob.repsn',l.tgt) : tf('mob.holdn',{n:l.tgt}));
function kpRender(){
  const c=kpCfg(kpKind), q=$("kpSearch").value.trim(), dayKey=$("fDay").value;
  const cur=entries.find(e=>e.date===$("fDate").value), log=(cur && cur[c.log]) || {};
  const shown=new Set(dayLogKeys(c.plan, c.today, log));
  const pinBtn=(attr,k)=>`<button class="sh-pin" ${attr}="${esc(k)}" title="${esc(tf('sh.pintip',{day:dayShort(dayKey)}))}">${esc(tf('sh.pin',{day:dayShort(dayKey)}))}</button>`;
  const mine=c.mine().filter(x=>!shown.has(x.key) && (!q || qMatch(q, x.name))).sort((a,b)=>byName(a.name,b.name));
  const mineRow=x=>`<div class="sh-row"><div class="nm">${esc(x.name)}<span>${esc(kpKind==='sx' ? (sxTarget(x) ? (sxIsReps(x)?tn('mob.repsn',sxTarget(x)):tf('mob.holdn',{n:sxTarget(x)})) : t('mob.nohold')) : (x.mins?tf('cd.target',{n:x.mins}):t('cd.notarget')))}</span></div>${pinBtn('data-kpin',x.key)}<button class="sh-add" data-kadd="${esc(x.key)}">${esc(t('btn.add'))}</button></div>`;
  const lib=c.lib.filter(l=>!c.owned(l) && (!q || qMatch(q, c.libName(l)+' '+(l.mus||[]).map(m=>t('mus.'+m)).join(' ')+(l.lv?' '+t('lv.'+l.lv):''))))
    .sort((a,b)=>(libUsable(b)?1:0)-(libUsable(a)?1:0) || (a.lv||0)-(b.lv||0) || byName(c.libName(a),c.libName(b)));
  const libRowK=l=>{ const ok=libUsable(l), eq=l.eq.length ? l.eq.map(x=>t('eq.'+x)).join(', ') : t('guide.noeq');
    const sub=kpKind==='sx' ? l.mus.map(m=>t('mus.'+m)).join(', ')+' · '+sxSub(l) : tf('cd.target',{n:l.mins});
    return `<div class="sh-row${ok?'':' off'}"><div class="nm">${esc(c.libName(l))}${kpKind==='sx'?lvTag(l.lv):''}<span>${esc(sub)} · ${esc(ok?eq:tf('guide.needs',{list:eq}))}</span></div>${pinBtn('data-lpin',l.key)}<button class="sh-add" data-ladd="${esc(l.key)}">${esc(t('btn.add'))}</button></div>`; };
  $("kpList").innerHTML = (mine.length ? `<div class="sh-grp">${esc(t(kpKind==='sx'?'kp.mine.sx':'kp.mine.cd'))}</div>`+mine.map(mineRow).join('') : '')
    + (lib.length ? `<div class="sh-grp">${esc(t('sh.lib'))}</div>`+lib.map(libRowK).join('') : '')
    || `<div class="sh-empty">${esc(q?tf('nomatch',{q:q}):t('kp.empty'))}</div>`;
}
async function kpPick(key, pin){
  const c=kpCfg(kpKind), dayKey=$("fDay").value, date=$("fDate").value;
  if(pin){ const l=c.plan[dayKey]||(c.plan[dayKey]=[]); if(l.indexOf(key)<0) l.push(key); await persistPlan(); }
  else (c.today[date]||(c.today[date]=[])).push(key);
  kpClose(); c.draw();
  const x=kpKind==='sx'?stretchByKey(key):cardioByKey(key);
  flash(pin ? tf('msg.pinned',{name:x?x.name:'', day:dayShort(dayKey)}) : tf('msg.exadded',{name:x?x.name:''}));
}
async function kpLibPick(libKey, pin){ const key=await kpCfg(kpKind).fromLib(libKey); if(key) kpPick(key, pin); }
function kpNew(){ kpClose(); if(kpKind==='sx'){ sxPinDay=$("fDay").value; sxOpen(null); } else { cdPinDay=$("fDay").value; cdOpen(null); } }
const sxOwned = l => stretches.find(x=>x.lib===l.key || x.name.toLowerCase()===t('sxlib.'+l.key).toLowerCase()) || null;
const cdOwned = l => cardios.find(x=>x.lib===l.key || x.name.toLowerCase()===t('cdlib.'+l.key).toLowerCase()) || null;
async function sxFromLib(k){
  const l=sxLibByKey(k); if(!l) return null;
  const have=sxOwned(l);
  if(have){ if(have.retired){ have.retired=false; await persistStretches(); } return have.key; }
  const name=t('sxlib.'+k), reps=l.mode==='reps';
  const x=normStretch({key:sxKeyFor(name), name:name, unit:reps?'reps':null, secs:reps?0:l.tgt, reps:reps?l.tgt:0, mus:l.mus, lib:k});
  if(!x) return null;
  stretches.push(x); await persistStretches(); return x.key;
}
async function cdFromLib(k){
  const l=cdLibByKey(k); if(!l) return null;
  const have=cdOwned(l);
  if(have){ if(have.retired){ have.retired=false; await persistCardio(); } return have.key; }
  const name=t('cdlib.'+k);
  const x=normCardio({key:cdKeyFor(name), name:name, mins:l.mins, lib:k});
  if(!x) return null;
  cardios.push(x); await persistCardio(); return x.key;
}
function shOpen(){
  shManaging=false; shMsg('');
  $("shSearch").value='';
  dlgOpen("shWrap");
  shShow('list');
}
function shClose(){ dlgClose("shWrap"); shMsg(''); }
function shRenderList(){
  const box=$("shList"), q=($("shSearch").value||'').trim().toLowerCase();
  const dayKey=$("fDay").value;
  const onForm=k=>!!$("sets-"+k);
  const hit=ex=>!q || qMatch(q, ex.name+' '+ex.short+' '+ex.note);
  const row=ex=>{
    const pinned=(planExtras[dayKey]||[]).indexOf(ex.key)>=0;
    if(shManaging){
      const days=entries.filter(e=>liftsOf(e,ex.key).length).length;
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
  const pool = CATALOGUE.filter(hit).filter(ex=>shManaging || (!ex.retired && !onForm(ex.key))).sort(exOrder);
  const lrow=l=>{
    const ok=libUsable(l), eq=l.eq.length ? l.eq.map(x=>t('eq.'+x)).join(', ') : t('guide.bodyweight');
    return `<div class="sh-row${ok?'':' off'}">
        <div class="nm">${esc(t('lib.'+l.key))}${lvTag(l.lv)}<span>${esc(l.p.map(k=>t('mus.'+k)).join(', '))} · ${esc(ok ? eq : tf('guide.needs',{list:eq}))}</span></div>
        <button class="sh-pin" data-libpin="${l.key}" title="${esc(tf('sh.pintip',{day:dayShort(dayKey)}))}">${esc(tf('sh.pin',{day:dayShort(dayKey)}))}</button>
        <button class="sh-add" data-libadd="${l.key}">${esc(t('btn.add'))}</button>
      </div>`;
  };
  const found = (q && !shManaging) ? LIB.filter(l=>!libLive(l) && qMatch(q, t('lib.'+l.key)+' '+l.p.concat(l.s).map(k=>t('mus.'+k)).join(' ')+(l.lv?' '+t('lv.'+l.lv):'')))
    .sort((a,b)=>(libUsable(b)?1:0)-(libUsable(a)?1:0) || libOrder(a,b)).slice(0,60) : [];
  const libPart = found.length ? `<div class="sh-grp">${esc(t('sh.lib'))}</div>`+bwSplit(found, l=>l.lv, lrow, 'sh-grp')
    : (!q && !shManaging) ? `<div class="sh-empty">${esc(tf('sh.libhint',{n:LIB.length}))}</div>` : '';
  box.innerHTML = (pool.length || found.length)
    ? (pool.length ? `<div class="sh-grp">${esc(t('sh.yours'))}</div>`+bwSplit(pool, exLv, row, 'sh-grp') : '')+libPart
    : (!q && !shManaging) ? `<div class="sh-empty">${esc(tf('sh.libhint',{n:LIB.length}))}<br>${esc(t('sh.tapnew'))}</div>`
    : `<div class="sh-empty">${esc(tf('nomatch',{q:q}))}${shManaging?'':'<br>'+esc(t('sh.tapnew'))}</div>`+libPart;

}
async function shLibPick(k, pin){
  const key=await libToCollection(k);
  if(key) shPick(key, pin);
}
async function shPick(key, pin){
  const dayKey=$("fDay").value;
  if(pin){
    const list=planExtras[dayKey]||(planExtras[dayKey]=[]);
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
function unhide(key){ const ed=exEdits[key]; if(ed){ delete ed.retired; if(!Object.keys(ed).length) delete exEdits[key]; } }
function unpinEverywhere(key){
  let touched=false;
  Object.keys(planExtras).forEach(dk=>{
    const i=planExtras[dk].indexOf(key);
    if(i>=0){ planExtras[dk].splice(i,1); if(!planExtras[dk].length) delete planExtras[dk]; touched=true; }
  });
  return touched;
}
async function shRetire(key){
  const ex=exByKey(key); if(!ex) return;
  const hide=!ex.retired;
  if(hide) (exEdits[key]||(exEdits[key]={})).retired=true; else unhide(key);
  const unpinned = hide ? unpinEverywhere(key) : false;
  await persistExEdits(); if(unpinned) await persistPlan();
  const box=$("sets-"+key), tag=(box&&box.parentNode)?box.parentNode.querySelector('.xtag'):null;
  if(tag && hide){ tag.className='xtag'; tag.textContent=t('ex.added'); }
  shRenderList(); render();
  shMsg(tf(hide?'msg.hidden':'msg.shown',{name:ex.name}));
  flash(tf(hide?'msg.hidden.short':'msg.shown.short',{name:ex.name}));
}
let shDelArmed=null, shDelTimer=null;
function shResetDel(){ shDelArmed=null; if(shDelTimer) clearTimeout(shDelTimer); const b=$("shDelete"); if(b) b.textContent=t('btn.remove'); }
async function shDelete(){
  const key=shEditing; if(!key) return;
  const ex=exByKey(key); if(!ex) return;
  const days=entries.filter(e=>liftsOf(e,key).length).length;
  if(shDelArmed!==key){
    shDelArmed=key;
    $("shDelete").textContent=t('btn.tapagain');
    const what = days ? tn('sh.del.clears',days,{name:ex.name}) : tf('sh.del.removes',{name:ex.name});
    shMsg(what+' '+t('sh.del.custom')+' '+t('notreversible'), true);
    shDelTimer=setTimeout(shResetDel,4000);
    return;
  }
  shResetDel();
  entries.forEach(e=>{ if(e.lifts && e.lifts[key]) delete e.lifts[key]; });
  unpinEverywhere(key);
  if(Array.isArray(settings.chartEx)) settings.chartEx=settings.chartEx.filter(k=>k!==key);
  customEx=customEx.filter(x=>x.key!==key); delete exEdits[key];
  await persistCatalogue(); await persistExEdits(); await persistPlan(); await persistSettings(); await persist();
  shClose(); fillForm($("fDate").value); render();
  flash(tf('msg.removed',{name:ex.name})+(days?(' · '+tn('msg.cleared',days)):''));
}
let shEditing=null;
let shAddToDay=true;
function shGroupSet(k){
  const g=$("shGroup"); if(!g) return;
  if(!g.children.length){
    g.innerHTML=GROUPS.map(x=>`<button type="button" data-g="${x.key}">${esc(groupName(x.key))}</button>`).join('');
    g.querySelectorAll('button').forEach(b=>b.onclick=()=>shGroupSet(b.dataset.g));
  }
  g.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.g===k));
}
const shGroupGet = () => { const b=document.querySelector('#shGroup button.on'); return b?b.dataset.g:'other'; };
function shMusDraw(prim, sec){
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
function shMusRead(){
  const box=$("shMus"), pick=c=>box ? [...box.querySelectorAll('.mchip.'+c)].map(b=>b.dataset.m) : [];
  return {prim:pick('p'), sec:pick('s')};
}

const shModeGet = () => { const b=document.querySelector('#shMode button.on'); return b?b.dataset.m:'kg'; };
const shGoalGet = () => { const b=document.querySelector('#shGoal button.on'); return b?b.dataset.g:'off'; };
function shGoalSet(g){ document.querySelectorAll('#shGoal button').forEach(b=>b.classList.toggle('on', b.dataset.g===g)); }
function shRangeTyped(){
  const mn=parseInt($("shMin").value,10), mx=parseInt($("shMax").value,10);
  const g=goalOfRange(isNaN(mn)?null:mn, isNaN(mx)?null:mx);
  shGoalSet(g==='off' ? 'custom' : g);
  shCoachSync();
}
function shGoalPick(g){
  const p=GOALS.find(x=>x.key===g);
  if(p){ $("shMin").value=p.min; $("shMax").value=p.max; }
  if(g!=='off' && $("shStep").value==='') $("shStep").value=STEP_DEF(shModeGet()==='sec'?'sec':null);
  shGoalSet(g); shCoachSync();
}
function shCoachSync(){
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
function shCoachFill(ex){
  const has = !!ex && ex.repMin!=null && ex.repMax!=null;
  $("shMin").value = has ? ex.repMin : '';
  $("shMax").value = has ? ex.repMax : '';
  $("shStep").value = (has && ex.step!=null) ? ex.step : '';
  shGoalSet(has ? goalOfRange(ex.repMin, ex.repMax) : 'off');
  shCoachSync();
}
function shCoachRead(){
  if(shGoalGet()==='off') return {repMin:null, repMax:null, step:null};
  const mn=parseInt($("shMin").value,10), mx=parseInt($("shMax").value,10);
  if(isNaN(mn) || isNaN(mx) || mn<1 || mx<mn) return undefined;
  return {repMin:mn, repMax:mx, step:$("shStep").value};
}
function shNew(){
  shEditing=null; shResetDel();
  $("shName").value=''; $("shShort").value=''; $("shNote").value=''; $("shDef").value='';
  shGroupSet('other');
  document.querySelectorAll('#shMode button').forEach(b=>b.classList.toggle('on', b.dataset.m==='kg'));
  shCoachFill(null); shMusDraw([],[]);
  $("shDelete").style.display='none';
  $("shCreate").textContent=t(shAddToDay?'sh.createadd':'sh.addcoll');
  shMsg(''); shShow('form');
  $("shName").focus();
}
function shEdit(key){
  const ex=exByKey(key); if(!ex) return;
  shEditing=key; shResetDel();
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
async function shCreate(){
  const name=$("shName").value.trim();
  if(!name){ shMsg(t('msg.needname'),true); $("shName").focus(); return; }
  const short=$("shShort").value.trim(), note=$("shNote").value.trim();
  const coach=shCoachRead();
  if(coach===undefined){ shMsg(t('sh.coach.bad'),true); $("shMin").focus(); return; }

  const mode=shModeGet(), mus=shMusRead();
  if(shEditing){
    const ed=exEdits[shEditing]||(exEdits[shEditing]={});
    ed.name=name.slice(0,40);
    if(short) ed.short=short.slice(0,16); else delete ed.short;
    if(note) ed.note=note.slice(0,60); else delete ed.note;
    ed.group=shGroupGet();
    const own=customEx.find(x=>x.key===shEditing);
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
  const existing=CATALOGUE.find(x=>x.name.toLowerCase()===lower);
  if(existing){
    if(existing.retired){ unhide(existing.key); await persistExEdits(); }
    if(shAddToDay) addMovementToForm(existing.key);
    shClose(); render();
    flash(tf('msg.already',{name:existing.name})+(shAddToDay?' — '+t('msg.addedthat'):''));
    return;
  }
  const def=normCustomEx({
    key: cxKeyFor(name), name, short:short, note:note, group: shGroupGet(),
    def: $("shDef").value, added: mode==='bw', unit: mode==='sec' ? 'sec' : null,
    repMin: coach.repMin, repMax: coach.repMax, step: coach.step,
    prim: mus.prim, sec: mus.sec
  });
  if(!def){ shMsg(t('msg.badname'),true); return; }
  customEx.push(def);
  const ok=await persistCatalogue();
  if(!ok){ customEx.pop(); rebuildCatalogue(); shMsg(t('msg.savefail.ex'),true); return; }
  if(shAddToDay) addMovementToForm(def.key);
  shClose();
  render();
  flash(shAddToDay ? tf('msg.created',{name:def.name})
                   : tf('msg.createdcoll',{name:def.name}));
}

let tmr = null;
let restTimer=null, audioCtx=null;
function restRemaining(endAt, now){ return (endAt==null) ? 0 : Math.max(0, Math.round((endAt-now)/1000)); }
function fmtClock(s){ return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'); }
const hasAlarm = () => { try{ return !!(window.AndroidAlarm && window.AndroidAlarm.schedule); }catch(e){ return false; } };
const exactAlarmsOff = () => { try{ return hasAlarm() && typeof window.AndroidAlarm.exactAllowed==='function' && !window.AndroidAlarm.exactAllowed(); }catch(e){ return false; } };
function drawExactNotice(){ const el=$("restExact"); if(el) el.style.display=(settings.restSound && exactAlarmsOff()) ? '' : 'none'; }
function openExactSettings(){ try{ window.AndroidAlarm.openExactSettings(); }catch(e){} }
function alarmSet(secs, label){
  if(!hasAlarm() || !settings.restSound) return;
  try{ window.AndroidAlarm.schedule(Math.max(0,Math.round(secs*1000)), label||t('rest.alarm.rest')); }catch(e){}
}
function alarmCancel(){
  if(!hasAlarm()) return;
  try{ window.AndroidAlarm.cancel(); }catch(e){}
}
function audioWake(){
  try{ const AC=window.AudioContext||window.webkitAudioContext;
    if(AC && settings.restSound){ if(!audioCtx) audioCtx=new AC(); if(audioCtx.state==='suspended') audioCtx.resume(); } }catch(e){}
}
function beep(n, freq){
  if(!settings.restSound) return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    if(!audioCtx) audioCtx=new AC();
    if(audioCtx.state==='suspended') audioCtx.resume();
    const t0=audioCtx.currentTime+0.06;
    for(let i=0;i<(n||3);i++){
      const o=audioCtx.createOscillator(), g=audioCtx.createGain(), at=t0+i*0.30;
      o.type='square'; o.frequency.value=freq||1760;
      g.gain.setValueAtTime(0.0001,at);
      g.gain.exponentialRampToValueAtTime(0.9,at+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001,at+0.20);
      o.connect(g); g.connect(audioCtx.destination); o.start(at); o.stop(at+0.22);
    }
  }catch(e){}
}
function timerStart(o){
  const lead=Math.max(0, o.lead||0), hold=Math.max(1, Math.round(o.hold||0));
  tmr={ kind:o.kind, key:o.key||null, label:o.label||'', lead:lead, hold:hold,
        phase: lead>0 ? 'lead' : 'hold',
        total: lead>0 ? lead : hold,
        endAt: Date.now() + (lead>0?lead:hold)*1000,
        leftPaused:null, doneAt:null };
  $("restPause").textContent=t('rest.pause');
  $("restBar").classList.remove('done');
  $("restBar").classList.add('show');
  document.body.classList.add('resting');
  audioWake();
  tmr.alarmLabel = (o.kind==='stretch') ? tf('rest.alarm.stretch',{name:tmr.label})
                 : (o.kind==='cardio')  ? tf('rest.alarm.cardio',{name:tmr.label})
                 : t('rest.alarm.rest');
  alarmSet(lead+hold, tmr.alarmLabel);
  if(restTimer) clearInterval(restTimer);
  restTimer=setInterval(timerTick,250);
  timerTick();
}
function timerTick(){
  if(!tmr) return;
  const now=Date.now();
  if(tmr.doneAt!=null){ if(now-tmr.doneAt>10000) timerStop(); return; }
  const left=(tmr.leftPaused!=null)?tmr.leftPaused:restRemaining(tmr.endAt,now);
  $("restNum").textContent=fmtClock(left);
  $("restWho").textContent = tmr.phase==='lead' ? (t('rest.getready')+' · '+tmr.label) : tmr.label;
  $("restFill").style.width=(tmr.total>0?Math.max(0,Math.min(100,left/tmr.total*100)):0)+'%';
  $("restBar").classList.toggle('lead', tmr.phase==='lead');
  if(tmr.leftPaused==null && left<=0){
    if(tmr.phase==='lead'){
      tmr.phase='hold'; tmr.total=tmr.hold; tmr.endAt=Date.now()+tmr.hold*1000;
      beep(1,1320);
      timerTick();
    } else timerFinish();
  }
}
function timerFinish(){
  const z=tmr;
  z.doneAt=Date.now(); z.endAt=null; z.phase='done';
  $("restNum").textContent='0:00';
  $("restWho").textContent = (z.kind==='stretch') ? (tf('rest.held',{n:z.hold})+' · '+z.label)
                           : (z.kind==='cardio')  ? (Math.round(z.hold/60)+' min · '+z.label)
                           : t('rest.done');
  $("restFill").style.width='0%';
  $("restBar").classList.remove('lead');
  $("restBar").classList.add('done');
  beep(3);
  if(z.kind==='stretch' && z.key) mobSetAdd(z.key, z.hold);
  if(z.kind==='cardio' && z.key) cdSetAdd(z.key, Math.round(z.hold/60));
}
function timerStop(){
  if(restTimer){ clearInterval(restTimer); restTimer=null; }
  alarmCancel();
  tmr=null;
  $("restBar").classList.remove('show'); $("restBar").classList.remove('done'); $("restBar").classList.remove('lead');
  document.body.classList.remove('resting');
}
function restPause(){
  if(!tmr || tmr.doneAt!=null) return;
  if(tmr.leftPaused!=null){
    tmr.endAt=Date.now()+tmr.leftPaused*1000; tmr.leftPaused=null; $("restPause").textContent=t('rest.pause');
    alarmSet(restRemaining(tmr.endAt,Date.now())+(tmr.phase==='lead'?tmr.hold:0), tmr.alarmLabel);
  }else{
    tmr.leftPaused=restRemaining(tmr.endAt,Date.now()); tmr.endAt=null; $("restPause").textContent=t('rest.resume');
    alarmCancel();
  }
  timerTick();
}
function restNudge(sec){
  if(!tmr || tmr.doneAt!=null) return;
  if(tmr.leftPaused!=null) tmr.leftPaused=Math.max(0,tmr.leftPaused+sec);
  else if(tmr.endAt!=null) tmr.endAt=Math.max(Date.now(), tmr.endAt+sec*1000);
  else return;
  const left=(tmr.leftPaused!=null)?tmr.leftPaused:restRemaining(tmr.endAt,Date.now());
  if(left>tmr.total) tmr.total=left;
  if(tmr.phase==='hold') tmr.hold=Math.max(tmr.hold,left);
  if(tmr.leftPaused==null) alarmSet(left+(tmr.phase==='lead'?tmr.hold:0), tmr.alarmLabel);
  timerTick();
}
function restLen(){
  const c=$("restCustom")?num($("restCustom").value):null;
  if(c!=null && c>=10 && c<=900) return Math.round(c);
  return settings.restSec||DEF_REST;
}
function startRest(secs, who){
  const s=(secs!=null && secs>0) ? Math.round(secs) : restLen();
  if(s!==settings.restSec && s>=10 && s<=900){ settings.restSec=s; syncRestSegs(); persistSettings(); }
  timerStart({kind:'rest', label: who?(t('rest.rest')+' · '+who):t('rest.rest'), hold:s, lead:0});
}
function startStretch(key){
  const s=stretchByKey(key);
  if(!s || sxIsReps(s) || !s.secs){ flash(t('msg.needhold')); return; }
  timerStart({kind:'stretch', key:key, label:s.name, hold:s.secs, lead:settings.mobLead||0});
}
function syncRestSegs(){
  document.querySelectorAll('#segRest button').forEach(b=>b.classList.toggle('on', +b.dataset.s===settings.restSec));
  document.querySelectorAll('#segLead button').forEach(b=>b.classList.toggle('on', +b.dataset.l===(settings.mobLead||0)));
  const b=$("restSnd"); if(b){ b.classList.toggle('on', !!settings.restSound); b.textContent=t(settings.restSound?'rest.beep':'rest.silent'); }
}
async function setRestPreset(s){ settings.restSec=s; $("restCustom").value=''; syncRestSegs(); await persistSettings(); }
async function setLeadPreset(s){ settings.mobLead=s; syncRestSegs(); await persistSettings(); }
async function toggleRestSound(){
  settings.restSound=!settings.restSound;
  syncRestSegs(); await persistSettings(); drawExactNotice();
  if(!settings.restSound) alarmCancel();
  else if(tmr && tmr.doneAt==null && tmr.leftPaused==null){
    alarmSet(restRemaining(tmr.endAt,Date.now())+(tmr.phase==='lead'?tmr.hold:0), tmr.alarmLabel);
  }
  if(settings.restSound){ audioWake(); beep(1); }
}

function profileTDEE(){
  const w=lastNumOf(e=>e.weight), h=lastNumOf(e=>e.height);
  const age=effAge();
  if(w==null||h==null||age==null) return null;
  const bmr=mifflinBMR(w,h,age,settings.sex);
  if(bmr==null) return null;
  const a=ACTIVITY.find(x=>x.key===settings.activity)||ACTIVITY[2];
  return {bmr:Math.round(bmr), tdee:Math.round(bmr*a.mult), mult:a.mult, act:a.key, age:age, weight:w, height:h};
}
function drawBMR(){
  const out=$("bmrOut"); if(!out) return;
  const seg=$("segActivity");
  if(seg){
    seg.innerHTML=ACTIVITY.map(a=>`<button type="button" data-a="${a.key}"${a.key===settings.activity?' class="on"':''}>${esc(actName(a.key))}<i>${esc(actHours(a.key))}</i></button>`).join('');
    seg.querySelectorAll('button').forEach(b=>b.onclick=()=>setActivity(b.dataset.a));
  }
  const a=ACTIVITY.find(x=>x.key===settings.activity)||ACTIVITY[2];
  const an=$("actNote");
  if(an) an.innerHTML=`<b>${esc(actName(a.key))} · ${esc(actHours(a.key))} ${esc(t('prof.actweek'))}</b><br>${esc(actNote(a.key))}`;
  const ah=$("actHelp");
  if(ah){
    ah.innerHTML=ACTIVITY_HELP.map(k=>`<div class="helprow"><b>${esc(t('acth.'+k+'.h'))}</b>${esc(t('acth.'+k+'.b'))}</div>`).join('');
  }
  const fa=$("fAge"); if(fa && document.activeElement!==fa) fa.value=(effAge()!=null?effAge():'');
  const p=profileTDEE();
  if(!p){
    const missing=[];
    if(lastNumOf(e=>e.weight)==null) missing.push(t('bmr.need.weight'));
    if(lastNumOf(e=>e.height)==null) missing.push(t('bmr.need.height'));
    if(effAge()==null) missing.push(t('bmr.need.age'));
    out.innerHTML=`<div class="calib-meta">${esc(tf('bmr.need',{list:missing.join(t('and'))}))}</div>`;
    return;
  }
  const drifted = settings.ageSet && settings.age!=null && p.age!==settings.age;
  out.innerHTML=`<div class="calib-line">${tf('bmr.line',{kcal:'<b>'+p.tdee+' kcal</b>'})}`
    +`<span class="calib-sub">${tf('bmr.sub',{bmr:p.bmr, mult:p.mult, act:esc(actName(p.act).toLowerCase()), age:p.age})}</span></div>`
    +`<div class="calib-meta">${tf('bmr.meta',{kg:p.weight.toFixed(1), cm:p.height, age:p.age})}`
    +(drifted?' '+tf('bmr.drift',{age:settings.age}):'')+`</div>`;
}
async function setActivity(k){
  if(!ACTIVITY.some(a=>a.key===k)) return;
  settings.activity=k; await persistSettings(); render();
}
async function setAge(){
  const v=parseInt($("fAge").value,10);
  if(isNaN(v)){ settings.age=null; settings.ageSet=null; }
  else if(v<10||v>120){ flash(t('msg.enterage'),true); return; }
  else { settings.age=v; settings.ageSet=localDate(); }
  await persistSettings(); render();
}
function drawProtein(){
  const tg=protTarget(), ok=protOk(), own=settings.protFloor!=null;
  const out=$("protOut");
  if(out){
    const why = own ? tf('prot.why.own',{g:protAuto()}) : t(settings.sex ? 'prot.why.'+settings.sex : 'prot.why.unset');
    out.innerHTML=`<div class="calib-line">${tf('prot.aim',{g:'<b>'+tg+' g</b>'})}<span class="calib-sub">${esc(tf('prot.okfrom',{g:ok}))}</span></div>`
      +`<div class="calib-meta">${esc(why)}</div>`
      +`<div class="calib-meta">${esc(tf('prot.relax',{ok:ok}))}</div>`
      +(own ? `<button class="apply" id="protAutoBtn">${esc(tf('prot.useauto',{g:protAuto()}))}</button>` : '');
    const b=$("protAutoBtn"); if(b) b.onclick=protUseAuto;
  }
  const mp=$("mpCurrent"); if(mp) mp.textContent=t(own ? 'prot.byhand' : 'prot.auto');
  document.querySelectorAll('#segSex button').forEach(b=>b.classList.toggle('on', b.dataset.s===settings.sex));
  const bn=$("bfNote");
  if(bn) bn.textContent = t(settings.sex==='female' ? 'bf.female' : 'bf.male');
}
async function protUseAuto(){
  settings.protFloor=null;
  await persistSettings(); render();
  flash(tf('msg.protauto',{n:protTarget()}));
}
async function setProtManual(){
  const v=num($("manualProt").value);
  if(v==null||v<30||v>400){ flash(t('msg.enterfloor'),true); return; }
  settings.protFloor=Math.round(v);
  $("manualProt").value='';
  await persistSettings(); render();
  flash(tf('msg.floorset',{n:settings.protFloor}));
}
async function setSex(sx){
  settings.sex = (sx==='female') ? 'female' : 'male';
  await persistSettings();
  let n=0;
  entries.forEach(e=>{
    if(!e.meas) return;
    if(e.bfSrc==='manual') return;
    const h=e.height!=null?e.height:lastNumOf(x=>x.height);
    const v=bfNavy(e.meas, h, settings.sex);
    if(v!=null && (e.bf==null || Math.abs(v-e.bf)>0.05)){ e.bf=v; n++; }
  });
  if(n) await persist();
  render();
  bfModeSet(bfMode(), false);
  flash(tf('msg.sexset',{sex:t('prof.'+settings.sex)})+(settings.protFloor==null?(' · '+tf('msg.protauto',{n:protTarget()})):'')+(n?(' · '+tn('msg.recalcd',n)):''));
}

function drawColl(){
  const wrap=$("collWrap"); if(!wrap) return;
  const q=($("collSearch")?$("collSearch").value:'').trim().toLowerCase();
  const hit=ex=>!q || qMatch(q, ex.name+' '+ex.short+' '+ex.note);
  const pool=CATALOGUE.filter(hit).sort(exOrder);
  const row=ex=>{
    const days=entries.filter(e=>liftsOf(e,ex.key).length).length;
    const inDays=DAYS.filter(d=>sessionEx(d.key).indexOf(ex.key)>=0).map(d=>dayShort(d.key));
    const bits=[loadDesc(ex)];
    bits.push((ex.prim && ex.prim.length) ? ex.prim.map(m=>t('mus.'+m)).join(', ') : t('coll.nomus'));
    bits.push(days?tn('coll.sessions',days):t('coll.never'));
    if(inDays.length) bits.push(tf('coll.indays',{days:inDays.join(', ')}));
    return `<div class="collrow${ex.retired?' off':''}" data-k="${esc(ex.key)}">
      <div class="collname">${esc(ex.name)}${ex.retired?' <span class="xtag">'+esc(t('coll.hidden'))+'</span>':''}<span class="sub">${esc(bits.join(' · '))}</span></div>
      <button type="button" class="collbtn" data-cedit="${esc(ex.key)}">${esc(t('btn.edit'))}</button>
      <button type="button" class="collbtn${ex.retired?' on':''}" data-cret="${esc(ex.key)}">${esc(t(ex.retired?'btn.show':'btn.hide'))}</button>
    </div>`;
  };
  wrap.innerHTML = pool.length ? `<div class="collgrp">${esc(t('coll.yours'))}</div>`+bwSplit(pool, exLv, row, 'collgrp')
    : `<div class="collempty">${esc(q ? tf('nomatch',{q:q}) : t('coll.empty'))}<br>${esc(t('coll.addbelow'))}</div>`;

}

function drawReview(){
  const grid=$("revGrid"); if(!grid) return;
  const today=localDate(), start=weekStart(today), todayIdx=new Date(today+'T12:00:00').getDay();
  const wk=entries.filter(e=>e.date>=start && e.date<=today), ptg=protTarget(), pok=protOk(), tgt=settings.kcalTarget;
  const done=wk.filter(trained), planned=sessionTarget(), cr=calRecommend(), rec=cr.enough ? cr.target : null;
  const plannedSoFar=DAYS.filter((d,i)=>i<=todayIdx && sessionEx(d.key).length).length;
  const recs=[];
  CATALOGUE.forEach(ex=>{
    const all=entries.map(e=>({date:e.date, sets:liftsOf(e,ex.key)})).filter(s=>s.sets.length);
    const before=all.filter(s=>s.date<start), inWk=all.filter(s=>s.date>=start);
    if(before.length && inWk.length && recordsBeaten(ex, recordsOf(ex,before), recordsOf(ex,inWk)).length) recs.push(ex.short||ex.name);
  });
  const wp=entries.filter(e=>e.weight!=null), dW=weekTrendChange(wp,start), wIn=wp.some(e=>e.date>=start);
  const kd=wk.filter(e=>kcalOf(e)!=null), pd=wk.filter(e=>protOf(e)!=null);
  const kAvg=kd.length ? Math.round(kd.reduce((a,e)=>a+kcalOf(e),0)/kd.length) : null;
  const pAvg=pd.length ? Math.round(pd.reduce((a,e)=>a+protOf(e),0)/pd.length) : null;
  const w=weekVolume(), mv=w.vol, mute=settings.volMute||[], lo=settings.volLo, hi=settings.volHi;
  const tagged=MUSCLE_KEYS.some(k=>mv[k]>0);
  const cnt={ok:0, track:0, low:0, sofar:0, high:0, muted:0};
  MUSCLE_KEYS.forEach(k=>{ cnt[weekState(k, w, lo, hi, mute)]++; });
  const cell=(lbl,val,sub)=>`<div class="cstat"><div class="cs-lbl">${esc(lbl)}</div><div class="cs-val">${val}</div><div class="cs-sub">${esc(sub)}</div></div>`;
  grid.innerHTML=
      cell(t('rev.sessions'), done.length+(planned?`<span>/ ${planned}</span>`:''), t(planned?'rev.planned':'rev.noplan'))
    + cell(t('rev.records'), String(recs.length), recs.length ? recs.slice(0,3).join(', ')+(recs.length>3?' …':'') : t('rev.norecs'))
    + cell(t('rev.weight'), dW==null ? '—' : fmtSigned(dW)+'<span>kg</span>', t(dW!=null ? 'rev.trendwk' : wIn ? 'rev.notrend' : 'rev.noweigh'))
    + cell(t('rev.food'), kAvg==null ? '—' : kAvg.toLocaleString()+'<span>kcal</span>', tf('rev.kcalsub',{target:tgt.toLocaleString(), n:kd.length}))
    + cell(t('rev.protein'), pAvg==null ? '—' : pAvg+'<span>g</span>', tf('rev.protsub',{target:ptg, ok:pok, n:pd.length}))
    + cell(t('rev.muscles'), tagged ? String(cnt.ok) : '—', tagged ? tf('rev.mussub',{track:cnt.track, under:cnt.low+cnt.sofar, over:cnt.high, muted:cnt.muted}) : t('rev.nomus'));
  const gap=tagged ? MUSCLES.find(m=>w.proj[m.key]===0 && mute.indexOf(m.key)<0) : null;
  let one;
  if(!wk.length) one=t('rev.one.empty');
  else if(plannedSoFar && done.length<plannedSoFar) one=tf('rev.one.sessions',{n:done.length, planned:plannedSoFar});
  else if(pd.length>=3 && pAvg<pok) one=tf('rev.one.protein',{avg:pAvg, ok:pok});
  else if(rec!=null && !settings.kcalOwn && Math.abs(rec-tgt)>=100) one=tf('rev.one.target',{rec:rec.toLocaleString(), target:tgt.toLocaleString()});
  else if(kd.length>=4 && Math.abs(kAvg-tgt)>tgt*0.1) one=tf(kAvg>tgt?'rev.one.over':'rev.one.under',{avg:kAvg.toLocaleString(), target:tgt.toLocaleString()});
  else if(gap) one=tf('rev.one.muscle',{name:t('mus.'+gap.key)});
  else one=t('rev.one.ok');
  $("revOne").innerHTML=`<b>${esc(t('rev.one.lbl'))}</b> · ${esc(one)}`;
}

const BACKUP_DAYS = 14;
let lastBackup=null, bakSnoozed=false;
let instPrompt=null;
const INST_SNOOZE='tally:instSnooze';
const instIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
const instDone = () => !!window.AndroidFile || location.protocol==='file:' || navigator.standalone===true
  || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches);
function instSnoozed(){ try{ const v=+localStorage.getItem(INST_SNOOZE); return !!v && Date.now()-v<30*864e5; }catch(e){ return false; } }
function drawInstall(){
  const done=instDone(), can=!done && (!!instPrompt || instIOS);
  const nudge=$("instNudge");
  if(nudge){
    nudge.style.display = (can && !instSnoozed()) ? '' : 'none';
    $("instText").textContent = t(instIOS ? 'inst.nudge.ios' : 'inst.nudge');
    $("instNow").style.display = instPrompt ? '' : 'none';
  }
  const card=$("cardInstall");
  if(card){
    card.style.display = done ? 'none' : '';
    $("instHow").textContent = t(instIOS ? 'inst.ios' : instPrompt ? 'inst.android' : 'inst.manual');
    $("instBtn").style.display = instPrompt ? '' : 'none';
  }
}
async function instGo(){
  if(!instPrompt) return;
  const p=instPrompt; instPrompt=null;
  p.prompt();
  try{ await p.userChoice; }catch(e){}
  drawInstall();
}
function drawUpdate(){
  const android=!!window.AndroidFile;
  $("updNow").textContent=tf('upd.now',{v:APP_VERSION});
  $("updHow").textContent=t(android ? 'upd.android' : 'upd.web');
  $("updGet").style.display = android ? '' : 'none';
  $("updCheck").style.display = android ? 'none' : '';
}
const updMsg = m => { $("updMsg").textContent=m||''; };
async function updCheck(){
  const sw=navigator.serviceWorker;
  const reg=sw ? await sw.getRegistration().catch(()=>null) : null;
  if(!reg){ location.reload(); return; }
  updMsg(t('upd.checking'));
  let found=false;
  sw.addEventListener('controllerchange', ()=>{ found=true; updMsg(t('upd.found')); setTimeout(()=>location.reload(), 600); }, {once:true});
  try{ await reg.update(); }
  catch(e){ updMsg(t('upd.offline')); return; }
  setTimeout(()=>{ if(!found && !reg.installing && !reg.waiting) updMsg(t('upd.latest')); }, 4000);
}
function instLater(){ try{ localStorage.setItem(INST_SNOOZE, String(Date.now())); }catch(e){} drawInstall(); }
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); instPrompt=e; drawInstall(); });
window.addEventListener('appinstalled', ()=>{ instPrompt=null; drawInstall(); flash(t('inst.done')); });
async function loadBackupDate(){
  try{ const v=await STORE.get(BKEY); lastBackup=(typeof v==='string' && validDate(v)) ? v : null; }catch(e){ lastBackup=null; }
}
async function markBackedUp(){ lastBackup=localDate(); try{ await STORE.set(BKEY, lastBackup); }catch(e){} drawBackup(); }
const backupAge = () => lastBackup ? dnum(localDate())-dnum(lastBackup) : null;
function backupDue(){
  if(!entries.length) return false;
  const age=backupAge();
  if(age==null) return dnum(localDate())-dnum(entries[0].date)>=7;
  return age>=BACKUP_DAYS && entries.some(e=>e.date>lastBackup);
}
function drawBackup(){
  const age=backupAge(), line=$("bakLine");
  if(line) line.textContent = age==null ? t('bak.never') : age===0 ? t('bak.today') : age===1 ? t('bak.yesterday') : tf('bak.ago',{n:age});
  const bar=$("bakNudge"); if(!bar) return;
  const show=backupDue() && !bakSnoozed;
  bar.style.display = show ? '' : 'none';
  if(show) $("bakNudgeText").textContent = age==null ? t('bak.nudge.never') : tf('bak.nudge.ago',{n:age});
}
function bakFromNudge(){
  saveBackupFile();
  if(lastBackup!==localDate()) $("bakNudgeText").textContent=$("syncMsg").textContent || t('sync.writefail');
}

function drawVersion(){
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

let guideMus=null, guideAll=false, guideMode='p', guideEq='';
const fmtSetsN = n => (n%1 ? n.toFixed(1) : String(n));
function libOwned(l){
  const nm=t('lib.'+l.key).toLowerCase();
  return CATALOGUE.find(x=>x.lib===l.key || x.name.toLowerCase()===nm) || null;
}
const libLive = l => { const o=libOwned(l); return !!o && !o.retired; };
const libUsable = l => !gym.set || libAvailable(l, gym.have);
function sxLibRow(l){
  const ok=libUsable(l), have=sxOwned(l);
  const eq=l.eq.length ? l.eq.map(q=>t('eq.'+q)).join(', ') : t('guide.noeq');
  const act=(have && !have.retired) ? `<span class="libin">${esc(t('guide.in.sx'))}</span>` : `<button type="button" class="collbtn" data-sxadd="${l.key}">${esc(t('guide.add'))}</button>`;
  return `<div class="librow${ok?'':' off'}"><div class="libname">${esc(t('sxlib.'+l.key))}${lvTag(l.lv)}`
    + `<span class="sub">${esc(l.mus.map(k=>t('mus.'+k)).join(', '))} · ${esc(sxSub(l))}<br>${esc(ok ? eq : tf('guide.needs',{list:eq}))}</span></div>${act}</div>`;
}
function drawCdLib(){
  const wrap=$("cdLibWrap"); if(!wrap) return;
  const show=l=>guideAll || libUsable(l);
  const list=CD_LIB.slice().sort((a,b)=>(show(b)?1:0)-(show(a)?1:0) || byName(t('cdlib.'+a.key),t('cdlib.'+b.key)));
  wrap.innerHTML=list.map(l=>{
    const ok=libUsable(l), have=cdOwned(l), eq=l.eq.length ? l.eq.map(q=>t('eq.'+q)).join(', ') : t('guide.noeq');
    const act=(have && !have.retired) ? `<span class="libin">${esc(t('guide.in.sx'))}</span>` : `<button type="button" class="collbtn" data-cdadd="${l.key}">${esc(t('guide.add'))}</button>`;
    return `<div class="librow${ok?'':' off'}"><div class="libname">${esc(t('cdlib.'+l.key))}<span class="sub">${esc(tf('cd.target',{n:l.mins}))} · ${esc(ok ? eq : tf('guide.needs',{list:eq}))}</span></div>${act}</div>`;
  }).join('');
}
function drawSxWeek(){
  const wrap=$("sxWeek"); if(!wrap) return;
  const start=weekStart(), today=localDate(), cnt={}, plain=new Set();
  MUSCLE_KEYS.forEach(k=>cnt[k]=0);
  entries.filter(e=>e.date>=start && e.date<=today && e.mob).forEach(e=>Object.keys(e.mob).forEach(k=>{
    const st=stretchByKey(k); if(!st) return;
    if(!st.mus || !st.mus.length){ plain.add(st.name); return; }
    st.mus.forEach(m=>{ if(m in cnt) cnt[m]++; });
  }));
  const vol=weekVolume().vol;
  const missed=MUSCLES.filter(m=>vol[m.key]>0 && !cnt[m.key]);
  wrap.innerHTML=MUSCLES.map(m=>{
    const n=cnt[m.key], miss=vol[m.key]>0 && !n;
    return `<button type="button" class="mchip sxw${n?' on':''}${miss?' miss':''}" data-sxmus="${m.key}">${esc(t('mus.'+m.key))}${n?' · '+n:''}</button>`;
  }).join('');
  const bits=[];
  if(missed.length) bits.push(tf('guide.sx.missed',{list:missed.map(m=>t('mus.'+m.key)).join(', ')}));
  else if(Object.values(cnt).some(Boolean)) bits.push(t('guide.sx.allgood'));
  else bits.push(t('guide.sx.none'));
  if(plain.size) bits.push(tf('guide.sx.plain',{list:[...plain].join(', ')}));
  $("sxWeekNote").textContent=bits.join(' ');
}
function libRow(l){
  const ok=libUsable(l);
  const mus=l.p.map(k=>t('mus.'+k)).join(', ') + (l.s.length ? ' · '+tf('guide.also',{list:l.s.map(k=>t('mus.'+k)).join(', ')}) : '');
  const eq=l.eq.length ? l.eq.map(q=>t('eq.'+q)).join(', ') : t('guide.bodyweight');
  const act=libLive(l) ? `<span class="libin">${esc(t('guide.in'))}</span>`
                       : `<button type="button" class="collbtn" data-add="${l.key}">${esc(t('guide.add'))}</button>`;
  return `<div class="librow${ok?'':' off'}"><div class="libname">${esc(t('lib.'+l.key))}${lvTag(l.lv)}`
    + `<span class="sub">${esc(mus)}<br>${esc(ok ? eq : tf('guide.needs',{list:eq}))}</span></div>${act}</div>`;
}
function weekVolume(){
  const today=localDate(), start=weekStart(today), todayIdx=new Date(today+'T12:00:00').getDay();
  const done=muscleVolume(entries.filter(e=>e.date>=start && e.date<=today), exByKey);
  const cur=entries.find(e=>e.date===today);
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
function drawGuide(){
  const wrap=$("volWrap"); if(!wrap) return;
  const lo=settings.volLo, hi=settings.volHi, mute=settings.volMute||[];
  const w=weekVolume(), vol=w.vol;
  const stOf=k=>weekState(k, w, lo, hi, mute);
  [["volLo",lo],["volHi",hi]].forEach(([id,v])=>{ const el=$(id); if(el && document.activeElement!==el) el.value=v; });
  const pct=v=>Math.min(100, v/hi*100);
  const pre=VOL_PRESETS.find(x=>x.lo===lo && x.hi===hi);
  $("volPre").innerHTML=VOL_PRESETS.map(x=>`<button type="button" class="mchip${x===pre?' on':''}" data-band="${x.lo}-${x.hi}">${esc(t('guide.pre.'+x.key))} ${x.lo}–${x.hi}</button>`).join('');
  $("volHelp").innerHTML=esc(t(pre ? 'guide.pre.'+pre.key+'.note' : 'guide.pre.custom.note'))+'<br><br>'+esc(t('guide.help'));

  wrap.innerHTML=['push','pull','legs','core'].map(g=>`<div class="volgrp">${esc(groupName(g))}</div>`
    + MUSCLES.filter(m=>m.grp===g).map(m=>{
        const k=m.key, st=stOf(k);
        const mb=(st==='low' || st==='sofar' || st==='muted') ? `<button type="button" class="volmute" data-mute="${k}">${esc(t(st==='muted'?'guide.unmute':'guide.mute'))}</button>` : '<span></span>';
        const plan=w.proj[k]>vol[k] ? `<b style="width:${pct(w.proj[k])}%"></b>` : '';
        return `<div class="volrow ${st}"><button type="button" class="volname" data-pick="${k}">${esc(t('mus.'+k))}</button>`
          + `<div class="voltrack">${plan}<i style="width:${pct(vol[k])}%"></i></div><div class="volnum">${fmtSetsN(vol[k])}</div>`
          + `<div class="volstate">${esc(t('guide.st.'+st))}</div>${mb}</div>`;
      }).join('')).join('');
  const names=w.untagged.map(k=>{ const ex=exByKey(k); return ex ? ex.name : k; });
  const start=weekStart();
  $("volNote").textContent = names.length ? tf('guide.untagged',{list:names.join(', ')})
    : (entries.some(e=>e.date>=start && Object.keys(e.lifts||{}).length) ? '' : t('guide.novol'));

  const low=MUSCLES.filter(m=>w.proj[m.key]<lo && mute.indexOf(m.key)<0).sort((a,b)=>w.proj[a.key]-w.proj[b.key]);
  const focus=low.slice(0,4);
  $("recWrap").innerHTML = !low.length ? `<div class="restnote">${esc(t('guide.rec.none'))}</div>`
    : focus.map(m=>{
        const pool=LIB.filter(l=>l.p.indexOf(m.key)>=0 && libUsable(l)), easy=pool.filter(l=>(l.lv||0)<=3);
        const picks=(easy.length ? easy : pool).sort((a,b)=>(libLive(a)?1:0)-(libLive(b)?1:0)).slice(0,2);
        const n=vol[m.key], p=w.proj[m.key];
        return `<div class="reclbl">${esc(tf('guide.rec.of',{name:t('mus.'+m.key), n:fmtSetsN(n), lo:lo})+(p>n ? ' · '+tf('guide.rec.plan',{p:fmtSetsN(p)}) : ''))}</div>`
          + (picks.length ? picks.map(libRow).join('') : `<div class="restnote">${esc(t('guide.rec.nothing'))}</div>`);
      }).join('')
      + (low.length>focus.length ? `<div class="sxnote">${esc(tf('guide.rec.more',{n:low.length-focus.length}))}</div>` : '');

  if(!guideMus || MUSCLE_KEYS.indexOf(guideMus)<0) guideMus = low.length ? low[0].key : 'chest';
  $("browseMus").innerHTML=MUSCLES.map(m=>`<button type="button" class="mchip${m.key===guideMus?' on':''}" data-pick="${m.key}">${esc(t('mus.'+m.key))}</button>`).join('');
  const show=l=>guideAll || libUsable(l);
  const eqHit=l=>!guideEq || (guideEq==='none' ? !l.eq.length : l.eq.indexOf(guideEq)>=0);
  const prim=LIB.filter(l=>l.p.indexOf(guideMus)>=0 && show(l)), sec=LIB.filter(l=>l.s.indexOf(guideMus)>=0 && show(l));
  const sxs=SX_LIB.filter(l=>l.mus.indexOf(guideMus)>=0 && show(l));
  const pools={p:prim, s:sec, x:sxs}, pool=pools[guideMode]||prim;
  const list=pool.filter(eqHit).sort(guideMode==='x' ? (a,b)=>a.lv-b.lv || byName(t('sxlib.'+a.key),t('sxlib.'+b.key)) : libOrder);
  $("browseMode").innerHTML=['p','s','x'].map(m=>`<button type="button" class="${m===guideMode?'on':''}" data-mode="${m}">${esc(tf('guide.mode.'+m,{n:pools[m].filter(eqHit).length}))}</button>`).join('');
  const eqN=q=>pool.filter(l=>q==='none' ? !l.eq.length : l.eq.indexOf(q)>=0).length;
  const eqOpts=['none'].concat(EQUIP).filter(q=>q===guideEq || eqN(q)>0);
  $("browseEq").innerHTML=`<option value="">${esc(tf('guide.eq.any',{n:pool.length}))}</option>`
    + eqOpts.map(q=>`<option value="${q}"${q===guideEq?' selected':''}>${esc(tf('guide.eq.item',{name:t(q==='none'?'guide.eq.none':'eq.'+q), n:eqN(q)}))}</option>`).join('');
  $("browseEq").value=guideEq;
  const ab=$("browseAll"); ab.style.display=gym.set ? '' : 'none'; ab.textContent=t(guideAll ? 'guide.all.off' : 'guide.all.on');
  const mn=t('mus.'+guideMus);
  $("browseCount").textContent=tn(guideMode==='s' ? 'guide.count.s' : guideMode==='x' ? 'guide.count.x' : 'guide.count', list.length, {name:mn});
  $("browseWrap").innerHTML = list.length ? (guideMode==='x' ? list.map(sxLibRow).join('') : bwSplit(list, l=>l.lv, libRow, 'reclbl'))
    : `<div class="restnote">${esc(guideEq ? t('guide.none.eq') : tf(guideMode==='s' ? 'guide.none.s' : guideMode==='x' ? 'guide.none.x' : 'guide.none',{name:mn}))}</div>`;
  drawSxWeek(); drawCdLib();
}
async function libToCollection(k){
  const l=libByKey(k); if(!l) return null;
  const have=libOwned(l);
  if(have){
    if(have.retired){ unhide(have.key); await persistExEdits(); }
    return have.key;
  }
  const name=t('lib.'+k);
  const def=normCustomEx({key:cxKeyFor(name), name:name, group:muscleGrp(l.p[0]), def:0,
    added:l.ld==='bw', unit:l.ld==='sec' ? 'sec' : null, prim:l.p, sec:l.s, lib:k});
  if(!def) return null;
  customEx.push(def);
  if(!await persistCatalogue()){ customEx.pop(); rebuildCatalogue(); return null; }
  return def.key;
}
async function guideAdd(k){
  if(await libToCollection(k)) render();
}
async function volMuteToggle(k){
  const m=settings.volMute||(settings.volMute=[]), i=m.indexOf(k);
  if(i>=0) m.splice(i,1); else m.push(k);
  await persistSettings(); render();
}
async function volBandPick(v){
  const [lo,hi]=v.split('-').map(Number);
  settings.volLo=lo; settings.volHi=hi; await persistSettings(); render();
}
async function volBandSet(){
  const lo=parseInt($("volLo").value,10), hi=parseInt($("volHi").value,10);
  if(!isNaN(lo) && !isNaN(hi) && lo>=0 && hi<=100 && lo<hi){ settings.volLo=lo; settings.volHi=hi; await persistSettings(); }
  render();
}

function drawGym(){
  const wrap=$("gymWrap"); if(!wrap) return;
  const item=q=>{
    const on=gym.have.indexOf(q)>=0, n=ALL_LIBS().filter(l=>l.eq.indexOf(q)>=0).length;
    return `<button type="button" class="gymitem${on?' on':''}" data-eq="${q}"><span class="box"></span>`
      + `<span>${esc(t('eq.'+q))}<span class="sub">${esc(tn('gym.uses',n))}</span></span></button>`;
  };
  wrap.innerHTML=EQUIP_GROUPS.map(g=>{
    const have=g.items.filter(q=>gym.have.indexOf(q)>=0).length;
    return `<div class="gymgrp">${esc(t('gym.grp.'+g.key))}<span>${esc(tf('gym.grp.have',{n:have, total:g.items.length}))}</span></div>`
      + `<div class="gymgrid">${g.items.slice().sort((a,b)=>byName(t('eq.'+a), t('eq.'+b))).map(item).join('')}</div>`;
  }).join('');
  $("gymCount").textContent = gym.set ? tf('gym.count',{n:ALL_LIBS().filter(l=>libAvailable(l, gym.have)).length, total:ALL_LIBS().length}) : t('gym.unset');
  $("gymOwn").innerHTML = gym.own.map(o=>`<div class="collrow"><div class="collname">${esc(o.name)}</div>`
    + `<button type="button" class="collbtn" data-gdel="${esc(o.key)}" aria-label="${esc(t('btn.remove'))}">✕</button></div>`).join('');

}
async function gymToggle(q){
  const i=gym.have.indexOf(q);
  if(i>=0) gym.have.splice(i,1); else gym.have.push(q);
  gym.set=true; await persistGym(); render();
}
async function gymAddOwn(){
  const el=$("gymName"), name=el.value.trim(); if(!name) return;
  gym=normGym({set:gym.set, have:gym.have, own:gym.own.concat([{name:name}])});
  el.value=''; await persistGym(); drawGym();
}
async function gymDelOwn(k){ gym.own=gym.own.filter(o=>o.key!==k); await persistGym(); drawGym(); }

function dayEntry(){
  const date=$("fDate").value;
  if(!date) return null;
  if(loadFailed){ flash(t('msg.loadfail.save'),true); return null; }
  let e=entries.find(x=>x.date===date);
  if(!e){
    e=normEntry({date:date, day:$("fDay").value}); if(!e) return null;
    entries.push(e); entries.sort((a,b)=>a.date.localeCompare(b.date));
  }
  return e;
}
async function toggleFast(){
  const e=dayEntry(); if(!e) return;
  if(e.fast) delete e.fast; else e.fast=true;
  await persist(); render(); drawFast();
  flash(t(e.fast?'msg.fast.on':'msg.fast.off'));
}
function drawFast(){
  const b=$("fastBtn"); if(!b) return;
  const cur=entries.find(e=>e.date===$("fDate").value), on=!!(cur && cur.fast);
  b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  b.textContent=t(on?'f.fast.on':'f.fast');
}
const mobSetsOf = (e, k) => (e && e.mobSets && e.mobSets[k]) || 1;
async function setMobLog(key, total, sets){
  const e=dayEntry(); if(!e) return;
  const m=Object.assign({}, e.mob||{}), ms=Object.assign({}, e.mobSets||{});
  if(total==null){ delete m[key]; delete ms[key]; }
  else{ m[key]=Math.max(0,Math.round(total)); if(sets>1) ms[key]=Math.min(50,Math.round(sets)); else delete ms[key]; }
  e.mob=Object.keys(m).length?m:null; e.mobSets=Object.keys(ms).length?ms:null;
  await persist();
  drawMob(); stale('history');
}
function toggleMob(key){
  const cur=entries.find(e=>e.date===$("fDate").value);
  const on=!!(cur && cur.mob && (key in cur.mob));
  const s=stretchByKey(key), n=(s && s.sets) || 1, per=s ? sxTarget(s) : 0, done=on ? mobSetsOf(cur,key) : 0;
  if(on && done>=n) return setMobLog(key, null);
  return setMobLog(key, (on ? cur.mob[key] : 0)+per, done+1);
}
function mobSetAdd(key, amount){
  const cur=entries.find(e=>e.date===$("fDate").value);
  const on=!!(cur && cur.mob && (key in cur.mob));
  return setMobLog(key, (on ? cur.mob[key] : 0)+amount, (on ? mobSetsOf(cur,key) : 0)+1);
}
function mobRowEdit(row){
  const per=num(row.querySelector('.mobsec').value), n=num(row.querySelector('.mobn').value);
  if(per==null && n==null) return setMobLog(row.dataset.k, null);
  const s=stretchByKey(row.dataset.k), sets=Math.max(1, Math.round(n || (s && s.sets) || 1));
  return setMobLog(row.dataset.k, Math.max(0, per || 0)*sets, sets);
}
function mobRowHtml(s, mob, gone, ms){
  const on=(s.key in mob);
  const reps=sxIsReps(s), tgt=sxTarget(s), sets=s.sets||1, done=on ? ((ms && ms[s.key]) || 1) : 0;
  const base = tgt ? (reps ? tn('mob.repsn',tgt) : tf('mob.holdn',{n:tgt})) : t(reps?'mob.noreps':'mob.nohold');
  const sub = base + (sets>1 ? ' × '+tn('mob.setsn',sets) : '') + (on && sets>1 ? ' · '+tf('mob.setsof',{n:done, of:sets}) : '');
  const go = (!reps && s.secs) ? '<button type="button" class="mobgo">'+esc(t('btn.start'))+'</button>' : '';
  const tip=t(sets>1 && done<sets ? 'mob.ticktip.set' : 'mob.ticktip');
  return `<div class="mobrow${on?' done':''}${on && done<sets?' part':''}" data-k="${esc(s.key)}">
    <button type="button" class="mobtick" title="${esc(tip)}" aria-label="${esc(tip)}" aria-pressed="${on ? (done<sets ? 'mixed' : 'true') : 'false'}">✓</button>
    <div class="mobname">${esc(s.name)}${gone?' <span class="xtag">'+esc(t('removed'))+'</span>':pinTag(logPinned(planSx,s.key), $("fDay").value)}<span>${esc(sub)}</span></div>
    <input class="mobsec" type="number" min="0" max="${reps?999:3600}" inputmode="numeric" placeholder="${tgt||0}" value="${on?Math.round(mob[s.key]/done):''}" aria-label="${esc(t(reps?'sx.reps':'sx.hold'))}"><span class="mobu">${esc(reps?t('unit.reps'):'s')}</span><span class="mobx">×</span><input class="mobn" type="number" min="1" max="50" inputmode="numeric" placeholder="${sets}" value="${on?done:''}" aria-label="${esc(t('sx.sets'))}">
    ${go}
    ${gone?'':'<button type="button" class="mobedit" title="'+esc(t('mob.edittip'))+'" aria-label="'+esc(t('mob.edittip'))+'">⋯</button>'}
  </div>`;
}
function unpinLog(plan, key){ Object.keys(plan).forEach(d=>{ plan[d]=plan[d].filter(k=>k!==key); if(!plan[d].length) delete plan[d]; }); }
function dayLogKeys(plan, today, log){
  const dayKey=$("fDay").value, date=$("fDate").value;
  return [...new Set([...(plan[dayKey]||[]), ...(today[date]||[]), ...Object.keys(log)])];
}
const logPinned = (plan, key) => (plan[$("fDay").value]||[]).indexOf(key)>=0;
async function toggleLogPin(kind, key){
  const plan=kind==='sx'?planSx:planCd, dayKey=$("fDay").value, list=plan[dayKey]||(plan[dayKey]=[]), i=list.indexOf(key);
  if(i>=0){ list.splice(i,1); if(!list.length) delete plan[dayKey]; const today=kind==='sx'?sxToday:cdToday, date=$("fDate").value; (today[date]||(today[date]=[])).push(key); }
  else list.push(key);
  await persistPlan(); if(kind==='sx') drawMob(); else drawCardio();
}
const pinTag = (pinned, dayKey) => `<button type="button" class="xtag mobpin${pinned?' pin':''}" title="${esc(pinned?t('ex.unpintip'):tf('ex.pintip',{day:dayShort(dayKey)}))}">${esc(t(pinned?'ex.pinned':'ex.added'))}</button>`;
function drawMob(){
  const wrap=$("mobWrap"); if(!wrap) return;
  const date=$("fDate").value;
  const cur=entries.find(e=>e.date===date);
  const mob=(cur && cur.mob)?cur.mob:{};
  const dd=$("mobDate"); if(dd) dd.textContent=fmtDMY(date);
  const keys=dayLogKeys(planSx, sxToday, mob);
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

const cdSetsOf = (e, k) => (e && e.cardioSets && e.cardioSets[k]) || 1;
async function setCardioLog(key, total, sets){
  const e=dayEntry(); if(!e) return;
  const m=Object.assign({}, e.cardio||{}), ms=Object.assign({}, e.cardioSets||{});
  if(total==null){ delete m[key]; delete ms[key]; }
  else{ m[key]=Math.max(0,Math.round(total)); if(sets>1) ms[key]=Math.min(50,Math.round(sets)); else delete ms[key]; }
  e.cardio=Object.keys(m).length?m:null; e.cardioSets=Object.keys(ms).length?ms:null;
  await persist();
  drawCardio(); stale('history');
}
function toggleCardio(key){
  const cur=entries.find(e=>e.date===$("fDate").value);
  const on=!!(cur && cur.cardio && (key in cur.cardio));
  const c=cardioByKey(key), n=(c && c.sets) || 1, per=c ? (c.mins||0) : 0, done=on ? cdSetsOf(cur,key) : 0;
  if(on && done>=n) return setCardioLog(key, null);
  return setCardioLog(key, (on ? cur.cardio[key] : 0)+per, done+1);
}
function cdSetAdd(key, mins){
  const cur=entries.find(e=>e.date===$("fDate").value);
  const on=!!(cur && cur.cardio && (key in cur.cardio));
  return setCardioLog(key, (on ? cur.cardio[key] : 0)+mins, (on ? cdSetsOf(cur,key) : 0)+1);
}
function cdRowEdit(row){
  const per=num(row.querySelector('.mobsec').value), n=num(row.querySelector('.mobn').value);
  if(per==null && n==null) return setCardioLog(row.dataset.k, null);
  const c=cardioByKey(row.dataset.k), sets=Math.max(1, Math.round(n || (c && c.sets) || 1));
  return setCardioLog(row.dataset.k, Math.max(0, per || 0)*sets, sets);
}
function startCardioTimer(key){
  const c=cardioByKey(key);
  if(!c || !c.mins){ flash(t('msg.needmins')); return; }
  timerStart({kind:'cardio', key:key, label:c.name, hold:c.mins*60, lead:settings.mobLead||0});
}
function cdRowHtml(c, log, gone, ms){
  const on=(c.key in log), sets=c.sets||1, done=on ? ((ms && ms[c.key]) || 1) : 0;
  const sub=(c.mins ? tf('cd.target',{n:c.mins}) : t('cd.notarget')) + (sets>1 ? ' × '+tn('mob.setsn',sets) : '') + (on && sets>1 ? ' · '+tf('mob.setsof',{n:done, of:sets}) : '');
  const tip=t(sets>1 && done<sets ? 'mob.ticktip.set' : 'mob.ticktip');
  return `<div class="mobrow${on?' done':''}${on && done<sets?' part':''}" data-k="${esc(c.key)}">
    <button type="button" class="mobtick" title="${esc(tip)}" aria-label="${esc(tip)}" aria-pressed="${on ? (done<sets ? 'mixed' : 'true') : 'false'}">✓</button>
    <div class="mobname">${esc(c.name)}${gone?' <span class="xtag">'+esc(t('removed'))+'</span>':pinTag(logPinned(planCd,c.key), $("fDay").value)}<span>${esc(sub)}</span></div>
    <input class="mobsec" type="number" min="0" max="600" inputmode="numeric" placeholder="${c.mins||0}" value="${on?Math.round(log[c.key]/done):''}" aria-label="${esc(t('cdx.mins'))}"><span class="mobu">${esc(t('unit.min'))}</span><span class="mobx">×</span><input class="mobn" type="number" min="1" max="50" inputmode="numeric" placeholder="${sets}" value="${on?done:''}" aria-label="${esc(t('sx.sets'))}">
    ${c.mins?'<button type="button" class="mobgo">'+esc(t('btn.start'))+'</button>':''}
    ${gone?'':'<button type="button" class="mobedit" title="'+esc(t('mob.edittip'))+'" aria-label="'+esc(t('mob.edittip'))+'">⋯</button>'}
  </div>`;
}
function drawCardio(){
  const wrap=$("cdWrap"); if(!wrap) return;
  const date=$("fDate").value;
  const cur=entries.find(e=>e.date===date);
  const log=(cur && cur.cardio)?cur.cardio:{};
  const dd=$("cdDate"); if(dd) dd.textContent=fmtDMY(date);
  const keys=dayLogKeys(planCd, cdToday, log);
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
let cdEditing=null, cdDelArmed=false, cdDelTimer=null;
function cdMsg(msg,err){ const m=$("cdMsg"); if(!m) return; m.textContent=msg||''; m.className='sh-msg'+(err?' err':''); }
function cdResetDel(){ cdDelArmed=false; if(cdDelTimer) clearTimeout(cdDelTimer); const b=$("cdDelete"); if(b) b.textContent=t('btn.remove'); }
function cdOpen(key){
  cdEditing=key||null; cdResetDel();
  const c=key?cardioByKey(key):null;
  $("cdTitle").textContent=t(c?'cdx.edit':'cdx.new');
  $("cdName").value=c?c.name:'';
  $("cdMins").value=c?(c.mins||''):'30'; $("cdSets").value=c ? c.sets : 1;
  $("cdDelete").style.display=c?'':'none';
  cdMsg(''); dlgOpen("cdWrapSheet");
  if(!c) $("cdName").focus();
}
function cdClose(){ dlgClose("cdWrapSheet"); cdPinDay=null; cdResetDel(); cdMsg(''); cdEditing=null; }
async function cdSave(){
  const name=$("cdName").value.trim();
  if(!name){ cdMsg(t('msg.needname'),true); $("cdName").focus(); return; }
  if(cdEditing){
    const c=cardioByKey(cdEditing); if(!c){ cdClose(); return; }
    const upd=normCardio({key:c.key, name:name, mins:$("cdMins").value, sets:$("cdSets").value, lib:c.lib, retired:c.retired});
    if(!upd){ cdMsg(t('msg.badname'),true); return; }
    Object.assign(c, upd);
  }else{
    if(cardios.some(x=>x.name.toLowerCase()===name.toLowerCase())){ cdMsg(t('msg.onlist'),true); return; }
    const c=normCardio({key:cdKeyFor(name), name:name, mins:$("cdMins").value, sets:$("cdSets").value});
    if(!c){ cdMsg(t('msg.badname'),true); return; }
    cardios.push(c);
    if(cdPinDay){ (planCd[cdPinDay]||(planCd[cdPinDay]=[])).push(c.key); await persistPlan(); }
  }
  const ok=await persistCardio();
  if(!ok){ cdMsg(t('msg.savefail'),true); return; }
  cdClose(); drawCardio();
}
async function cdDelete(){
  if(!cdEditing) return;
  const c=cardioByKey(cdEditing); if(!c) return;
  const days=entries.filter(e=>e.cardio && (c.key in e.cardio)).length;
  if(!cdDelArmed){
    cdDelArmed=true;
    $("cdDelete").textContent=t('btn.tapagain');
    cdMsg(days ? tn('del.clears',days,{name:c.name})+' '+t('notreversible') : tf('del.removes',{name:c.name}), true);
    cdDelTimer=setTimeout(cdResetDel, 4000);
    return;
  }
  cdResetDel();
  cardios=cardios.filter(x=>x.key!==c.key);
  unpinLog(planCd, c.key); await persistPlan();
  entries.forEach(e=>{ if(e.cardio && (c.key in e.cardio)){ delete e.cardio[c.key]; if(!Object.keys(e.cardio).length) e.cardio=null; } });
  await persistCardio(); await persist();
  cdClose(); render();
  flash(tf('msg.removed',{name:c.name}));
}

let sxEditing=null, sxDelArmed=false, sxDelTimer=null;
function sxMsg(msg,err){ const m=$("sxMsg"); if(!m) return; m.textContent=msg||''; m.className='sh-msg'+(err?' err':''); }
function sxResetDel(){ sxDelArmed=false; if(sxDelTimer) clearTimeout(sxDelTimer); const b=$("sxDelete"); if(b) b.textContent=t('btn.remove'); }
function sxModeSet(m){
  const reps = m==='reps';
  document.querySelectorAll('#sxMode button').forEach(b=>b.classList.toggle('on', b.dataset.m===m));
  const lab=$("sxNumLabel"); if(lab) lab.textContent=t(reps?'sx.reps':'sx.hold');
  const nt=$("sxNote"); if(nt) nt.textContent=t(reps?'sx.note.reps':'sx.note');
  const inp=$("sxSecs");
  if(inp){
    inp.max=reps?999:3600; inp.step=reps?1:5; inp.placeholder=reps?'10':'45';
    const cur = sxEditing ? stretchByKey(sxEditing) : null;
    const v = cur ? (reps ? cur.reps : cur.secs) : (reps ? 10 : 45);
    inp.value = v || '';
  }
}
const sxModeGet = () => { const b=document.querySelector('#sxMode button.on'); return b?b.dataset.m:'sec'; };
function sxOpen(key){
  sxEditing=key||null; sxResetDel();
  const s=key?stretchByKey(key):null;
  const mode = sxIsReps(s) ? 'reps' : 'sec';
  $("sxTitle").textContent=t(s?'sx.edit':'sx.new');
  $("sxName").value=s?s.name:'';
  sxModeSet(mode); sxMusSet(s?s.mus:[]); $("sxSets").value=s ? s.sets : 1;
  $("sxDelete").style.display=s?'':'none';
  sxMsg(''); dlgOpen("sxWrap");
  if(!s) $("sxName").focus();
}
function sxClose(){ dlgClose("sxWrap"); sxResetDel(); sxMsg(''); sxEditing=null; sxPinDay=null; }
const sxMusGet = () => [...document.querySelectorAll('#sxMus .mchip.on')].map(b=>b.dataset.m);
function sxMusSet(list){ $("sxMus").innerHTML=MUSCLES.map(m=>`<button type="button" class="mchip${(list||[]).indexOf(m.key)>=0?' on':''}" data-m="${m.key}">${esc(t('mus.'+m.key))}</button>`).join(''); }
async function sxSave(){
  const name=$("sxName").value.trim();
  if(!name){ sxMsg(t('msg.needname'),true); $("sxName").focus(); return; }
  const reps = sxModeGet()==='reps';
  const v = $("sxSecs").value;
  if(sxEditing){
    const s=stretchByKey(sxEditing); if(!s){ sxClose(); return; }
    const upd=normStretch({key:s.key, name:name, unit:reps?'reps':null,
      secs:reps?s.secs:v, reps:reps?v:s.reps, sets:$("sxSets").value, mus:sxMusGet(), lib:s.lib, retired:s.retired});
    if(!upd){ sxMsg(t('msg.badname'),true); return; }
    Object.assign(s, upd);
  }else{
    if(stretches.some(x=>x.name.toLowerCase()===name.toLowerCase())){ sxMsg(t('msg.onlist'),true); return; }
    const s=normStretch({key:sxKeyFor(name), name:name, unit:reps?'reps':null,
      secs:reps?0:v, reps:reps?v:0, sets:$("sxSets").value, mus:sxMusGet()});
    if(!s){ sxMsg(t('msg.badname'),true); return; }
    stretches.push(s);
    if(sxPinDay){ (planSx[sxPinDay]||(planSx[sxPinDay]=[])).push(s.key); await persistPlan(); }
  }
  const ok=await persistStretches();
  if(!ok){ sxMsg(t('msg.savefail'),true); return; }
  sxClose(); drawMob();
}
async function sxDelete(){
  if(!sxEditing) return;
  const s=stretchByKey(sxEditing); if(!s) return;
  const days=entries.filter(e=>e.mob && (s.key in e.mob)).length;
  if(!sxDelArmed){
    sxDelArmed=true;
    $("sxDelete").textContent=t('btn.tapagain');
    sxMsg(days ? tn('del.clears',days,{name:s.name})+' '+t('notreversible') : tf('del.removes',{name:s.name}), true);
    sxDelTimer=setTimeout(sxResetDel, 4000);
    return;
  }
  sxResetDel();
  stretches=stretches.filter(x=>x.key!==s.key);
  unpinLog(planSx, s.key); await persistPlan();
  entries.forEach(e=>{ if(e.mob && (s.key in e.mob)){ delete e.mob[s.key]; if(!Object.keys(e.mob).length) e.mob=null; } });
  await persistStretches(); await persist();
  sxClose(); render();
  flash(tf('msg.removed',{name:s.name}));
}

const DP_MONTH=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
let dpY=0, dpM=0;
function setDateDisplay(ds){ const b=$("dateBtn"); if(b) b.textContent=fmtDMY(ds); }
function dpOpen(){
  const d=new Date(($("fDate").value||localDate())+'T12:00:00');
  dpY=d.getFullYear(); dpM=d.getMonth();
  dpRender(); dlgOpen("dpWrap");
}
function dpClose(){ dlgClose("dpWrap"); }
function dpShift(n){ dpM+=n; if(dpM<0){dpM=11;dpY--;} else if(dpM>11){dpM=0;dpY++;} dpRender(); }
function dpPick(ds){ $("fDate").value=ds; dpClose(); fillForm(ds); }
function dpRender(){
  const sel=$("fDate").value, today=localDate();
  const lead=new Date(dpY,dpM,1).getDay();
  const days=new Date(dpY,dpM+1,0).getDate();
  let h=DAYS.map(d=>`<div class="dp-dow">${esc(dayShort(d.key))}</div>`).join('');
  for(let i=0;i<lead;i++) h+='<button type="button" class="dp-day blank" disabled></button>';
  for(let d=1;d<=days;d++){
    const ds=dpY+'-'+String(dpM+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    h+=`<button type="button" class="dp-day${ds===sel?' sel':''}${ds===today?' today':''}" data-d="${ds}" aria-label="${fmtDMY(ds)}">${d}</button>`;
  }
  $("dpTitle").textContent=t('mon.'+DP_MONTH[dpM])+' '+dpY;
  $("dpGrid").innerHTML=h;

}

function fillForm(date){
  drawSched();
  const f=fillBody(date);
  drawFast();
  buildExForm(f.cur, f.dayKey);
  drawMob(); drawCardio();
}
function fillBody(date){
  setDateDisplay(date);
  const cur=entries.find(e=>e.date===date);
  const dayKey=(cur && cur.day) ? cur.day : weekdayKey(date);
  $("fDay").value=dayKey;
  const wHint=lastNumOf(e=>e.weight);
  const wIn=$("fWeight"); wIn.value=(cur && cur.weight!=null)?cur.weight:''; wIn.placeholder=(wHint!=null?wHint.toFixed(1):'kg');
  const hCarry=lastNumOf(e=>e.height);
  $("fHeight").value=(cur && cur.height!=null)?cur.height:(hCarry!=null?hCarry:'');
  $("fKcal").value=(cur && cur.kcal!=null)?cur.kcal:'';
  $("fProt").value=(cur && cur.prot!=null)?cur.prot:'';
  calcHint("fKcal"); calcHint("fProt");
  bfModeSet((cur && cur.bfSrc==='manual') ? 'manual' : 'calc');
  MEAS.forEach(x=>{
    const inp=$('f'+cap(x.key));
    const hint=lastNumOf(e=>e.meas?e.meas[x.key]:null);
    inp.value=(cur && cur.meas && cur.meas[x.key]!=null)?cur.meas[x.key]:'';
    inp.placeholder=(hint!=null?String(hint):'cm');
  });
  return {cur, dayKey};
}

const PAGE_DRAW = {
  body:     () => { drawBodyStats(); drawWeight(entries.filter(e=>e.weight!=null)); drawBody(); drawCalibration(); refreshManualTarget(); drawProtein(); drawBMR(); },
  workout:  () => { drawPlates(); drawStrength(); drawSxTrend(); drawCdTrend(); drawProg(); drawColl(); },
  guide:    () => drawGuide(),
  gym:      () => drawGym(),
  settings: () => { drawTheme(); drawUndo(); drawVersion(); },
  history:  () => { drawReview(); drawHistory(); }
};
const stalePages = new Set();
function drawPage(k){ if(stalePages.delete(k)) PAGE_DRAW[k](); }
function stale(k){ stalePages.add(k); if(k===curPage) drawPage(k); }
function render(){
  drawSched(); drawBackup(); drawInstall(); drawUpdate(); syncChartSegs();
  PAGES.forEach(p=>stalePages.add(p));
  drawPage(curPage);
}
function drawBodyStats(){
  const weighed=entries.filter(e=>e.weight!=null);
  const latestW=weighed.length?weighed[weighed.length-1]:null;
  if(latestW){
    $("wNow").innerHTML=latestW.weight.toFixed(1)+'<small>kg</small>';
    $("wDelta").innerHTML = fmtDelta(t('stat.d7'),deltaOf(e=>e.weight,7),'kg') + fmtDelta(t('stat.d30'),deltaOf(e=>e.weight,30),'kg');
  }
  const bfE=entries.filter(e=>e.bf!=null), lbf=bfE.length?bfE[bfE.length-1]:null;
  const bfSub=document.querySelector('#bfCard .sub-note');
  if(bfSub) bfSub.textContent=t(lbf && lbf.bfSrc==='manual' ? 'stat.bf.manual' : 'stat.bf.calc');
  if(lbf){
    $("bfNow").innerHTML=lbf.bf.toFixed(1)+'<small>%</small>';
    $("bfDelta").innerHTML = fmtDelta(t('stat.d7'),deltaOf(e=>e.bf,7),'%') + fmtDelta(t('stat.d30'),deltaOf(e=>e.bf,30),'%');
  }
  const wk7=entries.filter(e=>within7(e.date));
  const avg7=get=>{ const v=wk7.map(get).filter(x=>x!=null); return {avg:v.length ? Math.round(v.reduce((a,x)=>a+x,0)/v.length) : null, logged:v.length}; };
  const k7=avg7(kcalOf), p7=avg7(protOf), kcalAvg=k7.avg, protAvg=p7.avg;
  $("mKcal").textContent=kcalAvg!=null?kcalAvg+' kcal':'—';
  const kb=kcalBand(settings.kcalTarget), ks=kcalState(kcalAvg, settings.kcalTarget);
  $("mKcalTarget").textContent=tf(ks==='verylow' ? 'stat.targetlow' : 'stat.targetn',{n:settings.kcalTarget, lo:kb.lo, hi:kb.hi, min:kb.min, logged:k7.logged});
  const dk=$("dKcal"); if(dk){ dk.className='dot '+{ok:'ok', under:'mid', over:'bad', verylow:'bad', none:'no'}[ks]; dk.title=t('dot.kcal.'+ks); dk.setAttribute('aria-label', dk.title); }
  $("mProt").textContent=protAvg!=null?protAvg+' g':'—';
  const lp=$("lProt"); if(lp) lp.textContent=tf('stat.protavg',{target:protTarget(), ok:protOk()});
  setDot("dProt",protAvg==null?0:protAvg,protOk(),Math.round(protOk()*0.8));
  const dp=$("dProt"); if(dp){ dp.title=t(protAvg==null ? 'dot.prot.none' : 'dot.prot.'+dp.className.split(' ')[1]); dp.setAttribute('aria-label', dp.title); }
  $("mToday").textContent=entries.length?fmtDM(entries[entries.length-1].date):'—';
  calcHint('fKcal'); calcHint('fProt');
}
function fmtDelta(lbl, d, unit){
  if(!d) return `<div>Δ ${esc(lbl)}: <span style="color:var(--ink-faint)">—</span></div>`;
  const r=roundTo(d.delta), cls = r>0?'up':r<0?'down':'';
  return `<div>Δ ${esc(lbl)}: <b class="${cls}">${fmtSigned(r,' '+unit)}</b></div>`;
}
function setDot(id,v,good,mid){ const e=$(id); if(e) e.className='dot '+(v>=good?'ok':v>=mid?'mid':'no'); }
function drawSched(){
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

function chartColors(){
  const cs=getComputedStyle(document.documentElement);
  const v=n=>cs.getPropertyValue(n).trim()||'#888';
  return {grid:v('--line-soft'), faint:v('--txt-faint'), avg:v('--brass'),
          line:v('--orange'), dot:v('--panel'), ink:v('--ink')};
}

function chartSize(svg, baseH){
  const W=Math.max(170, Math.round(svg.clientWidth || (svg.parentNode && svg.parentNode.clientWidth) || 760));
  const H=Math.round(Math.max(170, Math.min(baseH, W*0.62)));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  return [W, H];
}
function drawWeight(weighed){
  const trAll=trendWeights(weighed.map(e=>({t:dnum(e.date), w:e.weight})));
  const trOf=new Map(weighed.map((e,i)=>[e.date, trAll[i]]));
  weighed=weighed.filter(e=>inChartWin(e.date));
  const svg=$("wChart"), [W,H]=chartSize(svg,300), padL=46,padR=16,padT=16,padB=30;
  const C=chartColors();
  const x0=padL,x1=W-padR,y0=padT,y1=H-padB;
  if(!weighed.length){ svg.innerHTML=`<text x="${(x0+x1)/2}" y="${(y0+y1)/2}" text-anchor="middle" fill="${C.faint}" font-family="JetBrains Mono" font-size="15">${esc(t('chart.empty.weight'))}</text>`; chartRecord('wChart', []); return; }
  const ws=weighed.map(e=>e.weight), wt=weighed.map(e=>trOf.get(e.date));
  let yMin=Math.min(...ws,...wt), yMax=Math.max(...ws,...wt);
  if(yMin===yMax){ yMin-=1; yMax+=1; }
  const pad=(yMax-yMin)*0.25||1; yMin-=pad; yMax+=pad;
  const yTo=v=>y1-(v-yMin)/(yMax-yMin)*(y1-y0);
  const ds=weighed.map(e=>dnum(e.date));
  const dMin=Math.min(...ds), dMax=Math.max(...ds);
  const xTo=dn=>dMin===dMax?(x0+x1)/2:x0+(dn-dMin)/(dMax-dMin)*(x1-x0);
  let g='';
  for(let i=0;i<=4;i++){ const v=yMin+(yMax-yMin)*i/4, y=yTo(v);
    g+=`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.grid}"/>`;
    g+=`<text class="axis" x="${x0-7}" y="${y+3}" text-anchor="end">${v.toFixed(1)}</text>`; }
  if(dMax>dMin){ const nT=Math.max(2, Math.min(5, dMax-dMin+1, Math.floor((x1-x0)/52)+1));
    for(let i=0;i<nT;i++){ const dn=Math.round(dMin+(dMax-dMin)*i/(nT-1)), x=xTo(dn);
      g+=`<text class="axis" x="${x.toFixed(1)}" y="${y1+18}" text-anchor="middle">${fmtTick(dn)}</text>`; } }
  else { g+=`<text class="axis" x="${((x0+x1)/2).toFixed(1)}" y="${y1+18}" text-anchor="middle">${fmtTick(dMin)}</text>`; }
  const avg=ws.reduce((a,b)=>a+b,0)/ws.length, ay=yTo(avg);
  g+=`<line x1="${x0}" y1="${ay}" x2="${x1}" y2="${ay}" stroke="${C.avg}" stroke-width="1.3" stroke-dasharray="5 5" opacity="0.55"/>`;
  g+=`<text class="axis" x="${x1}" y="${ay-6}" text-anchor="end" style="fill:${C.avg}">${esc(t('chart.avg'))} ${avg.toFixed(1)}</text>`;
  const n=weighed.length;
  const raw=weighed.map(e=>`${xTo(dnum(e.date)).toFixed(1)},${yTo(e.weight).toFixed(1)}`);
  const trl=weighed.map(e=>`${xTo(dnum(e.date)).toFixed(1)},${yTo(trOf.get(e.date)).toFixed(1)}`);
  if(n>1) g+=`<polygon points="${x0},${y1} ${trl.join(' ')} ${x1},${y1}" fill="url(#ag)" opacity="0.16"/>`;
  if(n>1) g+=`<polyline points="${raw.join(' ')}" fill="none" stroke="${C.line}" stroke-width="1.2" stroke-linejoin="round" opacity="0.35"/>`;
  weighed.forEach(e=>g+=`<circle cx="${xTo(dnum(e.date)).toFixed(1)}" cy="${yTo(e.weight).toFixed(1)}" r="2.6" fill="${C.dot}" stroke="${C.line}" stroke-width="1.4" opacity="0.6"/>`);
  g+=`<polyline points="${trl.join(' ')}" fill="none" stroke="${C.line}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>`;
  const le=weighed[n-1], lt=trOf.get(le.date);
  if(W>=520) g+=`<text class="axis" x="${(xTo(dnum(le.date))-6).toFixed(1)}" y="${yTo(lt)-9}" text-anchor="end" style="fill:${C.ink};font-size:13px">${esc(t('chart.trend'))} ${lt.toFixed(1)}</text>`;
  svg.innerHTML=`<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.line}"/><stop offset="1" stop-color="${C.line}" stop-opacity="0"/></linearGradient></defs>`+g;
  chartRecord('wChart', weighed.map(e=>e.date), d=>xTo(dnum(d)), y0, y1, {W:W, trend:trOf, label:d=>{ const e=entryOn(d); return e && e.weight!=null ? e.weight.toFixed(1)+' kg' : ''; }});
}

function drawMultiLine(svgId, series, opts){
  opts=opts||{};
  const legend = opts.legend!==false;
  series=series.filter(s=>s.points.length);
  const svg=$(svgId);
  let [W,H]=chartSize(svg,260);
  const below=legend && W<520, cols=W<250 ? 1 : 2, rows=below ? Math.ceil(series.length/cols) : 0;
  if(rows){ H+=rows*17+10; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); }
  const padL=44, padR=(legend && !below)?108:16, padT=16, padB=14+(rows ? rows*17+10 : 0);
  const C=chartColors();
  const x0=padL,x1=W-padR,y0=padT,y1=H-padB;
  if(!series.length){ svg.innerHTML=`<text x="${(x0+x1)/2}" y="${(y0+y1)/2}" text-anchor="middle" fill="${C.faint}" font-family="JetBrains Mono" font-size="14">${esc(opts.empty||'')}</text>`; chartRecord(svgId, []); return; }
  let allD=[]; series.forEach(s=>s.points.forEach(p=>allD.push(dnum(p.date))));
  const dMin=Math.min(...allD), dMax=Math.max(...allD);
  const xTo=d=>dMin===dMax?(x0+x1)/2:x0+(dnum(d)-dMin)/(dMax-dMin)*(x1-x0);
  let allV=[]; series.forEach(s=>s.points.forEach(p=>allV.push(p.val)));
  let yMin=Math.min(...allV), yMax=Math.max(...allV);
  if(opts.refLine!=null){ yMin=Math.min(yMin,opts.refLine); yMax=Math.max(yMax,opts.refLine); }
  if(yMin===yMax){ yMin-=2; yMax+=2; }
  const padY=(yMax-yMin)*0.14; yMin-=padY; yMax+=padY;
  const yTo=v=>y1-(v-yMin)/(yMax-yMin)*(y1-y0);
  const fmt=opts.fmt||(v=>v.toFixed(0));
  let g='';
  for(let i=0;i<=4;i++){ const v=yMin+(yMax-yMin)*i/4, y=yTo(v);
    g+=`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.grid}"/>`;
    g+=`<text class="axis" x="${x0-7}" y="${y+3}" text-anchor="end">${fmt(v)}</text>`; }
  if(opts.refLine!=null){ const y=yTo(opts.refLine); g+=`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.avg}" stroke-width="1.2" stroke-dasharray="5 5" opacity="0.5"/>`; }
  series.forEach((s,si)=>{
    const col=s.color||LINE_COLORS[si%LINE_COLORS.length];
    const ps=s.points.slice().sort((a,b)=>a.date.localeCompare(b.date));
    const coords=ps.map(p=>`${xTo(p.date).toFixed(1)},${yTo(p.val).toFixed(1)}`);
    if(coords.length>1) g+=`<polyline points="${coords.join(' ')}" fill="none" stroke="${col}" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/>`;
    ps.forEach(p=>g+=`<circle cx="${xTo(p.date).toFixed(1)}" cy="${yTo(p.val).toFixed(1)}" r="3" fill="${C.dot}" stroke="${col}" stroke-width="2"/>`);
    if(legend){
      const lx = below ? x0+(si%cols)*((x1-x0)/cols) : x1+12, ly = below ? y1+24+Math.floor(si/cols)*17 : y0+12+si*17;
      g+=`<line x1="${lx}" y1="${ly-4}" x2="${lx+16}" y2="${ly-4}" stroke="${col}" stroke-width="2.6"/>`;
      g+=`<text class="axis" x="${lx+20}" y="${ly}">${esc(s.name)}</text>`;
    }
  });
  svg.innerHTML=g;
  const dates=[...new Set(series.flatMap(s=>s.points.map(p=>p.date)))].sort();
  chartRecord(svgId, dates, xTo, y0, y1, {W:W});
}

const CHART={}, CHART_DAY={}, CHART_DETAIL={};
const fmtDay = ds => dayShort(weekdayKey(ds))+' '+fmtDMY(ds);
const cdRow = (k, v, sub, col) => `<div class="cdrow"><span>${col?`<i style="background:${col}"></i>`:''}${esc(k)}</span><b>${esc(v)}${sub?`<small>${esc(sub)}</small>`:''}</b></div>`;
function chartRecord(id, dates, xOf, y0, y1, extra){ CHART[id]=Object.assign({dates:dates||[], xOf:xOf, y0:y0, y1:y1}, extra||{}); chartPickDraw(id); }
function chartPickDraw(id){
  const st=CHART[id], box=document.querySelector(`.chartpick[data-chart="${id}"]`), svg=$(id);
  if(!st || !box || !svg) return;
  svg.classList.toggle('pickable', st.dates.length>0);
  if(!st.dates.length){ box.style.display='none'; return; }
  box.style.display='';
  if(!box.firstElementChild){
    box.innerHTML=`<select class="daysel" aria-label="${esc(t('chart.pickday'))}"></select><div class="chartdetail"></div>`;
    box.firstElementChild.onchange=ev=>{ CHART_DAY[id]=ev.target.value; chartPickDraw(id); };
  }
  let d=CHART_DAY[id];
  if(st.dates.indexOf(d)<0) d=CHART_DAY[id]=st.dates[st.dates.length-1];
  box.firstElementChild.innerHTML=st.dates.slice().reverse().map(x=>`<option value="${x}"${x===d?' selected':''}>${esc(fmtDay(x))}</option>`).join('');
  box.lastElementChild.innerHTML=(CHART_DETAIL[id] ? CHART_DETAIL[id](d) : '') || `<div class="cdnone">${esc(t('chart.d.none'))}</div>`;
  let m=svg.querySelector('.chmark');
  if(!m){ m=document.createElementNS('http://www.w3.org/2000/svg','line'); m.setAttribute('class','chmark'); svg.appendChild(m); }
  const x=st.xOf(d).toFixed(1);
  m.setAttribute('x1',x); m.setAttribute('x2',x); m.setAttribute('y1',st.y0); m.setAttribute('y2',st.y1);
}
const SCRUB={};
function chartDayAt(id, ev){
  const st=CHART[id], svg=$(id); if(!st || !st.dates.length || !svg.getScreenCTM) return null;
  const pt=svg.createSVGPoint(); pt.x=ev.clientX; pt.y=ev.clientY;
  const x=pt.matrixTransform(svg.getScreenCTM().inverse()).x;
  let best=st.dates[0], bd=Infinity;
  st.dates.forEach(d=>{ const dd=Math.abs(st.xOf(d)-x); if(dd<bd){ bd=dd; best=d; } });
  return best;
}
function chartScrubShow(id, d){
  const st=CHART[id], svg=$(id), NS='http://www.w3.org/2000/svg';
  let m=svg.querySelector('.chmark'); if(!m){ m=document.createElementNS(NS,'line'); m.setAttribute('class','chmark'); svg.appendChild(m); }
  const x=st.xOf(d);
  m.setAttribute('x1',x.toFixed(1)); m.setAttribute('x2',x.toFixed(1)); m.setAttribute('y1',st.y0); m.setAttribute('y2',st.y1);
  m.classList.add('live');
  let g=svg.querySelector('.chbub');
  if(!g){ g=document.createElementNS(NS,'g'); g.setAttribute('class','chbub'); g.innerHTML='<rect rx="6"/><text/>'; svg.appendChild(g); }
  const fs=13, W=st.W||760;
  const label=fmtDay(d)+(st.label ? ' · '+st.label(d) : ''), w=Math.min(W-4, label.length*fs*0.62+fs*1.4), h=fs*1.9;
  const bx=Math.max(2, Math.min(W-w-2, x-w/2));
  const r=g.firstElementChild, tx=g.lastElementChild;
  r.setAttribute('x',bx.toFixed(1)); r.setAttribute('y',1); r.setAttribute('width',w.toFixed(1)); r.setAttribute('height',h.toFixed(1)); r.setAttribute('rx',6);
  tx.setAttribute('x',(bx+w/2).toFixed(1)); tx.setAttribute('y',(1+h*0.68).toFixed(1)); tx.setAttribute('font-size',fs.toFixed(1)); tx.textContent=label;
}
function chartScrubEnd(id, keep){
  const svg=$(id), g=svg.querySelector('.chbub'), m=svg.querySelector('.chmark');
  if(g) g.remove(); if(m) m.classList.remove('live');
  if(keep && SCRUB[id]) CHART_DAY[id]=SCRUB[id];
  delete SCRUB[id]; chartPickDraw(id);
}
function chartScrubBind(id){
  const svg=$(id);
  svg.addEventListener('pointerdown', ev=>{ const d=chartDayAt(id, ev); if(!d) return; SCRUB[id]=d; try{ svg.setPointerCapture(ev.pointerId); }catch(e){} chartScrubShow(id, d); });
  svg.addEventListener('pointermove', ev=>{ if(!(id in SCRUB)) return; const d=chartDayAt(id, ev); if(d && d!==SCRUB[id]){ SCRUB[id]=d; chartScrubShow(id, d); } });
  svg.addEventListener('pointerup', ()=>{ if(id in SCRUB) chartScrubEnd(id, true); });
  svg.addEventListener('pointercancel', ()=>{ if(id in SCRUB) chartScrubEnd(id, false); });
}
const entryOn = d => entries.find(e=>e.date===d);
function prevWith(d, get){ for(let i=entries.length-1;i>=0;i--){ const e=entries[i]; if(e.date<d && get(e)!=null) return e; } return null; }
CHART_DETAIL.wChart = d => {
  const e=entryOn(d); if(!e) return '';
  const tr=CHART.wChart.trend && CHART.wChart.trend.get(d), pv=prevWith(d, x=>x.weight);
  let h=cdRow(t('chart.d.weight'), e.weight.toFixed(1)+' kg');
  if(tr!=null) h+=cdRow(t('chart.d.trend'), tr.toFixed(1)+' kg');
  if(pv) h+=cdRow(tf('chart.d.since',{date:fmtDM(pv.date)}), fmtSigned(e.weight-pv.weight,' kg',1));
  if(e.bf!=null) h+=cdRow(t('chart.d.bf'), e.bf.toFixed(1)+'%');
  if(kcalOf(e)!=null) h+=cdRow(t('chart.d.kcal'), kcalOf(e).toLocaleString()+' kcal', e.fast ? t('chart.d.fast') : '');
  if(e.prot!=null) h+=cdRow(t('chart.d.prot'), e.prot+' g');
  return h;
};
CHART_DETAIL.bodyChart = d => {
  const e=entryOn(d); if(!e || !e.meas) return '';
  return MEAS.filter(m=>e.meas[m.key]!=null).map(m=>{
    const v=e.meas[m.key], pv=prevWith(d, x=>x.meas && x.meas[m.key]);
    return cdRow(t('m.'+m.key).replace(/\s*\(.*\)$/,''), v.toFixed(1)+' cm', pv ? tf('chart.d.since.v',{v:fmtSigned(v-pv.meas[m.key],' cm',1), date:fmtDM(pv.date)}) : '');
  }).join('');
};
CHART_DETAIL.strChart = d => {
  const e=entryOn(d); if(!e || !e.lifts) return '';
  const sel=chartSelection(), bwFallback=lastNumOf(x=>x.weight)||BW_FALLBACK;
  return Object.keys(e.lifts).map(k=>({k, ex:exByKey(k)})).filter(o=>o.ex).sort((a,b)=>{
    const ia=sel.indexOf(a.k), ib=sel.indexOf(b.k); return (ia<0?99:ia)-(ib<0?99:ib) || byName(a.ex.name,b.ex.name);
  }).map(o=>{
    const m=sessionMetric(o.ex, e.lifts[o.k], e.weight!=null?e.weight:bwFallback), i=sel.indexOf(o.k);
    const u=m.unit==='kg'?' kg':m.unit==='sec'?' s':' reps';
    return cdRow(o.ex.name, fmtSets(o.k, e.lifts[o.k]), t(m.lbl)+' '+Math.round(m.val).toLocaleString()+u, i>=0?LINE_COLORS[i%LINE_COLORS.length]:'');
  }).join('');
};
const logRows = (log, nameOf, fmtVal, sel) => Object.keys(log||{}).map(k=>({k, n:nameOf(k)})).sort((a,b)=>{
    const ia=sel.indexOf(a.k), ib=sel.indexOf(b.k); return (ia<0?99:ia)-(ib<0?99:ib) || byName(a.n,b.n);
  }).map(o=>{ const v=log[o.k], i=sel.indexOf(o.k); return cdRow(o.n, v ? fmtVal(o.k, v) : t('chart.d.done'), '', i>=0?LINE_COLORS[i%LINE_COLORS.length]:''); }).join('');
CHART_DETAIL.sxChart = d => { const e=entryOn(d); if(!e || !e.mob) return '';
  return logRows(e.mob, sxName, (k,v)=>{ const u=sxIsReps(stretchByKey(k)) ? t('unit.reps') : 's', n=mobSetsOf(e,k); return n>1 ? n+' × '+Math.round(v/n)+' '+u : v+' '+u; }, logSelection('chartSx', sxAvail())); };
CHART_DETAIL.cdChart = d => { const e=entryOn(d); return e && e.cardio ? logRows(e.cardio, cdName, (k,v)=>{ const n=cdSetsOf(e,k); return n>1 ? n+' × '+Math.round(v/n)+' '+t('unit.min') : v+' '+t('unit.min'); }, logSelection('chartCd', cdAvail())) : ''; };

function exSessions(key){
  const bwFallback=lastNumOf(e=>e.weight)||BW_FALLBACK;
  return entries.filter(e=>liftsOf(e,key).length)
    .map(e=>({date:e.date, sets:e.lifts[key], bw:(e.weight!=null?e.weight:bwFallback)}))
    .sort((a,b)=>a.date.localeCompare(b.date));
}
function buildStrengthSeries(keys){
  return keys.map(exByKey).filter(Boolean).map(ex=>{
    const sess=exSessions(ex.key);
    if(!sess.length) return {name:ex.short, points:[]};
    const base=exVolume(ex,sess[0].sets,sess[0].bw)||1;
    return {name:ex.short, points:sess.map(s=>({date:s.date, val:exVolume(ex,s.sets,s.bw)/base*100}))};
  });
}
function buildAbsSeries(key){
  const ex=exByKey(key); if(!ex) return null;
  const sess=exSessions(key); if(!sess.length) return null;
  const m=sessionMetric(ex, sess[0].sets, sess[0].bw);
  return {ex, unit:m.unit, lbl:m.lbl,
    series:{name:ex.short, points:sess.map(s=>({date:s.date, val:sessionMetric(ex,s.sets,s.bw).val}))}};
}
function chartCandidates(){
  const plan=planKeys();
  const lastAt=k=>{ for(let i=entries.length-1;i>=0;i--) if(liftsOf(entries[i],k).length) return entries[i].date; return ''; };
  return CATALOGUE.filter(ex=>entries.some(e=>inChartWin(e.date) && liftsOf(e,ex.key).length)).sort((a,b)=>{
    const pa=plan.indexOf(a.key), pb=plan.indexOf(b.key);
    if(pa>=0 && pb>=0) return pa-pb;
    if(pa>=0) return -1;
    if(pb>=0) return 1;
    return lastAt(b.key).localeCompare(lastAt(a.key));
  });
}
function chartSelection(){
  const avail=chartCandidates().map(e=>e.key);
  const saved=settings.chartEx;
  if(saved==null) return avail.filter(k=>planKeys().indexOf(k)>=0).slice(0,MAX_SERIES);
  return saved.filter(k=>avail.indexOf(k)>=0).slice(0,MAX_SERIES);
}
async function toggleChartEx(key){
  const avail=chartCandidates().map(e=>e.key);
  const all=settings.chartEx==null ? chartSelection().slice() : settings.chartEx.slice(), i=all.indexOf(key);
  if(i>=0) all.splice(i,1);
  else{
    if(all.filter(k=>avail.indexOf(k)>=0).length>=MAX_SERIES){ $("strNote").textContent=t('chart.max'); return; }
    all.push(key);
  }
  settings.chartEx=all; await persistSettings(); drawStrength();
}
function absSummary(a){
  const sess=exSessions(a.ex.key), last=sess[sess.length-1];
  const best=Math.max(...sess.map(s=>sessionMetric(a.ex,s.sets,s.bw).val));
  const wk=entries.filter(e=>within7(e.date) && liftsOf(e,a.ex.key).length);
  const bwFallback=lastNumOf(e=>e.weight)||BW_FALLBACK;
  const wkTot=wk.reduce((sum,e)=>sum+sessionMetric(a.ex,e.lifts[a.ex.key],(e.weight!=null?e.weight:bwFallback)).val,0);
  const u=a.unit==='kg'?' kg':a.unit==='sec'?' s':' reps';
  return `<b>${esc(t(a.lbl))}</b> · ${esc(tf('chart.abs',{unit:a.unit}))}<br>`+
    `${esc(t('prog.last'))} ${fmtDM(last.date)} · ${esc(fmtSets(a.ex.key,last.sets))} — ${esc(tf('chart.best',{n:Math.round(best).toLocaleString()+u}))} · ${esc(tf('chart.7day',{n:Math.round(wkTot).toLocaleString()+u}))}`;
}
function drawStrength(){
  const avail=chartCandidates(), sel=chartSelection(), note=$("strNote"), pick=$("strPick");
  chartFoldDraw('str', entries.some(trained));
  pick.innerHTML=avail.map(ex=>{
    const i=sel.indexOf(ex.key), on=i>=0;
    return `<button type="button" class="exchip${on?' on':''}" data-k="${esc(ex.key)}" aria-pressed="${on}">`+
      `<i class="sw" style="background:${on?LINE_COLORS[i%LINE_COLORS.length]:'transparent'}"></i>${esc(ex.name)}</button>`;
  }).join('');

  if(!avail.length){
    drawMultiLine('strChart', [], {legend:false, empty:t('chart.empty.str')});
    note.textContent=t('chart.chips'); return;
  }
  if(!sel.length){
    drawMultiLine('strChart', [], {legend:false, empty:t('chart.empty.pick')});
    note.textContent=t('chart.nosel'); return;
  }
  if(sel.length===1){
    const a=buildAbsSeries(sel[0]);
    if(!a){ drawMultiLine('strChart', [], {legend:false, empty:t('chart.empty.nosess')}); note.textContent=''; return; }
    drawMultiLine('strChart', windowSeries([Object.assign({}, a.series, {color:LINE_COLORS[0]})]),
      {legend:false, fmt:v=>v.toFixed(0), empty:t('chart.empty.window')});
    note.innerHTML=absSummary(a); return;
  }
  drawMultiLine('strChart', windowSeries(buildStrengthSeries(sel)),
    {legend:false, refLine:100, fmt:v=>v.toFixed(0), empty:t('chart.empty.window')});
  note.innerHTML=t('chart.indexed');
}

const sxName = k => { const s=stretchByKey(k); return s ? s.name : prettyKey(k); };
const cdName = k => { const c=cardioByKey(k); return c ? c.name : prettyKey(k); };
function logAvail(field){
  const last={};
  entries.forEach(e=>{ if(inChartWin(e.date) && e[field]) Object.keys(e[field]).forEach(k=>{ last[k]=e.date; }); });
  return Object.keys(last).sort((a,b)=>last[b].localeCompare(last[a]));
}
const sxAvail = () => logAvail('mob'), cdAvail = () => logAvail('cardio');
function logSelection(setting, avail){
  const saved=settings[setting];
  return (saved==null ? avail : saved.filter(k=>avail.indexOf(k)>=0)).slice(0,MAX_SERIES);
}
async function toggleLogChip(setting, key, avail, redraw, noteId){
  const all=settings[setting]==null ? avail.slice(0,MAX_SERIES) : settings[setting].slice(), i=all.indexOf(key);
  if(i>=0) all.splice(i,1);
  else{
    if(all.filter(k=>avail.indexOf(k)>=0).length>=MAX_SERIES){ $(noteId).textContent=t('chart.max'); return; }
    all.push(key);
  }
  settings[setting]=all; await persistSettings(); redraw();
}
function drawLogTrend(o){
  const avail=o.avail(), sel=logSelection(o.setting, avail);
  $(o.pick).innerHTML=avail.map(k=>{
    const i=sel.indexOf(k), on=i>=0;
    return `<button type="button" class="exchip${on?' on':''}" data-k="${esc(k)}" aria-pressed="${on}">`+
      `<i class="sw" style="background:${on?LINE_COLORS[i%LINE_COLORS.length]:'transparent'}"></i>${esc(o.name(k))}</button>`;
  }).join('');
  const series=sel.map((k,i)=>({name:o.name(k), color:LINE_COLORS[i%LINE_COLORS.length],
    points:entries.filter(e=>inChartWin(e.date) && e[o.field] && e[o.field][k]>0).map(e=>({date:e.date, val:e[o.field][k]}))}));
  drawMultiLine(o.svg, series, {legend:false, fmt:v=>v.toFixed(0), empty:t(!avail.length ? o.empty : !sel.length ? 'chart.empty.pick' : 'chart.empty.window')});
  $(o.note).textContent = !avail.length ? '' : !sel.length ? t('chart.nosel') : t(o.noteKey);
  chartFoldDraw(o.fold, entries.some(e=>e[o.field]));
}
const drawSxTrend = () => drawLogTrend({field:'mob', setting:'chartSx', avail:sxAvail, name:sxName, pick:'sxPick', svg:'sxChart', note:'sxNote', fold:'sx', empty:'chart.empty.sx', noteKey:'chart.sxnote'});
const drawCdTrend = () => drawLogTrend({field:'cardio', setting:'chartCd', avail:cdAvail, name:cdName, pick:'cdPick', svg:'cdChart', note:'cdNote', fold:'cd', empty:'chart.empty.cd', noteKey:'chart.cdnote'});
const FOLD_CARD = {str:'cardStr', sx:'cardSxTrend', cd:'cardCdTrend'};
function chartFoldDraw(k, hasAny){
  const folded = (k in settings.chartFold) ? settings.chartFold[k] : !hasAny;
  const card=$(FOLD_CARD[k]); if(!card) return;
  card.classList.toggle('folded', folded);
  const b=card.querySelector('.foldbtn'); b.textContent=folded?'▸':'▾'; b.setAttribute('aria-expanded', String(!folded));
  b.title=t(folded?'chart.unfold':'chart.fold'); b.setAttribute('aria-label', b.title);
}
async function chartFoldToggle(k){
  const card=$(FOLD_CARD[k]);
  settings.chartFold=Object.assign({}, settings.chartFold, {[k]:!card.classList.contains('folded')});
  await persistSettings(); chartFoldDraw(k, true); render();
}

const measName = k => t('m.'+k).replace(/\s*\(.*\)$/,'').toLowerCase();
function buildBodySeries(){
  return MEAS.map(m=>{
    const pts=entries.filter(e=>e.meas && e.meas[m.key]!=null).map(e=>({date:e.date, cm:e.meas[m.key]})).sort((a,b)=>a.date.localeCompare(b.date));
    if(!pts.length) return {name:measName(m.key), points:[]};
    const base=pts[0].cm||1;
    const latest=pts[pts.length-1].cm;
    return {name:measName(m.key)+' '+latest.toFixed(1), points:pts.map(p=>({date:p.date, val:p.cm/base*100}))};
  });
}
function drawBody(){ drawMultiLine('bodyChart', windowSeries(buildBodySeries()), {refLine:100, fmt:v=>v.toFixed(0), empty:t('chart.empty.size')}); }

const entriesInWindow = () => core.entriesInWindow(entries, settings.calPeriod);
const kcalTargetFor = tdee => core.kcalTargetFor(tdee, settings.sex, settings.calRate);
const calRecommend = () => core.calRecommend(entries, settings);
function drawCalibration(){
  document.querySelectorAll('#segPeriod button').forEach(b=>b.classList.toggle('on', b.dataset.p===String(settings.calPeriod)));
  document.querySelectorAll('#segRate button').forEach(b=>b.classList.toggle('on', b.dataset.r===String(settings.calRate)));
  const out=$("calibOut");
  const r=calRecommend(), c=r.c;
  if(r.target==null){
    const need=[];
    need.push(tf('calib.need.weighins',{n:'<b>'+Math.min(c.weighIns,2)+'/2</b>'}));
    need.push(tf('calib.need.kcaldays',{n:'<b>'+Math.min(c.kcalDays,1)+'/1</b>'}));
    out.innerHTML=`<div class="calib-need">${t('calib.need.head')}<br><br>
      ${tf('calib.need.sofar',{list:need.length?need.join(' · '):'—'})}<br>
      ${t('calib.need.keep')}
      ${c.slope!=null?`<br><br>${tf('calib.need.trend',{kg:'<b>'+(c.slope*7).toFixed(2)+' kg/wk</b>'})}`:''}</div>`;
    return;
  }
  const kgWk=c.slope*7, target=r.target, floored=r.floored;
  const tdeeR=Math.round(c.tdee/10)*10, meanR=Math.round(c.meanK);
  const bwNow=lastNumOf(e=>e.weight);
  const perKg = bwNow ? c.tdee/bwNow : null;
  const shaky = (perKg!=null && (perKg<16 || perKg>60)) || c.spanDays<21;
  const meta=v=>'<b style="color:var(--brass-bright)">'+v+'</b>';
  const remark = !r.enough ? tf('calib.early',{d:meta(c.spanDays), w:meta(c.weighIns), k:meta(c.kcalDays)})
               : r.partial ? tf('calib.partial',{d:meta(c.spanDays), p:meta(settings.calPeriod)}) : '';
  const goalLbl = settings.calRate!==0 ? tf('calib.for',{rate:(settings.calRate>0?'+':'−')+Math.abs(settings.calRate)+' kg/wk'}) : t('calib.tomaintain');
  out.innerHTML=`
    <div class="calib-grid">
      <div class="cstat head"><div class="cs-lbl">${t('calib.rec')}</div><div class="cs-val">${target}<span>kcal/day</span></div><div class="cs-sub">${goalLbl}${floored?' · '+t('calib.floored'):''}${r.partial?' · '+t('calib.partialtag'):''}</div></div>
      <div class="cstat"><div class="cs-lbl">${t('calib.est')}</div><div class="cs-val">${tdeeR}<span>kcal</span></div><div class="cs-sub">${t('calib.esttdee')}</div></div>
      <div class="cstat"><div class="cs-lbl">${t('calib.avg')}</div><div class="cs-val">${meanR}<span>kcal</span></div><div class="cs-sub">${t('calib.overwindow')}</div></div>
      <div class="cstat"><div class="cs-lbl">${t('calib.trend')}</div><div class="cs-val">${fmtSigned(kgWk,'',2)}<span>kg/wk</span></div><div class="cs-sub">${t(roundTo(kgWk,2)<0?'calib.losing':roundTo(kgWk,2)>0?'calib.gaining':'calib.flat')}</div></div>
    </div>
    <div class="calib-meta">${tf('calib.meta',{w:'<b style="color:var(--brass-bright)">'+c.weighIns+'</b>', k:'<b style="color:var(--brass-bright)">'+c.kcalDays+'</b>', d:'<b style="color:var(--brass-bright)">'+c.spanDays+'</b>'})}</div>
    ${remark?`<div class="calib-need calib-remark">${remark}</div>`:''}
    ${r.enough?`<div class="calib-note">${t(shaky?'calib.shaky':'calib.steady')}</div>`:''}
    <button class="apply${settings.kcalTarget===target?' done':''}" id="applyBtn">${settings.kcalTarget===target?tf('calib.applied',{n:target}):tf('calib.apply',{n:target})}</button>`;
  $("applyBtn").onclick=applyTarget;
}
async function applyTarget(){ const rec=calRecommend().target; if(rec==null) return; settings.kcalTarget=rec; settings.kcalOwn=false; await persistSettings(); render(); }

function drawProg(){
  const wrap=$("progWrap"); wrap.innerHTML='';
  const plan=planKeys().map(exByKey).filter(Boolean), wk=entries.filter(e=>within7(e.date));
  if(!plan.length){ wrap.innerHTML=`<div class="restnote">${esc(t('prog.empty'))}</div>`; return; }
  plan.forEach(ex=>{
    const sess=entries.filter(e=>liftsOf(e,ex.key).length).map(e=>({date:e.date,sets:e.lifts[ex.key]}));
    const col=document.createElement('div'); col.className='pcol';
    let html=`<div class="pname">${esc(ex.name)}</div><div class="ptarget">${esc(exNote(ex))}</div>`;
    const cn=coachNext(ex, sess.map(s=>s.sets));
    const next=cn ? `<div class="pnext">${coachLine(ex,cn)}</div>` : '';
    if(!sess.length){
      html+=`<div class="plast" style="color:var(--ink-faint)">—<span class="pd">${esc(t('prog.notlogged'))}</span></div>`+next;
      col.innerHTML=html; wrap.appendChild(col); return;
    }
    const last=sess[sess.length-1];
    html+=`<div class="plast">${fmtSets(ex.key,last.sets)}<span class="pd">${esc(t('prog.last'))} · ${fmtDM(last.date)}</span></div>`;
    const recs=recordsLine(ex, recordsOf(ex, sess));
    if(recs) html+=`<div class="prec">${recs}</div>`;
    html+=next;
    const prior=sess.slice(0,-1).reverse().slice(0,3);
    if(prior.length) html+=`<div class="phist">`+prior.map(s=>`<div><span class="pdate">${fmtDM(s.date)}</span>${fmtSets(ex.key,s.sets)}</div>`).join('')+`</div>`;
    const sumOf=f=>wk.reduce((a,e)=>a+liftsOf(e,ex.key).reduce((b,x)=>b+f(x),0),0);
    const p7 = ex.unit==='sec' ? tf('prog.7time',{n:sumOf(x=>x.reps)})
             : ex.added ? tf('prog.7reps',{n:sumOf(x=>x.reps)})
             : tf('prog.7vol',{n:sumOf(x=>(x.kg||0)*x.reps).toLocaleString()});
    html+=`<div class="p7">${p7}</div>`;
    col.innerHTML=html; wrap.appendChild(col);
  });
}

const HIST_PAGE = 60;
let histShown = HIST_PAGE;
function drawHistory(){
  const body=$("histBody"), more=$("histMore");
  if(!entries.length){ $("histEmpty").style.display='block'; body.innerHTML=''; more.style.display='none'; return; }
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
  const rows=entries.slice(-histShown).reverse();
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
  const left=entries.length-rows.length;
  more.style.display=left ? '' : 'none';
  if(left) more.textContent=tn('hist.more',Math.min(HIST_PAGE,left));
}
let delArmed=null, delTimer=null;
async function removeEntry(date, btn){
  if(loadFailed){ flash(t('msg.loadfail.del'),true); return; }
  if(delArmed!==date){
    if(delTimer) clearTimeout(delTimer);
    document.querySelectorAll('.del').forEach(x=>{ x.textContent='✕'; x.style.color=''; });
    if(btn){ btn.textContent=t('msg.deleteq'); btn.style.color='var(--rust)'; }
    delArmed=date; delTimer=setTimeout(()=>{ delArmed=null; if(btn){ btn.textContent='✕'; btn.style.color=''; } },3000);
    return;
  }
  clearTimeout(delTimer); delArmed=null;
  entries=entries.filter(e=>e.date!==date);
  await persist(); fillForm($("fDate").value); render();
}

function readMeas(){
  const m={};
  MEAS.forEach(x=>{ const v=num($('f'+cap(x.key)).value); if(v!=null) m[x.key]=v; });
  return Object.keys(m).length?m:null;
}
function bfMode(){ const b=document.querySelector('#segBf button.on'); return b?b.dataset.b:'calc'; }
function bfCalcFor(cur){
  const h=(cur&&cur.height!=null)?cur.height:lastNumOf(e=>e.height);
  return bfNavy(cur?cur.meas:null, h, settings.sex);
}
function bfModeSet(m, seed){
  const manual = m==='manual';
  document.querySelectorAll('#segBf button').forEach(b=>b.classList.toggle('on', b.dataset.b===m));
  const row=$("bfManualRow"); if(row) row.style.display = manual ? '' : 'none';
  const cur=entries.find(e=>e.date===$("fDate").value);
  const calc=bfCalcFor(cur);
  const inp=$("fBf");
  if(inp && seed!==false){
    if(manual) inp.value = (cur && cur.bfSrc==='manual' && cur.bf!=null) ? cur.bf
                         : (calc!=null ? calc.toFixed(1) : '');
    else inp.value='';
  }
  const note=$("bfSrcNote");
  if(note) note.textContent = manual ? ''
    : (calc!=null ? tf('body.bf.calc',{n:calc.toFixed(1), girths:bfNeedsText()}) : tf('body.bf.none',{girths:bfNeedsText()}));
}

const bfNeeds = () => core.bfNeeds(settings.sex);
const bfNeedsText = () => { const n=bfNeeds().map(k=>t('m.'+k).toLowerCase()); return n.length>1 ? n.slice(0,-1).join(', ')+' and '+n[n.length-1] : (n[0]||''); };

function exportObject(extra){
  return Object.assign({app:'tally', version:4, exportedAt:new Date().toISOString(),
    entries, settings, exercises:customEx, plan:planObject(), stretches:stretches, exEdits:exEdits, cardio:cardios,
    theme:theme, gym:gym}, extra||{});
}
function exportPayload(){ return JSON.stringify(exportObject()); }
function doExport(){
  const box=$("exportBox");
  if(box.classList.contains('show')){ box.classList.remove('show'); return; }
  box.value = entries.length ? exportPayload() : t('sync.nothing');
  box.classList.add('show'); box.focus(); box.select();
}
function smsg(msg,err){ const m=$("syncMsg"); if(!m) return; m.textContent=msg||''; m.className='syncmsg'+(err?' err':''); }
function pickFile(){ smsg(''); $("importFile").click(); }
function onFilePicked(ev){
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
function saveBackupFile(){
  if(!entries.length){ smsg(t('sync.nothingyet'),true); return; }
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

function refreshManualTarget(){
  const cur=$("mtCurrent"), inp=$("manualKcal");
  if(cur) cur.textContent=tf('calib.current',{n:settings.kcalTarget})+(settings.kcalOwn?' · '+t('calib.yours'):'');
  if(inp) inp.placeholder=String(settings.kcalTarget);
}
function setManualTarget(){
  const v=num($("manualKcal").value);
  if(v==null||v<=0){ flash(t('msg.entertarget'),true); return; }
  settings.kcalTarget=Math.round(v); settings.kcalOwn=true;
  persistSettings(); $("manualKcal").value=''; render();
  flash(tf('msg.targetset',{n:settings.kcalTarget}));
}

function goalLabel(r){ return r>0?('+'+r+' kg/week'):r<0?('\u2212'+Math.abs(r)+' kg/week'):'maintain'; }
function periodLabel(p){ return p==='all'?'all logged days':(p+' days'); }
function weeklySlope(list){
  const p=list.filter(e=>e.weight!=null).map(e=>({t:dnum(e.date),w:e.weight}));
  if(p.length<2) return null;
  const n=p.length,tb=p.reduce((s,q)=>s+q.t,0)/n,wb=p.reduce((s,q)=>s+q.w,0)/n;
  let nu=0,de=0; p.forEach(q=>{nu+=(q.t-tb)*(q.w-wb);de+=(q.t-tb)**2;});
  return de>0?(nu/de)*7:null;
}
function buildAiReport(){
  const gen=localDate();
  const weighed=entries.filter(e=>e.weight!=null);
  const first=entries.length?entries[0].date:'n/a', last=entries.length?entries[entries.length-1].date:'n/a';
  const L=[];
  L.push('=== TRAINING REPORT FOR ANALYSIS ===');
  L.push('Generated: '+gen+'  |  Data span: '+first+' \u2192 '+last+'  |  '+entries.length+' entries');
  L.push('Ask: read the plan and selected goal, then assess how the recent weeks track against them. The raw JSON at the end is complete - use it for anything the summary omits.');
  L.push('');
  L.push('--- CURRENT PLAN & SELECTED GOAL ---');
  L.push('Selected goal (calibration): '+goalLabel(settings.calRate)+'   [options: \u22120.5 / \u22120.25 / maintain / +0.25 / +0.5]');
  L.push('Calibration window selected: '+periodLabel(settings.calPeriod));
  L.push('Chart window selected: '+periodLabel(chartPeriod));
  L.push('Calorie target currently set: '+settings.kcalTarget+' kcal/day'+(settings.kcalOwn?' (set by hand)':' (from the estimate or default)'));
  L.push('Protein target (daily): '+protTarget()+' g, '+(settings.protFloor!=null?'set by hand':'automatic for '+(settings.sex||'sex not set'))+'; anything from '+protOk()+' g counts as fine');
  L.push('');
  L.push('--- HOW THESE NUMBERS WERE DERIVED ---');
  L.push('All figures below are estimates from population formulas, not measurements. Not medical advice.');
  const bfMan=entries.filter(e=>e.bfSrc==='manual').length;
  L.push('Body fat: US Navy girth method (Hodgdon & Beckett), '+(settings.sex||'male')+' equation, from logged girths and height. Roughly +/-3-4 points against DEXA.'
    + (bfMan?(' NOTE: '+bfMan+' entr'+(bfMan===1?'y was':'ies were')+' entered by hand instead (scale, DEXA or calipers) and are not girth estimates.'):''));
  const pt=profileTDEE();
  if(pt) L.push('Starting energy estimate: Mifflin-St Jeor resting rate '+pt.bmr+' kcal (weight '+pt.weight.toFixed(1)+' kg, height '+pt.height+' cm, age '+pt.age+', '+(settings.sex||'male')+') x '+pt.mult+' activity = '+pt.tdee+' kcal.');
  L.push('Adaptive maintenance: least-squares weight trend over the window x 7700 kcal/kg, subtracted from mean logged intake. Short windows are distorted by water and glycogen.');
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
  if(cal.slope!=null) L.push('Trend, calibration window ('+periodLabel(settings.calPeriod)+'): '+fmtSigned(cal.slope*7,' kg/week',2));
  if(cal.tdee!=null){
    const rec=kcalTargetFor(cal.tdee);
    L.push('Estimated maintenance (TDEE, back-calculated): '+Math.round(cal.tdee/10)*10+' kcal');
    L.push('Mean intake logged (window): '+Math.round(cal.meanK)+' kcal');
    L.push('Recommended intake for the selected goal: '+rec+' kcal   (currently set: '+settings.kcalTarget+')');
  } else {
    L.push('Maintenance estimate: not enough overlapping weight+kcal in the selected window yet.');
  }
  L.push('');
  const wk=entries.filter(e=>within7(e.date));
  const pAll=entries.filter(e=>e.prot!=null);
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
    entries.filter(e=>e.mob).forEach(e=>Object.keys(e.mob).forEach(k=>{ per[k]=per[k]||{n:0,s:0}; per[k].n++; per[k].s+=e.mob[k]||0; }));
    L.push('Mobility by stretch (all logged): '+Object.keys(per).map(k=>{
      const st=stretchByKey(k), nm=st?st.name:k;
      const unit = per[k].s ? (sxIsReps(st) ? (' ('+per[k].s+' reps)') : (' ('+Math.round(per[k].s/60)+' min)')) : '';
      return nm+' \u00d7'+per[k].n+unit;
    }).join(' \u00b7 '));
  }
  L.push('');
  L.push('--- STRENGTH (latest logged session per movement) ---');
  const pk=planKeys();
  const logged=CATALOGUE.filter(ex=>entries.some(e=>liftsOf(e,ex.key).length))
    .sort((a,b)=>(pk.indexOf(a.key)<0?99:pk.indexOf(a.key))-(pk.indexOf(b.key)<0?99:pk.indexOf(b.key)));
  if(logged.length){ logged.forEach(ex=>{ const s=lastSessionOf(ex.key); const d=[...entries].reverse().find(e=>liftsOf(e,ex.key).length);
    L.push(ex.name+(pk.indexOf(ex.key)<0?' [off plan]':'')+': '+fmtSets(ex.key,s)+'  ('+(d?d.date:'?')+')'); }); }
  else L.push('No movements logged yet.');
  L.push('');
  L.push('--- BODY MEASUREMENTS (cm) ---');
  const measE=entries.filter(e=>e.meas);
  if(measE.length){
    const lm=measE[measE.length-1], fm=measE[0];
    L.push('Latest ('+lm.date+'): '+MEAS.map(m=>measName(m.key)+' '+(lm.meas[m.key]!=null?lm.meas[m.key]:'-')).join(' \u00b7 '));
    const dl=MEAS.map(m=>{ const a=fm.meas[m.key], b=lm.meas[m.key]; return (a!=null&&b!=null)?measName(m.key)+' '+fmtSigned(b-a,'',1):null; }).filter(Boolean);
    if(dl.length) L.push('Change since '+fm.date+': '+dl.join(' \u00b7 '));
    const bfE=entries.filter(e=>e.bf!=null);
    if(bfE.length) L.push('Body fat (Navy est, latest): '+bfE[bfE.length-1].bf.toFixed(1)+'%');
  } else L.push('No measurements logged.');
  L.push('');
  L.push('--- DATA QUALITY FLAGS ---');
  const flags=[];
  const fasts=entries.filter(e=>e.fast).map(e=>e.date+' ('+(e.kcal!=null?e.kcal+' kcal':'nothing logged, counted as 0')+')');
  if(fasts.length) L.push('Fasting days, marked by the user (real data, not errors): '+fasts.join(', '));
  L.push('Low-calorie days are taken as logged. A day with no food logged and no fasting mark is left out of averages, not counted as 0.');
  entries.forEach(e=>{ const w=weekdayKey(e.date); if(e.day&&e.day!==w) flags.push(e.date+': tagged \''+e.day+'\' but that date is '+w+' - counts toward the wrong weekly pattern'); });
  const dsince=d=>d?Math.round(dnum(gen)-dnum(d)):null;
  const lastW=weighed.length?weighed[weighed.length-1].date:null;
  const lastM=measE.length?measE[measE.length-1].date:null;
  if(lastW) flags.push('Weight last logged '+dsince(lastW)+' day(s) ago ('+lastW+')');
  if(lastM) flags.push('Measurements last logged '+dsince(lastM)+' day(s) ago ('+lastM+')'+(dsince(lastM)>14?' - stale':''));
  else flags.push('No measurements on record.');
  flags.forEach(f=>L.push('- '+f));
  L.push('');
  L.push('--- RAW DATA (JSON, complete, loss-less) ---');
  L.push(JSON.stringify(exportObject({selection:{chartPeriod:chartPeriod}})));
  L.push('');
  L.push('=== END REPORT ===');
  return L.join('\n');
}
function copyForAi(){
  if(!entries.length){ smsg(t('sync.noreport'),true); return; }
  const box=$("aiBox");
  const text=buildAiReport();
  box.value=text; box.classList.add('show'); box.focus(); box.select();
  const done=function(n){ smsg(tf('sync.reportready',{n:n})); };
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){done(text.length);}, function(){done(text.length);}); }
    else { try{ document.execCommand('copy'); }catch(e){} done(text.length); }
  }catch(e){ done(text.length); }
}

function doImport(){
  const box=$("importBox"), btn=$("loadBtn");
  const showing=box.classList.toggle('show');
  btn.classList.toggle('show', showing);
  if(showing){ box.value=''; box.focus(); }
}
let importArmed=false, importTimer=null;
function resetImportBtn(){ importArmed=false; if(importTimer) clearTimeout(importTimer); const b=$("loadBtn"); if(b) b.textContent=t('sync.load'); }
async function loadImport(){
  const raw=$("importBox").value.trim();
  if(!raw){ smsg(t('sync.noload'),true); return; }
  let data;
  try{ data=JSON.parse(raw); }
  catch(e){ resetImportBtn(); smsg(t('sync.notvalid'),true); return; }
  const list = Array.isArray(data) ? data : (data && Array.isArray(data.entries) ? data.entries : null);
  if(!list){ resetImportBtn(); smsg(t('sync.noentries'),true); return; }
  const incoming=normEntries(list);
  const btn=$("loadBtn");
  if(!importArmed){
    importArmed=true; if(btn) btn.textContent=tf('sync.tapreplace',{a:entries.length, b:incoming.length});
    smsg(tf('sync.readn',{n:incoming.length, seen:list.length, have:entries.length}));
    importTimer=setTimeout(()=>{ resetImportBtn(); smsg(t('sync.timedout')); },8000);
    return;
  }
  resetImportBtn();
  await saveUndo();
  await applyImport(Array.isArray(data) ? {entries:list} : data);
  $("importBox").classList.remove('show'); $("loadBtn").classList.remove('show'); $("exportBox").classList.remove('show');
  smsg(tn('sync.imported',entries.length));
  flash(tn('sync.imported',entries.length));
}
const isObj = x => !!x && typeof x==='object' && !Array.isArray(x);
async function applyImport(data){
  entries=normEntries(data.entries);
  if(Array.isArray(data.exercises)){
    const byKey=new Map(customEx.map(x=>[x.key,x]));
    data.exercises.forEach(x=>{ const c=normCustomEx(x); if(c) byKey.set(c.key,c); });
    customEx=[...byKey.values()];
    await persistCatalogue();
  }
  if(Array.isArray(data.stretches)){
    const byKey=new Map(stretches.map(s=>[s.key,s]));
    data.stretches.forEach(x=>{ const s=normStretch(x); if(s) byKey.set(s.key,s); });
    stretches=[...byKey.values()];
    await persistStretches();
  }
  if(isObj(data.exEdits)){ exEdits=Object.assign(exEdits, normExEdits(data.exEdits)); await persistExEdits(); }
  if(Array.isArray(data.cardio)){ const bk=new Map(cardios.map(c=>[c.key,c])); data.cardio.forEach(x=>{ const c=normCardio(x); if(c) bk.set(c.key,c); }); cardios=[...bk.values()]; await persistCardio(); }
  if(isObj(data.theme)){ theme=normTheme(data.theme); await persistTheme(); }
  if(isObj(data.gym)){ gym=normGym(data.gym); await persistGym(); }
  if(isObj(data.plan)){ planExtras=normPlan(data.plan); planSets=normPlanSets(data.plan.sets); planLogsInit(data.plan); await persistPlan(); }
  if(isObj(data.settings)){ settings=normSettings(data.settings); await persistSettings(); }
  await persist();
  fillForm($("fDate").value); render();
}

let undoSnap=null, undoArmed=false, undoTimer=null;
async function saveUndo(){
  undoSnap={at:localDate(), n:entries.length, data:exportObject()};
  try{ await STORE.set(UKEY, JSON.stringify(undoSnap)); }catch(e){ undoSnap=null; }
}
async function loadUndo(){
  try{
    const v=await STORE.get(UKEY), u=v ? JSON.parse(v) : null;
    undoSnap=(u && u.at===localDate() && u.data && Array.isArray(u.data.entries)) ? u : null;
    if(v && !undoSnap) await STORE.set(UKEY,'');
  }catch(e){ undoSnap=null; }
}
function drawUndo(){
  const b=$("undoBtn"); if(!b) return;
  b.style.display=undoSnap ? '' : 'none';
  if(undoSnap && !undoArmed) b.textContent=tn('sync.undo',undoSnap.n);
}
async function undoImport(){
  if(!undoSnap) return;
  if(!undoArmed){
    undoArmed=true; $("undoBtn").textContent=t('sync.undo.again');
    undoTimer=setTimeout(()=>{ undoArmed=false; drawUndo(); },4000);
    return;
  }
  clearTimeout(undoTimer); undoArmed=false;
  const snap=undoSnap; undoSnap=null;
  try{ await STORE.set(UKEY,''); }catch(e){}
  await applyImport(snap.data);
  drawUndo();
  smsg(tn('sync.undone',entries.length)); flash(tn('sync.undone',entries.length));
}

async function saveEntry(){
  const date=$("fDate").value;
  if(!date){ flash(t('msg.pickdate'),true); return; }
  if(loadFailed){ flash(t('msg.loadfail.save'),true); return; }
  const prev=entries.find(e=>e.date===date)||{};
  const fWeight=num($("fWeight").value), fHeight=num($("fHeight").value);
  calcSettle("fKcal"); calcSettle("fProt");
  const fkcal=calcVal($("fKcal").value), fprot=calcVal($("fProt").value);
  let meas=Object.assign({}, prev.meas||{}, readMeas()||{});
  if(!Object.keys(meas).length) meas=null;
  const height=fHeight!=null?fHeight:(prev.height ?? lastNumOf(e=>e.height));
  const fBf=num($("fBf").value);
  const bfNow=bfNavy(meas, height, settings.sex);
  const manualBf = (bfMode()==='manual' && fBf!=null && fBf>0 && fBf<70) ? fBf : null;
  const bf = manualBf!=null ? manualBf : (bfNow!=null ? bfNow : (prev.bf ?? null));
  const bfSrc = manualBf!=null ? 'manual' : (bfNow!=null ? null : (prev.bfSrc || null));
  const pick=(v,p)=>v!=null?v:(p ?? null);
  const lifts=readExForm();
  Object.keys(prev.lifts||{}).forEach(k=>{ if(!exByKey(k) && !(k in lifts)) lifts[k]=prev.lifts[k]; });
  const entry=normEntry(Object.assign({}, prev, {
    date, day:$("fDay").value,
    weight:pick(fWeight,prev.weight), height, bf, bfSrc,
    kcal:pick(fkcal,prev.kcal), prot:pick(fprot,prev.prot),
    meas, lifts
  }));
  const hasData = !!entry && (entry.fast||entry.weight!=null||entry.kcal!=null||entry.prot!=null||!!entry.mob||!!entry.cardio||!!entry.meas||Object.keys(entry.lifts).length>0);
  if(!hasData){ flash(t('msg.nothingtosave'),true); return; }
  const i=entries.findIndex(e=>e.date===date);
  if(i>=0) entries[i]=entry; else entries.push(entry);
  entries.sort((a,b)=>a.date.localeCompare(b.date));
  const ok=await persist(); render();
  if(ok){
    const rec=recordsNewOn(date);
    const pn = fprot==null ? '' : ' · '+tf(entry.prot>=protTarget() ? 'msg.prot.hit' : entry.prot>=protOk() ? 'msg.prot.ok' : 'msg.prot.low', {g:entry.prot});
    flash(t('msg.saved')+' · '+(rec || (fmtDMY(date)+(entry.bf!=null?(' · BF '+entry.bf.toFixed(1)+'%'):'')))+pn);
  }
  fillBody(date);
  if($("exportBox").classList.contains('show')) $("exportBox").value=exportPayload();
}
let flashTimer=null;
function flash(msg,err){
  const els=['savedMsg','savedMsg2'].map($).filter(Boolean);
  els.forEach(m=>{ m.textContent=msg; m.style.color=err?'var(--rust)':'var(--orange)'; m.classList.add('show'); });
  clearTimeout(flashTimer);
  flashTimer=setTimeout(()=>els.forEach(m=>m.classList.remove('show')),2400);
}


(async function(){
 try{
  const today=localDate();
  $("fDate").value=today;
  document.querySelectorAll('.field').forEach(f=>{
    const lab=f.querySelector('label'), inp=f.querySelector('input,select');
    if(lab && inp){ if(!inp.id) inp.id='in_'+Math.random().toString(36).slice(2,7); lab.htmlFor=inp.id; }
  });
  $("saveBtn").onclick=saveEntry;
  $("saveBtn2").onclick=saveEntry;
  $("exportBtn").onclick=doExport;
  $("importBtn").onclick=doImport;
  $("loadBtn").onclick=loadImport;
  $("fileBtn").onclick=pickFile;
  $("backupBtn").onclick=saveBackupFile;
  $("importFile").onchange=onFilePicked;
  $("aiBtn").onclick=copyForAi;
  $("setManualBtn").onclick=setManualTarget;
  $("setProtBtn").onclick=setProtManual;
  document.querySelectorAll('#segSex button').forEach(b=>b.onclick=()=>setSex(b.dataset.s));
  document.querySelectorAll('#segBf button').forEach(b=>b.onclick=()=>bfModeSet(b.dataset.b));
  $("fAge").onchange=setAge;
  ['fKcal','fProt'].forEach(id=>{
    $(id+'Add').onclick=()=>calcAdd(id);
    $(id).addEventListener('input',()=>calcHint(id));
    $(id).addEventListener('blur',()=>calcSettle(id));
  });
  $("resetThemeBtn").onclick=resetTheme;
  document.querySelectorAll('.chartseg button').forEach(b=>b.onclick=()=>setChartPeriod(b.dataset.p));
  $("dateBtn").onclick=dpOpen;
  $("dpPrev").onclick=()=>dpShift(-1);
  $("dpNext").onclick=()=>dpShift(1);
  $("dpCancel").onclick=dpClose;
  $("dpToday").onclick=()=>dpPick(localDate());
  $("dpWrap").onclick=ev=>{ if(ev.target===$("dpWrap")) dpClose(); };
  $("fDay").onchange=()=>buildExForm(entries.find(e=>e.date===$("fDate").value), $("fDay").value);
  document.querySelectorAll('#segPeriod button').forEach(b=>b.onclick=()=>{ settings.calPeriod=+b.dataset.p; persistSettings(); render(); });
  document.querySelectorAll('#segRate button').forEach(b=>b.onclick=()=>{ settings.calRate=+b.dataset.r; persistSettings(); render(); });
  document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>showPage(b.dataset.pg));
  $("dayPrev").onclick=()=>shiftDay(-1);
  $("dayNext").onclick=()=>shiftDay(1);
  $("dayToday").onclick=()=>{ $("fDate").value=localDate(); fillForm(localDate()); render(); };
  showPage('body');
  $("addMoveBtn").onclick=()=>{ shAddToDay=true; shOpen(); };
  $("addWorkoutBtn").onclick=()=>{ shAddToDay=false; shOpen(); shNew(); };
  $("collSearch").oninput=drawColl;
  $("shClose").onclick=shClose;
  $("shSearch").oninput=shRenderList;
  $("shNewBtn").onclick=shNew;
  $("shCancelNew").onclick=()=>{ shMsg(''); shResetDel(); shEditing=null; shShow('list'); };
  $("shCreate").onclick=shCreate;
  $("shDelete").onclick=shDelete;
  $("shManageBtn").onclick=()=>{ shManaging=!shManaging; shMsg(''); shShow('list'); };
  $("shWrap").onclick=ev=>{ if(ev.target===$("shWrap")) shClose(); };
  document.querySelectorAll('#shMode button').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#shMode button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
    shCoachSync();
  });
  document.querySelectorAll('#shGoal button').forEach(b=>b.onclick=()=>shGoalPick(b.dataset.g));
  ['shMin','shMax'].forEach(id=>$(id).addEventListener('input', shRangeTyped));
  $("shStep").addEventListener('input', shCoachSync);
  $("volLo").addEventListener('change', volBandSet);
  $("volHi").addEventListener('change', volBandSet);
  $("browseAll").onclick=()=>{ guideAll=!guideAll; drawGuide(); };
  $("browseEq").onchange=()=>{ guideEq=$("browseEq").value; drawGuide(); };
  $("gymAdd").onclick=gymAddOwn;
  $("bakNow").onclick=bakFromNudge;
  $("bakLater").onclick=()=>{ bakSnoozed=true; drawBackup(); };
  $("updCheck").onclick=updCheck;
  $("plGoal").oninput=()=>{ const v=num($("plGoal").value); plGoal=(v!=null && v>0) ? v : null; $("plOut").innerHTML=plResultHtml(settings.plates.unit, plBarOf()); const a=$("plUse"); if(a) a.onclick=()=>{ plGoal=+a.dataset.v; drawPlates(); }; };
  document.querySelectorAll('#plUnit button').forEach(b=>b.onclick=async()=>{ const P=settings.plates; if(P.unit===b.dataset.u) return;
    if(plGoal!=null) plGoal=Math.round((b.dataset.u==='lb' ? plGoal/LB : plGoal*LB)*2)/2; P.unit=b.dataset.u; await persistSettings(); drawPlates(); });
  let resizeW=window.innerWidth, resizeT=null;
  window.addEventListener('resize', ()=>{ clearTimeout(resizeT); resizeT=setTimeout(()=>{ if(window.innerWidth!==resizeW){ resizeW=window.innerWidth; render(); } }, 200); });
  $("sizeDown").onclick=()=>textScale(-1); $("sizeUp").onclick=()=>textScale(1); $("sizeReset").onclick=()=>textScale(0);
  $("fastBtn").onclick=toggleFast;
  $("abX").onclick=abClose; $("abOk").onclick=abClose; $("abNever").onclick=abNever;
  $("abWrap").onclick=ev=>{ if(ev.target===$("abWrap")) abClose(); };
  $("instNow").onclick=instGo; $("instBtn").onclick=instGo; $("instLater").onclick=instLater;
  $("histMore").onclick=()=>{ histShown+=HIST_PAGE; drawHistory(); };
  $("histBody").onclick=ev=>{ const b=ev.target.closest('.del'); if(b) removeEntry(b.dataset.d, b); };
  $("undoBtn").onclick=undoImport;
  $("restExactBtn").onclick=openExactSettings;
  $("mobWrap").onclick=ev=>{ const row=ev.target.closest('.mobrow'); if(!row) return; const k=row.dataset.k;
    if(ev.target.closest('.mobpin')) toggleLogPin('sx',k); else if(ev.target.closest('.mobtick')) toggleMob(k); else if(ev.target.closest('.mobgo')) startStretch(k); else if(ev.target.closest('.mobedit')) sxOpen(k); };
  $("mobWrap").onchange=ev=>{ const inp=ev.target.closest('.mobsec,.mobn'); if(inp) mobRowEdit(inp.closest('.mobrow')); };
  $("cdWrap").onclick=ev=>{ const row=ev.target.closest('.mobrow'); if(!row) return; const k=row.dataset.k;
    if(ev.target.closest('.mobpin')) toggleLogPin('cd',k); else if(ev.target.closest('.mobtick')) toggleCardio(k); else if(ev.target.closest('.mobgo')) startCardioTimer(k); else if(ev.target.closest('.mobedit')) cdOpen(k); };
  $("cdWrap").onchange=ev=>{ const inp=ev.target.closest('.mobsec,.mobn'); if(inp) cdRowEdit(inp.closest('.mobrow')); };
  $("collWrap").onclick=ev=>{ const b=ev.target.closest('[data-cedit],[data-cret]'); if(!b) return;
    if(b.dataset.cedit){ shAddToDay=false; shOpen(); shEdit(b.dataset.cedit); } else shRetire(b.dataset.cret); };
  $("shList").onclick=ev=>{ const b=ev.target.closest('button'); if(!b) return; const d=b.dataset;
    if(d.add) shPick(d.add,false); else if(d.pin) shPick(d.pin,true); else if(d.libadd) shLibPick(d.libadd,false); else if(d.libpin) shLibPick(d.libpin,true); else if(d.ret) shRetire(d.ret); else if(d.edit) shEdit(d.edit); };
  $("pg-guide").onclick=async ev=>{ const b=ev.target.closest('[data-add],[data-mute],[data-pick],[data-band],[data-mode],[data-sxadd],[data-cdadd],[data-sxmus]'); if(!b) return; const d=b.dataset;
    if(d.sxadd){ const k=await sxFromLib(d.sxadd); if(k){ render(); flash(tf('msg.libadded',{name:stretchByKey(k).name})); } return; }
    if(d.cdadd){ const k=await cdFromLib(d.cdadd); if(k){ render(); flash(tf('msg.libadded',{name:cardioByKey(k).name})); } return; }
    if(d.sxmus){ guideMus=d.sxmus; guideMode='x'; drawGuide(); const c=$("cardBrowse"); if(c) c.scrollIntoView({behavior:'smooth', block:'start'}); return; }
    if(d.add) guideAdd(d.add); else if(d.mute) volMuteToggle(d.mute); else if(d.band) volBandPick(d.band);
    else if(d.mode){ guideMode=d.mode; drawGuide(); }
    else { guideMus=d.pick; drawGuide(); if(b.classList.contains('volname')){ const c=$("cardBrowse"); if(c) c.scrollIntoView({behavior:'smooth', block:'start'}); } } };
  $("gymWrap").onclick=ev=>{ const b=ev.target.closest('[data-eq]'); if(b) gymToggle(b.dataset.eq); };
  $("gymOwn").onclick=ev=>{ const b=ev.target.closest('[data-gdel]'); if(b) gymDelOwn(b.dataset.gdel); };
  $("strPick").onclick=ev=>{ const b=ev.target.closest('.exchip'); if(b) toggleChartEx(b.dataset.k); };
  $("sxPick").onclick=ev=>{ const b=ev.target.closest('.exchip'); if(b) toggleLogChip('chartSx', b.dataset.k, sxAvail(), drawSxTrend, 'sxNote'); };
  $("cdPick").onclick=ev=>{ const b=ev.target.closest('.exchip'); if(b) toggleLogChip('chartCd', b.dataset.k, cdAvail(), drawCdTrend, 'cdNote'); };
  ['wChart','bodyChart','strChart','sxChart','cdChart'].forEach(chartScrubBind);
  document.querySelectorAll('.foldhead').forEach(h=>h.onclick=()=>chartFoldToggle(h.querySelector('.foldbtn').dataset.fold));
  $("sched").onclick=ev=>{ const el=ev.target.closest('.day'); if(!el) return;
    $("fDay").value=el.dataset.day; buildExForm(entries.find(e=>e.date===$("fDate").value), el.dataset.day); };
  $("dpGrid").onclick=ev=>{ const b=ev.target.closest('[data-d]'); if(b) dpPick(b.dataset.d); };
  const pressed=b=>b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false');
  document.querySelectorAll('.seg button').forEach(pressed);
  new MutationObserver(ms=>ms.forEach(m=>{
    if(m.type==='attributes'){ if(m.target.matches && m.target.matches('.seg button')) pressed(m.target); return; }
    m.addedNodes.forEach(n=>{ if(n.nodeType!==1) return; if(n.matches('.seg button')) pressed(n); n.querySelectorAll('.seg button').forEach(pressed); });
  })).observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['class']});
  $("gymName").addEventListener('keydown', e=>{ if(e.key==='Enter') gymAddOwn(); });
  document.querySelectorAll('#segRest button').forEach(b=>b.onclick=()=>setRestPreset(+b.dataset.s));
  document.querySelectorAll('#segLead button').forEach(b=>b.onclick=()=>setLeadPreset(+b.dataset.l));
  $("addStretchBtn").onclick=()=>kpOpen('sx');
  $("addCardioBtn").onclick=()=>kpOpen('cd');
  $("sxMus").onclick=ev=>{ const b=ev.target.closest('.mchip'); if(b) b.classList.toggle('on'); };
  $("kpX").onclick=kpClose; $("kpNew").onclick=kpNew;
  $("kpWrap").onclick=ev=>{ if(ev.target===$("kpWrap")) kpClose(); };
  $("kpSearch").oninput=kpRender;
  $("kpList").onclick=ev=>{ const b=ev.target.closest('button'); if(!b) return; const d=b.dataset;
    if(d.kadd) kpPick(d.kadd,false); else if(d.kpin) kpPick(d.kpin,true); else if(d.ladd) kpLibPick(d.ladd,false); else if(d.lpin) kpLibPick(d.lpin,true); };
  $("cdClose").onclick=cdClose;
  $("cdSave").onclick=cdSave;
  $("cdDelete").onclick=cdDelete;
  $("cdWrapSheet").onclick=ev=>{ if(ev.target===$("cdWrapSheet")) cdClose(); };
  document.querySelectorAll('#sxMode button').forEach(b=>b.onclick=()=>sxModeSet(b.dataset.m));
  $("sxClose").onclick=sxClose;
  $("sxSave").onclick=sxSave;
  $("sxDelete").onclick=sxDelete;
  $("sxWrap").onclick=ev=>{ if(ev.target===$("sxWrap")) sxClose(); };
  $("restStart").onclick=()=>startRest(null,null);
  $("restSnd").onclick=toggleRestSound;
  $("restPause").onclick=restPause;
  $("restStop").onclick=timerStop;
  $("restMinus").onclick=()=>restNudge(-15);
  $("restPlus").onclick=()=>restNudge(30);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) return; if(restTimer) timerTick(); drawExactNotice(); });
  document.addEventListener('keydown',ev=>{ if(ev.key==='Escape'){ abClose(); kpClose(); shClose(); sxClose(); cdClose(); dpClose(); } });
  await purgeOldNamespace();
  try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}
  await loadTheme();
  await loadCatalogue(); await loadExEdits(); await loadPlan(); await loadStretches(); await loadCardio(); await loadGym(); await loadBackupDate(); await loadUndo();
  await load(); await loadSettings();
  const rec=await recoverMovements(); await recoverStretches(); await recoverCardio();
  planLogsInit(planRaw); await persistPlan();
  if(rec) flash(tn('msg.rebuilt',rec));
  syncRestSegs(); drawExactNotice();
  applyLang();
  fillForm(today); render();
  $("abCard").innerHTML=aboutHtml();
  if(loadFailed) flash(t('msg.loadfail.read'),true);
  else abMaybeShow();
 }catch(err){
  console.error('init failed',err);
  const b=document.createElement('div');
  b.className='initfail';
  b.textContent='Startup failed: '+((err&&err.message)||err)+' — your saved data is untouched. Report this before logging anything.';
  if(document.body) document.body.insertBefore(b, document.body.firstChild);
 }
})();

// The Android app calls this when Back is pressed (see android/.../BackResult.java).
window.tallyBack = tallyBack;
