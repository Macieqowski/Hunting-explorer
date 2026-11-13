/**
 * Visitor statistics: Cloudflare Web Analytics. No cookies and nothing kept on the device, so
 * the site needs no consent banner. Switched on by the repository variable CF_ANALYTICS_TOKEN
 * (the token from the snippet Cloudflare shows under Web Analytics → Add a site); without it
 * nothing is added to the pages.
 *
 * The beacon only loads on the public address, so the Android app (which carries the same
 * files), local builds and previews are not counted. It records the path without the #/…
 * part of the address, so hunt ids and invitation tokens never leave the device.
 */
export const SITE_HOST = 'www.polowanie.org';

export function analyticsSnippet(token: string | undefined): string {
  const t = (token ?? '').trim();
  if (!/^[A-Za-z0-9]{16,64}$/.test(t)) return '';
  return `<script>(function(){if(location.hostname!==${JSON.stringify(SITE_HOST)})return;var s=document.createElement('script');s.defer=true;s.src='https://static.cloudflareinsights.com/beacon.min.js';s.setAttribute('data-cf-beacon',${JSON.stringify(JSON.stringify({ token: t }))});document.head.appendChild(s);})();</script>`;
}
