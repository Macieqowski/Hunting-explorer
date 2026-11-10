/**
 * The pull-up sheet that holds the lists beside the map on a phone. It has three heights:
 * "peek" (the handle, the tabs and the search field), "half" and "full". Drag the handle or tap
 * it; the app also moves it (a tapped district opens it half way, typing in search opens it fully).
 * On a computer the same element is a plain side panel and none of this applies.
 */
export type SheetState = 'peek' | 'half' | 'full';

/** Height of the peek state in px; style.css uses the same number (--peek). */
export const PEEK_PX = 132;

/** Fraction of the map area each state takes; peek is a fixed height. */
const HALF = 0.5;

export function sheetHeight(state: SheetState, areaPx: number): number {
  if (state === 'peek') return Math.min(PEEK_PX, areaPx);
  if (state === 'half') return Math.max(PEEK_PX, Math.round(areaPx * HALF));
  return Math.max(PEEK_PX, areaPx - 8);
}

const ORDER: readonly SheetState[] = ['peek', 'half', 'full'];

/**
 * Where a released sheet settles: the state whose height is closest to `px`, or, after a quick
 * flick (`velocity` in px/ms, negative = upwards), the next state in the flick's direction.
 */
export function nearestState(px: number, areaPx: number, velocity = 0): SheetState {
  if (velocity < -0.5) return ORDER.find((s) => sheetHeight(s, areaPx) > px) ?? 'full';
  if (velocity > 0.5) return [...ORDER].reverse().find((s) => sheetHeight(s, areaPx) < px) ?? 'peek';
  let best: SheetState = 'peek';
  for (const s of ORDER) if (Math.abs(sheetHeight(s, areaPx) - px) < Math.abs(sheetHeight(best, areaPx) - px)) best = s;
  return best;
}

export interface Sheet {
  get(): SheetState;
  set(s: SheetState): void;
  /** True on a phone-sized screen, where the panel is a sheet. */
  active(): boolean;
  /** How much of the map the sheet covers beyond the peek strip, in px. */
  cover(): number;
}

export function createSheet(panel: HTMLElement, handle: HTMLElement, isSheet: () => boolean): Sheet {
  let state: SheetState = 'peek';
  const area = () => panel.parentElement?.clientHeight ?? window.innerHeight;
  const apply = () => {
    panel.dataset.sheet = state;
    handle.setAttribute('aria-expanded', String(state !== 'peek'));
  };
  apply();

  let drag: { y: number; h: number; t: number; lastY: number; lastT: number; moved: boolean } | null = null;
  handle.addEventListener('pointerdown', (e) => {
    if (!isSheet()) return;
    drag = { y: e.clientY, h: panel.getBoundingClientRect().height, t: e.timeStamp, lastY: e.clientY, lastT: e.timeStamp, moved: false };
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) < 6) return;
    drag.moved = true;
    panel.classList.add('dragging');
    panel.style.height = `${Math.max(PEEK_PX, Math.min(area() - 8, drag.h - dy))}px`;
    drag.lastY = e.clientY;
    drag.lastT = e.timeStamp;
  });
  const end = (e: PointerEvent) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    panel.classList.remove('dragging');
    if (d.moved) {
      const h = panel.getBoundingClientRect().height;
      const dt = Math.max(1, e.timeStamp - d.t);
      state = nearestState(h, area(), (e.clientY - d.y) / dt);
      // The click that follows a drag must not toggle the sheet again.
      handle.dataset.dragged = '1';
      setTimeout(() => delete handle.dataset.dragged, 0);
    }
    panel.style.height = '';
    apply();
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('click', () => {
    if (!isSheet() || handle.dataset.dragged) return;
    state = state === 'peek' ? 'half' : state === 'half' ? 'full' : 'peek';
    apply();
  });

  return {
    get: () => state,
    set(s) {
      state = s;
      apply();
    },
    active: isSheet,
    cover: () => (isSheet() ? Math.max(0, sheetHeight(state, area()) - PEEK_PX) : 0),
  };
}
