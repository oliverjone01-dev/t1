import {TeamApi} from '../public/team-api.mjs';
import {TeamSourceBridge} from '../public/team-source.mjs';
import {SheetsApi} from '../public/sheets-api.mjs';
import {modePending} from '../public/storage-mode.mjs';
import {FirestoreRest} from './firestore-rest.mjs';
export const CONFIG=Object.freeze({project:'my-project-1539119750357',board:'1qh-pi5I76k8ssUc6DxjeytFDrAta1N4ZdmVjaUFCUYY',protocol:1,intervalMinutes:5});
export function installPolyfills(g){
 if(!globalThis.structuredClone)globalThis.structuredClone=v=>JSON.parse(JSON.stringify(v));
 if(!globalThis.TextEncoder)globalThis.TextEncoder=class{encode(s){return new Uint8Array(g.Utilities.newBlob(s).getBytes())}};
 if(!globalThis.crypto)globalThis.crypto={randomUUID:()=>g.Utilities.getUuid(),subtle:{digest:async(_,bytes)=>new Uint8Array(g.Utilities.computeDigest(g.Utilities.DigestAlgorithm.SHA_256,[...bytes].map(x=>x>127?x-256:x))).buffer}};
 if(!globalThis.URLSearchParams)globalThis.URLSearchParams=class{constructor(v){this.v=v}toString(){return Object.entries(this.v).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&')}};
 if(!Array.prototype.at)Array.prototype.at=function(n){return this[n<0?this.length+n:n]};
}
export function createHttp({fetch,token,project=CONFIG.project,board=CONFIG.board,deadline=Infinity,now=()=>Date.now(),stats={calls:0}}){
 return (url,body)=>{
  if(now()>deadline)throw Object.assign(new Error('Run budget reached; resume next tick.'),{code:'deadline-exceeded'});
  const allowed=[`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`,`https://sheets.googleapis.com/v4/spreadsheets/${board}`];
  if(!allowed.some(p=>url===p||url.startsWith(p+'/')||url.startsWith(p+':')||url.startsWith(p+'?')))throw new Error('Unexpected Google API destination');
  stats.calls++;
  const r=fetch(url,{method:body?'post':'get',headers:{Authorization:'Bearer '+token()},contentType:'application/json',...(body?{payload:JSON.stringify(body)}:{}),muteHttpExceptions:true,followRedirects:false});
  const status=r.getResponseCode();let data;try{data=JSON.parse(r.getContentText())}catch{data=null}
  if(status<200||status>=300){const code={401:'unauthenticated',403:'permission-denied',404:'not-found',409:'aborted',412:'aborted',429:'resource-exhausted',503:'unavailable'}[status]||'internal';throw Object.assign(new Error(status===429?'Google quota reached; background sync will retry later.':data?.error?.message||`Google API error ${status}`),{status,code,auth:status===401})}
  if(data===null)throw new Error('Invalid Google API response');return data;
 };
}
export class PackedCache {
 constructor(cache,utilities){this.c=cache;this.u=utilities}
 read(){try{const m=JSON.parse(this.c.get('task-canvas-cache-manifest')||'null');if(!m||m.schema!==1||m.chunks<1||m.chunks>100)return null;const keys=Array.from({length:m.chunks},(_,i)=>m.id+':'+i),parts=this.c.getAll(keys);if(keys.some(k=>typeof parts[k]!=='string'))return null;return JSON.parse(this.u.ungzip(this.u.newBlob(this.u.base64Decode(keys.map(k=>parts[k]).join('')))).getDataAsString())}catch{return null}}
 write(snapshot){const text=this.u.base64Encode(this.u.gzip(this.u.newBlob(JSON.stringify(snapshot))).getBytes()),id='task-canvas-cache:'+this.u.getUuid(),values={},chunks=Math.ceil(text.length/80000);if(chunks>100)throw new Error('Cache capacity exceeded; cursor not advanced.');for(let i=0;i<chunks;i++)values[id+':'+i]=text.slice(i*80000,(i+1)*80000);this.c.putAll(values,21600);this.c.put('task-canvas-cache-manifest',JSON.stringify({schema:1,id,chunks}),21600)}
}
export function createWorker(g,{now=()=>Date.now(),logger=m=>console.log(m)}={}){
 installPolyfills(g);
 const props=g.PropertiesService.getScriptProperties(),scriptId=g.ScriptApp.getScriptId(),owner=()=>g.Session.getEffectiveUser().getEmail().toLowerCase(),rootPath=`taskBoards/${CONFIG.board}`,clientId='apps-script-'+scriptId.slice(-32),actor={uid:clientId,name:'Google Таблица · фон',clientId};
 function connection(deadline=now()+100000,seed=null){
  let token;const stats={calls:0},request=createHttp({fetch:(...a)=>g.UrlFetchApp.fetch(...a),token:()=>token??=g.ScriptApp.getOAuthToken(),deadline,now,stats});
  const rest=new FirestoreRest({...CONFIG,request,now,sleep:ms=>g.Utilities.sleep(ms),seed}),sdk=rest.sdk();
  class BackgroundRepository extends TeamApi {
   async transact(fn){return rest.transaction(fn)}
   async acquireBridge(holder){return rest.transaction(async tx=>{await tx.get(this.ref('meta','bridgeLease'));tx.set(this.ref('meta','bridgeLease'),{holder,protocol:4,uid:actor.uid,acquiredAt:sdk.serverTimestamp()});return true})}
   async sourceState(status,message='',checkedAt=now()){await super.sourceState(status,message,checkedAt);props.setProperty('sourcePublished',JSON.stringify({status,checkedAt}))}
  }
  class BackgroundSheets extends SheetsApi {
   async request(path,body){return request(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.board}`+path,body)}
   async write(snapshot,writes,owners){
    const control=await this.readStorageControl();
    if(control.request.mode!=='firestore'||(this.expectedEpoch&&control.request.epoch!==this.expectedEpoch))throw new Error('Storage mode changed; Sheet projection paused.');
    return super.write(snapshot,writes,owners);
   }
  }
  return {rest,repository:new BackgroundRepository({boardId:CONFIG.board,sdk,db:{},user:{uid:actor.uid,email:owner(),displayName:actor.name}}),sheets:new BackgroundSheets(null),stats};
 }
 async function probe(){const c=connection(),root=await c.rest.get(c.rest.ref(rootPath));if(!root.exists()||root.data().ownerEmail!==owner())throw new Error('Only the board owner can configure background sync.');const sheet=await c.sheets.read();return {c,root,sheet}}
 async function prepare(){
  let sheet,ownerCheck='confirmed';try{({sheet}=await probe())}catch(error){if(error.code!=='resource-exhausted')throw error;sheet=await connection().sheets.read();ownerCheck='deferred-quota';}
  const existing=g.ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='syncTasksInBackground'&&String(t.getEventType())==='CLOCK');
  // One cheap Sheet control check/minute; Firestore exchange stays five minutes.
  // Rebuild only when upgrading the timer, then retain the one existing clock.
  if(props.getProperty('timerProtocol')!=='2'||!existing.length){
   for(const t of existing)g.ScriptApp.deleteTrigger(t);
   g.ScriptApp.newTrigger('syncTasksInBackground').timeBased().everyMinutes(1).create();props.setProperty('timerProtocol','2');
  }else for(const t of existing.slice(1))g.ScriptApp.deleteTrigger(t);
  props.setProperty('prepared',JSON.stringify({scriptId,owner:owner(),ownerCheck,protocol:1,at:now()}));
  const result={status:'prepared',scriptId,ownerCheck,intervalMinutes:5,sheetTitle:sheet.title};logger(JSON.stringify(result));return result;
 }
 async function activate(){
  const p=JSON.parse(props.getProperty('prepared')||'null');if(p?.scriptId!==scriptId||p.owner!==owner())throw new Error('Run prepareBackgroundSync first.');
  if(!g.ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='syncTasksInBackground'&&String(t.getEventType())==='CLOCK'))throw new Error('Timer missing.');
  const {c,root}=await probe();if(root.data().backgroundProtocol!==1)throw new Error('Deploy the browser lease fence before activation.');const background={provider:'apps-script',enabled:true,protocol:1,scriptId,intervalMinutes:5,startAfter:now()+150000};
  if(root.data().background?.enabled&&root.data().background.scriptId===scriptId)return {status:'already-active'};
  await c.rest.commit([{...c.rest.write(c.rest.ref(rootPath),{background},'update'),currentDocument:{updateTime:root.updateTime}},c.rest.write(c.rest.ref(`taskBoardViews/${CONFIG.board}`),{background:{provider:'apps-script',intervalMinutes:5}},'update')]);
  props.deleteProperty('nextRunAt');props.setProperty('lastRun',JSON.stringify({status:'handoff-wait',at:now(),nextRunAt:background.startAfter}));logger('Activated; browser writers fenced, first write waits 150 seconds.');return {status:'handoff-wait',startAfter:background.startAfter};
 }
 async function run(){
  const lock=g.LockService.getScriptLock();if(!lock.tryLock(1))return {status:'busy'};
  const start=now();props.setProperty('lastTick',String(start));let c,status='error',result;
  try{
   const prepared=JSON.parse(props.getProperty('prepared')||'null');
   if(prepared?.owner!==owner()||prepared?.scriptId!==scriptId)throw new Error('Worker owner is not prepared.');
   const packed=new PackedCache(g.CacheService.getScriptCache(),g.Utilities),seed=packed.read();c=connection(start+100000,seed?.scriptId===scriptId?seed.snapshot:null);
   const control=await c.sheets.readStorageControl(),requested=control.request;
   if(props.getProperty('requestedEpoch')!==requested.epoch){props.setProperty('requestedEpoch',requested.epoch);props.deleteProperty('nextRunAt')}
   const mirror=async mode=>{
    await c.rest.commit([c.rest.write(c.rest.ref(rootPath),{storageMode:mode,storageEpoch:requested.epoch},'update'),c.rest.write(c.rest.ref(`taskBoardViews/${CONFIG.board}`),{storageMode:mode,storageEpoch:requested.epoch},'update')]);
   };
   const acknowledge=async()=>{
    const latest=await c.sheets.readStorageControl();
    if(latest.request.epoch!==requested.epoch)throw new Error('Storage request superseded; will retry the latest choice.');
    await c.sheets.acknowledgeStorageMode(requested);props.setProperty('modeAck',requested.epoch);
   };
   if(requested.mode==='sheets'){
    if(modePending(control)||props.getProperty('modeAck')!==requested.epoch){await mirror('sheets');await acknowledge();}
    props.setProperty('quotaAttempts','0');status='sheets-only';result={status,at:now(),mode:'sheets',calls:c.stats.calls};return result;
   }
   const next=Number(props.getProperty('nextRunAt')||0);if(next>start)return {status:'backoff',nextRunAt:next};
   c.sheets.expectedEpoch=requested.epoch;
   const root=await c.rest.get(c.rest.ref(rootPath)),data=root.data(),bg=data?.background;
   if(data?.ownerEmail!==owner())throw new Error('The trigger owner no longer owns the board.');
   if(!bg?.enabled||bg.provider!=='apps-script'||bg.scriptId!==scriptId||bg.protocol!==1)return {status:'disabled'};
   if(start<bg.startAfter)return {status:'handoff-wait',nextRunAt:bg.startAfter};
   await c.rest.refresh();const remote=await c.repository.read();
   const engine={clientId,actor,connected:true,status:'synced',message:'',api:c.sheets,repository:c.repository,entries:new Map(remote.entries.map(e=>[e.task.id,e])),owners:remote.lanes.items||[],rawConflicts:remote.conflicts,sourceState:remote.source,state:()=>{}};
   const bridge=new TeamSourceBridge(engine,{now});bridge.running=true;bridge.later=()=>{};
   const last=JSON.parse(props.getProperty('sourcePublished')||'null');bridge.lastPublishedAt=last?.checkedAt||0;bridge.lastPublishedStatus=last?.status||null;
   await bridge.tick();
   if(engine.sourceState.status!=='synced')throw Object.assign(new Error(engine.sourceState.message||'Source sync failed'),{code:engine.sourceState.message?.includes('quota')?'resource-exhausted':'unavailable'});
   if(modePending(control)){await mirror('firestore');await acknowledge();}
   packed.write({scriptId,snapshot:c.rest.snapshot()});props.setProperty('quotaAttempts','0');status='synced';result={status,at:now(),calls:c.stats.calls,records:c.rest.tasks.size};return result;
  }catch(error){
   status=error.code==='resource-exhausted'?'quota-wait':'error';const attempts=Math.min(6,Number(props.getProperty('quotaAttempts')||0)+1);props.setProperty('quotaAttempts',String(attempts));
   const delay=status==='quota-wait'?Math.min(900000,300000*2**(attempts-1)):300000;props.setProperty('nextRunAt',String(now()+delay));result={status,at:now(),error:String(error.message||error).slice(0,600),nextRunAt:now()+delay};return result;
  }finally{
   if(result){if(status==='synced')props.setProperty('nextRunAt',String(now()+Math.max(300000,Math.max(1,now()-start)*24)));props.setProperty('lastRun',JSON.stringify({...result,durationMs:now()-start,calls:c?.stats.calls||0}));logger(JSON.stringify({...result,durationMs:now()-start}))}
   lock.releaseLock();
  }
 }
 async function stop(){
  const lock=g.LockService.getScriptLock();if(!lock.tryLock(1000))throw new Error('A sync run is still active; retry stop after it finishes.');
  try{
   const c=connection(),ref=c.rest.ref(rootPath),doc=await c.rest.get(ref);if(doc.data()?.ownerEmail!==owner()||doc.data()?.background?.scriptId!==scriptId)throw new Error('Only this worker owner can stop it.');
   await c.rest.commit([{...c.rest.write(ref,{background:{...doc.data().background,enabled:false}},'update'),currentDocument:{updateTime:doc.updateTime}},c.rest.write(c.rest.ref(`taskBoardViews/${CONFIG.board}`),{background:{provider:'browser',intervalMinutes:0}},'update')]);
   for(const t of g.ScriptApp.getProjectTriggers())if(t.getHandlerFunction()==='syncTasksInBackground')g.ScriptApp.deleteTrigger(t);return {status:'stopped'};
  }finally{lock.releaseLock()}
 }

 function check(){const result={scriptId,lastTick:Number(props.getProperty('lastTick')||0),lastRun:JSON.parse(props.getProperty('lastRun')||'null'),timerCount:g.ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='syncTasksInBackground'&&String(t.getEventType())==='CLOCK').length};logger(JSON.stringify(result));return result}
 return {prepare,activate,run,check,stop};
}
