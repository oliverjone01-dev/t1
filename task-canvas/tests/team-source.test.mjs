import test from 'node:test';
import assert from 'node:assert/strict';
import {TeamSourceBridge} from '../public/team-source.mjs';
const fixture=()=>{
 let now=1000000,calls=[],delays=[];
 const engine={connected:true,clientId:'one-bridge',actor:{},entries:new Map(),owners:[],rawConflicts:[],status:'synced',message:'',state:()=>{},sourceState:{status:'pending',checkedAt:0},api:{read:async()=>({records:[],board:{tasks:[],owners:[]}})},repository:{acquireBridge:async()=>true,sourceState:async(...args)=>calls.push(args)}};
 const bridge=new TeamSourceBridge(engine,{now:()=>now});bridge.running=true;bridge.later=delay=>delays.push(delay);
 return {engine,bridge,calls,delays,advance:ms=>now+=ms};
};
test('unchanged Sheet polls keep 30-second checks but publish one heartbeat per five minutes',async()=>{
 const f=fixture();await f.bridge.tick();assert.equal(f.calls.length,1);
 for(let i=0;i<9;i++){f.advance(30000);await f.bridge.tick()}
 assert.equal(f.calls.length,1);f.advance(30000);await f.bridge.tick();assert.equal(f.calls.length,2);
 assert.ok(f.delays.every(ms=>ms===30000));assert.equal(f.engine.sourceState.checkedAt,1300000);
});
test('a source quota refusal does not issue a second failing status write and retries with backoff',async()=>{
 const f=fixture();f.engine.api.read=async()=>{throw Object.assign(new Error('quota'),{code:'resource-exhausted'})};
 for(let i=0;i<4;i++)await f.bridge.tick();
 assert.deepEqual(f.delays,[60000,120000,240000,300000]);assert.equal(f.calls.length,0);assert.equal(f.engine.sourceState.status,'offline');
 f.engine.api.read=async()=>({records:[],board:{tasks:[],owners:[]}});await f.bridge.tick();assert.equal(f.delays.at(-1),30000);assert.equal(f.calls.length,1);
});
