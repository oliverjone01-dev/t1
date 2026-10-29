import {describe,it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateCaptureFile,cabinetCaptureHtml,latestCapture} from './cabinet-capture.js';

function fixture(){return {version:1,company:'GENGLASS',snapshots:[{version:1,company:'GENGLASS',day:'2026-10-29',captured_at:'2026-10-29T09:18:00+00:00',phase:'once',day_in_progress:true,
 scope:{expected:2,received:1,matched:1,missing:1,extra:0,status:'partial'},totals:{views:12,search_views:7,pdp_views:3,cart:1,ordered_units:0},
 items:[{sku:'123',scheme:null,search_position:0,views:12,search_views:7,pdp_views:3,cart:1,ordered_units:0}],source:'ozon-native-daily-product-report',not_refreshed:['card_price']}]};}
describe('native cabinet snapshot',()=>{
 it('keeps partial scope and explicit zero values',()=>{const r=validateCaptureFile(fixture());expect(r.snapshots[0]!.scope.missing).toBe(1);expect(r.snapshots[0]!.items[0]!.ordered_units).toBe(0);});
 it('rejects hidden private fields',()=>{const r:any=fixture();r.snapshots[0].items[0].price=123;expect(()=>validateCaptureFile(r)).toThrow('unexpected fields');});
 it('rejects a false complete flag',()=>{const r=fixture();r.snapshots[0]!.scope.status='complete';expect(()=>validateCaptureFile(r)).toThrow('scope');});
 it('rejects duplicate source rows',()=>{const r=fixture();r.snapshots[0]!.items.push({...r.snapshots[0]!.items[0]!});expect(()=>validateCaptureFile(r)).toThrow('item key');});
 it('rejects a contradictory sum and nonfinite values',()=>{const r=fixture();r.snapshots[0]!.totals.views=13;expect(()=>validateCaptureFile(r)).toThrow('totals');r.snapshots[0]!.totals.views=12;r.snapshots[0]!.items[0]!.views=Infinity;expect(()=>validateCaptureFile(r)).toThrow('metric');});
 it('selects source day before observation time',()=>{const r=fixture();const later=structuredClone(r.snapshots[0]!);later.day='2026-10-30';later.captured_at='2026-10-30T06:56:00+00:00';r.snapshots.unshift(later);expect(latestCapture(validateCaptureFile(r))!.day).toBe('2026-10-30');});
 it('renders data date, Moscow capture time, partial day, scope and zeros',()=>{const dir=mkdtempSync(join(tmpdir(),'cabinet-render-'));try{writeFileSync(join(dir,'cabinet_capture.json'),JSON.stringify(fixture()));const html=cabinetCaptureHtml(dir);expect(html).toContain('2026-10-29');expect(html).toContain('12:18');expect(html).toContain('День не завершён');expect(html).toContain('1 из 2');expect(html).toContain('<td>0</td>');expect(html).not.toContain('price=');}finally{rmSync(dir,{recursive:true,force:true});}});
 it('is absent when no cabinet source has been received',()=>{const dir=mkdtempSync(join(tmpdir(),'cabinet-absent-'));try{expect(cabinetCaptureHtml(dir)).toBe('');}finally{rmSync(dir,{recursive:true,force:true});}});
});
