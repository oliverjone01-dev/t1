import test from 'node:test';
import assert from 'node:assert/strict';
import {TRIAGE,focusCounts,matchesFocus,FOCUS} from '../public/productivity-model.mjs';

const today='2026-11-20';
const tasks=[
  {id:'a',title:'Просрочена',status:'В работе',priority:'do',owner:'Иван',due:'2026-11-10'},
  {id:'b',title:'Сегодня',status:'В ожидании',priority:'plan',owner:'',due:today},
  {id:'c',title:'Без приоритета',status:'Не указан',priority:null,owner:'Софа',due:''},
  {id:'d',title:'Готова и без приоритета',status:'Готово',priority:null,owner:'',due:'2026-11-01'},
];

test('every triage chip is a real focus and the strip starts with all tasks',()=>{
  assert.equal(TRIAGE[0][0],'all');
  for(const [id] of TRIAGE)assert.ok(FOCUS.some(([f])=>f===id),id);
});

test('triage counts match what the focus opens and skip finished tasks',()=>{
  const counts=focusCounts(tasks,today,['c'],id=>id==='b');
  assert.deepEqual(counts,{all:4,today:0,overdue:1,inbox:1,unassigned:1,waiting:1,unread:1,pinned:1});
  for(const [id] of TRIAGE)assert.equal(counts[id],tasks.filter(t=>matchesFocus(t,id,today,['c'],t.id==='b')).length,id);
  assert.equal(matchesFocus(tasks[3],'inbox',today),false);
});
