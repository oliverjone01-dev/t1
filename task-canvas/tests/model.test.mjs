import test from 'node:test';
import assert from 'node:assert/strict';
import { snap, createLayout, moveTask, groupFor, STATUS_LANES, timeBucket, timeLanes, parseDelimited, fromSheet, validateBoard, parseDeadline, dropTarget, importBoard, fitCamera, CARD } from '../public/model.mjs';
import {mergeBoards,buildWriteRequests} from '../public/sync-model.mjs';
const date = '2026-11-05';
const task = { id:'one', title:'Задача', owner:'Иван', due:'2026-11-09', priority:'plan', positions:{} };
test('every view has separate done and cancelled zones, even with no cards',()=>{
  for(const mode of ['priority','owners','time']) {
    const layout=createLayout([] ,mode,date);
    for(const lane of STATUS_LANES)assert.ok(layout.groups.some(g=>g.id===lane.id));
    for(const lane of STATUS_LANES)assert.equal(groupFor({...task,status:lane.status},mode,date),lane.id);
    const list=[{...task,id:'active',status:'В работе'},{...task,id:'done',status:'Готово'},{...task,id:'cancelled',status:'Отменено'}];
    const positioned=createLayout(list,mode,date);
    assert.equal(positioned.placed.size,3);
    assert.equal(positioned.placed.get('done').group,'status:done');
    assert.equal(positioned.placed.get('cancelled').group,'status:cancelled');
  }
});
test('dropping into either status zone changes status while retaining task planning fields',()=>{
  for(const mode of ['priority','owners','time'])for(const lane of STATUS_LANES) {
    const target=createLayout([task],mode,date).groups.find(g=>g.id===lane.id);
    const moved=moveTask({...task,status:'В работе'},mode,target,target.x+31,target.y+130,date);
    assert.equal(moved.status,lane.status);assert.equal(moved.owner,task.owner);assert.equal(moved.due,task.due);assert.equal(moved.priority,task.priority);
    assert.equal(moved.positions[mode].group,lane.id);assert.equal(moved.positions[mode].x,24);
    assert.doesNotThrow(()=>validateBoard([moved]));
  }
});
test('returning a finished card resumes work and updates only the chosen planning dimension',()=>{
  for(const status of ['Готово','Отменено'])for(const mode of ['priority','owners','time']) {
    const targets={priority:'do',owners:'owner:Катя',time:'today'};
    const target=createLayout([task],mode,date,['Катя']).groups.find(g=>g.id===targets[mode]);
    const moved=moveTask({...task,status},mode,target,target.x+24,target.y+96,date);
    assert.equal(moved.status,'В работе');
    assert.equal(moved.owner,mode==='owners'?'Катя':task.owner);
    assert.equal(moved.due,mode==='time'?date:task.due);
    assert.equal(moved.priority,mode==='priority'?'do':task.priority);
    assert.equal(groupFor(moved,mode,date),target.id);
  }
});
test('status lanes do not collide with people who have similar names or IDs',()=>{
  const list=[{...task,id:'a',owner:'Готово',status:'В работе'},{...task,id:'b',owner:'status:done',status:'В работе'},{...task,id:'c',status:'Готово'}];
  const layout=createLayout(list,'owners',date);
  assert.equal(layout.placed.get('a').group,'owner:Готово');
  assert.equal(layout.placed.get('b').group,'owner:status:done');
  assert.equal(layout.placed.get('c').group,'status:done');
});
test('completion-zone cards stay on grid without overlapping the priority matrix or each other',()=>{
  const list=Array.from({length:24},(_,i)=>({...task,id:String(i),status:i%2?'Готово':'Отменено',positions:{priority:{group:i%2?'status:done':'status:cancelled',x:24,y:96}}}));
  const layout=createLayout(list,'priority',date);
  const terminal=layout.groups.filter(g=>g.status);
  const active=layout.groups.filter(g=>!g.status);
  for(const group of terminal)for(const other of active)assert.ok(group.x>=other.x+other.w || group.x+group.w<=other.x || group.y>=other.y+other.h || group.y+group.h<=other.y);
  const positions=[...layout.placed.values()];
  for(let i=0;i<positions.length;i++) {
    const p=positions[i];assert.equal(p.x%24,0);assert.equal(p.y%24,0);
    for(const q of positions.slice(i+1))assert.ok(p.x+CARD.width<=q.x || q.x+CARD.width<=p.x || p.y+CARD.height<=q.y || q.y+CARD.height<=p.y);
  }
});
test('completion transfers sync only the status cell and layout, preserving source planning data',()=>{
  const base={tasks:validateBoard([{...task,status:'В работе'}]),owners:[]};
  for(const lane of STATUS_LANES) {
    const target=createLayout(base.tasks,'priority',date).groups.find(g=>g.id===lane.id);
    const moved=moveTask(base.tasks[0],'priority',target,target.x+24,target.y+96,date);
    const plan=mergeBoards(base,{...base,tasks:[moved]},base);
    assert.deepEqual(plan.writes[0].fields,['status','positions']);
    const snapshot={board:base,records:[{id:task.id,row:3,cells:Array.from({length:22},()=>({}))}]};
    snapshot.records[0].cells[18]={formattedValue:task.id};
    const requests=buildWriteRequests(snapshot,plan.writes,[]);
    assert.deepEqual(requests.map(r=>r.updateCells.start.columnIndex),[8,17]);
    assert.equal(requests[0].updateCells.rows[0].values[0].userEnteredValue.stringValue,lane.status);
  }
});
test('moving between quadrants changes priority without changing owner or exact date', () => {
  const target = createLayout([task],'priority',date).groups.find(g => g.id==='do');
  const moved = moveTask(task,'priority',target,target.x+29,target.y+113,date);
  assert.equal(moved.priority,'do'); assert.equal(moved.owner,'Иван'); assert.equal(moved.due,task.due);
  assert.equal(moved.positions.priority.x,24); assert.equal(moved.positions.priority.y,120);
  assert.equal(task.priority,'plan');
});
test('owner lanes change only owner and preserve other layout positions', () => {
  const target = createLayout([task],'owners',date,['Катя']).groups.find(g => g.id==='owner:Катя');
  const moved = moveTask(task,'owners',target,target.x+31,130,date);
  assert.equal(moved.owner,'Катя'); assert.equal(moved.priority,'plan'); assert.equal(moved.due,task.due);
  assert.equal(moved.positions.owners.group,'owner:Катя');
});
test('time lane sets explicit local date; movement within lane preserves exact date', () => {
  const next = timeLanes(date).find(g => g.id==='next'); Object.assign(next,{x:0,y:0,w:624});
  assert.equal(moveTask(task,'time',next,24,120,date).due,'2026-11-09');
  const current = {...task,due:''}; assert.equal(moveTask(current,'time',next,24,120,date).due,'2026-11-15');
  const today = {...timeLanes(date).find(g => g.id==='today'),x:0,y:0,w:624};
  assert.equal(moveTask(task,'time',today,24,120,date).due,date);
  assert.throws(() => moveTask(task,'time',{id:'overdue',x:0,y:0,w:624},24,120,date));
});
test('Sunday boundary and year change stay in local date', () => {
  assert.equal(timeBucket({due:'2026-11-08'},date),'week'); assert.equal(timeBucket({due:'2026-11-09'},date),'next');
  assert.equal(timeBucket({due:'2027-01-03'},'2026-12-31'),'week');
});
test('CSV parser handles quoted delimiters, embedded newlines, BOM and escaped quotes', () => {
  assert.deepEqual(parseDelimited('\uFEFFID,Задача\r\n1,"Текст, с запятой\nи ""кавычками"""\r\n'),[['ID','Задача'],['1','Текст, с запятой\nи "кавычками"']]);
  assert.throws(() => parseDelimited('ID,Задача\n1,"broken'));
});
test('spreadsheet import skips empty placeholders and preserves source wording', () => {
  const rows = [['Заголовок'],[],['ID','Юнит','Направление','Задача','Ответственный','Срок','Статус'],['1','ГМ / ','Каталог','','Иван; Катя','28.10 -> 6.11','В работе'],['2','ГГР / ']];
  const tasks = fromSheet(rows,2026); assert.equal(tasks.length,1); assert.equal(tasks[0].title,'Каталог');
  assert.equal(tasks[0].priority,null); assert.equal(tasks[0].owner,''); assert.equal(tasks[0].ownerNote,'Иван; Катя');
  assert.equal(tasks[0].due,'2026-11-06'); assert.equal(tasks[0].unit,'ГМ');
});
test('ambiguous dates stay unassigned while explicit rescheduling is recognized', () => {
  assert.equal(parseDeadline('Не указан',2026),''); assert.equal(parseDeadline('31.02.2026',2026),'');
  assert.equal(parseDeadline('30.10.2026 -> в течении ноября проверяем',2026),'');
  assert.equal(parseDeadline('28.10 - 3.11 -> 9.11',2026),'2026-11-09');
});
test('board validation rejects duplicates and invalid priorities; sanitizes positions', () => {
  assert.throws(()=>validateBoard([task,task])); assert.throws(()=>validateBoard([{...task,priority:'unknown'}]));
  assert.equal(validateBoard([{...task,positions:{owners:{x:NaN,y:0,group:'Иван'}}}])[0].positions.owners,undefined);
});
test('layout reflows quadrants and retains per-view grid positions', () => {
  const many = Array.from({length:12},(_,i)=>({...task,id:String(i),priority:'do'}));
  const layout = createLayout(many,'priority',date);
  const top = layout.groups.find(g=>g.id==='do'), bottom=layout.groups.find(g=>g.id==='delegate');
  assert.ok(bottom.y>top.y+top.h);
  for (const t of many) { const p=layout.placed.get(t.id); assert.equal(p.x%24,0); assert.equal(p.y%24,0); }
  assert.equal(snap(47),48);
});

test('lower quadrant wins its own rectangle over the upper expansion zone', () => {
  const layout=createLayout([],'priority',date);
  assert.equal(dropTarget(layout.groups,500,650).id,'delegate');
  assert.equal(dropTarget(layout.groups,1200,650).id,'later');
  assert.equal(dropTarget(layout.groups,-50,650),undefined);
});
test('manual and automatic positions remain on grid, inside lanes, and never overlap', () => {
  const list=[{...task,id:'a',positions:{priority:{group:'plan',x:336,y:96}}},{...task,id:'b',positions:{}},{...task,id:'c',positions:{priority:{group:'plan',x:336,y:96}}}];
  const layout=createLayout(list,'priority',date), group=layout.groups.find(g=>g.id==='plan');
  const positions=[...layout.placed.values()];
  for(let i=0;i<positions.length;i++) {
    const a=positions[i]; assert.equal(a.x%24,0);assert.equal(a.y%24,0);
    assert.ok(a.x>=group.x+24 && a.x+CARD.width<=group.x+group.w-24);
    assert.ok(a.y+CARD.height<=group.y+group.h-24);
    for(const b of positions.slice(i+1)) assert.ok(a.x+CARD.width<=b.x || b.x+CARD.width<=a.x || a.y+CARD.height<=b.y || b.y+CARD.height<=a.y);
  }
});
test('JSON restore is lossless for deliberately unassigned owner and an empty board', () => {
  const removed={...task,owner:'',ownerNote:'Иван'};
  const restored=importBoard(JSON.stringify({version:1,tasks:[removed],owners:['Свободная дорожка']}),[],[],{replace:true});
  assert.equal(restored.tasks[0].owner,''); assert.deepEqual(restored.owners,['Свободная дорожка']);
  assert.equal(importBoard('{"version":1,"tasks":[]}',[task],[],{replace:true}).tasks.length,0);
});
test('combined import limit and duplicate CSV IDs fail before changing the board', () => {
  const current=Array.from({length:2000},(_,i)=>({...task,id:'old-'+i}));
  assert.throws(()=>importBoard(JSON.stringify([{...task,id:'new'}]),current),/2000/);
  assert.equal(current.length,2000);
  assert.throws(()=>importBoard('ID,Направление\n1,Один\n1,Два'),/повторяющимся/);
  assert.throws(()=>importBoard('{"version":9,"tasks":[]}'),/версия/);
});
test('date ranges remain unknown instead of silently becoming their start date', () => {
  assert.equal(parseDeadline('28.10 - 3.11',2026),'');
  assert.equal(parseDeadline('28.10–3.11',2026),'');
  assert.equal(parseDeadline('06-11-2026',2026),'2026-11-06');
  assert.equal(parseDeadline('28.10 - 3.11 -> 9.11',2026),'2026-11-09');
});
test('a person named unassigned has a separate lane from unassigned tasks', () => {
  const list=[{...task,id:'a',owner:'unassigned'},{...task,id:'b',owner:''}];
  const layout=createLayout(list,'owners',date);
  assert.equal(layout.groups.filter(g=>g.id==='unassigned').length,1);
  assert.equal(layout.placed.get('a').group,'owner:unassigned');
  assert.equal(layout.placed.get('b').group,'unassigned');
});
test('fit includes all 47 source cards even below the former minimum zoom', () => {
  const list=Array.from({length:47},(_,i)=>({...task,id:String(i),priority:null}));
  const positions=[...createLayout(list,'priority',date).placed.values()];
  const camera=fitCamera(positions,815,644);
  assert.ok(camera.z<.08);
  for(const p of positions) {
    assert.ok(p.x*camera.z+camera.x>=0);assert.ok((p.x+CARD.width)*camera.z+camera.x<=815);
    assert.ok(p.y*camera.z+camera.y>=0);assert.ok((p.y+CARD.height)*camera.z+camera.y<=644);
  }
});

test('table header determines delimiter even after a one-cell title line', () => {
  assert.equal(fromSheet(parseDelimited('Название таблицы\nID\tНаправление\n1\tЗадача'),2026)[0].title,'Задача');
  assert.equal(fromSheet(parseDelimited('ID;Направление\n1;Задача'),2026)[0].title,'Задача');
});
