/**
 * The welcome page at the root of the site. The app itself is one level down, in ./app/.
 * Everything a visitor reads is plain HTML (index.html); this script only adds the QR code
 * with the download link and, when one is configured, the contact address.
 */
import '../src/fonts.css';
import '../src/tokens.css';
import './landing.css';
// Shared with the subpages made by landing/seo/, which link this same stylesheet.
import './seo/pages.css';

const qr = document.getElementById('qr');
const apk = document.getElementById('apk') as HTMLAnchorElement | null;
if (qr && apk) {
  void import('qrcode-generator').then(({ default: qrcode }) => {
    const q = qrcode(0, 'M');
    q.addData(apk.href);
    q.make();
    qr.innerHTML = q.createSvgTag({ cellSize: 6, margin: 3, scalable: true });
  });
}

// Optional: repository variable CONTACT_EMAIL (see .github/workflows/deploy.yml).
const mail = (import.meta.env.VITE_CONTACT_EMAIL ?? '').trim();
if (/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(mail)) {
  const main = document.getElementById('contact') as HTMLAnchorElement | null;
  if (main) {
    main.href = `mailto:${mail}`;
    main.textContent = `Napisz: ${mail}`;
  }
  const foot = document.getElementById('contact-foot') as HTMLAnchorElement | null;
  if (foot) {
    foot.href = `mailto:${mail}`;
    foot.hidden = false;
  }
}

// The look follows the system while nothing was chosen in the app.
try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    let pref: string | null = null;
    try {
      pref = localStorage.getItem('theme');
    } catch {
      /* no storage */
    }
    if (pref !== 'light' && pref !== 'dark') document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
  });
} catch {
  /* old browser: the look stays as it was at load */
}
