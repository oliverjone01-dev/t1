import test from 'node:test';
import assert from 'node:assert/strict';
import {composeReport, reportPreferences} from '../public/weekly-report-model.mjs';

const week='2026-11-23', prior='2026-11-16';
const task=(id,fields={})=>({id,due:'2026-11-24',status:'В работе',...fields});

test('report uses live date overlap for plan and preserves the closed result when a status changes',()=>{
  const before=task('reopened',{due:'2026-11-19'}), done={...before,status:'Готово'};
  const data={
    tasks:[task('reopened'),task('old',{due:'2026-11-20'}),task('spans',{start:'2026-11-20',due:'2026-12-02'}),task('done',{status:'Готово'}),task('archive',{archived:true}),task('start',{start:week,due:''})],
    snapshots:[{week:prior,kind:'plan',tasks:[before]},{week:prior,kind:'fact',tasks:[done]}],
    events:[{id:before.id,previousAt:'2026-11-19T08:00:00Z',observedAt:'2026-11-19T08:05:00Z',from:before,to:done}],
  };
  const report=composeReport(data,{week,currentWeek:week,prefs:reportPreferences()});
  assert.deepEqual(report.planRows.map(t=>t.id),['reopened','spans','start']);
  assert.equal(report.factRows[0].outcome,'done');
  assert.equal(report.factRows[0].liveStatus,'В работе');
  assert.equal(report.fact.done,1);
});

test('a plan selection can add an out-of-range task and hide a default without mutating either source',()=>{
  const data={tasks:[task('default'),task('later',{due:'2026-12-01'}),task('undated',{due:''})],snapshots:[],events:[]};
  const prefs=reportPreferences({rules:{undated:true},weeks:{[week]:{plan:{default:false,later:true}}}});
  const report=composeReport(data,{week,currentWeek:week,prefs});
  assert.deepEqual(report.planRows.map(t=>[t.id,!!t.manual]),[['undated',false],['later',true]]);
  assert.deepEqual(data.tasks.map(t=>t.id),['default','later','undated']);
  assert.equal(report.fact.historical,true);
});

test('archived plan selection uses that week’s snapshot instead of unrelated live tasks',()=>{
  const data={tasks:[task('live')],snapshots:[{week,kind:'plan',tasks:[task('snapshot')]}],events:[]};
  const report=composeReport(data,{week,currentWeek:'2026-11-30',prefs:reportPreferences()});
  assert.deepEqual(report.planRows.map(t=>[t.id,t.liveStatus]),[['snapshot','Нет на доске']]);
});
