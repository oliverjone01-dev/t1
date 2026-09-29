/* ФЕНИКС iter3: f3-today-now, что видит пользователь на «Сегодня» (срок 3 дня) при часах = выгрузка и через 4 дня после неё */
const SP = '/tmp/claude-0/-home-user-t1/16fce438-701e-5124-a7d4-75100c05e8b9/scratchpad', O = SP + '/feniks-iter3/out';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const FX3 = { seed:31337, export:'2026-10-01T08:05:00+03:00', start:'2026-05-10T00:00:00+03:00', n:650, expCab:{ 'OLD-G':'2026-10-01T08:05:00+03:00', 'NEW-B':'2026-09-30T19:40:00+03:00' } };
(async () => {
  const browser = await chromium.launch();
  for(const clock of [FX3.export, '2026-10-05T12:00:00+03:00']){
    const res = {};
    for(const n of ['base-a', 'f3-today-now']){
      const ctx = await browser.newContext({ viewport:{ width:1280, height:900 }, reducedMotion:'reduce', locale:'ru-RU', timezoneId:'Europe/Moscow' });
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
      await ctx.addInitScript(x => { window.__FX_OPTS = x; }, FX3);
      const page = await ctx.newPage(); await page.clock.setFixedTime(new Date(clock));
      await page.goto('file://' + O + '/' + n + '.harness.html#all.today.30'); await page.waitForFunction(() => window.__READY === true);
      await page.click('[data-today="3"]'); await page.waitForTimeout(300);
      res[n] = await page.evaluate(() => ({ queues:[...document.querySelectorAll('#view .op-queue')].map(q => ((q.querySelector('h2') || {}).textContent || '').trim().slice(0, 22) + ' ' + q.querySelectorAll('[data-th]').length),
        nums:(document.getElementById('view').innerText.match(/\d+/g) || []).slice(0, 14).join(' ') }));
      await ctx.close();
    }
    console.log('часы', clock.slice(0, 16), '| одинаково:', JSON.stringify(res['base-a']) === JSON.stringify(res['f3-today-now']));
    console.log('  base-a      ', JSON.stringify(res['base-a']));
    console.log('  f3-today-now', JSON.stringify(res['f3-today-now']));
  }
  await browser.close();
})().catch(e => { console.error('ОШИБКА', e && e.stack || e); process.exit(2); });
