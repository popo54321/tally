// The welcome dialog and About card.
import { ABOUT_KEY } from '../store/schema';
import { STORE } from '../store/kv';
import { t } from '../i18n/index';
import { $ } from './dom';
import { dlgClose, dlgOpen } from './dialog';

export const aboutHtml = () => ['why','parts','logging','origin','gym','yours'].map(k=>`<section class="ab-sec${k==='parts'?' key':''}">${t('about.'+k)}</section>`).join('');
export function abOpen(){ $("abText").innerHTML=aboutHtml(); $("abText").scrollTop=0; dlgOpen("abWrap"); }
export function abClose(){ dlgClose("abWrap"); }
export async function abNever(){ try{ await STORE.set(ABOUT_KEY,'1'); }catch(e){} abClose(); }
export async function abMaybeShow(){ let seen=null; try{ seen=await STORE.get(ABOUT_KEY); }catch(e){} if(!seen) abOpen(); }
