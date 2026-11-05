import {describe,it,expect} from 'vitest';
import {novemberCardGoals,advertisingReference,observedLowerBound} from './november-controls.js';
import {novemberPeriods} from './november-periods.js';
describe('November control plan',()=>{
 it('allocates exactly450 with a visible other-card remainder and stable October weights',()=>{
  const goals=novemberCardGoals();expect(goals).toHaveLength(11);expect(goals.reduce((n,r)=>n+r.goal,0)).toBe(450);
  expect(goals.reduce((n,r)=>n+r.baseUnits,0)).toBe(228);
  expect(goals.find(r=>r.name==='TRUBIS 160')!.goal).toBeGreaterThan(100);
  expect(goals.at(-1)!.name).toBe('Прочие карточки');
  for(const g of goals){expect(Number.isInteger(g.goal)).toBe(true);expect(Math.abs(g.goal-g.baseUnits/228*450)).toBeLessThan(1);expect(novemberPeriods().reduce((n,w)=>n+g.goal*w.days/30,0)).toBeCloseTo(g.goal,8)}
 });
 it('uses elapsed closed days and exact100/120 percent ad boundaries',()=>{
  expect(advertisingReference(20000,20000,7).status).toBe('within');expect(advertisingReference(24000,20000,7).status).toBe('over');expect(advertisingReference(24000.01,20000,7).status).toBe('high');
  expect(advertisingReference(12338.58,20000,4)).toMatchObject({status:'over',limit:20000*4/7});
  expect(advertisingReference(0,20000,4).status).toBe('within');
  for(const r of [advertisingReference(null,20000,4),advertisingReference(100,null,4),advertisingReference(0,20000,0)])expect(r.pct).toBeNull();
 });
 it('preserves unknown and measured zero distinctly in observed subtotals',()=>{
  expect(observedLowerBound([null,null])).toBeNull();expect(observedLowerBound([null,0])).toBe(0);expect(observedLowerBound([4,null,3])).toBe(7);
 });
});
