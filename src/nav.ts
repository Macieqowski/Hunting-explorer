/**
 * Where a person can be in the app, and the address of each place.
 *
 * The five destinations of the bottom bar (phone) and the top bar (computer) are "areas".
 * Every view belongs to one of them. Addresses are the #/… part of the link; old links
 * (invitations, QR codes, bookmarks) must keep resolving, so nothing here is ever renamed.
 */
export type Tab = 'clubs' | 'districts' | 'stats' | 'offline' | 'seasons' | 'exams' | 'weather' | 'hunt' | 'ballistics' | 'about' | 'more';
export type View =
  | { kind: 'tab'; tab: Tab }
  | { kind: 'district'; slug: string }
  | { kind: 'club'; key: string }
  | { kind: 'point'; lat: number; lng: number }
  | { kind: 'hunt'; id: string; invite?: string }
  | { kind: 'atlas'; slug: string | null }
  | { kind: 'guide'; role: GuideRole | null };

/** The group hunt guides (instrukcje), one per role, under #/instrukcja/<slug>. */
export type GuideRole = 'leader' | 'hunter' | 'beater';
export const GUIDE_ROLES: readonly GuideRole[] = ['leader', 'hunter', 'beater'];
export const GUIDE_SLUG: Record<GuideRole, string> = { leader: 'prowadzacy', hunter: 'mysliwy', beater: 'naganiacz' };
export const guideRoleOf = (slug: string | undefined): GuideRole | null => GUIDE_ROLES.find((r) => GUIDE_SLUG[r] === slug) ?? null;

export type Area = 'map' | 'hunt' | 'weather' | 'know' | 'more';
export const AREAS: readonly Area[] = ['map', 'hunt', 'weather', 'know', 'more'];

/** The reference pages grouped under "Wiedza". */
export type KnowPage = 'seasons' | 'atlas' | 'exams' | 'ballistics';
export const KNOW_PAGES: readonly KnowPage[] = ['seasons', 'atlas', 'exams', 'ballistics'];

/** Lists shown beside the map (in the pull-up sheet on a phone). */
export type MapTab = 'clubs' | 'districts' | 'stats' | 'offline';
export const MAP_TABS: readonly MapTab[] = ['clubs', 'districts', 'stats', 'offline'];

export function areaOf(v: View): Area {
  if (v.kind === 'hunt' || v.kind === 'guide') return 'hunt';
  if (v.kind === 'atlas') return 'know';
  if (v.kind !== 'tab') return 'map';
  switch (v.tab) {
    case 'hunt':
      return 'hunt';
    case 'weather':
      return 'weather';
    case 'seasons':
    case 'exams':
    case 'ballistics':
      return 'know';
    case 'more':
    case 'about':
      return 'more';
    default:
      return 'map';
  }
}

/** Which "Wiedza" page a view is, or null outside that area. */
export function knowPageOf(v: View): KnowPage | null {
  if (v.kind === 'atlas') return 'atlas';
  if (v.kind === 'tab' && (v.tab === 'seasons' || v.tab === 'exams' || v.tab === 'ballistics')) return v.tab;
  return null;
}

export const knowView = (p: KnowPage): View => (p === 'atlas' ? { kind: 'atlas', slug: null } : { kind: 'tab', tab: p });

export function viewToHash(v: View): string {
  switch (v.kind) {
    case 'tab':
      return v.tab === 'clubs' ? '' : v.tab === 'hunt' ? '#/polowanie' : v.tab === 'more' ? '#/wiecej' : `#/${v.tab}`;
    case 'hunt':
      return `#/polowanie/${encodeURIComponent(v.id)}${v.invite ? `/${v.invite}` : ''}`;
    case 'atlas':
      return v.slug ? `#/atlas/${v.slug}` : '#/atlas';
    case 'guide':
      return v.role ? `#/instrukcja/${GUIDE_SLUG[v.role]}` : '#/instrukcja';
    case 'district':
      return `#/obwod/${v.slug}`;
    case 'club':
      return `#/kolo/${encodeURIComponent(v.key)}`;
    case 'point':
      return `#/punkt/${v.lat.toFixed(5)},${v.lng.toFixed(5)}`;
  }
}

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export function hashToView(h: string): View {
  const [, kind, arg, arg2] = h.replace(/^#/, '').split('/');
  if (kind === 'obwod' && arg) return { kind: 'district', slug: arg };
  // #/polowanie/<hunt>/<invitation token>
  if (kind === 'polowanie') return arg ? { kind: 'hunt', id: safeDecode(arg), ...(arg2 ? { invite: arg2 } : {}) } : { kind: 'tab', tab: 'hunt' };
  if (kind === 'atlas') return { kind: 'atlas', slug: arg || null };
  if (kind === 'instrukcja') return { kind: 'guide', role: guideRoleOf(arg) };
  if (kind === 'kolo' && arg) return { kind: 'club', key: safeDecode(arg) };
  if (kind === 'punkt' && arg) {
    const [lat, lng] = arg.split(',').map(Number);
    if (isFinite(lat) && isFinite(lng)) return { kind: 'point', lat, lng };
  }
  if (kind === 'wiecej') return { kind: 'tab', tab: 'more' };
  if (['districts', 'stats', 'offline', 'seasons', 'exams', 'weather', 'ballistics', 'about'].includes(kind)) return { kind: 'tab', tab: kind as Tab };
  return { kind: 'tab', tab: 'clubs' };
}
