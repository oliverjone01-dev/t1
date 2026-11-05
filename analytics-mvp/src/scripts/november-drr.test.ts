import {describe,it,expect} from 'vitest';
import {novemberDrr} from './november-drr.js';
describe('approved total DRR ceiling',()=>{
 it('uses actual turnover and treats 10% as inclusive with no 20% grace',()=>{
  expect(novemberDrr(10000,100000,10)).toEqual({drr:10,limit:10000,remaining:0,status:'within'});
  expect(novemberDrr(10000.01,100000,10).status).toBe('exceeded');
  expect(novemberDrr(12000,100000,10).status).toBe('exceeded');
  expect(novemberDrr(0,100000,10)).toMatchObject({drr:0,remaining:10000,status:'within'});
  expect(novemberDrr(3060000,30600000,10)).toMatchObject({drr:10,limit:3060000});
 });
 it('does not substitute missing dates or zero turnover with a planned turnover',()=>{
  expect(novemberDrr(null,100000,10).status).toBe('unknown');
  expect(novemberDrr(10000,null,10).limit).toBeNull();
  expect(novemberDrr(100,0,10)).toEqual({drr:null,limit:0,remaining:-100,status:'exceeded'});
  expect(novemberDrr(0,0,10)).toEqual({drr:null,limit:0,remaining:0,status:'within'});
 });
 it('rejects invalid inputs instead of drawing reassuring zeroes',()=>{
  for(const v of [NaN,Infinity,-1]){expect(()=>novemberDrr(v,100,10)).toThrow();expect(()=>novemberDrr(100,v,10)).toThrow();}
  for(const v of [0,-1,NaN,Infinity])expect(()=>novemberDrr(1,100,v)).toThrow();
 });
});
