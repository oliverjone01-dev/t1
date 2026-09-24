/* Дымовой тест: прогоняет все экраны в обеих темах, обоих проектах и на трёх
   периодах, ловит пустые графики, тонкие экраны, горизонтальную прокрутку и
   любую ошибку в консоли. Внешние библиотеки подменяются локальными копиями,
   чтобы тест не зависел от сети. */
import { chromium } from 'playwright';
import fs from 'fs';
import { execFileSync } from 'child_process';
/* Зеркало apexcharts: тест не зависит от сети на время прогона. В CI его кладёт
   шаг воркфлоу, локально - любой каталог через KONTUR_LIBS. Стили и кит Контур DS
   уже внутри страницы; шрифт с Google Fonts вырезается, вместо него системный. */
const LIBS = process.env.KONTUR_LIBS || '/tmp/claude-0';
const OUT  = process.env.KONTUR_TMP  || '/tmp/claude-0';
const CHROME = process.env.KONTUR_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
function prep(src, name){
  if(!src.includes('<script src="https://cdnjs.cloudflare.com/ajax/libs/apexcharts/')) throw new Error('в странице нет ApexCharts с cdnjs: сборка изменилась');
  fs.writeFileSync(OUT+'/'+name, src
   .replace(/<script src="https:\/\/cdnjs[^"]+"[^>]*><\/script>/,'<script src="file://'+LIBS+'/apex.js"></script>')
   .replace(/<link rel="stylesheet" href="https:\/\/fonts[^"]+">/,''));
}
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url),'utf8');
fs.mkdirSync(OUT,{recursive:true}); prep(html, 'page.html');

const b = await chromium.launch(CHROME ? {executablePath:CHROME} : {});
const p = await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];
p.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.goto('file://'+OUT+'/page.html', {waitUntil:'load', timeout:60000});
await p.waitForTimeout(1200);
const all = await p.evaluate(()=>Object.keys(screens()));
const dyn = all.filter(v=>v.startsWith('dyn-')||v==='obzor'||v.startsWith('ym-')||v.startsWith('yd-'));
console.log('экранов:', all.length, '| из них зависят от периода:', dyn.length);
const bad=[];
async function pass(list, proj, mode, per, thin){
  await p.evaluate(([m,pr,pe])=>{ document.documentElement.setAttribute('data-theme', m); CUR=pr; PERIOD=pe; render(); }, [mode,proj,per]);
  await p.waitForTimeout(260);
  for(const v of list){
    await p.evaluate(x=>go(x), v);
    await p.waitForTimeout(150);
    const i = await p.evaluate(()=>{
      const view=document.getElementById('view');
      return {len:view.innerText.length,
              empty:[...view.querySelectorAll('[id^="c-"]')].filter(e=>!e.querySelector('svg')).map(e=>e.id),
              over: document.documentElement.scrollWidth > document.documentElement.clientWidth+1};
    });
    if(i.empty.length || i.len<thin || i.over) bad.push([proj,mode,per,v,i.len,i.empty.join(',')||'-',i.over?'ГОРИЗ.СКРОЛЛ':'-']);
  }
}
// полный обход: обе темы, оба проекта, период по умолчанию
for(const proj of ['gm','gg']) for(const mode of ['light','dark']) await pass(all, proj, mode, '30d', 700);
// периоды: только экраны, которые от них зависят
for(const proj of ['gm','gg']) for(const per of ['7d','all']) await pass(dyn, proj, 'dark', per, 500);

console.log('ошибок консоли:', errs.length); [...new Set(errs)].slice(0,10).forEach(e=>console.log('  !',e.slice(0,200)));
console.log('проблемных:', bad.length); bad.slice(0,40).forEach(x=>console.log('  ·',x.join(' | ')));

// узкий экран
const errsBeforeNarrow = errs.length;
await p.setViewportSize({width:390,height:900});
const narrow=[];
for(const proj of ['gm','gg']){
  await p.evaluate(pr=>{ CUR=pr; render(); }, proj);
  for(const v of all){ await p.evaluate(x=>go(x), v); await p.waitForTimeout(110);
    if(await p.evaluate(()=>document.documentElement.scrollWidth > document.documentElement.clientWidth+1)) narrow.push(proj+'/'+v); }
}
console.log('горизонтальный скролл на 390px:', narrow.length); narrow.slice(0,20).forEach(x=>console.log('  ·',x));
const late = errs.length - errsBeforeNarrow;
console.log('ошибок консоли на узком проходе:', late); [...new Set(errs.slice(errsBeforeNarrow))].slice(0,10).forEach(e=>console.log('  !',e.slice(0,200)));

/* Запечатанная копия: тот же путь, что проходит опубликованная страница. Пароль
   тестовый и живёт только в этом прогоне. До пароля данных и кода быть не должно,
   неверный пароль не открывает, верный открывает все экраны без ошибок. */
const sealErr = [];
const TEST_PASS = 'smoke-test-'+Math.random().toString(36).slice(2,10);
fs.copyFileSync(new URL('../public/index.html', import.meta.url), OUT+'/sealed-src.html');
execFileSync('node', [new URL('./seal_page.mjs', import.meta.url).pathname, OUT+'/sealed-src.html'],
  {env:{...process.env, KONTUR_PASS:TEST_PASS, HUB_PASS:''}, stdio:['ignore','ignore','inherit']});
prep(fs.readFileSync(OUT+'/sealed-src.html','utf8'), 'sealed.html');
const sp = await (await b.newContext({viewport:{width:1440,height:1000}})).newPage();
sp.on('console', m=>{ if(m.type()==='error') sealErr.push(m.text()); });
sp.on('pageerror', e=>sealErr.push('PAGEERROR: '+e.message));
await sp.goto('file://'+OUT+'/sealed.html', {waitUntil:'load', timeout:60000});
const before = await sp.evaluate(()=>({db: typeof DB, start: typeof appStart, gate: !!document.getElementById('gate')}));
if(before.db!=='undefined' || before.start!=='undefined' || !before.gate) sealErr.push('до пароля доступно: '+JSON.stringify(before));
await sp.fill('#gatePass','wrong-password-000'); await sp.click('#gateForm button');
await sp.waitForFunction(()=>getComputedStyle(document.getElementById('gateErr')).display==='block', null, {timeout:15000}).catch(()=>sealErr.push('неверный пароль не дал ошибку'));
if(await sp.evaluate(()=>typeof DB)!=='undefined') sealErr.push('неверный пароль открыл данные');
await sp.fill('#gatePass', TEST_PASS); await sp.click('#gateForm button');
await sp.waitForFunction(()=>typeof DB!=='undefined' && !document.getElementById('gate'), null, {timeout:20000}).catch(()=>sealErr.push('верный пароль не открыл страницу'));
if(await sp.evaluate(()=>typeof DB)!=='undefined'){
  for(const proj of ['gm','gg']) for(const v of all){
    const n = await sp.evaluate(([pr,v])=>{ CUR=pr; VIEW=v; render(); return document.getElementById('view').innerText.length; }, [proj,v]);
    if(n<300) sealErr.push('тонкий экран после расшифровки: '+proj+'/'+v);
  }
}
console.log('запечатанная копия, проблем:', sealErr.length); [...new Set(sealErr)].slice(0,10).forEach(e=>console.log('  !',e.slice(0,200)));
await b.close();
process.exit(errs.length || bad.length || narrow.length || sealErr.length ? 1 : 0);
