import {describe,it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {numericFields,textFields,competitorHeaders,validateSupplements,catalogGaps,supplements} from './cabinet-supplements.js';
import {readGapDaily,readGapMarked} from '../gap-daily.js';
import {sourceHealth} from './source-health.js';
const fixture=()=>({catalogs:[{day:'2026-11-09',captured_at:'2026-11-09T09:00:00Z',phase:'once',source:'ozon-catalog-xlsx',source_sha256:'a'.repeat(64),expected:1,items:[{...Object.fromEntries(numericFields.map(k=>[k,1])),...Object.fromEntries(textFields.map(k=>[k,null])),sku:'123',art:'KONUX',cap:100,buyer:50,gap_pct:50}]}]});
const competitors=()=>({captured_at:'2026-11-09T09:00:00Z',source_updated_at:'2026-11-08T20:00:00Z',exports:['genglass-all','tables','mirrors'].flatMap(kind=>[7,28].map(days=>({kind,days,sha256:'b'.repeat(64),headers:[...competitorHeaders],rows:[['123',...competitorHeaders.slice(1).map(()=>null)]]}))),watch:[{sku:'123',role:'own',model:'test',seller:'test',pair_own:''}]});
function withDir(f:(d:string)=>void){const d=mkdtempSync(join(tmpdir(),'supplement-'));try{f(d)}finally{rmSync(d,{recursive:true,force:true})}}
describe('catalog and competitor completeness',()=>{
 it('keeps realization available without inventing ordinary storefront history',()=>withDir(d=>{writeFileSync(join(d,'cabinet_capture.json'),JSON.stringify(fixture()));expect(catalogGaps(supplements(d).catalogs)[0]?.gap_pct).toBe(50);expect(readGapMarked(join(d,'gap_daily.ndjson')).rows).toHaveLength(0);expect(readGapDaily(join(d,'gap_daily.ndjson')).rows).toHaveLength(0)}));
 it('never overwrites same-day ordinary price basis with realization',()=>withDir(d=>{
  writeFileSync(join(d,'cabinet_capture.json'),JSON.stringify({version:1,company:'GENGLASS',snapshots:[],...fixture()}));
  writeFileSync(join(d,'gap_daily.ndjson'),JSON.stringify({date:'2026-11-09',art:'KONUX',gap_pct:20,site_to_seller:.8,src:'prices_raw',oa_used:false}));
  expect(readGapMarked(join(d,'gap_daily.ndjson')).rows[0]?.gap_pct).toBe(20);
  expect(readGapDaily(join(d,'gap_daily.ndjson')).rows[0]?.gap_pct).toBe(20);
  const health=sourceHealth(d,new Date('2026-11-10T09:00:00Z')).find(r=>r.source==='Обычная цена без карты: история для тестов');
  expect(health?.through).toBe('2026-11-09');expect(health?.status).toBe('warning');
  const r=catalogGaps(supplements(d).catalogs)[0];expect(r.gap_pct).toBe(50);expect(r.price_basis).toBe('realization');expect(r.oa_used).toBeUndefined();
 }));
 it('rejects different competitor column orders and missing labels in every file',()=>{const c=competitors();validateSupplements({competitors:c});[c.exports[2]!.headers[1],c.exports[2]!.headers[2]]=[c.exports[2]!.headers[2]!,c.exports[2]!.headers[1]!];expect(()=>validateSupplements({competitors:c})).toThrow('columns');for(const e of c.exports)e.headers.pop();expect(()=>validateSupplements({competitors:c})).toThrow('columns')});
 it('never labels missing logistics or acquiring as complete tariffs',()=>withDir(d=>{const f:any=fixture();for(const k of ['logistics_fbo_min','logistics_fbo_max','logistics_fbs_min','logistics_fbs_max','acquiring'])f.catalogs[0].items[0][k]=null;writeFileSync(join(d,'cabinet_capture.json'),JSON.stringify({version:1,company:'GENGLASS',snapshots:[],...f}));const h=sourceHealth(d,new Date('2026-11-09T10:00:00Z'));expect(h.find(r=>r.source==='Комиссии каталога')?.status).toBe('ok');expect(h.find(r=>r.source==='Расчётная логистика каталога')?.status).toBe('error');expect(h.find(r=>r.source==='Эквайринг каталога')?.status).toBe('error')}));
});
