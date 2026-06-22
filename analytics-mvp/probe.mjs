import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
const html=readFileSync("public/katya.html","utf-8");
const vc=new VirtualConsole();const errs=[];vc.on("jsdomError",e=>errs.push(e.message));
const dom=new JSDOM(html,{runScripts:"dangerously",virtualConsole:vc,pretendToBeVisual:true,url:"https://x/"});
const d=dom.window.document;
// find Категории×Каналы matrix; check Озон column cells not all н/д
const mx=[...d.querySelectorAll('.mx-row.lvl1')].slice(0,3);
console.log("matrix group rows:",mx.length);
mx.forEach(r=>{const tds=[...r.querySelectorAll('td')];console.log("  ",tds.slice(0,6).map(t=>t.textContent.trim()).join(' | '));});
const abc=[...d.querySelectorAll('.card-sub')].map(x=>x.textContent).find(t=>/ABC.*XYZ/.test(t));
console.log("ABC sub:",abc);
console.log("errs:",errs.slice(0,3));
