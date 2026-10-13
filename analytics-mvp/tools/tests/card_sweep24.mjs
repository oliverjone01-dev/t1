import { chromium } from 'playwright-core';
const P='/home/user/t1/analytics-mvp/public/';
const periods=[['2026-06-01','2026-06-30'],['2026-07-01','2026-07-31'],['2026-08-01','2026-08-31'],['2026-09-01','2026-09-30'],['2026-10-01','2026-10-12'],
['2026-07-01','2026-07-15'],['2026-07-16','2026-07-31'],['2026-08-01','2026-08-15'],['2026-08-16','2026-08-31'],['2026-09-01','2026-09-15'],['2026-09-16','2026-09-30'],
['2026-09-01','2026-09-07'],['2026-09-08','2026-09-14'],['2026-09-15','2026-09-21'],['2026-09-22','2026-09-28'],['2026-08-29','2026-08-31'],['2026-09-29','2026-10-05'],
['2026-10-01','2026-10-10'],['2026-07-01','2026-09-30'],['2026-08-15','2026-09-15'],['2026-09-20','2026-10-10'],['2026-06-15','2026-07-15'],['2026-09-04','2026-09-04'],['2026-06-01','2026-10-12']];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const n=s=>{s=String(s||'').replace(/\s/g,'').replace('−','-').replace(/[^\d\-.,]/g,'').replace(',','.');return Number(s)||0;};
async function load(page,f,t){const ctx=await b.newContext();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(([f,t])=>localStorage.setItem('gg_katya_period',JSON.stringify({p:'range',from:f,to:t})),[f,t]);
  await p.goto('file://'+P+page);await p.waitForTimeout(2500);return {p,ctx,errs};}
const rowsOf=p=>p.evaluate(()=>{const t=document.querySelector('#ordan-t');if(!t)return null;const h=[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim());
  const get=re=>{const r=[...t.querySelectorAll('tr')].find(tr=>re.test((tr.children[0]||{}).textContent?.trim()||''));if(!r)return null;const o={};h.forEach((k,i)=>{if(/^Реклама|^Прочие|выплате/i.test(k))o[k]=r.children[i]?.textContent.trim();});return o;};
  return {tot:get(/^ИТОГО/i),obs:get(/^Общие расходы/i)};});
let fails=0;
for(const [f,t] of periods){
  const m=await load('katya-money.html',f,t), c=await load('katya-reklama-kartochki.html',f,t);
  const rm=await rowsOf(m.p), rc=await rowsOf(c.p);
  const sub=await c.p.evaluate(()=>{document.querySelectorAll('#top .ad-exp').forEach(e=>e.click());const bad=[];let negMain=0,negMin=0;const n=s=>Number(String(s).replace(/[^\d\-]/g,''))||0;
    document.querySelectorAll('#top .ad-sub').forEach(x=>{if(/^Основная карточка/.test(x.children[0]?.textContent||'')){const v=n(x.children[3]?.textContent);if(v<0){negMain++;negMin=Math.min(negMin,v);}}});
    document.querySelectorAll('#top .ad-exp').forEach(tr=>{const i=tr.getAttribute('data-i');const subs=[...document.querySelectorAll('#top .ad-sub[data-i="'+i+'"]')];if(!subs.length||subs.some(x=>x.children.length<6))return;
      for(const col of [3,4,5]){const s=subs.reduce((a,x)=>a+n(x.children[col]?.textContent),0),T=n(tr.children[col].textContent);if(Math.abs(s-T)>subs.length)bad.push([tr.children[0].textContent.slice(0,30),col,T,s]);}});
    const note=(document.getElementById('cpc-note')||{}).textContent||'';const mm=note.match(/(переехало|вернулось) ([\d\s]+) ₽/);
    return {bad,negMain,negMin,mv:mm?(mm[1]==='вернулось'?-1:1)*Number(mm[2].replace(/\s/g,'')):0,same:/те же, что на «Деньгах»/.test(note),broken:/не сходится/.test(note)};});
  const k=o=>o&&Object.keys(o);const key=(o,re)=>o&&Object.keys(o).find(x=>re.test(x));
  const R=(o,re)=>n(o?.[key(o,re)]);
  const dRek=R(rc?.tot,/^Реклама/)-R(rm?.tot,/^Реклама/), dPr=R(rc?.tot,/^Прочие/)-R(rm?.tot,/^Прочие/), dPay=R(rc?.tot,/выплате/)-R(rm?.tot,/выплате/), dObs=R(rc?.obs,/^Прочие/)-R(rm?.obs,/^Прочие/);
  const ok=!m.errs.length&&!c.errs.length&&!sub.bad.length&&!sub.negMain&&!sub.broken&&Math.abs(dPay)<=1&&Math.abs(dRek-sub.mv)<=1&&Math.abs(dRek+dPr)<=1&&(sub.mv?true:sub.same);
  if(!ok)fails++;
  console.log((ok?'OK  ':'FAIL'),f,t,'dРеклама',dRek,'dПрочие',dPr,'dОбщиеПрочие',dObs,'dКвыплате',dPay,'плашка',sub.mv,sub.same?'(=)':'','negMain',sub.negMain,sub.negMin,'bad',JSON.stringify(sub.bad),'errs',m.errs.length+c.errs.length);
  await m.ctx.close();await c.ctx.close();}
console.log('FAILS',fails);await b.close();
