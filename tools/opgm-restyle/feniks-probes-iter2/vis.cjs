/* ФЕНИКС iter2: видимость чисел (чего не видит numsnap) и прокрутка вбок на 390 (критерий W1 плана).
   Для кода SRC на экранах VIEWS и ширинах 1280/390: узлов с цифрами в DOM, из них читаемых (ненулевой прямоугольник,
   итоговая непрозрачность с предками >= 0.5, кегль >= 9px, visibility visible), и scrollWidth минус ширина окна.
   Запуск: node vis.cjs --op OP --src SRC --fx JSON */
const path = require('path');
const { build } = require('./harness/gen.cjs');
const o = {}; process.argv.slice(2).forEach((a, i, A) => { if(a.startsWith('--')) o[a.slice(2)] = A[i + 1]; });
const OP = path.resolve(o.op), SRC = path.resolve(o.src || path.join(OP, 'src')), FX = o.fx ? JSON.parse(o.fx) : {};
const HTML = build(OP, SRC, path.join(__dirname, 'out', 'vis-' + path.basename(SRC) + '.harness.html'));
const VIEWS = ['pulse', 'speed2', 'ads', 'calls', 'cold', 'dlg', 'today'];
(async () => {
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const browser = await chromium.launch();
  const tot = {};
  for (const width of [1280, 390]) {
    const ctx = await browser.newContext({ viewport:{ width, height:900 }, reducedMotion:'reduce' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
    await ctx.addInitScript(x => { window.__FX_OPTS = x; try{ localStorage.setItem('ks-theme', 'light'); }catch(e){} }, FX);
    for (const v of VIEWS) {
      const page = await ctx.newPage(); await page.clock.setFixedTime(new Date(FX.export || '2026-09-22T09:00:00+03:00'));
      await page.goto('file://' + HTML + '#all.' + v + '.30'); await page.waitForFunction(() => window.__READY === true, null, { timeout:15000 }); await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const view = document.getElementById('view'); let dom = 0, readable = 0;
        const tw = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
        for (let n = tw.nextNode(); n; n = tw.nextNode()) {
          const p = n.parentElement; if (!p || !/\d/.test(n.textContent) || p.closest('.apexcharts-canvas, .ks-chart, [hidden], style, script')) continue;
          dom++;
          const rc = p.getBoundingClientRect(), cs = getComputedStyle(p); let op = 1;
          for (let e = p; e && e !== document.documentElement; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
          if (rc.width > 0 && rc.height > 0 && cs.visibility !== 'hidden' && parseFloat(cs.fontSize) >= 9 && op >= 0.5) readable++;
        }
        return { dom, readable, overflow: document.documentElement.scrollWidth - window.innerWidth };
      });
      tot[width] = tot[width] || { dom:0, readable:0, over:[] };
      tot[width].dom += r.dom; tot[width].readable += r.readable; if (r.overflow > 0) tot[width].over.push(v + ':' + r.overflow);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  for (const w of [1280, 390]) console.log(path.basename(SRC) + ' ширина ' + w + ' | узлов с цифрами в DOM ' + tot[w].dom + ' | читаемых ' + tot[w].readable + ' | нечитаемых ' + (tot[w].dom - tot[w].readable) + ' | прокрутка вбок: ' + (tot[w].over.join(', ') || 'нет'));
})().catch(e => { console.error('ОШИБКА:', e && e.stack || e); process.exit(2); });
