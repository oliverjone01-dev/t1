import {SHEET_ID,TAB_ID,TELEGRAM_TAB_ID,decodeSheet,combineSheets} from './sync-model.mjs?rev=20261109-weekly-1';
import {readModeControl} from './storage-mode.mjs?rev=20261109-weekly-1';
// CSV export retains minority cell types, blank rows, multiline text and literal
// JSON. Visualization queries infer column types and can silently drop values.
export function parseCsv(text){
 if(typeof text!=='string'||text.length>5000000||/^\s*</.test(text))throw new Error('Google Таблица не предоставила данные для просмотра.');
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=c;continue}
  if(c==='"'){if(cell||closed)throw new Error('Повреждён CSV таблицы.');quoted=true;continue}
  if(c===','||c==='\n'||c==='\r'){
   row.push(cell);cell='';closed=false;
   if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;rows.push(row);row=[];if(rows.length>2500)throw new Error('Таблица больше 2500 строк; данные не усечены.')}
   continue;
  }
  if(closed)throw new Error('Повреждён CSV таблицы.');cell+=c;
 }
 if(quoted)throw new Error('Незавершённая ячейка CSV.');
 if(row.length||cell||closed) {row.push(cell);rows.push(row)}
 if(rows.length>2500)throw new Error('Таблица больше 2500 строк; данные не усечены.');
 return rows;
}
export class PublicSheetsApi {
 constructor(fetcher=(...args)=>fetch(...args)){this.fetcher=fetcher}
 async control(){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{
   const r=await this.fetcher(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${TAB_ID}&range=Q2:R2&_=${Date.now()}`,{credentials:'omit',cache:'no-store',signal:controller.signal});
   if(!r.ok)throw new Error('Не удалось проверить режим хранения.');
   const raw=parseCsv(await r.text()),rows=[[],[]];for(const [i,formattedValue] of (raw[0]||[]).entries())rows[1][16+i]={formattedValue};return readModeControl(rows);
  }finally{clearTimeout(timer)}
 }
 async read(){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{
   const snapshots=await Promise.all([TAB_ID,TELEGRAM_TAB_ID].map(async sheetId=>{
   const r=await this.fetcher(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${sheetId}&_=${Date.now()}`,{credentials:'omit',cache:'no-store',signal:controller.signal});
   if(!r.ok)throw new Error('Таблица недоступна по ссылке. Показана последняя подтверждённая копия.');
   const strings=parseCsv(await r.text()),rows=strings.map(row=>row.map(formattedValue=>({formattedValue})));
   return decodeSheet({rows,sheetId,title:sheetId===TAB_ID?'Основные задачи':'Новые задачи · Telegram',rowCount:rows.length});
   }));
   const snapshot=combineSheets(...snapshots);
   return {...snapshot,control:readModeControl(snapshots[0].rows),checkedAt:Date.now()};
  }finally{clearTimeout(timer)}
 }
}
export class SheetViewer {
 constructor({api=new PublicSheetsApi(),onData,onState,onControl=()=>{},initial=null,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=t=>clearTimeout(t)}){Object.assign(this,{api,onData,onState,onControl,initial,schedule,cancel});this.generation=0;this.running=false;this.busy=false}
 async start(){this.stop();this.running=true;this.onState({status:'view-loading'});return this.poll()}
 stop(){this.generation++;this.running=false;this.cancel(this.timer)}
 async poll(){
  if(!this.running||this.busy)return;this.busy=true;const gen=this.generation;
  try{
   const value=this.initial||await this.api.read();this.initial=null;if(gen!==this.generation)return;
   this.onControl(value.control);
   this.onData(value.board,{fromCache:false,source:{status:'synced',checkedAt:value.checkedAt}});
   this.onState({status:'view-live',source:{status:'synced',checkedAt:value.checkedAt},background:{provider:'sheets-direct'}});
  }catch(error){if(gen===this.generation)this.onState({status:'view-error',message:error.message})}
  finally{this.busy=false;if(this.running&&gen===this.generation)this.timer=this.schedule(()=>this.poll(),30000)}
 }
}
