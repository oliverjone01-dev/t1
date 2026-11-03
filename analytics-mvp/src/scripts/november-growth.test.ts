import {describe,it,expect} from 'vitest';
import {JSDOM,VirtualConsole} from 'jsdom';
import {NOVEMBER_GROWTH,novemberGrowthHtml,stageState} from './november-growth.js';
import {novemberForecast,novemberForecastHtml,novemberWeeklyData} from './november-forecast.js';
import {financeWindow,novemberFinancePage} from './november-finance.js';
const nov=Array.from({length:30},(_,i)=>`2026-11-${String(i+1).padStart(2,'0')}`);
const input={today:'2026-11-03',last:'2026-11-02',covered:new Set(nov),units:new Map([['2026-11-01',4],['2026-11-02',11]]),revenue:new Map([['2026-11-01',242964],['2026-11-02',600000]])};
describe('November growth plan',()=>{
 it('uses approved growth targets and the inherited closed order facts',()=>{
  const f=novemberForecast(NOVEMBER_GROWTH,input)!;
  expect(f.target.units).toBe(450);expect(f.target.revenue).toBe(30600000);expect(f.units).toBe(15);
  expect([f.points[0]!.unitsPlan,f.points[14]!.unitsPlan,f.points[29]!.unitsPlan]).toEqual([15,225,450]);
  expect([f.points[0]!.revenuePlan,f.points[14]!.revenuePlan,f.points[29]!.revenuePlan]).toEqual([1020000,15300000,30600000]);
  expect(novemberWeeklyData(f).periods[0]!.units.ratio).toBe(50);
 });
 it('does not present stale or missing data as a current pace',()=>{
  const f=novemberForecast(NOVEMBER_GROWTH,{...input,last:'2026-11-01'})!;
  expect(f.stale).toBe(true);expect(novemberForecastHtml(f)).toContain('Срез отстаёт');expect(novemberForecastHtml(f)).not.toContain('Нужный темп на оставшиеся');
  const gap=novemberForecast(NOVEMBER_GROWTH,{...input,covered:new Set(['2026-11-02'])})!;
  expect(gap.units).toBeNull();expect(novemberForecastHtml(gap)).not.toContain('Нужный темп на оставшиеся');
 });
 it('retains actual overachievement while capping only visual fill and does not invent completed stages',()=>{
  const f=novemberForecast(NOVEMBER_GROWTH,{...input,units:new Map([['2026-11-01',500]])})!;
  expect(f.units).toBe(500);expect(novemberWeeklyData(f).periods[0]!.units.ratio).toBeCloseTo(500/30*100);
  expect(stageState('2026-11-02','2026-11-03','2026-11-05')).toBe('Запланировано');
  expect(stageState('2026-11-04','2026-11-03','2026-11-05')).toBe('Окно по плану');
  expect(stageState('2026-11-06','2026-11-03','2026-11-05')).toBe('Срок прошёл');
  const dom=new JSDOM(novemberGrowthHtml('2026-12-01',null));
  expect(dom.window.document.querySelectorAll('#november-decisions tbody tr')).toHaveLength(10);
  expect(dom.window.document.querySelector('#november-decisions tbody')!.textContent).toContain('нет данных');
  expect(dom.window.document.querySelector('#november-stages')!.textContent).toContain('Выполнение не подтверждено');
  dom.window.close();
 });
});
describe('November financial progress',()=>{
 it('excludes today, preserves November in December, and blocks absent source days',()=>{
  expect(financeWindow('2026-10-31','2026-11-30',nov).complete).toBe(false);
  expect(financeWindow('2026-11-03','2026-11-30',nov).end).toBe('2026-11-02');
  expect(financeWindow('2026-12-12','2026-12-11',nov).end).toBe('2026-11-30');
  expect(financeWindow('2026-11-03','2026-11-02',['2026-11-02'])).toMatchObject({complete:false,missing:['2026-11-01']});
  expect(financeWindow('2026-11-03','2026-10-31',nov)).toMatchObject({complete:false,stale:true,end:''});
 });
 it('renders existing-engine results including a loss and undefined profitability without claiming completion',()=>{
  const errors:string[]=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e)));
  // The existing engine is a dependency: sentinel outputs prove the renderer does not recompute net/rent.
  const core=`const AN_MAXD='2026-11-02',AN_RD_FROM='2026-11-01',AN_RD_TO='2026-11-02',AN_RD_MISS=[],AN_VED_MAXD='2026-11-01';function skuAnalyticsData(){return {grand:{amt:-17,tbEst:99},miss:[{sk:'x'}]};}function anDerive(){return {net:-1234.56,rent:null};}`;
  const dom=new JSDOM(novemberFinancePage(core,'2026-11-02',nov,'test'),{runScripts:'dangerously',virtualConsole:vc});
  (dom.window as any).renderNovemberFinance(Date.parse('2026-11-03T00:00:00Z'));
  const result=(dom.window as any).NOVEMBER_FINANCE;
  expect(result.result).toEqual({payout:-17,net:-1234.56,rent:null});
  expect(dom.window.document.querySelector('[data-metric=net]')!.getAttribute('data-fact')).toBe('-1234.56');
  expect(dom.window.document.querySelector('[data-metric=rent]')!.textContent).toContain('нет данных');
  expect(dom.window.document.querySelector('#finance-quality')!.textContent).toContain('SKU без себестоимости: 1');
  expect(dom.window.document.querySelector('[data-metric=rent]')!.textContent).toContain('Цель: 4,5 %');
  expect(errors).toEqual([]);dom.window.close();
 });
 it('uses Moscow midnight and exactly seven closed dates, not the browser timezone',()=>{
  const core=`const AN_MAXD='2026-11-30',AN_RD_FROM='2026-11-01',AN_RD_TO='2026-11-30',AN_RD_MISS=[],AN_VED_MAXD='2026-11-30';function skuAnalyticsData(){return {grand:{amt:0,tbEst:0},miss:[]};}function anDerive(){return {net:0,rent:null};}`;
  const dom=new JSDOM(novemberFinancePage(core,'2026-11-30',nov,'test'),{runScripts:'dangerously'});
  (dom.window as any).renderNovemberFinance(Date.parse('2026-11-08T20:30:00Z')); // 23:30 Moscow, Nov 8 still partial
  expect((dom.window as any).NOVEMBER_FINANCE.points).toHaveLength(7);
  expect((dom.window as any).NOVEMBER_FINANCE.window.end).toBe('2026-11-07');dom.window.close();
 });
});
