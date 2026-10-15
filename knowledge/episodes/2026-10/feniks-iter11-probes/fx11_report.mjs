// FENIKS iter11: «Отчет» block 5 (#rp-ads) full table + note (innerText, red-span and yellow rp-warn text) + #rp-flags
// (header marks, N2) for every month in #rp-month. usage: node fx11_report.mjs <sandbox>
import { chromium } from 'playwright-core';
const S = '/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11/';
const [sb] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
await p.goto('file://' + S + sb + '/analytics-mvp/public/katya-report.html'); await p.waitForTimeout(2500);
const opts = await p.evaluate(() => [...document.querySelectorAll('#rp-month option')].map(o => o.value));
const out = { sb, options: opts, months: {} };
for (const ym of opts) {
  await p.evaluate((ym) => { const s = document.getElementById('rp-month'); s.value = ym; s.dispatchEvent(new Event('change', { bubbles: true })); }, ym);
  await p.waitForTimeout(700);
  out.months[ym] = await p.evaluate(() => {
    const t = document.getElementById('rp-ads'); if (!t) return null;
    const h = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim());
    const rows = [...t.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()));
    const nt = document.getElementById('rp-ads-note') || {};
    const red = [...((nt.querySelectorAll && nt.querySelectorAll('span[style*="FF5A5F"]')) || [])].map(x => x.textContent.trim());
    const yel = [...((nt.querySelectorAll && nt.querySelectorAll('.rp-warn')) || [])].map(x => x.textContent.trim());
    const fl = (document.getElementById('rp-flags') || {}).innerText || '';
    return { h, rows, note: (nt.innerText || ''), red, yel, flags: fl };
  });
}
out.errs = errs;
console.log(JSON.stringify(out));
await b.close();
