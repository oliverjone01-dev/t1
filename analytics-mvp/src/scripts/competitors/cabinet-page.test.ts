import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {cabinetCompetitorPage,validateCabinetSnapshot} from './cabinet-page.js';
import {competitorSourceSwitch} from './source-switch.js';
const data=JSON.parse(readFileSync('data/competitors/cabinet-2026-10-27.json','utf8'));
function open(){const errors:string[]=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(cabinetCompetitorPage(data),{url:'https://example.org/t1/katya-competitors-cabinet.html',runScripts:'dangerously',virtualConsole:vc,beforeParse(w:any){w.scrollTo=()=>{}}});return {dom,w:dom.window as any,d:dom.window.document,errors}}
describe('Cabinet source integration',()=>{
 it('keeps source documents separate and links both ways',()=>{
  for(const active of ['cabinet','mpstats'] as const){const d=new JSDOM(competitorSourceSwitch(active)).window.document;expect(d.querySelectorAll('a')).toHaveLength(2);expect(d.querySelectorAll('[aria-current="page"]')).toHaveLength(1);expect(d.querySelector('[aria-current]')!.textContent).toBe(active==='cabinet'?'Кабинет Ozon':'MPSTATS');}
  const {dom,d,errors}=open();expect(d.querySelector('.competitor-dashboard-nav a[href="katya-marketing.html"]')).not.toBeNull();expect(d.querySelector('#cm-data')).toBeNull();expect(JSON.parse(d.querySelector('#cabinet-data')!.textContent!)).toEqual(data);expect(errors).toEqual([]);dom.window.close();
 });
 it('switches all seven categories without carrying table market shares over',()=>{
  const {dom,d,w,errors}=open();expect(d.querySelectorAll('#category option')).toHaveLength(7);
  for(const cat of data.categories){w.changeCategory(cat);expect(d.querySelector('#category-title')!.textContent).toBe(cat);expect(w.categoryRows().every((r:any)=>r.category3===cat)).toBe(true);expect(w.categoryModels().flatMap((m:any)=>m.skus).every((s:string)=>data.categoryMap[s]===cat)).toBe(true);if(cat!=='Стол обеденный'){expect(d.querySelector('#market-kpis')!.textContent).not.toContain('32 /');expect(d.querySelector('#market-kpis')!.textContent).toContain('н/д');}w.showPage('history');expect(d.querySelector('#history-chart')!.innerHTML).not.toContain('NaN');}
  expect(errors).toEqual([]);dom.window.close();
 });
 it('preserves known nulls, period-specific decisions and one real snapshot date',()=>{
  const {dom,w,d,errors}=open();expect(w.item('1604806784','28').soldCount).toBeNull();expect(w.item('3564833771','28').soldCount).toBe(0);expect(w.item('3564833771','28').avgPrice).toBeNull();expect(w.signalsFor('5426756030','28').some((r:any)=>r.type==='offer')).toBe(true);expect(w.signalsFor('5426756030','7').some((r:any)=>r.type==='offer')).toBe(false);w.selectSku('5426756030',false);w.showPage('history');expect(d.querySelectorAll('#history-chart circle')).toHaveLength(2);expect(d.querySelector('#pace-chart')!.textContent).toContain('1,57');expect(errors).toEqual([]);dom.window.close();
 });
 it.each(['categories','date','role','zero','link','private','nonfinite'])('rejects invalid public snapshot: %s',kind=>{
  const x=structuredClone(data);if(kind==='categories')x.categories.push(x.categories[0]);if(kind==='date')x.meta.updateDate='2026-10-27';if(kind==='role')x.pairs[0].competitorSku=x.pairs[0].ownSku;if(kind==='zero')x.snapshots['28']['1604806784'].soldCount=0;if(kind==='link')x.catalog[0].link='javascript:alert(1)';if(kind==='private')x.catalog[0].source='/Users/person/private.json';if(kind==='nonfinite')x.catalog[0].soldCount=Infinity;expect(()=>validateCabinetSnapshot(x)).toThrow();
 });
 it('embeds text without script injection',()=>{const x=structuredClone(data);x.catalog[0].name='</script><img src=x onerror=alert(1)>';expect(cabinetCompetitorPage(x)).not.toContain('</script><img');});
});
