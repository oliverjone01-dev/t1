import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM,VirtualConsole } from 'jsdom';
import { validateMatchedSnapshot,loadMatchedSnapshot } from './matched-data.js';
import { matchedCompetitorPage } from './matched-page.js';
const file='data/competitors/mpstats-matched-2026-10-22.json';
const snapshot=loadMatchedSnapshot(file);
const css=readFileSync('katya/template.html','utf8').match(/<style>([\s\S]*?)<\/style>/)?.[1]??'';
const fresh=()=>structuredClone(snapshot);

describe('reviewed MPSTATS data contract',()=>{
 it('uses29 explicit links with26 own products, not29 own orders',()=>{
  expect(snapshot.pairs).toHaveLength(29);expect(new Set(snapshot.pairs.map(p=>p.ownSku)).size).toBe(26);expect(Object.keys(snapshot.products)).toHaveLength(55);
  expect(snapshot.pairs.filter(p=>p.ownSku==='3579703276')).toHaveLength(2);
  expect(snapshot.pairs.some(p=>p.competitorSku==='3486895303')).toBe(false);
 });
 it('keeps three different price meanings for20October',()=>{
  const p=snapshot.products['3564831766']!;expect(p.metrics.price).toBe(47399);expect(p.metrics.sitePrice).toBe(49899);expect(p.metrics.apiSellerPrice).toBe(109900);expect(p.metrics.priceDifference).toBe(-2500);
 });
 it('has only24 price differences and does not fill absent closing prices',()=>{
  const own=Object.values(snapshot.products).filter(p=>p.own);expect(own.filter(p=>p.metrics.priceDifference!=null)).toHaveLength(24);
  for(const sku of ['3579703276','3564827455'])expect(snapshot.products[sku]!.metrics.priceDifference).toBeNull();
 });
 it('rejects duplicate links and role reversals',()=>{
  const a=fresh();a.pairs.push(a.pairs[0]!);expect(()=>validateMatchedSnapshot(a)).toThrow('duplicate pair');
  const b=fresh();b.products[b.pairs[0]!.competitorSku]!.own=true;expect(()=>validateMatchedSnapshot(b)).toThrow('mapping roles');
 });
 it('rejects changed windows, missing calendar dates and observed null drift',()=>{
  const a=fresh();a.period.d2='2026-10-21';expect(()=>validateMatchedSnapshot(a)).toThrow('reporting period');
  const b=fresh();b.products['3564831766']!.history[0]!.date='2026-09-24';expect(()=>validateMatchedSnapshot(b)).toThrow('history dates');
  const c=fresh();const p=Object.values(c.products).find(p=>p.history.some(h=>h.observed===false))!;p.history.find(h=>h.observed===false)!.orders=0;expect(()=>validateMatchedSnapshot(c)).toThrow('no_data is not null');
 });
 it('rejects mixed source dates, fabricated deltas and unconfirmed CR',()=>{
  const a=fresh();a.products['3564831766']!.provenance.api!.date='2026-10-21';expect(()=>validateMatchedSnapshot(a)).toThrow('mixed own price dates');
  const b=fresh();b.products['3564831766']!.metrics.priceDifference=0;expect(()=>validateMatchedSnapshot(b)).toThrow('price difference');
  const c=fresh();c.products['3564831766']!.metrics.crSearchToCard=0;expect(()=>validateMatchedSnapshot(c)).toThrow('unconfirmed CR');
 });
 it('rejects non-finite data and private source payloads',()=>{
  const a=fresh();a.products['3564831766']!.metrics.orders28=Infinity;expect(()=>validateMatchedSnapshot(a)).toThrow('non-finite');
  const b=fresh() as any;b.products['3564831766'].siteRow={internal:'not public'};expect(()=>validateMatchedSnapshot(b)).toThrow('private source payload');
  const c=fresh();c.products['3564831766']!.provenance.api!.file='/Users/private/source';expect(()=>validateMatchedSnapshot(c)).toThrow('basename');
 });
 it('preserves detailed keyword reports without inventing a date axis',()=>{
  expect(snapshot.products['3564831766']!.keywords[0]!.rows).toHaveLength(111);
  expect(snapshot.products['2272994591']!.keywords[0]!.rows).toHaveLength(49);
  const a=fresh();a.products['3564831766']!.keywords[0]!.period.d2='2026-10-21';expect(()=>validateMatchedSnapshot(a)).toThrow('keyword period');
 });
 it('requires the shared design system and safely embeds user text',()=>{
  expect(()=>matchedCompetitorPage(snapshot,'','test')).toThrow('design tokens');
  const a=fresh();a.products['3564831766']!.name='</script><img src=x onerror=alert(1)>';const html=matchedCompetitorPage(a,css,'test');expect(html).not.toContain('</script><img');
 });
});

describe('integrated competitor page interactions',()=>{
 function open(){const errors:string[]=[],vc=new VirtualConsole();vc.on('jsdomError',(e:Error)=>errors.push(e.message));const dom=new JSDOM(matchedCompetitorPage(snapshot,css,'test'),{runScripts:'dangerously',virtualConsole:vc,beforeParse(w:any){w.Element.prototype.scrollIntoView=()=>{};}});return {dom,d:dom.window.document,w:dom.window,errors};}
 it('renders the existing navigation, dated source and two shared charts',()=>{
  const {dom,d,errors}=open();expect(d.querySelector('#gg-nav a[href="katya-money.html"]')).not.toBeNull();expect(d.querySelector('#gg-nav a[href="katya-competitors.html"]')).not.toBeNull();
  expect(d.querySelector('.cm-period')!.textContent).toContain('20.10.2026');expect(d.querySelectorAll('[data-chart]')).toHaveLength(2);
  expect(d.querySelectorAll('[data-chart="price"] [data-series]')).toHaveLength(2);expect(d.querySelectorAll('[data-site-point]')).toHaveLength(1);expect(errors).toEqual([]);dom.window.close();
 });
 it('adds both assigned rivals to one graph and removes only the unchecked series',()=>{
  const {dom,d,w,errors}=open();const s=d.querySelector('#cm-sku') as any;s.value='3579703276';s.dispatchEvent(new w.Event('change',{bubbles:true}));
  expect(d.querySelectorAll('[data-chart="price"] [data-series]')).toHaveLength(3);expect(d.querySelector('[data-series="2059288578"]')).not.toBeNull();expect(d.querySelector('[data-series="2753501843"]')).not.toBeNull();
  const checkbox=d.querySelector('[data-competitor="2059288578"]') as any;checkbox.checked=false;checkbox.dispatchEvent(new w.Event('change',{bubbles:true}));expect(d.querySelectorAll('[data-chart="price"] [data-series]')).toHaveLength(2);expect(d.querySelector('[data-series="2059288578"]')).toBeNull();expect(errors).toEqual([]);dom.window.close();
 });
 it('keeps catalog lines dashed, shows actual missing gaps and does not draw a fake site history',()=>{
  const {dom,d,w}=open();const s=d.querySelector('#cm-sku') as any;s.value='3734276157';s.dispatchEvent(new w.Event('change',{bubbles:true}));expect(d.querySelector('[data-series="3734276157"]')!.getAttribute('stroke-dasharray')).toBe('5 4');
  const price=d.querySelector('[data-chart="price"]')!;expect(price.querySelectorAll('[data-site-point]')).toHaveLength(1);
  const masked=snapshot.products['2272994591']!;const s2=d.querySelector('#cm-sku') as any;s2.value='3564831766';s2.dispatchEvent(new w.Event('change',{bubbles:true}));const path=d.querySelector('[data-series="2272994591"]')!.getAttribute('d')!;expect(masked.history.some(r=>r.observed===false)).toBe(true);expect(path).not.toContain('M47.00');dom.window.close();
 });
 it('opens26 own rows,29 rivals and preserves all metric groups',()=>{
  const {dom,d,errors}=open();(d.querySelector('[data-expand="all"]') as any).click();expect(d.querySelectorAll('.cm-own')).toHaveLength(26);expect(d.querySelectorAll('.cm-rival')).toHaveLength(29);
  (d.querySelector('[data-group="all"]') as any).click();expect(d.querySelectorAll('[data-metric="crSearchToCard"]')).toHaveLength(55);expect(d.querySelectorAll('[data-metric="reviews"]')).toHaveLength(55);expect(d.querySelectorAll('[data-metric="searchPosition"]')).toHaveLength(55);
  const row=d.querySelector('.cm-own[data-product="3564831766"]')!;expect(row.querySelector('[data-metric="apiSellerPrice"]')!.textContent).toContain('109');expect(row.querySelector('[data-metric="apiSellerPrice"]')!.getAttribute('title')).toContain('не цена покупателя');expect(errors).toEqual([]);dom.window.close();
 });
 it('filters by exact rival and model without changing mappings or duplicating own rows',()=>{
  const {dom,d,w,errors}=open();const q=d.querySelector('#cm-q') as any;q.value='2753501843';q.dispatchEvent(new w.Event('input',{bubbles:true}));expect(d.querySelectorAll('.cm-rival')).toHaveLength(1);expect(d.querySelector('.cm-rival')!.getAttribute('data-own')).toBe('3579703276');
  const q2=d.querySelector('#cm-q') as any;q2.value='no-such-sku';q2.dispatchEvent(new w.Event('input',{bubbles:true}));expect(d.querySelectorAll('.cm-rival')).toHaveLength(0);expect(d.querySelector('#cm-view')!.textContent).toContain('Нет соответствий');expect(errors).toEqual([]);dom.window.close();
 });
 it('updates the common date cursor and switches the chart metric',()=>{
  const {dom,d,w,errors}=open();const field=d.querySelector('#cm-left') as any;field.value='reviews';field.dispatchEvent(new w.Event('change',{bubbles:true}));expect(d.querySelector('[data-chart="reviews"]')).not.toBeNull();
  d.querySelector('[data-chart="reviews"] [data-day="27"]')!.dispatchEvent(new w.Event('pointerover',{bubbles:true}));expect(d.querySelector('#cm-hover')!.textContent).toContain('2026-10-20');expect(d.querySelector('#cm-hover')!.textContent).toContain('624');expect(errors).toEqual([]);dom.window.close();
 });
 it('keeps source explanations in a dialog and preserves111 keyword rows',()=>{
  const {dom,d,errors}=open();(d.querySelector('#cm-help') as any).click();expect(d.querySelector('#cm-source-body')!.textContent).toContain('Цена API');
  (d.querySelector('[data-tab="search"]') as any).click();expect(d.querySelectorAll('[data-query]')).toHaveLength(111);expect(d.querySelectorAll('[data-metric="crCartToOrder"]')).toHaveLength(1);expect(errors).toEqual([]);dom.window.close();
 });
});
