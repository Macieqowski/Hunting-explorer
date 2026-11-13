/**
 * UI icons as inline SVG. They are drawn with the text colour (stroke = currentColor), so they
 * follow the theme and look the same on every phone, unlike emoji and Unicode symbols.
 * The shapes follow the Lucide style: 24 px grid, 2 px round strokes.
 */
const CLOUD = '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.500A3.500 3.500 0 0 0 7 18Z"/>';
/** The same cloud moved up, leaving room for rain, snow or a bolt below it. */
const CLOUD_UP = '<path d="M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.600 1.500A3.500 3.500 0 0 0 7 15Z"/>';
const CLOUD_LOW = '<path d="M9 20h8a3.500 3.500 0 0 0 .4-7 5 5 0 0 0-9.700 1.200A3 3 0 0 0 9 20Z"/>';

const PATHS = {
  check: '<path d="m5 12 5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.500 6.500 4 4"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.500 4 2.500 4H5"/>',
  navigate: '<path d="M3 11 21 3l-8 18-2-8-8-2Z"/>',
  pin: '<path d="M12 21s-6.500-5.600-6.500-11a6.500 6.500 0 0 1 13 0c0 5.400-6.500 11-6.500 11Z"/><circle cx="12" cy="10" r="2.300"/>',
  phone: '<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  crosshair: '<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.300-4.500L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.300 4.500L20 16"/><path d="M20 20v-4h-4"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 21h16"/>',
  wind: '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h6"/>',
  // navigation
  map: '<path d="m9 4-6 2.500v13.500l6-2.500 6 2.500 6-2.500V4l-6 2.500L9 4Z"/><path d="M9 4v13.500M15 6.500V20"/>',
  users: '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20a6.500 6.500 0 0 1 13 0"/><path d="M16 4.700a3.500 3.500 0 0 1 0 6.600M18.500 14.300A6.500 6.500 0 0 1 21.500 20"/>',
  book: '<path d="M12 6.500C10 5 7 4.500 3 4.500v14c4 0 7 .5 9 2 2-1.500 5-2 9-2v-14c-4 0-7 .5-9 2Z"/><path d="M12 6.500v14"/>',
  more: '<circle cx="5" cy="12" r="1.300" fill="currentColor"/><circle cx="12" cy="12" r="1.300" fill="currentColor"/><circle cx="19" cy="12" r="1.300" fill="currentColor"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.500h.010" stroke-width="2.600"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  android: '<rect x="6" y="3" width="12" height="18" rx="2.500"/><path d="M10.500 18h3"/>',
  paw: '<circle cx="7" cy="9" r="1.700"/><circle cx="12" cy="6.500" r="1.700"/><circle cx="17" cy="9" r="1.700"/><path d="M8 17c0-2.500 2-4.500 4-4.500s4 2 4 4.500c0 1.600-1.200 2.500-2.400 2.200-1-.3-2.200-.3-3.200 0C9.200 19.500 8 18.600 8 17Z"/>',
  message: '<path d="M21 12a8 8 0 0 1-11.600 7.100L4 20l1-4.600A8 8 0 1 1 21 12Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.500 11a6.500 6.500 0 0 0 13 0"/><path d="M12 17.500V21M8.500 21h7"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.500 6h.010M3.500 12h.010M3.500 18h.010" stroke-width="2.600"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  // theme switch
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400"/>',
  moon: '<path d="M20 14.500A8 8 0 1 1 9.500 4a6.500 6.500 0 0 0 10.500 10.500Z"/>',
  themeAuto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/>',
  // weather
  cloud: CLOUD,
  sunCloud: `<path d="M8 4V2.500M3.600 5.600l1 1M2 10h1.500M12.400 5.600l-1 1"/><path d="M5.200 11.500A3.500 3.500 0 0 1 11 8.200"/>${CLOUD_LOW}`,
  moonCloud: `<path d="M9.500 3a4.500 4.500 0 0 0 1.700 6.500A5 5 0 1 1 9.500 3Z" transform="translate(-1.500 0) scale(.8)"/>${CLOUD_LOW}`,
  fog: `${CLOUD_UP}<path d="M4 18.500h16M7 22h10"/>`,
  drizzle: `${CLOUD_UP}<path d="M9 18v1.500M15 18v1.500M12 20.500V22"/>`,
  rain: `${CLOUD_UP}<path d="m8.500 18-1 4M12.500 18l-1 4M16.500 18l-1 4"/>`,
  snow: `${CLOUD_UP}<path d="M8 18.500h.010M12 18.500h.010M16 18.500h.010M10 21.500h.010M14 21.500h.010" stroke-width="2.600"/>`,
  snowHeavy: '<path d="M12 2v20M3.300 7l17.400 10M20.700 7 3.300 17"/><path d="M9.500 4.500 12 7l2.500-2.500M9.500 19.500 12 17l2.500 2.500"/>',
  storm: `${CLOUD_UP}<path d="m13 16-3 3.500h4L11 23"/>`,
} as const;

export type IconName = keyof typeof PATHS;

/** An icon as an HTML string. It is decorative: the text or aria-label next to it carries the meaning. */
export function ic(name: IconName, size = 18): string {
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`;
}

/**
 * The Moon as seen from Poland: `fraction` of the disc lit (0 to 1), growing on the right while
 * waxing and shrinking from the right while waning.
 */
export function moonIcon(fraction: number, waxing: boolean, size = 18): string {
  const f = Math.min(1, Math.max(0, fraction));
  // The lit part is a half disc plus (gibbous) or minus (crescent) a half ellipse.
  const rx = Math.abs(1 - 2 * f) * 9;
  const lit =
    f <= 0.02
      ? ''
      : f >= 0.98
        ? '<circle class="moon-lit" cx="12" cy="12" r="9"/>'
        : `<path class="moon-lit" d="M12 3a9 9 0 0 1 0 18a${rx.toFixed(2)} 9 0 0 ${f < 0.5 ? 0 : 1} 0-18Z"${waxing ? '' : ' transform="translate(24 0) scale(-1 1)"'}/>`;
  return `<svg class="ic moon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false"><circle class="moon-dark" cx="12" cy="12" r="9"/>${lit}<circle cx="12" cy="12" r="9"/></svg>`;
}
