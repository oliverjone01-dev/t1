import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../../../analytics-mvp/package.json',import.meta.url));
const {JSDOM,VirtualConsole}=require('jsdom');
const root=process.cwd(),html=readFileSync('/Users/gengroup/Documents/Codex/outputs/fbs-estimate-preview-2026-10-28/katya-problems.html','utf8');
const rows=f=>readFileSync(root+'/analytics-mvp/data/'+f,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const details=rows('problems_postings.ndjson'),legacy=rows('orders_daily.ndjson'),events=rows('problems_events.ndjson');
const localDay=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)?s:new Date(Date.parse(s)+10800000).toISOString().slice(0,10);
const detailMap=new Map(details.map(r=>[r.order,r]));
const posts=legacy.map(r=>({order:r.order,date:localDay(r.t||r.d),scheme:r.scheme==='FBO'?'FBO':r.scheme==='rFBS'?'rFBS':'FBS/rFBS',status:r.status,...detailMap.get(r.order)}));
const known=new Set(posts.map(r=>r.order));posts.push(...details.filter(r=>!known.has(r.order)));
assert.equal(posts.length,new Set(posts.map(r=>r.order)).size);assert.equal(events.length,new Set(events.map(r=>r.id)).size);
const output={sourceRows:{legacy:legacy.length,details:details.length,mergedUnique:posts.length,events:events.length},periods:[]};
for(const [from,to] of [['2026-09-01','2026-09-30'],['2026-10-01','2026-10-15'],['2026-10-01','2026-10-27']]){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e)));
 const dom=new JSDOM(html,{url:'https://example.org/katya-problems.html',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.localStorage.setItem('gg_katya_period',JSON.stringify({p:'range',from,to}));w.HTMLElement.prototype.scrollIntoView=()=>{};}}),w=dom.window,d=w.document;
 const data=JSON.parse(d.querySelector('#problems-data').textContent);
 const inside=r=>r.date>=from&&r.date<=to;
 const cancel=posts.filter(r=>inside(r)&&r.scheme!=='FBO'&&r.status==='cancelled'),fine=events.filter(r=>inside(r)&&r.kind==='fine'),ret=events.filter(r=>inside(r)&&r.kind==='return');
 const expected={cancels:cancel.length,actors:Object.fromEntries([...new Set(cancel.map(r=>r.initiator))].map(a=>[a,cancel.filter(r=>r.initiator===a).length])),finePositiveCents:fine.filter(r=>r.amount>0).reduce((s,r)=>s+Math.round(r.amount*100),0),fineNetCents:fine.filter(r=>r.amount!==null).reduce((s,r)=>s+Math.round(r.amount*100),0),returnUnits:ret.filter(r=>r.qty!==null&&r.qty!==undefined).reduce((s,r)=>s+r.qty,0),returnRows:ret.length};
 const value=id=>d.querySelector('#'+id+' .reason-total b')?.textContent??null;
 const number=s=>s===null?null:Number(s.replace(/\s/g,'').replace(',','.'));
 const actual={cancels:number(value('cancel-breakdown')),initiators:number(value('cancel-initiator-breakdown')),finePositiveCents:value('fine-breakdown')===null?null:Math.round(number(value('fine-breakdown'))*100),returnUnits:number(value('return-breakdown')),returnActorUnits:number(value('return-initiator-breakdown'))};
 for(const [a,e] of [['cancels','cancels'],['initiators','cancels'],['finePositiveCents','finePositiveCents'],['returnUnits','returnUnits'],['returnActorUnits','returnUnits']])assert.equal(actual[a]??0,expected[e]);
 assert.deepEqual(data.events.filter(r=>r.kind==='fine'||r.kind==='return'),events.filter(r=>r.kind==='fine'||r.kind==='return'));
 assert.equal(data.postings.length,posts.length);assert.equal(d.querySelector('#tariff-estimate-summary'),null);assert.deepEqual(errors,[]);
 const badPost=structuredClone(data);badPost.postings.push(badPost.postings[0]);assert.throws(()=>w.validateProblems(badPost),/duplicate/);
 const badEvent=structuredClone(data);badEvent.events.push(badEvent.events[0]);assert.throws(()=>w.validateProblems(badEvent),/duplicate/);
 assert(d.querySelector('#fine-breakdown').textContent.includes((expected.fineNetCents/100).toLocaleString('ru-RU',{maximumFractionDigits:2})));
 const breakdownBefore=d.querySelector('#cancel-breakdown').textContent;
 assert.equal(d.querySelectorAll('.problem-pair').length,2);assert.equal(d.querySelector('#cancel-chart'),null);
 for(const kind of ['cancel','return']){
  const pair=d.querySelector('[data-problem-pair="'+kind+'"]');assert.deepEqual([...pair.children].map(x=>x.id),[kind+'-panel',kind+'-initiator-panel']);
  assert.equal(d.querySelector('#'+kind+'-breakdown .donut'),null);
  const bars=[...d.querySelectorAll('#'+kind+'-breakdown .reason-bar')],values=bars.map(b=>Number(b.querySelector('b').textContent.replace(/[^0-9,]/g,'').replace(',','.'))),max=Math.max(...values,1);
  bars.forEach((b,i)=>assert(Math.abs(Number.parseFloat(b.querySelector('.reason-track i').style.width)-values[i]/max*100)<1e-8));
  assert.equal(values.reduce((s,v)=>s+v,0),kind==='cancel'?expected.cancels:expected.returnUnits);
  if(bars[0]){bars[0].click();const expectedRows=Number(bars[0].querySelector('b').textContent.replace(/[^0-9]/g,''));assert.equal(d.querySelectorAll('#orders tr').length,expectedRows);}
 }
 const list=d.querySelector('#rfbs-list');assert.equal(list.hidden,true);assert(list.contains(d.querySelector('#rfbs-filter')));assert(list.contains(d.querySelector('#rfbs-search')));
 d.querySelector('[data-rfbs-view="late"]').click();assert.equal(list.hidden,false);assert.equal(list.open,true);assert.equal(d.querySelectorAll('#rfbs-table tbody tr').length,3);
 d.querySelector('[data-rfbs-view="late"]').click();assert.equal(list.hidden,true);assert.equal(list.open,false);
 d.querySelector('[data-rfbs-view="late"]').click();w.dispatchEvent(new w.Event('pageshow'));assert.equal(list.hidden,true);assert.equal(list.open,false);
 for(const top of ['10','30','50']){const s=d.querySelector('#cancel-top');s.value=top;s.dispatchEvent(new w.Event('change'));assert.equal(number(value('cancel-breakdown'))??0,expected.cancels);}
 const actorRows=[...d.querySelectorAll('#cancel-initiator-breakdown .reason-item')].map(r=>r.textContent);
 const returnActors=d.querySelector('#return-initiator-breakdown').textContent;
 assert(!d.body.textContent.includes('Отгруженные · факт + оценка'));
 if(ret.length)assert(returnActors.includes('Не указан'));
 output.periods.push({from,to,expected,actual,actorRows,returnActors,emptyCancelled:expected.cancels===0?breakdownBefore:null,coverageNote:d.querySelector('#coverage').textContent.slice(0,240),errors});
 w.localStorage.setItem('gg_katya_period',JSON.stringify({p:'7d'}));w.dispatchEvent(new w.StorageEvent('storage',{key:'gg_katya_period'}));assert(d.querySelector('#period-note').textContent.includes('2026-10-21 - 2026-10-27'));
 const select=d.querySelector('#rfbs-filter');select.value='overdue';select.dispatchEvent(new w.Event('change'));
 const barCount=[...d.querySelectorAll('#rfbs-status-bars b')].reduce((s,r)=>s+Number(r.textContent.replace(/[^0-9]/g,'')),0);
 const rowCount=[...d.querySelectorAll('#rfbs-table tbody tr')].filter(r=>r.children.length===7).length;assert.equal(barCount,rowCount);
 output.rfbsFilteredCount=rowCount;output.mutationDuplicateRejected=true;output.storageUpdate=true;dom.window.close();
}
output.returnInitiatorFields=events.filter(r=>r.kind==='return').filter(r=>'initiator' in r).length;
output.dedup='PASS';output.periodsMatch='PASS';
{
 const data=JSON.parse(new JSDOM(html).window.document.querySelector('#problems-data').textContent);data.postings=Array.from({length:55},(_,i)=>({order:'synthetic'+i,date:'2026-10-20',status:'cancelled',scheme:'FBS',offer:'A',sku:String(i),amount:1,initiator:'seller',reason:'Reason '+i}));data.events=[];
 const input=html.replace(/(<script type="application\/json" id="problems-data">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(data).replace(/</g,'\\u003c')+b);
 const dom=new JSDOM(input,{runScripts:'dangerously',url:'https://example.org',beforeParse(w){w.HTMLElement.prototype.scrollIntoView=()=>{};}}),d=dom.window.document;output.syntheticTop=[];
 for(const n of [10,30,50]){const sel=d.querySelector('#cancel-top');sel.value=String(n);sel.dispatchEvent(new dom.window.Event('change'));const bars=[...d.querySelectorAll('#cancel-breakdown .reason-bar')];assert.equal(bars.length,n+1);assert.equal(d.querySelector('#cancel-breakdown .reason-total b').textContent,'55');for(const b of bars)assert(Number.parseFloat(b.querySelector('.reason-track i').style.width)<=100);bars.at(-1).click();assert.equal(d.querySelectorAll('#orders tr').length,55-n);output.syntheticTop.push({n,remainder:55-n,rows:d.querySelectorAll('#orders tr').length});}
 dom.window.close();
}
output.emptySource=[];
for(const mode of ['missing','unknownQty']){
 const data=JSON.parse(new JSDOM(html).window.document.querySelector('#problems-data').textContent);data.postings=[];data.events=mode==='missing'?[]:data.events.filter(e=>e.kind==='return').map(e=>({...e,qty:null}));for(const c of Object.values(data.coverage))c.days=[];
 const input=html.replace(/(<script type="application\/json" id="problems-data">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(data).replace(/</g,'\\u003c')+b);
 const dom=new JSDOM(input,{runScripts:'dangerously',url:'https://example.org/problems'}),d=dom.window.document;
 for(const kind of ['cancel','return']){const root=d.querySelector('#'+kind+'-breakdown');assert.equal(root.querySelector('.reason-total-inline'),null);assert(root.textContent.includes(mode==='unknownQty'&&kind==='return'?'Нет положительных значений':'Нет подтверждённых данных'));output.emptySource.push({mode,kind,text:root.textContent});}
 dom.window.close();
}
writeFileSync(new URL('./feniks-probe-results.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
