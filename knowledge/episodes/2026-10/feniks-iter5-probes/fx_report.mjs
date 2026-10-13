// FENIKS iter5: «Отчет» rp-ads table (CPO revenue row) for given month range. usage: node fx_report.mjs <public dir> <from> <to>
import { chromium } from 'playwright-core';
const [P, f, t] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
await p.addInitScript(([f, t]) => { localStorage.setItem('gg_katya_period', JSON.stringify({ p: 'range', from: f, to: t })); }, [f, t]);
await p.goto('file://' + P + 'katya-report.html'); await p.waitForTimeout(3000);
const r = await p.evaluate(() => {
  const t = document.getElementById('rp-ads'); if (!t) return null;
  const h = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim());
  const rows = [...t.querySelectorAll('tbody tr')].filter(tr => /за заказ|Расход всего/.test(tr.children[0].textContent)).map(tr => [...tr.children].map(td => td.textContent.trim()));
  return { h, rows, note: (document.getElementById('rp-ads-note') || {}).textContent };
});
console.log(JSON.stringify({ f, t, errs, r }, null, 0));
await b.close();
