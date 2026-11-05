import test from 'node:test';
import assert from 'node:assert/strict';
import { snap, createLayout, moveTask, timeBucket, timeLanes, parseDelimited, fromSheet, validateBoard, parseDeadline } from '../public/model.mjs';
const date = '2026-11-05';
const task = { id:'one', title:'Задача', owner:'Иван', due:'2026-11-09', priority:'plan', positions:{} };
test('moving between quadrants changes priority without changing owner or exact date', () => {
  const target = createLayout([task],'priority',date).groups.find(g => g.id==='do');
  const moved = moveTask(task,'priority',target,target.x+29,target.y+113,date);
  assert.equal(moved.priority,'do'); assert.equal(moved.owner,'Иван'); assert.equal(moved.due,task.due);
  assert.equal(moved.positions.priority.x,24); assert.equal(moved.positions.priority.y,120);
  assert.equal(task.priority,'plan');
});
test('owner lanes change only owner and preserve other layout positions', () => {
  const target = createLayout([task],'owners',date,['Катя']).groups.find(g => g.id==='Катя');
  const moved = moveTask(task,'owners',target,target.x+31,130,date);
  assert.equal(moved.owner,'Катя'); assert.equal(moved.priority,'plan'); assert.equal(moved.due,task.due);
  assert.equal(moved.positions.owners.group,'Катя');
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
