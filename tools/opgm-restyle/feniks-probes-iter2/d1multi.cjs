/* ФЕНИКС iter2: Д1 на нескольких датах выгрузки (проверка, что месяцы идут из данных, а не вшиты под одну дату).
   Для каждой даты: строки помесячных таблиц-двойников Скорости и Рассылки = месяцы от апр 2026 до месяца выгрузки,
   последняя строка «<мес> (до DD)», «до 22» в тексте нет. Запуск: node d1multi.cjs --op OP --src SRC */
const path = require('path');
const { build } = require('./harness/gen.cjs');
const o = {}; process.argv.slice(2).forEach((a, i, A) => { if(a.startsWith('--')) o[a.slice(2)] = A[i + 1]; });
const OP = path.resolve(o.op), SRC = path.resolve(o.src || path.join(OP, 'src'));
const HTML = build(OP, SRC, path.join(__dirname, 'out', 'd1multi-' + path.basename(SRC) + '.harness.html'));
const RU = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const DATES = ['2026-10-05T09:00:00+03:00', '2026-11-02T09:00:00+03:00', '2027-01-11T09:00:00+03:00'];
(async () => {
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const browser = await chromium.launch();
  let bad = 0;
  for (const ex of DATES) {
    const d = new Date(ex), y = +ex.slice(0, 4), m = +ex.slice(5, 7), dd = ex.slice(8, 10);
    const want = []; for (let yy = 2026, mm = 4; yy < y || (yy === y && mm <= m); mm++) { if (mm > 12) { mm = 1; yy++; } want.push(RU[mm - 1]); if (yy === y && mm === m) break; }
    const ctx = await browser.newContext({ viewport:{ width:1280, height:900 }, reducedMotion:'reduce' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
    await ctx.addInitScript(x => { window.__FX_OPTS = x; }, { seed:20260929, export:ex, start:'2026-04-01T00:00:00+03:00' });
    for (const [v, title] of [['speed2', 'Медиана по месяцам'], ['cold', 'Сколько отправили по месяцам']]) {
      const page = await ctx.newPage(); await page.clock.setFixedTime(d);
      await page.goto('file://' + HTML + '#all.' + v + '.all'); await page.waitForFunction(() => window.__READY === true, null, { timeout:15000 }); await page.waitForTimeout(150);
      const r = await page.evaluate(t => { const c = [...document.querySelectorAll('#view .ks-card')].find(x => (x.querySelector('.ks-card-title') || {}).textContent === t);
        return { rows: c ? [...c.querySelectorAll('tbody tr')].map(tr => tr.children[0].textContent.trim()) : null, d22: (document.getElementById('view').innerText.match(/до 22/g) || []).length }; }, title);
      const got = (r.rows || []).map(x => x.slice(0, 3));
      const ok = r.rows && JSON.stringify(got) === JSON.stringify(want) && new RegExp('до ' + dd).test(r.rows[r.rows.length - 1]) && r.d22 === 0;
      if (!ok) bad++;
      console.log((ok ? 'PASS' : 'FAIL') + '  выгрузка ' + ex.slice(0, 10) + ' · ' + title + ' | строки: ' + (r.rows || []).join(', ') + ' | ждали: ' + want.join(', ') + ' (последняя «до ' + dd + '») | «до 22»: ' + r.d22);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  console.log('ИТОГ Д1 по датам:', bad ? 'FAIL ' + bad : 'PASS', '(' + path.basename(SRC) + ')');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ОШИБКА:', e && e.stack || e); process.exit(2); });
