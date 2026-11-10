// Guide page: weekly sets per muscle, browse by muscle, stretch and cardio libraries.
import { CD_LIB, LIB, SX_LIB, libByKey } from '../data/library';
import { EQUIP } from '../data/equipment';
import { MUSCLES, MUSCLE_KEYS, muscleGrp } from '../data/muscles';
import { S } from '../state/app';
import { V } from '../ui/view';
import { VOL_PRESETS, weekStart, weekState } from '../core/volume';
import { exByKey, rebuildCatalogue, stretchByKey } from '../state/persist';
import { localDate } from '../core/dates';
import { normCustomEx } from '../store/schema';
import { t, tf, tn } from '../i18n/index';
import { $, bwSplit, esc, lvTag } from './dom';
import { byName, cxKeyFor, fmtSetsN, groupName, libLive, libOrder, libOwned, libUsable, persistCatalogue, persistExEdits, persistSettings, weekVolume } from './shared';
import { cdOwned, sxOwned, sxSub } from './picker';
import { render } from './nav';
import { unhide } from './movements';

export function sxLibRow(l){
  const ok=libUsable(l), have=sxOwned(l);
  const eq=l.eq.length ? l.eq.map(q=>t('eq.'+q)).join(', ') : t('guide.noeq');
  const act=(have && !have.retired) ? `<span class="libin">${esc(t('guide.in.sx'))}</span>` : `<button type="button" class="collbtn" data-sxadd="${l.key}">${esc(t('guide.add'))}</button>`;
  return `<div class="librow${ok?'':' off'}"><div class="libname">${esc(t('sxlib.'+l.key))}${lvTag(l.lv)}`
    + `<span class="sub">${esc(l.mus.map(k=>t('mus.'+k)).join(', '))} · ${esc(sxSub(l))}<br>${esc(ok ? eq : tf('guide.needs',{list:eq}))}</span></div>${act}</div>`;
}
export function drawCdLib(){
  const wrap=$("cdLibWrap"); if(!wrap) return;
  const show=l=>V.guideAll || libUsable(l);
  const list=CD_LIB.slice().sort((a,b)=>(show(b)?1:0)-(show(a)?1:0) || byName(t('cdlib.'+a.key),t('cdlib.'+b.key)));
  wrap.innerHTML=list.map(l=>{
    const ok=libUsable(l), have=cdOwned(l), eq=l.eq.length ? l.eq.map(q=>t('eq.'+q)).join(', ') : t('guide.noeq');
    const act=(have && !have.retired) ? `<span class="libin">${esc(t('guide.in.sx'))}</span>` : `<button type="button" class="collbtn" data-cdadd="${l.key}">${esc(t('guide.add'))}</button>`;
    return `<div class="librow${ok?'':' off'}"><div class="libname">${esc(t('cdlib.'+l.key))}<span class="sub">${esc(tf('cd.target',{n:l.mins}))} · ${esc(ok ? eq : tf('guide.needs',{list:eq}))}</span></div>${act}</div>`;
  }).join('');
}
export function drawSxWeek(){
  const wrap=$("sxWeek"); if(!wrap) return;
  const start=weekStart(), today=localDate(), cnt={}, plain=new Set();
  MUSCLE_KEYS.forEach(k=>cnt[k]=0);
  S.entries.filter(e=>e.date>=start && e.date<=today && e.mob).forEach(e=>Object.keys(e.mob).forEach(k=>{
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
export function libRow(l){
  const ok=libUsable(l);
  const mus=l.p.map(k=>t('mus.'+k)).join(', ') + (l.s.length ? ' · '+tf('guide.also',{list:l.s.map(k=>t('mus.'+k)).join(', ')}) : '');
  const eq=l.eq.length ? l.eq.map(q=>t('eq.'+q)).join(', ') : t('guide.bodyweight');
  const act=libLive(l) ? `<span class="libin">${esc(t('guide.in'))}</span>`
                       : `<button type="button" class="collbtn" data-add="${l.key}">${esc(t('guide.add'))}</button>`;
  return `<div class="librow${ok?'':' off'}"><div class="libname">${esc(t('lib.'+l.key))}${lvTag(l.lv)}`
    + `<span class="sub">${esc(mus)}<br>${esc(ok ? eq : tf('guide.needs',{list:eq}))}</span></div>${act}</div>`;
}
export function drawGuide(){
  const wrap=$("volWrap"); if(!wrap) return;
  const lo=S.settings.volLo, hi=S.settings.volHi, mute=S.settings.volMute||[];
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
    : (S.entries.some(e=>e.date>=start && Object.keys(e.lifts||{}).length) ? '' : t('guide.novol'));

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

  if(!V.guideMus || MUSCLE_KEYS.indexOf(V.guideMus)<0) V.guideMus = low.length ? low[0].key : 'chest';
  $("browseMus").innerHTML=MUSCLES.map(m=>`<button type="button" class="mchip${m.key===V.guideMus?' on':''}" data-pick="${m.key}">${esc(t('mus.'+m.key))}</button>`).join('');
  const show=l=>V.guideAll || libUsable(l);
  const eqHit=l=>!V.guideEq || (V.guideEq==='none' ? !l.eq.length : l.eq.indexOf(V.guideEq)>=0);
  const prim=LIB.filter(l=>l.p.indexOf(V.guideMus)>=0 && show(l)), sec=LIB.filter(l=>l.s.indexOf(V.guideMus)>=0 && show(l));
  const sxs=SX_LIB.filter(l=>l.mus.indexOf(V.guideMus)>=0 && show(l));
  const pools={p:prim, s:sec, x:sxs}, pool=pools[V.guideMode]||prim;
  const list=pool.filter(eqHit).sort(V.guideMode==='x' ? (a,b)=>a.lv-b.lv || byName(t('sxlib.'+a.key),t('sxlib.'+b.key)) : libOrder);
  $("browseMode").innerHTML=['p','s','x'].map(m=>`<button type="button" class="${m===V.guideMode?'on':''}" data-mode="${m}">${esc(tf('guide.mode.'+m,{n:pools[m].filter(eqHit).length}))}</button>`).join('');
  const eqN=q=>pool.filter(l=>q==='none' ? !l.eq.length : l.eq.indexOf(q)>=0).length;
  const eqOpts=['none'].concat(EQUIP).filter(q=>q===V.guideEq || eqN(q)>0);
  $("browseEq").innerHTML=`<option value="">${esc(tf('guide.eq.any',{n:pool.length}))}</option>`
    + eqOpts.map(q=>`<option value="${q}"${q===V.guideEq?' selected':''}>${esc(tf('guide.eq.item',{name:t(q==='none'?'guide.eq.none':'eq.'+q), n:eqN(q)}))}</option>`).join('');
  $("browseEq").value=V.guideEq;
  const ab=$("browseAll"); ab.style.display=S.gym.set ? '' : 'none'; ab.textContent=t(V.guideAll ? 'guide.all.off' : 'guide.all.on');
  const mn=t('mus.'+V.guideMus);
  $("browseCount").textContent=tn(V.guideMode==='s' ? 'guide.count.s' : V.guideMode==='x' ? 'guide.count.x' : 'guide.count', list.length, {name:mn});
  $("browseWrap").innerHTML = list.length ? (V.guideMode==='x' ? list.map(sxLibRow).join('') : bwSplit(list, l=>l.lv, libRow, 'reclbl'))
    : `<div class="restnote">${esc(V.guideEq ? t('guide.none.eq') : tf(V.guideMode==='s' ? 'guide.none.s' : V.guideMode==='x' ? 'guide.none.x' : 'guide.none',{name:mn}))}</div>`;
  drawSxWeek(); drawCdLib();
}
export async function libToCollection(k){
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
  S.customEx.push(def);
  if(!await persistCatalogue()){ S.customEx.pop(); rebuildCatalogue(); return null; }
  return def.key;
}
export async function guideAdd(k){
  if(await libToCollection(k)) render();
}
export async function volMuteToggle(k){
  const m=S.settings.volMute||(S.settings.volMute=[]), i=m.indexOf(k);
  if(i>=0) m.splice(i,1); else m.push(k);
  await persistSettings(); render();
}
export async function volBandPick(v){
  const [lo,hi]=v.split('-').map(Number);
  S.settings.volLo=lo; S.settings.volHi=hi; await persistSettings(); render();
}
export async function volBandSet(){
  const lo=parseInt($("volLo").value,10), hi=parseInt($("volHi").value,10);
  if(!isNaN(lo) && !isNaN(hi) && lo>=0 && hi<=100 && lo<hi){ S.settings.volLo=lo; S.settings.volHi=hi; await persistSettings(); }
  render();
}
