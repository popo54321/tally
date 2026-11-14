// Every chart: weight, body size, strength, mobility and cardio trends, with tap and press-and-drag day picking.
import { BW_FALLBACK, exVolume, sessionMetric } from '../core/strength';
import { MEAS } from '../data/measurements';
import { S } from '../state/app';
import { V } from '../ui/view';
import { dnum, fmtDM, fmtDMY, fmtTick, weekdayKey, within7 } from '../core/dates';
import { exByKey, stretchByKey } from '../state/persist';
import { fmtSigned } from '../core/numbers';
import { kcalOf } from '../core/nutrition';
import { t, tf } from '../i18n/index';
import { trendWeights } from '../core/trend';
import { foldDraw, foldToggle } from './fold';
import { $, esc, flash } from './dom';
import { LINE_COLORS, MAX_SERIES, byName, cdName, cdSetsOf, dayShort, fmtSets, lastNumOf, liftsOf, measName, mobSetsOf, persistSettings, planKeys, sxIsReps, sxName, trained } from './shared';
import { render } from './nav';

export function chartWindowStart(){
  if(V.chartPeriod==='all' || !S.entries.length) return null;
  return dnum(S.entries[S.entries.length-1].date)-(V.chartPeriod-1);
}
export function inChartWin(dateStr){ const s=chartWindowStart(); return s===null || dnum(dateStr)>=s; }
export function windowSeries(series){
  const s=chartWindowStart();
  if(s===null) return series;
  return series.map(z=>Object.assign({},z,{points:z.points.filter(p=>dnum(p.date)>=s)}));
}
export function setChartPeriod(p){ V.chartPeriod=(p==='all')?'all':+p; syncChartSegs(); render(); }
export function syncChartSegs(){ document.querySelectorAll('.chartseg button').forEach(b=>b.classList.toggle('on', b.dataset.p===String(V.chartPeriod))); }
export function chartColors(){
  const cs=getComputedStyle(document.documentElement);
  const v=n=>cs.getPropertyValue(n).trim()||'#888';
  return {grid:v('--line-soft'), faint:v('--txt-faint'), avg:v('--brass'),
          line:v('--orange'), dot:v('--panel'), ink:v('--ink')};
}
export function chartSize(svg, baseH){
  const W=Math.max(170, Math.round(svg.clientWidth || (svg.parentNode && svg.parentNode.clientWidth) || 760));
  const H=Math.round(Math.max(170, Math.min(baseH, W*0.62)));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  return [W, H];
}
export function drawWeight(weighed){
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
export function drawMultiLine(svgId, series, opts){
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
export const CHART={}, CHART_DAY={}, CHART_DETAIL={};
export const fmtDay = ds => dayShort(weekdayKey(ds))+' '+fmtDMY(ds);
export const cdRow = (k, v, sub, col) => `<div class="cdrow"><span>${col?`<i style="background:${col}"></i>`:''}${esc(k)}</span><b>${esc(v)}${sub?`<small>${esc(sub)}</small>`:''}</b></div>`;
export function chartRecord(id, dates, xOf, y0, y1, extra){ CHART[id]=Object.assign({dates:dates||[], xOf:xOf, y0:y0, y1:y1}, extra||{}); chartPickDraw(id); }
export function chartPickDraw(id){
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
export const SCRUB={};
export function chartDayAt(id, ev){
  const st=CHART[id], svg=$(id); if(!st || !st.dates.length || !svg.getScreenCTM) return null;
  const pt=svg.createSVGPoint(); pt.x=ev.clientX; pt.y=ev.clientY;
  const x=pt.matrixTransform(svg.getScreenCTM().inverse()).x;
  let best=st.dates[0], bd=Infinity;
  st.dates.forEach(d=>{ const dd=Math.abs(st.xOf(d)-x); if(dd<bd){ bd=dd; best=d; } });
  return best;
}
export function chartScrubShow(id, d){
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
export function chartScrubEnd(id, keep){
  const svg=$(id), g=svg.querySelector('.chbub'), m=svg.querySelector('.chmark');
  if(g) g.remove(); if(m) m.classList.remove('live');
  if(keep && SCRUB[id]) CHART_DAY[id]=SCRUB[id];
  delete SCRUB[id]; chartPickDraw(id);
}
export function chartScrubBind(id){
  const svg=$(id);
  svg.addEventListener('pointerdown', ev=>{ const d=chartDayAt(id, ev); if(!d) return; SCRUB[id]=d; try{ svg.setPointerCapture(ev.pointerId); }catch(e){} chartScrubShow(id, d); });
  svg.addEventListener('pointermove', ev=>{ if(!(id in SCRUB)) return; const d=chartDayAt(id, ev); if(d && d!==SCRUB[id]){ SCRUB[id]=d; chartScrubShow(id, d); } });
  svg.addEventListener('pointerup', ()=>{ if(id in SCRUB) chartScrubEnd(id, true); });
  svg.addEventListener('pointercancel', ()=>{ if(id in SCRUB) chartScrubEnd(id, false); });
}
export const entryOn = d => S.entries.find(e=>e.date===d);
export function prevWith(d, get){ for(let i=S.entries.length-1;i>=0;i--){ const e=S.entries[i]; if(e.date<d && get(e)!=null) return e; } return null; }
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
export const logRows = (log, nameOf, fmtVal, sel) => Object.keys(log||{}).map(k=>({k, n:nameOf(k)})).sort((a,b)=>{
    const ia=sel.indexOf(a.k), ib=sel.indexOf(b.k); return (ia<0?99:ia)-(ib<0?99:ib) || byName(a.n,b.n);
  }).map(o=>{ const v=log[o.k], i=sel.indexOf(o.k); return cdRow(o.n, v ? fmtVal(o.k, v) : t('chart.d.done'), '', i>=0?LINE_COLORS[i%LINE_COLORS.length]:''); }).join('');
CHART_DETAIL.sxChart = d => { const e=entryOn(d); if(!e || !e.mob) return '';
  return logRows(e.mob, sxName, (k,v)=>{ const u=sxIsReps(stretchByKey(k)) ? t('unit.reps') : 's', n=mobSetsOf(e,k); return n>1 ? n+' × '+Math.round(v/n)+' '+u : v+' '+u; }, logSelection('chartSx', sxAvail())); };
CHART_DETAIL.cdChart = d => { const e=entryOn(d); return e && e.cardio ? logRows(e.cardio, cdName, (k,v)=>{ const n=cdSetsOf(e,k); return n>1 ? n+' × '+Math.round(v/n)+' '+t('unit.min') : v+' '+t('unit.min'); }, logSelection('chartCd', cdAvail())) : ''; };
export function exSessions(key){
  const bwFallback=lastNumOf(e=>e.weight)||BW_FALLBACK;
  return S.entries.filter(e=>liftsOf(e,key).length)
    .map(e=>({date:e.date, sets:e.lifts[key], bw:(e.weight!=null?e.weight:bwFallback)}))
    .sort((a,b)=>a.date.localeCompare(b.date));
}
export function buildStrengthSeries(keys){
  return keys.map(exByKey).filter(Boolean).map(ex=>{
    const sess=exSessions(ex.key);
    if(!sess.length) return {name:ex.short, points:[]};
    const base=exVolume(ex,sess[0].sets,sess[0].bw)||1;
    return {name:ex.short, points:sess.map(s=>({date:s.date, val:exVolume(ex,s.sets,s.bw)/base*100}))};
  });
}
export function buildAbsSeries(key){
  const ex=exByKey(key); if(!ex) return null;
  const sess=exSessions(key); if(!sess.length) return null;
  const m=sessionMetric(ex, sess[0].sets, sess[0].bw);
  return {ex, unit:m.unit, lbl:m.lbl,
    series:{name:ex.short, points:sess.map(s=>({date:s.date, val:sessionMetric(ex,s.sets,s.bw).val}))}};
}
const lastAt=k=>{ for(let i=S.entries.length-1;i>=0;i--) if(liftsOf(S.entries[i],k).length) return S.entries[i].date; return ''; };
export function chartCandidates(){
  const plan=planKeys();
  return S.catalogue.filter(ex=>S.entries.some(e=>inChartWin(e.date) && liftsOf(e,ex.key).length)).sort((a,b)=>{
    const pa=plan.indexOf(a.key), pb=plan.indexOf(b.key);
    if(pa>=0 && pb>=0) return pa-pb;
    if(pa>=0) return -1;
    if(pb>=0) return 1;
    return lastAt(b.key).localeCompare(lastAt(a.key));
  });
}
export function chartSelection(){
  const avail=chartCandidates().map(e=>e.key);
  const saved=S.settings.chartEx;
  if(saved==null) return avail.filter(k=>planKeys().indexOf(k)>=0).slice(0,MAX_SERIES);
  return saved.filter(k=>avail.indexOf(k)>=0).slice(0,MAX_SERIES);
}
export async function toggleChartEx(key){
  const sel=chartSelection();
  const all=S.settings.chartEx==null ? sel.slice() : S.settings.chartEx.slice(), i=all.indexOf(key);
  if(i>=0) all.splice(i,1);
  else if(sel.length>=MAX_SERIES){
    // Full: the selected movement trained longest ago makes way, and the new one takes its place (and colour).
    const out=sel.reduce((a,b)=>lastAt(b)<lastAt(a) ? b : a);
    all[all.indexOf(out)]=key;
    const ex=exByKey(out); if(ex) flash(tf('chart.swap',{name:ex.name}));
  }
  else all.push(key);
  S.settings.chartEx=all; await persistSettings(); drawStrength();
}
export function absSummary(a){
  const sess=exSessions(a.ex.key), last=sess[sess.length-1];
  const best=Math.max(...sess.map(s=>sessionMetric(a.ex,s.sets,s.bw).val));
  const wk=S.entries.filter(e=>within7(e.date) && liftsOf(e,a.ex.key).length);
  const bwFallback=lastNumOf(e=>e.weight)||BW_FALLBACK;
  const wkTot=wk.reduce((sum,e)=>sum+sessionMetric(a.ex,e.lifts[a.ex.key],(e.weight!=null?e.weight:bwFallback)).val,0);
  const u=a.unit==='kg'?' kg':a.unit==='sec'?' s':' reps';
  return `<b>${esc(t(a.lbl))}</b> · ${esc(tf('chart.abs',{unit:a.unit}))}<br>`+
    `${esc(t('prog.last'))} ${fmtDM(last.date)} · ${esc(fmtSets(a.ex.key,last.sets))} — ${esc(tf('chart.best',{n:Math.round(best).toLocaleString()+u}))} · ${esc(tf('chart.7day',{n:Math.round(wkTot).toLocaleString()+u}))}`;
}
export function drawStrength(){
  const avail=chartCandidates(), sel=chartSelection(), note=$("strNote"), pick=$("strPick");
  chartFoldDraw('str', S.entries.some(trained));
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
export function logAvail(field){
  const last={};
  S.entries.forEach(e=>{ if(inChartWin(e.date) && e[field]) Object.keys(e[field]).forEach(k=>{ last[k]=e.date; }); });
  return Object.keys(last).sort((a,b)=>last[b].localeCompare(last[a]));
}
export const sxAvail = () => logAvail('mob'), cdAvail = () => logAvail('cardio');
export function logSelection(setting, avail){
  const saved=S.settings[setting];
  return (saved==null ? avail : saved.filter(k=>avail.indexOf(k)>=0)).slice(0,MAX_SERIES);
}
export async function toggleLogChip(setting, key, avail, redraw, noteId){
  const sel=logSelection(setting, avail);
  const all=S.settings[setting]==null ? avail.slice(0,MAX_SERIES) : S.settings[setting].slice(), i=all.indexOf(key);
  if(i>=0) all.splice(i,1);
  else if(sel.length>=MAX_SERIES){
    // avail is newest first, so the selected one furthest down was done longest ago
    const out=sel.reduce((a,b)=>avail.indexOf(b)>avail.indexOf(a) ? b : a);
    all[all.indexOf(out)]=key;
    flash(tf('chart.swap',{name:(setting==='chartSx' ? sxName : cdName)(out)}));
  }
  else all.push(key);
  S.settings[setting]=all; await persistSettings(); redraw();
}
export function drawLogTrend(o){
  const avail=o.avail(), sel=logSelection(o.setting, avail);
  $(o.pick).innerHTML=avail.map(k=>{
    const i=sel.indexOf(k), on=i>=0;
    return `<button type="button" class="exchip${on?' on':''}" data-k="${esc(k)}" aria-pressed="${on}">`+
      `<i class="sw" style="background:${on?LINE_COLORS[i%LINE_COLORS.length]:'transparent'}"></i>${esc(o.name(k))}</button>`;
  }).join('');
  const series=sel.map((k,i)=>({name:o.name(k), color:LINE_COLORS[i%LINE_COLORS.length],
    points:S.entries.filter(e=>inChartWin(e.date) && e[o.field] && e[o.field][k]>0).map(e=>({date:e.date, val:e[o.field][k]}))}));
  drawMultiLine(o.svg, series, {legend:false, fmt:v=>v.toFixed(0), empty:t(!avail.length ? o.empty : !sel.length ? 'chart.empty.pick' : 'chart.empty.window')});
  $(o.note).textContent = !avail.length ? '' : !sel.length ? t('chart.nosel') : t(o.noteKey);
  chartFoldDraw(o.fold, S.entries.some(e=>e[o.field]));
}
export const drawSxTrend = () => drawLogTrend({field:'mob', setting:'chartSx', avail:sxAvail, name:sxName, pick:'sxPick', svg:'sxChart', note:'sxNote', fold:'sx', empty:'chart.empty.sx', noteKey:'chart.sxnote'});
export const drawCdTrend = () => drawLogTrend({field:'cardio', setting:'chartCd', avail:cdAvail, name:cdName, pick:'cdPick', svg:'cdChart', note:'cdNote', fold:'cd', empty:'chart.empty.cd', noteKey:'chart.cdnote'});
export function chartFoldDraw(k, hasAny){ foldDraw(k, (k in S.settings.chartFold) ? S.settings.chartFold[k] : !hasAny); }
export const chartFoldToggle = foldToggle;
export function buildBodySeries(){
  return MEAS.map(m=>{
    const pts=S.entries.filter(e=>e.meas && e.meas[m.key]!=null).map(e=>({date:e.date, cm:e.meas[m.key]})).sort((a,b)=>a.date.localeCompare(b.date));
    if(!pts.length) return {name:measName(m.key), points:[]};
    const base=pts[0].cm||1;
    const latest=pts[pts.length-1].cm;
    return {name:measName(m.key)+' '+latest.toFixed(1), points:pts.map(p=>({date:p.date, val:p.cm/base*100}))};
  });
}
export function drawBody(){ drawMultiLine('bodyChart', windowSeries(buildBodySeries()), {refLine:100, fmt:v=>v.toFixed(0), empty:t('chart.empty.size')}); }
