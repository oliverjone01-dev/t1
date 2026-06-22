import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";
const html=readFileSync("public/katya-marketing.html","utf-8");
const vc=new VirtualConsole();const errs=[];vc.on("jsdomError",e=>errs.push(e.message));
const dom=new JSDOM(html,{runScripts:"dangerously",virtualConsole:vc,pretendToBeVisual:true,url:"https://x/"});
const w=dom.window;const out=[];
const r=w.eval(`(function(){
  function stat(p){var b=PERIODS[p]||{};var ts=b.top_spend||[];var bn=b.burners||[];
    return {n:ts.length, withId:ts.filter(c=>c.id).length, withStatus:ts.filter(c=>c.status).length, withInstr:ts.filter(c=>c.instr).length, withSkus:ts.filter(c=>c.skus&&c.skus.length).length,
            bn:bn.length, bnId:bn.filter(c=>c.id).length, bnStatus:bn.filter(c=>c.status).length};}
  return {p7:stat('p7'),p30:stat('p30'),p90:stat('p90')};
})()`);
for(const k of ['p7','p30','p90']){const s=r[k];out.push(k+": кампаний "+s.n+" (id "+s.withId+", статус "+s.withStatus+", инстр "+s.withInstr+", skus "+s.withSkus+") | сливов "+s.bn+" (id "+s.bnId+", статус "+s.bnStatus+")");}
out.push("errs: "+errs.slice(0,2).join(" | "));
writeFileSync("/tmp/pr4.txt",out.join("\n")+"\n");
