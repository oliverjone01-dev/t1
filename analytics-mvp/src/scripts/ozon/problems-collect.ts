import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {OzonSeller} from '../../connector/ozon-seller.js';
import {atomicText,readRows,validateRows} from './collector-integrity.js';
import {mergeRatingRows} from './import-problems-rating.js';
import {days,shift,moscowDay,type Posting,type Event} from '../problems/model.js';

export const FINE_NAMES=new Set(['DefectRate','DefectFineModeration','DefectFineProhibitedGoods','DefectFineCounterfeitGoods','DefectFineComplaint','DefectFineErrors','DefectFineShipmentDelayRate']);
export function rub(v:any):number|null {
 if(v===undefined||v===null||v==='')return null;
 if(typeof v==='object'){if((v.currency??v.currency_code??'RUB')!=='RUB')throw new Error('Non-RUB amount');return rub(v.amount??v.price);}
 const n=Number(v);if(!Number.isFinite(n))throw new Error('Invalid money');return n;
}
export function normalizePosting(p:any):Posting{
 if(!p.posting_number||!p.in_process_at||!Array.isArray(p.products))throw new Error('Posting source contract');
 const parts=p.products.map((x:any)=>{const price=rub(x.price),qty=Number(x.quantity);if(!Number.isFinite(qty)||qty<0)throw new Error('Posting quantity');return price===null?null:price*qty;});
 const schema=String(p.delivery_schema??'').toLowerCase();
 // Probe: delivery_schema='Fbs' also wraps known self-delivery rFBS. Only confirmed provider values split it.
 const provider=p.delivery_method;
 const scheme=schema==='rfbs'||(provider?.tpl_provider_id===-1&&provider?.tpl_provider==='Самостоятельно')?'rFBS':schema==='fbo'?'FBO':provider?.tpl_provider==='Доставка Ozon'?'FBS':'FBS/rFBS';
 const type=String(p.cancellation?.cancellation_type??'').toLowerCase();
 return {order:String(p.posting_number),date:moscowDay(p.in_process_at),status:String(p.status),scheme,sku:p.products.map((x:any)=>String(x.sku)).join(', '),offer:p.products.map((x:any)=>String(x.offer_id??'')).join(', '),amount:parts.some((x:any)=>x===null)?null:Math.round(parts.reduce((s:number,x:number)=>s+x,0)*100)/100,reason:p.cancellation?.cancel_reason||null,initiator:['client','buyer','seller','ozon'].includes(type)?type:null};
}
export function returnEvents(raw:any[],from:string,to:string):Event[]{
 return raw.map(r=>{
  const date=r.logistic?.return_date?moscowDay(r.logistic.return_date):null;
  if(!r.id||!date||date<from||date>to||!r.product)throw new Error('Return date/id/product contract');
  const qty=Number(r.product.quantity);if(!Number.isFinite(qty)||qty<=0)throw new Error('Return quantity');
  const price=rub(r.product.price);
  return {id:'return:'+r.id,date,kind:'return',order:r.posting_number??null,offer:String(r.product.offer_id??''),scheme:r.schema==='Fbo'?'FBO':r.schema==='Rfbs'?'rFBS':'FBS/rFBS',reason:(r.type==='Cancellation'?'Невыкуп / отмена · ':'Возврат · ')+String(r.return_reason_name??'Причина не указана')+' · '+String(r.visual?.status?.display_name??'Статус не указан'),amount:price===null?null:Math.round(price*qty*100)/100,qty,source:'Seller API /returns/list · стоимость товаров'} as Event;
 });
}
export function fineEvents(raw:any[],types:any[],date:string):Event[]{
 const byType=new Map(types.map(t=>[Number(t.id),t])),out:Event[]=[];
 for(const r of raw){
  if(!r.accrual_id||r.date!==date)throw new Error('Accrual id/date contract');
  const walk=(v:any,path:string)=>{
   if(!v||typeof v!=='object')return;
   if(v.type_id!==undefined&&v.accrued!==undefined){
    const t=byType.get(Number(v.type_id));if(!t)throw new Error('Unknown accrual type '+v.type_id);
    if(FINE_NAMES.has(t.name)){const amount=rub(v.accrued);if(amount===null)throw new Error('Missing fine amount');out.push({id:'fine:'+r.accrual_id+':'+path,date,kind:'fine',order:r.posting?.posting_number??null,offer:'',scheme:r.posting?.delivery_schema??'',reason:t.description||t.name,amount:-amount,source:'Seller API /accrual/by-day · '+t.name});}
    return;
   }
   for(const [k,x]of Object.entries(v))walk(x,path+'.'+k);
  };walk(r,'root');
 }
 validateRows(out,r=>r.id);return out;
}
export function defectEvents(raw:any[],postings:Posting[]):Event[]{
 const map=new Map(postings.map(p=>[p.order,p]));return raw.flatMap(r=>{
  if(!r.posting_number||!r.error_at||typeof r.charge_price!=='number'||!Number.isFinite(r.charge_price)||r.charge_price_currency_code!=='RUB')throw new Error('Defect posting contract/currency');
  const base={date:moscowDay(r.error_at),order:r.posting_number,offer:map.get(r.posting_number)?.offer??'',scheme:r.delivery_schema,source:'Seller API · расчёт индекса ошибок'},key=r.posting_number+':'+r.error_at+':'+r.posting_error_type;
  const out:Event[]=[{...base,id:'defect:'+key,kind:'defectCharge',reason:r.posting_error_type==='SELLER_DELAY'?'Просрочка продавца по данным Ozon':'Ошибка Ozon: '+r.posting_error_type,amount:r.charge_price}];
  if(r.posting_error_type==='SELLER_DELAY')out.push({...base,id:'delay:'+key,kind:'lateShip',reason:'Ozon зарегистрировал SELLER_DELAY; дата регистрации ошибки',amount:null});
  return out;
 });
}
export function replaceEvents(old:Event[],fresh:Event[],kinds:string[],from:string,to:string){
 validateRows(fresh,r=>r.id);if(fresh.some(r=>r.date<from||r.date>to))throw new Error('Events outside requested interval');
 const keys=new Set(fresh.map(r=>r.id));
 const missing=old.filter(r=>kinds.includes(r.kind)&&r.date>=from&&r.date<=to&&!keys.has(r.id));
 if(missing.length)throw new Error('Saved problem events disappeared: '+missing.length+'; prior data preserved');
 return old.filter(r=>!kinds.includes(r.kind)||r.date<from||r.date>to).concat(fresh).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
export async function collectProblems(out='data',now=new Date().toISOString()){
 const clientId=process.env.OZON_SELLER_CLIENT_ID??'',apiKey=process.env.OZON_SELLER_API_KEY??'';
 if(!clientId||!apiKey)throw new Error('Missing Seller API credentials');
 const seller=new OzonSeller({clientId,apiKey}),today=moscowDay(now),to=shift(today,-1),prevMonth=shift(today.slice(0,7)+'-01',-1).slice(0,7)+'-01';
 mkdirSync(out,{recursive:true});
 const load=(f:string,fallback:any)=>existsSync(join(out,f))?JSON.parse(readFileSync(join(out,f),'utf8')):fallback;
 const state=load('problems_status.json',{}),oldPosts=readRows<Posting>(join(out,'problems_postings.ndjson'));
 let events=readRows<Event>(join(out,'problems_events.ndjson'));
 // Full posting history also retains old open rFBS shipments. Two batch endpoints, no per-order cabinet history.
 const rawPosts=await seller.problemPostings('2026-02-06',today),posts=rawPosts.map(normalizePosting);
 if(!posts.length)throw new Error('Empty full-history posting source for existing shop');
 validateRows(posts,p=>p.order);
 const oldIds=new Set(posts.map(p=>p.order));if(oldPosts.some(p=>!oldIds.has(p.order)))throw new Error('Posting disappeared from full source');
 state.postings={days:days('2026-02-06',to),loaded_at:now,note:'FBS/rFBS · дата создания по Москве; текущий статус когорты'};
 const index=await seller.problemRatingIndex(),ratingSummary=await seller.problemRatingSummary();
 if(!Array.isArray(index.defects)||!Array.isArray(ratingSummary.groups)||index.currency_code!=='RUB')throw new Error('Rating contract/currency');
 const rating=index.defects.map((r:any)=>({date:r.date,defect_index:r.index_by_date,charge_rub:r.processing_costs_sum_by_date,level:null,window_start:index.period_from,window_end:index.period_to,snap:today,ts:now}));
 for(const r of rating)if(typeof r.defect_index!=='number'||r.defect_index<0||r.defect_index>1||!Number.isFinite(r.charge_rub))throw new Error('Rating values');
 if(Math.abs(rating.reduce((s:number,r:any)=>s+r.charge_rub,0)-index.processing_costs_sum)>.011)throw new Error('Rating source sum');
 const summary=ratingSummary.groups.flatMap((g:any)=>g.items.map((r:any)=>({date:today,rating:r.rating,name:r.name,value:r.status==='UNKNOWN_STATUS'?null:r.current_value,status:r.status,warning:null,ban:null,value_type:r.value_type,snap:today,ts:now})));
 const defectRaw=await seller.problemRatingPostings(prevMonth,today);
 events=replaceEvents(events,defectEvents(defectRaw,posts),['lateShip','defectCharge'],prevMonth,today);
 for(const k of ['lateShip','defectCharge'])state[k]={days:days(prevMonth,to),loaded_at:now,note:'Ошибки, зарегистрированные Ozon; общий процент просроченных передач не рассчитан'};
 const returns=returnEvents(await seller.problemReturns(prevMonth,to),prevMonth,to);
 events=replaceEvents(events,returns,['return'],prevMonth,to);state.return={days:days(prevMonth,to),loaded_at:now,note:'Возвратные товары, включая невыкуп; стоимость товаров не равна денежному рефанду'};
 const types=await seller.accrualTypes(),fineDays=new Set<string>(state.fine?.days??[]);
 for(const date of days(prevMonth,to)){
  if(fineDays.has(date)&&date<shift(to,-6))continue;
  const fresh=fineEvents(await seller.accrualByDay(date),types,date);
  events=replaceEvents(events,fresh,['fine'],date,date);fineDays.add(date);
  console.log('problems accrual day',date,'penalty rows',fresh.length);
 }
 state.fine={days:[...fineDays].sort(),loaded_at:now,note:'Только подтверждённые Defect-типы; FlexiblePayments не включается'};
 const observations=readRows<any>(join(out,'problems_delivery_observations.ndjson'));
 const observed=rawPosts.filter(p=>!['delivered','cancelled'].includes(p.status)).map(p=>({date:today,order:p.posting_number,status:p.status,scheme:p.delivery_schema??null,shipment_date:p.shipment_date??null,shipment_date_without_delay:p.shipment_date_without_delay??null,delivering_date:p.delivering_date??null,promised_begin:p.analytics_data?.delivery_date_begin??null,promised_end:p.analytics_data?.delivery_date_end??null,client_begin:p.analytics_data?.client_delivery_date_begin??null,client_end:p.analytics_data?.client_delivery_date_end??null,ts:now}));
 // No promise semantics validated across two actual daily snapshots yet. Store evidence, not false zero events.
 state.shift={days:[],loaded_at:now,note:'Даты API сохраняются ежедневно; для подтверждения переноса нужны два снимка и проверка значения поля'};
 state.lateDelivery={days:[],loaded_at:now,note:'Факт доставки отсутствует в пакетном списке; по смене статуса не вычисляется'};
 validateRows(events,r=>r.id);validateRows(rating,r=>r.date);validateRows(summary,r=>r.date+':'+r.rating);
 const writes:Record<string,any[]>={'problems_postings.ndjson':posts,'problems_events.ndjson':events,'problems_delivery_observations.ndjson':mergeRatingRows(observations,observed,r=>r.date+':'+r.order),'rating_daily.ndjson':mergeRatingRows(readRows(join(out,'rating_daily.ndjson')),rating,r=>r.date),'rating_summary.ndjson':mergeRatingRows(readRows(join(out,'rating_summary.ndjson')),summary,r=>r.date+':'+r.rating)};
 for(const [f,rows]of Object.entries(writes))atomicText(join(out,f),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
 atomicText(join(out,'problems_status.json'),JSON.stringify(state)+'\n');
 console.log('problems complete',posts.length,'postings,',events.length,'events');
}
if(process.argv[1]?.endsWith('/problems-collect.ts'))collectProblems(process.env.PROBLEMS_OUT_DIR??'data').catch(e=>{let message=String(e.message);for(const value of [process.env.OZON_SELLER_API_KEY,process.env.OZON_SELLER_CLIENT_ID])if(value)message=message.split(value).join('***');console.error('problems FAILED:',message);process.exitCode=1;});
