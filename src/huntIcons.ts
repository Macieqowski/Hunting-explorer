// Role symbols shared by the participant list and the hunt map: star = leader,
// crosshair = hunter, warning-triangle flag = beater. Shape and colour both differ,
// so they read in sunlight and for colour-blind users.

import type { Role, Species } from './hunt';

export const ROLE_COLOR: Record<Role, string> = { leader: '#166534', hunter: '#b91c1c', beater: '#ea580c' };

/** Inline SVG for a role, `size` px square. */
export function roleIcon(role: Role, size = 20): string {
  const svg = (body: string) =>
    `<svg class="h-icon h-icon-${role}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  switch (role) {
    case 'leader':
      return svg(
        '<circle cx="12" cy="12" r="11" fill="#166534" stroke="#fff" stroke-width="1.5"/><path fill="#fff" d="m12 5 2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7L5.2 10l4.7-.7z"/>',
      );
    case 'hunter':
      return svg(
        '<circle cx="12" cy="12" r="11" fill="#b91c1c" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="none" stroke="#fff" stroke-width="2"/><path stroke="#fff" stroke-width="2" d="M12 3v5M12 16v5M3 12h5M16 12h5"/>',
      );
    case 'beater':
      return svg('<path d="M12 1.5 23 21.5H1z" fill="#ea580c" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path stroke="#fff" stroke-width="2" d="M7 17h10"/>');
  }
}


export const SPECIES_COLOR: Record<Species, string> = { deer: '#92400e', boar: '#1f2937', roe: '#b45309', predator: '#7f1d1d' };

/** Inline SVG for a game species: a coloured disc with a simple white mark (antlers, tusks, small antlers, ears). */
export function speciesIcon(sp: Species, size = 24): string {
  const marks: Record<Species, string> = {
    // red deer: wide branched antlers
    deer: '<path d="M12 18v-5M12 13 7 8M7 8 6 5M7 8 4 8M12 13l5-5M17 8l1-3M17 8h3M9.5 10.5 8 11M14.5 10.5 16 11"/>',
    // boar: snout and curved tusks
    boar: '<path d="M7 9c2-2 8-2 10 0M8 12h8M9 15c1 2 5 2 6 0M8 12c-1 2-2 2-3 1M16 12c1 2 2 2 3 1"/>',
    // roe deer: short straight antlers
    roe: '<path d="M10 18v-5l-2-6M14 18v-5l2-6M9 10 7.5 9M15 10l1.5-1"/>',
    // predator: pointed ears and narrow snout (fox / wolf)
    predator: '<path d="M6 6l3 5h6l3-5M9 11l3 7 3-7"/>',
  };
  return `<svg class="h-icon hs-icon-${sp}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="${SPECIES_COLOR[sp]}" stroke="#fff" stroke-width="1.5"/><g fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${marks[sp]}</g></svg>`;
}
