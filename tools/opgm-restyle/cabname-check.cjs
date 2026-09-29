/* cabname-check: условие решения Р2 (К1) на старых экранах - цвет кабинета нигде не несёт смысл один, имя кабинета стоит текстом рядом.
   Поверхность с цветом кабинета = элемент с инлайн-стилем --slot:var(--cat-1|--cat-2) (плитка, полосы, тег кабинета) и графики с легендой.
   Рядом = имя OLD-G или NEW-B в тексте самого элемента, его плитки, карточки или заголовка раздела.
   Запуск: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node cabname-check.cjs --op <op-gm-automation> [--src <src>]
   Код выхода: 0 = поверхностей без имени 0; 1 = есть. */
const path = require('path');
const { build } = require('./harness/gen.cjs');
const o = {}; process.argv.slice(2).forEach((a, i, A) => { if(a.startsWith('--')) o[a.slice(2)] = A[i + 1]; });
const OP = path.resolve(o.op || '../opgm/op-gm-automation'), SRC = path.resolve(o.src || path.join(OP, 'src'));
const HTML = build(OP, SRC, path.join(__dirname, 'out', 'cabname.harness.html'));
const VIEWS = ['today', 'pulse', 'speed2', 'probs', 'ads', 'calls', 'cold', 'dlg', 'data'];
(async () => {
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 }, reducedMotion:'reduce' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
  let total = 0, bad = []; const by = {};
  for(const v of VIEWS) for(const cab of ['all', 'OLD-G', 'NEW-B']){
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date('2026-09-22T09:00:00+03:00'));
    await page.goto('file://' + HTML + '#' + cab + '.' + v + '.30');
    await page.waitForFunction(() => window.__READY === true);
    await page.waitForFunction(() => [...document.querySelectorAll('#view .ks-chart')].every(c => c.querySelector('.apexcharts-canvas')), null, { timeout:4000 }).catch(() => {});
    const r = await page.evaluate(() => {
      const NAME = /OLD-G|NEW-B/, out = [];
      const near = el => { for(let n = el; n && n.id !== 'view'; n = n.parentElement){
        if(NAME.test(n.textContent) && (n === el || n.matches('.ks-tile, .ks-card, .op-li, .op-q, .ks-verdict-row, .op-queue, tr'))) return true;
        if(n.matches('.ks-card')){ const t = n.querySelector('.ks-card-title'); return !!(t && NAME.test(t.textContent)); } } return false; };
      document.querySelectorAll('#view [style*="--cat-1"], #view [style*="--cat-2"]').forEach(el => {
        if(el.closest('[hidden]') && !el.closest('[id^="ks-tw-"]')) return;
        out.push({ kind:(el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName), ok:near(el), text:el.textContent.trim().slice(0, 50) });
      });
      document.querySelectorAll('#view .apexcharts-canvas').forEach(c => { const leg = c.querySelector('.apexcharts-legend');
        const n = c.querySelectorAll('.apexcharts-series').length; if(n < 2 || c.querySelector('.apexcharts-heatmap, .apexcharts-heatmap-series')) return; /* тепловая карта: ряды это дни недели */
        out.push({ kind:'график ' + n + ' рядов', ok:!!(leg && NAME.test(leg.textContent)), text:(leg && leg.textContent || 'нет легенды').slice(0, 50) }); });
      return out;
    });
    r.forEach(x => { total++; by[x.kind] = by[x.kind] || [0, 0]; by[x.kind][x.ok ? 0 : 1]++; if(!x.ok) bad.push(v + '/' + cab + ' ' + x.kind + ' «' + x.text + '»'); });
    await page.close();
  }
  await browser.close();
  console.log('ПОВЕРХНОСТЕЙ С ЦВЕТОМ КАБИНЕТА:', total, '| с именем рядом:', total - bad.length, '| без имени:', bad.length);
  Object.entries(by).forEach(([k, [a, b]]) => console.log('  ' + k + ': с именем ' + a + ', без ' + b));
  [...new Set(bad)].slice(0, 10).forEach(x => console.log('  БЕЗ ИМЕНИ', x));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('ОШИБКА:', e && e.stack || e); process.exit(2); });
