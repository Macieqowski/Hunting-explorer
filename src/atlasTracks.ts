// Simple SVG drawings of tracks (cloven hooves, paws, hare and bird feet), drawn from typical
// sizes (no copied artwork).
// Every print is drawn at the same scale (14 px per cm, with a 5 cm bar) so species compare at a glance.

export interface HoofPrint {
  kind?: 'hoof';
  /** Typical print length in cm (hoof tips to heel), without dewclaws. */
  len: number;
  /** Typical print width in cm. */
  width: number;
  /** Tip shape: pointed (roe, mouflon), medium (deer), blunt (boar, elk). */
  tip: 'pointed' | 'medium' | 'blunt';
  /** Dewclaw marks: none on firm ground, only on soft ground, or nearly always (boar). */
  dew: 'soft' | 'always';
  /** Dewclaws set wide, outside the hoof line (boar), or in line behind it (deer). */
  dewWide?: boolean;
  /** Gap between the two halves in cm (elk hooves often splay). */
  gap?: number;
}

/** Paw of a carnivore: canid (4 toes, oval), mustelid (5 toes in an arc), badger (5 toes in a row, long claws). */
export interface PawPrint {
  kind: 'paw';
  len: number;
  width: number;
  style: 'canid' | 'mustelid' | 'badger';
}

/** Hare or rabbit hind foot: long, hairy, without clear pads. */
export interface HarePrint {
  kind: 'hare';
  len: number;
  width: number;
}

/** Bird foot: three toes forward and a hind toe; webbed (ducks, geese) or lobed (coot). */
export interface BirdPrint {
  kind: 'bird';
  len: number;
  width: number;
  feet: 'game' | 'webbed' | 'lobed';
  hind: 'none' | 'short' | 'long';
}

export type TrackPrint = HoofPrint | PawPrint | HarePrint | BirdPrint;

const FRAME_W = 10; // cm
const PX = 14; // px per cm

/** One half of the hoof as a closed path, for the right half (mirrored for the left). */
function halfPath(p: HoofPrint, x0: number, y0: number): string {
  const L = p.len * PX;
  const W = (p.width / 2) * PX * 0.92;
  const tipBend = p.tip === 'pointed' ? 0.15 : p.tip === 'medium' ? 0.32 : 0.55;
  // x0,y0 = inner edge at the heel. The inner edge is straight, the outer edge bulges.
  const tipX = x0 + W * tipBend * 0.6;
  const tipY = y0 - L;
  return [
    `M${x0.toFixed(1)},${y0.toFixed(1)}`,
    // inner edge up to the tip
    `L${(x0 + 0.5).toFixed(1)},${(tipY + L * 0.12).toFixed(1)}`,
    `Q${x0.toFixed(1)},${tipY.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)}`,
    // round over the outer side down to the heel
    `C${(x0 + W * 1.05).toFixed(1)},${(tipY + L * tipBend * 0.5).toFixed(1)} ${(x0 + W * 1.08).toFixed(1)},${(y0 - L * 0.35).toFixed(1)} ${(x0 + W * 0.9).toFixed(1)},${(y0 - L * 0.08).toFixed(1)}`,
    `Q${(x0 + W * 0.6).toFixed(1)},${(y0 + L * 0.04).toFixed(1)} ${x0.toFixed(1)},${y0.toFixed(1)}Z`,
  ].join(' ');
}

function hoofSvg(p: HoofPrint, label: string): string {
  const w = FRAME_W * PX;
  const h = (p.len + 6.6) * PX;
  const cx = w / 2;
  const gap = ((p.gap ?? 0.25) * PX) / 2;
  const heelY = h - 4.6 * PX;
  const right = halfPath(p, cx + gap, heelY);
  const left = `<path d="${right}" transform="translate(${2 * cx} 0) scale(-1 1)"/>`;
  // Dewclaws: small ovals behind the heel.
  const dy = heelY + (p.dewWide ? 1.2 : 1.6) * PX;
  const dx = (p.dewWide ? p.width * 0.62 : p.width * 0.32) * PX;
  const r = Math.max(0.35, p.width * 0.1) * PX;
  const dewStyle = p.dew === 'always' ? 'class="dew"' : 'class="dew soft"';
  const dews = `<ellipse ${dewStyle} cx="${cx - dx}" cy="${dy}" rx="${r * 0.8}" ry="${r}"/><ellipse ${dewStyle} cx="${cx + dx}" cy="${dy}" rx="${r * 0.8}" ry="${r}"/>`;
  return frame(w, h, label, `<g class="hoof"><path d="${right}"/>${left}</g>${dews}`);
}

const f1 = (n: number) => n.toFixed(1);

/** Wraps a drawing with the 5 cm scale bar. */
function frame(w: number, h: number, label: string, body: string): string {
  const bar = `<g class="scale"><path d="M${PX},${h - PX} h${5 * PX}" /><path d="M${PX},${h - PX - 4} v8 M${6 * PX},${h - PX - 4} v8"/><text x="${3.5 * PX}" y="${h - PX - 7}">5 cm</text></g>`;
  return `<svg class="atlas-track" viewBox="0 0 ${f1(w)} ${f1(h)}" width="${f1(w)}" height="${f1(h)}" role="img" aria-label="${label}">
    <g class="hoof">${body}</g>${bar}</svg>`;
}

const ell = (x: number, y: number, rx: number, ry: number, rot = 0, cls = '') =>
  `<ellipse${cls ? ` class="${cls}"` : ''} cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f1(ry)}"${rot ? ` transform="rotate(${f1(rot)} ${f1(x)} ${f1(y)})"` : ''}/>`;

function pawSvg(p: PawPrint, label: string): string {
  const w = Math.max(FRAME_W, p.width + 4) * PX;
  const h = (p.len + (p.style === 'badger' ? 4.6 : 3.6)) * PX + 2 * PX;
  const cx = w / 2;
  const L = p.len * PX;
  const W = p.width * PX;
  const base = h - 3.2 * PX; // bottom of the main pad
  const parts: string[] = [];
  const claw = (x: number, y: number, rot: number, len: number) => ell(x, y, len * 0.18, len * 0.5, rot);
  if (p.style === 'canid') {
    // Main pad (triangular-ish), two front toes ahead, two side toes behind them.
    parts.push(ell(cx, base - L * 0.17, W * 0.24, L * 0.17));
    const ty = base - L * 0.62;
    const toe = (x: number, y: number) => ell(x, y, W * 0.15, L * 0.14);
    parts.push(toe(cx - W * 0.13, ty), toe(cx + W * 0.13, ty), toe(cx - W * 0.36, ty + L * 0.2), toe(cx + W * 0.36, ty + L * 0.2));
    parts.push(
      claw(cx - W * 0.13, ty - L * 0.24, 0, L * 0.12),
      claw(cx + W * 0.13, ty - L * 0.24, 0, L * 0.12),
      claw(cx - W * 0.42, ty + L * 0.02, -15, L * 0.1),
      claw(cx + W * 0.42, ty + L * 0.02, 15, L * 0.1),
    );
  } else if (p.style === 'mustelid') {
    parts.push(ell(cx, base - L * 0.2, W * 0.32, L * 0.2));
    const r = W * 0.42;
    const cy = base - L * 0.3;
    for (const a of [-62, -30, 0, 30, 62]) {
      const t = (a * Math.PI) / 180;
      const x = cx + Math.sin(t) * r;
      const y = cy - Math.cos(t) * r * 1.15;
      parts.push(ell(x, y, W * 0.09, L * 0.11, a));
      parts.push(claw(x + Math.sin(t) * L * 0.18, y - Math.cos(t) * L * 0.18, a, L * 0.08));
    }
  } else {
    // Badger: wide kidney-shaped pad, five toes almost in a line, long claws.
    parts.push(ell(cx, base - L * 0.18, W * 0.42, L * 0.18));
    const ty = base - L * 0.52;
    [-0.4, -0.2, 0, 0.2, 0.4].forEach((k, i) => {
      const y = ty - (i === 2 ? L * 0.04 : i === 0 || i === 4 ? -L * 0.04 : 0);
      parts.push(ell(cx + W * k, y, W * 0.085, L * 0.1));
      parts.push(ell(cx + W * k * 1.05, y - L * 0.3, W * 0.03, L * 0.13));
    });
  }
  return frame(w, h, label, parts.join(''));
}

function hareSvg(p: HarePrint, label: string): string {
  const w = Math.max(FRAME_W, p.width + 4) * PX;
  const h = (p.len + 4) * PX;
  const cx = w / 2;
  const L = p.len * PX;
  const W = p.width * PX;
  const base = h - 3.4 * PX;
  const body = `<path class="fuzzy" d="M${f1(cx)},${f1(base)} C${f1(cx - W * 0.7)},${f1(base)} ${f1(cx - W * 0.55)},${f1(base - L * 0.85)} ${f1(cx)},${f1(base - L)} C${f1(cx + W * 0.55)},${f1(base - L * 0.85)} ${f1(cx + W * 0.7)},${f1(base)} ${f1(cx)},${f1(base)}Z"/>`;
  const toes = [-0.22, -0.07, 0.07, 0.22].map((k, i) => ell(cx + W * k, base - L * (i === 0 || i === 3 ? 0.8 : 0.88), W * 0.08, L * 0.07)).join('');
  return frame(w, h, label, body + toes);
}

function birdSvg(p: BirdPrint, label: string): string {
  const w = Math.max(FRAME_W, p.width + 4) * PX;
  const hindLen = p.hind === 'long' ? p.len * 0.45 : p.hind === 'short' ? p.len * 0.15 : 0;
  const h = (p.len + hindLen / 1 + 4) * PX;
  const cx = w / 2;
  const heelY = h - (3 + hindLen) * PX;
  const L = p.len * PX;
  const spread = Math.atan2(p.width / 2, p.len * 0.85);
  const tips = [-spread, 0, spread].map((a) => [cx + Math.sin(a) * (a ? L * 0.88 : L), heelY - Math.cos(a) * (a ? L * 0.88 : L)] as const);
  const sw = p.feet === 'game' ? 0.28 : 0.22;
  const toe = ([x, y]: readonly [number, number]) => `<path class="toe" style="stroke-width:${f1(sw * PX)}" d="M${f1(cx)},${f1(heelY)} L${f1(x)},${f1(y)}"/>`;
  const parts: string[] = [];
  if (p.feet === 'webbed') {
    const [a, b, c] = tips;
    parts.push(
      `<path class="web" d="M${f1(cx)},${f1(heelY)} L${f1(a[0])},${f1(a[1])} Q${f1((a[0] + b[0]) / 2)},${f1((a[1] + b[1]) / 2 + L * 0.3)} ${f1(b[0])},${f1(b[1])} Q${f1((b[0] + c[0]) / 2)},${f1((b[1] + c[1]) / 2 + L * 0.3)} ${f1(c[0])},${f1(c[1])}Z"/>`,
    );
  }
  parts.push(...tips.map(toe));
  if (p.feet === 'lobed')
    tips.forEach(([x, y]) => {
      const rot = (Math.atan2(x - cx, heelY - y) * 180) / Math.PI;
      for (const k of [0.35, 0.62, 0.86]) parts.push(ell(cx + (x - cx) * k, heelY + (y - heelY) * k, PX * 0.42, PX * 0.6, rot));
    });
  if (hindLen) parts.push(`<path class="toe" style="stroke-width:${f1(sw * PX)}" d="M${f1(cx)},${f1(heelY)} L${f1(cx)},${f1(heelY + hindLen * PX)}"/>`);
  parts.push(ell(cx, heelY, PX * 0.35, PX * 0.35));
  return frame(w, h, label, parts.join(''));
}

/** Draws any track to scale. */
export function trackSvg(p: TrackPrint, label: string): string {
  switch (p.kind) {
    case 'paw':
      return pawSvg(p, label);
    case 'hare':
      return hareSvg(p, label);
    case 'bird':
      return birdSvg(p, label);
    default:
      return hoofSvg(p, label);
  }
}
