import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {encode,decode,FirestoreRest,RestTimestamp} from '../background/firestore-rest.mjs';
import {CONFIG,createHttp,PackedCache,createWorker} from '../background/worker.mjs';
const U={newBlob:v=>({getBytes:()=>Array.from(typeof v==='string'?Buffer.from(v):v),getDataAsString:()=>Buffer.from(v).toString()}),gzip:b=>U.newBlob(gzipSync(Buffer.from(b.getBytes()))),ungzip:b=>U.newBlob(gunzipSync(Buffer.from(b.getBytes()))),base64Encode:v=>Buffer.from(v).toString('base64'),base64Decode:v=>Array.from(Buffer.from(v,'base64')),getUuid:()=>crypto.randomUUID(),sleep:()=>{}};
const memory=()=>{const values=new Map();return {values,get:k=>values.get(k)||null,getAll:ks=>Object.fromEntries(ks.filter(k=>values.has(k)).map(k=>[k,values.get(k)])),put:(k,v)=>values.set(k,v),putAll:o=>Object.entries(o).forEach(([k,v])=>values.set(k,v))}};
test('Firestore wire values retain arrays, maps, nulls and server timestamp precision',()=>{
 const v={title:'Иван',positions:{priority:{order:'a1V',x:24}},list:[null,true,42],updatedAt:new RestTimestamp('2026-11-08T00:00:00.123456Z')};
 const out=decode(encode(v));assert.equal(out.updatedAt.value,v.updatedAt.value);assert.deepEqual(out.positions,v.positions);assert.deepEqual(out.list,v.list);
});
test('worker HTTP guard refuses other projects, other spreadsheets, redirects and expired run budgets',()=>{
 let calls=0;const http=createHttp({fetch:()=>{calls++;return {getResponseCode:()=>200,getContentText:()=> '{}'}},token:()=> 'not-logged',deadline:100,now:()=>1});
 for(const url of ['https://evil.test/','https://firestore.googleapis.com/v1/projects/other/databases/(default)/documents','https://sheets.googleapis.com/v4/spreadsheets/'+CONFIG.board+'-other'])assert.throws(()=>http(url),/Unexpected/);
 assert.equal(calls,0);http('https://sheets.googleapis.com/v4/spreadsheets/'+CONFIG.board+'?fields=spreadsheetId');assert.equal(calls,1);
 assert.throws(()=>createHttp({fetch:()=>{},token:()=>'',deadline:0,now:()=>1})('https://sheets.googleapis.com/v4/spreadsheets/'+CONFIG.board),/budget/);
});
test('quota errors keep a machine-readable code without logging a token or raw HTML response',()=>{
 const http=createHttp({fetch:()=>({getResponseCode:()=>429,getContentText:()=> 'Quota exceeded.'}),token:()=> 'private-token'});
 assert.throws(()=>http('https://sheets.googleapis.com/v4/spreadsheets/'+CONFIG.board),e=>e.code==='resource-exhausted'&&!e.message.includes('private-token'));
});
test('cache is compressed, complete before its manifest and safely falls back after eviction',()=>{
 const m=memory(),cache=new PackedCache(m,U),value={cursor:'time',tasks:Array.from({length:1000},(_,i)=>({id:i,title:'Карточка '+i}))};
 cache.write(value);assert.deepEqual(cache.read(),value);
 const manifest=JSON.parse(m.get('task-canvas-cache-manifest'));m.values.delete(manifest.id+':0');assert.equal(cache.read(),null);
 m.values.set('task-canvas-cache-manifest','broken');assert.equal(cache.read(),null);
});
test('warm cache uses only changed tasks with a server-time overlap, including archives',async()=>{
 const root=`projects/${CONFIG.project}/databases/(default)/documents`,task={name:root+`/taskBoards/${CONFIG.board}/tasks/a`,fields:{title:{stringValue:'old'}}};let sent;
 const rest=new FirestoreRest({...CONFIG,seed:{cursor:'2026-11-07T20:00:00.000Z',tasks:[task]},request:(url,body)=>{sent=body;return [{document:{...task,fields:{title:{stringValue:'new'},archived:{booleanValue:true}}},readTime:'2026-11-07T20:01:00.123456Z'}]}});
 await rest.refresh();assert.equal(sent.structuredQuery.where.fieldFilter.value.timestampValue,'2026-11-07T20:00:00.000Z');
 assert.equal(rest.cursor,'2026-11-07T20:01:00.122Z');assert.equal((await rest.docs(rest.ref(`taskBoards/${CONFIG.board}/tasks`))).docs[0].data().archived,true);
 assert.throws(()=>rest.ref('taskBoards/'+CONFIG.board+'-other/tasks/a'),/Unexpected/);
});
test('a failed delta request cannot advance the cache cursor',async()=>{
 const rest=new FirestoreRest({...CONFIG,seed:{cursor:'prior',tasks:[]},request:()=>{throw Object.assign(new Error('quota'),{code:'resource-exhausted'})}});
 await assert.rejects(rest.refresh());assert.equal(rest.snapshot().cursor,'prior');
});
function harness({quota=false,enabled=false,owner='owner@example.test',script='private-script'}={}){
 const propsData=new Map(),cache=memory(),logs=[],stats={calls:0,releases:0};let clock=1000000;
 const props={getProperty:k=>propsData.get(k)||null,setProperty:(k,v)=>propsData.set(k,v),deleteProperty:k=>propsData.delete(k)};
 const g={Utilities:U,ScriptApp:{getScriptId:()=>script,getOAuthToken:()=> 'private-token',getProjectTriggers:()=>[]},PropertiesService:{getScriptProperties:()=>props},CacheService:{getScriptCache:()=>cache},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>stats.releases++})},Session:{getEffectiveUser:()=>({getEmail:()=>owner})},UrlFetchApp:{fetch:()=>{
  stats.calls++;if(quota)return {getResponseCode:()=>429,getContentText:()=> 'Quota exceeded'};
  return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({fields:{ownerEmail:{stringValue:'owner@example.test'},background:encode({enabled,provider:'apps-script',scriptId:'another-script',protocol:1,startAfter:0})}})};
 }}};
 return {g,worker:createWorker(g,{now:()=>clock,logger:m=>logs.push(m)}),props,stats,logs,advance:ms=>clock+=ms};
}
test('a copied script or disabled worker cannot acquire a lease or write the sheet',async()=>{
 for(const options of [{enabled:false},{enabled:true},{owner:'intruder@example.test'}]){
  const f=harness(options),result=await f.worker.run();assert.ok(['disabled','error'].includes(result.status));assert.equal(f.stats.calls,1);assert.equal(f.stats.releases,1);
 }
});
test('quota refusal leaves a durable retry time; subsequent trigger exits without Google calls',async()=>{
 const f=harness({quota:true});const result=await f.worker.run();assert.equal(result.status,'quota-wait');assert.equal(f.stats.calls,1);assert.equal(f.props.getProperty('lastTick'),'1000000');
 const second=await f.worker.run();assert.equal(second.status,'backoff');assert.equal(f.stats.calls,1);
 f.advance(300001);await f.worker.run();assert.equal(f.stats.calls,2);assert.equal(JSON.parse(f.props.getProperty('lastRun')).nextRunAt,1900001);assert.ok(f.logs.every(s=>!s.includes('private-token')));
});
