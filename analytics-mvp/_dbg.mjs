import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";
const store={};const ls={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);}};
const vc=new VirtualConsole();
const dom=new JSDOM(readFileSync("public/katya.html","utf8"),{runScripts:"dangerously",virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){Object.defineProperty(w,"localStorage",{value:ls});}});
await new Promise(r=>setTimeout(r,600));
const w=dom.window;
const b30=w.document.querySelector('.pb[data-p="30d"]');b30&&b30.dispatchEvent(new w.Event('click',{bubbles:true}));
await new Promise(r=>setTimeout(r,300));
let out="";
out+="state.period="+w.state.period+"\n";
const r=w.getDateRange();
out+="getDateRange: startIdx="+r.startIdx+" endIdx="+r.endIdx+" TODAY_IDX="+w.TODAY_IDX+" TOTAL_DAYS="+w.TOTAL_DAYS+"\n";
const base=Date.UTC(2025,2,1);
const ds=i=>new Date(base+i*86400000).toISOString().slice(0,10);
out+="окно дат: "+ds(r.startIdx)+" .. "+ds(r.endIdx)+"\n";
// сумма реального канала за это окно
const DR=w.__DAILY_REV_REAL||[];let s=0;for(let i=r.startIdx;i<=r.endIdx;i++)s+=DR[i]||0;
out+="sum(__DAILY_REV_REAL) за окно = "+s.toFixed(2)+" млн\n";
// сумма DAILY_REV_CAT
let s2=0;w.CAT_TREE.forEach(g=>g.children.forEach(c=>{const a=w.DAILY_REV_CAT[c.id]||[];for(let i=r.startIdx;i<=r.endIdx;i++)s2+=a[i]||0;}));
out+="sum(DAILY_REV_CAT все подкатегории) = "+s2.toFixed(2)+" млн\n";
out+="__SUB_D_R ключей: "+Object.keys(w.__SUB_D_R||{}).length+" · DAILY_REV_CAT ключей: "+Object.keys(w.DAILY_REV_CAT||{}).length+"\n";
const miss=[];w.CAT_TREE.forEach(g=>g.children.forEach(c=>{if(!(w.__SUB_D_R||{})[c.id])miss.push(c.id);}));
out+="подкатегорий без реального ряда: "+miss.length+" -> "+miss.slice(0,6).join(",")+"\n";
writeFileSync("_dbg.txt",out);
