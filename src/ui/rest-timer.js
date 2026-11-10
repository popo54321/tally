// The rest timer and stretch hold timer.
import { DEF_REST } from '../store/schema';
import { S } from '../state/app';
import { V } from '../ui/view';
import { num } from '../core/numbers';
import { stretchByKey } from '../state/persist';
import { t, tf } from '../i18n/index';
import { $, flash } from './dom';
import { alarmCancel, scheduleAlarm, exactAlarmsOff } from '../platform/alarm';
import { cdSetAdd } from './cardio';
import { mobSetAdd } from './mobility';
import { persistSettings, sxIsReps } from './shared';

// Only when the Beep setting is on; the label defaults to the rest wording.
function alarmSet(secs, label){ if(S.settings.restSound) scheduleAlarm(secs, label||t('rest.alarm.rest')); }
export function restRemaining(endAt, now){ return (endAt==null) ? 0 : Math.max(0, Math.round((endAt-now)/1000)); }
export function fmtClock(s){ return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'); }
export function drawExactNotice(){ const el=$("restExact"); if(el) el.style.display=(S.settings.restSound && exactAlarmsOff()) ? '' : 'none'; }
export function audioWake(){
  try{ const AC=window.AudioContext||window.webkitAudioContext;
    if(AC && S.settings.restSound){ if(!V.audioCtx) V.audioCtx=new AC(); if(V.audioCtx.state==='suspended') V.audioCtx.resume(); } }catch(e){}
}
export function beep(n, freq){
  if(!S.settings.restSound) return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    if(!V.audioCtx) V.audioCtx=new AC();
    if(V.audioCtx.state==='suspended') V.audioCtx.resume();
    const t0=V.audioCtx.currentTime+0.06;
    for(let i=0;i<(n||3);i++){
      const o=V.audioCtx.createOscillator(), g=V.audioCtx.createGain(), at=t0+i*0.30;
      o.type='square'; o.frequency.value=freq||1760;
      g.gain.setValueAtTime(0.0001,at);
      g.gain.exponentialRampToValueAtTime(0.9,at+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001,at+0.20);
      o.connect(g); g.connect(V.audioCtx.destination); o.start(at); o.stop(at+0.22);
    }
  }catch(e){}
}
export function timerStart(o){
  const lead=Math.max(0, o.lead||0), hold=Math.max(1, Math.round(o.hold||0));
  V.tmr={ kind:o.kind, key:o.key||null, label:o.label||'', lead:lead, hold:hold,
        phase: lead>0 ? 'lead' : 'hold',
        total: lead>0 ? lead : hold,
        endAt: Date.now() + (lead>0?lead:hold)*1000,
        leftPaused:null, doneAt:null };
  $("restPause").textContent=t('rest.pause');
  $("restBar").classList.remove('done');
  $("restBar").classList.add('show');
  document.body.classList.add('resting');
  audioWake();
  V.tmr.alarmLabel = (o.kind==='stretch') ? tf('rest.alarm.stretch',{name:V.tmr.label})
                 : (o.kind==='cardio')  ? tf('rest.alarm.cardio',{name:V.tmr.label})
                 : t('rest.alarm.rest');
  alarmSet(lead+hold, V.tmr.alarmLabel);
  if(V.restTimer) clearInterval(V.restTimer);
  V.restTimer=setInterval(timerTick,250);
  timerTick();
}
export function timerTick(){
  if(!V.tmr) return;
  const now=Date.now();
  if(V.tmr.doneAt!=null){ if(now-V.tmr.doneAt>10000) timerStop(); return; }
  const left=(V.tmr.leftPaused!=null)?V.tmr.leftPaused:restRemaining(V.tmr.endAt,now);
  $("restNum").textContent=fmtClock(left);
  $("restWho").textContent = V.tmr.phase==='lead' ? (t('rest.getready')+' · '+V.tmr.label) : V.tmr.label;
  $("restFill").style.width=(V.tmr.total>0?Math.max(0,Math.min(100,left/V.tmr.total*100)):0)+'%';
  $("restBar").classList.toggle('lead', V.tmr.phase==='lead');
  if(V.tmr.leftPaused==null && left<=0){
    if(V.tmr.phase==='lead'){
      V.tmr.phase='hold'; V.tmr.total=V.tmr.hold; V.tmr.endAt=Date.now()+V.tmr.hold*1000;
      beep(1,1320);
      timerTick();
    } else timerFinish();
  }
}
export function timerFinish(){
  const z=V.tmr;
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
export function timerStop(){
  if(V.restTimer){ clearInterval(V.restTimer); V.restTimer=null; }
  alarmCancel();
  V.tmr=null;
  $("restBar").classList.remove('show'); $("restBar").classList.remove('done'); $("restBar").classList.remove('lead');
  document.body.classList.remove('resting');
}
export function restPause(){
  if(!V.tmr || V.tmr.doneAt!=null) return;
  if(V.tmr.leftPaused!=null){
    V.tmr.endAt=Date.now()+V.tmr.leftPaused*1000; V.tmr.leftPaused=null; $("restPause").textContent=t('rest.pause');
    alarmSet(restRemaining(V.tmr.endAt,Date.now())+(V.tmr.phase==='lead'?V.tmr.hold:0), V.tmr.alarmLabel);
  }else{
    V.tmr.leftPaused=restRemaining(V.tmr.endAt,Date.now()); V.tmr.endAt=null; $("restPause").textContent=t('rest.resume');
    alarmCancel();
  }
  timerTick();
}
export function restNudge(sec){
  if(!V.tmr || V.tmr.doneAt!=null) return;
  if(V.tmr.leftPaused!=null) V.tmr.leftPaused=Math.max(0,V.tmr.leftPaused+sec);
  else if(V.tmr.endAt!=null) V.tmr.endAt=Math.max(Date.now(), V.tmr.endAt+sec*1000);
  else return;
  const left=(V.tmr.leftPaused!=null)?V.tmr.leftPaused:restRemaining(V.tmr.endAt,Date.now());
  if(left>V.tmr.total) V.tmr.total=left;
  if(V.tmr.phase==='hold') V.tmr.hold=Math.max(V.tmr.hold,left);
  if(V.tmr.leftPaused==null) alarmSet(left+(V.tmr.phase==='lead'?V.tmr.hold:0), V.tmr.alarmLabel);
  timerTick();
}
export function restLen(){
  const c=$("restCustom")?num($("restCustom").value):null;
  if(c!=null && c>=10 && c<=900) return Math.round(c);
  return S.settings.restSec||DEF_REST;
}
export function startRest(secs, who){
  const s=(secs!=null && secs>0) ? Math.round(secs) : restLen();
  if(s!==S.settings.restSec && s>=10 && s<=900){ S.settings.restSec=s; syncRestSegs(); persistSettings(); }
  timerStart({kind:'rest', label: who?(t('rest.rest')+' · '+who):t('rest.rest'), hold:s, lead:0});
}
export function startStretch(key){
  const s=stretchByKey(key);
  if(!s || sxIsReps(s) || !s.secs){ flash(t('msg.needhold')); return; }
  timerStart({kind:'stretch', key:key, label:s.name, hold:s.secs, lead:S.settings.mobLead||0});
}
export function syncRestSegs(){
  document.querySelectorAll('#segRest button').forEach(b=>b.classList.toggle('on', +b.dataset.s===S.settings.restSec));
  document.querySelectorAll('#segLead button').forEach(b=>b.classList.toggle('on', +b.dataset.l===(S.settings.mobLead||0)));
  const b=$("restSnd"); if(b){ b.classList.toggle('on', !!S.settings.restSound); b.textContent=t(S.settings.restSound?'rest.beep':'rest.silent'); }
}
export async function setRestPreset(s){ S.settings.restSec=s; $("restCustom").value=''; syncRestSegs(); await persistSettings(); }
export async function setLeadPreset(s){ S.settings.mobLead=s; syncRestSegs(); await persistSettings(); }
export async function toggleRestSound(){
  S.settings.restSound=!S.settings.restSound;
  syncRestSegs(); await persistSettings(); drawExactNotice();
  if(!S.settings.restSound) alarmCancel();
  else if(V.tmr && V.tmr.doneAt==null && V.tmr.leftPaused==null){
    alarmSet(restRemaining(V.tmr.endAt,Date.now())+(V.tmr.phase==='lead'?V.tmr.hold:0), V.tmr.alarmLabel);
  }
  if(S.settings.restSound){ audioWake(); beep(1); }
}
