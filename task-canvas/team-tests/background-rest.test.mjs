import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import * as sdk from 'firebase/firestore';
import {FirestoreRest} from '../background/firestore-rest.mjs';
import {TeamApi,digest} from '../public/team-api.mjs';
import {seedEntry,makeOperation} from '../public/team-model.mjs';
import {TeamSourceBridge} from '../public/team-source.mjs';
const PROJECT='demo-background-worker',BOARD='1qh-pi5I76k8ssUc6DxjeytFDrAta1N4ZdmVjaUFCUYY',actor={uid:'background-worker',name:'Google Таблица · фон',clientId:'script'};
const task={id:'background-card',title:'Исходная',status:'В работе',owner:'Иван',due:'',priority:'do',positions:{}};
let env,db,ref,loseCommit=false,queries=[];
function request(url,body){
 assert.ok(url.startsWith(`https://firestore.googleapis.com/v1/projects/${PROJECT}/`));
 if(url.endsWith(':runQuery'))queries.push(body);
 const target=url.replace('https://firestore.googleapis.com','http://127.0.0.1:8188');
 const input=['--silent','--show-error','--max-time','15','--header','Authorization: Bearer owner','--header','Content-Type: application/json'];
 if(body)input.push('--request','POST','--data-binary',JSON.stringify(body));input.push(target);
 const raw=execFileSync('curl',input,{encoding:'utf8'});let result;
 try{result=JSON.parse(raw)}catch{throw new Error('Invalid emulator response: '+raw.slice(0,150))}
 if(result.error)throw Object.assign(new Error(result.error.message),{code:{ABORTED:'aborted',FAILED_PRECONDITION:'aborted',NOT_FOUND:'not-found'}[result.error.status]||'internal',status:result.error.code});
 if(loseCommit&&url.endsWith(':commit')&&body.writes?.some(w=>w.update?.name.includes('/operations/'))){loseCommit=false;throw Object.assign(new Error('Lost acknowledgement'),{code:'unavailable'})}
 return result;
}
function client(uid=actor.uid){const rest=new FirestoreRest({project:PROJECT,board:BOARD,request}),api=new TeamApi({boardId:BOARD,sdk:rest.sdk(),db:{},user:{uid}});return {rest,api}}
before(async()=>{env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:8188,rules:"rules_version = '2'; service cloud.firestore {match /databases/{db}/documents/{document=**} {allow read,write: if true;}}"}});db=env.unauthenticatedContext().firestore()});
after(async()=>env.cleanup());
beforeEach(async()=>{
 await env.clearFirestore();queries=[];loseCommit=false;
 ref=sdk.doc(db,'taskBoards',BOARD,'tasks',await digest(task.id));
 const entry=seedEntry(task);
 await sdk.setDoc(ref,{...entry,updatedAt:sdk.serverTimestamp(),sheet:{present:true,task:entry.task,versions:entry.versions,revision:1,lifeVersion:entry.lifeVersion},sheetAck:'seed'});
 await sdk.setDoc(sdk.doc(db,'taskBoards',BOARD),{ready:true});
 await sdk.setDoc(sdk.doc(db,'taskBoards',BOARD,'meta','lanes'),{items:[],revision:1});
 await sdk.setDoc(sdk.doc(db,'taskBoards',BOARD,'meta','source'),{status:'synced',checkedAt:1});
 await sdk.setDoc(sdk.doc(db,'taskBoardViews',BOARD),{ready:true});
 await sdk.setDoc(sdk.doc(db,'taskBoardViews',BOARD,'tasks',await digest(task.id)),{schema:1,revision:1,task:entry.task});
});
test('REST worker commits task, immutable history, public projection and receipt atomically; lost reply is idempotent',async()=>{
 const {rest,api}=client();await rest.refresh();const entry=(await api.read()).entries[0];
 const op=makeOperation(entry,{...entry.task,title:'Фоновое изменение'},{id:'background-once',actor});
 loseCommit=true;await assert.rejects(api.submit(op),/Lost acknowledgement/);
 const result=await api.submit(op);assert.equal(result.revision,2);
 const saved=(await sdk.getDoc(ref)).data(),published=(await sdk.getDoc(sdk.doc(db,'taskBoardViews',BOARD,'tasks',ref.id))).data();
 assert.equal(saved.task.title,'Фоновое изменение');assert.deepEqual(saved.task,published.task);
 assert.equal((await sdk.getDocs(sdk.collection(ref,'versions'))).size,1);
 await rest.refresh();assert.equal((await api.read()).entries[0].task.title,'Фоновое изменение');
});
test('the existing source algorithm retains a concurrent team title and imports a different Sheet field through REST',async()=>{
 const {rest,api}=client();await rest.refresh();let remote=await api.read();
 const initial=remote.entries[0],team=client('team-user');
 await team.api.submit(makeOperation(initial,{...initial.task,title:'Версия команды'},{id:'background-team-title',actor:{uid:'team-user',name:'Участник',clientId:'device'}}));
 await rest.refresh();remote=await api.read();
 let source={records:[{id:task.id,task:{...initial.task,title:'Версия таблицы',comment:'Комментарий таблицы'},archived:false,row:3}],board:{tasks:[{...initial.task,title:'Версия таблицы',comment:'Комментарий таблицы'}],owners:[]}};
 const engine={repository:api,clientId:'worker',actor,entries:new Map(remote.entries.map(e=>[e.task.id,e])),owners:[],rawConflicts:[],connected:true,sourceState:{},status:'synced',state:()=>{},api:{read:async()=>structuredClone(source),write:async()=>{throw new Error('Conflicting field must not be projected')}}};
 const bridge=new TeamSourceBridge(engine);bridge.running=true;bridge.later=()=>{};
 await bridge.tick();assert.equal(engine.sourceState.status,'synced',engine.sourceState.message);
 const current=(await sdk.getDoc(ref)).data();assert.equal(current.task.title,'Версия команды');assert.equal(current.task.comment,'Комментарий таблицы');
 const conflicts=await sdk.getDocs(sdk.collection(db,'taskBoards',BOARD,'conflicts'));assert.equal(conflicts.size,1);assert.equal(conflicts.docs[0].data().local.title,'Версия таблицы');
});
test('a warm worker queries only task changes and sees archives without reloading the full collection',async()=>{
 const {rest}=client();await rest.refresh();const first=rest.snapshot();
 const warm=new FirestoreRest({project:PROJECT,board:BOARD,request,seed:first});await warm.refresh();
 assert.equal(queries.at(-1).structuredQuery.where.fieldFilter.field.fieldPath,'updatedAt');
 assert.equal((await warm.docs(warm.ref(`taskBoards/${BOARD}/tasks`))).docs.length,1);
 await sdk.updateDoc(ref,{archived:true,updatedAt:sdk.serverTimestamp()});await warm.refresh();
 assert.equal((await warm.docs(warm.ref(`taskBoards/${BOARD}/tasks`))).docs[0].data().archived,true);
});
test('server timestamp transforms and partial checkpoint writes do not overwrite business fields',async()=>{
 const {rest}=client();await rest.refresh();
 await rest.transaction(async tx=>{const r=rest.ref(`taskBoards/${BOARD}/tasks/${ref.id}`);await tx.get(r);tx.update(r,{sheetAck:'checkpoint',updatedAt:rest.sdk().serverTimestamp()})});
 const current=(await sdk.getDoc(ref)).data();assert.equal(current.task.title,'Исходная');assert.equal(current.sheetAck,'checkpoint');assert.ok(current.updatedAt.toMillis()>0);
});
