/* ФЕНИКС iter3: причинность мутантов (что видит пользователь) на стендах, собранных numsnap в out/ (Φ3) и gen.cjs (Д1).
   Только чтение исходников; все файлы в scratchpad. */
const path = require('path');
const SP = '/tmp/claude-0/-home-user-t1/16fce438-701e-5124-a7d4-75100c05e8b9/scratchpad';
const O = SP + '/feniks-iter3/out', V = SP + '/feniks-iter3/v', OPD = SP + '/opgm/op-gm-automation';
const { build } = require(SP + '/feniks-iter3/tools/harness/gen.cjs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const FX3 = { seed:31337, export:'2026-10-01T08:05:00+03:00', start:'2026-05-10T00:00:00+03:00', n:650, expCab:{ 'OLD-G':'2026-10-01T08:05:00+03:00', 'NEW-B':'2026-09-30T19:40:00+03:00' } };
/* функция readable() из numsnap.cjs:78-92 дословно */
const READABLE = `(n, p) => { const alpha = c => { const m = /rgba?\\(([^)]+)\\)/.exec(c); if(!m) return 1; const q = m[1].split(/[\\s,\\/]+/).filter(Boolean); return q.length > 3 ? parseFloat(q[3]) : 1; };
    const r = document.createRange(); r.selectNodeContents(n); const rc = r.getBoundingClientRect();
    if(!(rc.width > 0 && rc.height > 0)) return false;
    const cs = getComputedStyle(p);
    if(cs.visibility !== 'visible' || parseFloat(cs.fontSize) < 11 || alpha(cs.color) < 0.5) return false;
    let op = 1;
    for(let e = p; e && e !== document.documentElement; e = e.parentElement){
      const c = e === p ? cs : getComputedStyle(e); op *= parseFloat(c.opacity); if(c.display === 'none') return false;
      if(e !== p && /hidden|clip/.test(c.overflowX + ' ' + c.overflowY)){ const b = e.getBoundingClientRect();
        const w = Math.min(rc.right, b.right) - Math.max(rc.left, b.left), h = Math.min(rc.bottom, b.bottom) - Math.max(rc.top, b.top);
        if(w <= 0 || h <= 0 || w * h < 0.5 * rc.width * rc.height) return false; }
    }
    return op >= 0.5; }`;
(async () => {
  const browser = await chromium.launch();
  const open = async (html, hash, { fx = FX3, clock = fx.export, width = 1280 } = {}) => {
    const ctx = await browser.newContext({ viewport:{ width, height:900 }, reducedMotion:'reduce', locale:'ru-RU', timezoneId:'Europe/Moscow' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
    await ctx.addInitScript(x => { window.__FX_OPTS = x; try{ localStorage.setItem('ks-theme', 'light'); }catch(e){} }, fx);
    const page = await ctx.newPage(); await page.clock.setFixedTime(new Date(clock));
    await page.goto('file://' + html + '#' + hash); await page.waitForFunction(() => window.__READY === true, null, { timeout:15000 });
    await page.waitForFunction(() => [...document.querySelectorAll('#view .ks-chart')].every(c => c.querySelector('.apexcharts-canvas')), null, { timeout:4000 }).catch(() => {});
    await page.waitForTimeout(200); return { ctx, page };
  };
  const H = n => O + '/' + n + '.harness.html';
  const log = (...a) => console.log(...a);

  /* 1. f3-vis: шесть приёмов; readable() numsnap = true, а пиксели числа не рисуются */
  log('== f3-vis (Φ3, стенд numsnap)');
  const tech = [['T1 -webkit-text-fill-color', 'all.pulse.30', '.ks-tile-value', 1280], ['T2 filter: opacity(0)', 'all.pulse.30', '.ks-num', 1280],
    ['T3 transform: scale(.05)', 'all.dlg.30', '.op-count b', 1280], ['T4 свой overflow:hidden, height 0', 'all.pulse.30', '.ks-strong', 1280],
    ['T5 сдвиг за экран left:-10000px', 'all.speed2.30', '.ks-bar-value', 1280], ['T6 только 600-1279 px (снято на 1024)', 'all.pulse.30', '#view tbody td', 1024],
    ['T6 контроль на 1280', 'all.pulse.30', '#view tbody td', 1280]];
  for(const [name, hash, sel, width] of tech){
    const { ctx, page } = await open(H('f3-vis'), hash, { width });
    const info = await page.evaluate(([sel, R]) => { const readable = eval(R);
      const el = [...document.querySelectorAll(sel)].find(e => /\d/.test(e.textContent) && e.getClientRects().length && !e.closest('[hidden]')); if(!el) return null;
      const tn = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.textContent)) || el.firstChild;
      const r = document.createRange(); r.selectNodeContents(tn); const rc = r.getBoundingClientRect(); const cs = getComputedStyle(el);
      let op = 1; for(let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
      el.setAttribute('data-f3', '1');
      return { text:el.textContent.trim().slice(0, 30), readable_numsnap:readable(tn, tn.parentElement), rect:[Math.round(rc.left), Math.round(rc.top), +rc.width.toFixed(1), +rc.height.toFixed(1)],
        fill:cs.webkitTextFillColor, filter:cs.filter, transform:cs.transform, own:[cs.overflow, el.clientHeight], opacity_eff:+op.toFixed(2) }; }, [sel, READABLE]);
    if(!info){ log(' ', name, ': узел не найден'); await ctx.close(); continue; }
    const pe = page.locator('[data-f3="1"]').locator('xpath=..');
    let same = 'n/a';
    try{ const a = await pe.screenshot(); await page.evaluate(() => { document.querySelector('[data-f3="1"]').style.visibility = 'hidden'; }); const b = await pe.screenshot(); same = a.equals(b) ? 'пиксели родителя с числом и без числа одинаковы (число не нарисовано)' : 'пиксели отличаются'; }catch(e){ same = 'снимок: ' + String(e.message).slice(0, 60); }
    log(' ', name, '|', JSON.stringify(info), '|', same);
    await ctx.close();
  }

  /* 2. f3-cellswap */
  log('== f3-cellswap: ячейка «Пропущено входящих», Пульс, период «всё время»');
  for(const n of ['base-a', 'f3-cellswap']){ const { ctx, page } = await open(H(n), 'all.pulse.all');
    const t = await page.evaluate(() => { const c = [...document.querySelectorAll('#view .ks-card')].find(x => /Звонки через Авито/.test((x.querySelector('.ks-card-title') || {}).textContent || ''));
      return c ? [...c.querySelectorAll('tbody tr')].map(tr => tr.children[0].textContent.trim() + ': ' + tr.children[3].textContent.trim()).join(' | ') : null; });
    log(' ', n, '|', t); await ctx.close(); }

  /* 3. f3-filter-ctx */
  log('== f3-filter-ctx: «Все диалоги»');
  for(const n of ['base-a', 'f3-filter-ctx']){
    const out = [];
    { const { ctx, page } = await open(H(n), 'OLD-G.dlg.30'); await page.selectOption('#f-prob', 'noresp'); await page.waitForTimeout(200);
      out.push('OLD-G, Проблема=noresp: ' + await page.evaluate(() => document.querySelector('#view .op-count').textContent.trim().slice(0, 40))); await ctx.close(); }
    { const { ctx, page } = await open(H(n), 'all.dlg.30'); await page.selectOption('#f-prob', 'slow'); await page.waitForTimeout(150); await page.selectOption('#f-flag', 'last'); await page.waitForTimeout(200);
      out.push('оба, Проблема=slow + Отметка=last: ' + await page.evaluate(() => document.querySelector('#view .op-count').textContent.trim().slice(0, 30)));
      await ctx.close(); }
    { const { ctx, page } = await open(H(n), 'all.dlg.30'); await page.selectOption('#f-sort', 'old'); await page.waitForTimeout(200);
      out.push('Порядок=сначала старые, первая карточка: ' + await page.evaluate(() => { const c = document.querySelector('#view [data-th]'); return c ? c.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) : null; }));
      await ctx.close(); }
    log(' ', n, '|', out.join(' || ')); }

  /* 4. f3-chart-swap */
  log('== f3-chart-swap: график «Обращений в неделю» против таблицы-двойника');
  for(const n of ['base-a', 'f3-chart-swap']){ const { ctx, page } = await open(H(n), 'all.pulse.30');
    const r = await page.evaluate(() => { const card = [...document.querySelectorAll('#view .ks-card')].find(x => /Обращений в неделю/.test((x.querySelector('.ks-card-title') || {}).textContent || ''));
      const ser = [...card.querySelectorAll('.apexcharts-series[seriesName]')].map(s => s.getAttribute('seriesName') + ':' + [...s.querySelectorAll('path')].map(p => (p.getAttribute('d') || '').length + '/' + (p.getAttribute('d') || '').slice(-18)).join(';').slice(0, 60));
      const tw = [...card.querySelectorAll('[id^="ks-tw-"] tbody tr')].slice(-2).map(tr => [...tr.children].map(td => td.textContent.trim()).join(' '));
      return { series:ser, twin_last2:tw }; });
    log(' ', n, '|', JSON.stringify(r)); await ctx.close(); }

  /* 5. f3-drill-click */
  log('== f3-drill-click: клик мышью по плитке с деталями и Enter с клавиатуры');
  for(const n of ['base-a', 'f3-drill-click']){ const { ctx, page } = await open(H(n), 'all.pulse.30');
    const b = await page.evaluate(() => { const t = document.querySelector('#view .ks-tile[data-drill]'); t.scrollIntoView(); const r = t.getBoundingClientRect(); return { x:r.left + r.width / 2, y:r.top + r.height / 2, drill:t.dataset.drill }; });
    await page.mouse.click(b.x, b.y); await page.waitForTimeout(300);
    const mouse = await page.evaluate(() => document.getElementById('ks-drawer').classList.contains('is-open'));
    await page.evaluate(() => KS.drawer.close()); await page.waitForTimeout(400);
    await page.focus('#view .ks-tile[data-drill]'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    const kb = await page.evaluate(() => document.getElementById('ks-drawer').classList.contains('is-open'));
    log(' ', n, '| плитка', b.drill, '| мышь: панель открыта =', mouse, '| Enter: панель открыта =', kb); await ctx.close(); }

  /* 6. f3-today-now: часы = выгрузка (как numsnap) и часы = выгрузка + 4 дня (как у пользователя в пятницу) */
  log('== f3-today-now: «Сегодня», срок 3 дня');
  for(const clock of [FX3.export, '2026-10-05T12:00:00+03:00']) for(const n of ['base-a', 'f3-today-now']){
    const { ctx, page } = await open(H(n), 'all.today.30', { clock });
    await page.click('[data-today="3"]'); await page.waitForTimeout(250);
    const t = await page.evaluate(() => [...document.querySelectorAll('#view .op-queue h2, #view .ks-tile')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' | ').slice(0, 170));
    log(' ', 'часы', clock.slice(0, 16), n, '|', t); await ctx.close(); }

  /* 7. Д1: f3-d1now, f3-d1noyear, штамп d1fix */
  log('== Д1');
  const D1FIX = '/home/user/t1/tools/opgm-restyle/variants/d1fix';
  const hD = n => build(OPD, n === 'd1fix' ? D1FIX : V + '/' + n, O + '/d1c-' + n + '.harness.html');
  const hs = { d1fix:hD('d1fix'), 'f3-d1now':hD('f3-d1now'), 'f3-d1noyear':hD('f3-d1noyear') };
  const rows = async (html, fx, clock, view, title) => { const { ctx, page } = await open(html, 'all.' + view + '.all', { fx, clock });
    const r = await page.evaluate(t => { const c = [...document.querySelectorAll('#view .ks-card')].find(x => (x.querySelector('.ks-card-title') || {}).textContent === t);
      return { rows:c ? [...c.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()).join(' ')) : null, stamp:document.getElementById('stamp').textContent }; }, title);
    await ctx.close(); return r; };
  { const fx = { seed:20260929, export:'2026-09-29T09:00:00+03:00', start:'2026-04-01T00:00:00+03:00' };
    for(const [clock, lab] of [[fx.export, 'часы = выгрузка 29.09'], ['2026-10-02T12:00:00+03:00', 'часы = 02.10, выгрузка 29.09']]) for(const n of ['d1fix', 'f3-d1now']){
      const r = await rows(hs[n], fx, clock, 'speed2', 'Медиана по месяцам'); log('  f3-d1now', lab, n, '| строки:', (r.rows || []).map(x => x.split(' ').slice(0, 3).join(' ')).slice(-3).join(', ')); } }
  { const fx = { seed:20260929, export:'2027-05-03T09:00:00+03:00', start:'2026-04-01T00:00:00+03:00' };
    for(const n of ['d1fix', 'f3-d1noyear']){ const r = await rows(hs[n], fx, fx.export, 'cold', 'Сколько отправили по месяцам');
      log('  f3-d1noyear выгрузка 03.05.2027', n, '| первые строки:', (r.rows || []).slice(0, 2).join(' ; '), '| последние:', (r.rows || []).slice(-2).join(' ; ')); } }
  { const fx = { seed:20260929, export:'2027-01-11T09:00:00+03:00', start:'2026-04-01T00:00:00+03:00' };
    const r = await rows(hs.d1fix, fx, fx.export, 'speed2', 'Медиана по месяцам'); log('  штамп d1fix при выгрузке 11.01.2027:', r.stamp, '| последняя строка:', (r.rows || []).slice(-1)[0]); }
  await browser.close();
})().catch(e => { console.error('ОШИБКА', e && e.stack || e); process.exit(2); });
