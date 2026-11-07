import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeBoards,bootstrapBoard,decodeSheet,buildWriteRequests,SERVICE_HEADERS,TAB_ID} from '../public/sync-model.mjs';
import {SyncEngine} from '../public/sync-engine.mjs';
import {SheetsApi} from '../public/sheets-api.mjs';
const task={id:'sheet-1',sourceId:'1',title:'Исходная',owner:'Иван',due:'2026-11-09',status:'В работе',priority:null,positions:{}};
const board=(...tasks)=>({tasks,owners:[]});
const clone=v=>structuredClone(v);
function fixture() {
  const text=v=>({formattedValue:String(v),userEnteredValue:{stringValue:String(v)}});
  const header=['ID','Юнит','Направление','Сцепка Задача','ID задачи/ ссылка','Постановщик','Задача','Ожидаемый результат','Статус','Коммент','Ответственный','Срок','Зависимости и уточнения','Дата и время сообщения','Основание из переписки','Источник / ссылки',...SERVICE_HEADERS];
  const rows=[[],[],header.map(text),Array.from({length:22},()=>({}))];
  for(const [col,value] of [[0,'1'],[1,'ГГ / '],[2,'Направление'],[6,'Исходная'],[8,'В работе'],[10,'Иван'],[11,'09.11.2026'],[18,'sheet-1']])rows[3][col]=text(value);
  rows[3][3]={formattedValue:'ГГ / Направление',userEnteredValue:{formulaValue:'=B4&C4'}};
  rows[3][8].dataValidation={strict:true,condition:{type:'ONE_OF_LIST',values:['Готово','В ожидании','В работе','Отменено'].map(userEnteredValue=>({userEnteredValue}))}};
  return {rows,title:'Тест',rowCount:129};
}
test('different fields merge without overwriting the other device',()=>{
  const local={...task,owner:'Катя'},remote={...task,comment:'Правка таблицы'};
  const plan=mergeBoards(board(task),board(local),board(remote));
  assert.equal(plan.board.tasks[0].owner,'Катя');assert.equal(plan.board.tasks[0].comment,remote.comment);
  assert.deepEqual(plan.writes[0].fields,['owner']);assert.equal(plan.conflicts.length,0);
});
test('same-field conflict keeps both values and does not write that field',()=>{
  const plan=mergeBoards(board(task),board({...task,due:'2026-11-10'}),board({...task,due:'2026-11-12'}));
  assert.equal(plan.writes.length,0);assert.equal(plan.conflicts[0].field,'due');
  assert.equal(plan.conflicts[0].local,'2026-11-10');assert.equal(plan.conflicts[0].remote,'2026-11-12');
});
test('same value is idempotent; remote deletion and local archive are distinct',()=>{
  const changed={...task,title:'Новое'};
  assert.equal(mergeBoards(board(task),board(changed),board(changed)).writes.length,0);
  assert.equal(mergeBoards(board(task),board(task),board()).board.tasks.length,0);
  assert.equal(mergeBoards(board(task),board(),board(task)).writes[0].type,'archive');
  assert.equal(mergeBoards(board(task),board(changed),board()).conflicts[0].field,'task');
});
test('first connection keeps layout, takes live task fields and excludes demo cards',()=>{
  const local=board({...task,title:'Старый снимок',priority:'do',positions:{priority:{group:'do',x:24,y:96}}},{...task,id:'example-1'});
  const remote=board({...task,title:'Свежая таблица'});const result=bootstrapBoard(local,remote);
  assert.equal(result.tasks.length,1);assert.equal(result.tasks[0].title,'Свежая таблица');assert.equal(result.tasks[0].priority,'do');
});
test('sheet decoder respects stable IDs, original notes, native dates and archive',()=>{
  const input=fixture();input.rows[3][10]={formattedValue:''};input.rows[3][20]={formattedValue:'Иван — инициатор'};
  input.rows[3][11]={formattedValue:'11/9/2026',effectiveValue:{numberValue:46335},userEnteredFormat:{numberFormat:{type:'DATE'}}};
  const decoded=decodeSheet(input,2026);assert.equal(decoded.board.tasks[0].owner,'');assert.equal(decoded.board.tasks[0].ownerNote,'Иван — инициатор');
  assert.match(decoded.board.tasks[0].due,/^2026-/);
  input.rows[3][19]={formattedValue:'TRUE',effectiveValue:{boolValue:true}};assert.equal(decodeSheet(input).board.tasks.length,0);
});
test('invalid metadata and duplicate stable IDs stop the read instead of losing rows',()=>{
  const input=fixture();input.rows.push(clone(input.rows[3]));assert.throws(()=>decodeSheet(input),/повторяется/);
  const broken=fixture();broken.rows[3][17]={formattedValue:'{broken'};assert.throws(()=>decodeSheet(broken),/Повреждены позиции/);
});
test('patch touches exact cells and source backup; formula and validation are protected',()=>{
  const snapshot=decodeSheet(fixture());
  const requests=buildWriteRequests(snapshot,[{id:task.id,type:'patch',fields:['owner','priority'],task:{...task,owner:'Катя',priority:'do'}}],[]);
  assert.deepEqual(requests.map(r=>r.updateCells.start.columnIndex),[20,10,16]);
  assert.ok(requests.every(r=>r.updateCells.fields==='userEnteredValue'&&r.updateCells.start.sheetId===TAB_ID));
  const bad=decodeSheet(fixture());bad.records[0].cells[6].userEnteredValue={formulaValue:'=A4'};
  assert.throws(()=>buildWriteRequests(bad,[{id:task.id,type:'patch',fields:['title'],task}],[]),/формулу/);
  assert.throws(()=>buildWriteRequests(snapshot,[{id:task.id,type:'patch',fields:['status'],task:{...task,status:'Ошибка'}}],[]),/не разрешено/);
});
test('new cards append with stable ID and literal user text; deletion never deletes a row',()=>{
  const snapshot=decodeSheet(fixture());
  const append=buildWriteRequests(snapshot,[{id:'uuid',type:'upsert',task:{...task,id:'uuid',sourceId:'',title:'=IMPORTXML("evil")'}}],[])[0].appendCells;
  assert.equal(append.rows[0].values[6].userEnteredValue.stringValue,'=IMPORTXML("evil")');
  assert.equal(append.rows[0].values[18].userEnteredValue.stringValue,'uuid');
  assert.ok(append.rows[0].values[3].userEnteredValue.formulaValue.includes('ROW()'));
  const archive=buildWriteRequests(snapshot,[{id:task.id,type:'archive'}],[]);
  assert.equal(archive[0].updateCells.start.columnIndex,19);assert.equal(archive[0].updateCells.rows[0].values[0].userEnteredValue.boolValue,true);
});
function harness(initial,remote,cache=null) {
  let local=clone(initial), cloud=clone(remote), writes=0, status;
  const api={async read(){return {board:clone(cloud),records:[]}},async write(snapshot,changes,owners){writes++;for(const c of changes){cloud.tasks=cloud.tasks.filter(t=>t.id!==c.id);if(c.type!=='archive')cloud.tasks.push(clone(c.task));}cloud.owners=owners;}};
  const engine=new SyncEngine({api,getLocal:()=>local,apply:b=>local=clone(b),onState:s=>status=s,cache,schedule:()=>0,cancel:()=>{}});
  return {api,engine,get local(){return local},set local(v){local=v},get cloud(){return cloud},set cloud(v){cloud=v},get writes(){return writes},get status(){return status}};
}
test('a restored offline edit is sent, not replaced by first-connect bootstrap',async()=>{
  const h=harness(board({...task,owner:'Катя'}),board(task),{base:board(task),enabled:true});
  await h.engine.connect();assert.equal(h.cloud.tasks[0].owner,'Катя');assert.equal(h.status.status,'synced');
});
test('an edit during a request remains pending and is sent on the next sync',async()=>{
  const h=harness(board({...task,owner:'Катя'}),board(task),{base:board(task),enabled:true});
  const original=h.api.write;
  h.api.write=async(...args)=>{await original(...args);h.local=board({...h.local.tasks[0],comment:'Пока сохранялось'});};
  await h.engine.connect();assert.equal(h.local.tasks[0].comment,'Пока сохранялось');assert.equal(h.cloud.tasks[0].comment,'');assert.equal(h.status.status,'pending');
  h.api.write=original;await h.engine.flush();assert.equal(h.cloud.tasks[0].comment,'Пока сохранялось');
});
test('lost response retries by stable ID without duplicating the task',async()=>{
  const created={...task,id:'new-id'};const h=harness(board(created),board(),{base:board(),enabled:true});
  const write=h.api.write;h.api.write=async(...args)=>{await write(...args);throw new Error('Lost response');};
  await h.engine.connect();assert.equal(h.status.status,'offline');assert.equal(h.local.tasks.length,1);
  h.api.write=write;await h.engine.flush();assert.equal(h.cloud.tasks.length,1);assert.equal(h.writes,1);assert.equal(h.status.status,'synced');
});
test('conflict can be resolved explicitly in favor of Sheets or local',async()=>{
  const h=harness(board({...task,owner:'Катя'}),board({...task,owner:'Дима'}),{base:board(task),enabled:true});
  await h.engine.connect();assert.equal(h.status.status,'conflict');assert.equal(h.writes,0);
  h.engine.resolve({0:'remote'});await h.engine.flush();assert.equal(h.local.tasks[0].owner,'Дима');assert.equal(h.writes,0);
});
test('OAuth token never appears in the persisted engine snapshot',()=>{
  const h=harness(board(task),board(task));h.api.token='DO_NOT_PERSIST';assert.ok(!JSON.stringify(h.engine.snapshot()).includes('DO_NOT_PERSIST'));
});
test('expired login never sends a write and keeps the pending edit',async()=>{
  const h=harness(board({...task,title:'Офлайн'}),board(task),{base:board(task),enabled:true});
  h.api.read=async()=>{const e=new Error('Expired');e.auth=true;throw e;};
  await h.engine.connect();assert.equal(h.status.status,'signin');assert.equal(h.local.tasks[0].title,'Офлайн');assert.equal(h.writes,0);
});
test('Sheets API rejects a reordered first tab and never writes a different spreadsheet',async()=>{
  const api=new SheetsApi({getToken:()=> 'test'},async url=>({ok:true,json:async()=>({sheets:[{properties:{sheetId:99,index:0,gridProperties:{columnCount:22,rowCount:129}}}]})}));
  await assert.rejects(api.read(),/другая вкладка/);
});

test('default browser fetch is invoked without an adapter receiver',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=function(){assert.ok(this===undefined || this===globalThis);return Promise.resolve({ok:true,json:async()=>({ok:true})});};
  try {const api=new SheetsApi({getToken:()=> 'test'});assert.deepEqual(await api.request('?fields=spreadsheetId'),{ok:true});}
  finally {globalThis.fetch=original;}
});

test('default scheduling preserves the browser timer receiver',()=>{
  const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;
  globalThis.setTimeout=function(){assert.ok(this===undefined || this===globalThis);return 1;};
  globalThis.clearTimeout=function(){assert.ok(this===undefined || this===globalThis);};
  try {const engine=new SyncEngine({api:{},getLocal:()=>board(),apply:()=>{},onState:()=>{}});engine.connected=true;engine.later(20);}
  finally {globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});
test('invalid queue persists its warning and cannot overwrite pending work before explicit reset',async()=>{
  const h=harness(board({...task,title:'Ожидающая правка'}),board(task),{enabled:true,base:{tasks:'broken'}});
  await assert.rejects(h.engine.connect(),/повреждена/);assert.equal(h.local.tasks[0].title,'Ожидающая правка');assert.equal(h.writes,0);
  const restored=harness(h.local,board(task),h.engine.snapshot());await assert.rejects(restored.engine.connect(),/повреждена/);
  restored.engine.resetBaseline();assert.equal(restored.engine.cacheInvalid,false);assert.equal(restored.engine.base,null);
});
test('disconnect during a read stops the pipeline before any write',async()=>{
  const h=harness(board({...task,title:'Локально'}),board(task),{enabled:true,base:board(task)});let release;
  h.api.read=()=>new Promise(resolve=>release=resolve);const pending=h.engine.connect();h.engine.disconnect();release({board:board(task)});await pending;
  assert.equal(h.writes,0);assert.equal(h.local.tasks[0].title,'Локально');assert.equal(h.engine.lastReadAt,0);
});
test('a demo engine cannot read or write the shared source',async()=>{
  let reads=0,writes=0;const engine=new SyncEngine({readOnly:true,api:{read(){reads++;},write(){writes++;}},getLocal:()=>board(),apply:()=>{}});
  await assert.rejects(engine.connect(),/демонстрации/);engine.connected=true;await engine.flush();assert.equal(reads,0);assert.equal(writes,0);
});
test('write permission is rechecked after planning and before network transmission',async()=>{
  let calls=0;const api=new SheetsApi({getToken:()=> 'test'},()=>{calls++;},()=>{throw new Error('Другая вкладка изменила данные');});
  const snapshot=decodeSheet(fixture());await assert.rejects(api.write(snapshot,[{id:task.id,type:'patch',fields:['status'],task:{...task,status:'Готово'}}],[]),/Другая вкладка/);assert.equal(calls,0);
});

test('malformed conflict records cannot be restored as a writable queue',()=>{
  for(const conflicts of [{},[null],[{id:'x',field:'unknown',local:'bad'}],[{id:'x',field:'task',remote:{id:'another',title:'Bad'}}],[{id:'x',field:'due',remote:'2026-02-31'}]]) {
    const engine=new SyncEngine({api:null,getLocal:()=>({tasks:[],owners:[]}),apply:()=>{},cache:{base:{tasks:[],owners:[]},conflicts}});
    assert.equal(engine.cacheInvalid,true);
  }
});

test('a new card imported with compound owner is rejected before an API write plan is returned',()=>{
  const snapshot=decodeSheet(fixture());
  assert.throws(()=>buildWriteRequests(snapshot,[{id:'new',type:'upsert',task:{...task,id:'new',owner:'Иван и Софа'}}],[]),/одного ответственного/);
});

test('unknown or malformed queue envelopes never silently become a new baseline',()=>{
  for(const cache of [false,[],{},'broken',{base:[],version:99},{base:'',enabled:true},{base:null,conflicts:'broken'}]) {
    const h=harness(board({...task,title:'Pending'}),board(task),cache);
    assert.equal(h.engine.cacheInvalid,true);assert.equal(h.local.tasks[0].title,'Pending');assert.equal(h.writes,0);
  }
});

test('team ranks round-trip through Sheet service JSON and the protocol fence touches only R3',async()=>{
 const snapshot=fixture();snapshot.rows[2][17]={formattedValue:'Позиции · команда v3'};
 snapshot.rows[3][17]={formattedValue:JSON.stringify({priority:{group:'do',x:24,y:96,order:'a1V'}})};
 const decoded=decodeSheet(snapshot);
 assert.equal(decoded.records[0].task.positions.priority.order,'a1V');
 let sent;
 const api=new SheetsApi({getToken:()=> 'fixture-token'},async(url,request)=>{sent=JSON.parse(request.body);return {ok:true,json:async()=>({})}});
 await api.ensureTeamProtocol(fixture());
 assert.deepEqual(sent.requests[0].updateCells.range,{sheetId:TAB_ID,startRowIndex:2,endRowIndex:3,startColumnIndex:17,endColumnIndex:18});
 assert.equal(sent.requests[0].updateCells.fields,'userEnteredValue');
 sent=null;await api.ensureTeamProtocol(snapshot);assert.equal(sent,null);
});

test('structural equality ignores map key order at every depth but keeps meaningful array order',async()=>{
 const {equal}=await import('../public/sync-model.mjs');
 assert.equal(equal({b:2,a:{y:1,x:0}},{a:{x:0,y:1},b:2}),true);
 assert.equal(equal({a:undefined},{}),true);assert.equal(equal(null,undefined),true);
 assert.equal(equal([1,2],[2,1]),false);assert.equal(equal({a:null},{}),false);
 assert.equal(equal({positions:{priority:{group:'do',order:'a1V',x:24,y:96}}},{positions:{priority:{x:24,y:96,order:'a1V',group:'do'}}}),true);
});
