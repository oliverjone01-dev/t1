import {it,expect} from 'vitest';
import {partialChartPoint as point} from './partial-chart.js';
it('uses only the observed population for partial sum index without touching history',()=>{
 const history=[[10,10],[1000,1000]],saved=structuredClone(history);
 expect(point(history,[5,null],[0,1],'index','sum')).toEqual({value:50,raw:5,have:1,want:2});
 expect(history).toEqual(saved);
});
it('distinguishes observed zero from missing slice',()=>{
 expect(point([[10]],[0],[0],'index','sum').value).toBe(0);
 expect(point([[10]],[null],[0],'index','sum').value).toBeNull();
});
it('keeps existing card collapse for median indices',()=>{
 expect(point([[10],[10],[10]],[1,1,10],[0],'index','median',['A','A','B']).value).toBe(55);
});
it('does not fabricate index when observed group has no base',()=>{
 expect(point([[null]],[3],[0],'index','sum').value).toBeNull();
});

it('keeps actual test1 search tooltip in group units while its line uses median indices',()=>{
 const counts=[318,142,107,198,290,153,30,968,89,23,6];
 expect(point(counts.map(()=>[100]),counts,[0],'index','median').raw).toBe(2324);
 expect(point([[10],[20]],[12,18],[0],'raw','median').raw).toBe(15);
});
