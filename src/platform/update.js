// The Android app's updater (Updater.java), seen from the page. The page itself never goes online: it asks the
// native side to check GitHub and to install, and hears back through window.tallyUpdateEvent.
const native = () => { try{ return window.AndroidUpdate && typeof window.AndroidUpdate.check==='function' ? window.AndroidUpdate : null; }catch(e){ return null; } };
export const hasUpdater = () => !!native();
const listeners = [];
export const onUpdateEvent = fn => { listeners.push(fn); };
window.tallyUpdateEvent = ev => { listeners.forEach(f => { try{ f(ev || {}); }catch(e){} }); };
export const updaterCheck = () => { const n=native(); try{ return !!(n && n.check()); }catch(e){ return false; } };
export const updaterInstall = url => { const n=native(); try{ return !!(n && n.install(url)); }catch(e){ return false; } };
export const updaterCanInstall = () => { const n=native(); try{ return !!(n && n.canInstall()); }catch(e){ return false; } };
/** What the app shell offers (1 for shells from before app-file updates). */
export const updaterShell = () => { const n=native(); try{ return n && typeof n.shell==='function' ? n.shell() : 1; }catch(e){ return 1; } };
export const updaterInstallPage = url => { const n=native(); try{ return !!(n && typeof n.installPage==='function' && n.installPage(url)); }catch(e){ return false; } };
export const updaterRestart = () => { const n=native(); try{ if(n && n.restart) n.restart(); }catch(e){} };
/** The page started properly: tells the shell to keep newly downloaded app files. */
export const updaterStarted = () => { const n=native(); try{ if(n && n.started) n.started(); }catch(e){} };
export const updaterAllow = () => { const n=native(); try{ if(n) n.allowInstalls(); }catch(e){} };
/** True when version a is newer than b ('9.10' is newer than '9.9'). */
export function newerVersion(a, b){
  const pa=String(a||'').split('.').map(Number), pb=String(b||'').split('.').map(Number);
  if(pa.some(isNaN) || pb.some(isNaN) || !pa.length) return false;
  for(let i=0;i<Math.max(pa.length,pb.length);i++){ const x=pa[i]||0, y=pb[i]||0; if(x!==y) return x>y; }
  return false;
}
