// Opening and closing dialogs, returning focus where it was.
import { V } from '../ui/view';
import { $ } from './dom';

export function dlgOpen(id){
  V.dlgReturn=document.activeElement;
  const w=$(id); w.classList.add('show');
  const d=w.firstElementChild; if(d && d.focus) d.focus({preventScroll:true});
}
export function dlgClose(id){
  const w=$(id); if(!w || !w.classList.contains('show')) return;
  w.classList.remove('show');
  if(V.dlgReturn && document.contains(V.dlgReturn) && V.dlgReturn.focus) V.dlgReturn.focus({preventScroll:true});
  V.dlgReturn=null;
}
