// FENIKS iter6: titles of the CPO rows (by campaign id) on the tab; usage: node fx6_title.mjs <sandbox> <from:to> ...
import { chromium } from 'playwright-core';
const S = '/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6/';
const [sb, ...per] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const ft of per) {
  const [f, t] = ft.split(':');
  const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.addInitScript(([f, t]) => localStorage.setItem('gg_katya_period', JSON.stringify({ p: 'range', from: f, to: t })), [f, t]);
  await p.goto('file://' + S + sb + '/analytics-mvp/public/katya-reklama-kartochki.html'); await p.waitForTimeout(2300);
  const r = await p.evaluate(() => ['28753239', '22421802'].map(id => {
    const tr = document.querySelector('#top .ad-exp[data-id="' + id + '"]'); if (!tr) return { id, row: null };
    const t = i => ((tr.children[i] && tr.children[i].querySelector('[title]')) || {}).title || '';
    return { id, cells: [...tr.children].slice(0, 8).map(td => td.textContent.trim().replace(/\s+/g, ' ')), revTitle: t(4), uTitle: t(5), drrTitle: t(6), subs: document.querySelectorAll('#top .ad-sub[data-i="' + tr.getAttribute('data-i') + '"]').length, tg: (tr.querySelector('.cf-tg') || {}).textContent };
  }));
  console.log(JSON.stringify({ f, t, errs, r }));
  await ctx.close();
}
await b.close();
