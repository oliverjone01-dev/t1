import test from 'node:test';import assert from 'node:assert/strict';
import {SyncEngine} from '../public/sync-engine.mjs';
import {googleStatusLabel} from '../public/sync-indicator.mjs';
const clone=structuredClone;
test('queued progress, sending and network failure never ask to renew authentication; an actual auth error does',async()=>{
 let here={tasks:[{id:'t',title:'Проверка',status:'В ожидании',owner:'',due:'',positions:{},progress:0}],owners:[]},there=clone(here),failure=null;const seen=[];
 const api={read:async()=>{if(failure)throw failure;return {board:clone(there)}},write:async(_,writes)=>{for(const w of writes)if(w.task)there.tasks=there.tasks.map(t=>t.id===w.id?clone(w.task):t)}};
 const engine=new SyncEngine({api,getLocal:()=>here,apply:b=>here=clone(b),onState:s=>seen.push({status:s.status,label:googleStatusLabel(s,{editing:true,remembered:true})}),schedule:()=>0,cancel:()=>{}});
 await engine.connect();here.tasks[0].progress=26;engine.changed();assert.equal(seen.at(-1).status,'pending');assert.equal(seen.at(-1).label,'Google · сохраняем');
 await engine.flush();assert.equal(there.tasks[0].progress,26);assert.equal(seen.at(-1).label,'Google · сохранено');
 failure=new Error('Временная ошибка сети');await engine.flush();assert.equal(seen.at(-1).status,'offline');assert.doesNotMatch(seen.at(-1).label,/доступ|войти/i);
 assert.ok(seen.filter(s=>['pending','syncing','synced','offline'].includes(s.status)).every(s=>!/доступ|войти/i.test(s.label)));
 failure=Object.assign(new Error('Grant expired'),{auth:true});await engine.flush();assert.equal(seen.at(-1).status,'signin');assert.equal(seen.at(-1).label,'Google · обновить доступ');
 failure=null;await engine.connect();assert.equal(seen.at(-1).label,'Google · сохранено');assert.equal(here.tasks[0].progress,26);
});
test('conflicts and queue errors retain their own action without impersonating sign-out',()=>{
 for(const status of ['pending','syncing','offline','conflict','cache-error','local','unknown'])assert.doesNotMatch(googleStatusLabel({status},{editing:true,remembered:true}),/обновить доступ|войти/i);
 assert.match(googleStatusLabel({status:'signin'},{remembered:false}),/Войти/);
 assert.equal(googleStatusLabel({status:'syncing',pending:0}),'Google · проверка');
});
