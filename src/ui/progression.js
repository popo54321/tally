// Lift Progression card.
import { S } from '../state/app';
import { coachNext, recordsOf } from '../core/strength';
import { exByKey } from '../state/persist';
import { fmtDM, within7 } from '../core/dates';
import { t, tf } from '../i18n/index';
import { $, esc } from './dom';
import { coachLine, exNote, fmtSets, liftsOf, planKeys, recordsLine } from './shared';

export function drawProg(){
  const wrap=$("progWrap"); wrap.innerHTML='';
  const plan=planKeys().map(exByKey).filter(Boolean), wk=S.entries.filter(e=>within7(e.date));
  if(!plan.length){ wrap.innerHTML=`<div class="restnote">${esc(t('prog.empty'))}</div>`; return; }
  plan.forEach(ex=>{
    const sess=S.entries.filter(e=>liftsOf(e,ex.key).length).map(e=>({date:e.date,sets:e.lifts[ex.key]}));
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
