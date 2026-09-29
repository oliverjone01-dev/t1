/* contrast-layers: контраст старых экранов ОП ГМ вместе со слоями поверх (решение Р8, ТЗ §6 п.4).
   Функция контраста берётся из kontur-ds/tools/contrast_live.mjs и меняется в одном месте: пропуск закрытой панели
   '.ks-drawer:not(.open)' -> '.ks-drawer:not(.is-open)' (кит открывает панель классом is-open, kit.js; opgm.js openThread).
   Пакет Контур DS не правится: это локальная копия до исправления у владельца пакета.
   Слои: экран; панель деталей у каждой плитки и карточки с data-drill; панель переписки (первый data-th); палитра команд; подсказка кита (первый data-tip).
   Контроль метода: бледный текст в открытой панели ловится локальной копией и НЕ ловится исходной функцией.
   Запуск: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node contrast-layers.cjs --op <op-gm-automation> [--src <src>] [--views a,b] [--themes light,dark] [--dens comfortable,compact] [--widths 1280,390] [--control-only]
   Код выхода: 0 = провалов 0 и контроль прошёл; 1 = есть провалы; 2 = контроль метода не прошёл или ошибка. */
const fs = require('fs'), path = require('path');
const { build } = require('./harness/gen.cjs');
function args(a){ const o = {}; for(let i = 0; i < a.length; i++) if(a[i].startsWith('--')){ const k = a[i].slice(2); o[k] = (i + 1 < a.length && !a[i + 1].startsWith('--')) ? a[++i] : true; } return o; }
const o = args(process.argv.slice(2));
const OP = path.resolve(o.op || '../opgm/op-gm-automation'), SRC = path.resolve(o.src || path.join(OP, 'src'));
const src = fs.readFileSync(path.join(OP, 'kontur-ds/tools/contrast_live.mjs'), 'utf8');
const MARK = 'const fails = await page.evaluate(';
const a = src.indexOf(MARK) + MARK.length, b = src.indexOf('});\n      console.log(`${fails.length');
if(a < MARK.length || b < 0){ console.error('функция контраста не найдена в contrast_live.mjs'); process.exit(2); }
const FN_ORIG = src.slice(a, b + 1);
if(FN_ORIG.split('.ks-drawer:not(.open)').length !== 2){ console.error('ожидали ровно одно вхождение .ks-drawer:not(.open)'); process.exit(2); }
const FN = FN_ORIG.replace('.ks-drawer:not(.open)', '.ks-drawer:not(.is-open)');
const OUTDIR = path.join(__dirname, 'out'); fs.mkdirSync(OUTDIR, { recursive:true });
const HTML = build(OP, SRC, path.join(OUTDIR, 'contrast.harness.html'));
const ALL = ['today','pulse','speed2','probs','ads','calls','cold','dlg','data','teardowns','scripts','actions','m1','overview','problems','speed','quality','funnel','dialogues'];
const list = (k, d) => o[k] ? String(o[k]).split(',') : d;
const VIEWS = list('views', ALL), THEMES = list('themes', ['light','dark']), DENS = list('dens', ['comfortable','compact']), WIDTHS = list('widths', ['1280','390']).map(Number);
const run = (page, fn) => page.evaluate('(' + fn + ')()');

(async () => {
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const browser = await chromium.launch();
  const mk = async (theme, dens, width) => {
    const ctx = await browser.newContext({ viewport:{ width, height:900 }, reducedMotion:'reduce' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
    await ctx.addInitScript(p => { try{ localStorage.setItem('ks-theme', p[0]); if(p[1] === 'compact') localStorage.setItem('ks-density', 'compact'); else localStorage.removeItem('ks-density'); }catch(e){} }, [theme, dens]);
    return ctx;
  };
  const load = async (ctx, v, errs) => {
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(v + ': ' + String(e.message).slice(0, 140)));
    page.on('console', m => { if(m.type() === 'error') errs.push(v + ': ' + m.text().slice(0, 140)); });
    await page.clock.setFixedTime(new Date('2026-09-22T09:00:00+03:00'));
    await page.goto('file://' + HTML + '#all.' + v + '.30');
    await page.waitForFunction(() => window.__READY === true, null, { timeout:15000 });
    await page.waitForFunction(() => [...document.querySelectorAll('#view .ks-chart')].every(c => c.querySelector('.apexcharts-canvas')), null, { timeout:4000 }).catch(() => {});
    await page.waitForTimeout(150);
    return page;
  };
  /* 1. контроль метода */
  const ctl = {};
  { const ctx = await mk('light', 'comfortable', 1280), errs = [], page = await load(ctx, 'pulse', errs);
    await page.evaluate(() => { const s = document.createElement('span'); s.id = 'fx-pale-closed'; s.textContent = 'БЛЕДНЫЙ В ЗАКРЫТОЙ ПАНЕЛИ'; s.style.color = '#f2f2f2'; KS.drawer.ensure && KS.drawer.ensure(); const d = document.getElementById('ks-drawer'); if(d) d.appendChild(s); });
    ctl.closedPatched = (await run(page, FN)).some(x => x.includes('БЛЕДНЫЙ В ЗАКРЫТОЙ'));
    await page.evaluate(() => KS.drawer.open('speed-OLD-G')); await page.waitForTimeout(400);
    ctl.drawerClass = await page.evaluate(() => document.getElementById('ks-drawer').className);
    await page.evaluate(() => { const s = document.createElement('span'); s.textContent = 'БЛЕДНЫЙ В ОТКРЫТОЙ ПАНЕЛИ'; s.style.color = '#f2f2f2'; document.querySelector('#ks-drawer .ks-drawer-body').appendChild(s); });
    ctl.openOrig = (await run(page, FN_ORIG)).some(x => x.includes('БЛЕДНЫЙ В ОТКРЫТОЙ'));
    ctl.openPatched = (await run(page, FN)).some(x => x.includes('БЛЕДНЫЙ В ОТКРЫТОЙ'));
    await ctx.close(); }
  const ctlOk = ctl.openPatched && !ctl.openOrig && !ctl.closedPatched;
  console.log('КОНТРОЛЬ МЕТОДА: класс открытой панели «' + ctl.drawerClass + '»');
  console.log('  бледный текст в открытой панели: исходная функция contrast_live поймала =', ctl.openOrig, '| локальная копия с is-open поймала =', ctl.openPatched);
  console.log('  бледный текст в закрытой панели: локальная копия поймала =', ctl.closedPatched, '(ожидаем false: закрытая панель не проверяется)');
  console.log('  контроль:', ctlOk ? 'PASS' : 'FAIL');
  if(o['control-only']){ await browser.close(); process.exit(ctlOk ? 0 : 2); }
  /* 2. батарея */
  const rows = [], errsAll = [];
  for(const theme of THEMES) for(const dens of DENS) for(const width of WIDTHS){
    const ctx = await mk(theme, dens, width);
    for(const v of VIEWS){
      const errs = [], page = await load(ctx, v, errs);
      const rec = (layer, f) => rows.push({ theme, dens, width, v, layer, n:f.length, fails:f.slice(0, 3) });
      rec('экран', await run(page, FN));
      const drills = await page.evaluate(() => [...new Set([...document.querySelectorAll('#view [data-drill]')].map(e => e.dataset.drill))].filter(d => KS.drawer.providers[d]));
      for(const d of drills){
        await page.evaluate(id => KS.drawer.open(id), d);
        await page.waitForFunction(() => { const x = document.getElementById('ks-drawer'); return x.classList.contains('is-open') && (!x.querySelector('.ks-chart') || x.querySelector('.ks-chart .apexcharts-canvas')); }, null, { timeout:3000 }).catch(() => {});
        await page.waitForTimeout(100);
        rec('панель ' + d, await run(page, FN));
        await page.evaluate(() => KS.drawer.close()); await page.waitForTimeout(400); /* больше таймера очистки панели 320 мс, kit.js:330 */
      }
      const th = await page.$('#view [data-th]');
      if(th){ await th.click().catch(() => {}); await page.waitForTimeout(300);
        if(await page.evaluate(() => document.getElementById('ks-drawer') && document.getElementById('ks-drawer').classList.contains('is-open'))){ rec('панель переписки', await run(page, FN)); await page.evaluate(() => KS.drawer.close()); await page.waitForTimeout(400); /* больше таймера очистки панели 320 мс, kit.js:330 */ } }
      if(await page.evaluate(() => !!(KS.cmdk && KS.cmdk.show))){ await page.evaluate(() => KS.cmdk.show()); await page.waitForTimeout(200); rec('палитра команд', await run(page, FN)); await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
      const tipOk = await page.evaluate(() => { const t = [...document.querySelectorAll('#view [data-tip]')].find(e => e.getBoundingClientRect().width > 0); if(!t) return false; t.scrollIntoView({ block:'center' }); KS.tip.show(t); return true; });
      if(tipOk){ await page.waitForTimeout(150); rec('подсказка', await run(page, FN)); await page.evaluate(() => KS.tip.hide()); }
      errsAll.push(...errs.map(e => theme + '/' + dens + '/' + width + ' ' + e));
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  const by = {}; rows.forEach(r => { const k = r.layer.startsWith('панель ') && r.layer !== 'панель переписки' ? 'панели деталей' : r.layer; by[k] = by[k] || [0, 0]; by[k][0]++; by[k][1] += r.n; });
  const total = rows.reduce((s, r) => s + r.n, 0);
  fs.writeFileSync(path.join(OUTDIR, 'contrast-layers.json'), JSON.stringify({ ctl, rows, errs:errsAll }, null, 1));
  console.log('БАТАРЕЯ: экранов', VIEWS.length, '× тем', THEMES.length, '× плотностей', DENS.length, '× ширин', WIDTHS.length, '| проверок', rows.length);
  Object.entries(by).forEach(([k, [n, f]]) => console.log('  ' + k + ': проверок ' + n + ', провалов ' + f));
  rows.filter(r => r.n).slice(0, 12).forEach(r => console.log('  ПРОВАЛ', r.theme, r.dens, r.width, r.v, r.layer, '|', r.fails.join(' || ').slice(0, 220)));
  console.log('  ошибок консоли:', errsAll.length, errsAll.slice(0, 3).join(' | '));
  console.log('ИТОГО провалов контраста:', total, '|', !ctlOk ? 'FAIL (контроль метода)' : total ? 'FAIL' : 'PASS');
  process.exit(!ctlOk ? 2 : total ? 1 : 0);
})().catch(e => { console.error('ОШИБКА:', e && e.stack || e); process.exit(2); });
