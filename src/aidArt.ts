// Simple line drawings for the first-aid steps (aid.ts). Drawn with the text colour, the parts
// that matter (pressure, the tourniquet, the wound) in the danger colour, so they follow the theme.
// No photos of wounds on purpose: a drawing shows what to do, a photo mostly frightens.

import type { AidArt } from './aid';

const H = 'class="aa-h"'; // highlight: drawn in the danger colour
const F = 'class="aa-f"'; // filled with the danger colour

/** A lying person seen from the side, head on the left, at ground y = 54. */
const LYING = '<circle cx="18" cy="42" r="6"/><path d="M24 44h44M30 44l-4 10M68 44l10 10M68 44l14 4"/><path d="M6 56h108"/>';
/** A kneeling helper whose hands reach to (x, 40). */
const helper = (x: number) => `<circle cx="${x + 10}" cy="12" r="5"/><path d="M${x + 10} 17l-2 16 8 8 0 13M${x + 8} 33l-10 4M${x + 10} 20l-8 18"/>`;

const ART: Record<AidArt, string> = {
  safety:
    '<path d="M20 50 96 20"/><path d="M96 20l8-3M30 46l-6 14M38 43l2 6"/><rect x="42" y="36" width="10" height="5" rx="1" transform="rotate(-21 47 38)"/>' +
    `<path ${H} d="M70 44l14 14M84 44 70 58"/><circle ${H} cx="77" cy="51" r="11"/>`,
  press: `${LYING}${helper(52)}<path ${H} d="M44 38h16M52 34v8"/><circle ${F} cx="52" cy="44" r="2.500"/><path ${H} d="M52 26v8M48 30l4 4 4-4"/>`,
  pack:
    '<path d="M14 30c20-8 72-8 92 0v18c-20 8-72 8-92 0Z"/>' +
    `<path ${H} d="M50 36c4-6 16-6 20 0-4 6-16 6-20 0Z"/><path d="M56 36c2-10 14-14 22-10M60 36c3-6 9-8 14-6"/><path ${H} d="M60 14v10M56 20l4 4 4-4"/>`,
  tourniquet:
    '<path d="M10 28h96c6 0 6 16 0 16H10"/>' +
    `<rect ${H} x="50" y="23" width="8" height="26" rx="2"/><path ${H} d="M54 18v-8M48 10h12"/>` +
    `<circle ${F} cx="86" cy="36" r="3"/><path d="M62 54h22M62 51v6M84 51v6"/><text x="73" y="64" text-anchor="middle" font-size="9" stroke="none" fill="currentColor">5–7 cm</text>`,
  chest:
    '<path d="M36 8c-8 6-12 18-12 30s4 20 12 24h48c8-4 12-12 12-24s-4-24-12-30"/><path d="M60 14v44"/><path d="M42 26c6 4 10 4 14 0M64 26c4 4 8 4 14 0"/>' +
    `<circle ${F} cx="74" cy="40" r="3"/><path ${H} d="M80 34l8-6M82 40h10M80 46l8 6"/>`,
  airway:
    '<path d="M30 52c0-18 10-30 26-30 10 0 16 6 18 14l6 4-6 4c0 6-4 8-10 8H50"/><path d="M6 56h108"/>' +
    `<path ${H} d="M48 16c6-6 18-6 24 2M74 46l8 8M82 54h-8"/>`,
  breathing:
    '<path d="M30 52c0-18 10-30 26-30 10 0 16 6 18 14l6 4-6 4c0 6-4 8-10 8H50"/><path d="M6 56h108"/>' +
    `<path ${H} d="M86 30c4 2 4 8 0 10M92 26c7 4 7 14 0 18M98 22c10 6 10 20 0 26"/>`,
  cpr: `${LYING}<circle cx="44" cy="10" r="5"/><path d="M44 15v12l-4 14M44 18l-6 18M44 18l2 18M44 27l14 12v15"/>` + `<path ${H} d="M40 22v14M36 32l4 4 4-4"/><text x="88" y="24" font-size="11" stroke="none" fill="currentColor" text-anchor="middle">30 : 2</text>`,
  recovery:
    '<circle cx="22" cy="42" r="6"/><path d="M28 42c12-2 22-2 34 0M62 42l18-4 8 16M62 42l12 12M34 42l4-12 10 0M30 48l12 4"/><path d="M6 56h108"/>' +
    `<path ${H} d="M14 34c-4 2-4 6 0 8"/>`,
  head:
    '<circle cx="60" cy="38" r="10"/><path d="M60 48v8M50 56h20"/><path d="M6 60h108"/>' +
    `<path ${H} d="M44 26c-6 6-6 18 0 24M76 26c6 6 6 18 0 24"/><path d="M40 20l4 6M80 20l-4 6"/>`,
  splint:
    '<path d="M10 30h40l20 6h40M10 42h40l20-6"/><path d="M70 36v6h40"/>' +
    `<path ${H} d="M20 24h70v4H20zM20 46h70v4H20z"/><path d="M32 22v30M58 22v30M82 22v30"/>`,
  cold:
    `${LYING}<path d="M14 50h72" stroke-width="5" stroke-opacity=".35"/><path ${H} d="M24 38c10-8 34-8 50 0"/>` +
    '<path d="M92 10h18M96 16h14M90 22h18"/>',
  heart:
    `<path ${H} d="M60 56C40 42 28 32 28 22a12 12 0 0 1 32-6 12 12 0 0 1 32 6c0 10-12 20-32 34Z"/>` +
    '<path d="M36 30h10l4-8 6 16 4-8h24"/>',
  face:
    '<circle cx="60" cy="34" r="22"/><circle cx="52" cy="28" r="2"/><circle cx="68" cy="28" r="2"/>' +
    `<path ${H} d="M48 44c6 2 10 2 14 0l8 6"/><text x="106" y="20" text-anchor="middle" font-size="10" stroke="none" fill="currentColor">godz.</text><path d="M96 26h20M106 26v12"/>`,
  pen:
    '<path d="M30 10c-10 20-10 34 0 50M56 10c8 20 8 34 0 50"/>' +
    `<rect ${H} x="64" y="16" width="12" height="36" rx="3" transform="rotate(30 70 34)"/><path ${H} d="M52 46l-6 4"/><path d="M70 6l-2 8"/>`,
  snake:
    '<path d="M10 40h60c10 0 10 12 0 12H10"/>' +
    `<circle ${F} cx="52" cy="44" r="1.800"/><circle ${F} cx="58" cy="44" r="1.800"/>` +
    `<path ${H} d="M20 34h40v4H20zM20 54h40v4H20z"/><path d="M84 30c6-8 16-4 14 4s-12 6-10 14 14 6 18 0"/>`,
  sugar:
    '<path d="M44 20h28l-4 38H48Z"/><path d="M48 30h20"/>' +
    `<rect ${H} x="80" y="34" width="10" height="10" rx="2"/><rect ${H} x="92" y="42" width="10" height="10" rx="2"/><path d="M58 8c4 4-2 6 2 10"/>`,
  frost:
    '<path d="M30 56V30a4 4 0 0 1 8 0v-6a4 4 0 0 1 8 0v4a4 4 0 0 1 8 0v4a4 4 0 0 1 8 0v24"/>' +
    `<path ${H} d="M90 14v28M78 21l24 14M78 35l24-14M86 14l4 4 4-4M86 42l4-4 4 4"/>`,
  ice:
    '<path d="M6 30h40M74 30h40"/><path d="M46 30l6 6 10-6 12 0"/><path d="M50 40c6 4 14 4 20 0M46 50c8 4 20 4 28 0"/><circle cx="60" cy="34" r="5"/>' +
    `<path ${H} d="M100 26 70 34"/><path d="M104 24c4 0 8 2 8 6"/>`,
  phone:
    '<rect x="44" y="6" width="32" height="54" rx="5"/><path d="M54 52h12"/>' +
    `<text x="60" y="38" text-anchor="middle" font-size="15" font-weight="700" stroke="none" ${F}>112</text>`,
};

/** The drawing for a step, sized by CSS (.aa). */
export function aidArt(a: AidArt | undefined): string {
  if (!a) return '';
  return `<svg class="aa" viewBox="0 0 120 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round">${ART[a]}</svg>`;
}

export const AID_ARTS = Object.keys(ART) as AidArt[];
