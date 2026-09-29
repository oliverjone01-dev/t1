/* b4check: одноимённое число на нескольких поверхностях (проба B4; приёмка Д-пакета §4 п.1 решений ФЕНИКСА).
   Для каждого кабинета и периода 7 и 30 дней:
   - «Не ответили вообще»: плитка Пульса = полоса в «Типовых проблемах» = «все N» в панели деталей = «Найдено: N» в «Все диалоги» после перехода из панели;
   - «Вопрос или телефон без ответа»: плитка Пульса = «все N» в панели = «Найдено» после перехода.
   Переход в «Все диалоги» идёт кнопкой панели, как у пользователя.
   Запуск: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node b4check.cjs --op <op-gm-automation> [--src <src>] [--fx JSON]
   Код выхода: 0 = расхождений 0; 1 = есть. */
const path = require('path');
const { build } = require('./harness/gen.cjs');
const o = {}; process.argv.slice(2).forEach((a, i, A) => { if(a.startsWith('--')) o[a.slice(2)] = A[i + 1]; });
const OP = require('./harness/oproot.cjs')(o.op), SRC = path.resolve(o.src || path.join(OP, 'src'));
const FX = o.fx ? JSON.parse(o.fx) : {};
const HTML = build(OP, SRC, path.join(__dirname, 'out', 'b4.harness.html'));
const num = s => { const m = String(s || '').replace(/(\d)[   ](?=\d{3}(?!\d))/g, '$1').match(/\d+/); return m ? +m[0] : null; };
(async () => {
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 }, reducedMotion:'reduce' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
  await ctx.addInitScript(x => { window.__FX_OPTS = x; }, FX);
  const open = async hash => { const page = await ctx.newPage(); await page.clock.setFixedTime(new Date(FX.export || '2026-09-22T09:00:00+03:00'));
    await page.goto('file://' + HTML + '#' + hash); await page.waitForFunction(() => window.__READY === true); await page.waitForTimeout(150); return page; };
  let bad = 0;
  for(const cab of ['OLD-G', 'NEW-B']) for(const per of ['7', '30']){
    for(const [metric, label, probTitle] of [['noresp', 'Не ответили вообще', 'Живого ответа нет'], ['quest', 'Вопрос или телефон без ответа', null]]){
      const p = await open(cab + '.pulse.' + per);
      const tile = await p.evaluate(l => { const t = [...document.querySelectorAll('.ks-tile')].find(x => x.querySelector('.ks-tile-label').textContent.trim() === l); return t ? t.querySelector('.ks-tile-value').textContent : null; }, label + ' · ' + cab);
      await p.evaluate(id => KS.drawer.open(id), metric + '-' + cab); await p.waitForTimeout(250);
      const panelBtn = await p.$('#ks-drawer [data-go]');
      const panel = panelBtn ? await panelBtn.textContent() : 'пусто';
      let found = null;
      if(panelBtn){ await panelBtn.click(); await p.waitForTimeout(400); found = await p.evaluate(() => { const e = document.querySelector('#view .op-count'); return e ? e.textContent : null; }); }
      await p.close();
      let probs = null;
      if(probTitle !== null){ const q = await open(cab + '.probs.' + per);
        probs = await q.evaluate(() => { const c = [...document.querySelectorAll('.ks-card')].find(x => /Не ответили|живого ответа|без ответа/i.test((x.querySelector('.ks-card-title') || {}).textContent || '') && x.querySelector('.ks-bars'));
          return c ? { title:c.querySelector('.ks-card-title').textContent, v:c.querySelector('.ks-bar-value').firstChild.textContent } : null; });
        await q.close(); }
      const vals = { 'плитка Пульса':num(tile), 'панель «все N»':panelBtn ? num(panel) : 0, '«Все диалоги» Найдено':panelBtn ? num(found) : 0 };
      if(probs) vals['Типовые проблемы «' + probs.title + '»'] = num(probs.v);
      const set = new Set(Object.values(vals)); const ok = set.size === 1;
      if(!ok) bad++;
      console.log((ok ? 'PASS' : 'FAIL') + '  ' + cab + ' ' + per + ' дн · ' + label + ' | ' + Object.entries(vals).map(([k, v]) => k + ' ' + v).join(' · '));
    }
  }
  await browser.close();
  console.log('ИТОГ B4:', bad ? 'FAIL, расхождений ' + bad + ' (код 1)' : 'PASS (код 0)');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ОШИБКА:', e && e.stack || e); process.exit(2); });
