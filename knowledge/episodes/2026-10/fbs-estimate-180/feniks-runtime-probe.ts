import fs from 'node:fs';
import assert from 'node:assert/strict';
import {estimateTariffs,summarizeTariffs,summarize,validateProblems} from '../../../../analytics-mvp/src/scripts/problems/model.ts';
import {loadProblemData} from '../../../../analytics-mvp/src/scripts/problems/data.ts';
import {problemsPage} from '../../../../analytics-mvp/src/scripts/problems/page.ts';
import {JSDOM} from '../../../../analytics-mvp/node_modules/jsdom/lib/api.js';
const root=process.cwd();process.chdir(root+'/analytics-mvp');
const d=loadProblemData('data','2026-10-28T12:00:00Z');
const expected=JSON.parse(fs.readFileSync(root+'/knowledge/episodes/2026-10/fbs-estimate-180/feniks-raw-results.json','utf8'));
const sourceBefore=JSON.stringify(d.fbsTariff);
for(const [period,v] of Object.entries(expected) as any){
 const [from,to]=period.split('/'),a=estimateTariffs(d.fbsTariff,d.fbsEstimateCohort,from,to);
 for(const k of ['net','best','gap','clock','actualNet','waiting'])assert.equal(a[k],v[k],period+' '+k);
 for(const [field,key] of [['selected','selected'],['rows','included'],['confirmed','confirmed'],['estimated','estimated'],['excluded','excluded']])assert.equal(a[field].length,v[key],period+' '+field);
 assert.deepEqual(a.mismatches.map(x=>x.row.order).sort(),v.mismatches.map(x=>x.order).sort());
 assert.equal(a.groups.reduce((s,x)=>s+x.count,0),a.rows.length);
 assert.equal(Math.round(a.groups.reduce((s,x)=>s+x.effect,0)*100),Math.round((a.net??0)*100));
 const dom=new JSDOM(problemsPage(d),{runScripts:'dangerously'}),doc=dom.window.document;
 doc.querySelector('#from').value=from;doc.querySelector('#to').value=to;doc.querySelector('#apply').click();
 assert.equal(doc.querySelector('#error').textContent,'');
 const summary=doc.querySelector('#tariff-estimate-summary').textContent;
 const f=(n:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2,minimumFractionDigits:2}).format(n);
 assert.ok(summary.includes(a.net===null?'н/д':f(Math.abs(a.net))),summary);
 assert.ok(summary.includes('Оценка не является начислением'));assert.ok(summary.includes('Потенциал, не фактический убыток'));
 assert.ok(doc.querySelector('#tariff-estimate-note').textContent.includes('гипотеза'));
 assert.equal(doc.querySelectorAll('#tariff-estimate-orders tbody tr').length,a.rows.length);
 console.log('RAW→MODEL→DOM PASS',period,JSON.stringify({n:a.rows.length,net:a.net,best:a.best,gap:a.gap}));dom.window.close();
}
assert.equal(JSON.stringify(d.fbsTariff),sourceBefore);
const full=estimateTariffs(d.fbsTariff,d.fbsEstimateCohort,'2026-10-01','2026-10-28');
assert.equal(full.confirmed.length,summarizeTariffs(d.fbsTariff,'2026-10-01','2026-10-28').confirmed.length);
assert.equal(full.actualNet,summarizeTariffs(d.fbsTariff,'2026-10-01','2026-10-28').net);
assert.deepEqual(summarize(d,'2026-10-01','2026-10-28'),summarize({...d,fbsEstimateCohort:null},'2026-10-01','2026-10-28'));
const r={...full.estimated[0].row,created:'2026-10-20T09:00:00Z',fact_type:null,rate_bps:null,effect_cents:null};
const one=(override={})=>({...d.fbsTariff,rows:[{...r,...override}]});
const calc=(s:any)=>estimateTariffs(s,d.fbsEstimateCohort,'2026-10-01','2026-10-28');
for(const [hours,bps] of [[0,-300],[12,-300],[12+1/3600,-200],[24,-200],[24+1/3600,0],[36,0],[36+1/3600,100],[48,100],[48+1/3600,200]]){
 const a=calc(one({fact_transferred:new Date(Date.parse(r.created)+hours*3600000).toISOString()}));assert.equal(a.rows[0].bps,bps);
}
for(const override of [{status:'cancelled'},{status:'returned'},{fact_transferred:null},{fact_transferred:'2026-10-19T09:00:00Z'},{fact_transferred:'2026-10-28T21:00:00Z'}])assert.equal(calc(one(override)).net,null);
assert.equal(calc(one({order:'99999999-9999-1'})).unclassified.length,1);assert.equal(calc(one({order:'99999999-9999-1'})).net,null);
assert.throws(()=>validateProblems({...d,fbsTariff:{...d.fbsTariff,rows:[r,r]}}),/Duplicate tariff/);
assert.throws(()=>validateProblems({...d,fbsEstimateCohort:{...d.fbsEstimateCohort,other:[r.order]}}),/Invalid FBS estimate cohort/);
assert.equal(calc({...one(),source_date:'2026-10-18'}).net,null);
const futureFact={...r,status:'delivered',fact_transferred:'2026-10-21T12:00:00Z',fact_type:'discount',rate_bps:300,effect_cents:-Math.round(r.amount_cents*.03),fact_observed:'2026-10-29'};
const future=estimateTariffs({...d.fbsTariff,source_date:'2026-10-29',rows:[futureFact]},d.fbsEstimateCohort,'2026-10-01','2026-10-31');assert.equal(future.confirmed.length,1);assert.equal(future.estimated.length,0);
const csvCode=fs.readFileSync('src/scripts/problems/client.js','utf8').split("$('csv').onclick=")[1].split('\n')[0];assert.ok(csvCode.includes('filtered().map'));assert.ok(!csvCode.includes('estimate'));
console.log('PASS facts immutable; no financial double count; 9 boundaries; cancellations/returns; invalid/future dates; new ID; duplicate; stale source; later fact override; CSV scope');
