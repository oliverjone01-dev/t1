/* cabname-check v2: условие решения Р2 (К1) на старых экранах - цвет кабинета нигде не несёт смысл один, имя кабинета стоит текстом рядом.
   v2 (ТЗ ФЕНИКСА iter2 п.3): поверхность ищется по ВЫЧИСЛЕННОМУ стилю, а не по инлайн-атрибуту:
   - элемент сам задаёт --slot (значение отличается от родителя и равно цвету --cat-1 или --cat-2; --seq-N шагов кита не кабинет), откуда бы оно ни пришло (инлайн, класс, токен);
   - или его background-color / border-*-color равен вычисленному цвету --cat-1 или --cat-2;
   - или его color / fill / stroke равен цвету кабинета и отличается от родителя (наследуемые свойства считаются там, где заданы);
   плюс графики с 2+ рядами (легенда). Текст внутри .apexcharts-canvas не считается поверхностью (там легенда).
   Рядом = имя OLD-G или NEW-B в тексте самого элемента, его плитки, карточки, строки или заголовка раздела.
   Проверка против базы: те же экраны на коде базы (--base-src, по умолчанию <op>/src); поверхностей после меньше, чем в базе = провал
   (перенос цвета туда, где инструмент его не видит, не должен давать «без имени: 0»).
   Запуск: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node cabname-check.cjs --op <op-gm-automation> [--src <src>] [--base-src <src базы>]
   Код выхода: 0 = без имени 0 и поверхностей не меньше базы; 1 = иначе; 2 = ошибка. */
const path = require('path');
const { build } = require('./harness/gen.cjs');
const o = {}; process.argv.slice(2).forEach((a, i, A) => { if(a.startsWith('--')) o[a.slice(2)] = A[i + 1]; });
const OP = require('./harness/oproot.cjs')(o.op), SRC = path.resolve(o.src || path.join(OP, 'src')), BASE = path.resolve(o['base-src'] || path.join(OP, 'src'));
const VIEWS = ['today', 'pulse', 'speed2', 'probs', 'ads', 'calls', 'cold', 'dlg', 'data'];
async function run(browser, SRC, tag){
  const HTML = build(OP, SRC, path.join(__dirname, 'out', 'cabname-' + tag + '.harness.html'));
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
      const probe = document.createElement('span'); document.body.appendChild(probe);
      const CAT = ['--cat-1', '--cat-2'].map(v => { probe.style.color = 'var(' + v + ')'; return getComputedStyle(probe).color; }); probe.remove();
      const isCat = c => CAT.includes(c);
      const probe2 = document.createElement('span'); document.body.appendChild(probe2);
      const res = v => { probe2.style.color = ''; probe2.style.color = v; return getComputedStyle(probe2).color; };
      document.querySelectorAll('#view *').forEach(el => {
        if(el.closest('.apexcharts-canvas') || (el.closest('[hidden]') && !el.closest('[id^="ks-tw-"]'))) return;
        const cs = getComputedStyle(el), pc = el.parentElement ? getComputedStyle(el.parentElement) : null;
        const slot = cs.getPropertyValue('--slot').trim(), own = slot && (!pc || pc.getPropertyValue('--slot').trim() !== slot) && isCat(res(slot));
        const box = isCat(cs.backgroundColor) || ['Top','Right','Bottom','Left'].some(sd => parseFloat(cs['border' + sd + 'Width']) > 0 && isCat(cs['border' + sd + 'Color']));
        const inh = ['color', 'fill', 'stroke'].some(pr => isCat(cs[pr]) && (!pc || pc[pr] !== cs[pr]) && (pr === 'color' ? /\S/.test(el.textContent) : el instanceof SVGElement));
        if(!(own || box || inh)) return;
        out.push({ kind:(el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName.toLowerCase()) || el.tagName.toLowerCase(), ok:near(el), text:el.textContent.trim().slice(0, 50) });
      });
      document.querySelectorAll('#view .apexcharts-canvas').forEach(c => { const leg = c.querySelector('.apexcharts-legend');
        const n = c.querySelectorAll('.apexcharts-series').length; if(n < 2 || c.querySelector('.apexcharts-heatmap, .apexcharts-heatmap-series')) return; /* тепловая карта: ряды это дни недели */
        out.push({ kind:'график ' + n + ' рядов', ok:!!(leg && NAME.test(leg.textContent)), text:(leg && leg.textContent || 'нет легенды').slice(0, 50) }); });
      return out;
    });
    r.forEach(x => { total++; by[x.kind] = by[x.kind] || [0, 0]; by[x.kind][x.ok ? 0 : 1]++; if(!x.ok) bad.push(v + '/' + cab + ' ' + x.kind + ' «' + x.text + '»'); });
    await page.close();
  }
  await ctx.close();
  return { total, bad, by };
}
(async () => {
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const browser = await chromium.launch();
  const b = await run(browser, BASE, 'base'), r = SRC === BASE ? b : await run(browser, SRC, 'src');
  await browser.close();
  console.log('БАЗА (' + path.basename(path.dirname(BASE)) + '/' + path.basename(BASE) + '): поверхностей с цветом кабинета', b.total, '| без имени', b.bad.length);
  console.log('ПРОВЕРЯЕМЫЙ КОД (' + SRC + '): ПОВЕРХНОСТЕЙ С ЦВЕТОМ КАБИНЕТА:', r.total, '| с именем рядом:', r.total - r.bad.length, '| без имени:', r.bad.length);
  Object.entries(r.by).forEach(([k, [a, c]]) => console.log('  ' + k + ': с именем ' + a + ', без ' + c));
  [...new Set(r.bad)].slice(0, 6).forEach(x => console.log('  БЕЗ ИМЕНИ', x));
  const drop = r.total < b.total;
  if(drop) console.log('  ПРОВАЛ: поверхностей меньше, чем в базе (' + r.total + ' < ' + b.total + '): цвет кабинета ушёл туда, где проверка его не видит, или поверхности сняты');
  console.log('ИТОГ К1:', r.bad.length || drop ? 'FAIL (код 1)' : 'PASS (код 0)');
  process.exit(r.bad.length || drop ? 1 : 0);
})().catch(e => { console.error('ОШИБКА:', e && e.stack || e); process.exit(2); });
