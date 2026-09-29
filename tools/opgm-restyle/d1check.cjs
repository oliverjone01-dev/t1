/* d1check: красный тест дефекта Д1 (Р7 ФЕНИКСА) на синтетическом стенде.
   Сегодня (код 24eb500d) обязан падать с кодом 1; после исправления Д1 в Д-пакете обязан проходить с кодом 0.
   Фикстура: выгрузка 05.10.2026 (месяц, которого нет в MON, opgm.js:13) и добавочные чаты июля 2025 года (opgm.js:52 берёт только месяц).
   Пара фикстур с добавочными чатами и без них при одинаковом seed: столбец июля не должен зависеть от чатов 2025 года.
   Проверки:
   1) в отрисованном тексте экранов «до 22» нет (подпись должна идти от EXPORT_TS);
   2) в таблицах-двойниках помесячных графиков Скорости и Рассылки есть строка октября;
   3) у текущего месяца подпись «до 05» (день выгрузки);
   4) строка июля не меняется от чатов июля 2025 года (обе таблицы);
   5) путь переписки чата 2025 года показывает 2025, а не 2026 (opgm.js:507);
   6) несколько дат выгрузки, включая смену месяца и года (ТЗ ФЕНИКСА iter2 п.4, по образцу его d1multi.cjs): 05.10.2026, 02.11.2026, 11.01.2027;
      строки помесячных таблиц-двойников Скорости и Рассылки = месяцы от апр 2026 до месяца выгрузки по порядку, последняя «(до DD)», «до 22» в тексте нет.
      Реализация, вшитая под одну дату (октябрь руками), проходит 1-5 и падает здесь.
   Запуск: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node d1check.cjs --op <op-gm-automation> [--src <src>] [--dates ISO,ISO] */
const path = require('path');
const { build } = require('./harness/gen.cjs');
const o = {}; process.argv.slice(2).forEach((a, i, A) => { if(a.startsWith('--')) o[a.slice(2)] = A[i + 1]; });
const OP = require('./harness/oproot.cjs')(o.op), SRC = path.resolve(o.src || path.join(OP, 'src'));
const HTML = build(OP, SRC, path.join(__dirname, 'out', 'd1.harness.html'));
const EXPORT = '2026-10-05T09:00:00+03:00';
const extra = [];
for(let i = 0; i < 25; i++) extra.push({ t:'2025-07-' + String(1 + i).padStart(2, '0') + 'T12:00:00+03:00', cab:'OLD-G', kind:'in', lag:7 * 86400 });
for(let i = 0; i < 25; i++) extra.push({ t:'2025-07-' + String(1 + i).padStart(2, '0') + 'T13:00:00+03:00', cab:'OLD-G', kind:'cold' });
const FX_WITH = { seed:20260929, export:EXPORT, extra }, FX_WITHOUT = { seed:20260929, export:EXPORT };
const VIEWS = ['today', 'pulse', 'speed2', 'probs', 'ads', 'calls', 'cold', 'dlg', 'data'];

(async () => {
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const browser = await chromium.launch();
  const open = async (fx, hash) => {
    const ctx = await browser.newContext({ viewport:{ width:1280, height:900 }, reducedMotion:'reduce' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
    await ctx.addInitScript(x => { window.__FX_OPTS = x; }, fx);
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(EXPORT));
    await page.goto('file://' + HTML + '#' + hash);
    await page.waitForFunction(() => window.__READY === true, null, { timeout:15000 });
    await page.waitForTimeout(150);
    return { ctx, page };
  };
  const twin = async (fx, view, title) => { const { ctx, page } = await open(fx, 'all.' + view + '.all');
    const rows = await page.evaluate(t => { const c = [...document.querySelectorAll('#view .ks-card')].find(x => (x.querySelector('.ks-card-title') || {}).textContent === t);
      return c ? [...c.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())) : null; }, title);
    await ctx.close(); return rows; };
  const res = [];
  const check = (name, ok, detail) => { res.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + ' | ' + detail); };
  /* 1 */
  let hits = [];
  for(const v of VIEWS){ const { ctx, page } = await open(FX_WITH, 'all.' + v + '.all');
    const t = await page.evaluate(() => document.getElementById('view').innerText + ' ' + document.getElementById('stamp').textContent);
    const n = (t.match(/до 22/g) || []).length; if(n) hits.push(v + ':' + n); await ctx.close(); }
  check('1. «до 22» в отрисованном тексте при выгрузке 05.10', hits.length === 0, hits.length ? 'найдено: ' + hits.join(', ') : 'нет');
  /* 2-4 */
  const T = [['speed2', 'Медиана по месяцам'], ['cold', 'Сколько отправили по месяцам']];
  for(const [v, title] of T){
    const A = await twin(FX_WITH, v, title), B = await twin(FX_WITHOUT, v, title);
    if(!A || !B){ check('2-4. ' + title, false, 'таблица-двойник не найдена'); continue; }
    check('2. ' + title + ': строка октября есть', A.some(r => /^окт/.test(r[0])), 'месяцы: ' + A.map(r => r[0]).join(', '));
    const last = A[A.length - 1][0];
    check('3. ' + title + ': подпись текущего месяца «до 05»', /до 05/.test(last), 'последняя строка: ' + last);
    const ja = A.find(r => /^июл/.test(r[0])), jb = B.find(r => /^июл/.test(r[0]));
    check('4. ' + title + ': июль не зависит от чатов июля 2025', JSON.stringify(ja) === JSON.stringify(jb), 'с чатами 2025: ' + JSON.stringify(ja) + ' | без них: ' + JSON.stringify(jb));
  }
  /* 5 */
  { const { ctx, page } = await open(FX_WITH, 'all.dlg.all');
    const p = await page.evaluate(() => { OPGM.openThread('fx-extra-0'); const e = document.querySelector('#ks-drawer .op-path'); return e ? e.textContent : null; });
    check('5. путь переписки чата от 01.07.2025', !!p && /07\.2025/.test(p), 'путь: ' + p);
    await ctx.close(); }
  /* 6 */
  const RU = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const DATES = o.dates ? String(o.dates).split(',') : ['2026-10-05T09:00:00+03:00', '2026-11-02T09:00:00+03:00', '2027-01-11T09:00:00+03:00'];
  for(const ex of DATES){
    const y = +ex.slice(0, 4), m = +ex.slice(5, 7), dd = ex.slice(8, 10), want = [];
    for(let yy = 2026, mm = 4; ; mm++){ if(mm > 12){ mm = 1; yy++; } want.push(RU[mm - 1]); if(yy === y && mm === m) break; }
    const ctx = await browser.newContext({ viewport:{ width:1280, height:900 }, reducedMotion:'reduce' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
    await ctx.addInitScript(x => { window.__FX_OPTS = x; }, { seed:20260929, export:ex, start:'2026-04-01T00:00:00+03:00' });
    for(const [v, title] of T){
      const page = await ctx.newPage(); await page.clock.setFixedTime(new Date(ex));
      await page.goto('file://' + HTML + '#all.' + v + '.all'); await page.waitForFunction(() => window.__READY === true, null, { timeout:15000 }); await page.waitForTimeout(150);
      const r = await page.evaluate(t => { const c = [...document.querySelectorAll('#view .ks-card')].find(x => (x.querySelector('.ks-card-title') || {}).textContent === t);
        return { rows:c ? [...c.querySelectorAll('tbody tr')].map(tr => tr.children[0].textContent.trim()) : null, d22:(document.getElementById('view').innerText.match(/до 22/g) || []).length }; }, title);
      const got = (r.rows || []).map(x => x.slice(0, 3));
      check('6. выгрузка ' + ex.slice(0, 10) + ' · ' + title + ': месяцы апр 2026 - месяц выгрузки, «до ' + dd + '»', !!r.rows && JSON.stringify(got) === JSON.stringify(want) && new RegExp('до ' + dd).test(r.rows[r.rows.length - 1]) && r.d22 === 0,
        'строки: ' + (r.rows || []).join(', ') + ' | ждали: ' + want.join(', ') + ' | «до 22»: ' + r.d22);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  const bad = res.filter(x => !x).length;
  console.log('ИТОГ Д1:', bad ? 'FAIL, провалено ' + bad + ' из ' + res.length + ' (код 1)' : 'PASS ' + res.length + ' из ' + res.length + ' (код 0)');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ОШИБКА:', e && e.stack || e); process.exit(2); });
