import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
const html=readFileSync("public/katya-tovary.html","utf-8");
const vc=new VirtualConsole();const errs=[];vc.on("jsdomError",e=>errs.push(e.message));
const dom=new JSDOM(html,{runScripts:"dangerously",virtualConsole:vc,pretendToBeVisual:true,url:"https://x/"});
const w=dom.window,d=w.document;
// switch to 30d and read first product row revenue
const b=d.querySelector('.pb[data-p="30d"]')||d.querySelector('[data-p="30d"]');
if(b)b.dispatchEvent(new w.Event('click',{bubbles:true}));
const rows=[...d.querySelectorAll('#products-tbody tr, .pt-row, table tbody tr')].slice(0,3);
console.log("product rows found:",rows.length);
rows.forEach(r=>console.log("  ",r.textContent.replace(/\s+/g,' ').trim().slice(0,90)));
console.log("jsdom errors:",errs.slice(0,3));
