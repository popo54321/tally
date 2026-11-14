// In the movement editor: copy this movement's coaching (rep range and step, or Off) to other movements
// at once. Only movements loaded the same way are offered (kg, bodyweight + kg, or seconds), since a range
// in seconds means nothing for a kg lift. The copy happens when the movement is saved.
import { S } from '../state/app';
import { normCustomEx } from '../store/schema';
import { t, tn } from '../i18n/index';
import { $, esc } from './dom';
import { byName, persistCatalogue } from './shared';
import { shModeGet } from './movements';
import { V } from './view';

let picked = new Set<string>();
let open = false;

const sameLoading = (ex: { added?: boolean; unit?: string | null }, mode: string) =>
  mode === 'sec' ? ex.unit === 'sec' : mode === 'bw' ? !!ex.added && ex.unit !== 'sec' : !ex.added && ex.unit !== 'sec';
function candidates() {
  const mode = shModeGet();
  return S.catalogue.filter(x => !x.retired && x.key !== editingKey() && sameLoading(x, mode)).sort((a, b) => byName(a.name, b.name));
}
const editingKey = (): string | null => V.shEditing;

/** Called when the editor opens for a movement (or a new one). */
export function coachApplyReset(): void {
  picked = new Set(); open = false; coachApplyDraw();
}

/** Redraws the list; called whenever the loading or coaching changes. */
export function coachApplyDraw(): void {
  const box = $('shApplyBox') as HTMLElement | null, btn = $('shApplyBtn') as HTMLElement | null;
  if (!box || !btn) return;
  const list = candidates(), keys = new Set(list.map(x => x.key));
  picked.forEach(k => { if (!keys.has(k)) picked.delete(k); });
  btn.textContent = picked.size ? tn('ca.btnn', picked.size) : t('ca.btn');
  btn.setAttribute('aria-expanded', String(open));
  box.style.display = open ? '' : 'none';
  if (!open) return;
  ($('shApplyList') as HTMLElement).innerHTML = list.length
    ? list.map(x => `<button type="button" class="mchip${picked.has(x.key) ? ' on' : ''}" data-k="${esc(x.key)}" aria-pressed="${picked.has(x.key)}">${esc(x.name)}</button>`).join('')
    : `<div class="sxnote">${esc(t('ca.empty'))}</div>`;
  ($('shApplyList') as HTMLElement).querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => {
    const k = b.dataset.k as string; if (picked.has(k)) picked.delete(k); else picked.add(k); coachApplyDraw();
  });
  ($('shApplyAll') as HTMLElement).style.display = ($('shApplyNone') as HTMLElement).style.display = list.length ? '' : 'none';
}

export function initCoachApply(): void {
  ($('shApplyBtn') as HTMLElement).onclick = () => { open = !open; coachApplyDraw(); };
  ($('shApplyAll') as HTMLElement).onclick = () => { candidates().forEach(x => picked.add(x.key)); coachApplyDraw(); };
  ($('shApplyNone') as HTMLElement).onclick = () => { picked.clear(); coachApplyDraw(); };
}

/** Copies the coaching to every picked movement and saves; returns how many changed. */
export async function coachApplySave(coach: { repMin: number | null; repMax: number | null; step: unknown }): Promise<number> {
  let n = 0;
  for (const k of picked) {
    const own = S.customEx.find(x => x.key === k); if (!own) continue;
    const chk = normCustomEx(Object.assign({}, own, coach));
    if (!chk) continue;
    own.repMin = chk.repMin; own.repMax = chk.repMax; own.step = chk.step; n++;
  }
  if (n) await persistCatalogue();
  picked = new Set(); open = false;
  return n;
}
/** ' · coaching also set on 4 movements', or nothing. */
export const coachApplyMsg = (n: number): string => n ? tn('ca.done', n) : '';
