// FENIKS iter6: «Отчет» rp-ads rows with «за заказ» for selected months (#rp-month); usage: node fx6_report.mjs <sandbox> <YYYY-MM> ...
import { chromium } from 'playwright-core';
const S = '/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6/';
const [sb, ...yms] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
await p.goto('file://' + S + sb + '/analytics-mvp/public/katya-report.html'); await p.waitForTimeout(2800);
const opts = await p.evaluate(() => [...document.querySelectorAll('#rp-month option')].map(o => o.value));
console.log(JSON.stringify({ sb, options: opts }));
for (const ym of yms) {
  await p.evaluate((ym) => { const s = document.getElementById('rp-month'); s.value = ym; s.dispatchEvent(new Event('change', { bubbles: true })); }, ym);
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => {
    const t = document.getElementById('rp-ads'); if (!t) return null;
    const h = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim());
    const rows = [...t.querySelectorAll('tbody tr')].filter(tr => /за заказ/.test(tr.children[0].textContent)).map(tr => [...tr.children].map(td => td.textContent.trim()));
    return { h: h.slice(-4), rows: rows.map(r => [r[0], ...r.slice(-4)]), note: ((document.getElementById('rp-ads-note') || {}).textContent || '').slice(0, 200) };
  });
  console.log(JSON.stringify({ ym, sel: await p.evaluate(() => document.getElementById('rp-month').value), r }));
}
console.log(JSON.stringify({ errs }));
await b.close();
