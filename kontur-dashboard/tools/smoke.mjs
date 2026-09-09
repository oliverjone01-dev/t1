/* Дымовой тест: прогоняет все экраны в обеих темах, обоих проектах и на трёх
   периодах, ловит пустые графики, тонкие экраны, горизонтальную прокрутку и
   любую ошибку в консоли. Внешние библиотеки подменяются локальными копиями,
   чтобы тест не зависел от сети. */
import { chromium } from 'playwright';
import fs from 'fs';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url),'utf8');
const cut = html.indexOf('<div class="min-h-screen');
let hp = html.slice(0,cut)
 .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/,'<script>window.tailwind={config:{}}</script><script src="file:///tmp/claude-0/tw.js"></script>')
 .replace(/<script src="https:\/\/cdnjs[^"]+"><\/script>/,'<script src="file:///tmp/claude-0/apex.js"></script>')
 .replace(/<link rel="stylesheet" href="https:\/\/fonts[^"]+">/,'');
fs.writeFileSync('/tmp/claude-0/page.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style>'+hp+'</head><body>'+html.slice(cut)+'</body></html>');

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];
p.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.goto('file:///tmp/claude-0/page.html', {waitUntil:'load', timeout:60000});
await p.waitForTimeout(1200);
const all = await p.evaluate(()=>Object.keys(screens()));
const dyn = all.filter(v=>v.startsWith('dyn-')||v==='obzor'||v.startsWith('ym-')||v.startsWith('yd-'));
console.log('экранов:', all.length, '| из них зависят от периода:', dyn.length);
const bad=[];
async function pass(list, proj, mode, per, thin){
  await p.evaluate(([m,pr,pe])=>{ document.documentElement.classList.toggle('dark', m==='dark'); CUR=pr; PERIOD=pe; render(); }, [mode,proj,per]);
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
await p.setViewportSize({width:390,height:900});
const narrow=[];
for(const proj of ['gm','gg']){
  await p.evaluate(pr=>{ CUR=pr; render(); }, proj);
  for(const v of all){ await p.evaluate(x=>go(x), v); await p.waitForTimeout(110);
    if(await p.evaluate(()=>document.documentElement.scrollWidth > document.documentElement.clientWidth+1)) narrow.push(proj+'/'+v); }
}
console.log('горизонтальный скролл на 390px:', narrow.length); narrow.slice(0,20).forEach(x=>console.log('  ·',x));
await b.close();
process.exit(errs.length || bad.length || narrow.length ? 1 : 0);
