// Android: Tally checks for a newer version and updates itself (Settings → Version & Updates, and a bar at the
// top when one is found). The checking and installing happen in the native app (platform/update.js); the page
// only shows where things are. Your data never leaves the phone: the check only asks GitHub for the latest release.
import { t, tf } from '../i18n/index';
import { $ } from './dom';
import { APP_VERSION } from './shared';
import { hasUpdater, newerVersion, onUpdateEvent, updaterAllow, updaterCanInstall, updaterCheck, updaterInstall } from '../platform/update';

type Phase = 'idle' | 'checking' | 'latest' | 'found' | 'downloading' | 'installing' | 'confirm' | 'cancelled' | 'allow' | 'error';
export const AUTO_KEY = 'tally:updAuto', LAST_KEY = 'tally:updLast', SKIP_KEY = 'tally:updSkip';
/** At most one automatic check in this long. */
export const AUTO_EVERY = 20 * 3600 * 1000;

let phase: Phase = 'idle', pct = 0, why = '', manual = false;
let found: { version: string; url: string } | null = null;
const get = (k: string) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } };
const el = (id: string) => $(id) as HTMLElement | null;
export const autoOn = () => get(AUTO_KEY) !== '0';

function check(byHand: boolean): void {
  if (phase === 'checking' || phase === 'downloading' || phase === 'installing') return;
  manual = byHand;
  if (!updaterCheck()) return;
  put(LAST_KEY, String(Date.now()));
  if (byHand) { phase = 'checking'; draw(); }
}
function install(): void {
  if (!found) return;
  if (!updaterCanInstall()) { phase = 'allow'; draw(); return; }
  if (updaterInstall(found.url)) { phase = 'downloading'; pct = 0; draw(); }
}

function handle(ev: { type?: string; ok?: boolean; version?: string; url?: string; pct?: number; why?: string }): void {
  switch (ev.type) {
    case 'check':
      if (!ev.ok) { if (manual) { phase = 'error'; why = 'offline'; } else phase = found ? 'found' : 'idle'; break; }
      if (ev.url && newerVersion(ev.version, APP_VERSION)) { found = { version: String(ev.version), url: ev.url }; phase = 'found'; }
      else phase = manual ? 'latest' : 'idle';
      break;
    case 'progress': phase = 'downloading'; pct = Math.max(0, Math.min(100, ev.pct || 0)); break;
    case 'installing': phase = 'installing'; break;
    case 'confirm': phase = 'confirm'; break;
    case 'cancelled': phase = 'cancelled'; break;
    case 'error': if (ev.why === 'allow') phase = 'allow'; else { phase = 'error'; why = ev.why || 'install'; } break;
    case 'resume': break;   // back from Android's settings or installer: just redraw
    default: return;
  }
  draw();
}

/** The Version & Updates card and the bar at the top. */
export function draw(): void {
  if (!hasUpdater()) return;
  const msg = el('updMsg'), go = el('updInstall'), allow = el('updAllow'), getBtn = el('updGet'), auto = el('updAuto'), row = el('updAutoRow');
  const busy = phase === 'checking' || phase === 'downloading' || phase === 'installing';
  if (msg) msg.textContent = phase === 'checking' ? t('upd.checking')
    : phase === 'latest' ? t('upd.latest')
    : phase === 'found' ? tf('upd.avail', { v: found!.version })
    : phase === 'downloading' ? tf('upd.down', { n: pct })
    : phase === 'installing' ? t('upd.installing')
    : phase === 'confirm' ? t('upd.confirm')
    : phase === 'cancelled' ? t('upd.cancelled')
    : phase === 'allow' ? t('upd.allow')
    : phase === 'error' ? t('upd.err.' + why) : '';
  if (go) { go.style.display = found && (phase === 'found' || phase === 'cancelled' || phase === 'allow' || (phase === 'error' && why !== 'offline')) ? '' : 'none'; if (found) go.textContent = tf('upd.install', { v: found.version }); }
  if (allow) allow.style.display = phase === 'allow' ? '' : 'none';
  if (getBtn) getBtn.style.display = phase === 'error' && (why === 'install' || why === 'verify' || why === 'net') ? '' : 'none';
  const chk = el('updCheck'); if (chk) { chk.style.display = ''; (chk as HTMLButtonElement).disabled = busy; }
  if (row) row.style.display = '';
  if (auto) { auto.textContent = t(autoOn() ? 'upd.auto.on' : 'upd.auto.off'); auto.setAttribute('aria-pressed', String(autoOn())); }
  const bar = el('updNudge');
  if (bar) {
    const show = !!found && get(SKIP_KEY) !== found.version && (phase === 'found' || phase === 'downloading' || phase === 'installing' || phase === 'confirm' || phase === 'allow');
    bar.style.display = show ? '' : 'none';
    if (show) {
      const txt = el('updNudgeText'); if (txt) txt.textContent = phase === 'found' ? tf('upd.nudge', { v: found!.version }) : (msg ? msg.textContent : '');
      const g = el('updNudgeGo'); if (g) g.style.display = phase === 'found' ? '' : 'none';
      const a = el('updNudgeAllow'); if (a) a.style.display = phase === 'allow' ? '' : 'none';
    }
  }
}

export function initSelfUpdate(): void {
  if (!hasUpdater()) return;
  onUpdateEvent(handle);
  const on = (id: string, fn: () => void) => { const b = el(id); if (b) b.onclick = fn; };
  on('updInstall', install);
  on('updNudgeGo', install);
  on('updAllow', updaterAllow);
  on('updNudgeAllow', updaterAllow);
  on('updNudgeLater', () => { if (found) put(SKIP_KEY, found.version); draw(); });
  on('updAuto', () => { put(AUTO_KEY, autoOn() ? '0' : '1'); draw(); });
  draw();
  const last = +(get(LAST_KEY) || 0);
  if (autoOn() && !(Date.now() - last < AUTO_EVERY)) setTimeout(() => check(false), 2500);
}
/** "Check for update" on Android. */
export const selfUpdateCheck = () => check(true);
