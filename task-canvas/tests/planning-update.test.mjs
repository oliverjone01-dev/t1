import test from 'node:test';import assert from 'node:assert/strict';
import {parseCreatedAt,createdDay,overlapsRange} from '../public/task-dates.mjs';
import {periodRange,shiftRange,parseRangeDate} from '../public/range-model.mjs';
import {validateBoard,QUADRANTS} from '../public/model.mjs';
import {planEdit,EDIT_FIELDS} from '../public/editor.mjs';
import {decodeSheet,SERVICE_HEADERS,buildWriteRequests,mergeBoards} from '../public/sync-model.mjs';
import {registryMatch} from '../public/task-signals.mjs';
import {dayTasks,monthSummary} from '../public/calendar-model.mjs';
import {planned} from '../public/weekly-model.mjs';
const cell=v=>({formattedValue:String(v),userEnteredValue:{stringValue:String(v)}});
const fixture=(date='')=>({sheetId:1102202601,rows:[[],[],['ID','Юнит','Направление','Сцепка Задача','ID задачи/ ссылка','Постановщик','Задача','Ожидаемый результат','Статус','Коммент','Ответственный','Срок','Зависимости и уточнения','Дата постановки','Основание из переписки','Источник / ссылки',...SERVICE_HEADERS].map(cell),Array.from({length:22},(_,i)=>cell(({0:'1',6:'Тест',8:'В работе',11:'10.11.2026',13:date,18:'sheet-1'})[i]||''))]});
test('creation timestamps preserve source precision, Moscow day and earliest source message without inventing history',()=>{
 assert.equal(parseCreatedAt('2026-11-09T22:03:56.000Z'),'2026-11-09T22:03:56.000Z');assert.equal(createdDay('2026-11-09T22:03:56.000Z'),'2026-11-10');
 assert.equal(parseCreatedAt('21.10.2026 13:29; 02.11.2026 11:35'),'2026-10-21T10:29:00.000Z');assert.equal(parseCreatedAt('10.11.2026'),'2026-11-10');assert.equal(parseCreatedAt(''),'');assert.equal(parseCreatedAt('31.02.2026 09:00'),'');assert.equal(parseCreatedAt('вчера'),'');
 assert.equal(parseCreatedAt('',{effectiveValue:{numberValue:46336},userEnteredFormat:{numberFormat:{type:'DATE'}}}),'2026-11-10');
});
test('source date roundtrips N in existing 22 columns and independent edits do not overwrite original messages',()=>{
 const s=decodeSheet(fixture('02.11.2026 11:35')),t=s.board.tasks[0];assert.equal(t.createdAt,'2026-11-02T08:35:00.000Z');
 const append=buildWriteRequests(s,[{type:'upsert',id:'new',task:{...t,id:'new'}}],[])[0].appendCells.rows[0].values;assert.equal(append.length,22);assert.equal(append[13].userEnteredValue.stringValue,t.createdAt);
 const b={tasks:[t],owners:[]},local={tasks:[{...t,comment:'Local'}],owners:[]},remote={tasks:[{...t,createdAt:'2026-11-01'}],owners:[]},m=mergeBoards(b,local,remote);assert.equal(m.board.tasks[0].createdAt,'2026-11-01');assert.deepEqual(m.writes[0].fields,['comment']);
 const requests=buildWriteRequests(s,m.writes,[]);assert(requests.every(r=>r.updateCells.start.columnIndex!==13));
 assert.equal(decodeSheet(fixture()).board.tasks[0].createdAt,'');
});
test('new and duplicated tasks get their own timestamp while existing date cannot be edited through a stale form',()=>{
 const now=()=> '2026-11-10T08:00:00.000Z',values={title:'Создать',status:'В ожидании'};
 const n=planEdit({tasks:[],values,createId:()=> 'new',now});assert.equal(n.task.createdAt,now());assert(!EDIT_FIELDS.includes('createdAt'));
 const u=planEdit({tasks:[n.task],id:'new',base:n.task,values:{...n.task,title:'Изменить',createdAt:'2020-01-01'},createId:()=> 'unused',now});assert.equal(u.task.createdAt,now());
 assert.throws(()=>validateBoard([{id:'x',title:'x',createdAt:'2026-02-30'}]),/постановки/);
});
test('range intersection includes enclosing intervals and boundaries but ignores creation date and unknown schedules',()=>{
 const from='2026-11-09',to='2026-11-15';
 for(const task of [{start:'2026-11-01',due:'2026-11-30'},{due:from},{start:to},{createdAt:'2020-01-01',start:'2026-11-10',due:'2026-11-12'}])assert(overlapsRange(task,from,to));
 for(const task of [{createdAt:from},{start:'2026-11-08'},{due:'2026-11-16'},{}])assert(!overlapsRange(task,from,to));
 const t={id:'a',title:'a',start:'2026-10-31',due:'2026-11-02',status:'Готово',archiveKind:'done'};assert(registryMatch(t,{from:'2026-11-01',to:'2026-11-10',archive:'status:Готово',hideDone:true}));assert(!registryMatch(t,{from:'2026-12-01',archive:'all'}));assert.equal(dayTasks([t],'2026-11-01').length,1);assert.equal(monthSummary([t],'2026-10','2026-11-10').total,1);
});
test('month/week shifts clamp dates, preserve whole months and cross leap/year boundaries',()=>{
 assert.deepEqual(shiftRange({from:'2028-01-31',to:'2028-02-02'},'month',1),{from:'2028-02-29',to:'2028-03-02'});
 assert.deepEqual(shiftRange(periodRange('month','2028-01-22'),'month',1),{from:'2028-02-01',to:'2028-02-29'});
 assert.deepEqual(shiftRange({from:'2026-12-28',to:'2027-01-03'},'week',1),{from:'2027-01-04',to:'2027-01-10'});
 assert.equal(parseRangeDate('29.02.2028'),'2028-02-29');assert.equal(parseRangeDate('29.02.2027'),'');
 assert.equal(QUADRANTS.find(q=>q.id==='plan').title,'Развитие');assert.equal(QUADRANTS.find(q=>q.id==='delegate').title,'Сделать позже');
});
test('weekly draft does not pull a future-created task backwards into an earlier week',()=>{
 assert(!planned({status:'В работе',due:'2026-11-10',createdAt:'2026-11-17'},'2026-11-09'));assert(planned({status:'В работе',due:'2026-11-10',createdAt:'2026-10-01'},'2026-11-09'));
});
