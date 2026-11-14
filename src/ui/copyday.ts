// "Copy this day to…" on the Workout sets card: puts the selected session's routines (workout, stretch
// and cardio) on other weekdays too, with Undo.
import { DAY_KEYS, type DayKey } from '../core/dates';
import { dayPlan, dayPlanEmpty } from '../state/plan';
import { copyDayRoutines, restoreWeek, type WeekSnapshot } from '../state/routines';
import { t, tf, tn } from '../i18n/index';
import { $, esc } from './dom';
import { dlgOpen, dlgClose } from './dialog';
import { dayName, dayShort } from './shared';
import { render } from './nav';

let from: DayKey = 'mon';
let picked = new Set<DayKey>();
let mode: 'add' | 'replace' = 'add';
let undo: WeekSnapshot | null = null;

const el = <T extends HTMLElement = HTMLElement>(id: string) => $(id) as T;
const msg = (m: string) => { el('cpMsg').textContent = m; };
/** 'a', 'a and b', 'a, b and c'. */
const andList = (xs: string[]) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];

function draw(): void {
  const empty = dayPlanEmpty(from), p = dayPlan(from);
  el('cpTitle').textContent = tf('copy.title', { day: dayName(from) });
  el('cpWhat').textContent = empty ? tf('copy.empty', { day: dayName(from) })
    : tf('copy.what', { day: dayName(from), list: andList(([[p.lifts.length, 'copy.lifts'], [p.sx.length, 'copy.sx'], [p.cd.length, 'copy.cd']] as [number, string][])
        .filter(([n]) => n > 0).map(([n, k]) => tn(k, n))) });
  el('cpDays').innerHTML = DAY_KEYS.filter(d => d !== from)
    .map(d => `<button type="button" class="mchip${picked.has(d) ? ' on' : ''}" data-d="${d}" aria-pressed="${picked.has(d)}">${esc(dayShort(d))}</button>`).join('');
  el('cpDays').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => {
    const d = b.dataset.d as DayKey; if (picked.has(d)) picked.delete(d); else picked.add(d); draw();
  });
  el('cpMode').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
  el('cpHowNote').textContent = mode === 'add' ? t('copy.add.note') : tf('copy.replace.note', { day: dayName(from) });
  el<HTMLButtonElement>('cpGo').disabled = empty;
  el('cpUndo').style.display = undo ? '' : 'none';
}

export function cpOpen(): void {
  from = (el<HTMLSelectElement>('fDay').value || 'mon') as DayKey;
  picked = new Set(); mode = 'add'; undo = null; msg('');
  draw(); dlgOpen('cpWrap');
}
export function cpClose(): void { undo = null; dlgClose('cpWrap'); }

async function go(): Promise<void> {
  if (dayPlanEmpty(from)) return;
  if (!picked.size) { msg(t('copy.pick')); return; }
  const to = DAY_KEYS.filter(d => picked.has(d));
  undo = await copyDayRoutines(from, to, mode);
  msg(tf('copy.done', { day: dayName(from), days: to.map(d => dayShort(d)).join(', ') }));
  picked = new Set(); draw(); render();
}
async function undoCopy(): Promise<void> {
  if (!undo) return;
  await restoreWeek(undo); undo = null;
  msg(t('copy.undone')); draw(); render();
}

/** Wires the button and the dialog; called once at start-up. */
export function initCopyDay(): void {
  el('copyDayBtn').onclick = cpOpen;
  el('cpX').onclick = cpClose;
  el('cpWrap').onclick = ev => { if (ev.target === el('cpWrap')) cpClose(); };
  el('cpGo').onclick = () => { void go(); };
  el('cpUndo').onclick = () => { void undoCopy(); };
  el('cpMode').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { mode = b.dataset.m === 'replace' ? 'replace' : 'add'; draw(); });
}
