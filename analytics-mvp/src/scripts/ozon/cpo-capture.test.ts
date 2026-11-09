import {it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {validateCpo,cpoSkuRows} from './cpo-capture.js';
import {cpoOrdersByDay} from '../cpo-orders-rev.js';
const sample=()=>({version:1,from:'2026-11-01',to:'2026-11-02',captured_at:'2026-11-03T08:00:00+03:00',source:'ozon-cpo-order-export',orders_sha256:'a'.repeat(64),source_sha256:['b'.repeat(64)],sku:[{d:'2026-11-02',sku:'12',offer:'A',sp:100,n:1}],report_days:[{d:'2026-11-01',sp:0,n:0},{d:'2026-11-02',sp:100,n:1}],order_days:[{d:'2026-10-31',sp:100,rev:1500,units:1}],miss:[],no_sku_sp:0,settings:{captured_at:'2026-11-03T08:00:00+03:00',scope:'all',active:true,bid_percent:6,promoted_products:456,products_period_from:'2026-11-01',products_period_to:'2026-11-03'}});
it('preserves explicit zero days and separates order day from expense day',()=>{expect(validateCpo(sample()).order_days[0]!.d).toBe('2026-10-31');});
it('uses Moscow day at the UTC evening boundary',()=>{const c=sample();c.captured_at='2026-11-02T21:30:00Z';expect(validateCpo(c).to).toBe('2026-11-02');c.captured_at='2026-11-02T20:30:00Z';expect(()=>validateCpo(c)).toThrow();});
it('rejects a missing day, broken sum, duplicate key and private order identifiers',()=>{
 for(const change of [(c:any)=>c.report_days.shift(),(c:any)=>c.sku[0].sp=99,(c:any)=>c.sku.push({...c.sku[0]}),(c:any)=>c.sku[0].order='private']){const c=sample();change(c);expect(()=>validateCpo(c)).toThrow();}
});
it('rejects a one-kopeck loss or gain, including a balanced cross-day move',()=>{for(const delta of [-.01,.01]){const c=sample();c.sku[0]!.sp+=delta;expect(()=>validateCpo(c)).toThrow(/conservation/);}const c=sample();c.report_days[0]!.sp=.01;c.report_days[1]!.sp=99.99;expect(()=>validateCpo(c)).toThrow(/daily SKU/);});
it('rejects open source day, NaN, non-money value and invalid settings',()=>{
 for(const change of [(c:any)=>c.to='2026-11-03',(c:any)=>c.sku[0].sp=NaN,(c:any)=>c.sku[0].sp=100.001,(c:any)=>c.settings.scope='selected']){const c=sample();change(c);expect(()=>validateCpo(c)).toThrow();}
});
it('replaces SKU window idempotently, combines legacy aggregate and preserves shifted order date',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cpo-')),dp=(f:string)=>join(dir,f),nd=(f:string,r:any[])=>writeFileSync(dp(f),r.map(x=>JSON.stringify(x)).join('\n'));
 try{writeFileSync(dp('cabinet_capture.json'),JSON.stringify({cpo:sample()}));nd('cpo_sku_daily.ndjson',[{d:'2026-10-01',sp:20},{d:'2026-11-02',sp:999}]);nd('cpo_orders.ndjson',[{d:'2026-10-01',order:'a-b',sp:20}]);nd('orders_daily.ndjson',[{d:'2026-10-01',order:'a-b-1',status:'delivered',revenue:500,units:1}]);
 const input=[{d:'2026-10-01',sp:20},{d:'2026-11-02',sp:999}];const merged=cpoSkuRows(dp,input);expect(cpoSkuRows(dp,merged)).toEqual(merged);
 const co=cpoOrdersByDay(dp);expect(co.spAll).toBe(120);expect(co.skuSp).toBe(120);expect(co.to).toBe('2026-11-02');expect(co.day['2026-10-31']).toEqual({sp:100,rev:1500,units:1});expect(co.day['2026-11-02']).toBeUndefined();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
