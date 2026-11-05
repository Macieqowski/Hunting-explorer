// Simple SVG drawings of cloven-hoof tracks, drawn from typical sizes (no copied artwork).
// Every print is drawn at the same scale (14 px per cm, with a 5 cm bar) so species compare at a glance.

export interface HoofPrint {
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

export function hoofSvg(p: HoofPrint, label: string): string {
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
  // Scale bar: 5 cm.
  const bar = `<g class="scale"><path d="M${PX},${h - PX} h${5 * PX}" /><path d="M${PX},${h - PX - 4} v8 M${6 * PX},${h - PX - 4} v8"/><text x="${3.5 * PX}" y="${h - PX - 7}">5 cm</text></g>`;
  return `<svg class="atlas-track" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">
    <g class="hoof"><path d="${right}"/>${left}</g>${dews}${bar}</svg>`;
}
