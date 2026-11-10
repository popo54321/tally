// Rest-timer alarms on Android (exact alarms) through the app shell. Nothing happens in a browser.

export const hasAlarm = () => { try{ return !!(window.AndroidAlarm && window.AndroidAlarm.schedule); }catch(e){ return false; } };
export const exactAlarmsOff = () => { try{ return hasAlarm() && typeof window.AndroidAlarm.exactAllowed==='function' && !window.AndroidAlarm.exactAllowed(); }catch(e){ return false; } };
export function openExactSettings(){ try{ window.AndroidAlarm.openExactSettings(); }catch(e){} }
/** Rings in 'secs' seconds with 'label' as the notification text. */
export function scheduleAlarm(secs, label){
  if(!hasAlarm()) return;
  try{ window.AndroidAlarm.schedule(Math.max(0,Math.round(secs*1000)), label); }catch(e){}
}
export function alarmCancel(){
  if(!hasAlarm()) return;
  try{ window.AndroidAlarm.cancel(); }catch(e){}
}
