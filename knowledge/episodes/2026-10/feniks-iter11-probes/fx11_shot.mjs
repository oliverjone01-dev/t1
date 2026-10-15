// FENIKS iter11: is the red kshell mark visible? Screenshot of the top 700 px + bounding box / computed visibility of the
// mark div for a page of a sandbox. usage: node fx11_shot.mjs <sandbox> <page.html> <out.png>
import { chromium } from 'playwright-core';
const S = '/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11/';
const [sb, page, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 700 } })).newPage();
await p.goto('file://' + S + sb + '/analytics-mvp/public/' + page); await p.waitForTimeout(2000);
const info = await p.evaluate(() => {
  const ds = [...document.querySelectorAll('div')].filter(d => d.textContent.trim().startsWith('⚠ Файлы данных повреждены') && d.children.length === 0);
  return ds.map(d => { const r = d.getBoundingClientRect(); const cs = getComputedStyle(d); return { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), vis: cs.visibility, disp: cs.display, text: d.textContent.trim().slice(0, 140) }; });
});
const flags = await p.evaluate(() => ((document.getElementById('rp-flags') || {}).innerText || '').slice(0, 200));
await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1280, height: 700 } });
console.log(JSON.stringify({ sb, page, marks: info, rpFlags: flags }));
await b.close();
