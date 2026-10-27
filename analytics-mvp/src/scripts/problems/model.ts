export type Posting={order:string;date:string;status:string;scheme:string;offer:string;sku:string;amount:number|null;reason:string|null;initiator:string|null};
export type Kind='fine'|'return'|'deliveryLoss'|'lateShip'|'shift'|'lateDelivery'|'defectCharge';
export type Event={id:string;date:string;kind:Kind;order:string|null;offer:string;scheme:string;reason:string;amount:number|null;qty?:number|null;days?:number|null;source:string};
export type Coverage={days:string[];loaded_at:string|null;note:string};
export type ProblemData={now:string;postings:Posting[];events:Event[];ratings:any[];summary:any[];thresholds:any;coverage:Record<string,Coverage>;warnings:string[]};

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
 const cover=(name:string)=>{const c=data.coverage[name],n=ds.filter(d=>c?.days.includes(d)).length;return {n,total:ds.length,full:!!ds.length&&n===ds.length,note:c?.note??'Источник ещё не загружен'};};
 const kinds=['fine','return','deliveryLoss','lateShip','shift','lateDelivery','defectCharge'] as Kind[];
 const metrics=Object.fromEntries(kinds.map(k=>{const rows=events.filter(e=>e.kind===k),c=cover(k),known=rows.filter(r=>r.amount!==null);return [k,{count:rows.length||c.full?rows.length:null,units:k==='return'?(rows.length?rows.reduce((s,r)=>s+(r.qty??0),0):c.full?0:null):null,sum:known.length?Math.round(known.reduce((s,r)=>s+r.amount!,0)*100)/100:c.full&&rows.length===0?0:null,unknownAmount:rows.length-known.length,rows,coverage:c}];}));
 const reasons:Record<string,number>={};for(const p of cancelled){const label=p.initiator==='seller'?'Мы':p.initiator==='client'||p.initiator==='buyer'?'Покупатель':p.initiator==='ozon'?'Ozon':'Не указан';reasons[label]=(reasons[label]??0)+1;}
 const rating=data.ratings.filter(r=>inside(r.date)).sort((a,b)=>a.date.localeCompare(b.date)).at(-1)??null;
 const summaryDates=data.summary.filter(r=>r.date<=to).map(r=>r.date).sort(),summaryDate=summaryDates.at(-1);
 const summary=data.summary.filter(r=>r.date===summaryDate);
 const ratingRows=data.ratings.filter(r=>inside(r.date)),ratingCoverage=ds.filter(d=>ratingRows.some(r=>r.date===d)).length;
 const cancellationCoverage=cover('postings'), knownCancelled=cancelled.filter(p=>p.amount!==null);
 const cancellation={count:cancelled.length||cancellationCoverage.full?cancelled.length:null,base:posts.length,rate:posts.length?cancelled.length/posts.length:null,sum:knownCancelled.length?Math.round(knownCancelled.reduce((s,p)=>s+p.amount!,0)*100)/100:cancellationCoverage.full&&cancelled.length===0?0:null,coverage:cancellationCoverage,unknownAmount:cancelled.length-knownCancelled.length};
 const table=[...cancelled.map(p=>({id:'cancel:'+p.order,date:p.date,kind:'cancel',order:p.order,offer:p.offer,scheme:p.scheme,reason:[p.initiator,p.reason].filter(Boolean).join(' · ')||'Причина ещё не загружена',amount:p.amount,source:'Seller API · когорта создания'})),...events].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 return {dates:ds,cancellation,reasons,metrics,table,rating,ratingRows,ratingCoverage,summary,summaryDate,partial:to>=moscowDay(data.now)};
}
export function validateProblems(d:ProblemData){
 const unique=(rows:any[],key:(r:any)=>string)=>{const seen=new Set<string>();for(const r of rows){const k=key(r);if(!k||seen.has(k))throw new Error('Problems duplicate/empty key '+k);seen.add(k);}};
 unique(d.postings,r=>r.order);unique(d.events,r=>r.id);unique(d.ratings,r=>r.date);unique(d.summary,r=>r.date+':'+r.rating);
 for(const r of [...d.postings,...d.events,...d.ratings])if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date)))throw new Error('Problems invalid date');
 for(const r of d.ratings)if(r.defect_index!==null&&(!Number.isFinite(r.defect_index)||r.defect_index<0||r.defect_index>1))throw new Error('Problems invalid ratio');
 if(d.thresholds)for(const r of d.thresholds.rows)if(!(r.begin<r.end)||[r.begin,r.end,r.cancellations,r.shipmentDelay,r.cancellationNonInt].some(v=>!Number.isFinite(v)||v<0))throw new Error('Problems invalid thresholds');
 const walk=(v:any)=>{if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Problems nonfinite');if(v&&typeof v==='object')for(const x of Object.values(v))walk(x);};walk(d);
 return d;
}
