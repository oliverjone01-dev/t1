// FENIKS iter8: tab «Реклама по карточкам» - CPO-related campaign rows (28753239, 22421802 + any row with export revenue title) per period.
// usage: node fx8_rows.mjs <sandbox> <periods.json>
import { chromium } from 'playwright-core';
import fs from 'fs';
const S = '/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i8/';
const [sb, pj] = process.argv.slice(2);
const periods = JSON.parse(fs.readFileSync(pj, 'utf-8')).periods;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const { f, t } of periods) {
  const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.addInitScript(([f, t]) => localStorage.setItem('gg_katya_period', JSON.stringify({ p: 'range', from: f, to: t })), [f, t]);
  await p.goto('file://' + S + sb + '/analytics-mvp/public/katya-reklama-kartochki.html'); await p.waitForTimeout(2300);
  const r = await p.evaluate(() => {
    const out = {};
    document.querySelectorAll('#top .ad-exp').forEach(tr => {
      const id = tr.getAttribute('data-id'); const cells = [...tr.children].slice(0, 7).map(td => td.textContent.trim().replace(/\s+/g, ' '));
      const tt = i => ((tr.children[i] && tr.children[i].querySelector('[title]')) || {}).title || '';
      if (['28753239', '22421802'].includes(id) || /Выручка заказов «Оплаты за заказ»/.test(tt(4))) out[id] = { cells: cells.slice(3), revTitle: tt(4).slice(0, 60), drrTitle: tt(6).slice(0, 200) };
    });
    const src = ((document.getElementById('src1') || {}).textContent || '').slice(0, 300);
    return { out, src };
  });
  console.log(JSON.stringify({ sb, f, t, errs, ...r }));
  await ctx.close();
}
await b.close();
