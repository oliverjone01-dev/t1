import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
import { JSDOM } from "jsdom";
let dom: JSDOM;
const num=(s:any)=>{const v=parseFloat(String(s??"").replace(/[^\d,.-]/g,"").replace(/\s/g,"").replace(",","."));return isNaN(v)?null:v;};
const DEL=["Доставка покупателю","Доставка (средняя миля)","Доставка невыкупов и возвратов"];
function ref(from:string,to:string){
  const sv=JSON.parse(readFileSync("data-ym/svod_orders.json","utf8")); const ms=sv.months||sv;
  const ohM:any={},unM:any={};
  for(const m of ms){ for(const r of m.rows||[]){const k=String(r.d||"").slice(0,7); unM[k]=(unM[k]||0)+(r.units_net||0);}
    for(const [d,v] of Object.entries((m.overhead_daily||{}) as any)){const k=String(d).slice(0,7); ohM[k]=(ohM[k]||0)+(((v as any).m||0)+((v as any).p||0));}}
  let net=0,cogs=0,ship=0;
  for(const m of ms) for(const r of m.rows||[]){
    const d0=String(r.d||""); if(d0<from||d0>to) continue;
    const d=r.units_delivered||0,n=r.units_net||0,k=d0.slice(0,7);
    const per=(unM[k]||0)>0?(ohM[k]||0)/unM[k]:0;
    const pn=(d>0?(r.price||0)*n/d:(r.price||0))+(r.ship_mp||0);
    const fee=Object.values((r.svc||{}) as any).reduce((a:any,b:any)=>a+(b||0),0) as number;
    net+=pn+(r.ship_buyer||0)-fee-(r.svc_points||0)-per*n; cogs+=r.cogs||0; ship+=r.ship_our||0;
  }
  const gp=net-cogs-ship, np=gp-net*0.30-net*0.15;
  return {net,np,rent:net!==0?np/net*100:0};
}
beforeAll(async()=>{const out=mkdtempSync(join(tmpdir(),"per-"));
  execFileSync("npx",["tsx","src/scripts/build-katya.ts"],{env:{...process.env,DATA_DIR:"data-ym",OUT_DIR:out,PLATFORM:"ym"},stdio:"pipe"});
  dom=new JSDOM(readFileSync(join(out,"katya-tovary.html"),"utf8"),{runScripts:"dangerously",pretendToBeVisual:true});
  await new Promise(r=>setTimeout(r,1600));},90_000);
function pageFor(from:string,to:string){
  const D=dom.window.document, W:any=dom.window;
  (D.querySelector("#btn-range") as any).dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
  (D.querySelector("#range-from") as any).value=from; (D.querySelector("#range-to") as any).value=to;
  (D.querySelector("#range-apply") as any).dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
  let net=0,np=0,rows=0;
  for(const tr of [...D.querySelectorAll(".pt-table tbody tr.pt-row")]){
    const t=tr.querySelector("td.pt-margin")?.getAttribute("title")||""; if(!t) continue;
    const a=/Поступление ([\d\s   -]+) ₽/.exec(t), b=/чистая ([\d\s   -]+) ₽/.exec(t);
    if(a&&b){net+=num(a[1])!; np+=num(b[1])!; rows++;}
  }
  expect(rows, "ни одна строка не дала расчёта").toBeGreaterThan(0);
  return {net,np,rent:net!==0?np/net*100:0};
}
// §15 Definition of Done, п.2: итог проверяется на трёх типах периода. Граничные периоды и есть
// главный источник ошибок, и оба дефекта нашлись именно здесь:
//   1) помесячная нарезка долей дней давала за «1-15 июля» 1,94 млн вместо 2,52 млн поступления
//      (−8,6% вместо −13,2%): продажи внутри месяца лежат неровно, а доля дней об этом не знает.
//      Лечится посуточной раскладкой PNL_D.
//   2) артикулы, возвращённые целиком, имеют ноль штук и НЕнулевые деньги; отбрасывать их по
//      штукам - терять 35 799 ₽ убытка за июль и делать страницу красивее свода.
describe("«Товары»: рентабельность сходится со сводом на трёх типах периода", ()=>{
  for(const [nm,f,t] of [["целый закрытый месяц (июль)","2026-07-01","2026-07-31"],
                         ["часть месяца (1-15 июля)","2026-07-01","2026-07-15"],
                         ["текущий незакрытый (сентябрь)","2026-09-01","2026-09-30"]] as any){
    it(nm,()=>{const w=ref(f,t),g=pageFor(f,t);
      console.log(`${nm}: страница ${g.rent.toFixed(2)}% (${Math.round(g.net)} / ${Math.round(g.np)}) · свод ${w.rent.toFixed(2)}% (${Math.round(w.net)} / ${Math.round(w.np)})`);
      expect(Math.abs(g.net-w.net)).toBeLessThan(Math.max(500,Math.abs(w.net)*0.002));
      expect(Math.abs(g.rent-w.rent)).toBeLessThan(0.2);});
  }
});
