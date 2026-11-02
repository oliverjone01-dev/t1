import {describe,it,expect} from 'vitest';
import {JSDOM} from 'jsdom';
import {novemberForecast,novemberForecastHtml,type ForecastInput} from './november-forecast.js';
const goal={units:{nov:{mid:409}},turn_mln:{nov:{mid:27.3}},pay_mln:{nov:{mid:11.4}}};
const input=(over:Partial<ForecastInput>={}):ForecastInput=>({today:'2026-11-02',last:'2026-11-01',covered:new Set(['2026-11-01']),units:new Map([['2026-11-01',4],['2026-10-31',500],['2026-11-02',100]]),revenue:new Map([['2026-11-01',242964],['2026-10-31',3e6],['2026-11-02',1e6]]),...over});
describe('November forecast',()=>{
 it('uses only November closed facts and the approved middle forecast',()=>{
  const f=novemberForecast(goal,input())!;
  expect(f.units).toBe(4);expect(f.revenue).toBe(242964);expect(f.target).toEqual({units:409,revenue:27300000,payout:11400000});
  expect(f.points[0]!.unitsPlan).toBeCloseTo(409/30);expect(f.points[14]!.unitsPlan).toBe(204.5);expect(f.points[29]!.unitsPlan).toBe(409);
  expect(f.points[0]!.revenuePlan).toBe(910000);expect(f.points[29]!.revenuePlan).toBe(27300000);
  expect(f.points[1]!.units).toBeNull();expect(f.points).toHaveLength(30);
 });
 it('does not reuse October actuals when November sources have not arrived',()=>{
  const f=novemberForecast(goal,input({last:'2026-10-31'}))!;expect(f.units).toBeNull();expect(f.last).toBe('');expect(f.complete).toBe(false);
 });
 it('keeps future and current-day facts null even if an input contains them',()=>{
  const f=novemberForecast(goal,input({last:'2026-11-30',covered:new Set(['2026-11-01','2026-11-02'])}))!;
  expect(f.last).toBe('2026-11-01');expect(f.units).toBe(4);expect(f.points.slice(1).every(p=>p.units===null)).toBe(true);
 });
 it('a covered zero-order day is zero, while a missing day breaks cumulative totals',()=>{
  const f=novemberForecast(goal,input({today:'2026-11-05',last:'2026-11-04',covered:new Set(['2026-11-01','2026-11-02','2026-11-04']),units:new Map([['2026-11-01',4],['2026-11-04',8]])}))!;
  expect(f.points[1]!.units).toBe(4);expect(f.points[2]!.units).toBeNull();expect(f.points[3]!.units).toBeNull();expect(f.units).toBeNull();expect(f.coveredDays).toBe(3);
 });
 it('keeps payout as a goal with no invented daily fact; SVGs expose day tooltips',()=>{
  const dom=new JSDOM(novemberForecastHtml(novemberForecast(goal,input())!));
  const pay=dom.window.document.querySelector('[data-metric=payout]')!;expect(pay.getAttribute('data-fact')).toBeNull();expect(pay.textContent).toContain('после закрытия ноября');
  expect(dom.window.document.querySelectorAll('svg')).toHaveLength(2);expect(dom.window.document.querySelectorAll('circle title')[0]!.textContent).toContain('2026-11-01');
  expect(dom.window.document.querySelectorAll('circle')).toHaveLength(2);dom.window.close();
 });
 it('does not activate before November and retains the November closing result in December',()=>{
  expect(novemberForecast(goal,input({today:'2026-10-31'}))).toBeNull();
  const days=Array.from({length:30},(_,i)=>`2026-11-${String(i+1).padStart(2,'0')}`);
  const f=novemberForecast(goal,input({today:'2026-12-02',last:'2026-12-01',covered:new Set(days),units:new Map([...days.map(d=>[d,1] as [string,number]),['2026-12-01',900]])}))!;
  expect(f.last).toBe('2026-11-30');expect(f.units).toBe(30);expect(f.target.units).toBe(409);
 });
 it('rejects invalid target or fact instead of publishing fabricated progress',()=>{
  expect(()=>novemberForecast({...goal,units:{nov:{mid:NaN}}},input())).toThrow();expect(()=>novemberForecast(goal,input({units:new Map([['2026-11-01',NaN]])}))).toThrow();
 });
});
