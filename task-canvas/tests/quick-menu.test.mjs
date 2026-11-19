import test from 'node:test';
import assert from 'node:assert/strict';
import {dueShortcuts,quickPatch} from '../public/quick-menu-model.mjs';

test('deadline shortcuts: today, tomorrow, the coming Friday, a week, none',()=>{
  assert.deepEqual(dueShortcuts('2026-11-20').map(x=>x[1]),['2026-11-20','2026-11-21','2026-11-27','2026-11-27','']);
  assert.equal(dueShortcuts('2026-11-18')[2][1],'2026-11-20');
});

test('quick patch changes only touched fields and keeps the schedule valid',()=>{
  const t={id:'a',title:'План',priority:null,owner:'',due:'',start:'2026-11-25',status:'',positions:{priority:{x:1},owners:{x:2}}};
  assert.deepEqual(quickPatch(t,{title:'План',priority:'',owner:'',due:'',status:'Не указан'}).changed,[]);
  const r=quickPatch(t,{title:'  План   запуска ',priority:'do',owner:'Иван',due:'2026-11-20',status:'В работе'});
  assert.deepEqual(r.changed,['title','priority','owner','due','status']);
  assert.equal(r.task.title,'План запуска');assert.equal(r.task.start,'2026-11-20');assert.equal(r.task.due,'2026-11-20');
  assert.deepEqual(r.task.positions,{});
  assert.throws(()=>quickPatch(t,{title:'   '}),/не может быть пустым/);
});
