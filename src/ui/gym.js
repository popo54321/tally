// My Gym page: equipment you have.
import { EQUIP_GROUPS } from '../data/equipment';
import { S } from '../state/app';
import { normGym } from '../store/schema';
import { t, tf, tn } from '../i18n/index';
import { $, esc } from './dom';
import { ALL_LIBS, byName, libAvailable, persistGym } from './shared';
import { render } from './nav';

export function drawGym(){
  const wrap=$("gymWrap"); if(!wrap) return;
  const item=q=>{
    const on=S.gym.have.indexOf(q)>=0, n=ALL_LIBS().filter(l=>l.eq.indexOf(q)>=0).length;
    return `<button type="button" class="gymitem${on?' on':''}" data-eq="${q}"><span class="box"></span>`
      + `<span>${esc(t('eq.'+q))}<span class="sub">${esc(tn('gym.uses',n))}</span></span></button>`;
  };
  wrap.innerHTML=EQUIP_GROUPS.map(g=>{
    const have=g.items.filter(q=>S.gym.have.indexOf(q)>=0).length;
    return `<div class="gymgrp">${esc(t('gym.grp.'+g.key))}<span>${esc(tf('gym.grp.have',{n:have, total:g.items.length}))}</span></div>`
      + `<div class="gymgrid">${g.items.slice().sort((a,b)=>byName(t('eq.'+a), t('eq.'+b))).map(item).join('')}</div>`;
  }).join('');
  $("gymCount").textContent = S.gym.set ? tf('gym.count',{n:ALL_LIBS().filter(l=>libAvailable(l, S.gym.have)).length, total:ALL_LIBS().length}) : t('gym.unset');
  $("gymOwn").innerHTML = S.gym.own.map(o=>`<div class="collrow"><div class="collname">${esc(o.name)}</div>`
    + `<button type="button" class="collbtn" data-gdel="${esc(o.key)}" aria-label="${esc(t('btn.remove'))}">✕</button></div>`).join('');

}
export async function gymToggle(q){
  const i=S.gym.have.indexOf(q);
  if(i>=0) S.gym.have.splice(i,1); else S.gym.have.push(q);
  S.gym.set=true; await persistGym(); render();
}
export async function gymAddOwn(){
  const el=$("gymName"), name=el.value.trim(); if(!name) return;
  S.gym=normGym({set:S.gym.set, have:S.gym.have, own:S.gym.own.concat([{name:name}])});
  el.value=''; await persistGym(); drawGym();
}
export async function gymDelOwn(k){ S.gym.own=S.gym.own.filter(o=>o.key!==k); await persistGym(); drawGym(); }
