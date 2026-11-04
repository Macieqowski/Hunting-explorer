// Role symbols shared by the participant list and the hunt map: star = leader,
// crosshair = hunter, warning-triangle flag = beater. Shape and colour both differ,
// so they read in sunlight and for colour-blind users.

import type { Role } from './hunt';

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
