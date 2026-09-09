import { chromium } from 'playwright'; import fs from 'fs';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url),'utf8');
const cut = html.indexOf('<div class="min-h-screen');
let hp = html.slice(0,cut)
 .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/,'<script>window.tailwind={config:{}}</script><script src="file:///tmp/claude-0/tw.js"></script>')
 .replace(/<script src="https:\/\/cdnjs[^"]+"><\/script>/,'<script src="file:///tmp/claude-0/apex.js"></script>')
 .replace(/<link rel="stylesheet" href="https:\/\/fonts[^"]+">/,'');
fs.writeFileSync('/tmp/claude-0/page.html','<!doctype html><html><head><meta charset="utf-8"><style>html{color-scheme:light}body{margin:0;font:14px system-ui}</style>'+hp+'</head><body>'+html.slice(cut)+'</body></html>');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:1500,height:1050},deviceScaleFactor:1.4});
await p.goto('file:///tmp/claude-0/page.html',{waitUntil:'load'}); await p.waitForTimeout(1500);
const shots=[['obzor','gg','dark'],['dyn-sum','gg','dark'],['dyn-ym','gg','light'],['obzor','gm','light'],['yd-cost','gg','dark'],['dyn-log','gm','dark']];
for(const [v,pr,md] of shots){
  await p.evaluate(([vv,p2,m])=>{document.documentElement.classList.toggle('dark',m==='dark');CUR=p2;go(vv);},[v,pr,md]);
  await p.waitForTimeout(900);
  await p.screenshot({path:`/tmp/claude-0/shots/${v}-${md}.png`});
}
await b.close(); console.log('снято');
