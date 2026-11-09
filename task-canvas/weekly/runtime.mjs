import {SheetsApi} from '../public/sheets-api.mjs';
import {SHEET_ID} from '../public/sync-model.mjs';
import {SNAPSHOT_TAB,EVENT_TAB,SNAPSHOT_TITLE,EVENT_TITLE,normalize,changes,weekOf,shift,day} from '../public/weekly-model.mjs';
const STATE_TAB=1909260103, STATE_TITLE='План-факт · состояние';
const HEADERS={ [STATE_TAB]:['Проверено','Неделя','ID задачи','Снимок задачи JSON'], [SNAPSHOT_TAB]:['Неделя','Тип','Зафиксировано','Качество','ID задачи','Задача / примечание','Снимок задачи JSON'],[EVENT_TAB]:['Обнаружено','Предыдущая проверка','ID задачи','Изменение','До JSON','После JSON']};
const props=()=>PropertiesService.getScriptProperties();
class Api extends SheetsApi{
 constructor(){super({})}
 async request(path,body){if(!path.startsWith('?')&&path!==':batchUpdate')throw Error('WEEKLY_PATH');
 let r;try{r=UrlFetchApp.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`,{method:body?'post':'get',headers:{Authorization:`Bearer ${ScriptApp.getOAuthToken()}`},...(body?{contentType:'application/json',payload:JSON.stringify(body)}:{}),muteHttpExceptions:true,followRedirects:false})}catch{throw Error('WEEKLY_NETWORK')}
 if(r.getResponseCode()<200||r.getResponseCode()>299)throw Error('WEEKLY_HTTP_'+r.getResponseCode());return JSON.parse(r.getContentText());}
}
const cell=v=>({userEnteredValue:{stringValue:String(v??'')}});
const append=(sheetId,rows)=>({appendCells:{sheetId,rows:rows.map(v=>({values:v.map(cell)})),fields:'userEnteredValue'}});
async function lock(fn){const l=LockService.getScriptLock();if(!l.tryLock(1000))return {busy:true};try{return await fn()}finally{l.releaseLock()}}
async function ensure(api){const m=await api.request('?fields=sheets(properties)');const requests=[];
 for(const [id,title] of [[SNAPSHOT_TAB,SNAPSHOT_TITLE],[EVENT_TAB,EVENT_TITLE],[STATE_TAB,STATE_TITLE]]){const old=m.sheets.find(s=>s.properties.sheetId===id);if(old&&old.properties.gridProperties.rowCount>30000)throw Error('WEEKLY_CAPACITY');if(old&&old.properties.title!==title)throw Error('WEEKLY_TAB_ID_COLLISION');if(!old){requests.push({addSheet:{properties:{sheetId:id,title,gridProperties:{rowCount:30000,columnCount:8,frozenRowCount:1}}}},{updateCells:{start:{sheetId:id,rowIndex:0,columnIndex:0},rows:[{values:HEADERS[id].map(cell)}],fields:'userEnteredValue'}})}}
 if(requests.length)await api.request(':batchUpdate',{requests});
}
async function readRows(api,id){const r=await api.request('?'+new URLSearchParams({ranges:`'${id===SNAPSHOT_TAB?SNAPSHOT_TITLE:id===EVENT_TAB?EVENT_TITLE:STATE_TITLE}'!A1:G30000`,fields:'sheets(data(rowData(values(formattedValue))))'}));return (r.sheets?.[0]?.data?.[0]?.rowData||[]).map(r=>(r.values||[]).map(c=>c.formattedValue||''))}
function pack(week,kind,at,quality,tasks,note=''){return [...tasks.map(t=>[week,kind,at,quality,t.id,t.title,JSON.stringify(t)]),[week,kind,at,quality,'__meta__',note,'']]}
async function tickImpl(){const api=new Api();await ensure(api);const snapshot=await api.read(),at=new Date().toISOString(),week=weekOf(at),tasks=snapshot.records.map(normalize);const stateRows=await readRows(api,STATE_TAB);const previous=stateRows[1]?.[0]?{at:stateRows[1][0],week:stateRows[1][1],tasks:stateRows.slice(2).filter(r=>r[2]).map(r=>JSON.parse(r[3]))}:null;
 // The sheet is the commit log: an uncertain reply is reconciled before any retry.
 const old=await readRows(api,SNAPSHOT_TAB),eventRows=await readRows(api,EVENT_TAB);const seen=new Set(old.filter(r=>r[4]==='__meta__').map(r=>r[0]+'|'+r[1]));const seenEvents=new Set(eventRows.slice(1).map(r=>r[0]+'|'+r[2]));
 const requests=[],initial=!previous;
 const prior=shift(week,-7);const historicalTasks=snapshot.records.filter(r=>{const source=r.cells?.[13]?.formattedValue||r.cells?.[13]?.userEnteredValue?.stringValue||'';const dates=[...String(source).matchAll(/(\d{2})[.](\d{2})[.](\d{4})/g)].map(m=>`${m[3]}-${m[2]}-${m[1]}`);return !r.archived&&(dates.some(d=>d>=prior&&d<week)||(r.task.due&&r.task.due>=prior&&r.task.due<week))}).map(normalize);
 if(initial&&!seen.has(shift(week,-7)+'|reconstructed'))requests.push(append(SNAPSHOT_TAB,pack(shift(week,-7),'reconstructed',at,'unknown',historicalTasks,'Первый сбор после завершения недели. Статусы на дату сбора; исходный план и даты выполнения не подтверждены.')));
 const local=new Date(Date.now()+10800000),ready=local.getUTCDay()!==1||local.getUTCHours()*60+local.getUTCMinutes()>=585;
 if(ready&&!seen.has(week+'|plan'))requests.push(append(SNAPSHOT_TAB,pack(week,'plan',at,day(at)===week&&local.getUTCHours()<10?'exact':'late',tasks,'План фиксируется по задачам со сроком до конца недели, включая просроченные. Задачи без срока остаются в списке для решения.')));
 if(previous){const diffs=changes(previous.tasks,tasks,at,previous.at);const rows=diffs.filter(e=>!seenEvents.has(at+'|'+e.id)).map(e=>[at,previous.at,e.id,!e.from?'Добавлена':!e.to?'Удалена':Object.keys(e.to).filter(k=>e.from[k]!==e.to[k]).join(', '),JSON.stringify(e.from),JSON.stringify(e.to)]);if(rows.length)requests.push(append(EVENT_TAB,rows));
 // Only observed states before Sunday midnight are eligible for the closing fact.
 if(week!==previous.week&&ready){let w=previous.week;while(w<week){if(!seen.has(w+'|fact')){const end=shift(w,7)+'T00:00:00+03:00',cut=Date.parse(end);const history=eventRows.slice(1).filter(r=>Date.parse(r[0])>=cut).map(r=>({id:r[2],from:JSON.parse(r[4]),to:JSON.parse(r[5])}));let endTasks=new Map(previous.tasks.map(t=>[t.id,t]));for(const e of history.reverse()){if(e.from)endTasks.set(e.id,e.from);else endTasks.delete(e.id)}requests.push(append(SNAPSHOT_TAB,pack(w,'fact',at,Date.parse(at)-Date.parse(previous.at)>900000?'gap':'observed',[...endTasks.values()],'Факт по состоянию, наблюдавшемуся до конца воскресенья. Даты изменений — время обнаружения, не точное время правки.')))}w=shift(w,7)}}
 }
 const stateValues=[[at,ready?week:(previous?.week||week),'__meta__',''],...tasks.map(t=>[at,week,t.id,JSON.stringify(t)])];
 const height=Math.max(stateValues.length,stateRows.length-1);while(stateValues.length<height)stateValues.push(['','','','']);
 requests.push({updateCells:{range:{sheetId:STATE_TAB,startRowIndex:1,endRowIndex:1+height,startColumnIndex:0,endColumnIndex:4},rows:stateValues.map(r=>({values:r.map(cell)})),fields:'userEnteredValue'}});
 await api.request(':batchUpdate',{requests});
 props().setProperty('WEEKLY_LAST_OK',at);props().deleteProperty('WEEKLY_LAST_ERROR');return {enabled:props().getProperty('WEEKLY_ENABLED')==='true',at,tasks:tasks.length,writes:requests.length};}
export async function initialize(){return lock(async()=>{await ensure(new Api());return tickImpl()})}
export async function start(){return lock(async()=>{const result=await tickImpl();if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='pollWeeklyReports'))ScriptApp.newTrigger('pollWeeklyReports').timeBased().everyMinutes(5).create();props().setProperty('WEEKLY_ENABLED','true');return {...result,enabled:true}})}
export async function poll(){if(props().getProperty('WEEKLY_ENABLED')!=='true')return {enabled:false};return lock(async()=>{try{return await tickImpl()}catch(e){const code=/^WEEKLY_[A-Z_0-9]+$/.test(e.message)?e.message:'WEEKLY_FAILED';props().setProperty('WEEKLY_LAST_ERROR',code);throw Error(code)}})}
export function check(){return {enabled:props().getProperty('WEEKLY_ENABLED')==='true',lastSuccess:props().getProperty('WEEKLY_LAST_OK'),error:props().getProperty('WEEKLY_LAST_ERROR'),triggers:ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='pollWeeklyReports').length}}
