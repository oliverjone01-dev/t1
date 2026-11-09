// Execute generated pages, change filters, and reconcile displayed cells to input.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {JSDOM,VirtualConsole} from 'jsdom';
import {supplements,catalogGaps} from '../../src/scripts/ozon/cabinet-supplements.js';
import {readGapMarked} from '../../src/scripts/gap-daily.js';
const [dir,out]=process.argv.slice(2);assert(dir&&out);
const data=supplements(dir),errors:string[]=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const page=(file:string)=>new JSDOM(readFileSync(join(out,file),'utf8'),{runScripts:'dangerously',url:'https://example.test/'+file,virtualConsole:vc});
if(data.catalogs.length){
 const latest=[...data.catalogs].sort((a,b)=>Date.parse(a.captured_at)-Date.parse(b.captured_at)).at(-1)!;
 const dom=page('katya-data.html'),d=dom.window.document;
 assert.equal(d.querySelectorAll('#products tr').length,latest.items.length);
 const filter=d.querySelector<HTMLInputElement>('#filter')!;
 const selected=latest.items.find(r=>r.sku==='5426756030')??latest.items[0]!;
 filter.value=selected.sku!;filter.dispatchEvent(new dom.window.Event('input'));
 assert.equal(d.querySelectorAll('#products tr').length,1);
 const td=[...d.querySelectorAll('#products td')];
 const number=(s:string)=>Number(s.replace(/[^\d,.-]/g,'').replace(',','.'));
 assert.equal(number(td[1]!.textContent!),selected.buyer);
 assert.equal(number(td[2]!.textContent!),selected.cap);
 // Every modern date/product must survive the shared reader used by existing tests/plan.
 const shared=new Map(readGapMarked(join(dir,'gap_daily.ndjson')).rows.map(r=>[r.date+'|'+r.art,r]));
 for(const r of catalogGaps(data.catalogs))assert.equal(shared.get(r.date+'|'+r.art)?.gap_pct,r.gap_pct);
 dom.window.close();
}
if(data.competitors){
 const dom=page('katya-competitors-cabinet.html'),d=dom.window.document;
 for(const window of [7,28]){
  const s=d.querySelector<HTMLSelectElement>('#window')!;s.value=String(window);s.dispatchEvent(new dom.window.Event('change'));
  const source=data.competitors.exports.filter((r:any)=>r.days===window),seen=new Set(source.flatMap((e:any)=>e.rows.map((r:any)=>r[0])));
  const covered=data.competitors.watch.filter((r:any)=>seen.has(r.sku)).length;
  assert(d.querySelector('#coverage')!.textContent!.includes(`Найдено ${covered} из ${data.competitors.watch.length}`));
  assert.equal(d.querySelectorAll('#rows tr').length,Math.min(100,data.competitors.watch.length));
 }
 dom.window.close();
}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({catalogObservations:data.catalogs.length,catalogRows:data.catalogs.reduce((s,r)=>s+r.items.length,0),competitorExports:data.competitors?.exports.length??0,renderedValuesVerified:true}));
