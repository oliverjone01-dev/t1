import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../telegram/dist/Code.gs',import.meta.url),'utf8');
function harness(){
 let time=Date.parse('2026-11-09T13:00:00Z'),fail=false,done=false;const tables=new Map([[1909260101,[['Неделя']]],[1909260102,[['Обнаружено']]],[1909260103,[['Проверено']]]]);const p=new Map(),triggers=[];
 const values=r=>r.map(v=>({formattedValue:String(v??''),userEnteredValue:typeof v==='boolean'?{boolValue:v}:{stringValue:String(v??'')}}));
 const title={1909260101:'План-факт · снимки',1909260102:'План-факт · события',1909260103:'План-факт · состояние'};
 const meta={sheets:[{properties:{sheetId:1102202601,title:'Основные',index:0,gridProperties:{columnCount:22,rowCount:5}}},{properties:{sheetId:1478506234,title:'Telegram',index:1,gridProperties:{columnCount:22,rowCount:5}}},...Object.entries(title).map(([id,name],i)=>({properties:{sheetId:+id,title:name,index:i+2,gridProperties:{columnCount:8,rowCount:30000}}}))]};
 class Clock extends Date{constructor(...a){super(...(a.length?a:[time]))}static now(){return time}}
 const context=vm.createContext({Date:Clock,Intl,URLSearchParams,structuredClone,console:{log(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>p.get(k)||null,setProperty:(k,v)=>p.set(k,v),deleteProperty:k=>p.delete(k)})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},ScriptApp:{getOAuthToken:()=> 'test',getProjectTriggers:()=>triggers,newTrigger:handler=>({timeBased(){return this},everyMinutes(n){assert.equal(n,5);return this},create(){triggers.push({getHandlerFunction:()=>handler})}})},UrlFetchApp:{fetch(url,options){
 const u=new URL(url);let result=meta;
 if(options.method==='post'){
  const reqs=JSON.parse(options.payload).requests;for(const r of reqs){if(r.appendCells){const t=tables.get(r.appendCells.sheetId);for(const row of r.appendCells.rows)t.push(row.values.map(c=>c.userEnteredValue?.stringValue??''))}if(r.updateCells){const {range,rows}=r.updateCells,t=tables.get(range.sheetId);rows.forEach((r,i)=>t[range.startRowIndex+i]=r.values.map(c=>c.userEnteredValue?.stringValue??''));}}
  if(fail){fail=false;throw Error('Lost reply')}result={};
 }else if(u.searchParams.has('ranges')){
  const range=u.searchParams.get('ranges');let rows;
  if(range.startsWith("'Основные'")){const h=Array(22).fill('');h[0]='ID';h[2]='Направление';h[6]='Задача';h[8]='Статус';h[10]='Ответственный';h[11]='Срок';h.splice(16,6,'Приоритет · доска','Позиции · доска','ID карточки','Архив · доска','Ответственный · источник','Срок · источник');const t=Array(22).fill('');t[0]='1';t[6]='Рабочая задача';t[8]=done?'Готово':'В работе';t[10]='Иван';t[11]='12.11.2026';t[13]='02.11.2026 11:35';t[18]='sheet-1';rows=[[],[],h,t]}
  else if(range.startsWith("'Telegram'")){const h=Array(22).fill('');h[0]='ID';h[2]='Направление';h[6]='Задача';h[8]='Статус';h[10]='Ответственный';h[11]='Срок';h.splice(16,6,'Приоритет · доска','Позиции · доска','ID карточки','Архив · доска','Ответственный · источник','Срок · источник');rows=[[],[],h]}
  else{const id=+Object.keys(title).find(id=>range.includes(title[id]));rows=tables.get(id)}
  result={sheets:[{data:[{startRow:0,rowData:rows.map(r=>({values:values(r)}))}]}]};
 }
 return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(result)};
 }}});vm.runInContext(code,context);
 return {context,tables,triggers,fail:()=>fail=true,advance:()=>time+=300000,done:()=>done=true};
}
test('weekly worker commits snapshots, events and cursor atomically; lost reply does not duplicate',async()=>{
 const h=harness();h.fail();await assert.rejects(h.context.startWeeklyReports(),/WEEKLY_NETWORK/);assert.equal(h.tables.get(1909260103).length,3);
 await h.context.startWeeklyReports();assert.equal(h.triggers.length,1);const snaps=h.tables.get(1909260101).length;
 await h.context.startWeeklyReports();assert.equal(h.tables.get(1909260101).length,snaps);assert.equal(h.triggers.length,1);
 h.advance();h.done();h.fail();await assert.rejects(h.context.pollWeeklyReports());const events=h.tables.get(1909260102).length;assert.equal(events,2);
 h.advance();await h.context.pollWeeklyReports();assert.equal(h.tables.get(1909260102).length,events);assert.equal((await h.context.checkWeeklyReports()).error,null);
});
