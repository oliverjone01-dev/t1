import test from 'node:test';
import assert from 'node:assert/strict';
import {revertRecord,invert} from '../public/undo-model.mjs';

const board=tasks=>({tasks,owners:[]});
const t=(id,extra={})=>({id,title:id,status:'В работе',priority:'do',due:'',positions:{},...extra});

test('undo reverts only the step and keeps a colleague edit that arrived after it',()=>{
  const record={before:board([t('a'),t('b')]),after:board([t('a',{due:'2026-11-21',priority:'plan'}),t('b')])};
  const now=board([t('a',{due:'2026-11-21',priority:'plan',title:'Новое от коллеги'}),t('b',{status:'Готово'})]);
  const r=revertRecord(now,record);
  assert.deepEqual([r.tasks[0].due,r.tasks[0].priority,r.tasks[0].title],['','do','Новое от коллеги']);
  assert.equal(r.tasks[1].status,'Готово');assert.equal(r.skipped,0);assert.equal(r.applied,2);
});

test('a field changed by someone else after the step is not overwritten and is reported',()=>{
  const record={before:board([t('a')]),after:board([t('a',{due:'2026-11-21'})])};
  const r=revertRecord(board([t('a',{due:'2026-11-30'})]),record);
  assert.equal(r.tasks[0].due,'2026-11-30');assert.equal(r.skipped,1);assert.equal(r.applied,0);
});

test('redo is undo of the inverted record, several steps back and forth',()=>{
  const s0=board([t('a')]),s1=board([t('a',{priority:'plan'})]),s2=board([t('a',{priority:'plan',due:'2026-11-21'})]);
  const h=[{before:s0,after:s1},{before:s1,after:s2}];
  let state=s2;
  state=revertRecord(state,h[1]);assert.deepEqual([state.tasks[0].priority,state.tasks[0].due],['plan','']);
  state=revertRecord(state,h[0]);assert.deepEqual([state.tasks[0].priority,state.tasks[0].due],['do','']);
  state=revertRecord(state,invert(h[0]));state=revertRecord(state,invert(h[1]));
  assert.deepEqual([state.tasks[0].priority,state.tasks[0].due],['plan','2026-11-21']);
});

test('created and removed tasks: undo removes an untouched creation and restores a removal',()=>{
  const record={before:board([t('a')]),after:board([t('b')])};
  const r=revertRecord(board([t('b')]),record);
  assert.deepEqual(r.tasks.map(x=>x.id).sort(),['a']);
  const edited=revertRecord(board([t('b',{title:'правка'})]),record);
  assert.deepEqual(edited.tasks.map(x=>x.id).sort(),['a','b']);assert.equal(edited.skipped,1);
});

test('positions revert per view and keep views the step did not touch',()=>{
  const p=(g)=>({group:g,x:24,y:96});
  const record={before:board([t('a',{positions:{priority:p('do')}})]),after:board([t('a',{positions:{priority:p('plan')}})])};
  const r=revertRecord(board([t('a',{positions:{priority:p('plan'),time:p('week')}})]),record);
  assert.deepEqual(r.tasks[0].positions,{priority:p('do'),time:p('week')});
});

test('linked fields revert together or not at all (Feniks F2)',()=>{
  const record={before:board([t('a',{start:'2026-11-23',due:'2026-11-25'})]),after:board([t('a',{start:'2026-11-19',due:'2026-11-21'})])};
  const moved=revertRecord(board([t('a',{start:'2026-11-19',due:'2026-11-22'})]),record);
  assert.deepEqual([moved.tasks[0].start,moved.tasks[0].due],['2026-11-19','2026-11-22']);assert.equal(moved.skipped,1);
  const clean=revertRecord(board([t('a',{start:'2026-11-19',due:'2026-11-21'})]),record);
  assert.deepEqual([clean.tasks[0].start,clean.tasks[0].due],['2026-11-23','2026-11-25']);
  const closing={before:board([t('a',{status:'В работе',progress:40,closedAt:''})]),after:board([t('a',{status:'Готово',progress:100,closedAt:'2026-11-20'})])};
  const reopened=revertRecord(board([t('a',{status:'Отменено',progress:100,closedAt:'2026-11-20'})]),closing);
  assert.deepEqual([reopened.tasks[0].status,reopened.tasks[0].progress,reopened.tasks[0].closedAt],['Отменено',100,'2026-11-20']);assert.equal(reopened.skipped,1);
});

test('an own date step stays undoable after the Sheet rewrites dueNote on sync (Feniks F7)',()=>{
  const record={before:board([t('a',{due:'2026-11-25',dueNote:'25.11'})]),after:board([t('a',{due:'2026-11-23',dueNote:''})])};
  const synced=board([t('a',{due:'2026-11-23',dueNote:'23.11.2026'})]);
  const r=revertRecord(synced,record);
  assert.equal(r.applied,1);assert.equal(r.skipped,0);
  assert.deepEqual([r.tasks[0].due,r.tasks[0].dueNote],['2026-11-25','23.11.2026']);
  const owner={before:board([t('a',{owner:'Иван',ownerNote:''})]),after:board([t('a',{owner:'Софа',ownerNote:''})])};
  const o=revertRecord(board([t('a',{owner:'Софа',ownerNote:'Софа'})]),owner);
  assert.equal(o.tasks[0].owner,'Иван');assert.equal(o.skipped,0);
});

test('a task a colleague deleted is not counted as skipped when the step did not touch it',()=>{
  const record={before:board([t('a'),t('b')]),after:board([t('a',{priority:'plan'}),t('b')])};
  const r=revertRecord(board([t('a',{priority:'plan'})]),record);
  assert.equal(r.skipped,0);assert.equal(r.tasks[0].priority,'do');
});
