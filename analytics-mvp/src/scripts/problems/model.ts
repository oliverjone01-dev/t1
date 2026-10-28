export type Posting={order:string;date:string;status:string;scheme:string;offer:string;sku:string;amount:number|null;reason:string|null;initiator:string|null};
export type Kind='fine'|'return'|'deliveryLoss'|'lateShip'|'shift'|'lateDelivery'|'defectCharge';
export type Event={id:string;date:string;kind:Kind;order:string|null;offer:string;scheme:string;reason:string;amount:number|null;qty?:number|null;days?:number|null;source:string};
export type Coverage={days:string[];loaded_at:string|null;note:string;incomplete_since?:string};
export type ProblemData={now:string;postings:Posting[];events:Event[];ratings:any[];summary:any[];thresholds:any;coverage:Record<string,Coverage>;warnings:string[];fbsTariff?:FbsTariff|null;fbsEstimateCohort?:FbsEstimateCohort|null;deliveryTimeline?:DeliveryTimeline|null;deliverySource?:{through:string|null;loaded_at:string|null;corrected_prices:number;issues?:string[]}};

export function shift(date:string,n:number){return new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);}
export function days(from:string,to:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)return [];
 const out:string[]=[];for(let d=from;d<=to&&out.length<1500;d=shift(d,1))out.push(d);return out;
}
export function moscowDay(ts:string){
 if(/^\d{4}-\d{2}-\d{2}$/.test(ts))return ts;
 const t=Date.parse(ts);if(!Number.isFinite(t))throw new Error('Invalid source timestamp');
 return new Date(t+3*3600000).toISOString().slice(0,10);
}
export function preset(key:string,now:string){
 const today=moscowDay(now), yesterday=shift(today,-1), weekday=(new Date(today+'T00:00:00Z').getUTCDay()+6)%7;
 if(key==='week'){const to=shift(today,-weekday-1);return {from:shift(to,-6),to};}
 if(key==='14')return {from:shift(yesterday,-13),to:yesterday};
 if(key==='month')return {from:today.slice(0,7)+'-01',to:today};
 const to=shift(today.slice(0,7)+'-01',-1);return {from:to.slice(0,7)+'-01',to};
}
export function summarize(data:ProblemData,from:string,to:string){
 const ds=days(from,to), inside=(d:string)=>d>=from&&d<=to;
 const posts=data.postings.filter(p=>inside(p.date)&&p.scheme!=='FBO'),cancelled=posts.filter(p=>p.status==='cancelled');
 const events=data.events.filter(e=>inside(e.date));
 const cover=(name:string)=>{const c=data.coverage[name],n=ds.filter(d=>c?.days.includes(d)).length;return {n,total:ds.length,full:!!ds.length&&n===ds.length&&!(c?.incomplete_since&&to>=c.incomplete_since),note:c?.note??'Источник ещё не загружен'};};
 const kinds=['fine','return','deliveryLoss','lateShip','shift','lateDelivery','defectCharge'] as Kind[];
 const metrics=Object.fromEntries(kinds.map(k=>{const rows=events.filter(e=>e.kind===k),c=cover(k),known=rows.filter(r=>r.amount!==null);return [k,{count:rows.length||c.full?rows.length:null,units:k==='return'?(rows.length?rows.reduce((s,r)=>s+(r.qty??0),0):c.full?0:null):null,sum:known.length?Math.round(known.reduce((s,r)=>s+r.amount!,0)*100)/100:c.full&&rows.length===0?0:null,unknownAmount:rows.length-known.length,rows,coverage:c}];}));
 const reasons:Record<string,number>={};for(const p of cancelled){const label=p.initiator==='seller'?'Мы':p.initiator==='client'||p.initiator==='buyer'?'Покупатель':p.initiator==='ozon'?'Ozon':'Не указан';reasons[label]=(reasons[label]??0)+1;}
 const rating=data.ratings.filter(r=>inside(r.date)).sort((a,b)=>a.date.localeCompare(b.date)).at(-1)??null;
 const summaryDates=data.summary.filter(r=>r.date<=to).map(r=>r.date).sort(),summaryDate=summaryDates.at(-1);
 const summary=data.summary.filter(r=>r.date===summaryDate);
 const ratingRows=data.ratings.filter(r=>inside(r.date)),ratingCoverage=ds.filter(d=>ratingRows.some(r=>r.date===d&&r.defect_index!==null)).length;
 const cancellationCoverage=cover('postings'), knownCancelled=cancelled.filter(p=>p.amount!==null);
 const cancellation={count:cancelled.length||cancellationCoverage.full?cancelled.length:null,base:posts.length,rate:posts.length?cancelled.length/posts.length:null,sum:knownCancelled.length?Math.round(knownCancelled.reduce((s,p)=>s+p.amount!,0)*100)/100:cancellationCoverage.full&&cancelled.length===0?0:null,coverage:cancellationCoverage,unknownAmount:cancelled.length-knownCancelled.length};
 const initiators:Record<string,string>={seller:'Мы',client:'Покупатель',buyer:'Покупатель',ozon:'Ozon'};
 const table=[...cancelled.map(p=>({id:'cancel:'+p.order,date:p.date,kind:'cancel',order:p.order,offer:p.offer,scheme:p.scheme,reason:[initiators[p.initiator??''],p.reason].filter(Boolean).join(' · ')||'Причина ещё не загружена',amount:p.amount,source:'Seller API · когорта создания'})),...events].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 return {dates:ds,cancellation,reasons,metrics,table,rating,ratingRows,ratingCoverage,summary,summaryDate,partial:to>=moscowDay(data.now)};
}
export function validateProblems(d:ProblemData){
 if(d.fbsTariff)validateTariffs(d.fbsTariff);
 if(d.fbsEstimateCohort){const c=d.fbsEstimateCohort,ids=[...c.daily,...c.other];if(c.version!==1||!/^\d{4}-\d{2}-\d{2}$/.test(c.source_date)||new Set(ids).size!==ids.length||ids.some(x=>!/^\d+-\d+-\d+$/.test(x)))throw new Error('Invalid FBS estimate cohort');}
 if(d.deliveryTimeline)validateDeliveryTimeline(d.deliveryTimeline);
 const unique=(rows:any[],key:(r:any)=>string)=>{const seen=new Set<string>();for(const r of rows){const k=key(r);if(!k||seen.has(k))throw new Error('Problems duplicate/empty key '+k);seen.add(k);}};
 unique(d.postings,r=>r.order);unique(d.events,r=>r.id);unique(d.ratings,r=>r.date);unique(d.summary,r=>r.date+':'+r.rating);
 for(const r of [...d.postings,...d.events,...d.ratings])if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date)))throw new Error('Problems invalid date');
 for(const r of d.ratings)if(r.defect_index!==null&&(!Number.isFinite(r.defect_index)||r.defect_index<0||r.defect_index>1))throw new Error('Problems invalid ratio');
 if(d.thresholds)for(const r of d.thresholds.rows)if(!(r.begin<r.end)||[r.begin,r.end,r.cancellations,r.shipmentDelay,r.cancellationNonInt].some(v=>!Number.isFinite(v)||v<0))throw new Error('Problems invalid thresholds');
 const walk=(v:any)=>{if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Problems nonfinite');if(v&&typeof v==='object')for(const x of Object.values(v))walk(x);};walk(d);
 return d;
}

export type FbsTariffRow={order:string;status:string;offer:string;qty:number;amount_cents:number;created:string;cutoff:string|null;log_cutoff:string|null;fact_transferred:string|null;delivering_date:string|null;step1_deadline:string|null;step2_deadline:string|null;step3_deadline:string|null;step4_deadline:string|null;fact_type:'discount'|'commission'|'no_discount'|null;rate_bps:number|null;effect_cents:number|null;fact_observed:string|null;fact_amount_cents?:number;current_type:'discount'|'commission'|'no_discount'|null;current_rate_bps:number|null;observed:string};
export type FbsTariff={version:1;source_date:string;sources:{date:string;sha256:string;rows:number}[];rows:FbsTariffRow[]};
export type FbsEstimateCohort={version:1;source_date:string;approved_at:string;source_sha256:string;basis:string;daily:string[];other:string[]};
// Fixed user-approved cohort. No inference of eligibility for new orders or warehouses.
export function estimateTariffs(source:FbsTariff|null|undefined,cohort:FbsEstimateCohort|null|undefined,from:string,to:string){
 const daily=new Set(cohort?.daily??[]),other=new Set(cohort?.other??[]);
 const all=summarizeTariffs(source,from,to).rows;
 const selected=all.filter(r=>daily.has(r.order)),excluded=selected.filter(r=>/cancel|return/i.test(r.status));
 const rows=selected.filter(r=>!excluded.includes(r)).flatMap(r=>{
  const elapsed=(Date.parse(r.fact_transferred??'')-Date.parse(r.created))/3600000;
  if(!Number.isFinite(elapsed)||elapsed<0||moscowDay(r.fact_transferred!)>source!.source_date)return [];
  const clockBps=elapsed<=12?-300:elapsed<=24?-200:elapsed<=36?0:elapsed<=48?100:200;
  const actual=r.fact_type!==null,bps=actual?(r.fact_type==='discount'?-r.rate_bps!:r.rate_bps!):clockBps;
  const amount=actual?(r.fact_amount_cents??r.amount_cents):r.amount_cents;
  const signed=(basis:number,rate:number)=>Math.round(basis*Math.abs(rate)/10000)*Math.sign(rate);
  return [{row:r,hours:elapsed,actual,bps,clockBps,amount_cents:amount,effect_cents:actual?r.effect_cents!:signed(amount,bps),clock_cents:signed(amount,clockBps),best_cents:Math.round(amount*300/10000)}];
 });
 const confirmed=rows.filter(r=>r.actual),estimated=rows.filter(r=>!r.actual),mismatches=confirmed.filter(r=>r.bps!==r.clockBps);
 const sum=(rs:typeof rows,key:'effect_cents'|'clock_cents'|'best_cents')=>rs.reduce((s,r)=>s+r[key],0)/100;
 const net=rows.length?sum(rows,'effect_cents'):null,best=rows.length?sum(rows,'best_cents'):null;
 const groups=[-300,-200,0,100,200].map(bps=>{const members=rows.filter(r=>r.bps===bps);return {bps,count:members.length,confirmed:members.filter(r=>r.actual).length,estimated:members.filter(r=>!r.actual).length,amount:members.reduce((s,r)=>s+r.amount_cents,0)/100,effect:sum(members,'effect_cents')};});
 return {selected,rows,confirmed,estimated,mismatches,excluded,waiting:selected.length-excluded.length-rows.length,other:all.filter(r=>other.has(r.order)),unclassified:all.filter(r=>!daily.has(r.order)&&!other.has(r.order)),groups,net,best,gap:net===null?null:rows.reduce((s,r)=>s+r.best_cents+r.effect_cents,0)/100,clock:rows.length?sum(rows,'clock_cents'):null,actualNet:confirmed.length?sum(confirmed,'effect_cents'):null,estimatedNet:estimated.length?sum(estimated,'effect_cents'):null};
}
export function summarizeTariffs(source:FbsTariff|null|undefined,from:string,to:string){
 const rows=(source?.rows??[]).filter(r=>{const d=moscowDay(r.created);return d>=from&&d<=to;}),confirmed=rows.filter(r=>r.fact_type!==null);
 const discounts=confirmed.filter(r=>r.fact_type==='discount'),surcharges=confirmed.filter(r=>r.fact_type==='commission'),standard=confirmed.filter(r=>r.fact_type==='no_discount');
 const sum=(rs:FbsTariffRow[])=>rs.reduce((s,r)=>s+r.effect_cents!,0)/100;
 const discount=confirmed.length?-sum(discounts):null,surcharge=confirmed.length?sum(surcharges):null;
 const unknown=rows.filter(r=>r.fact_type===null),unknownStatuses:Record<string,number>={};for(const r of unknown)unknownStatuses[r.status]=(unknownStatuses[r.status]??0)+1;
 // Operational queue is only the latest actual snapshot, independent of historical cohort filter.
 const queue=(source?.rows??[]).filter(r=>r.observed===source?.source_date&&['awaiting_packaging','awaiting_deliver'].includes(r.status)).sort((a,b)=>(a.cutoff??'9999').localeCompare(b.cutoff??'9999')||a.order.localeCompare(b.order));
 return {rows,confirmed,discounts,surcharges,standard,unknown,unknownStatuses,discount,surcharge,net:confirmed.length?sum(confirmed):null,queue};
}
export function validateTariffs(d:FbsTariff){
 if(d.version!==1||!/^\d{4}-\d{2}-\d{2}$/.test(d.source_date))throw new Error('Invalid tariff version/date');
 const seen=new Set<string>();
 for(const r of d.rows){
  if(!r.order||seen.has(r.order))throw new Error('Duplicate tariff posting');seen.add(r.order);
  for(const n of [r.amount_cents,r.qty])if(!Number.isSafeInteger(n)||n<0)throw new Error('Invalid tariff money/qty');
  moscowDay(r.created);
  if(!['discount','commission','no_discount',null].includes(r.fact_type))throw new Error('Invalid tariff type');
  if(r.fact_type===null){if(r.rate_bps!==null||r.effect_cents!==null)throw new Error('Unknown tariff must stay null');}
  else {
   if(r.rate_bps===null||!Number.isInteger(r.rate_bps)||r.rate_bps<0||r.rate_bps>1000||!r.fact_observed)throw new Error('Invalid tariff rate');
   if(r.fact_type==='no_discount'?r.rate_bps!==0:r.rate_bps===0)throw new Error('Invalid tariff type/rate');
   const expected=Math.round((r.fact_amount_cents??r.amount_cents)*r.rate_bps/10000)*(r.fact_type==='discount'?-1:1);
   if(r.effect_cents!==expected)throw new Error('Tariff effect does not reconcile');
  }
 }
 return d;
}


export type DeliveryTrip={id:string;order:string;trip:string;arts:string[];status:string;shipped:string|null;planned:string|null;actual:string|null;issues:string[];tab:string;first_seen:string;last_seen:string;missing:boolean};
export type DeliveryChange={id:string;trip_id:string;order:string;observed_at:string;previous_seen:string;changes:Record<string,[string|null,string|null]>;status:string;conflict:boolean};
export type DeliveryTimeline={version:1;source_date:string;loaded_at:string;started_at:string;scope_from:string;observed_days:string[];rows:DeliveryTrip[];history:DeliveryChange[]};
export function validateDeliveryTimeline(s:DeliveryTimeline){
 const date=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 if(s.version!==1||!date(s.source_date)||moscowDay(s.loaded_at)!==s.source_date||!Number.isFinite(Date.parse(s.started_at)))throw new Error('Invalid delivery timeline');
 const keys=new Set<string>();for(const r of s.rows){
  if(keys.has(r.id)||r.id!==r.order+':'+r.trip||!/^\d+-\d+-\d+$/.test(r.order)||! /^(?:(?:НС|НМ|С|М)\d{2}-\d+)(?:\+(?:НС|НМ|С|М)\d{2}-\d+)*$|^БЕЗ-НОМЕРА$/.test(r.trip))throw new Error('Invalid delivery trip identity');keys.add(r.id);
  for(const d of [r.planned,r.actual,r.shipped])if(d!==null&&!date(d))throw new Error('Invalid delivery trip date');
  if(!Number.isFinite(Date.parse(r.last_seen))||r.last_seen>s.loaded_at)throw new Error('Invalid delivery observation');
 }
 const ids=new Set<string>();for(const h of s.history){if(ids.has(h.id)||!keys.has(h.trip_id)||!Number.isFinite(Date.parse(h.observed_at))||h.observed_at>s.loaded_at)throw new Error('Invalid delivery history');ids.add(h.id);}
 return s;
}
export function summarizeDeliveryTimeline(s:DeliveryTimeline|null|undefined,from:string,to:string){
 const terminal=(status:string)=>/отмен|возврат|вернули/i.test(status);
 const rows=(s?.rows??[]).map(r=>{
  const issues=[...r.issues],today=s!.source_date,closed=terminal(r.status);
  const conflict=r.issues.includes('source_conflict'),future=!!r.actual&&r.actual>today,beforeShip=!!r.actual&&!!r.shipped&&r.actual<r.shipped;
  if(future)issues.push('future_actual');if(beforeShip)issues.push('actual_before_ship');if(r.missing)issues.push('missing');
  const actual=!future&&!beforeShip&&!conflict&&!r.missing?r.actual:null;
  if(actual&&r.status==='Создан')issues.push('status_vs_actual');
  if(r.status==='Доставлен'&&!actual)issues.push('delivered_without_actual');
  const usable=!closed&&!conflict&&!r.missing;
  const late=usable&&actual&&r.planned?Math.max(0,Math.round((Date.parse(actual)-Date.parse(r.planned))/86400000)):null;
  const overdue=usable&&!actual&&r.status!=='Доставлен'&&r.planned&&r.planned<today?Math.round((Date.parse(today)-Date.parse(r.planned))/86400000):null;
  return {...r,issues,closed,confirmedActual:closed?null:actual,late,overdue};
 });
 const history=(s?.history??[]).filter(h=>{const d=moscowDay(h.observed_at);return d>=from&&d<=to;}).sort((a,b)=>b.observed_at.localeCompare(a.observed_at));
 const shifts=history.filter(h=>h.changes.planned?.[0]&&h.changes.planned?.[1]&&!h.conflict&&!terminal(h.status));
 const historyAvailable=!!s&&to>=moscowDay(s.started_at);
 return {rows,history,shifts,shiftCount:historyAvailable?shifts.length:null,
  overdue:rows.filter(r=>r.overdue!==null),late:rows.filter(r=>r.late!==null&&r.late>0),
  delivered:rows.filter(r=>r.confirmedActual!==null),review:rows.filter(r=>r.issues.length),
  excluded:rows.filter(r=>r.closed),stale:s?moscowDay(s.loaded_at)!==s.source_date:false};
}
