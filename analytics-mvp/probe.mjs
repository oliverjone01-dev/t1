import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
const html=readFileSync("public/katya.html","utf-8");
const vc=new VirtualConsole();const errs=[];vc.on("jsdomError",e=>errs.push(e.message));
const dom=new JSDOM(html,{runScripts:"dangerously",virtualConsole:vc,pretendToBeVisual:true,url:"https://x/"});
const d=dom.window.document;const p=d.getElementById('profitability');
console.log("summary:",p?[...p.querySelectorAll('.cl-summary div')].map(x=>x.textContent.trim()).filter(Boolean).join(' | '):'(none)');
console.log("chart bars:",!!p.querySelector('.pr-bar-comm'),"errs:",errs.slice(0,2));
