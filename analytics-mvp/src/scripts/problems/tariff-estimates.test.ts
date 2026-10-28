import {describe,it,expect} from 'vitest';
import {JSDOM} from 'jsdom';
import {estimateTariffs,validateProblems,type FbsTariffRow,type FbsTariff,type FbsEstimateCohort,type ProblemData} from './model.js';
import {problemsPage} from './page.js';
const created='2026-10-18T09:00:00Z';
const row=(hours:number,x:Partial<FbsTariffRow>={}):FbsTariffRow=>({order:'37549854-0567-1',status:'delivering',offer:'GGM-01-1',qty:2,amount_cents:4390000,created,cutoff:null,log_cutoff:null,fact_transferred:new Date(Date.parse(created)+hours*3600000).toISOString(),delivering_date:null,step1_deadline:null,step2_deadline:null,step3_deadline:null,step4_deadline:null,fact_type:null,rate_bps:null,effect_cents:null,fact_observed:null,current_type:null,current_rate_bps:null,observed:'2026-10-28',...x});
const source=(rows:FbsTariffRow[]):FbsTariff=>({version:1,source_date:'2026-10-28',sources:[],rows});
const cohort=(ids=['37549854-0567-1']):FbsEstimateCohort=>({version:1,source_date:'2026-10-28',approved_at:'2026-10-28',source_sha256:'fixture',basis:'user mapping',daily:ids,other:[]});
const calc=(rs:FbsTariffRow[],c=cohort(),from='2026-10-01',to='2026-10-28')=>estimateTariffs(source(rs),c,from,to);
describe('FBS estimates: facts remain authoritative',()=>{
 it.each([[0,-300],[12,-300],[12.001,-200],[24,-200],[24.001,0],[36,0],[36.001,100],[48,100],[48.001,200]])('hour boundary %s gives %s bps',(hours,bps)=>{const s=calc([row(hours)]);expect(s.rows[0]!.bps).toBe(bps);expect(s.net).toBe(Math.round(4390000*Math.abs(bps)/10000)*Math.sign(bps)/100);});
 it('real exception: 26.995h is confirmed discount, not clock zero',()=>{const s=calc([row(26.995,{fact_type:'discount',rate_bps:200,effect_cents:-87800,fact_observed:'2026-10-28',status:'delivered'})]);expect(s.net).toBe(-878);expect(s.clock).toBe(0);expect(s.mismatches).toHaveLength(1);expect(s.confirmed).toHaveLength(1);expect(s.estimated).toHaveLength(0);expect(s.best).toBe(1317);expect(s.gap).toBe(439);});
 it('second real exception and cents preserved, never multiply quantity',()=>{const s=calc([row(24.397,{amount_cents:5831100,fact_type:'discount',rate_bps:200,effect_cents:-116622,fact_observed:'2026-10-28'})]);expect(s.net).toBe(-1166.22);expect(s.best).toBe(1749.33);});
 it('retained fact uses original amount consistently',()=>{const s=calc([row(8,{amount_cents:10000000,fact_amount_cents:4390000,fact_type:'discount',rate_bps:200,effect_cents:-87800,fact_observed:'2026-10-27'})]);expect(s.net).toBe(-878);expect(s.best).toBe(1317);});
 it('excludes cancelled, returns, missing, negative and future transfers',()=>{for(const override of [{status:'cancelled'},{status:'returned'},{fact_transferred:null},{fact_transferred:'2026-10-17T00:00:00Z'},{fact_transferred:'2026-10-29T00:00:00Z'}])expect(calc([row(10,override)]).net).toBeNull();});
 it('never infers eligibility for a new order; bulky kept separately',()=>{const c=cohort([]);c.other=['37549854-0567-1'];const s=calc([row(8),row(8,{order:'16254522-0193-2'})],c);expect(s.other).toHaveLength(1);expect(s.unclassified).toHaveLength(1);expect(s.rows).toHaveLength(0);expect(s.best).toBeNull();});
 it('missing source and missing cohort stay unavailable',()=>{expect(estimateTariffs(null,null,'2026-10-01','2026-10-28').net).toBeNull();expect(estimateTariffs(source([row(8)]),null,'2026-10-01','2026-10-28').net).toBeNull();});
 it('closed month, partial month and current month filter creation in Moscow',()=>{const r=row(8,{created:'2026-10-17T21:30:00Z',fact_transferred:'2026-10-18T05:30:00Z'});expect(calc([r],cohort(),'2026-09-01','2026-09-30').rows).toHaveLength(0);expect(calc([r],cohort(),'2026-10-01','2026-10-17').rows).toHaveLength(0);expect(calc([r],cohort(),'2026-10-18','2026-10-18').rows).toHaveLength(1);});
 it('page exposes estimate separately and updates all outputs with period',()=>{
  const rows=[row(27,{fact_type:'discount',rate_bps:200,effect_cents:-87800,fact_observed:'2026-10-28'}),row(50,{order:'16254522-0193-2'})];
  const d:ProblemData={now:'2026-10-28T09:00:00Z',postings:[],events:[],ratings:[],summary:[],thresholds:null,coverage:{postings:{days:[],loaded_at:null,note:''}},warnings:[],fbsTariff:source(rows),fbsEstimateCohort:cohort(rows.map(x=>x.order))};
  const dom=new JSDOM(problemsPage(d),{runScripts:'dangerously'}),doc=dom.window.document;
  const set=(from:string,to:string)=>{(doc.querySelector('#range-from') as unknown as {value:string}).value=from;(doc.querySelector('#range-to') as unknown as {value:string}).value=to;(doc.querySelector('#range-apply') as unknown as {click:()=>void}).click();};
  set('2026-10-01','2026-10-28');expect(doc.querySelector('#tariff-estimate-summary')).toBeNull();expect(doc.body.textContent).not.toContain('Отгруженные · факт + оценка');expect(doc.querySelector('#tariff-summary')!.textContent).toContain('Подтверждение');dom.window.close();
  const invalid={...d,fbsEstimateCohort:{...d.fbsEstimateCohort!,other:[rows[0]!.order]}};expect(()=>validateProblems(invalid)).toThrow('Invalid FBS estimate cohort');
 });
});
