// Install banner, Install card and Version & Updates card.
import { V } from '../ui/view';
import { t, tf } from '../i18n/index';
import { $, flash } from './dom';
import { APP_VERSION } from './shared';
import { hasUpdater } from '../platform/update';
import { draw as drawSelfUpdate, selfUpdateCheck } from './selfupdate';

export const INST_SNOOZE='tally:instSnooze';
export const instIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
export const instDone = () => !!window.AndroidFile || location.protocol==='file:' || navigator.standalone===true
  || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches);
export function instSnoozed(){ try{ const v=+localStorage.getItem(INST_SNOOZE); return !!v && Date.now()-v<30*864e5; }catch(e){ return false; } }
export function drawInstall(){
  const done=instDone(), can=!done && (!!V.instPrompt || instIOS);
  const nudge=$("instNudge");
  if(nudge){
    nudge.style.display = (can && !instSnoozed()) ? '' : 'none';
    $("instText").textContent = t(instIOS ? 'inst.nudge.ios' : 'inst.nudge');
    $("instNow").style.display = V.instPrompt ? '' : 'none';
  }
  const card=$("cardInstall");
  if(card){
    card.style.display = done ? 'none' : '';
    $("instHow").textContent = t(instIOS ? 'inst.ios' : V.instPrompt ? 'inst.android' : 'inst.manual');
    $("instBtn").style.display = V.instPrompt ? '' : 'none';
  }
}
export async function instGo(){
  if(!V.instPrompt) return;
  const p=V.instPrompt; V.instPrompt=null;
  p.prompt();
  try{ await p.userChoice; }catch(e){}
  drawInstall();
}
export function drawUpdate(){
  const android=!!window.AndroidFile, self=hasUpdater();
  $("updNow").textContent=tf('upd.now',{v:APP_VERSION});
  $("updHow").textContent=t(self ? 'upd.android' : android ? 'upd.android.manual' : 'upd.web');
  $("updGet").style.display = android && !self ? '' : 'none';
  $("updCheck").style.display = android && !self ? 'none' : '';
  if(self) drawSelfUpdate();
}
export const updMsg = m => { $("updMsg").textContent=m||''; };
export async function updCheck(){
  if(hasUpdater()){ selfUpdateCheck(); return; }
  const sw=navigator.serviceWorker;
  const reg=sw ? await sw.getRegistration().catch(()=>null) : null;
  if(!reg){ location.reload(); return; }
  updMsg(t('upd.checking'));
  let found=false;
  sw.addEventListener('controllerchange', ()=>{ found=true; updMsg(t('upd.found')); setTimeout(()=>location.reload(), 600); }, {once:true});
  try{ await reg.update(); }
  catch(e){ updMsg(t('upd.offline')); return; }
  setTimeout(()=>{ if(!found && !reg.installing && !reg.waiting) updMsg(t('upd.latest')); }, 4000);
}
export function instLater(){ try{ localStorage.setItem(INST_SNOOZE, String(Date.now())); }catch(e){} drawInstall(); }
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); V.instPrompt=e; drawInstall(); });
window.addEventListener('appinstalled', ()=>{ V.instPrompt=null; drawInstall(); flash(t('inst.done')); });
