// Routines card (Workout page): named routines of movements, of stretches, or of cardio, each kind on its
// own tab. A routine is put on weekdays; every routine on a weekday shows up together in that day's log.
// Also the "Routines" row on the Workout sets card: what the selected session has, add or take off one.
import { DAY_KEYS } from '../core/dates';
import { S } from '../state/app';
import { exByKey, stretchByKey, cardioByKey, activeStretches, activeCardio } from '../state/persist';
import { ITEM_FIELDS, KINDS, NAME_MAX, MAX_ITEMS, type Kind, type Routine, type RItem } from '../store/routines';
import { PLAN_SETS_DEF } from '../store/schema';
import { addToDay, dayRoutines, deleteRoutine, newRoutineId, putRoutine, removeFromDay, routineById, routineDays, saveRoutines } from '../state/routines';
import { t, tf, tn } from '../i18n/index';
import { $, esc, flash } from './dom';
import { byName, dayName, dayShort, sxIsReps } from './shared';
import { render } from './nav';
import { buildExForm } from './workout-log';
import { drawMob } from './mobility';
import { drawCardio } from './cardio';

type Draft = { kind: Kind; id: string; name: string; items: RItem[]; days: Set<string>; isNew: boolean };
let kind: Kind = 'lift';
let draft: Draft | null = null;
let delArmed = false, delTimer: ReturnType<typeof setTimeout> | null = null;
let addOpen = false;

const el = <T extends HTMLElement = HTMLElement>(id: string) => $(id) as T;
const nameOf = (k: Kind, key: string): string => { const x = k === 'lift' ? exByKey(key) : k === 'sx' ? stretchByKey(key) : cardioByKey(key); return x ? x.name : key; };
const hiddenOf = (k: Kind, key: string): boolean => { const x = k === 'lift' ? exByKey(key) : k === 'sx' ? stretchByKey(key) : cardioByKey(key); return !x || !!x.retired; };
const pool = (k: Kind) => (k === 'lift' ? S.catalogue.filter(x => !x.retired) : k === 'sx' ? activeStretches() : activeCardio()) as { key: string; name: string }[];
const dayList = (days: string[]) => days.length === 7 ? t('rt.everyday') : days.map(d => dayShort(d)).join(', ');
const supersetCount = (r: Routine) => { let n = 0; r.items.forEach((it, i) => { if (it.link && !(i > 0 && r.items[i - 1].link)) n++; }); return n; };
const msg = (m: string, err?: boolean) => { const b = el('rtMsg'); b.textContent = m; b.classList.toggle('err', !!err); };

/** Name for routines made from the old weekday pins: the day ('Monday'), the days ('Sun + Thu'), or 'Every day'. */
export const routineNameFor = (days: string[]) => days.length === 7 ? t('rt.everyday') : days.length === 1 ? dayName(days[0]) : days.map(d => dayShort(d)).join(' + ');

// ---- the card ----
export function drawRoutines(): void {
  const wrap = el('rtWrap'); if (!wrap) return;
  el('rtKind').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.classList.toggle('on', b.dataset.k === kind));
  el('rtList').style.display = draft ? 'none' : '';
  el('rtForm').style.display = draft ? '' : 'none';
  if (draft) { drawForm(); return; }
  const list = S.routines[kind];
  el('rtRows').innerHTML = list.length ? list.map(r => {
    const days = routineDays(kind, r.id), ss = kind === 'lift' ? supersetCount(r) : 0;
    const bits = [tn(kind === 'lift' ? 'rt.nlift' : kind === 'sx' ? 'rt.nsx' : 'rt.ncd', r.items.length)];
    if (ss) bits.push(tn('rt.nss', ss));
    bits.push(days.length ? dayList(days) : t('rt.nodays'));
    const peek = r.items.slice(0, 4).map(it => nameOf(kind, it.k)).join(', ') + (r.items.length > 4 ? ' …' : '');
    return `<div class="rtrow"><div class="rtnm">${esc(r.name)}<span>${esc(bits.join(' · '))}</span><span class="rtpeek">${esc(peek)}</span></div>`
      + `<button type="button" class="collbtn" data-rtedit="${esc(r.id)}">${esc(t('btn.edit'))}</button></div>`;
  }).join('') : `<div class="sxnote">${esc(t(kind === 'lift' ? 'rt.empty.lift' : kind === 'sx' ? 'rt.empty.sx' : 'rt.empty.cd'))}</div>`;
  el('rtNew').textContent = t(kind === 'lift' ? 'rt.new.lift' : kind === 'sx' ? 'rt.new.sx' : 'rt.new.cd');
}

function openForm(k: Kind, id: string | null): void {
  const r = id ? routineById(k, id) : null;
  kind = k;
  draft = r ? { kind: k, id: r.id, name: r.name, items: JSON.parse(JSON.stringify(r.items)), days: new Set(routineDays(k, r.id)), isNew: false }
    : { kind: k, id: newRoutineId(), name: '', items: [], days: new Set(), isNew: true };
  resetDel(); msg(''); addOpen = !r;
  el<HTMLInputElement>('rtName').value = draft.name;
  el<HTMLInputElement>('rtSearch').value = '';
  drawRoutines();
  if (!r) el('rtName').focus();
}
function closeForm(): void { draft = null; resetDel(); msg(''); drawRoutines(); }
function resetDel(): void { delArmed = false; if (delTimer) clearTimeout(delTimer); const b = $('rtDelete'); if (b) b.textContent = t('btn.remove'); }

/** The per-item fields: movements their planned sets; stretches hold time (or reps) and sets; cardio minutes and sets.
 *  Blank means the item's own setting, shown in grey. */
function itemFields(k: Kind, it: RItem): string {
  const box = (f: 'sets' | 'secs' | 'reps' | 'mins', ph: number | string, unit: string, aria: string) => {
    const [lo, hi] = ITEM_FIELDS[k][f];
    return `<label class="rtf"><input type="number" min="${lo}" max="${hi}" inputmode="numeric" data-f="${f}" value="${it[f] ?? ''}" placeholder="${ph}" aria-label="${esc(aria)}"><span>${esc(unit)}</span></label>`;
  };
  const x = (inner: string) => `<span class="rtfx"><span class="rtx">×</span>${inner}</span>`;   // '× sets' wraps as one
  if (k === 'lift') return box('sets', PLAN_SETS_DEF, t('rt.setsu'), t('rt.sets'));
  if (k === 'sx') {
    const s = stretchByKey(it.k), reps = sxIsReps(s);
    return (reps ? box('reps', (s && s.reps) || '', t('unit.reps'), t('rt.cfg.reps')) : box('secs', (s && s.secs) || '', 's', t('rt.cfg.secs')))
      + x(box('sets', (s && s.sets) || 1, t('rt.setsu'), t('rt.sets')));
  }
  const c = cardioByKey(it.k);
  return box('mins', (c && c.mins) || '', t('unit.min'), t('rt.cfg.mins')) + x(box('sets', (c && c.sets) || 1, t('rt.setsu'), t('rt.sets')));
}
function drawForm(): void {
  const d = draft!; const lift = d.kind === 'lift';
  el('rtFormTitle').textContent = t(d.isNew ? (lift ? 'rt.new.lift' : d.kind === 'sx' ? 'rt.new.sx' : 'rt.new.cd') : 'rt.edit');
  el('rtDelete').style.display = d.isNew ? 'none' : '';
  el('rtItems').innerHTML = d.items.length ? d.items.map((it, i) => {
    const last = i === d.items.length - 1, inSS = it.link || (i > 0 && d.items[i - 1].link);
    const row = `<div class="rtitem${inSS ? ' ss' : ''}${it.link ? ' ssnext' : ''}" data-i="${i}">`
      + `<span class="rtn">${i + 1}</span><div class="rtmain"><span class="rtinm">${esc(nameOf(d.kind, it.k))}${hiddenOf(d.kind, it.k) ? ' <span class="xtag">' + esc(t('coll.hidden')) + '</span>' : ''}</span>`
      + `<div class="rtcfg">${itemFields(d.kind, it)}</div></div>`
      + `<button type="button" class="rtmv" data-mv="-1"${i === 0 ? ' disabled' : ''} aria-label="${esc(t('rt.up'))}">↑</button>`
      + `<button type="button" class="rtmv" data-mv="1"${last ? ' disabled' : ''} aria-label="${esc(t('rt.down'))}">↓</button>`
      + `<button type="button" class="rtrm" aria-label="${esc(t('btn.remove'))}">✕</button></div>`;
    const link = (lift && !last) ? `<button type="button" class="rtlink${it.link ? ' on' : ''}" data-link="${i}" aria-pressed="${!!it.link}">${esc(t(it.link ? 'rt.linked' : 'rt.link'))}</button>` : '';
    return row + link;
  }).join('') + (lift ? '' : `<div class="sxnote rtcfgnote">${esc(t(d.kind === 'sx' ? 'rt.cfg.hint.sx' : 'rt.cfg.hint.cd'))}</div>`)
    : `<div class="sxnote">${esc(t('rt.noitems'))}</div>`;
  el('rtItems').querySelectorAll<HTMLElement>('.rtitem').forEach(row => {
    const i = +row.dataset.i!;
    row.querySelectorAll<HTMLButtonElement>('.rtmv').forEach(b => b.onclick = () => move(i, +b.dataset.mv!));
    (row.querySelector('.rtrm') as HTMLElement).onclick = () => { d.items.splice(i, 1); if (d.items.length) delete d.items[d.items.length - 1].link; drawForm(); };
    row.querySelectorAll<HTMLInputElement>('input[data-f]').forEach(inp => inp.oninput = () => {
      const f = inp.dataset.f as 'sets' | 'secs' | 'reps' | 'mins', [lo, hi] = ITEM_FIELDS[d.kind][f], n = parseInt(inp.value, 10);
      if (n >= lo && n <= hi) d.items[i][f] = n; else delete d.items[i][f];
    });
  });
  el('rtItems').querySelectorAll<HTMLButtonElement>('.rtlink').forEach(b => b.onclick = () => {
    const i = +b.dataset.link!; if (d.items[i].link) delete d.items[i].link; else d.items[i].link = true; drawForm();
  });
  el('rtAddBtn').textContent = t(addOpen ? 'rt.adddone' : (lift ? 'rt.add.lift' : d.kind === 'sx' ? 'rt.add.sx' : 'rt.add.cd'));
  el('rtAddBox').style.display = addOpen ? '' : 'none';
  if (addOpen) drawAdd();
  el('rtDays').innerHTML = DAY_KEYS.map(k => `<button type="button" class="mchip${d.days.has(k) ? ' on' : ''}" data-d="${k}" aria-pressed="${d.days.has(k)}">${esc(dayShort(k))}</button>`).join('');
  el('rtDays').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { const k = b.dataset.d!; if (d.days.has(k)) d.days.delete(k); else d.days.add(k); drawForm(); });
}
function drawAdd(): void {
  const d = draft!, q = el<HTMLInputElement>('rtSearch').value.trim().toLowerCase(), have = new Set(d.items.map(it => it.k));
  const cands = pool(d.kind).filter(x => !have.has(x.key) && (!q || x.name.toLowerCase().indexOf(q) >= 0)).sort((a, b) => byName(a.name, b.name)).slice(0, 80);
  el('rtPool').innerHTML = cands.length ? cands.map(x => `<button type="button" class="mchip" data-k="${esc(x.key)}">+ ${esc(x.name)}</button>`).join('')
    : `<div class="sxnote">${esc(q ? tf('nomatch', { q }) : t(d.kind === 'lift' ? 'rt.pool.none.lift' : 'rt.pool.none'))}</div>`;
  el('rtPool').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => {
    if (d.items.length >= MAX_ITEMS) { msg(tf('rt.toomany', { n: MAX_ITEMS }), true); return; }
    d.items.push({ k: b.dataset.k! }); drawForm();
  });
}
function move(i: number, by: number): void {
  const d = draft!, j = i + by; if (j < 0 || j >= d.items.length) return;
  const [x] = d.items.splice(i, 1); d.items.splice(j, 0, x);
  if (d.items.length) delete d.items[d.items.length - 1].link;
  drawForm();
}
async function save(): Promise<void> {
  const d = draft!; const name = el<HTMLInputElement>('rtName').value.trim().slice(0, NAME_MAX);
  if (!name) { msg(t('rt.needname'), true); el('rtName').focus(); return; }
  if (!d.items.length) { msg(t('rt.needitems'), true); return; }
  const clash = S.routines[d.kind].find(r => r.id !== d.id && r.name.toLowerCase() === name.toLowerCase());
  if (clash) { msg(tf('rt.clash', { name }), true); return; }
  putRoutine(d.kind, { id: d.id, name, items: d.items }, [...d.days]);
  const ok = await saveRoutines();
  if (!ok) { msg(t('msg.savefail'), true); return; }
  draft = null; resetDel(); msg('');
  refreshLog(); render();
  flash(tf(d.isNew ? 'rt.saved.new' : 'rt.saved', { name }));
}
async function remove(): Promise<void> {
  const d = draft!; if (d.isNew) return;
  if (!delArmed) {
    delArmed = true; el('rtDelete').textContent = t('btn.tapagain');
    msg(tf('rt.del.warn', { name: d.name || el<HTMLInputElement>('rtName').value }), true);
    delTimer = setTimeout(resetDel, 4000); return;
  }
  const r = routineById(d.kind, d.id);
  deleteRoutine(d.kind, d.id); await saveRoutines();
  draft = null; resetDel(); msg('');
  refreshLog(); render();
  flash(tf('rt.deleted', { name: r ? r.name : '' }));
}
/** Redraws the parts of today's log that the plan feeds. */
function refreshLog(): void {
  buildExForm(S.entries.find(e => e.date === el<HTMLInputElement>('fDate').value), el<HTMLSelectElement>('fDay').value);
  drawMob(); drawCardio(); drawDayRoutines();
}

// ---- "Routines" row on the Workout sets card ----
let dayAddOpen = false;
export function drawDayRoutines(): void {
  const box = $('dayRt'); if (!box) return;
  const day = el<HTMLSelectElement>('fDay').value || 'mon';
  const on = KINDS.flatMap(k => dayRoutines(day, k).map(r => ({ k, r })));
  const tag = (k: Kind) => k === 'lift' ? '' : ` <span class="rtkind">${esc(t(k === 'sx' ? 'rt.kind.sx' : 'rt.kind.cd'))}</span>`;
  el('dayRtList').innerHTML = (on.length ? on.map(({ k, r }) => `<span class="rtchip">${esc(r.name)}${tag(k)}<button type="button" data-rk="${k}" data-rid="${esc(r.id)}" aria-label="${esc(tf('rt.takeoff', { name: r.name, day: dayName(day) }))}">✕</button></span>`).join('')
    : `<span class="rtnone">${esc(tf('rt.dayempty', { day: dayName(day) }))}</span>`);
  el('dayRtList').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { void takeOff(b.dataset.rk as Kind, b.dataset.rid!, day); });
  el('dayRtAdd').textContent = t(dayAddOpen ? 'rt.adddone' : 'rt.addtoday');
  el('dayRtAdd').setAttribute('aria-expanded', String(dayAddOpen));
  const pick = el('dayRtPick'); pick.style.display = dayAddOpen ? '' : 'none';
  if (!dayAddOpen) return;
  const groups = KINDS.map(k => ({ k, list: S.routines[k].filter(r => (S.routines.week[k][day] || []).indexOf(r.id) < 0) })).filter(g => g.list.length);
  pick.innerHTML = groups.length ? groups.map(g => `<div class="ctl-lbl">${esc(t(g.k === 'lift' ? 'rt.tab.lift' : g.k === 'sx' ? 'rt.tab.sx' : 'rt.tab.cd'))}</div><div class="muschips">`
      + g.list.map(r => `<button type="button" class="mchip" data-rk="${g.k}" data-rid="${esc(r.id)}">+ ${esc(r.name)}</button>`).join('') + '</div>').join('')
    : `<div class="sxnote">${esc(t(KINDS.some(k => S.routines[k].length) ? 'rt.allon' : 'rt.none'))}</div>`;
  pick.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { void putOn(b.dataset.rk as Kind, b.dataset.rid!, day); });
}
async function putOn(k: Kind, id: string, day: string): Promise<void> {
  const r = routineById(k, id); if (!r) return;
  if (!addToDay(k, id, day)) return;
  await saveRoutines(); refreshLog(); render();
  flash(tf('rt.puton', { name: r.name, day: dayName(day) }));
}
async function takeOff(k: Kind, id: string, day: string): Promise<void> {
  const r = routineById(k, id);
  removeFromDay(k, id, day); await saveRoutines(); refreshLog(); render();
  if (r) flash(tf('rt.tookoff', { name: r.name, day: dayName(day) }));
}

export function initRoutines(): void {
  el('rtKind').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { if (draft) return; kind = b.dataset.k as Kind; drawRoutines(); });
  el('rtNew').onclick = () => openForm(kind, null);
  el('rtRows').onclick = ev => { const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-rtedit]'); if (b) openForm(kind, b.dataset.rtedit!); };
  el('rtCancel').onclick = closeForm;
  el('rtSave').onclick = () => { void save(); };
  el('rtDelete').onclick = () => { void remove(); };
  el('rtName').oninput = () => { if (draft) draft.name = el<HTMLInputElement>('rtName').value; };
  el('rtAddBtn').onclick = () => { addOpen = !addOpen; drawForm(); if (addOpen) el('rtSearch').focus(); };
  el('rtSearch').oninput = drawAdd;
  el('dayRtAdd').onclick = () => { dayAddOpen = !dayAddOpen; drawDayRoutines(); };
  el('dayRtManage').onclick = () => { const c = $('cardRoutines'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
}
