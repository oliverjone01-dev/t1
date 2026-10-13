// FENIKS iter5 independent sweep: tab vs «Деньги» (all ITOGO columns + «Общие расходы»), tab campaign table vs «Маркетинг»
// (all cells, CPO row separately), subrows (all kinds) negativity and sums, CPO cells vs independent python probe, JS errors.
// usage: node fx_sweep.mjs <public dir> <out.jsonl> [mk|-] [base|days]
import { chromium } from 'playwright-core';
import fs from 'fs';
const P = process.argv[2], OUT = process.argv[3], MK = process.argv[4] === 'mk';
const base = [['2026-06-01','2026-06-30'],['2026-07-01','2026-07-31'],['2026-08-01','2026-08-31'],['2026-09-01','2026-09-30'],['2026-10-01','2026-10-12'],
['2026-07-01','2026-07-15'],['2026-07-16','2026-07-31'],['2026-08-01','2026-08-15'],['2026-08-16','2026-08-31'],['2026-09-01','2026-09-15'],['2026-09-16','2026-09-30'],
['2026-09-01','2026-09-07'],['2026-09-08','2026-09-14'],['2026-09-15','2026-09-21'],['2026-09-22','2026-09-28'],['2026-08-29','2026-08-31'],['2026-09-29','2026-10-05'],
['2026-10-01','2026-10-10'],['2026-07-01','2026-09-30'],['2026-08-15','2026-09-15'],['2026-09-20','2026-10-10'],['2026-06-15','2026-07-15'],['2026-09-04','2026-09-04'],['2026-06-01','2026-10-12'],
['2026-08-31','2026-08-31'],['2026-09-30','2026-09-30'],['2026-08-25','2026-09-05'],['2026-07-03','2026-07-05'],['2026-08-03','2026-08-09'],['2026-08-17','2026-08-23'],['2026-07-20','2026-07-20'],['2026-08-10','2026-08-10'],['2026-10-05','2026-10-05'],['2026-10-12','2026-10-12']];
const days = []; for (let d = 1; d <= 30; d++) { const s = '2026-09-' + String(d).padStart(2, '0'); if (s !== '2026-09-04' && s !== '2026-09-30') days.push([s, s]); }
for (const s of ['2026-07-03','2026-07-10','2026-07-15','2026-07-25','2026-08-01','2026-08-05','2026-08-15','2026-08-20','2026-08-25','2026-10-01','2026-10-08']) days.push([s, s]);
const periods = process.argv[5] === 'days' ? days : base;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function load(page, f, t) {
  const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await p.addInitScript(([f, t]) => localStorage.setItem('gg_katya_period', JSON.stringify({ p: 'range', from: f, to: t })), [f, t]);
  await p.goto('file://' + P + page); await p.waitForTimeout(2200); return { p, ctx, errs };
}
const ordan = p => p.evaluate(() => {
  const N = s => { s = String(s || '').replace(/[\s  ]/g, '').replace(/−/g, '-'); const m = s.match(/-?[\d.,]+/); return m ? Number(m[0].replace(',', '.')) : null; };
  const t = document.querySelector('#ordan-t'); if (!t) return null;
  const h = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim().replace(/\s+/g, ' '));
  const get = re => { const r = [...t.querySelectorAll('tr')].find(tr => re.test((tr.children[0] || {}).textContent?.trim() || '')); if (!r) return null; const o = {}; h.forEach((k, i) => { o[k] = N(r.children[i]?.textContent); }); return o; };
  return { h, tot: get(/^ИТОГО/i), obs: get(/^Общие расходы/i), nrows: t.querySelectorAll('tbody tr').length };
});
const camps = p => p.evaluate(() => {
  const out = {}; document.querySelectorAll('#top .ad-exp').forEach(tr => { const id = tr.getAttribute('data-id'); out[id] = [...tr.children].map(td => td.textContent.trim().replace(/\s+/g, ' ')); });
  return { rows: out };
});
const subs = p => p.evaluate(() => {
  const N = s => { s = String(s || '').replace(/[\s  ]/g, '').replace(/−/g, '-'); const m = s.match(/-?[\d.,]+/); return m ? Number(m[0].replace(',', '.')) : 0; };
  document.querySelectorAll('#top .ad-exp').forEach(e => e.click());
  const neg = [], bad = [], kinds = {}, cpo = []; let nsub = 0;
  document.querySelectorAll('#top .ad-exp').forEach(tr => {
    const i = tr.getAttribute('data-i'); const ss = [...document.querySelectorAll('#top .ad-sub[data-i="' + i + '"]')]; nsub += ss.length;
    const name = tr.children[0].textContent.trim() + ' ' + (tr.children[1] ? tr.children[1].textContent.trim() : '');
    if (/за заказ/i.test(name)) cpo.push({ name: name.slice(0, 45), sp: N(tr.children[3] && tr.children[3].textContent), rev: tr.children[4] && tr.children[4].textContent.trim(), u: tr.children[5] && tr.children[5].textContent.trim(), drr: tr.children[6] && tr.children[6].textContent.trim(), title: ((tr.children[6] && tr.children[6].querySelector('[title]')) || {}).title || '', revTitle: ((tr.children[4] && tr.children[4].querySelector('[title]')) || {}).title || '', subs: ss.length, tg: (tr.querySelector('.cf-tg') || {}).textContent });
    ss.forEach(x => { const lab = (x.children[0] ? x.children[0].textContent : '').trim(); const k = lab.split(/[:(]|\s+GG|\s+\d{6,}/)[0].trim(); kinds[k] = (kinds[k] || 0) + 1; const v = N(x.children[3] && x.children[3].textContent); if (v + 0.5 <= 0 && x.children.length >= 6) neg.push([name.slice(0, 25), lab.slice(0, 60), v]); });
    if (!ss.length) return;
    const narrow = ss.filter(x => x.children.length - 6 >= 0 ? false : true).length;
    if (narrow) { kinds['~nosplit-campaign'] = (kinds['~nosplit-campaign'] || 0) + 1; return; }
    for (const col of [3, 4, 5]) { const s = ss.reduce((a, x) => a + N(x.children[col] && x.children[col].textContent), 0), T = N(tr.children[col] && tr.children[col].textContent); if (Math.abs(s - T) - ss.length > 0) bad.push([name.slice(0, 25), col, T, s]); }
  });
  const note = (document.getElementById('cpc-note') || {}).textContent || '';
  const mm = note.match(/(переехало|вернулось) ([\d\s  ]+) ₽/);
  const src = (document.getElementById('src1') || {}).textContent || '';
  return { neg, bad, kinds, nsub, cpo, mv: mm ? (mm[1] === 'вернулось' ? -1 : 1) * Number(mm[2].replace(/[\s  ]/g, '')) : 0, same: /те же, что на «Деньгах»/.test(note), broken: /не сходится/.test(note), noteHasNetAttr: /нет атрибуции/.test(note), src: src.slice(-200), note };
});
for (const [f, t] of periods) {
  const rec = { f, t };
  const m = await load('katya-money.html', f, t), c = await load('katya-reklama-kartochki.html', f, t);
  rec.money = await ordan(m.p); rec.tab = await ordan(c.p);
  if (MK) { const k = await load('katya-marketing.html', f, t); rec.mkc = await camps(k.p); rec.errsMk = k.errs; await k.ctx.close(); }
  rec.tabc = await camps(c.p);
  rec.sub = await subs(c.p);
  rec.errs = [...m.errs, ...c.errs];
  fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
  console.log(f, t, 'errs', rec.errs.length, 'neg', rec.sub.neg.length, 'bad', rec.sub.bad.length, 'mv', rec.sub.mv, rec.sub.same ? '(=)' : '', 'cpo', JSON.stringify(rec.sub.cpo.map(x => [x.rev, x.u, x.drr])));
  await m.ctx.close(); await c.ctx.close();
}
await b.close();
