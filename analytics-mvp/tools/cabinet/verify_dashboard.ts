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
const open=days.filter(captureIsOpen).at(-1),closed=days.filter(r=>!captureIsOpen(r)).at(-1);
assert(open&&closed,'Release probe requires a closed and an open observation');
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
metrics.forEach((k,i)=>assert.equal(number(bars[i]!.textContent),open.totals[k],`Open funnel ${k}`));
assert.match(bars[5]!.textContent??'',/нет данных/);
const total=doc.querySelector('.cf-total');assert(total,'Missing category total');
const cells=[...total.querySelectorAll('td')];
metrics.forEach((k,i)=>assert.equal(number(cells[[1,3,5,7,9][i]!]!.textContent),open.totals[k],`Category total ${k}`));
assert.match(cells.at(-1)!.textContent??'',/нет данных/);
const cards=[...doc.querySelectorAll('#kpis .card')];
for(const i of [0,4,5])assert.match(cards[i]!.textContent??'',/нет данных/,'Unknown financial/outcome KPI');
assert(![...doc.querySelectorAll('#kpis .kt-d,#kpis .kt-cap')].some(n=>n.textContent?.trim()),'Partial day must not show a full-day delta');
const stamp=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(new Date(open.captured_at));
assert(doc.querySelector('#fsub')!.textContent!.includes(stamp),'Moscow observation time');
assert.equal(doc.querySelectorAll('.cabinet-history,.cabinet-capture').length,0,'No isolated report dump');
click('today');
assert.match(doc.querySelector('#fsub')!.textContent??'',new RegExp(closed.day));
metrics.forEach((k,i)=>assert.equal(number(doc.querySelectorAll('.vf-bar')[i]!.textContent),closed.totals[k],`Closed funnel ${k}`));
for(const p of ['7d','30d','90d','year','all','cabinet','today'])click(p);
assert.equal(dom.window.localStorage.getItem('gg_katya_period'),JSON.stringify({p:'today'}));
dom.window.close();

const tests=page('katya-tests.html'),td=tests.window.document;
const definitions=JSON.parse(readFileSync('tools/tests/tests.json','utf8')).тесты;
const skuToArt=JSON.parse(readFileSync(join(data,'sku_offer.json'),'utf8'));
const byArt=new Map(open.items.filter(r=>skuToArt[r.sku]).map(r=>[skuToArt[r.sku],r]));
let checked=0,missing=0;
for(const def of definitions){
  const card=[...td.querySelectorAll('.tcard')].find(c=>c.querySelector('.ctitle')?.textContent?.includes(def.название));
  assert(card,`Missing experiment card ${def.id}`);
  const detail=[...card.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent?.includes('Незакрытый срез'));
  assert(detail,`Missing open observation in ${def.id}`);
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
tests.window.close();assert.deepEqual(errors,[]);
console.log(JSON.stringify({ok:true,closed:closed.day,open:open.day,stamp,checkedTestProducts:checked,missingTestProducts:missing,metrics:5}));
