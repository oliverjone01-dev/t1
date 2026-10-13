// FENIKS iter6: tab «Реклама по карточкам» in Chromium for the periods of cpo6_probe.py, sandboxes A and B.
// Records: orders table fingerprint (all cells), campaign rows (all cells), CPO row (cells + titles), notes, src1, JS errors.
// usage: node fx6_tab.mjs <probe.json> <out.jsonl> <sandboxA> [sandboxB]
import { chromium } from 'playwright-core';
import fs from 'fs';
const S = '/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6/';
const [PROBE, OUT, ...SB] = process.argv.slice(2);
const periods = JSON.parse(fs.readFileSync(PROBE, 'utf-8')).periods.map(p => [p.f, p.t]);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function grab(sb, f, t) {
  const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await p.addInitScript(([f, t]) => localStorage.setItem('gg_katya_period', JSON.stringify({ p: 'range', from: f, to: t })), [f, t]);
  await p.goto('file://' + S + sb + '/analytics-mvp/public/katya-reklama-kartochki.html'); await p.waitForTimeout(2300);
  const r = await p.evaluate(() => {
    const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
    const ot = document.querySelector('#ordan-t');
    const otxt = ot ? [...ot.querySelectorAll('tr')].map(tr => [...tr.children].map(td => td.textContent.trim()).join('|')).join('\n') : '';
    const camps = {}; let cpo = null;
    document.querySelectorAll('#top .ad-exp').forEach(tr => {
      const id = tr.getAttribute('data-id'); const cells = [...tr.children].map(td => td.textContent.trim().replace(/\s+/g, ' '));
      camps[id] = cells;
      if (/за заказ/i.test(cells[0] + ' ' + (cells[1] || ''))) cpo = { id, cells, revTitle: ((tr.children[4] && tr.children[4].querySelector('[title]')) || {}).title || '', uTitle: ((tr.children[5] && tr.children[5].querySelector('[title]')) || {}).title || '', drrTitle: ((tr.children[6] && tr.children[6].querySelector('[title]')) || {}).title || '', tg: (tr.querySelector('.cf-tg') || {}).textContent, subs: document.querySelectorAll('#top .ad-sub[data-i="' + tr.getAttribute('data-i') + '"]').length };
    });
    const tot = [...document.querySelectorAll('#top tr')].filter(tr => /^ИТОГО|^Итого/.test((tr.children[0] || {}).textContent?.trim() || '')).map(tr => [...tr.children].map(td => td.textContent.trim().replace(/\s+/g, ' ')));
    return { ofp: fnv(otxt), olen: otxt.length, orows: ot ? ot.querySelectorAll('tbody tr').length : -1, camps, cpo, tot,
      note: (document.getElementById('cpc-note') || {}).textContent || '', src1: (document.getElementById('src1') || {}).textContent || '' };
  });
  await ctx.close(); return { ...r, errs };
}
for (const [f, t] of periods) {
  const rec = { f, t };
  for (const sb of SB) rec[sb] = await grab(sb, f, t);
  fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
  const x = rec[SB[SB.length - 1]];
  console.log(f, t, SB.map(s => s + ':errs=' + rec[s].errs.length + ',ofp=' + rec[s].ofp).join(' '), 'cpo', x.cpo ? JSON.stringify(x.cpo.cells.slice(3, 7)) : null);
}
await b.close();
