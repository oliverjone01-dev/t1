// Read-only release check against the actual prepared capture and generated pages.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {JSDOM,VirtualConsole} from 'jsdom';
import {readCaptureFile} from '../../src/scripts/ozon/cabinet-capture.js';
import {captureDays,captureIsOpen} from '../../src/scripts/ozon/cabinet-funnel.js';

const [data,out]=process.argv.slice(2);
assert(data&&out,'Usage: verify_dashboard.ts DATA_DIR OUT_DIR');
const file=readCaptureFile(data),days=captureDays(file);
const selected=days.at(-1),closed=days.filter(r=>!captureIsOpen(r)).at(-1);
assert(selected,'Release probe requires an observation');
const errors:string[]=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const page=(name:string)=>new JSDOM(readFileSync(join(out,name),'utf8'),{
  url:'https://dashboard.example/'+name,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
});
const dom=page('katya-voronka.html'),doc=dom.window.document;
const number=(text:string|null)=>Number((text??'').replace(/[^\d.-]/g,''));
const metrics=['views','search_views','pdp_views','cart','ordered_units'] as const;
const click=(p:string)=>{const b=doc.querySelector<HTMLButtonElement>(`button[data-p="${p}"]`);assert(b,`Missing period ${p}`);b.click();};
click('cabinet');
const bars=[...doc.querySelectorAll('.vf-bar')];
assert.equal(bars.length,6);
metrics.forEach((k,i)=>assert.equal(number(bars[i]!.textContent),selected.totals[k],`Open funnel ${k}`));
assert.match(bars[5]!.textContent??'',/нет данных/);
const total=doc.querySelector('.cf-total');assert(total,'Missing category total');
const cells=[...total.querySelectorAll('td')];
metrics.forEach((k,i)=>assert.equal(number(cells[[1,3,5,7,9][i]!]!.textContent),selected.totals[k],`Category total ${k}`));
assert.match(cells.at(-1)!.textContent??'',/нет данных/);
const cards=[...doc.querySelectorAll('#kpis .card')];
for(const i of [0,4,5])assert.match(cards[i]!.textContent??'',/нет данных/,'Unknown financial/outcome KPI');
assert(![...doc.querySelectorAll('#kpis .kt-d,#kpis .kt-cap')].some(n=>n.textContent?.trim()),'Partial day must not show a full-day delta');
const stamp=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(new Date(selected.captured_at));
assert(doc.querySelector('#fsub')!.textContent!.includes(stamp),'Moscow observation time');
assert.equal(doc.querySelectorAll('.cabinet-history,.cabinet-capture').length,0,'No isolated report dump');
const historyLast=readFileSync(join(data,'history.ndjson'),'utf8').trim().split('\n').map(l=>JSON.parse(l).date).sort().at(-1);
click('today');
if(closed&&closed.day===historyLast){
assert.match(doc.querySelector('#fsub')!.textContent??'',new RegExp(closed.day));
metrics.forEach((k,i)=>assert.equal(number(doc.querySelectorAll('.vf-bar')[i]!.textContent),closed.totals[k],`Closed funnel ${k}`));
if(closed.totals.search_views===0)for(const row of doc.querySelectorAll('.cf-cat'))assert.equal(row.querySelectorAll('td')[3]!.textContent,'0');
if(closed.totals.pdp_views===0)for(const row of doc.querySelectorAll('.cf-cat'))assert.equal(row.querySelectorAll('td')[5]!.textContent,'0');
}
for(const p of ['7d','30d','90d','year','all','cabinet','today'])click(p);
assert.equal(dom.window.localStorage.getItem('gg_katya_period'),JSON.stringify({p:'today'}));
dom.window.close();

const tests=page('katya-tests.html'),td=tests.window.document;
const definitions=JSON.parse(readFileSync('tools/tests/tests.json','utf8')).тесты;
const skuToArt=JSON.parse(readFileSync(join(data,'sku_offer.json'),'utf8'));
const byArt=new Map(selected.items.filter(r=>skuToArt[r.sku]).map(r=>[skuToArt[r.sku],r]));
let checked=0,missing=0;
if(captureIsOpen(selected))for(const def of definitions){
  const card=[...td.querySelectorAll('.tcard')].find(c=>c.querySelector('.ctitle')?.textContent?.includes(def.название));
  assert(card,`Missing experiment card ${def.id}`);
  const detail=[...card.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent?.includes('Незакрытый срез'));
  assert(detail,`Missing selected observation in ${def.id}`);
  assert(detail.textContent!.includes(stamp),'Experiment Moscow time');
  const rows=[...detail.querySelectorAll('tbody tr')];assert.equal(rows.length,def.тест.length);
  for(const row of rows){
    const cs=[...row.querySelectorAll('td')],art=cs[0]!.textContent!,r=byArt.get(art);
    if(!r){assert(cs.slice(1).every(c=>c.textContent==='нет данных'));missing++;continue;}
    const expected=[r.search_position&&r.search_position>0?r.search_position:null,r.search_views,r.pdp_views,r.cart,r.ordered_units];
    expected.forEach((v,i)=>v===null?assert.equal(cs[i+1]!.textContent,'нет данных'):assert.equal(number(cs[i+1]!.textContent),v,`${art} metric ${i}`));
    checked++;
  }
}
const pd=(tests.window as any).PD;assert(pd,'Missing plan data');
if(closed){
 const i=pd.days.indexOf(closed.day);assert(i>=0);
 const api=readFileSync(join(data,'sku_views.ndjson'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)).filter(r=>r.date===closed.day);
 const source=new Map(api.map(r=>[String(r.sku),{...r}]));
 for(const r of closed.items)source.set(r.sku,{...source.get(r.sku),views:r.views,vsearch:r.search_views,pdp:r.pdp_views,cart:r.cart,units:r.ordered_units});
 for(const k of ['views','vsearch','pdp','cart','units'])assert.equal(pd.store[k][i],[...source.values()].reduce((s,r)=>s+r[k],0),'Plan store '+k);
 const artRows=new Map(closed.items.filter(r=>skuToArt[r.sku]).map(r=>[skuToArt[r.sku],r]));
 pd.cards.forEach((card:any,n:number)=>{const r=artRows.get(card.art);if(r)assert.equal(pd.ser[n].pos[i],r.search_position&&r.search_position>0?r.search_position:null,'Plan position '+card.art);});
}
if(captureIsOpen(selected)){
 assert.equal(pd.partial.day,selected.day,'Plan current day');
 for(const [k,raw] of [['views','views'],['vsearch','search_views'],['pdp','pdp_views'],['cart','cart'],['units','ordered_units']] as const){
  assert.equal(pd.partial.store[k],selected.totals[raw],'Current store '+k);
 }
 const nativeMetrics=[['views','views'],['vsearch','search_views'],['pdp','pdp_views'],['cart','cart'],['units','ordered_units']] as const;
 for(const def of definitions.filter((d:any)=>d.тест?.length)){
  const dyn=(tests.window as any).DYN['dyn-'+def.id];if(!dyn||dyn.d.at(-1)!==selected.day)continue;
  for(const [key,field] of nativeMetrics){
   if(!dyn.m[key])continue;
   const observed=selected.items.filter(r=>def.тест.includes(skuToArt[r.sku])&&r[field]!==null);
   const sum=observed.length?observed.reduce((n,r)=>n+r[field]!,0):null;
   assert.equal(dyn.m[key].rt.at(-1),sum,def.id+' partial tooltip '+key);
  }
  if(dyn.m.pos)for(const [value,raw] of [['t','rt'],['c','rc']]){
   if(dyn.m.pos[value].at(-1)===null)assert.equal(dyn.m.pos[raw].at(-1),null,'Suppressed position tooltip');
  }
 }
 const buttons=()=>[...td.querySelectorAll<HTMLButtonElement>('#pt-metsel button')];
 for(const [label,k] of [['Показы в поиске','vsearch'],['Показы всего','views'],['Карточка','pdp'],['Корзина','cart'],['Заказано (OZON)','units']] as const){
  buttons().find(b=>b.textContent===label)!.click();
  const point=td.querySelector('#pt-dynchart [data-partial-day]');
  assert.equal(number(point?.getAttribute('data-value')??null),pd.partial.cards[0][k],'Plan marker '+k);
  assert(td.querySelector('#pt-dynchart')!.textContent!.includes(selected.day.slice(8)+'.'+selected.day.slice(5,7)),'Last date on plan axis');
 }
 buttons().find(b=>b.textContent==='Расход на клики, ₽')!.click();
 assert.equal(td.querySelector('#pt-dynchart [data-partial-day]'),null,'No invented ad point');
}
tests.window.close();assert.deepEqual(errors,[]);
console.log(JSON.stringify({ok:true,closed:closed?.day,selected:selected.day,stamp,checkedTestProducts:checked,missingTestProducts:missing,metrics:5}));
