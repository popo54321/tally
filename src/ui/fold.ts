// Every card on Body, Workout, Guide and My Gym can be folded shut to just its heading. The state is
// remembered (settings.chartFold) and a folded card stays folded after a restart.
import { FOLD_KEYS, CHART_FOLDS } from '../data/folds';
import { S } from '../state/app';
import { t } from '../i18n/index';
import { persistSettings } from './shared';
import { render } from './nav';

const PAGES = ['pg-body', 'pg-workout', 'pg-guide', 'pg-gym'];
const btnOf = (k: string) => document.querySelector(`.foldbtn[data-fold="${k}"]`) as HTMLButtonElement | null;

function keyOf(card: HTMLElement, lbl: HTMLElement): string {
  if (card.id) return card.id;
  return (lbl.getAttribute('data-i18n-html') || lbl.getAttribute('data-i18n') || '').replace(/\W/g, '_');
}

/**
 * Puts a fold button in the top-right corner of every foldable card that has none yet (the trend charts
 * already have one in their heading row), and makes the heading itself a second place to tap.
 * Nothing else on the card moves. Call once at start-up.
 */
export function initFold(): void {
  for (const p of PAGES) document.querySelectorAll<HTMLElement>(`#${p} > .card`).forEach(card => {
    if (card.querySelector(':scope > .foldhead, :scope > .foldbtn')) return;
    const lbl = card.querySelector(':scope > .lbl') as HTMLElement | null;
    if (!lbl) return;
    const key = keyOf(card, lbl);
    if (FOLD_KEYS.indexOf(key) < 0) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'foldbtn corner'; b.dataset.fold = key; b.setAttribute('aria-expanded', 'true');
    card.classList.add('hasfold'); lbl.classList.add('foldlbl'); lbl.after(b);
    lbl.addEventListener('click', () => { void foldToggle(key); });
    b.addEventListener('click', () => { void foldToggle(key); });
  });
}

/** Shows card 'k' folded or open. */
export function foldDraw(k: string, folded: boolean): void {
  const b = btnOf(k); if (!b) return;
  const card = b.closest('.card') as HTMLElement; card.classList.toggle('folded', folded);
  b.textContent = folded ? '▸' : '▾'; b.setAttribute('aria-expanded', String(!folded));
  const chart = CHART_FOLDS.indexOf(k) >= 0;
  b.title = t(folded ? (chart ? 'chart.unfold' : 'fold.show') : (chart ? 'chart.fold' : 'fold.hide')); b.setAttribute('aria-label', b.title);
}

/** Applies the saved state to every card except the trend charts, which decide for themselves (they start folded while empty). */
export function foldApplyAll(): void {
  document.querySelectorAll<HTMLElement>('.foldbtn[data-fold]').forEach(b => {
    const k = b.dataset.fold as string;
    if (CHART_FOLDS.indexOf(k) < 0) foldDraw(k, S.settings.chartFold[k] === true);
  });
}

export async function foldToggle(k: string): Promise<void> {
  const b = btnOf(k); if (!b) return;
  const folded = (b.closest('.card') as HTMLElement).classList.contains('folded');
  S.settings.chartFold = Object.assign({}, S.settings.chartFold, { [k]: !folded });
  await persistSettings(); foldDraw(k, !folded); render();
}
