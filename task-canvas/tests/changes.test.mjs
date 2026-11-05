import test from 'node:test';
import assert from 'node:assert/strict';
import {remoteChanges,ChangeInbox} from '../public/changes.mjs';
import {SyncEngine} from '../public/sync-engine.mjs';

const task={id:'sheet-1',title:'Задача',owner:'Иван',due:'2026-11-10',comment:'',positions:{}};
const board=(...tasks)=>({tasks,owners:[]});
test('first import establishes a baseline without marking every task as new',()=>{
  assert.deepEqual(remoteChanges(null,board(task),board()),[]);
  assert.equal(remoteChanges(board(),board(task),board())[0].kind,'new');
});
test('remote edits report changed fields, while local write acknowledgements stay quiet',()=>{
  const remote={...task,owner:'Катя',comment:'Обновлено в Google'};
  const events=remoteChanges(board(task),board(remote),board({...task,owner:'Катя'}));
  assert.deepEqual(events[0].fields,['comment']);
  assert.deepEqual(remoteChanges(board(task),board(remote),board(remote)),[]);
  assert.deepEqual(remoteChanges(board(),board(task),board(task)),[]);
});
test('context updates and remote removal are visible; own archive has no notification',()=>{
  const event=remoteChanges(board(task),board({...task,requester:'Богдан',dependency:'Согласовать'}),board(task))[0];
  assert.ok(event.fields.includes('requester'));assert.ok(event.fields.includes('dependency'));
  assert.equal(remoteChanges(board(task),board(),board(task))[0].kind,'removed');
  assert.deepEqual(remoteChanges(board(task),board(),board()),[]);
});
test('ambiguous source wording is noticed without duplicating a changed owner or date',()=>{
  const before={...task,ownerNote:'Иван',due:'',dueNote:'Срок уточняется'};
  const event=remoteChanges(board(before),board({...before,owner:'Катя',ownerNote:'Катя',dueNote:'На следующей встрече'}),board(before))[0];
  assert.ok(event.fields.includes('owner'));assert.ok(!event.fields.includes('ownerNote'));assert.ok(event.fields.includes('dueNote'));
});
test('unread notices survive unchanged polls and reload, then explicit reading extinguishes them',()=>{
  const inbox=new ChangeInbox();inbox.receive([{id:task.id,title:task.title,kind:'new',fields:[]}],100);
  inbox.receive([],200);const restored=new ChangeInbox(JSON.parse(JSON.stringify(inbox.snapshot())));
  assert.equal(restored.get(task.id).kind,'new');
  restored.acknowledge(task.id);assert.equal(restored.size,0);
  restored.receive([{id:task.id,title:task.title,kind:'updated',fields:['due']}],300);
  assert.equal(restored.get(task.id).kind,'updated');restored.clear();assert.equal(restored.size,0);
});
test('multiple changes remain one notice per card, preserving new status until viewed',()=>{
  const inbox=new ChangeInbox();
  inbox.receive([{id:task.id,title:task.title,kind:'new',fields:[]}],100);
  inbox.receive([{id:task.id,title:'Новое имя',kind:'updated',fields:['title','due']}],200);
  inbox.receive([{id:task.id,title:'Новое имя',kind:'updated',fields:['due','owner']}],300);
  assert.equal(inbox.size,1);assert.equal(inbox.get(task.id).kind,'new');
  assert.deepEqual(inbox.get(task.id).fields,['title','due','owner']);
  assert.equal(inbox.get(task.id).title,'Новое имя');
  inbox.receive([{id:task.id,title:task.title,kind:'removed',fields:[]}],400);
  assert.equal(inbox.get(task.id).kind,'removed');
});
test('malformed presentation metadata cannot break task loading',()=>{
  const inbox=new ChangeInbox([null,{id:123},{id:'ok',title:'Задача',kind:'updated',fields:['due','injected'],at:'bad'}]);
  assert.equal(inbox.size,1);assert.deepEqual(inbox.get('ok').fields,['due']);assert.equal(inbox.get('ok').at,0);
});
function harness(local,remote,base) {
  const clone=structuredClone, notices=new ChangeInbox();
  let here=clone(local), there=clone(remote);
  const api={async read(){return {board:clone(there)}},async write(snapshot,writes){for(const write of writes){there.tasks=there.tasks.filter(t=>t.id!==write.id);if(write.task)there.tasks.push(clone(write.task));}}};
  const engine=new SyncEngine({api,getLocal:()=>here,apply:b=>here=clone(b),cache:base?{enabled:true,base}:null,onRemote:c=>notices.receive(c),schedule:()=>0,cancel:()=>{}});
  return {api,engine,notices,get remote(){return there},set remote(value){there=value},get local(){return here}};
}
test('engine delivers remote edits once; a new baseline remains quiet',async()=>{
  const h=harness(board(task),board({...task,due:'2026-11-12'}),board(task));
  await h.engine.connect();assert.equal(h.notices.size,1);assert.deepEqual(h.notices.get(task.id).fields,['due']);
  h.notices.clear();await h.engine.flush();assert.equal(h.notices.size,0);
  const first=harness(board(),board(task));await first.engine.connect();assert.equal(first.notices.size,0);
});
test('changes arriving during a write are noticed, without highlighting the local write itself',async()=>{
  const h=harness(board({...task,owner:'Катя'}),board(task),board(task));
  const write=h.api.write;h.api.write=async(...args)=>{await write(...args);h.remote=board({...h.remote.tasks[0],comment:'Параллельная правка из таблицы'});};
  await h.engine.connect();assert.equal(h.local.tasks[0].owner,'Катя');assert.equal(h.local.tasks[0].comment,'Параллельная правка из таблицы');
  assert.deepEqual(h.notices.get(task.id).fields,['comment']);
});
test('a lost write response does not generate a false remote notice on retry',async()=>{
  const h=harness(board({...task,comment:'Моя правка'}),board(task),board(task));
  const write=h.api.write;h.api.write=async(...args)=>{await write(...args);throw new Error('Lost response');};
  await h.engine.connect();h.api.write=write;await h.engine.flush();assert.equal(h.notices.size,0);
});
test('same-field conflicts still expose the external change for explicit comparison',async()=>{
  const h=harness(board({...task,owner:'Катя'}),board({...task,owner:'Дима'}),board(task));
  await h.engine.connect();assert.equal(h.engine.status,'conflict');assert.ok(h.notices.get(task.id).fields.includes('owner'));
});
