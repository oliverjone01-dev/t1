import {describe,it,expect} from 'vitest';
import {JSDOM,VirtualConsole} from 'jsdom';
import {problemsPage} from './page.js';
import type {ProblemData} from './model.js';
function open(patch:Partial<ProblemData>={}){
 const data:ProblemData={now:'2026-10-30T12:00:00Z',postings:[
  ['a','client','Shared',100],['b','seller','Shared',200],['c','seller','Ours',300],['d','ozon','Delivery',400],['e','client','Shared',null]
 ].map(([order,initiator,reason,amount])=>({order:String(order),initiator:String(initiator),reason:String(reason),amount:amount as number|null,date:'2026-10-20',status:'cancelled',scheme:'FBS',offer:'A',sku:'1'})),events:[
  ['a','Heavy',1,1000],['b','Many',5,100],['c','Unknown amount',2,null],['d','Unknown qty',null,50]
 ].map(([id,reason,qty,amount])=>({id:String(id),reason:String(reason),qty:qty as number|null,amount:amount as number|null,date:'2026-10-20',kind:'return',order:null,offer:'A',scheme:'FBS',source:'fixture'})),ratings:[],summary:[],thresholds:null,coverage:{},warnings:[]};
 Object.assign(data,patch);
 const errors:unknown[]=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(problemsPage(data),{runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.HTMLElement.prototype.scrollIntoView=()=>{};}});
 expect(errors).toEqual([]);return {dom,doc:dom.window.document};
}
const row=(doc:Document,root:string,label:string)=>[...doc.querySelectorAll(root+' [data-reason-group]')].find(el=>el.querySelector('.reason-label')?.textContent===label)! as HTMLElement;
describe('Linked cancellation reasons and return amounts',()=>{
 it('puts cancellation initiators before reasons and shows their known money',()=>{
  const {dom,doc}=open();expect([...doc.querySelector('[data-problem-pair="cancel"]')!.children].map(el=>el.id)).toEqual(['cancel-initiator-panel','cancel-panel']);
  expect(row(doc,'#cancel-initiator-breakdown','Мы').querySelector('.reason-money')!.textContent).toBe('500 ₽');
  expect(row(doc,'#cancel-initiator-breakdown','Покупатель').querySelector('.reason-money')!.textContent).toContain('100 ₽ · неполно');dom.window.close();
 });
 it('hover links exact posting IDs even when a reason has several initiators; leave restores totals',()=>{
  const {dom,doc}=open(),actor=row(doc,'#cancel-initiator-breakdown','Покупатель'),shared=row(doc,'#cancel-breakdown','Shared');
  actor.dispatchEvent(new dom.window.MouseEvent('mouseenter'));
  expect(shared.classList.contains('is-linked')).toBe(true);expect(shared.dataset.relatedCount).toBe('2');
  expect(shared.querySelector('.reason-money')!.textContent).toContain('2 из 3 · 100 ₽');
  expect(row(doc,'#cancel-breakdown','Ours').classList.contains('is-dim')).toBe(true);
  expect((doc.querySelector('#orders-panel') as HTMLElement).hidden).toBe(true);
  actor.dispatchEvent(new dom.window.MouseEvent('mouseleave'));
  expect(doc.querySelectorAll('.is-linked,.is-dim')).toHaveLength(0);expect(shared.querySelector('.reason-money')!.textContent).toContain('300 ₽');dom.window.close();
 });
 it('keyboard focus highlights reasons and blur clears it',()=>{
  const {dom,doc}=open(),actor=row(doc,'#cancel-initiator-breakdown','Мы');actor.focus();
  expect(doc.querySelectorAll('#cancel-breakdown .is-linked')).toHaveLength(2);actor.blur();
  expect(doc.querySelectorAll('#cancel-breakdown .is-linked')).toHaveLength(0);dom.window.close();
 });
 it('returns have one cause list with units and known values, including unpriced goods',()=>{
  const {dom,doc}=open();expect(doc.querySelector('#return-initiator-panel')).toBeNull();expect(doc.querySelector('#return-breakdown')).toBeNull();
  expect(doc.querySelector('#return-panel .donut-total b')!.textContent).toBe('1 150');expect(doc.querySelector('#return-value-breakdown')!.textContent).toContain('Без суммы: 1');
  const unknown=row(doc,'#return-value-breakdown','Unknown amount');expect(unknown.querySelector('.reason-values b')!.textContent).toBe('2 шт.');expect(unknown.querySelector('.reason-money')!.textContent).toContain('н/д ₽');
  const value=row(doc,'#return-value-breakdown','Heavy');expect(value.querySelector('.reason-values b')!.textContent).toBe('1 шт.');
  value.click();expect((doc.querySelector('#kind') as HTMLSelectElement).value).toBe('return');expect(doc.querySelectorAll('#orders tr')).toHaveLength(1);dom.window.close();
 });
 it('daily graph switches units and value; covered empty days are zero, missing days are gaps',()=>{
  const {dom,doc}=open({events:[{id:'r',date:'2026-10-20',kind:'return',order:null,offer:'A',scheme:'FBS',reason:'Heavy',qty:3,amount:1200,source:'fixture'}],coverage:{return:{days:['2026-10-20','2026-10-21'],loaded_at:null,note:'fixture'}}});
  const titles=()=>[...doc.querySelectorAll('#return-daily svg rect title')].map(t=>t.textContent);
  expect(titles()).toEqual(['2026-10-20 · 3 шт.','2026-10-21 · 0 шт.']);
  (doc.querySelector('[data-return-metric="amount"]') as HTMLElement).click();expect(titles()).toEqual(['2026-10-20 · 1 200 ₽','2026-10-21 · 0 ₽']);
  expect(doc.querySelector('[data-return-metric="amount"]')!.getAttribute('aria-pressed')).toBe('true');
  (doc.querySelector('#return-top') as HTMLSelectElement).dispatchEvent(new dom.window.Event('change'));expect(titles()).toEqual(['2026-10-20 · 1 200 ₽','2026-10-21 · 0 ₽']);dom.window.close();
 });
 it('unknown quantity or amount never becomes zero on its daily chart',()=>{
  const {dom,doc}=open();expect(doc.querySelector('#return-daily svg')).toBeNull();
  (doc.querySelector('[data-return-metric="amount"]') as HTMLElement).click();expect(doc.querySelector('#return-daily svg')).toBeNull();dom.window.close();
 });
});
