import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {matchLedger} from '../delivery-match.js';
import {days,moscowDay,validateProblems,type ProblemData,type Event,type Posting} from './model.js';

export function loadProblemData(dir:string,now=new Date().toISOString()):ProblemData{
 const json=(f:string,fallback:any)=>existsSync(join(dir,f))?JSON.parse(readFileSync(join(dir,f),'utf8')):fallback;
 const rows=(f:string):any[]=>existsSync(join(dir,f))?readFileSync(join(dir,f),'utf8').split('\n').filter(x=>x.trim()).map(x=>JSON.parse(x)):[];
 const legacy=rows('orders_daily.ndjson'),details=rows('problems_postings.ndjson'),detailMap=new Map(details.map(p=>[p.order,p]));
 const postings:Posting[]=legacy.map(p=>({order:p.order,date:moscowDay(p.t||p.d),status:p.status,scheme:p.scheme==='FBO'?'FBO':p.scheme==='rFBS'?'rFBS':'FBS/rFBS',offer:p.offer,sku:p.sku,amount:typeof p.revenue==='number'?p.revenue:null,initiator:null,reason:null,...detailMap.get(p.order)}));
 const known=new Set(postings.map(p=>p.order));postings.push(...details.filter(p=>!known.has(p.order)));
 const status=json('problems_status.json',{}),warnings:string[]=[], events:Event[]=rows('problems_events.ndjson');
 const coverage:ProblemData['coverage']={};
 for(const key of ['postings','fine','return','lateShip','shift','lateDelivery','defectCharge'])coverage[key]={days:status[key]?.days??[],loaded_at:status[key]?.loaded_at??null,note:status[key]?.note??'Источник ещё не загружен'};
 if(!coverage.postings.days.length&&postings.length){
  // Existing complete order backbone already exposes latest statuses; precise reasons arrive separately.
  const dates=legacy.map(p=>p.d).sort(), to=dates.at(-1)!;
  coverage.postings={days:days(dates[0],to),loaded_at:null,note:`Заказы по ${to}; причина и подтип схемы могут отсутствовать`};
 }
 const state=json('delivery_sheet_state.json',{events:[]}), deliveryStatus=json('delivery_sheet_status.json',{});
 const norm=(s:string)=>s.replace(/\s+/g,' ').trim();
 const unknown=new Set<string>((state.events??[]).filter((e:any)=>e.paid_cents===null||e.ship_cents===null).map((e:any)=>norm(e.order)));
 const ledger=rows('delivery_orders.ndjson'),unknownDates=new Set<string>();
 const deliveryIssues:string[]=[];
 const missingCost=deliveryStatus.missing_cost??0,undated=deliveryStatus.undated_rows??0,unseen=deliveryStatus.retained_unseen_events??0;
 const missingPaid=deliveryStatus.missing_customer_paid??0;
 if(missingCost)deliveryIssues.push(`${missingCost} без стоимости`);
 if(missingPaid)deliveryIssues.push(`${missingPaid} без оплаты покупателя`);
 if(undated)deliveryIssues.push(`${undated} без даты`);
 if(unseen)deliveryIssues.push(`${unseen} прежних рейсов не найдены в источнике`);
 const missingKeys=state.missing_keys??[],unseenKeys=state.unseen_keys??[];
 for(const key of [...missingKeys,...unseenKeys])if(key[1])unknownDates.add(key[1]);
 // An undated row cannot be assigned to a safe day. Also fail partial if the
 // status reports more missing records than the state can date explicitly.
 const uncertain=undated>0||missingCost>missingKeys.length||unseen>unseenKeys.length;
 let skipped=0,unmatched=0;
 ledger.forEach((r,i)=>{
  if(!r.d_ship||typeof r.ship!=='number'||typeof r.deliv!=='number'||unknown.has(norm(r.order))){skipped++;if(r.d_ship)unknownDates.add(r.d_ship);return;}
  if(r.ship<=r.deliv)return;
  const matched=matchLedger([r],legacy);
  if(!matched.byPosting.size){unmatched++;events.push({id:'delivery:'+i,date:r.d_ship,kind:'deliveryLoss',order:r.order,offer:'Не сопоставлен',scheme:'rFBS',reason:'Расход на отправку выше оплаты покупателя; номер не сопоставлен',amount:Math.round((r.ship-r.deliv)*100)/100,source:'Ведомость доставки'});return;}
  for(const [order,a]of matched.byPosting){const p=postings.find(x=>x.order===order);events.push({id:'delivery:'+i+':'+order,date:r.d_ship,kind:'deliveryLoss',order,offer:p?.offer??'',scheme:'rFBS',reason:`Стоимость отправки ${a.ship.toFixed(2)} ₽; оплата покупателя ${a.deliv.toFixed(2)} ₽`,amount:Math.round((a.ship-a.deliv)*100)/100,source:'Ведомость доставки'});}
 });
 const ledgerDays=ledger.map(r=>r.d_ship).filter(Boolean).sort();
 coverage.deliveryLoss={days:ledgerDays.length?days(ledgerDays[0],deliveryStatus.through??ledgerDays.at(-1)).filter(d=>!unknownDates.has(d)):[],loaded_at:deliveryStatus.loaded_at??null,...(uncertain?{incomplete_since:deliveryStatus.from??'2026-10-05'}:{}),note:`Ведомость по ${deliveryStatus.through??ledgerDays.at(-1)??'неизвестной дате'}; ${skipped} строк с неполными полями, ${unmatched} без сопоставления номера${deliveryIssues.length?'; '+deliveryIssues.join(', '):''}`};
 if(deliveryIssues.length)warnings.push('Ведомость доставки неполная: '+deliveryIssues.join('; ')+'.');
 if(skipped)warnings.push(`Доставка: ${skipped} строк с неизвестной стоимостью, оплатой или датой исключены из суммы.`);
 if(deliveryStatus.through&&deliveryStatus.through<moscowDay(now))warnings.push(`Наша доставка загружена по ${deliveryStatus.through}.`);
 const thresholdDefault=JSON.parse(readFileSync('katya/problems/thresholds-2026-10-27.json','utf8'));
 return validateProblems({now,postings,events,ratings:rows('rating_daily.ndjson'),summary:rows('rating_summary.ndjson'),thresholds:json('rating_thresholds.json',thresholdDefault),coverage,warnings,fbsTariff:json('fbs_tariff.json',null),deliverySource:{through:deliveryStatus.through??null,loaded_at:deliveryStatus.loaded_at??null,corrected_prices:deliveryStatus.corrected_prices??0,issues:deliveryIssues}});
}
