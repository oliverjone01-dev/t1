import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
const html=readFileSync("public/katya.html","utf-8");
const vc=new VirtualConsole();const errs=[];vc.on("jsdomError",e=>errs.push(e.message));
const dom=new JSDOM(html,{runScripts:"dangerously",virtualConsole:vc,pretendToBeVisual:true,url:"https://x/"});
const w=dom.window,d=w.document;
function abc(){const leg=[...d.querySelectorAll('.ax-legend-item')].map(x=>x.textContent.replace(/\s+/g,' ').trim()).filter(t=>/Лидеры|Внимание/.test(t));return leg.join(' || ');}
function setP(p){const b=[...d.querySelectorAll('[data-p]')].find(x=>x.getAttribute('data-p')===p);if(b){b.dispatchEvent(new w.Event('click',{bubbles:true}));return true;}return false;}
console.log("found 7d btn:",setP('7d'));console.log("7d :",abc());
setP('all');console.log("all:",abc());
setP('30d');console.log("30d:",abc());
console.log("errs:",errs.slice(0,2));
