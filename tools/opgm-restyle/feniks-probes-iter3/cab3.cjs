/* ФЕНИКС iter3: f3-cab-swap, цвет тега кабинета против цвета плитки того же кабинета на одном экране */
const SP = '/tmp/claude-0/-home-user-t1/16fce438-701e-5124-a7d4-75100c05e8b9/scratchpad', O = SP + '/feniks-iter3/out';
const { build } = require(SP + '/feniks-iter3/tools/harness/gen.cjs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OPD = SP + '/opgm/op-gm-automation';
(async () => {
  const browser = await chromium.launch();
  for(const [n, src] of [['база', OPD + '/src'], ['f3-cab-swap', SP + '/feniks-iter3/v/f3-cab-swap']]){
    const html = build(OPD, src, O + '/cab3-' + (n === 'база' ? 'base' : n) + '.harness.html');
    const ctx = await browser.newContext({ viewport:{ width:1280, height:900 }, reducedMotion:'reduce' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
    const page = await ctx.newPage(); await page.goto('file://' + html + '#all.pulse.30'); await page.waitForFunction(() => window.__READY === true); await page.waitForTimeout(200);
    const r = await page.evaluate(() => { const pr = document.createElement('span'); document.body.appendChild(pr);
      const col = v => { pr.style.color = v; return getComputedStyle(pr).color; }; const C1 = col('var(--cat-1)'), C2 = col('var(--cat-2)');
      const nm = c => c === C1 ? 'cat-1' : c === C2 ? 'cat-2' : c;
      const tag = cab => { const e = [...document.querySelectorAll('#view .op-cab')].find(x => x.textContent.trim() === cab); return e ? nm(col(getComputedStyle(e).getPropertyValue('--slot').trim())) : null; };
      const tile = cab => { const e = [...document.querySelectorAll('#view .ks-tile')].find(x => (x.querySelector('.ks-tile-label') || {}).textContent.includes(cab)); return e ? nm(col(getComputedStyle(e).getPropertyValue('--slot').trim())) : null; };
      const drawerTitle = (() => { KS.drawer.open('speed-OLD-G'); const t = (document.getElementById('ks-drawer-title') || {}).textContent; KS.drawer.close(); return t; })();
      return { 'OLD-G тег':tag('OLD-G'), 'OLD-G плитка':tile('OLD-G'), 'NEW-B тег':tag('NEW-B'), 'NEW-B плитка':tile('NEW-B'), 'заголовок панели speed-OLD-G':drawerTitle }; });
    console.log(n, JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('ОШИБКА', e && e.stack || e); process.exit(2); });
