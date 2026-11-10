// The date picker dialog.
import { V } from '../ui/view';
import { fmtDMY, localDate } from '../core/dates';
import { t } from '../i18n/index';
import { $, esc } from './dom';
import { DAYS, dayShort } from './shared';
import { dlgClose, dlgOpen } from './dialog';
import { fillForm } from './body';

export const DP_MONTH=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
export function setDateDisplay(ds){ const b=$("dateBtn"); if(b) b.textContent=fmtDMY(ds); }
export function dpOpen(){
  const d=new Date(($("fDate").value||localDate())+'T12:00:00');
  V.dpY=d.getFullYear(); V.dpM=d.getMonth();
  dpRender(); dlgOpen("dpWrap");
}
export function dpClose(){ dlgClose("dpWrap"); }
export function dpShift(n){ V.dpM+=n; if(V.dpM<0){V.dpM=11;V.dpY--;} else if(V.dpM>11){V.dpM=0;V.dpY++;} dpRender(); }
export function dpPick(ds){ $("fDate").value=ds; dpClose(); fillForm(ds); }
export function dpRender(){
  const sel=$("fDate").value, today=localDate();
  const lead=new Date(V.dpY,V.dpM,1).getDay();
  const days=new Date(V.dpY,V.dpM+1,0).getDate();
  let h=DAYS.map(d=>`<div class="dp-dow">${esc(dayShort(d.key))}</div>`).join('');
  for(let i=0;i<lead;i++) h+='<button type="button" class="dp-day blank" disabled></button>';
  for(let d=1;d<=days;d++){
    const ds=V.dpY+'-'+String(V.dpM+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    h+=`<button type="button" class="dp-day${ds===sel?' sel':''}${ds===today?' today':''}" data-d="${ds}" aria-label="${fmtDMY(ds)}">${d}</button>`;
  }
  $("dpTitle").textContent=t('mon.'+DP_MONTH[V.dpM])+' '+V.dpY;
  $("dpGrid").innerHTML=h;

}
