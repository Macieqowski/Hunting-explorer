// Pocket mode: a black, tap-proof screen to use while sharing location with the
// phone in a pocket. Browsers stop location when the screen locks, so the screen
// has to stay on; a mostly black screen costs little battery on OLED phones and
// ignores touches until the user swipes the handle across.

export interface PocketStatus {
  ok: boolean; // still sharing
  title: string;
  detail: string;
}

export interface PocketText {
  unlock: string; // "Swipe to unlock"
  hint: string;
}

let overlay: HTMLElement | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let statusOf: () => PocketStatus = () => ({ ok: true, title: '', detail: '' });

export const pocketOpen = () => !!overlay;

export function openPocket(status: () => PocketStatus, text: PocketText) {
  if (overlay) return;
  statusOf = status;
  overlay = document.createElement('div');
  overlay.className = 'pocket';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', text.hint);
  overlay.innerHTML = `
    <div class="pocket-info"><div class="pocket-time"></div><div class="pocket-title"></div><div class="pocket-detail"></div></div>
    <div class="pocket-slider" aria-hidden="true"><div class="pocket-track"><span>${text.unlock}</span></div><div class="pocket-handle">›</div></div>
    <button type="button" class="pocket-sr" data-pocket-close>${text.unlock}</button>`;
  // Swallow every touch so nothing underneath can be pressed by accident.
  for (const ev of ['click', 'dblclick', 'contextmenu', 'wheel', 'touchmove'])
    overlay.addEventListener(ev, (e) => {
      if (!(e.target as HTMLElement).closest('[data-pocket-close]')) e.preventDefault();
      e.stopPropagation();
    }, { passive: false });
  overlay.querySelector('[data-pocket-close]')!.addEventListener('click', closePocket);
  setupSlider(overlay.querySelector('.pocket-slider')!);
  document.body.append(overlay);
  document.documentElement.requestFullscreen?.().catch(() => {});
  update();
  timer = setInterval(update, 5000);
}

export function closePocket() {
  clearInterval(timer);
  overlay?.remove();
  overlay = null;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

/** Refresh the status text (also called when sharing changes). */
export function updatePocket() {
  if (overlay) update();
}

function update() {
  if (!overlay) return;
  const s = statusOf();
  overlay.classList.toggle('pocket-warn', !s.ok);
  overlay.querySelector('.pocket-time')!.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  overlay.querySelector('.pocket-title')!.textContent = s.title;
  overlay.querySelector('.pocket-detail')!.textContent = s.detail;
  // Move the text a little every minute so nothing stays lit in one place (OLED burn-in).
  const m = new Date().getMinutes();
  (overlay.querySelector('.pocket-info') as HTMLElement).style.transform = `translate(${((m * 37) % 41) - 20}px, ${((m * 53) % 81) - 40}px)`;
}

/** Drag the handle at least 85 % of the way to unlock; anything less springs back. */
function setupSlider(slider: HTMLElement) {
  const handle = slider.querySelector<HTMLElement>('.pocket-handle')!;
  let startX = 0;
  let dx = 0;
  let dragging = false;
  const max = () => slider.clientWidth - handle.offsetWidth;
  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    dx = 0;
    handle.setPointerCapture(e.pointerId);
    handle.style.transition = 'none';
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = Math.max(0, Math.min(max(), e.clientX - startX));
    handle.style.transform = `translateX(${dx}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (dx >= max() * 0.85) return closePocket();
    handle.style.transition = '';
    handle.style.transform = '';
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}
