import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {atomicText,readRows} from './collector-integrity.js';

export function ratingRows(defects:any, summary:any, thresholds:any, snap:string, ts:string){
 const r=defects.result;
 if(!r||!Array.isArray(r.defects)||!Array.isArray(summary.ratings)||!Array.isArray(thresholds.thresholds))throw new Error('Rating source contract');
 const seen=new Set<string>();
 const daily=r.defects.map((x:any)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||seen.has(x.date)||x.date<r.calculation_period_start||x.date>r.calculation_period_end)throw new Error('Rating date/duplicate');
  seen.add(x.date);
  if(typeof x.indicator_value_by_date!=='number'||x.indicator_value_by_date<0||x.indicator_value_by_date>1||!Number.isFinite(x.indicator_value_by_date)||typeof x.charge_price_sum_by_date!=='number'||!Number.isFinite(x.charge_price_sum_by_date))throw new Error('Rating value');
  return {date:x.date,defect_index:x.indicator_value_by_date,charge_rub:x.charge_price_sum_by_date,level:x.date===snap?thresholds.value?.status??null:null,window_start:r.calculation_period_start,window_end:r.calculation_period_end,snap,ts};
 });
 const sum=daily.reduce((s:number,x:any)=>s+x.charge_rub,0);
 if(Math.abs(sum-r.charge_price_sum)>.011)throw new Error('Rating charge sum mismatch');
 const ratings=summary.ratings.map((x:any)=>({date:snap,rating:x.rating,name:x.name,value:x.current_value,status:x.status,warning:x.warning_threshold??null,ban:x.ban_threshold??null,value_type:x.value_type,snap,ts}));
 if(new Set(ratings.map((x:any)=>x.rating)).size!==ratings.length)throw new Error('Duplicate summary rating');
 return {daily,ratings,thresholds:{date:snap,ts,rows:thresholds.thresholds}};
}
export function mergeRatingRows(old:any[],fresh:any[],key:(r:any)=>string){
 const m=new Map(old.map(r=>[key(r),r]));
 for(const r of fresh){const p=m.get(key(r));if(!p||String(r.ts)>=String(p.ts))m.set(key(r),r);}
 return [...m.values()].sort((a,b)=>key(a).localeCompare(key(b)));
}
export function importRating(dir:string,snap:string,out='data'){
 const load=(kind:string)=>JSON.parse(readFileSync(join(dir,`${kind}_${snap}.json`),'utf8'));
 const rows=ratingRows(load('rating_defects'),load('rating_summary'),load('rating_thresholds'),snap,new Date().toISOString());
 for(const [file,rowsNew,key]of [['rating_daily.ndjson',rows.daily,(r:any)=>r.date],['rating_summary.ndjson',rows.ratings,(r:any)=>r.date+':'+r.rating]] as const){
  const p=join(out,file);atomicText(p,mergeRatingRows(readRows<any>(p),rowsNew,key).map(r=>JSON.stringify(r)).join('\n')+'\n');
 }
 const path=join(out,'rating_thresholds.json');
 if(!existsSync(path)||JSON.parse(readFileSync(path,'utf8')).date<=snap)atomicText(path,JSON.stringify(rows.thresholds)+'\n');
}
if(process.argv[1]?.endsWith('/import-problems-rating.ts')){
 if(!process.argv[2]||!/^\d{4}-\d{2}-\d{2}$/.test(process.argv[3]??''))throw new Error('Usage: import-problems-rating.ts RAW_DIR SNAP_DATE [OUT_DIR]');
 importRating(process.argv[2],process.argv[3],process.argv[4]);
}
