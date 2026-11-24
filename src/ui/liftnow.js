// "Today so far: 4,646 kg lifted · 11 sets · ≈ a hippo" above Save entry on the Workout Sets card, updated as
// you type. Counts every set with reps in the form: kg × reps, plus body weight for bodyweight movements;
// holds in seconds count as sets only. Just for the good feeling.
import { S } from '../state/app';
import { exByKey } from '../state/persist';
import { BW_FALLBACK, exVolume } from '../core/strength';
import { localDate } from '../core/dates';
import { num } from '../core/numbers';
import { t, tn } from '../i18n/index';
import { $, esc } from './dom';
import { lastNumOf } from './shared';
import { readExForm } from './workout-log';

/** Things to compare with, heaviest first (kg). */
const THINGS = [['whale', 150000], ['lorry', 40000], ['bus', 12000], ['elephant', 6000], ['hippo', 2500], ['car', 1200],
  ['piano', 450], ['motorbike', 200], ['fridge', 70], ['cement', 25]];

/** '≈ a hippo', '≈ 3 small cars', or '' under 25 kg. */
export function compareTo(kg){
  const hit=THINGS.find(([, w])=>kg>=w); if(!hit) return '';
  const x=kg/hit[1], n=x<10 ? Math.round(x*2)/2 : Math.round(x);
  return tn('lift.obj.'+hit[0], n, {n:n.toLocaleString()});
}
/** Total kg and sets for these lifts on a day with this body weight. */
export function liftedOf(lifts, bw){
  let kg=0, n=0;
  Object.keys(lifts||{}).forEach(k=>{ const ex=exByKey(k), sets=(lifts[k]||[]).filter(s=>s && s.reps>0); if(!ex || !sets.length) return;
    n+=sets.length; if(ex.unit!=='sec') kg+=exVolume(ex, sets, bw); });
  return {kg:Math.round(kg), n};
}
const dayWeight = date => { const typed=num(($("fWeight")||{}).value), e=S.entries.find(x=>x.date===date);
  return typed || (e && e.weight) || lastNumOf(x=>x.weight) || BW_FALLBACK; };

export function drawLiftNow(){
  const box=$("liftNow"); if(!box) return;
  const date=$("fDate").value, {kg, n}=liftedOf(readExForm(), dayWeight(date));
  if(!n){ box.innerHTML=''; return; }
  const cmp=compareTo(kg);
  box.innerHTML=tn(date===localDate() ? 'lift.now.today' : 'lift.now.day', n, {kg:kg.toLocaleString()})+(cmp ? ' · '+esc(cmp) : '');
}
/** For the message after Save entry: '4,646 kg lifted', or ''. */
export function liftedMsg(lifts, date){ const {kg}=liftedOf(lifts, dayWeight(date)); return kg>0 ? t('lift.saved').replace('{kg}', kg.toLocaleString()) : ''; }

export function initLiftNow(){
  const wrap=$("exWrap"); if(!wrap) return;
  let queued=false;
  const later=()=>{ if(queued) return; queued=true; requestAnimationFrame(()=>{ queued=false; drawLiftNow(); }); };
  wrap.addEventListener('input', later);
  // sets and movements added or removed, or the form rebuilt for another day or session
  new MutationObserver(later).observe(wrap, {childList:true, subtree:true});
  const w=$("fWeight"); if(w) w.addEventListener('input', later);
}
