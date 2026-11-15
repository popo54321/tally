// Release notes: "What's new" once after an update, and the full Update log from Settings → Version & Updates.
import { CHANGELOG, type Release } from '../data/changelog';
import { newerVersion } from '../platform/update';
import { t, tf } from '../i18n/index';
import { $, esc } from './dom';
import { dlgOpen, dlgClose } from './dialog';
import { APP_VERSION } from './shared';
import { tourOpen } from './tour';

export const SEEN_KEY = 'tally:seenVersion:v1';
const get = () => { try { return localStorage.getItem(SEEN_KEY); } catch (e) { return null; } };
const put = (v: string) => { try { localStorage.setItem(SEEN_KEY, v); } catch (e) { /* private mode: fine */ } };
const when = (d: string) => { const x = new Date(d + 'T12:00:00'); return isNaN(+x) ? d : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };

function html(list: Release[]): string {
  return list.map(r => `<div class="clrel"><div class="clhead"><b>${esc(r.v ? tf('cl.ver', { v: r.v }) : t('cl.first'))}</b><span>${esc(when(r.date))}</span></div>`
    + `<ul>${r.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>`).join('');
}
function show(title: string, list: Release[], more: boolean): void {
  ($('clTitle') as HTMLElement).textContent = title;
  ($('clBody') as HTMLElement).innerHTML = html(list);
  ($('clAll') as HTMLElement).style.display = more ? '' : 'none';
  dlgOpen('clWrap');
  ($('clBody') as HTMLElement).scrollTop = 0;
}

/** The versions after `seen`, up to and including this one. */
export const notesSince = (seen: string | null) => CHANGELOG.filter(r => r.v && (!seen || newerVersion(r.v, seen)) && !newerVersion(r.v, APP_VERSION));

/**
 * At start-up. A new user (newUser: nothing logged yet) just records this version. Someone updating sees
 * the notes for every version since the one they last had; someone coming from before this feature existed
 * sees this version's notes. Going back to an older version shows nothing.
 */
export function clMaybeShow(newUser: boolean): void {
  const seen = get();
  put(APP_VERSION);
  if ((newUser && !seen) || seen === APP_VERSION || (seen && !newerVersion(APP_VERSION, seen))) return;
  const list = seen ? notesSince(seen) : CHANGELOG.filter(r => r.v === APP_VERSION);
  if (!list.length) return;
  const go = () => show(list.length > 1 ? tf('cl.since', { v: APP_VERSION, from: seen }) : tf('cl.new', { v: APP_VERSION }), list, true);
  // never on top of the welcome: wait until it is closed
  const ab = $('abWrap') as HTMLElement | null;
  if (ab && ab.classList.contains('show')) {
    // ...and not over the How to use tour, which can start when the welcome closes
    const mo = new MutationObserver(() => { if (!ab.classList.contains('show')) { mo.disconnect(); setTimeout(() => { if (!tourOpen()) go(); }, 400); } });
    mo.observe(ab, { attributes: true, attributeFilter: ['class'] });
  } else go();
}
export const clOpenLog = () => show(t('cl.title'), CHANGELOG, false);
export const clClose = () => dlgClose('clWrap');

export function initChangelog(): void {
  ($('clBtn') as HTMLElement).onclick = clOpenLog;
  ($('clX') as HTMLElement).onclick = clClose;
  ($('clOk') as HTMLElement).onclick = clClose;
  ($('clAll') as HTMLElement).onclick = clOpenLog;
  ($('clWrap') as HTMLElement).onclick = ev => { if (ev.target === $('clWrap')) clClose(); };
}
