import test from 'node:test';
import assert from 'node:assert/strict';
import {moveTask,createLayout,validateBoard,timeLanes} from '../public/model.mjs';
import {applyBulk,bulkPatch,matchesFocus} from '../public/productivity-model.mjs';
import {moveInContext} from '../public/planning-order.mjs';
import {monthSummary} from '../public/calendar-model.mjs';
import {shiftSchedule} from '../public/gantt-model.mjs';

const today='2026-11-20';
const startOnly={id:'s',title:'Только начало',status:'В работе',start:'2026-11-25',due:'',positions:{}};
const other={id:'o',title:'Со сроком',status:'В работе',due:'2026-11-30',positions:{}};

test('a start-only task accepts a deadline before its start: the period collapses to the deadline',()=>{
  assert.deepEqual(shiftSchedule(startOnly,today),{...startOnly,due:today,start:today});
  assert.deepEqual(shiftSchedule({...startOnly,start:'2026-11-10'},today),{...startOnly,start:'2026-11-10',due:today});
  const lane=createLayout([startOnly],'time',today).groups.find(g=>g.id==='today');
  const moved=moveTask(startOnly,'time',lane,lane.x+30,100,today);
  assert.equal(moved.start,today);assert.equal(moved.due,today);
  assert.doesNotThrow(()=>validateBoard([moved]));
});

test('bulk and planning deadline changes do not fail on a start-only task',()=>{
  const bulk=applyBulk([startOnly,other],[startOnly,other],bulkPatch({dueMode:'set',due:today}));
  assert.ok(bulk.every(t=>t.due===today&&(!t.start||t.start<=t.due)));
  const planned=moveInContext([startOnly,other],['s'],{field:'due',value:today},today);
  const s=planned.find(t=>t.id==='s');assert.equal(s.due,today);assert.equal(s.start,today);
});

test('the calendar overdue count matches the overdue focus for tasks without a deadline',()=>{
  assert.equal(matchesFocus(startOnly,'overdue',today),false);
  assert.equal(monthSummary([startOnly],'2026-11',today).overdue,0);
  assert.equal(monthSummary([{...other,due:'2026-11-02'}],'2026-11',today).overdue,1);
});

test('on Sunday the week lane refuses drops instead of silently landing in today',()=>{
  const sunday='2026-11-22';
  const week=createLayout([other],'time',sunday).groups.find(g=>g.id==='week');
  assert.throws(()=>moveTask(other,'time',week,week.x+30,100,sunday),/Неделя заканчивается сегодня/);
  assert.equal(timeLanes(sunday).find(g=>g.id==='week').subtitle,'Неделя заканчивается сегодня');
  const monday='2026-11-23',lane=createLayout([other],'time',monday).groups.find(g=>g.id==='week');
  assert.equal(moveTask(other,'time',lane,lane.x+30,100,monday).due,'2026-11-29');
});
