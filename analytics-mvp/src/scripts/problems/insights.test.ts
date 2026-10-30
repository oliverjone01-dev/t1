import {describe,it,expect} from 'vitest';
import {JSDOM,VirtualConsole} from 'jsdom';
import {problemInsights,qualitySnapshot} from './insights.js';
import {problemsPage} from './page.js';
import type {ProblemData} from './model.js';
const fixture=():ProblemData=>({now:'2026-10-30T12:00:00Z',periodBounds:{from:'2026-10-01',to:'2026-10-30'},postings:[],events:[
 {id:'late-1',kind:'lateShip',date:'2026-10-21',order:'o',offer:'A',scheme:'FBS',reason:'Delay',amount:null,source:'test'},
 {id:'late-2',kind:'lateShip',date:'2026-10-21',order:'p',offer:'A',scheme:'FBS',reason:'Delay',amount:null,source:'test'},
 {id:'defect-1',kind:'defectCharge',date:'2026-10-21',order:'o',offer:'A',scheme:'FBS',reason:'Delay',amount:10,source:'test'}
 ],ratings:[{date:'2026-10-20',defect_index:.06,charge_rub:0},{date:'2026-10-21',defect_index:.09,charge_rub:10},{date:'2026-10-22',defect_index:null,charge_rub:null}],summary:[],thresholds:{date:'2026-10-27',rows:[{begin:10,end:100,status:'LEVEL_3',cancellations:4,shipmentDelay:2,cancellationNonInt:9}]},coverage:{lateShip:{days:['2026-10-20','2026-10-21'],loaded_at:'2026-10-30T12:00:00Z',note:'fixture'}},warnings:[]});
describe('Problem insights',()=>{
 it('registration days count only confirmed events; unknown days stay null and zero needs coverage',()=>{
  const x=problemInsights(fixture(),'2026-10-20','2026-10-22');expect(x.total).toBe(2);expect(x.defectEvents).toBe(1);expect(x.uniqueOrders).toBe(2);
  expect(x.daily.map(d=>d.v)).toEqual([0,2,null]);expect(x.topDays[0]).toEqual({label:'2026-10-21',count:2});expect(x.topThreeOffersShare).toBe(1);
 });
 it('index peak and change use observed dates only, with percentage-point units',()=>{
  const x=problemInsights(fixture(),'2026-10-20','2026-10-22');expect(x.last.date).toBe('2026-10-21');expect(x.peak.date).toBe('2026-10-21');expect(x.deltaPp).toBeCloseTo(3);expect(x.thresholdGapPp).toBeCloseTo(1);expect(x.observations).toBe(2);
  const empty=problemInsights(fixture(),'2026-09-01','2026-09-30');expect(empty.last).toBeNull();expect(empty.deltaPp).toBeNull();expect(empty.topTwoDaysShare).toBeNull();
 });
 it('partial coverage does not manufacture zero registrations',()=>{
  const d=fixture();d.coverage.lateShip.incomplete_since='2026-10-20';expect(problemInsights(d,'2026-10-20','2026-10-21').daily.map(r=>r.v)).toEqual([null,2]);
 });
 it('quality keeps actual zero, unknown and invalid values distinct',()=>{
  const q=qualitySnapshot([{rating:'rating_delivery_complaints_fbs',value:0,status:'OK'},{rating:'rating_delivery_complaints_fbo',value:0,status:'UNKNOWN_STATUS'},{rating:'rating_price_red',value:2,status:'OK'},{rating:'rating_review_avg_score_total',value:4.86,status:'OK'}]);
  expect(q.complaints[0].value).toBeNull();expect(q.complaints[1].value).toBe(0);expect(q.zones.find(r=>r.key==='red')!.value).toBeNull();expect(q.score).toBe(4.86);expect(q.shipmentDelay).toBeNull();
 });
 it('renders index, concentration and grouped quality visuals; missing complaint has no zero bar',()=>{
  const d=fixture();d.summary=[['rating_price_super',.7],['rating_price_green',.1],['rating_price_yellow',.1],['rating_price_red',.1],['rating_review_avg_score_total',4.86],['rating_delivery_complaints_fbs',0],['rating_delivery_complaints_rfbs_sd',.0095],['rating_delivery_complaints_fbo',null]].map(([rating,value])=>({rating,value,date:'2026-10-29',status:value===null?'UNKNOWN_STATUS':'OK',value_type:'RATIO'}));
  const errors:unknown[]=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));const dom=new JSDOM(problemsPage(d),{runScripts:'dangerously',virtualConsole:vc});const doc=dom.window.document;
  expect(errors).toEqual([]);expect(doc.querySelector('#shipping-findings')!.textContent).toContain('регистраций просрочки');expect(doc.querySelector('#index-insights')!.textContent).toContain('п.п.');
  expect(doc.querySelectorAll('.zone-bar span')).toHaveLength(4);expect(doc.querySelector('.quality-score')!.textContent).toBe('4,86');
  expect(doc.querySelectorAll('.complaint-row')[0].querySelector('.complaint-track')).toBeNull();expect(doc.querySelectorAll('.complaint-row')[1].textContent).toContain('0%');expect(doc.querySelector('#rating-summary')!.textContent).toContain('общий процент');dom.window.close();
 });
});
