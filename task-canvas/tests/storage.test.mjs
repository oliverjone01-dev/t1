import test from 'node:test';
import assert from 'node:assert/strict';
import {dataSignature,writeBoard} from '../public/storage.mjs';
const base={version:1,tasks:[{id:'1',title:'Сохранённая задача'}],owners:[],camera:{x:0,y:0,z:1}};
function memory(initial) { let raw=initial;return {getItem(){return raw},setItem(key,value){raw=value}}; }
test('storage quota failure reports an unsaved result and keeps the previous copy',()=>{
  const raw=JSON.stringify(base);const storage={getItem(){return raw},setItem(){throw new Error('QuotaExceededError')}};
  assert.equal(writeBoard(storage,'key',{...base,tasks:[]},dataSignature(base)).ok,false);
  assert.equal(storage.getItem(),raw);
});
test('stale tab cannot overwrite newer tasks, while another camera position is safe',()=>{
  const current={...base,tasks:[{id:'2',title:'Правка другой вкладки'}]};const storage=memory(JSON.stringify(current));
  const result=writeBoard(storage,'key',base,dataSignature(base)); assert.equal(result.reason,'conflict');assert.deepEqual(JSON.parse(storage.getItem()).tasks,current.tasks);
  const cameraOnly=memory(JSON.stringify({...base,camera:{x:300,y:200,z:.5}}));
  assert.equal(writeBoard(cameraOnly,'key',base,dataSignature(base)).ok,true);
});
test('external clearing and corrupt storage cannot be overwritten silently',()=>{
  assert.equal(writeBoard(memory(null),'key',base,dataSignature(base)).reason,'conflict');
  assert.equal(writeBoard(memory('{broken'),'key',base,dataSignature(base)).ok,false);
});
test('first write and subsequent edits can round-trip through validation',()=>{
  const storage=memory(null),result=writeBoard(storage,'key',base,dataSignature({tasks:[],owners:[]}));
  assert.equal(result.ok,true);assert.equal(result.signature,dataSignature(JSON.parse(storage.getItem())));
});
