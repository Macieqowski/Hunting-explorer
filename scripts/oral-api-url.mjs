// Prints the address of the oral-exam grading service (worker/), or nothing when it is not there.
// Used by the site and app builds for VITE_ORAL_API_URL: without an address the oral exam works
// with self-rating only.
//
// The address is the repository variable ORAL_API_URL when set (e.g. a custom domain), otherwise
// https://<worker name>.<account's workers.dev subdomain>.workers.dev, with the subdomain read
// from the Cloudflare API (secrets CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID). The address
// is printed only if the service answers /health; ORAL_WAIT_S waits that long for it to come up.

const WORKER = 'polowanie-oral'; // "name" in worker/wrangler.jsonc
const { ORAL_API_URL, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, ORAL_WAIT_S } = process.env;
const note = (m) => console.error(`[oral-api-url] ${m}`);

async function address() {
  if (ORAL_API_URL) return ORAL_API_URL.replace(/\/+$/, '');
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) return note('no Cloudflare secrets: self-rating only'), '';
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/subdomain`, {
      headers: { authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
      signal: AbortSignal.timeout(15_000),
    });
    const sub = (await res.json())?.result?.subdomain;
    if (!res.ok || !/^[a-z0-9-]+$/.test(sub ?? '')) return note(`no workers.dev subdomain (HTTP ${res.status})`), '';
    return `https://${WORKER}.${sub}.workers.dev`;
  } catch (e) {
    return note(`Cloudflare API not reachable: ${e.message}`), '';
  }
}

async function healthy(url) {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10_000) });
    return res.ok && (await res.json())?.ok === true;
  } catch {
    return false;
  }
}

const url = await address();
if (url) {
  const until = Date.now() + (Number(ORAL_WAIT_S) || 0) * 1000;
  let ok = await healthy(url);
  while (!ok && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 5000));
    ok = await healthy(url);
  }
  if (ok) process.stdout.write(url);
  else note('the service does not answer: self-rating only');
}
