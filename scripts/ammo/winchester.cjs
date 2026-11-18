// Winchester and Browning (same maker, same website software): product pages fill their
// ballistics table with scripts, so this one renders each page in a browser (Playwright) and
// reads the table a visitor sees (yards / fps / ft-lb). The pages show no BC; norm.py fits one
// to the table.   node scripts/ammo/winchester.cjs [browning]
const { chromium } = require('playwright');
const fs = require('fs');
const site = process.argv[2] === 'browning' ? 'browning' : 'winchester';
const B = site === 'browning' ? 'https://browningammo.com' : 'https://winchester.com';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const first = await ctx.newPage();
  await first.goto(B + '/Products/Ammunition/Rifle', { waitUntil: 'domcontentloaded', timeout: 90000 });
  const urls = [...new Set(await first.$$eval('a[href*="/Products/Ammunition/Rifle/"]', (a) => a.map((x) => x.getAttribute('href'))))]
    .filter((u) => /\/Rifle\/[^/]+\/[^/]+$/.test(u)).sort();
  await first.close();
  console.error(urls.length);
  const out = [];
  const one = async (u) => {
    const p = await ctx.newPage();
    try {
      await p.goto(B + u, { waitUntil: 'networkidle', timeout: 60000 });
      const r = await p.evaluate(() => {
        const txt = document.body.textContent.replace(/\s+/g, ' ');
        const head = (document.body.innerText.match(/\n([^\n]+, [\d.]+ Grain[^\n]*)\n/) || [])[1] || null;
        const us = [...document.querySelectorAll('table')].map((t) => [...t.rows].map((r) => [...r.cells].map((c) => c.textContent.trim())));
        const use = (txt.match(/USAGE: ?(.*?) ?BRAND:/) || [])[1] || null;
        // the page names no bullet type; norm.py reads it from this description ("hollow point", "full metal jacket"…)
        const text = (document.body.innerText.replace(/\s+/g, ' ').match(/(?:Ask a question|\$) ([^$]*?) YOU MIGHT ALSO LIKE/) || [])[1] || null;
        return { head, tables: us.filter((t) => t.length && /yards/i.test(t[0].join(' '))), use, text };
      });
      const parts = u.split('/');
      if (r.tables.length) out.push({ url: B + u, line: parts[parts.length - 2], symbol: parts[parts.length - 1], head: r.head, use: r.use, text: r.text, table: r.tables[0] });
      else console.error('NOTABLE', u);
    } catch (e) { console.error('FAIL', u, e.message.split('\n')[0]); }
    await p.close();
  };
  const queue = urls.slice();
  await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await one(queue.shift()); }));
  fs.writeFileSync((process.env.AMMO_CACHE || '.ammo-cache') + '/' + site + '.json', JSON.stringify(out));
  console.error(out.length);
  await b.close();
})();
