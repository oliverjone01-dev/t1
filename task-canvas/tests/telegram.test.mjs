import test from 'node:test';
import assert from 'node:assert/strict';
import {extractTask,taskFromUpdate,appendRequests,processUpdates,GROUP_ID} from '../telegram/intake.mjs';
import {decodeSheet,SERVICE_HEADERS,TELEGRAM_TAB_ID} from '../public/sync-model.mjs';

const date=new Date('2026-11-09T22:00:00Z'); // 10 November in Moscow.
const config={chatId:GROUP_ID,startedAt:1700000000,botUsername:'tasks_bot'};
const update=(id=10,text='Подготовь каталог завтра')=>({update_id:id,message:{message_id:id,chat:{id:Number(GROUP_ID),type:'group'},from:{id:123,first_name:'Тест'},date:1800000000,text}});
function snapshot(){
 const text=v=>({formattedValue:v,userEnteredValue:{stringValue:v}});
 const headers=['ID','Юнит','Направление','Сцепка Задача','ID задачи/ ссылка','Постановщик','Задача','Ожидаемый результат','Статус','Коммент','Ответственный','Срок','Зависимости и уточнения','Дата и время сообщения','Основание из переписки','Источник / ссылки',...SERVICE_HEADERS];
 return decodeSheet({rows:[[],[],headers.map(text)],title:'Тест',rowCount:20});
}
test('ordinary Russian requests work without a marker, including polite forms',()=>{
 for(const text of ['Сделай макет','Подготовьте каталог','Нужно отправить каталог клиенту','Катя, пожалуйста, подготовь каталог','Можешь подготовить каталог?','Давайте обновить баннер'])assert.ok(extractTask(text),text);
 assert.equal(extractTask('Катя, подготовь каталог').owner,'Екатерина Машкова');
 assert.equal(extractTask('Женя, подготовь каталог').owner,'');
 assert.equal(extractTask('Подготовь каталог, пожалуйста').title,'Подготовь каталог, пожалуйста');
});
test('discussion, completed work, negation, quotes and conditional ideas are not tasks',()=>{
 for(const text of ['Сделал каталог','Не надо отправлять каталог','Нужно не отправлять каталог','Может быть, обновить каталог?','Если будет время, сделай каталог','Он написал: подготовь каталог','«Подготовь каталог»','Катя, каталог готов','Нужно ли обновить каталог?','Привет!'])assert.equal(extractTask(text),null,text);
});
test('dates use Moscow message time; invalid dates are not invented',()=>{
 assert.equal(extractTask('Подготовь каталог завтра',{date}).due,'2026-11-11');
 assert.equal(extractTask('Подготовь каталог сегодня',{date}).due,'2026-11-10');
 assert.equal(extractTask('Подготовь каталог до 15.12.2026',{date}).due,'2026-12-15');
 assert.equal(extractTask('Подготовь каталог до 31.02.2026',{date}).due,'');
});
test('optional command is scoped to this bot',()=>{
 assert.ok(extractTask('/task@tasks_bot Новый каталог',{botUsername:'tasks_bot'}));
 assert.equal(extractTask('/task@another_bot Новый каталог',{botUsername:'tasks_bot'}),null);
 assert.ok(extractTask('#задача Новый каталог'));
});
test('only new human messages from the pinned group are accepted',()=>{
 assert.ok(taskFromUpdate(update(),config));
 for(const change of [m=>m.chat.id=-1,m=>m.from.is_bot=true,m=>m.date=1,m=>delete m.date,m=>m.sender_chat={},m=>m.forward_origin={}]){
  const u=update();change(u.message);assert.equal(taskFromUpdate(u,config),null);
 }
 assert.equal(taskFromUpdate({update_id:10,edited_message:update().message},config),null);
});
test('appends one literal row in the existing schema and never patches a task',()=>{
 const s=snapshot(),task=taskFromUpdate(update(10,'/task =IMPORTXML("https://example.invalid")'),config);
 const requests=appendRequests(s,task);assert.equal(requests.length,1);
 const append=requests[0].appendCells,cells=append.rows[0].values;
 assert.equal(append.sheetId,TELEGRAM_TAB_ID);assert.equal(cells.length,22);
 assert.equal(cells[6].userEnteredValue.stringValue,task.title);
 assert.equal(cells[14].userEnteredValue.stringValue,task.telegramText);
 assert.equal(cells[18].userEnteredValue.stringValue,task.id);
 assert.equal(cells[5].userEnteredValue.stringValue,'Тест');
 assert.equal(cells[8].userEnteredValue.stringValue,'В ожидании');
 s.records.push({id:task.id,archived:true});assert.deepEqual(appendRequests(s,task),[]);
});
function harness(){
 let offset=0,pending=null;const sheet=snapshot(),writes=[];
 const h={config,state:{offset:()=>offset,setOffset:v=>offset=v,pending:()=>pending,setPending:v=>pending=structuredClone(v),clearPending:()=>pending=null},read:async()=>structuredClone(sheet),append:async requests=>{
  writes.push(requests);sheet.records.push({id:requests[0].appendCells.rows[0].values[18].userEnteredValue.stringValue});
 },sheet,writes};return h;
}
test('re-delivery and a fresh process append each Telegram message only once',async()=>{
 const h=harness();assert.deepEqual(await processUpdates([update(),update()],h),{added:1});
 h.state.setOffset(0);assert.deepEqual(await processUpdates([update()],h),{added:0});assert.equal(h.writes.length,1);
});
test('lost append response is recovered from the stable ID without rewriting',async()=>{
 const h=harness(),append=h.append;h.append=async r=>{await append(r);throw Error('timeout')};
 await assert.rejects(processUpdates([update()],h),/timeout/);assert.ok(h.state.pending());assert.equal(h.state.offset(),0);
 h.append=append;await processUpdates([update()],h);assert.equal(h.writes.length,1);assert.equal(h.state.pending(),null);assert.equal(h.state.offset(),11);
});
test('ambiguous failure retains the task and cursor, and blocks blind retry',async()=>{
 const h=harness();h.append=async()=>{throw Error('timeout')};
 await assert.rejects(processUpdates([update()],h),/timeout/);
 assert.equal(h.state.pending().task.description,'Подготовь каталог завтра');
 await assert.rejects(processUpdates([update(11)],h),/WRITE_UNCERTAIN/);assert.equal(h.state.offset(),0);assert.equal(h.writes.length,0);
});
test('wrong group and chatter are acknowledged without reading Sheets; deadline preserves cursor',async()=>{
 const h=harness();h.read=async()=>{throw Error('should not read')};
 const other=update();other.message.chat.id=999;
 await processUpdates([other,update(11,'Спасибо')],h);assert.equal(h.state.offset(),12);
 await processUpdates([update(12)],{...h,shouldStop:()=>true});assert.equal(h.state.offset(),12);
});
