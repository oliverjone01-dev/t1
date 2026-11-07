import test from 'node:test';
import assert from 'node:assert/strict';
import {ordered,reorderTasks} from '../public/order.mjs';
import {validateBoard} from '../public/model.mjs';
import {seedEntry,makeOperation,applyOperation} from '../public/team-model.mjs';
const today='2026-11-07';
const tasks=validateBoard(Array.from({length:12},(_,i)=>({id:'task-'+String(i).padStart(2,'0'),title:'Задача '+i,status:'В работе',owner:'Иван',due:'2026-11-10',priority:'do',positions:{priority:{group:'do',x:24+(i%2)*312,y:96+Math.floor(i/2)*216}}})));
const ids=t=>ordered(t,'priority',today).map(t=>t.id);
test('legacy coordinates give a deterministic dense order regardless of server document order',()=>{assert.deepEqual(ids(tasks),ids([...tasks].reverse()));assert.equal(tasks[0].positions.priority.order,undefined)});
test('a selected block moves before an identity, retains internal order and survives JSON validation',()=>{
 const result=reorderTasks(tasks,['task-08','task-06'],{id:'do'},'task-01',today);
 assert.deepEqual(ids(result),['task-00','task-06','task-08','task-01','task-02','task-03','task-04','task-05','task-07','task-09','task-10','task-11']);
 assert.deepEqual(ids(validateBoard(JSON.parse(JSON.stringify(result)))),ids(result));
 assert.equal(result[6].owner,'Иван');assert.equal(result[6].due,'2026-11-10');
 assert.deepEqual(result[1],tasks[1]);
});
test('filtered neighbours remain ordered and missing drop targets never become a blind append',()=>{
 const result=reorderTasks(tasks,['task-08'],{id:'do'},'task-03',today);
 assert.deepEqual(ids(result).slice(0,5),['task-00','task-01','task-02','task-08','task-03']);
 assert.throws(()=>reorderTasks(tasks,['task-08'],{id:'plan'},'task-03',today));
});
test('group completion preserves priority, owner, due and other view positions',()=>{
 const result=reorderTasks(tasks,['task-00','task-01'],{id:'status:done',status:'Готово'},null,today);
 for(const t of result.slice(0,2)){assert.equal(t.status,'Готово');assert.equal(t.priority,'do');assert.equal(t.owner,'Иван');assert.equal(t.due,'2026-11-10')}
});
test('concurrent reorder of one task creates a selectable conflict while unrelated comment merges',()=>{
 const base=seedEntry(tasks[6]);
 const left=reorderTasks(tasks,[base.task.id],{id:'do'},'task-00',today)[6];
 const right=reorderTasks(tasks,[base.task.id],{id:'do'},null,today)[6];
 const actor={uid:'u',name:'Иван',clientId:'d'};
 const one=applyOperation(base,makeOperation(base,left,{id:'first-order',actor}));
 const two=applyOperation(one.entry,makeOperation(base,right,{id:'second-order',actor}));
 assert.equal(two.conflicts.length,1);assert.equal(two.conflicts[0].group,'priority');
 const comment=applyOperation(one.entry,makeOperation(base,{...base.task,comment:'С другого устройства'},{id:'comment-other',actor}));
 assert.equal(comment.conflicts.length,0);assert.equal(comment.entry.task.positions.priority.order,left.positions.priority.order);
});
test('repeated insertion into a narrow gap does not rewrite neighbours',()=>{
 let board=tasks;for(let i=0;i<150;i++)board=reorderTasks(board,[i%2?'task-06':'task-08'],{id:'do'},'task-01',today);
 assert.deepEqual(board[1],tasks[1]);assert.equal(new Set(ids(board)).size,12);
});
