// FENIKS iter10: whole «Отчет» text per block for month views 2026-09 and 2026-08 (#rp-flags, #rp-turn, #rp-why, #rp-why2,
// #rp-cost, #rp-ads, #rp-dead) - to diff a fixture against the clean build. usage: node fx10_full.mjs <sandbox>
import { chromium } from 'playwright-core';
const S = '/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f10/';
const [sb] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext()).newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
await p.goto('file://' + S + sb + '/analytics-mvp/public/katya-report.html'); await p.waitForTimeout(2500);
const out = { sb, months: {} };
for (const ym of ['2026-09', '2026-08']) {
  await p.evaluate((ym) => { const s = document.getElementById('rp-month'); s.value = ym; s.dispatchEvent(new Event('change', { bubbles: true })); }, ym);
  await p.waitForTimeout(800);
  out.months[ym] = await p.evaluate(() => Object.fromEntries(['rp-flags', 'rp-turn', 'rp-why', 'rp-why2', 'rp-cost', 'rp-ads', 'rp-dead']
    .map(id => [id, ((document.getElementById(id) || {}).innerText || '')])));
}
out.errs = errs;
console.log(JSON.stringify(out));
await b.close();
