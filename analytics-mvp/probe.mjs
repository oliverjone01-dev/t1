import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";
const html=readFileSync("public/katya-marketing.html","utf-8");
const vc=new VirtualConsole();const errs=[];vc.on("jsdomError",e=>errs.push(e.message));
const dom=new JSDOM(html,{runScripts:"dangerously",virtualConsole:vc,pretendToBeVisual:true,url:"https://x/"});
const w=dom.window;const out=[];
// build live data: real campaigns from SNAP but with skus emptied (simulate objOf fail), then renderUecon
const res = w.eval(`(function(){
  var base = (typeof PERIODS!=='undefined' && PERIODS.p30) ? PERIODS.p30 : SNAP;
  out_base = (base.top_spend||[]).length;
  var live = {dateFrom:'x',dateTo:'y',totals:{spend:1,campaigns:10,active:5},
    top_spend:(base.top_spend||[]).map(function(c){var x={};for(var k in c)x[k]=c[k];x.skus=[];return x;}), burners:[], by_line:[]};
  lastA=live; renderUecon(live);
  var ue=document.getElementById('uecon');
  return {base:out_base, rows: ue?ue.querySelectorAll('tr').length:0, first: ue?ue.querySelector('tr').textContent.replace(/\\s+/g,' ').trim().slice(0,50):''};
})()`);
out.push("baked campaigns: "+res.base);
out.push("uecon rows after live with EMPTY skus (fallback test): "+res.rows);
out.push("first row: "+res.first);
out.push("errs: "+errs.slice(0,2).join(" | "));
writeFileSync("/tmp/pr2.txt",out.join("\n")+"\n");
