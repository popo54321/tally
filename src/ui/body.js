// Body page: the day form (weight, food, girths, fasting), stat cards, calorie estimate, protein and profile.
import { profileTdee } from '../core/trend';
import { ACTIVITY, kcalOf, mifflinBMR, protOf } from '../core/nutrition';
import { MEAS } from '../data/measurements';
import { S } from '../state/app';
import { bfNavy } from '../core/body';
import { calcVal, fmtSigned, num, roundTo } from '../core/numbers';
import { exByKey } from '../state/persist';
import { fmtDM, fmtDMY, localDate, weekdayKey, within7 } from '../core/dates';
import { normEntry } from '../store/schema';
import { t, tf, tn } from '../i18n/index';
import { $, cap, esc, flash, fmtDelta, setDot } from './dom';
import { ACTIVITY_HELP, actHours, actName, actNote, bfNeedsText, calRecommend, dayEntry, deltaOf, effAge, kcalBand, kcalState, lastNumOf, persist, persistSettings, protAuto, protOk, protTarget, recordsNewOn } from './shared';
import { buildExForm, readExForm } from './workout-log';
import { drawCardio } from './cardio';
import { drawMob } from './mobility';
import { drawSched, render } from './nav';
import { exportPayload } from './sync';
import { setDateDisplay } from './datepicker';

export function calcHint(id){
  const el=$(id), out=$(id+'Sum'); if(!el||!out) return;
  const raw=el.value.trim(), v=calcVal(raw);
  out.textContent = (v!=null && /[+*/-]/.test(raw.slice(1))) ? '= '+v : '';
  calcLeft(id, raw ? calcVal(raw.replace(/[+*/-]+$/,'')) : 0);
}
// Under Energy and Protein: the day's target and what is left of it, updated as you type.
export function calcLeft(id, v){
  const out=$(id+'Left'); if(!out) return;
  const kcal=id==='fKcal', tgt=kcal ? S.settings.kcalTarget : protTarget(), unit=kcal ? ' kcal' : ' g';
  if(v==null){ out.textContent=''; return; }
  const left=Math.round(tgt-v), head=tf(kcal ? 'f.left.kcal' : 'f.left.prot',{n:tgt.toLocaleString()});
  const tail = left>0 ? tf('f.left.left',{n:left.toLocaleString()+unit}) : left===0 ? t('f.left.exact') : tf(kcal ? 'f.left.over' : 'f.left.done',{n:(-left).toLocaleString()+unit});
  out.className='calcleft'+(kcal && left<0 ? ' over' : '');
  out.innerHTML=esc(head)+' · <b>'+esc(tail)+'</b>';
}
export function calcSettle(id){
  const el=$(id); if(!el) return;
  const v=calcVal(el.value);
  if(v!=null && /[+*/-]/.test(el.value.trim().slice(1))) el.value=v;
  calcHint(id);
}
export function calcAdd(id){
  const el=$(id); if(!el) return;
  el.value = el.value.trim().replace(/[+*/-]$/,'') + '+';
  el.focus();
  try{ el.setSelectionRange(el.value.length, el.value.length); }catch(e){}
  calcHint(id);
}
export const profileTDEE = () => profileTdee(S.entries, S.settings);
export function drawBMR(){
  const out=$("bmrOut"); if(!out) return;
  const seg=$("segActivity");
  if(seg){
    seg.innerHTML=ACTIVITY.map(a=>`<button type="button" data-a="${a.key}"${a.key===S.settings.activity?' class="on"':''}>${esc(actName(a.key))}<i>${esc(actHours(a.key))}</i></button>`).join('');
    seg.querySelectorAll('button').forEach(b=>b.onclick=()=>setActivity(b.dataset.a));
  }
  const a=ACTIVITY.find(x=>x.key===S.settings.activity)||ACTIVITY[2];
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
  const drifted = S.settings.ageSet && S.settings.age!=null && p.age!==S.settings.age;
  out.innerHTML=`<div class="calib-line">${tf('bmr.line',{kcal:'<b>'+p.tdee+' kcal</b>'})}`
    +`<span class="calib-sub">${tf('bmr.sub',{bmr:p.bmr, mult:p.mult, act:esc(actName(p.act).toLowerCase()), age:p.age})}</span></div>`
    +`<div class="calib-meta">${tf('bmr.meta',{kg:p.weight.toFixed(1), cm:p.height, age:p.age})}`
    +(drifted?' '+tf('bmr.drift',{age:S.settings.age}):'')+`</div>`;
}
export async function setActivity(k){
  if(!ACTIVITY.some(a=>a.key===k)) return;
  S.settings.activity=k; await persistSettings(); render();
}
export async function setAge(){
  const v=parseInt($("fAge").value,10);
  if(isNaN(v)){ S.settings.age=null; S.settings.ageSet=null; }
  else if(v<10||v>120){ flash(t('msg.enterage'),true); return; }
  else { S.settings.age=v; S.settings.ageSet=localDate(); }
  await persistSettings(); render();
}
export function drawProtein(){
  const tg=protTarget(), ok=protOk(), own=S.settings.protFloor!=null;
  const out=$("protOut");
  if(out){
    const why = own ? tf('prot.why.own',{g:protAuto()}) : t(S.settings.sex ? 'prot.why.'+S.settings.sex : 'prot.why.unset');
    out.innerHTML=`<div class="calib-line">${tf('prot.aim',{g:'<b>'+tg+' g</b>'})}<span class="calib-sub">${esc(tf('prot.okfrom',{g:ok}))}</span></div>`
      +`<div class="calib-meta">${esc(why)}</div>`
      +`<div class="calib-meta">${esc(tf('prot.relax',{ok:ok}))}</div>`
      +(own ? `<button class="apply" id="protAutoBtn">${esc(tf('prot.useauto',{g:protAuto()}))}</button>` : '');
    const b=$("protAutoBtn"); if(b) b.onclick=protUseAuto;
  }
  const mp=$("mpCurrent"); if(mp) mp.textContent=t(own ? 'prot.byhand' : 'prot.auto');
  document.querySelectorAll('#segSex button').forEach(b=>b.classList.toggle('on', b.dataset.s===S.settings.sex));
  const bn=$("bfNote");
  if(bn) bn.textContent = t(S.settings.sex==='female' ? 'bf.female' : 'bf.male');
}
export async function protUseAuto(){
  S.settings.protFloor=null;
  await persistSettings(); render();
  flash(tf('msg.protauto',{n:protTarget()}));
}
export async function setProtManual(){
  const v=num($("manualProt").value);
  if(v==null||v<30||v>400){ flash(t('msg.enterfloor'),true); return; }
  S.settings.protFloor=Math.round(v);
  $("manualProt").value='';
  await persistSettings(); render();
  flash(tf('msg.floorset',{n:S.settings.protFloor}));
}
export async function setSex(sx){
  S.settings.sex = (sx==='female') ? 'female' : 'male';
  await persistSettings();
  let n=0;
  S.entries.forEach(e=>{
    if(!e.meas) return;
    if(e.bfSrc==='manual') return;
    const h=e.height!=null?e.height:lastNumOf(x=>x.height);
    const v=bfNavy(e.meas, h, S.settings.sex);
    if(v!=null && (e.bf==null || Math.abs(v-e.bf)>0.05)){ e.bf=v; n++; }
  });
  if(n) await persist();
  render();
  bfModeSet(bfMode(), false);
  flash(tf('msg.sexset',{sex:t('prof.'+S.settings.sex)})+(S.settings.protFloor==null?(' · '+tf('msg.protauto',{n:protTarget()})):'')+(n?(' · '+tn('msg.recalcd',n)):''));
}
export async function toggleFast(){
  const e=dayEntry(); if(!e) return;
  if(e.fast) delete e.fast; else e.fast=true;
  await persist(); render(); drawFast();
  flash(t(e.fast?'msg.fast.on':'msg.fast.off'));
}
export function drawFast(){
  const b=$("fastBtn"); if(!b) return;
  const cur=S.entries.find(e=>e.date===$("fDate").value), on=!!(cur && cur.fast);
  b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  b.textContent=t(on?'f.fast.on':'f.fast');
}
export function fillForm(date){
  drawSched();
  const f=fillBody(date);
  drawFast();
  buildExForm(f.cur, f.dayKey);
  drawMob(); drawCardio();
}
export function fillBody(date){
  setDateDisplay(date);
  const cur=S.entries.find(e=>e.date===date);
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
export function drawBodyStats(){
  const weighed=S.entries.filter(e=>e.weight!=null);
  const latestW=weighed.length?weighed[weighed.length-1]:null;
  if(latestW){
    $("wNow").innerHTML=latestW.weight.toFixed(1)+'<small>kg</small>';
    $("wDelta").innerHTML = fmtDelta(t('stat.d7'),deltaOf(e=>e.weight,7),'kg') + fmtDelta(t('stat.d30'),deltaOf(e=>e.weight,30),'kg');
  }
  const bfE=S.entries.filter(e=>e.bf!=null), lbf=bfE.length?bfE[bfE.length-1]:null;
  const bfSub=document.querySelector('#bfCard .sub-note');
  if(bfSub) bfSub.textContent=t(lbf && lbf.bfSrc==='manual' ? 'stat.bf.manual' : 'stat.bf.calc');
  if(lbf){
    $("bfNow").innerHTML=lbf.bf.toFixed(1)+'<small>%</small>';
    $("bfDelta").innerHTML = fmtDelta(t('stat.d7'),deltaOf(e=>e.bf,7),'%') + fmtDelta(t('stat.d30'),deltaOf(e=>e.bf,30),'%');
  }
  const wk7=S.entries.filter(e=>within7(e.date));
  const avg7=get=>{ const v=wk7.map(get).filter(x=>x!=null); return {avg:v.length ? Math.round(v.reduce((a,x)=>a+x,0)/v.length) : null, logged:v.length}; };
  const k7=avg7(kcalOf), p7=avg7(protOf), kcalAvg=k7.avg, protAvg=p7.avg;
  $("mKcal").textContent=kcalAvg!=null?kcalAvg+' kcal':'—';
  const kb=kcalBand(S.settings.kcalTarget), ks=kcalState(kcalAvg, S.settings.kcalTarget);
  $("mKcalTarget").textContent=tf(ks==='verylow' ? 'stat.targetlow' : 'stat.targetn',{n:S.settings.kcalTarget, lo:kb.lo, hi:kb.hi, min:kb.min, logged:k7.logged});
  const dk=$("dKcal"); if(dk){ dk.className='dot '+{ok:'ok', under:'mid', over:'bad', verylow:'bad', none:'no'}[ks]; dk.title=t('dot.kcal.'+ks); dk.setAttribute('aria-label', dk.title); }
  $("mProt").textContent=protAvg!=null?protAvg+' g':'—';
  const lp=$("lProt"); if(lp) lp.textContent=tf('stat.protavg',{target:protTarget(), ok:protOk()});
  setDot("dProt",protAvg==null?0:protAvg,protOk(),Math.round(protOk()*0.8));
  const dp=$("dProt"); if(dp){ dp.title=t(protAvg==null ? 'dot.prot.none' : 'dot.prot.'+dp.className.split(' ')[1]); dp.setAttribute('aria-label', dp.title); }
  $("mToday").textContent=S.entries.length?fmtDM(S.entries[S.entries.length-1].date):'—';
  calcHint('fKcal'); calcHint('fProt');
}
export function drawCalibration(){
  document.querySelectorAll('#segPeriod button').forEach(b=>b.classList.toggle('on', b.dataset.p===String(S.settings.calPeriod)));
  document.querySelectorAll('#segRate button').forEach(b=>b.classList.toggle('on', b.dataset.r===String(S.settings.calRate)));
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
  const tdeeR=Math.round(r.tdee/10)*10, meanR=Math.round(c.meanK), sdR=Math.max(30, Math.round(r.sd/10)*10);
  const basis=t(r.logShare>=0.9 ? 'calib.basis.logs' : r.logShare>=0.6 ? 'calib.basis.mostly' : 'calib.basis.formula');
  const bwNow=lastNumOf(e=>e.weight);
  const perKg = bwNow ? r.tdee/bwNow : null;
  const shaky = (perKg!=null && (perKg<16 || perKg>60)) || c.spanDays<21;
  const meta=v=>'<b style="color:var(--brass-bright)">'+v+'</b>';
  const remark = !r.enough ? tf('calib.early',{d:meta(c.spanDays), w:meta(c.weighIns), k:meta(c.kcalDays)})
               : r.partial ? tf('calib.partial',{d:meta(c.spanDays), p:meta(S.settings.calPeriod)}) : '';
  const goalLbl = S.settings.calRate!==0 ? tf('calib.for',{rate:(S.settings.calRate>0?'+':'−')+Math.abs(S.settings.calRate)+' kg/wk'}) : t('calib.tomaintain');
  out.innerHTML=`
    <div class="calib-grid">
      <div class="cstat head"><div class="cs-lbl">${t('calib.rec')}</div><div class="cs-val">${target}<span>kcal/day</span></div><div class="cs-sub">${goalLbl}${floored?' · '+t('calib.floored'):''}${r.partial?' · '+t('calib.partialtag'):''}</div></div>
      <div class="cstat"><div class="cs-lbl">${t('calib.est')}</div><div class="cs-val">${tdeeR}<span>±${sdR} kcal</span></div><div class="cs-sub">${esc(basis)}</div></div>
      <div class="cstat"><div class="cs-lbl">${t('calib.avg')}</div><div class="cs-val">${meanR}<span>kcal</span></div><div class="cs-sub">${t('calib.overwindow')}</div></div>
      <div class="cstat"><div class="cs-lbl">${t('calib.trend')}</div><div class="cs-val">${fmtSigned(kgWk,'',2)}<span>kg/wk</span></div><div class="cs-sub">${t(roundTo(kgWk,2)<0?'calib.losing':roundTo(kgWk,2)>0?'calib.gaining':'calib.flat')}</div></div>
    </div>
    <div class="calib-meta">${tf('calib.meta',{w:'<b style="color:var(--brass-bright)">'+c.weighIns+'</b>', k:'<b style="color:var(--brass-bright)">'+c.kcalDays+'</b>', d:'<b style="color:var(--brass-bright)">'+c.spanDays+'</b>'})}
      ${r.formula!=null && r.logShare<0.9 ? ' '+tf('calib.blend',{log:'<b style="color:var(--brass-bright)">'+Math.round(r.c.tdee/10)*10+'</b>', f:'<b style="color:var(--brass-bright)">'+r.formula+'</b>', pct:'<b style="color:var(--brass-bright)">'+Math.round(r.logShare*100)+'%</b>'}) : ''}
      ${r.formula==null ? ' '+t('calib.noformula') : ''} ${tf('calib.range',{sd:'<b style="color:var(--brass-bright)">±'+sdR+'</b>'})}</div>
    ${remark?`<div class="calib-need calib-remark">${remark}</div>`:''}
    ${r.enough?`<div class="calib-note">${t(shaky?'calib.shaky':'calib.steady')}</div>`:''}
    <button class="apply${S.settings.kcalTarget===target?' done':''}" id="applyBtn">${S.settings.kcalTarget===target?tf('calib.applied',{n:target}):tf('calib.apply',{n:target})}</button>`;
  $("applyBtn").onclick=applyTarget;
}
export async function applyTarget(){ const rec=calRecommend().target; if(rec==null) return; S.settings.kcalTarget=rec; S.settings.kcalOwn=false; await persistSettings(); render(); }
export function readMeas(){
  const m={};
  MEAS.forEach(x=>{ const v=num($('f'+cap(x.key)).value); if(v!=null) m[x.key]=v; });
  return Object.keys(m).length?m:null;
}
export function bfMode(){ const b=document.querySelector('#segBf button.on'); return b?b.dataset.b:'calc'; }
export function bfCalcFor(cur){
  const h=(cur&&cur.height!=null)?cur.height:lastNumOf(e=>e.height);
  return bfNavy(cur?cur.meas:null, h, S.settings.sex);
}
export function bfModeSet(m, seed){
  const manual = m==='manual';
  document.querySelectorAll('#segBf button').forEach(b=>b.classList.toggle('on', b.dataset.b===m));
  const row=$("bfManualRow"); if(row) row.style.display = manual ? '' : 'none';
  const cur=S.entries.find(e=>e.date===$("fDate").value);
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
export function refreshManualTarget(){
  const cur=$("mtCurrent"), inp=$("manualKcal");
  if(cur) cur.textContent=tf('calib.current',{n:S.settings.kcalTarget})+(S.settings.kcalOwn?' · '+t('calib.yours'):'');
  if(inp) inp.placeholder=String(S.settings.kcalTarget);
}
export function setManualTarget(){
  const v=num($("manualKcal").value);
  if(v==null||v<=0){ flash(t('msg.entertarget'),true); return; }
  S.settings.kcalTarget=Math.round(v); S.settings.kcalOwn=true;
  persistSettings(); $("manualKcal").value=''; render();
  flash(tf('msg.targetset',{n:S.settings.kcalTarget}));
}
export async function saveEntry(){
  const date=$("fDate").value;
  if(!date){ flash(t('msg.pickdate'),true); return; }
  if(S.loadFailed){ flash(t('msg.loadfail.save'),true); return; }
  const prev=S.entries.find(e=>e.date===date)||{};
  const fWeight=num($("fWeight").value), fHeight=num($("fHeight").value);
  calcSettle("fKcal"); calcSettle("fProt");
  const fkcal=calcVal($("fKcal").value), fprot=calcVal($("fProt").value);
  let meas=Object.assign({}, prev.meas||{}, readMeas()||{});
  if(!Object.keys(meas).length) meas=null;
  const height=fHeight!=null?fHeight:(prev.height ?? lastNumOf(e=>e.height));
  const fBf=num($("fBf").value);
  const bfNow=bfNavy(meas, height, S.settings.sex);
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
  const i=S.entries.findIndex(e=>e.date===date);
  if(i>=0) S.entries[i]=entry; else S.entries.push(entry);
  S.entries.sort((a,b)=>a.date.localeCompare(b.date));
  const ok=await persist(); render();
  if(ok){
    const rec=recordsNewOn(date);
    const pn = fprot==null ? '' : ' · '+tf(entry.prot>=protTarget() ? 'msg.prot.hit' : entry.prot>=protOk() ? 'msg.prot.ok' : 'msg.prot.low', {g:entry.prot});
    flash(t('msg.saved')+' · '+(rec || (fmtDMY(date)+(entry.bf!=null?(' · BF '+entry.bf.toFixed(1)+'%'):'')))+pn);
  }
  fillBody(date);
  if($("exportBox").classList.contains('show')) $("exportBox").value=exportPayload();
}
