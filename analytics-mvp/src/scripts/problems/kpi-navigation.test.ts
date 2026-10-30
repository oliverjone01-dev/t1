import {describe,it,expect} from 'vitest';
import {JSDOM} from 'jsdom';
import {problemsPage} from './page.js';
import type {ProblemData} from './model.js';
function open(){
 const data:ProblemData={now:'2026-10-30T12:00:00Z',postings:[{order:'example',date:'2026-10-29',status:'cancelled',scheme:'FBS',offer:'A',sku:'1',amount:100,reason:'Reason',initiator:'seller'}],events:[],ratings:[],summary:[],thresholds:null,coverage:{},warnings:[]};
 const scrolled:string[]=[];
 const dom=new JSDOM(problemsPage(data),{runScripts:'dangerously',beforeParse(w){w.HTMLElement.prototype.scrollIntoView=function(){scrolled.push(this.id);};}});
 return {dom,doc:dom.window.document,scrolled};
}
describe('Problems KPI navigation',()=>{
 it('large list starts hidden and period changes do not reveal it',()=>{
  const {dom,doc}=open();expect((doc.querySelector('#orders-panel') as HTMLElement).hidden).toBe(true);
  (doc.querySelector('[data-p="7d"]') as HTMLElement).click();
  expect((doc.querySelector('#orders-panel') as HTMLElement).hidden).toBe(true);dom.window.close();
 });
 it.each([[0,'cancel-panel','cancel'],[1,'cancel-panel','cancel'],[4,'fine-panel','fine'],[5,'return-panel','return'],[7,'rating-panel','defectCharge']])('KPI %s scrolls to its chart and prepares only its selected list',(index,target,kind)=>{
  const {dom,doc,scrolled}=open();(doc.querySelectorAll('#kpis [data-kind]')[Number(index)] as HTMLElement).click();
  expect(scrolled.at(-1)).toBe(target);expect(scrolled).not.toContain('orders-panel');
  expect((doc.querySelector('#orders-panel') as HTMLElement).hidden).toBe(false);
  expect((doc.querySelector('#kind') as HTMLSelectElement).value).toBe(kind);dom.window.close();
 });
 it.each([[2,'lateShip'],[6,'deliveryLoss']])('KPI without chart %s opens its filtered list',(index,kind)=>{
  const {dom,doc,scrolled}=open();(doc.querySelectorAll('#kpis [data-kind]')[Number(index)] as HTMLElement).click();
  expect(scrolled.at(-1)).toBe('orders-panel');expect((doc.querySelector('#kind') as HTMLSelectElement).value).toBe(kind);dom.window.close();
 });
 it('keyboard activation works and the list can be hidden again',()=>{
  const {dom,doc,scrolled}=open(),tile=doc.querySelectorAll('#kpis [data-kind]')[4] as HTMLElement;
  tile.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  expect(scrolled.at(-1)).toBe('fine-panel');expect((doc.querySelector('#orders-panel') as HTMLElement).hidden).toBe(false);
  (doc.querySelector('#hide-orders') as HTMLElement).click();expect((doc.querySelector('#orders-panel') as HTMLElement).hidden).toBe(true);dom.window.close();
 });
});
