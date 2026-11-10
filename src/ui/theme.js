// Fonts, colours and text size (Settings > Appearance).
import * as P from '../state/persist';
import { FONTS, HEXRE, TEXT_SCALES, THEME_PRESETS, THEME_VARS } from '../data/themes';
import { S } from '../state/app';
import { legibleFaint } from '../core/colour';
import { t, tf } from '../i18n/index';
import { $, esc, flash } from './dom';
import { colName } from './shared';
import { drawBody, drawCdTrend, drawStrength, drawSxTrend, drawWeight } from './charts';
import { render } from './nav';

export function activePreset(){
  const cur=S.theme.colors||{};
  const hit=THEME_PRESETS.find(p=>{
    const pk=Object.keys(p.colors), ck=Object.keys(cur);
    return pk.length===ck.length && pk.every(k=>cur[k]===p.colors[k]);
  });
  return hit?hit.key:null;
}
export const themeColor = v => S.theme.colors[v] || (THEME_VARS.find(x=>x.v===v)||{}).def;
export function applyTheme(){
  const root=document.documentElement;
  THEME_VARS.forEach(v=>{
    const c=S.theme.colors[v.v];
    if(c) root.style.setProperty(v.v, c); else root.style.removeProperty(v.v);
  });
  const f=FONTS.find(x=>x.key===S.theme.font)||FONTS[0];
  root.style.setProperty('--font-body', f.body);
  root.style.setProperty('--font-display', f.display);
  root.style.setProperty('--font-mono', f.mono);
  root.style.setProperty('--display-weight', f.displayWeight);
  root.style.setProperty('--display-spacing', f.displaySpacing);
  root.style.setProperty('--display-transform', f.displayTransform);
  root.style.setProperty('--txt-faint', legibleFaint(themeColor('--ink-faint'), themeColor('--ink'), [themeColor('--panel'), themeColor('--panel-2')]));
  root.style.zoom = S.theme.scale===1 ? '' : String(S.theme.scale);
  drawTextSize();
}
export function drawTextSize(){
  const v=$("sizeVal"); if(!v) return;
  const i=TEXT_SCALES.indexOf(S.theme.scale);
  v.textContent=Math.round(S.theme.scale*100)+'%';
  $("sizeDown").disabled = i<=0; $("sizeUp").disabled = i>=TEXT_SCALES.length-1; $("sizeReset").disabled = S.theme.scale===1;
}
export async function textScale(step){
  const cur=Math.max(0, TEXT_SCALES.indexOf(S.theme.scale)), i=step===0 ? TEXT_SCALES.indexOf(1) : Math.max(0, Math.min(TEXT_SCALES.length-1, (TEXT_SCALES.indexOf(S.theme.scale)<0 ? TEXT_SCALES.indexOf(1) : cur)+step));
  S.theme.scale=TEXT_SCALES[i]; await persistTheme(); render();
}
export async function loadTheme(){ await P.loadTheme(); applyTheme(); }
export async function persistTheme(){ applyTheme(); return P.saveTheme(); }
export async function setFont(k){
  if(!FONTS.some(f=>f.key===k)) return;
  S.theme.font=k; await persistTheme(); drawTheme();
}
export async function setThemeColor(v,c){
  if(!THEME_VARS.some(x=>x.v===v) || !HEXRE.test(c)) return;
  S.theme.colors[v]=c.toLowerCase(); await persistTheme(); drawTheme();
}
export function repaintCharts(){
  drawWeight(S.entries.filter(e=>e.weight!=null));
  drawStrength(); drawSxTrend(); drawCdTrend(); drawBody();
}
export async function applyPreset(k){
  const p=THEME_PRESETS.find(x=>x.key===k); if(!p) return;
  S.theme.colors={};
  Object.keys(p.colors).forEach(v=>{ if(THEME_VARS.some(x=>x.v===v)) S.theme.colors[v]=p.colors[v]; });
  await persistTheme(); drawTheme(); repaintCharts();
  flash(tf('msg.preset',{name:t('pre.'+p.key)}));
}
export async function resetTheme(){
  S.theme.colors={}; await persistTheme(); drawTheme(); repaintCharts();
  flash(t('msg.colreset'));
}
export function drawTheme(){
  const fs=$("segFont");
  if(fs){
    fs.innerHTML=FONTS.map(f=>`<button type="button" data-f="${f.key}"${f.key===S.theme.font?' class="on"':''}>${esc(t('font.'+f.key+'.name'))}</button>`).join('');
    fs.querySelectorAll('button').forEach(b=>b.onclick=()=>setFont(b.dataset.f));
  }
  const f=FONTS.find(x=>x.key===S.theme.font)||FONTS[0];
  const fn=$("fontNote"); if(fn) fn.innerHTML=`<b>${esc(t('font.'+f.key+'.name'))}</b> — ${esc(t('font.'+f.key+'.note'))}`;

  const ps=$("segPreset"), on=activePreset();
  if(ps){
    ps.innerHTML=THEME_PRESETS.map(p=>`<button type="button" data-p="${p.key}"${p.key===on?' class="on"':''}>${esc(t('pre.'+p.key))}</button>`).join('');
    ps.querySelectorAll('button').forEach(b=>b.onclick=()=>applyPreset(b.dataset.p));
  }
  const grid=$("colGrid");
  if(grid){
    const cur=v=>S.theme.colors[v] || (THEME_VARS.find(x=>x.v===v)||{}).def;
    grid.innerHTML=THEME_VARS.map(v=>
      `<label class="colrow"><input type="color" data-v="${v.v}" value="${cur(v.v)}">`
      +`<span class="colname">${esc(colName(v.v))}<i>${cur(v.v)}</i></span></label>`).join('');
    grid.querySelectorAll('input[type=color]').forEach(i=>{
      i.oninput=()=>{ document.documentElement.style.setProperty(i.dataset.v, i.value); i.parentNode.querySelector('.colname i').textContent=i.value; };
      i.onchange=async()=>{ await setThemeColor(i.dataset.v, i.value); repaintCharts(); };
    });
  }
}
