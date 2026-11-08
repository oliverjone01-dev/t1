import test from 'node:test';
import assert from 'node:assert/strict';
import {clampMapZoom,zoomMapAt,fitMap,overviewLayout,groupDigest} from '../public/board-camera.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const groups=['inbox','now','plan','delegate','later','status:done','status:cancelled'].map(id=>({id}));
test('zoom preserves the world point under the cursor and obeys limits',()=>{
 const camera={x:-240,y:80,z:.5},point={x:360,y:220};
 for(const zoom of [.01,.8,1,12,NaN]){
  const next=zoomMapAt(camera,zoom,point);
  close((point.x-next.x)/next.z,(point.x-camera.x)/camera.z);
  close((point.y-next.y)/next.z,(point.y-camera.y)/camera.z);
  assert.ok(next.z>=.18&&next.z<=2);
 }
 assert.equal(clampMapZoom(NaN),1);
});
test('fit shows the entire world with margins in desktop and mobile viewports',()=>{
 for(const compact of [false,true]){
  const world=overviewLayout(groups,{},compact);
  const [w,h]=compact?[390,560]:[1024,560];
  const c=fitMap(world,w,h);
  assert.ok(c.x>=24-1e-8&&c.y>=24-1e-8);
  assert.ok(c.x+world.w*c.z<=w-24+1e-8);
  assert.ok(c.y+world.h*c.z<=h-24+1e-8);
 }
});
test('all seven zones remain fixed and separate even when one contains thousands of tasks',()=>{
 for(const compact of [false,true]){
  const layout=overviewLayout(groups,{},compact);
  assert.deepEqual(overviewLayout(groups,{now:5000},compact),layout);
  assert.equal(layout.zones.length,7);
  for(const a of layout.zones){
   assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=layout.w&&a.y+a.h<=layout.h+1e-8);
   for(const b of layout.zones.filter(b=>b!==a))assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y+1e-8||b.y+b.h<=a.y+1e-8);
  }
 }
});
test('overview summarizes owner load and open overdue tasks without altering input',()=>{
 const tasks=[{owner:'Катя',due:'2026-11-01',status:'В работе'},{owner:'Катя',due:'2026-11-02',status:'Готово'},{owner:'Иван',due:'2026-11-01',status:'Отменено'},{owner:'',due:''}];
 const original=structuredClone(tasks),d=groupDigest(tasks,'2026-11-08');
 assert.equal(d.overdue,1);assert.equal(d.scheduled,3);assert.deepEqual(d.owners[0],['Катя',2]);assert.ok(d.owners.some(([n,c])=>n==='Не назначен'&&c===1));assert.deepEqual(tasks,original);
});
