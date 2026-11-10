// Weekly review card.
import { MUSCLES, MUSCLE_KEYS } from '../data/muscles';
import { S } from '../state/app';
import { fmtSigned } from '../core/numbers';
import { kcalOf, protOf } from '../core/nutrition';
import { localDate } from '../core/dates';
import { recordsOf } from '../core/strength';
import { t, tf } from '../i18n/index';
import { weekStart, weekState } from '../core/volume';
import { weekTrendChange } from '../core/trend';
import { $, esc } from './dom';
import { DAYS, calRecommend, liftsOf, protOk, protTarget, recordsBeaten, sessionEx, sessionTarget, trained, weekVolume } from './shared';

export function drawReview(){
  const grid=$("revGrid"); if(!grid) return;
  const today=localDate(), start=weekStart(today), todayIdx=new Date(today+'T12:00:00').getDay();
  const wk=S.entries.filter(e=>e.date>=start && e.date<=today), ptg=protTarget(), pok=protOk(), tgt=S.settings.kcalTarget;
  const done=wk.filter(trained), planned=sessionTarget(), cr=calRecommend(), rec=cr.enough ? cr.target : null;
  const plannedSoFar=DAYS.filter((d,i)=>i<=todayIdx && sessionEx(d.key).length).length;
  const recs=[];
  S.catalogue.forEach(ex=>{
    const all=S.entries.map(e=>({date:e.date, sets:liftsOf(e,ex.key)})).filter(s=>s.sets.length);
    const before=all.filter(s=>s.date<start), inWk=all.filter(s=>s.date>=start);
    if(before.length && inWk.length && recordsBeaten(ex, recordsOf(ex,before), recordsOf(ex,inWk)).length) recs.push(ex.short||ex.name);
  });
  const wp=S.entries.filter(e=>e.weight!=null), dW=weekTrendChange(wp,start), wIn=wp.some(e=>e.date>=start);
  const kd=wk.filter(e=>kcalOf(e)!=null), pd=wk.filter(e=>protOf(e)!=null);
  const kAvg=kd.length ? Math.round(kd.reduce((a,e)=>a+kcalOf(e),0)/kd.length) : null;
  const pAvg=pd.length ? Math.round(pd.reduce((a,e)=>a+protOf(e),0)/pd.length) : null;
  const w=weekVolume(), mv=w.vol, mute=S.settings.volMute||[], lo=S.settings.volLo, hi=S.settings.volHi;
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
  else if(rec!=null && !S.settings.kcalOwn && Math.abs(rec-tgt)>=100) one=tf('rev.one.target',{rec:rec.toLocaleString(), target:tgt.toLocaleString()});
  else if(kd.length>=4 && Math.abs(kAvg-tgt)>tgt*0.1) one=tf(kAvg>tgt?'rev.one.over':'rev.one.under',{avg:kAvg.toLocaleString(), target:tgt.toLocaleString()});
  else if(gap) one=tf('rev.one.muscle',{name:t('mus.'+gap.key)});
  else one=t('rev.one.ok');
  $("revOne").innerHTML=`<b>${esc(t('rev.one.lbl'))}</b> · ${esc(one)}`;
}
