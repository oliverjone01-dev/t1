import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";
const html=readFileSync("public/katya-marketing.html","utf-8");
const vc=new VirtualConsole();const errs=[];vc.on("jsdomError",e=>errs.push(e.message));
const dom=new JSDOM(html,{runScripts:"dangerously",virtualConsole:vc,pretendToBeVisual:true,url:"https://x/"});
const w=dom.window;const out=[];
const r=w.eval(`(function(){
  function spend(p){var b=PERIODS[p]||{};var t=b.totals||{};return t.spend;}
  return {p7:spend('p7'),p30:spend('p30'),p90:spend('p90'),
    p7c:(PERIODS.p7.top_spend||[]).length,p30c:(PERIODS.p30.top_spend||[]).length,p90c:(PERIODS.p90.top_spend||[]).length,
    p7id:((PERIODS.p7.top_spend||[])[0]||{}).id, p7sku:((PERIODS.p7.top_spend||[])[0]||{}).skus};
})()`);
out.push("spend p7/p30/p90: "+r.p7+" / "+r.p30+" / "+r.p90+"  (должны различаться)");
out.push("campaigns p7/p30/p90: "+r.p7c+" / "+r.p30c+" / "+r.p90c);
out.push("p7 first id: "+r.p7id+" | skus: "+JSON.stringify(r.p7sku));
out.push("errs: "+errs.slice(0,2).join(" | "));
writeFileSync("/tmp/pr3.txt",out.join("\n")+"\n");
