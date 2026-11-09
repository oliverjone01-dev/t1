// Pure weekly accounting shared by the browser and the private Google worker.
export const SNAPSHOT_TAB=1909260101, EVENT_TAB=1909260102;
export const SNAPSHOT_TITLE='План-факт · снимки', EVENT_TITLE='План-факт · события';
export const FIELDS=['title','owner','ownerNote','due','status','unit','comment','description','archived','importance','closedAt','archiveKind'];
export const day=at=>new Date(new Date(at).getTime()+10800000).toISOString().slice(0,10);
export function shift(date,n){return new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)}
export function weekOf(at){const d=day(at);return shift(d,-((new Date(d+'T12:00:00Z').getUTCDay()+6)%7))}
export const weekEnd=w=>shift(w,6);
export const isDone=t=>t?.status==='Готово';
export const isCancelled=t=>t?.status==='Отменено';
export const active=t=>t&&!t.archived&&!t.archiveKind&&!isDone(t)&&!isCancelled(t);
export const planned=(t,w)=>active(t)&&!!t.due&&t.due<=weekEnd(w);
export function normalize(record){const t=record.task||record;return {id:t.id,sourceId:t.sourceId||'',...Object.fromEntries(FIELDS.map(k=>[k,k==='archived'?!!record.archived:String(t[k]||'')]))}}
export function changes(before,after,observedAt,previousAt){
 const a=new Map(before.map(t=>[t.id,t])),b=new Map(after.map(t=>[t.id,t]));const result=[];
 for(const id of new Set([...a.keys(),...b.keys()])){const from=a.get(id)||null,to=b.get(id)||null;
 if(!from||!to||FIELDS.some(k=>from[k]!==to[k]))result.push({id,observedAt,previousAt,from,to});}
 return result;
}
export function account(week,baseline,current,events=[],{historical=false,quality='exact'}={}){
 const end=weekEnd(week),startAt=Date.parse(week+'T00:00:00+03:00'),endAt=Date.parse(shift(week,7)+'T00:00:00+03:00');
 const ids=new Set(baseline.filter(t=>planned(t,week)).map(t=>t.id));
 const original=new Map(baseline.map(t=>[t.id,t])),latest=new Map(current.map(t=>[t.id,t]));
 const inWeek=events.filter(e=>Date.parse(e.observedAt)>=startAt&&Date.parse(e.observedAt)<endAt);
 const observedDone=new Set(inWeek.filter(e=>e.to&&isDone(e.to)&&!isDone(e.from)&&Date.parse(e.previousAt)>=startAt).map(e=>e.id));
 const all=new Set([...ids,...current.filter(t=>!t.archived&&(historical||planned(t,week))).map(t=>t.id),...observedDone,...inWeek.filter(e=>e.to&&isCancelled(e.to)&&!isCancelled(e.from)).map(e=>e.id)]);
 const rows=[...all].map(id=>{const before=original.get(id),after=latest.get(id),t=after||before;const wasPlanned=ids.has(id);let outcome;
 if(historical)outcome='unknown';
 else if(!after||after.archived)outcome='removed';
 else if(isCancelled(after))outcome='cancelled';
 else if(isDone(after))outcome=observedDone.has(id)?'done':'unknown';
 else if(wasPlanned&&after.due>end)outcome='moved';else outcome='open';
 return {...t,planned:wasPlanned,originalOwner:before?.owner||'',originalDue:before?.due||'',outcome,extra:!wasPlanned};});
 const done=rows.filter(r=>r.planned&&r.outcome==='done').length;
 return {rows,planned:ids.size,done,percent:ids.size?Math.round(done/ids.size*100):null,extraDone:rows.filter(r=>!r.planned&&r.outcome==='done').length,cancelled:rows.filter(r=>r.outcome==='cancelled').length,quality,historical};
}
export function parseSnapshots(rows){
 const groups=new Map();for(const r of rows.slice(1)){if(!r[0])continue;const key=r[0]+'|'+r[1];let g=groups.get(key);if(!g)groups.set(key,g={week:r[0],kind:r[1],at:r[2],quality:r[3],tasks:[],committed:false});
 if(r[4]==='__meta__'){g.committed=true;g.note=r[5]||'';continue}
 try{const t=JSON.parse(r[6]);if(t.id!==r[4])throw Error();g.tasks.push(t)}catch{throw Error('Повреждён архив недели. Показ остановлен без подмены данных.')}}
 return [...groups.values()].filter(g=>g.committed);
}
export function parseEvents(rows){return rows.slice(1).filter(r=>r[0]).map(r=>{try{return {observedAt:r[0],previousAt:r[1],id:r[2],from:JSON.parse(r[4]),to:JSON.parse(r[5])}}catch{throw Error('Не удалось прочитать журнал изменений.')}})}
