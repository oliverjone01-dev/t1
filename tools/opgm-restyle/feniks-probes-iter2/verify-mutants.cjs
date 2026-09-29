/* ФЕНИКС iter2: причинность мутантов, которые numsnap пропустил. Мутация должна быть видна пользователю, иначе FAIL гейта ложный.
   Для базы и варианта на моих входах Φ: строка источника Пульса; подсказки дельт «было ... стало» у счётчиков; подписи оси графика;
   «Найдено» в «Все диалоги» после выбора фильтра «Проблема = Не ответили вообще» мышью. */
const path = require('path');
const { build } = require('./harness/gen.cjs');
const OP = '/tmp/claude-0/-home-user-t1/16fce438-701e-5124-a7d4-75100c05e8b9/scratchpad/opgm/op-gm-automation';
const V = '/tmp/claude-0/-home-user-t1/16fce438-701e-5124-a7d4-75100c05e8b9/scratchpad/feniks-iter2/v';
const FX = { seed:90210, export:'2026-09-17T15:40:00+03:00', start:'2026-05-10T00:00:00+03:00', n:700, excl:true, expCab:{ 'OLD-G':'2026-09-17T15:40:00+03:00', 'NEW-B':'2026-09-17T15:22:00+03:00' } };
const variants = [['база', path.join(OP, 'src')], ['f-cabswap-src', V + '/f-cabswap-src'], ['f-tip-swap2', V + '/f-tip-swap2'], ['f-chart-x10', V + '/f-chart-x10'], ['f-filter-dead', V + '/f-filter-dead']];
(async () => {
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const browser = await chromium.launch();
  for (const [name, src] of variants) {
    const html = build(OP, src, path.join(__dirname, 'out', 'verify-' + name + '.harness.html'));
    const ctx = await browser.newContext({ viewport:{ width:1280, height:900 }, reducedMotion:'reduce' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
    await ctx.addInitScript(x => { window.__FX_OPTS = x; }, FX);
    const open = async h => { const p = await ctx.newPage(); await p.clock.setFixedTime(new Date(FX.export)); await p.goto('file://' + html + '#' + h);
      await p.waitForFunction(() => window.__READY === true, null, { timeout:15000 });
      await p.waitForFunction(() => [...document.querySelectorAll('#view .ks-chart')].every(c => c.querySelector('.apexcharts-canvas')), null, { timeout:4000 }).catch(() => {});
      await p.waitForTimeout(300); return p; };
    let p = await open('OLD-G.pulse.30');
    const src1 = await p.evaluate(() => { const t = document.getElementById('view').innerText.match(/Авито API · [^\n]*/); return t ? t[0] : null; });
    const tips = await p.evaluate(() => [...document.querySelectorAll('#view .ks-tile')].map(t => { const l = t.querySelector('.ks-tile-label').textContent.trim(); const d = t.querySelector('.ks-delta[data-tip]'); return d ? l.split(' · ')[0] + ': ' + d.getAttribute('data-tip') + ' | стрелка ' + d.className.replace('ks-delta ', '') : null; }).filter(Boolean).filter(s => /Не ответили|Вопрос/.test(s)));
    await p.close();
    p = await open('OLD-G.speed2.30');
    const axis = await p.evaluate(() => { const c = document.querySelector('#view .apexcharts-canvas'); return c ? [...c.querySelectorAll('.apexcharts-yaxis-label')].map(x => x.textContent).join(' ') : null; });
    await p.close();
    p = await open('all.dlg.30');
    const before = await p.evaluate(() => (document.querySelector('#view .op-count') || {}).textContent);
    await p.selectOption('#f-prob', 'noresp'); await p.waitForTimeout(400);
    const after = await p.evaluate(() => (document.querySelector('#view .op-count') || {}).textContent);
    await p.close();
    console.log('== ' + name);
    console.log('  строка источника:', src1);
    tips.forEach(t => console.log('  подсказка дельты:', t));
    console.log('  ось Y первого графика Скорости:', axis);
    console.log('  «Все диалоги»: до фильтра «' + (before || '').trim() + '» | после «Проблема = Не ответили вообще» «' + (after || '').trim() + '»');
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('ОШИБКА:', e && e.stack || e); process.exit(2); });
