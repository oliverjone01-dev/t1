import test from 'node:test';
import assert from 'node:assert/strict';
import {taskClaim,isClaimCollision} from '../public/sheets-claims.mjs';
import {DirectSheetsApi} from '../public/sheets-api.mjs';
import {SyncEngine} from '../public/sync-engine.mjs';
import {TAB_ID,SERVICE_HEADERS,decodeSheet} from '../public/sync-model.mjs';
import {filterWeeklyRows,weeklyMetrics,weeklyError} from '../public/weekly-scope.mjs';
import {connectionAction} from '../public/sync-indicator.mjs';
import {fitGanttScale,ganttWindow} from '../public/gantt-model.mjs';

const rows=[
 {id:'a',title:'Письмо',owner:'Иван',unit:'ГМ',due:'2026-11-10',outcome:'overdue'},
 {id:'b',title:'Каталог',owner:'Катя',unit:'ГГ',due:'2026-11-14',outcome:'no-owner'},
 {id:'c',title:'Без срока',owner:'Иван',unit:'ГМ',due:'',outcome:'no-due'},
 {id:'d',title:'Не назначена',owner:'',unit:'ГГ',due:'2026-11-09',outcome:'no-owner'},
];
test('plan and decision metrics use the exact displayed owner/unit/search intersection',()=>{
 const selected=filterWeeklyRows(rows,{owner:'Иван',unit:'ГМ',query:'письмо'});
 assert.deepEqual(selected.map(t=>t.id),['a']);
 assert.deepEqual(weeklyMetrics('plan',selected,{today:'2026-11-13'}).map(m=>m[0]),[1,1,0,1]);
 assert.deepEqual(weeklyMetrics('decisions',selected,{today:'2026-11-13'}).map(m=>m[0]),[1,0,0,1]);
 assert.deepEqual(weeklyMetrics('decisions',filterWeeklyRows(rows,{unit:'ГГ'}),{today:'2026-11-13'}).map(m=>m[0]),[2,1,0,1]);
 assert.deepEqual(weeklyMetrics('plan',[],{today:'2026-11-13'}).map(m=>m[0]),[0,0,0,0]);
});
test('report search uses the displayed name and unknown fact never becomes zero',()=>{
 assert.equal(filterWeeklyRows([{...rows[0],owner:'42'}],{query:'раюшкин'},()=> 'Иван Раюшкин').length,1);
 assert.equal(weeklyMetrics('plan',[{owner:'Иван'},{owner:'Иван Раюшкин'}],{ownerName:()=> 'Иван Раюшкин'})[1][0],1);
 assert.deepEqual(weeklyMetrics('fact',[],{historical:true}).map(m=>m[0]),['—','—','—','—']);
 const scope=[{planned:true,outcome:'done'},{planned:true,outcome:'open'},{planned:false,outcome:'done'}];
 assert.deepEqual(weeklyMetrics('fact',scope).map(m=>m[0]),[2,1,'50%',1]);
});
test('network, timeout and malformed archive failures have useful Russian explanations',()=>{
 assert.match(weeklyError(new TypeError('Failed to fetch')),/Проверьте соединение/);
 assert.match(weeklyError({name:'AbortError'}),/не ответил вовремя/);
 assert.match(weeklyError(new SyntaxError('Unexpected token')),/неверный формат/);
 assert.equal(weeklyError(new Error('Повреждён архив недели.')),'Повреждён архив недели.');
});
test('connected network retries never request OAuth; genuine missing access still does',()=>{
 for(const status of ['offline','pending','syncing','synced'])assert.deepEqual(connectionAction({status},true),{retry:true,label:'Повторить синхронизацию'});
 assert.deepEqual(connectionAction({status:'data-error'},true),{retry:true,label:'Проверить таблицу'});
 for(const status of ['signin','access-denied','cache-error'])assert.equal(connectionAction({status},true).retry,false);
 assert.equal(connectionAction({status:'offline'},false).retry,false);
});
test('fit uses actual available width for full and collapsed labels, including leap-year windows',()=>{
 for(const width of [358,796,1200])for(const label of [56,120,330])if(width>label)for(const months of [1,3,6,12]){
  const days=ganttWindow('2028-01-01',months).days,scale=fitGanttScale(width,label,days);
  assert.ok(scale*days+label<=width,JSON.stringify({width,label,days,scale}));
  assert.ok(scale>0&&scale<=64);
 }
});
test('server create claims are deterministic, case sensitive and valid range names',async()=>{
 const a=(await taskClaim('id-A',TAB_ID)).addNamedRange.namedRange,b=(await taskClaim('id-A',TAB_ID)).addNamedRange.namedRange;
 assert.deepEqual(a,b);assert.notEqual(a.namedRangeId,(await taskClaim('id-a',TAB_ID)).addNamedRange.namedRange.namedRangeId);
 assert.match(a.name,/^_GENGROUP_TASK_[a-f0-9]{64}$/);assert.equal(a.range.sheetId,TAB_ID);
 assert.equal(isClaimCollision({status:400,message:'Invalid requests[0].addNamedRange: already exists'}),true);
 assert.equal(isClaimCollision({status:403,message:'already exists'}),false);
 await assert.rejects(taskClaim('a',TAB_ID,{}),/Правки остались/);
});

const text=v=>({formattedValue:String(v),userEnteredValue:{stringValue:String(v)}});
function server(){
 const header=['ID','Юнит','Направление','Сцепка Задача','ID задачи/ ссылка','Постановщик','Задача','Ожидаемый результат','Статус','Коммент','Ответственный','Срок','Зависимости и уточнения','Дата и время сообщения','Основание из переписки','Источник / ссылки',...SERVICE_HEADERS].map(text),grid=[[],[],header],claims=new Set();let requests=0;
 const read=()=>decodeSheet({rows:structuredClone(grid),sheetId:TAB_ID,rowCount:129});
 class Client extends DirectSheetsApi{
  async readStorageControl(){return {request:{mode:'sheets',epoch:'x'},ack:{mode:'sheets',epoch:'x'}}}
  async read(){return read()}
  async request(_,body){
   requests++;
   const names=body.requests.filter(r=>r.addNamedRange).map(r=>r.addNamedRange.namedRange.namedRangeId);
   if(names.some(id=>claims.has(id)))throw Object.assign(new Error('Invalid requests[0].addNamedRange: named range already exists'),{status:400});
   // Fake only the Google transport boundary: reject before any mutation.
   names.forEach(id=>claims.add(id));
   for(const r of body.requests){
    if(r.appendCells)for(const row of r.appendCells.rows)grid.push(structuredClone(row.values));
    if(r.updateCells){const u=r.updateCells;for(const [i,row]of u.rows.entries())for(const [j,c]of row.values.entries()){const y=u.start.rowIndex+i,x=u.start.columnIndex+j;grid[y]??=[];grid[y][x]=structuredClone(c)}}
   }
  }
 }
 return {Client,read,get rows(){return grid.length-3},get requests(){return requests}};
}
test('independent clients without Web Locks cannot append one task twice; rejected batch is not acknowledged',async()=>{
 const s=server(),snapshot=s.read(),task={id:'qa-concurrent',title:'Новая задача',status:'В ожидании',due:'2026-11-18'},write=[{id:task.id,type:'upsert',task}];
 const a=new s.Client({}),b=new s.Client({});
 const result=await Promise.allSettled([a.write(snapshot,write,[]),b.write(snapshot,write,[])]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(result.find(r=>r.status==='rejected').reason.retryMerge,true);
 assert.equal(s.rows,1);assert.equal(s.read().board.tasks[0].title,task.title);
});
test('one colliding task in a multi-task atomic batch retries the remainder instead of losing it',async()=>{
 const s=server(),snapshot=s.read(),a=new s.Client({}),task={id:'a',title:'A',status:'В ожидании'};
 await a.write(snapshot,[{id:'a',type:'upsert',task}],[]);
 await assert.rejects(a.write(snapshot,[{id:'a',type:'upsert',task},{id:'b',type:'upsert',task:{...task,id:'b',title:'B'}}],[]),e=>e.retryMerge===true);
 assert.equal(s.rows,1);
 await a.write(s.read(),[{id:'b',type:'upsert',task:{...task,id:'b',title:'B'}}],[]);
 assert.equal(s.rows,2);
});
test('the sync engine merges a server create collision without logout or marking it as offline',async()=>{
 const s=server(),task={id:'same',title:'Новая задача',status:'В ожидании'},make=()=>{
  let local={tasks:[task],owners:[]},states=[];const e=new SyncEngine({api:new s.Client({}),cache:{base:{tasks:[],owners:[]},enabled:true},getLocal:()=>local,apply:b=>local=b,onState:s=>states.push(s.status),withWriterLock:f=>f(),schedule:()=>0,cancel:()=>{}});
  return {e,states,get local(){return local}};
 };
 const a=make(),b=make();a.states.length=0;b.states.length=0;await Promise.all([a.e.connect(),b.e.connect()]);await b.e.flush();await a.e.flush();
 assert.equal(s.rows,1);assert.equal(a.e.connected,true);assert.equal(b.e.connected,true);
 assert.ok(!a.states.includes('offline')&&!b.states.includes('offline'));
 assert.ok(!a.states.includes('signin')&&!b.states.includes('signin'));
 assert.equal(a.local.tasks.length,1);assert.equal(b.local.tasks.length,1);
});
test('a lost create response is reconciled by ID and never repeats the append',async()=>{
 const s=server(),api=new s.Client({}),request=api.request.bind(api);let lose=true,local={tasks:[{id:'lost',title:'Ответ потерян',status:'В ожидании'}],owners:[]},status;
 api.request=async(...args)=>{await request(...args);if(lose){lose=false;throw new TypeError('Failed to fetch')}};
 const e=new SyncEngine({api,cache:{base:{tasks:[],owners:[]},enabled:true},getLocal:()=>local,apply:b=>local=b,onState:s=>status=s.status,schedule:()=>0,cancel:()=>{},withWriterLock:f=>f()});
 await e.connect();assert.equal(status,'offline');assert.equal(local.tasks.length,1);assert.equal(s.rows,1);
 await e.flush();assert.equal(status,'synced');assert.equal(s.requests,1);assert.equal(s.rows,1);
});
test('concurrent different contents for one new ID remain an explicit conflict',async()=>{
 const s=server(),make=title=>{let local={tasks:[{id:'conflicting-new',title,status:'В ожидании'}],owners:[]};return new SyncEngine({api:new s.Client({}),cache:{base:{tasks:[],owners:[]},enabled:true},getLocal:()=>local,apply:b=>local=b,onState:()=>{},withWriterLock:f=>f(),schedule:()=>0,cancel:()=>{}})};
 const a=make('Версия A'),b=make('Версия B');await Promise.all([a.connect(),b.connect()]);await a.flush();await b.flush();
 assert.equal(s.rows,1);assert.ok(a.conflicts.length||b.conflicts.length);assert.equal(s.read().board.tasks[0].title,'Версия A');
});
