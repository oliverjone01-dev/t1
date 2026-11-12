import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {JSDOM,VirtualConsole} from 'jsdom';
import {createHash} from 'node:crypto';
import {readCpo,cpoSkuRows} from '../../src/scripts/ozon/cpo-capture.js';
import {cpoOrdersByDay,cpoExportCampaign} from '../../src/scripts/cpo-orders-rev.js';
const [data,out,previous]=process.argv.slice(2);assert(data);const dp=(f:string)=>join(data,f),c=readCpo(dp);
if(c){
 const old=previous?JSON.parse(readFileSync(previous,'utf8')).cpo:null;
 const changed=JSON.stringify(old)!==JSON.stringify(c);
 if(changed)assert.equal(createHash('sha256').update(readFileSync(dp('orders_daily.ndjson'))).digest('hex'),c.orders_sha256,'CPO join used different orders input; refresh private aggregate against current main');
 const co=cpoOrdersByDay(dp),camp=cpoExportCampaign(dp,co);assert.equal(camp.err,'');assert.equal(co.to,c.to);
 const rows=cpoSkuRows(dp,readFileSync(dp('cpo_sku_daily.ndjson'),'utf8').trim().split('\n').map(x=>JSON.parse(x)));
 assert.equal(new Set(rows.map(r=>r.d+'|'+r.sku)).size,rows.length,'SKU/day double count');
 if(changed)for(const r of c.report_days){const api=readFileSync(dp('ads_daily.ndjson'),'utf8').trim().split('\n').map(x=>JSON.parse(x)).filter(x=>String(x.id)===camp.id&&x.d===r.d);assert.equal(api.length,1,'Missing campaign day');assert(Math.abs(api[0].sp-r.sp)<=1,'CPO daily vs campaign exceeds integer rounding');}
 if(out)for(const name of ['katya-tests.html','katya-reklama-kartochki.html']){const html=readFileSync(join(out,name),'utf8');assert(html.includes('Оплата за заказ: текущая настройка'));assert(html.includes(c.to));}
 if(out&&c.order_days.length){
  for(const name of ['katya-money.html','katya-reklama-kartochki.html']){
   const errors:string[]=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
   const dom=new JSDOM(readFileSync(join(out,name),'utf8'),{runScripts:'dangerously',url:'https://dashboard.example',virtualConsole:vc});
   const d=c.order_days.at(-1)!.d;(dom.window as any).renderOrdersAnalytics({from:d,to:d});
   const doc=dom.window.document;
   const orders=doc.querySelector('#ordan'), skus=doc.querySelector('#ordsku');
   assert(orders);
   if(name==='katya-money.html')assert(skus);
   for(const table of skus?[orders,skus]:[orders]){
    const badges=[...table.querySelectorAll('.cpo-missing')];
    assert(badges.length,'Expected incomplete CPO markers for '+name);
    for(const badge of badges)assert(badge.matches('tr.ord-row > td:first-child > span'),'Mark only order or SKU labels');
    assert(![...table.querySelectorAll('td')].some(cell=>cell.textContent==='нет данных'),'Known amounts must remain visible');
   }
   const totals=(table:Element)=>[...table.querySelectorAll('tr:first-child > td')].slice(2).map(cell=>cell.textContent);
   if(skus)assert.deepEqual(totals(orders),totals(skus),'Order and SKU totals must match');
   assert.deepEqual(errors,[]);dom.window.close();
  }
 }
 console.log(JSON.stringify({cpo_from:c.from,cpo_to:c.to,sku_rows:c.sku.length,report_spend:c.report_days.reduce((a,r)=>a+r.sp,0),joined_days:c.order_days.length,missing_orders:co.miss,campaign:camp.id}));
}
