import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
const html=readFileSync("public/katya.html","utf-8");
const vc=new VirtualConsole();const errs=[];vc.on("jsdomError",e=>errs.push(e.message));
const dom=new JSDOM(html,{runScripts:"dangerously",virtualConsole:vc,pretendToBeVisual:true,url:"https://x/"});
const w=dom.window,d=w.document;
function ozCol(){const r=[...d.querySelectorAll('.mx-row.lvl1')].slice(0,2);return r.map(tr=>{const tds=[...tr.querySelectorAll('td')];return tds[0].textContent.trim()+'='+tds[4].textContent.trim();}).join(', ');}
['rev','margin','orders','share'].forEach(m=>{const b=d.querySelector('[data-mx-mainmetric="'+m+'"]');if(b)b.dispatchEvent(new w.Event('click',{bubbles:true}));console.log(m.padEnd(7),':',ozCol());});
console.log("toggle buttons:",d.querySelectorAll('[data-mx-mainmetric]').length,"errs:",errs.slice(0,2));
