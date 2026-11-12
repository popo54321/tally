// "How to use Tally": a tour over the real screens. Each step switches to its page, dims everything else,
// rings the button or card it is about and says what it does. Steps whose target is not on screen (the
// install card once Tally is installed, for example) are skipped. Starts once for a new user after the
// welcome statement, and again from Settings > How to use Tally.
import { STORE } from '../store/kv';
import { t, tf } from '../i18n/index';
import { $ } from './dom';
import { showPage } from './nav';

export const TOUR_KEY = 'tally:tourSeen:v1';
interface Step { page: string; sel: string; card?: boolean; key: string }
const STEPS: Step[] = [
  { page: 'body', sel: '#tabs', key: 'tabs' },
  { page: 'body', sel: '#sched', key: 'week' },
  { page: 'body', sel: '#dayBar', key: 'day' },
  { page: 'body', sel: '#cardBody', key: 'food' },
  { page: 'body', sel: '#fKcalAdd', key: 'meal' },
  { page: 'body', sel: '#wChart', card: true, key: 'chart' },
  { page: 'body', sel: '#calibOut', card: true, key: 'calib' },
  { page: 'workout', sel: '#fDay', key: 'session' },
  { page: 'workout', sel: '#addMoveBtn', key: 'addmove' },
  { page: 'workout', sel: '.restctl', key: 'rest' },
  { page: 'workout', sel: '#copyDayBtn', key: 'copy' },
  { page: 'workout', sel: '#cardPlates', key: 'plates' },
  { page: 'workout', sel: '#cardMob', key: 'mob' },
  { page: 'guide', sel: '#cardVol', key: 'vol' },
  { page: 'gym', sel: '#cardGym', key: 'gym' },
  { page: 'settings', sel: '#cardInstall', key: 'install' },
  { page: 'settings', sel: '#backupBtn', card: true, key: 'backup' },
  { page: 'settings', sel: '#tourBtn', key: 'again' },
];

let steps: Step[] = [], at = 0, root: HTMLElement | null = null;
const visible = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).offsetParent !== null && el.getBoundingClientRect().height > 0;
function target(s: Step): HTMLElement | null {
  showPage(s.page);
  let el = document.querySelector(s.sel) as HTMLElement | null;
  if (el && s.card) el = el.closest('.card') as HTMLElement | null;
  return visible(el) ? el : null;
}

function build(): HTMLElement {
  const r = document.createElement('div');
  r.className = 'tour'; r.setAttribute('role', 'dialog'); r.setAttribute('aria-modal', 'true'); r.setAttribute('aria-labelledby', 'tourTitle');
  r.innerHTML = `<div class="tour-block"></div><div class="tour-ring"></div>
    <div class="tour-card" tabindex="-1"><div class="tour-count" id="tourCount"></div><div class="tour-title" id="tourTitle"></div><div class="tour-text" id="tourText"></div>
    <div class="tour-btns"><button type="button" class="tour-skip" id="tourSkip"></button><span></span><button type="button" class="tour-back" id="tourBack"></button><button type="button" class="tour-next prim" id="tourNext"></button></div></div>`;
  document.body.appendChild(r);
  (r.querySelector('#tourSkip') as HTMLElement).onclick = () => { void endTour(); };
  (r.querySelector('#tourBack') as HTMLElement).onclick = () => go(-1);
  (r.querySelector('#tourNext') as HTMLElement).onclick = () => go(1);
  return r;
}

function place(el: HTMLElement): void {
  if (!root) return;
  const ring = root.querySelector('.tour-ring') as HTMLElement, card = root.querySelector('.tour-card') as HTMLElement;
  const b = el.getBoundingClientRect(), pad = 6, vh = window.innerHeight, vw = window.innerWidth;
  const top = Math.max(4, b.top - pad), bottom = Math.min(vh - 4, b.bottom + pad);
  Object.assign(ring.style, { top: top + 'px', left: Math.max(4, b.left - pad) + 'px', width: Math.min(vw - 8, b.width + pad * 2) + 'px', height: Math.max(24, bottom - top) + 'px' });
  // the explanation sits at whichever end of the screen has more room
  const roomBelow = vh - bottom, roomAbove = top;
  card.style.top = card.style.bottom = '';
  if (b.height > vh * 0.5 || roomBelow >= roomAbove) card.style.bottom = '14px'; else card.style.top = '14px';
}

function show(): void {
  if (!root) return;
  const s = steps[at], el = target(s);
  if (!el) { steps.splice(at, 1); if (at >= steps.length) { void endTour(); return; } show(); return; }
  // a card taller than half the screen: show its top, with the explanation at the bottom; otherwise centre it
  const tall = el.getBoundingClientRect().height > window.innerHeight * 0.5;
  if (tall) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 12); else el.scrollIntoView({ block: 'center' });
  ($('tourCount') as HTMLElement).textContent = tf('tour.count', { n: at + 1, of: steps.length });
  ($('tourTitle') as HTMLElement).textContent = t('tour.' + s.key + '.h');
  ($('tourText') as HTMLElement).textContent = t('tour.' + s.key + '.b');
  ($('tourSkip') as HTMLElement).textContent = t('tour.skip');
  ($('tourBack') as HTMLElement).textContent = t('tour.back');
  ($('tourBack') as HTMLButtonElement).disabled = at === 0;
  ($('tourNext') as HTMLElement).textContent = t(at === steps.length - 1 ? 'tour.done' : 'tour.next');
  requestAnimationFrame(() => { place(el); (root!.querySelector('.tour-card') as HTMLElement).focus({ preventScroll: true }); });
}
function go(d: number): void {
  const n = at + d;
  if (n < 0) return;
  if (n >= steps.length) { void endTour(); return; }
  at = n; show();
}
const reflow = () => { if (root && steps[at]) { const el = target(steps[at]); if (el) place(el); } };

export function tourOpen(): boolean { return !!root; }
export function startTour(): void {
  if (root) return;
  steps = STEPS.slice(); at = 0; root = build();
  window.addEventListener('resize', reflow);
  show();
}
export async function endTour(): Promise<void> {
  if (!root) return;
  root.remove(); root = null;
  window.removeEventListener('resize', reflow);
  showPage('body'); window.scrollTo(0, 0);
  try { await STORE.set(TOUR_KEY, '1'); } catch (e) { /* the tour simply shows again next time */ }
}
/** After the welcome statement closes: the first time only. */
export async function tourMaybeStart(): Promise<void> {
  let seen: string | null = null;
  try { seen = await STORE.get(TOUR_KEY); } catch (e) { seen = null; }
  if (!seen) startTour();
}
export function initTour(): void {
  const b = $('tourBtn') as HTMLElement | null; if (b) b.onclick = startTour;
  document.addEventListener('keydown', ev => {
    if (!root) return;
    if (ev.key === 'Escape') void endTour();
    else if (ev.key === 'ArrowRight') go(1);
    else if (ev.key === 'ArrowLeft') go(-1);
  });
}
