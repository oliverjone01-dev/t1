import test from 'node:test';
import assert from 'node:assert/strict';
import {dockTargets,applyDock,dockSummary} from '../public/dock-model.mjs';

const due=today=>dockTargets(today).find(g=>g.id==='due').targets.map(t=>[t.label,t.value]);

test('deadline targets: today, tomorrow, end of week (Sunday), end of month, none; duplicates collapse',()=>{
  assert.deepEqual(due('2026-11-20'),[['Сегодня','2026-11-20'],['Завтра','2026-11-21'],['До конца недели','2026-11-22'],['До конца месяца','2026-11-30'],['Без срока','']]);
  assert.deepEqual(due('2026-11-22').map(x=>x[0]),['Сегодня','Завтра','До конца месяца','Без срока']);
  assert.deepEqual(due('2026-11-30').map(x=>x[0]),['Сегодня','Завтра','До конца недели','Без срока']);
  assert.deepEqual(due('2026-02-27'),[['Сегодня','2026-02-27'],['Завтра','2026-02-28'],['До конца недели','2026-03-01'],['Без срока','']]);
});

test('a drop writes only its field for every dragged task and keeps periods valid',()=>{
  const tasks=[
    {id:'a',title:'A',status:'В работе',priority:'do',due:'2026-11-25',start:'2026-11-23',positions:{time:{group:'week',x:24,y:96},priority:{group:'do',x:24,y:96}}},
    {id:'b',title:'B',status:'В ожидании',priority:null,due:'',start:'2026-11-28',positions:{}},
    {id:'c',title:'C',status:'В работе',priority:'plan',due:'2026-11-30'}];
  const r=applyDock(tasks,['a','b'],{field:'due',value:'2026-11-21'});
  assert.deepEqual([r[0].start,r[0].due],['2026-11-19','2026-11-21']);
  assert.deepEqual(Object.keys(r[0].positions),['priority']);
  assert.deepEqual([r[1].start,r[1].due],['2026-11-21','2026-11-21']);
  assert.deepEqual([r[2].due,r[2].start],['2026-11-30','']);
  const p=applyDock(tasks,['a'],{field:'priority',value:''});assert.equal(p[0].priority,null);assert.deepEqual(Object.keys(p[0].positions),['time']);
  const s=applyDock(tasks,['a','c'],{field:'status',value:'Готово'});assert.deepEqual(s.map(t=>t.status),['Готово','В ожидании','Готово']);
  assert.equal(applyDock(tasks,['c'],{field:'priority',value:'plan'})[2].priority,'plan');
  assert.throws(()=>applyDock(tasks,['zzz'],{field:'due',value:''}),/убраны/);
  assert.equal(dockSummary({field:'due',value:'2026-11-21',label:'Завтра'},3),'Срок: завтра · задач: 3');
});

test('list: dropping on a row of another priority moves the task into that priority next to the row',async()=>{
  const {moveInContext}=await import('../public/planning-order.mjs');
  const today='2026-11-20';
  const tasks=[{id:'a',title:'A',status:'В работе',priority:'do'},{id:'b',title:'B',status:'В работе',priority:'plan'},{id:'c',title:'C',status:'В работе',priority:'plan'}];
  const r=moveInContext(tasks,['a'],{field:'priority',value:'plan',before:'c'},today);
  assert.equal(r.find(t=>t.id==='a').priority,'plan');
  const {ordered}=await import('../public/order.mjs');
  const order=ordered(r.filter(t=>t.priority==='plan'),'priority',today).map(t=>t.id);
  assert.ok(order.indexOf('a')<order.indexOf('c'),order.join(','));
});

test('section keys map to the field a drop into that section sets',async()=>{
  const {sectionTarget,applyFields,assertFieldsUnchanged}=await import('../public/dock-model.mjs');
  assert.deepEqual(sectionTarget('plan'),{field:'priority',value:'plan'});
  assert.deepEqual(sectionTarget('inbox'),{field:'priority',value:''});
  assert.deepEqual(sectionTarget('status:done'),{field:'status',value:'Готово'});
  assert.deepEqual(sectionTarget('status:В ожидании'),{field:'status',value:'В ожидании'});
  assert.deepEqual(sectionTarget('importance:4'),{field:'importance',value:4});
  assert.deepEqual(sectionTarget('day:2026-11-24'),{field:'due',value:'2026-11-24'});
  assert.equal(sectionTarget('owner:Иван'),null);assert.equal(sectionTarget('all'),null);assert.equal(sectionTarget('status:Чужой'),null);
  const tasks=[{id:'a',title:'A',status:'В работе',priority:'do',due:'2026-11-20'}];
  const r=applyFields(tasks,['a'],[{field:'due',value:'2026-11-24'},{field:'priority',value:'plan'}]);
  assert.deepEqual([r[0].due,r[0].priority],['2026-11-24','plan']);
  assert.throws(()=>assertFieldsUnchanged([{...tasks[0],due:'2026-11-22'}],tasks,['a'],[{field:'due'}]),/уже изменили/);
});

test('calendar: a multi-day task moves by the distance between the day taken and the day dropped (Feniks F5)',async()=>{
  const {applyFields}=await import('../public/dock-model.mjs');
  const tasks=[{id:'a',title:'A',status:'В работе',start:'2026-11-23',due:'2026-11-27'},{id:'b',title:'B',status:'В работе',start:'',due:'2026-11-25'}];
  const r=applyFields(tasks,['a','b'],[{field:'due',value:'2026-11-24',from:'2026-11-25'}]);
  assert.deepEqual([r[0].start,r[0].due],['2026-11-22','2026-11-26']);
  assert.equal(r[1].due,'2026-11-24');
  assert.equal(applyFields(tasks,['a'],[{field:'due',value:'2026-11-25',from:'2026-11-25'},{field:'priority',value:'plan'}])[0].due,'2026-11-27');
});

test('a closed task brought to a priority or a date comes back to work; a status or no-date drop does not (Feniks F3)',async()=>{
  const {applyFields,reopens}=await import('../public/dock-model.mjs');
  const done={id:'a',title:'A',status:'Готово',priority:'do',due:'2026-11-20'};
  assert.equal(applyFields([done],['a'],[{field:'priority',value:'plan'}])[0].status,'В работе');
  assert.equal(applyFields([done],['a'],[{field:'due',value:'2026-11-21'}])[0].status,'В работе');
  assert.equal(applyFields([done],['a'],[{field:'due',value:''}])[0].status,'Готово');
  assert.equal(reopens(done,{field:'status',value:'Отменено'}),false);
});
