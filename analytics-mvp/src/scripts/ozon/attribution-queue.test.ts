import {describe,it,expect} from 'vitest';
import {attributionCampaignIds,attributionPriority} from './ad-attribution-daily.js';
describe('Attribution campaign coverage',()=>{
 it('includes campaigns outside tops, deduplicates IDs, excludes unsupported and outside dates',()=>{
  const daily=[{d:'2026-10-20',id:'small',sp:12},{d:'2026-10-21',id:'small',sp:5},{d:'2026-10-20',id:'cpo',sp:100},{d:'2026-08-01',id:'old',sp:10},{d:'2026-10-20',id:'zero',sp:0},{d:'2026-10-20',id:'unsupported',sp:10}];
  expect(attributionCampaignIds(daily,['top','small'],new Set(['top','small','old','zero']),'2026-10-01','2026-10-31')).toEqual(['top','small']);
 });
 it('recovery prioritizes missing campaigns over already current active campaigns',()=>{
  const state={done:{through:'2026-10-31'},partial:{through:'2026-10-21'}};
  expect(['done','partial','missing'].sort(attributionPriority(state,new Map([['done',100],['partial',5]]),'2026-10-31'))).toEqual(['partial','missing','done']);
 });
});
