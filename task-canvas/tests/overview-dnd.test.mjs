import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewPlacement,neighboringZone,edgeVelocity} from '../public/overview-dnd.mjs';
import {overviewLayout,focusMapZone} from '../public/board-camera.mjs';
import {QUADRANTS,STATUS_LANES,groupFor,validateBoard} from '../public/model.mjs';
import {ordered,reorderTasks} from '../public/order.mjs';
const today='2026-11-08',groups=[{id:'inbox'},...QUADRANTS,...STATUS_LANES];
const tasks=validateBoard(['a','b','c','d'].map((id,i)=>({id,title:id,owner:'Иван',due:'2026-11-12',status:'В работе',priority:i===3?'plan':'do',positions:{priority:{group:i===3?'plan':'do',x:24,y:96+i*100}}})));
const drop=(targetId,ids=['d'],extra={})=>overviewPlacement({targetId,ids,tasks,today,...extra});
const order=(board,group)=>ordered(board.filter(t=>groupFor(t,'priority',today)===group),'priority',today).map(t=>t.id);
test('a pointer drop identifies the exact slot at every camera zoom',()=>{
 for(const zoom of [.25,.5,1,1.4]){
  const top=110*zoom,height=64*zoom,rect={top,height};
  assert.deepEqual(drop('b',['d'],{rect,pointerY:top+height*.2}),{group:'do',before:'b',after:false});
  assert.deepEqual(drop('b',['d'],{rect,pointerY:top+height*.8}),{group:'do',before:'c',after:true});
 }
});
test('same-zone reordering excludes the moving block when finding its next neighbour',()=>{
 const place=drop('c',['a','b'],{rect:{top:100,height:64},pointerY:160});
 assert.equal(place.before,null);
 assert.deepEqual(order(reorderTasks(tasks,['a','b'],{id:place.group},place.before,today),'do'),['c','a','b']);
});
test('dropping into an empty quadrant changes only priority and its order',()=>{
 const place=drop('zone:delegate');
 const result=reorderTasks(tasks,['d'],groups.find(g=>g.id===place.group),place.before,today);
 assert.equal(result[3].priority,'delegate');assert.equal(result[3].owner,'Иван');assert.equal(result[3].due,'2026-11-12');assert.equal(result[3].status,'В работе');
 assert.deepEqual(result.slice(0,3),tasks.slice(0,3));
});
test('overview completion and cancellation preserve assignment, deadline and priority',()=>{
 for(const id of ['status:done','status:cancelled']){
  const place=drop('zone:'+id),result=reorderTasks(tasks,['d'],groups.find(g=>g.id===place.group),place.before,today);
  assert.equal(groupFor(result[3],'priority',today),id);assert.equal(result[3].priority,'plan');assert.equal(result[3].owner,'Иван');assert.equal(result[3].due,'2026-11-12');
 }
});
test('stale, self and outside targets never silently append a task',()=>{
 assert.equal(drop('missing'),null);assert.equal(drop('d'),null);assert.equal(drop(null),null);assert.equal(drop('a',[]),null);
});
test('keyboard placement keeps directional ordering without a pointer',()=>{
 assert.equal(drop('c',['d','a'],{activeId:'a'}).before,null);assert.equal(drop('c',['a']).before,null);assert.equal(drop('a',['c']).before,'a');assert.equal(drop('a',['d']).before,'a');
});
test('keyboard neighbours follow quadrant geometry and reach empty and status zones',()=>{
 const {zones}=overviewLayout(groups);
 assert.equal(neighboringZone(zones,'do','ArrowRight'),'plan');
 assert.equal(neighboringZone(zones,'do','ArrowDown'),'delegate');
 assert.equal(neighboringZone(zones,'delegate','ArrowRight'),'later');
 assert.equal(neighboringZone(zones,'inbox','ArrowDown'),'status:done');
 assert.equal(neighboringZone(zones,'status:done','ArrowDown'),'status:cancelled');
 assert.equal(neighboringZone(zones,'do','ArrowLeft'),null);
});
test('edge pan is bounded, follows the cursor and stops outside the board',()=>{
 const rect={left:100,right:500,top:100,bottom:500};
 assert.deepEqual(edgeVelocity({x:300,y:300},rect),{x:0,y:0});
 assert.deepEqual(edgeVelocity({x:99,y:300},rect),{x:0,y:0});
 const left=edgeVelocity({x:105,y:300},rect),bottom=edgeVelocity({x:300,y:495},rect);
 assert.ok(left.x>0&&left.x<=10);assert.equal(left.y,0);assert.ok(bottom.y<0&&bottom.y>=-10);
});
test('focusing a quadrant stays in the overview coordinate system and fits its bounds',()=>{
 const zone=overviewLayout(groups).zones.find(g=>g.id==='plan'),c=focusMapZone(zone,1000,560);
 const x=c.x+zone.x*c.z,y=c.y+zone.y*c.z;
 assert.ok(x>=24&&y>=24);assert.ok(x+zone.w*c.z<=976+1e-8);assert.ok(y+zone.h*c.z<=536+1e-8);
});
