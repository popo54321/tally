// The Android Back button: closes the open dialog first.
import { $ } from './dom';
import { abClose } from './about';
import { cdClose } from './cardio';
import { dpClose } from './datepicker';
import { kpClose } from './picker';
import { shClose } from './movements';
import { sxClose } from './mobility';

export function tallyBack(){
  const open=[['abWrap',abClose],['kpWrap',kpClose],['shWrap',shClose],['sxWrap',sxClose],['cdWrapSheet',cdClose],['dpWrap',dpClose]]
    .find(([id])=>{ const el=$(id); return el && el.classList.contains('show'); });
  if(!open) return false;
  open[1](); return true;
}
// The Android app calls this when Back is pressed (see android/.../BackResult.java).
window.tallyBack = tallyBack;
