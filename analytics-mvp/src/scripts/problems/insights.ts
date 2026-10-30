import type {ProblemData} from './model.js';
export function problemInsights(data:ProblemData,from:string,to:string){
 const inside=(d:string)=>d>=from&&d<=to;
 const delays=data.events.filter(e=>e.kind==='lateShip'&&inside(e.date));
 const defects=data.events.filter(e=>e.kind==='defectCharge'&&inside(e.date));
 const group=(rows:any[],key:(r:any)=>string)=>{
  const map=new Map<string,number>();for(const r of rows){const k=key(r)||'Не указан';map.set(k,(map.get(k)??0)+1);}
  return [...map].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
 };
 const dates:string[]=[];for(let d=from;d<=to&&dates.length<1500;d=new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10))dates.push(d);
 const covered=new Set((data.coverage.lateShip?.days??[]).filter(d=>!data.coverage.lateShip?.incomplete_since||d<data.coverage.lateShip.incomplete_since)),counts=new Map(group(delays,r=>r.date).map(r=>[r.label,r.count]));
 const rating=data.ratings.filter(r=>inside(r.date)&&typeof r.defect_index==='number').sort((a,b)=>a.date.localeCompare(b.date));
 const first=rating[0]??null,last=rating.at(-1)??null,peak=rating.reduce((best:any,r)=>!best||r.defect_index>best.defect_index?r:best,null);
 const threshold=data.thresholds?.rows?.find((r:any)=>r.status==='LEVEL_3')?.begin??null;
 const topDays=group(delays,r=>r.date),offers=group(delays,r=>r.offer),types=group(defects,r=>r.reason.replace('Ошибка Ozon: UNSPECIFIED','Тип ошибки не расшифрован Ozon'));
 return {total:delays.length,uniqueOrders:new Set(delays.map(r=>r.order).filter(Boolean)).size,
  daily:dates.map(date=>({date,v:counts.get(date)??(covered.has(date)?0:null)})),coveredDays:dates.filter(d=>covered.has(d)).length,
  topDays,offers,types,defectEvents:defects.length,
  topTwoDaysShare:delays.length?topDays.slice(0,2).reduce((n,r)=>n+r.count,0)/delays.length:null,
  topThreeOffersShare:delays.length?offers.slice(0,3).reduce((n,r)=>n+r.count,0)/delays.length:null,
  first,last,peak,observations:rating.length,deltaPp:first&&last?(last.defect_index-first.defect_index)*100:null,
  threshold,thresholdGapPp:last&&threshold!==null?threshold-last.defect_index*100:null};
}
export function qualitySnapshot(rows:any[]){
 const get=(id:string)=>{const r=rows.find(r=>r.rating===id);const max=id==='rating_review_avg_score_total'?5:1;return r&&r.status!=='UNKNOWN_STATUS'&&typeof r.value==='number'&&r.value>=0&&r.value<=max?r.value:null;};
 const zones=[['super','Супервыгодная','#22c7b8'],['green','Зелёная','#65c68d'],['yellow','Жёлтая','#d6af69'],['red','Красная','#ec819f']].map(([key,label,color])=>({key,label,color,value:get('rating_price_'+key)}));
 return {zones,zoneTotal:zones.reduce((n,r)=>n+(r.value??0),0),zonesComplete:zones.every(r=>r.value!==null),
  complaints:[['fbo','FBO'],['fbs','FBS'],['rfbs_sd','rFBS']].map(([key,label])=>({label,value:get('rating_delivery_complaints_'+key)})),
  score:get('rating_review_avg_score_total'),shipmentDelay:get('rating_shipment_delay_cb')};
}
