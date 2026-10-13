import { chromium } from 'playwright-core';
const P='/home/user/t1/analytics-mvp/public/';
const periods=[['2026-09-01','2026-09-30'],['2026-08-01','2026-08-31'],['2026-10-01','2026-10-12'],['2026-09-10','2026-09-20'],['2026-07-01','2026-09-30']];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const num=s=>Number(String(s).replace(/[^\d,\-−]/g,'').replace('−','-').replace(',','.'))||0;
async function load(page,from,to){const ctx=await b.newContext();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(([f,t])=>localStorage.setItem('gg_katya_period',JSON.stringify({p:'range',from:f,to:t})),[from,to]);
  await p.goto('file://'+P+page);await p.waitForTimeout(2500);return {p,ctx,errs};}
async function tot(p){return p.evaluate(()=>{const t=document.querySelector('#ordan-t');if(!t)return null;const h=[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim());
  const r=[...t.querySelectorAll('tr')].find(tr=>/^ИТОГО/i.test((tr.children[0]||{}).textContent?.trim()||''));if(!r)return {h,none:1};const o={};h.forEach((k,i)=>o[k]=r.children[i]?.textContent.trim());return o;});}
for(const [f,t] of periods){
  const m=await load('katya-money.html',f,t), c=await load('katya-reklama-kartochki.html',f,t), r=await load('katya-report.html',f,t);
  const tm=await tot(m.p), tc=await tot(c.p);
  const pick=o=>o&&Object.fromEntries(Object.entries(o).filter(([k])=>/выплате|Реклама|Общие|Чистая|АДМ/i.test(k)));
  // ad-sub check
  const sub=await c.p.evaluate(()=>{document.querySelectorAll('#top .ad-exp').forEach(e=>e.click());const bad=[];const n=s=>Number(String(s).replace(/[^\d\-]/g,''))||0;
    document.querySelectorAll('#top .ad-exp').forEach(tr=>{const i=tr.getAttribute('data-i');const subs=[...document.querySelectorAll('#top .ad-sub[data-i="'+i+'"]')];if(!subs.length)return;if(subs.some(x=>x.children.length<6))return;
      for(const col of [3,4,5]){const s=subs.reduce((a,x)=>a+n(x.children[col]?.textContent),0),T=n(tr.children[col].textContent);if(Math.abs(s-T)>subs.length)bad.push([tr.children[0].textContent.slice(0,40),col,T,s]);}});
    return {camps:document.querySelectorAll('#top .ad-exp').length,bad,note:(document.getElementById('cpc-note')||{}).textContent||''};});
  console.log(f,t,'| errs money',m.errs,'card',c.errs,'report',r.errs);
  console.log('  money',JSON.stringify(pick(tm)));console.log('  card ',JSON.stringify(pick(tc)));
  console.log('  sub camps',sub.camps,'bad',JSON.stringify(sub.bad),'note-mismatch',/не сходится/.test(sub.note));
  for(const x of [m,c,r])await x.ctx.close();
}
await b.close();
