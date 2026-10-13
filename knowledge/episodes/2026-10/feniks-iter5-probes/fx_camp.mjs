// FENIKS iter5: dump one campaign's row and subrows on the tab. usage: node fx_camp.mjs <public dir> <from> <to> <campaign id>
import { chromium } from 'playwright-core';
const [P, f, t, id] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext(); const p = await ctx.newPage();
await p.addInitScript(([f, t]) => localStorage.setItem('gg_katya_period', JSON.stringify({ p: 'range', from: f, to: t })), [f, t]);
await p.goto('file://' + P + 'katya-reklama-kartochki.html'); await p.waitForTimeout(2200);
const r = await p.evaluate((id) => {
  const tr = document.querySelector('#top .ad-exp[data-id="' + id + '"]'); if (!tr) return null; tr.click();
  const i = tr.getAttribute('data-i');
  const row = x => [...x.children].slice(0, 7).map(td => td.textContent.trim().replace(/\s+/g, ' ').slice(0, 70));
  return { camp: row(tr), subs: [...document.querySelectorAll('#top .ad-sub[data-i="' + i + '"]')].map(x => ({ cells: row(x), title: ((x.querySelector('[title]') || {}).title || '').slice(-140) })) };
}, id);
console.log(JSON.stringify(r, null, 1));
await b.close();
