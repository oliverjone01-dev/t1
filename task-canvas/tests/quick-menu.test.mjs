import test from 'node:test';
import assert from 'node:assert/strict';
import {dueShortcuts,quickPatch} from '../public/quick-menu-model.mjs';
import {SYNC_FIELDS,comparable,equal} from '../public/sync-model.mjs';
const sheetCells=(a,b)=>{const x=comparable(a),y=comparable(b);return SYNC_FIELDS.filter(k=>!equal(x[k],y[k]))};

test('deadline shortcuts: today, tomorrow, the coming Friday, a week, none',()=>{
  assert.deepEqual(dueShortcuts('2026-11-20').map(x=>x[1]),['2026-11-20','2026-11-21','2026-11-27','2026-11-27','']);
  assert.equal(dueShortcuts('2026-11-18')[2][1],'2026-11-20');
});

test('quick patch changes only touched fields and keeps the schedule valid',()=>{
  const t={id:'a',title:'План',priority:null,owner:'',due:'',start:'2026-11-25',status:'',positions:{priority:{x:1},owners:{x:2}}};
  assert.deepEqual(quickPatch(t,{title:'План',priority:'',owner:'',due:'',status:'Не указан'}).changed,[]);
  const r=quickPatch(t,{title:'  План   запуска ',priority:'do',owner:'Иван',due:'2026-11-20',status:'В работе'});
  assert.deepEqual(r.changed,['title','priority','owner','due','status']);
  assert.equal(r.task.title,'План   запуска');assert.equal(r.task.start,'2026-11-20');assert.equal(r.task.due,'2026-11-20');
  assert.deepEqual(r.task.positions,{});
  assert.throws(()=>quickPatch(t,{title:'   '}),/не может быть пустым/);
});

test('the Sheet receives only the fields the person changed in the quick menu',()=>{
  const base={id:'s1',title:'Подготовить\nплан  запуска',unit:'ГМ',description:'Итог',status:'В работе',owner:'Иван ',due:'2026-11-25',start:'2026-11-20',comment:'',priority:'do',importance:3,progress:20,positions:{priority:{group:'do',x:24,y:96}}};
  const untouched={title:base.title,priority:'do',owner:'Иван ',due:'2026-11-25',status:'В работе'};
  assert.deepEqual(quickPatch(base,untouched).changed,[]);
  assert.deepEqual(sheetCells(base,quickPatch(base,{...untouched,status:'Готово'}).task),['status']);
  const moved=quickPatch(base,{...untouched,priority:'plan'}).task;
  assert.deepEqual(sheetCells(base,moved),['priority','positions']);
  assert.equal(moved.title,base.title);assert.equal(moved.owner,base.owner);
  assert.deepEqual(sheetCells(base,quickPatch(base,{...untouched,due:'2026-11-18'}).task),['due','start']);
  assert.deepEqual(sheetCells(base,quickPatch(base,{...untouched,owner:'  Иван  '}).task),[]);
});
