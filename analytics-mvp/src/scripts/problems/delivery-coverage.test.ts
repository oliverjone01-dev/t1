import {describe,it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadProblemData} from './data.js';
import {summarize} from './model.js';
import {problemsPage} from './page.js';
import {JSDOM} from 'jsdom';
function fixture(extra:any={}){
 const root=mkdtempSync(join(tmpdir(),'problems-delivery-'));
 writeFileSync(join(root,'delivery_orders.ndjson'),[{order:'12345678-0001-1',d_ship:'2026-10-04',ship:200,deliv:100},{order:'12345678-0002-1',d_ship:'2026-10-08',ship:300,deliv:100}].map(x=>JSON.stringify(x)).join('\n'));
 writeFileSync(join(root,'delivery_sheet_state.json'),JSON.stringify({events:[],missing_keys:[['missing','2026-10-09']],unseen_keys:[]}));
 writeFileSync(join(root,'delivery_sheet_status.json'),JSON.stringify({from:'2026-10-05',through:'2026-10-10',loaded_at:'2026-10-11T06:00:00Z',missing_cost:1,undated_rows:0,missing_customer_paid:0,retained_unseen_events:0,...extra}));
 try{return loadProblemData(root,'2026-10-11T09:00:00Z');}finally{rmSync(root,{recursive:true});}
}
describe('Delivery source completeness on Problems',()=>{
 it('missing-cost row absent from ledger cannot certify a zero-loss day',()=>{const d=fixture();expect(d.coverage.deliveryLoss!.days).not.toContain('2026-10-09');const s=summarize(d,'2026-10-09','2026-10-09');expect(s.metrics.deliveryLoss!.coverage.full).toBe(false);expect(s.metrics.deliveryLoss!.sum).toBeNull();expect(d.warnings.join(' ')).toContain('1 без стоимости');});
 it('undated rows make affected source window partial but preserve closed baseline',()=>{const d=fixture({undated_rows:2});expect(summarize(d,'2026-10-08','2026-10-08').metrics.deliveryLoss!.coverage.full).toBe(false);expect(summarize(d,'2026-10-08','2026-10-08').metrics.deliveryLoss!.sum).toBe(200);expect(summarize(d,'2026-10-04','2026-10-04').metrics.deliveryLoss!.coverage.full).toBe(true);});
 it('missing keys in status/state do not silently turn into full coverage',()=>{const d=fixture({missing_cost:2,retained_unseen_events:1});expect(summarize(d,'2026-10-08','2026-10-08').metrics.deliveryLoss!.coverage.full).toBe(false);});
 it('source defects are visible beside freshness without opening source details',()=>{const d=fixture({undated_rows:2,missing_customer_paid:1});const dom=new JSDOM(problemsPage(d),{runScripts:'dangerously'});const text=dom.window.document.querySelector('#delivery-source')?.textContent;expect(text).toContain('НЕПОЛНО');expect(text).toContain('1 без стоимости');expect(text).toContain('2 без даты');expect(text).toContain('1 без оплаты покупателя');dom.window.close();});
});
