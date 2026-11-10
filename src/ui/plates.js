// Plate calculator card on the Workout page.
import { LB, PL_ALL, PL_BARS, PL_KG, PL_LB, plateKg, plateSolve } from '../core/plates';
import { S } from '../state/app';
import { V } from '../ui/view';
import { num } from '../core/numbers';
import { t, tf } from '../i18n/index';
import { $, esc } from './dom';
import { persistSettings } from './shared';

export const plBarOf = () => S.settings.plates.bar;
export const plBarKg = id => id==='own' ? (S.settings.plates.barOwn||0) : PL_BARS.find(b=>b.id===id).kg;
export const plFmt = (kg, unit) => { const v=unit==='lb' ? kg/LB : kg; return (Math.round(v*100)/100).toString(); };
export const plLabel = id => plFmt(plateKg(id), id.slice(0,2))+' '+id.slice(0,2);
export function drawPlates(){
  const P=S.settings.plates, card=$("cardPlates"); if(!card) return;
  const unit=P.unit, bar=plBarOf();
  const gi=$("plGoal"); if(document.activeElement!==gi) gi.value=V.plGoal==null ? '' : String(V.plGoal);
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
  const alt=$("plUse"); if(alt) alt.onclick=()=>{ V.plGoal=+alt.dataset.v; drawPlates(); };
}
export function plResultHtml(unit, bar){
  const P=S.settings.plates, other=unit==='kg' ? 'lb' : 'kg';
  if(V.plGoal==null || !(V.plGoal>0)) return `<div class="sxnote">${esc(t('pl.empty'))}</div>`;
  if(bar==='own' && S.settings.plates.barOwn==null) return `<div class="sxnote">${esc(t('pl.ownfirst'))}</div>`;
  const goalKg=unit==='lb' ? V.plGoal*LB : V.plGoal, barKg=plBarKg(bar);
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
    h+=`<div class="plalt"><span>${esc(tf('pl.notexact',{goal:V.plGoal+' '+unit}))}</span>`;
    if(r.alt){ const v=Math.round((unit==='lb' ? r.alt.totalKg/LB : r.alt.totalKg)*100)/100; h+=`<button type="button" class="plbtn" id="plUse" data-v="${v}">${esc(tf('pl.useup',{w:v+' '+unit}))}</button>`; }
    h+='</div>';
  }
  return h+'</div>';
}
export async function plSetBar(id){
  const P=S.settings.plates;
  P.bar=id;
  await persistSettings(); drawPlates();
}
export async function plToggle(id){
  const P=S.settings.plates, i=P.have.indexOf(id);
  if(i>=0) P.have.splice(i,1); else P.have=PL_ALL.filter(x=>x===id || P.have.indexOf(x)>=0);
  await persistSettings(); drawPlates();
}
