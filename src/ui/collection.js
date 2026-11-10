// Workout Collection card.
import { S } from '../state/app';
import { t, tf, tn } from '../i18n/index';
import { $, bwSplit, esc } from './dom';
import { DAYS, dayShort, exLv, exOrder, liftsOf, qMatch, sessionEx } from './shared';
import { loadDesc } from './movements';

export function drawColl(){
  const wrap=$("collWrap"); if(!wrap) return;
  const q=($("collSearch")?$("collSearch").value:'').trim().toLowerCase();
  const hit=ex=>!q || qMatch(q, ex.name+' '+ex.short+' '+ex.note);
  const pool=S.catalogue.filter(hit).sort(exOrder);
  const row=ex=>{
    const days=S.entries.filter(e=>liftsOf(e,ex.key).length).length;
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
