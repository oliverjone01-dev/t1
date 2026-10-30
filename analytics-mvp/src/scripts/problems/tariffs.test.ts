import {describe,it,expect} from 'vitest';
import {JSDOM} from 'jsdom';
import {summarizeTariffs,validateTariffs,type FbsTariff,type FbsTariffRow,type ProblemData} from './model.js';
import {problemsPage} from './page.js';
const row=(x:Partial<FbsTariffRow>={}):FbsTariffRow=>({order:'12345678-0001-1',status:'delivered',offer:'GGT-A',qty:2,amount_cents:14180000,created:'2026-10-27T21:30:00Z',cutoff:null,log_cutoff:null,fact_transferred:null,delivering_date:null,step1_deadline:null,step2_deadline:null,step3_deadline:null,step4_deadline:null,fact_type:'discount',rate_bps:300,effect_cents:-425400,fact_observed:'2026-10-28',current_type:null,current_rate_bps:null,observed:'2026-10-28',...x});
const bundle=(rows:FbsTariffRow[]):FbsTariff=>({version:1,source_date:'2026-10-28',sources:[],rows});
describe('Cabinet FBS tariffs',()=>{
 it('counts postings once and selects creation cohort in Moscow',()=>{const d=bundle([row()]);expect(summarizeTariffs(d,'2026-10-27','2026-10-27').rows).toHaveLength(0);const s=summarizeTariffs(d,'2026-10-28','2026-10-28');expect(s.confirmed).toHaveLength(1);expect(s.discount).toBe(4254);expect(s.net).toBe(-4254);});
 it('missing facts stay unknown; cancelled and in-transit are separate',()=>{const d=bundle([row({fact_type:null,rate_bps:null,effect_cents:null,status:'cancelled'}),row({order:'12345678-0002-1',fact_type:null,rate_bps:null,effect_cents:null,status:'delivering'})]);const s=summarizeTariffs(d,'2026-10-01','2026-10-28');expect(s.net).toBeNull();expect(s.unknownStatuses).toEqual({cancelled:1,delivering:1});});
 it('confirmed no-discount is known zero, not missing',()=>{const d=bundle([row({fact_type:'no_discount',rate_bps:0,effect_cents:0})]);expect(summarizeTariffs(d,'2026-10-01','2026-10-28').net).toBe(0);});
 it('current rate never becomes a confirmed saving; latest-only queue ignores period',()=>{const d=bundle([row({status:'awaiting_deliver',fact_type:null,rate_bps:null,effect_cents:null,current_type:'discount',current_rate_bps:300}),row({order:'12345678-0002-1',status:'awaiting_deliver',observed:'2026-10-27'})]);const s=summarizeTariffs(d,'2026-09-01','2026-09-30');expect(s.confirmed).toHaveLength(0);expect(s.queue).toHaveLength(1);expect(s.queue[0]!.current_rate_bps).toBe(300);});
 it('facts retained from earlier observation validate against original money basis',()=>{expect(()=>validateTariffs(bundle([row({amount_cents:20000000,fact_amount_cents:14180000})]))).not.toThrow();});
 it('duplicates, guessed effects, unit-multiplied money and invalid rates fail',()=>{for(const rows of [[row(),row()],[row({effect_cents:-850800})],[row({fact_type:null,rate_bps:null})],[row({rate_bps:3000})],[row({fact_type:'no_discount'})]])expect(()=>validateTariffs(bundle(rows))).toThrow();});
 it('outdated queue is a collapsed dated archive, not current operational status',()=>{
  const data:ProblemData={now:'2026-10-30T09:00:00Z',postings:[],events:[],ratings:[],summary:[],thresholds:null,coverage:{},warnings:[],fbsTariff:bundle([row({status:'awaiting_deliver',fact_type:null,rate_bps:null,effect_cents:null})])};
  const dom=new JSDOM(problemsPage(data),{runScripts:'dangerously'}),doc=dom.window.document;
  expect(doc.querySelector('#tariff-queue-title')?.textContent).toContain('Архив');
  expect(doc.querySelector('#tariff-queue-note')?.textContent).toContain('28.10.2026');
  expect(doc.querySelector('#tariff-queue-note')?.textContent).toContain('текущие статусы и ставки не подтверждены');
  expect((doc.querySelector('#tariff-queue-details') as HTMLDetailsElement).open).toBe(false);
  expect(doc.querySelector('#tariff-queue')?.textContent).toContain('12345678-0001-1');
  dom.window.close();
 });
 it('page exposes tariffs separately from fines, queue and delivery freshness',()=>{
  const d:ProblemData={now:'2026-10-28T09:00:00Z',postings:[],events:[],ratings:[],summary:[],thresholds:null,coverage:{postings:{days:[],loaded_at:null,note:''}},warnings:[],fbsTariff:bundle([row(),row({order:'12345678-0003-1',status:'awaiting_deliver',fact_type:null,rate_bps:null,effect_cents:null,current_type:'discount',current_rate_bps:200,step1_deadline:'2026-10-28T02:44:00Z',step2_deadline:'2026-10-28T14:44:00Z',step3_deadline:'2026-10-29T02:44:00Z',step4_deadline:'2026-10-29T14:44:00Z'})]),deliverySource:{through:'2026-10-27',loaded_at:'2026-10-28T09:00:00Z',corrected_prices:14}};
  const dom=new JSDOM(problemsPage(d),{runScripts:'dangerously'});const doc=dom.window.document;
  (doc.querySelector('#range-from') as unknown as {value:string}).value='2026-10-01';(doc.querySelector('#range-to') as unknown as {value:string}).value='2026-10-28';(doc.querySelector('#range-apply') as unknown as {click:()=>void}).click();
  expect(doc.querySelector('#tariff-summary')?.textContent).toContain('4 254');expect(doc.querySelector('#tariff-summary')?.textContent).toContain('1 / 2');expect(doc.querySelector('#tariff-queue')?.textContent).toContain('05:44');expect(doc.querySelector('#tariff-queue')?.textContent).toContain('−2 п.п.');expect(doc.querySelector('#delivery-source')?.textContent).toContain('2026-10-27');expect(doc.querySelector('#kpis')?.textContent).not.toContain('4 254');dom.window.close();
 });
});
