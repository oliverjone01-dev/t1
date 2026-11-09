import {SheetsApi} from '../public/sheets-api.mjs';
import {SHEET_ID} from '../public/sync-model.mjs';
import {GROUP_ID,processUpdates,appendRequests} from './intake.mjs';

// Private standalone Apps Script. No web app, webhook, Firebase or browser token.
if(typeof globalThis.URLSearchParams==='undefined')globalThis.URLSearchParams=class {
 constructor(values){this.values=values}
 toString(){return Object.entries(this.values).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}
};
if(typeof globalThis.structuredClone==='undefined')globalThis.structuredClone=value=>JSON.parse(JSON.stringify(value));
const props=()=>PropertiesService.getScriptProperties();
const get=key=>props().getProperty(`TELEGRAM_${key}`);
const set=(key,value)=>props().setProperty(`TELEGRAM_${key}`,String(value));
const remove=key=>props().deleteProperty(`TELEGRAM_${key}`);
const HANDLER='pollTelegramTasks';

function fetchJson(url,options,label){
 let response;
 try{response=UrlFetchApp.fetch(url,{...options,muteHttpExceptions:true,followRedirects:false})}
 catch{throw Error(`${label}_NETWORK`)} // Never propagate a URL containing the bot token.
 const status=response.getResponseCode();
 let data;try{data=JSON.parse(response.getContentText())}catch{throw Error(`${label}_RESPONSE`)}
 if(status<200||status>=300||data.ok===false){
  const retry=Number(data.parameters?.retry_after);
  if(label==='TELEGRAM'&&retry>0)set('RETRY_AFTER',Date.now()+Math.min(retry,86400)*1000);
  throw Error(`${label}_HTTP_${status}`);
 }
 return data;
}
class GoogleSheet extends SheetsApi {
 constructor(){super({})}
 async request(path,body){
  if(!path.startsWith('?')&&path!==':batchUpdate')throw Error('SHEETS_PATH_REJECTED');
  return fetchJson(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`,{
   method:body?'post':'get',headers:{Authorization:`Bearer ${ScriptApp.getOAuthToken()}`},
   ...(body?{contentType:'application/json',payload:JSON.stringify(body)}:{}),
  },'SHEETS');
 }
}
function telegram(method,body={}){
 if(!['getMe','getChat','getChatMember','getWebhookInfo','getUpdates'].includes(method))throw Error('TELEGRAM_METHOD_REJECTED');
 const token=get('BOT_TOKEN');
 if(!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token||''))throw Error('BOT_TOKEN_MISSING');
 return fetchJson(`https://api.telegram.org/bot${token}/${method}`,{method:'post',contentType:'application/json',payload:JSON.stringify(body)},'TELEGRAM').result;
}
function state(){return {
 offset:()=>Number(get('OFFSET')||0),setOffset:value=>set('OFFSET',value),
 pending:()=>{const n=Number(get('PENDING_PARTS')||0);if(!n)return null;let value='';for(let i=0;i<n;i++)value+=get(`PENDING_${i}`)||'';return JSON.parse(value)},
 setPending:value=>{
  const json=JSON.stringify(value),n=Math.ceil(json.length/1800);
  for(let i=0;i<n;i++)set(`PENDING_${i}`,json.slice(i*1800,(i+1)*1800));
  set('PENDING_PARTS',n); // Commit the outbox before submitting the append.
 },
 clearPending:()=>{const n=Number(get('PENDING_PARTS')||0);remove('PENDING_PARTS');for(let i=0;i<n;i++)remove(`PENDING_${i}`)},
}}
function config(){
 const owners=JSON.parse(get('OWNER_MAP')||'{"катя":"Екатерина Машкова"}');
 if(!owners||Array.isArray(owners)||typeof owners!=='object')throw Error('OWNER_MAP_INVALID');
 return {chatId:GROUP_ID,startedAt:Number(get('STARTED_AT')),botUsername:(get('BOT_USERNAME')||'').replace(/^@/,''),owners:Object.fromEntries(Object.entries(owners).map(([k,v])=>[k.toLocaleLowerCase('ru'),v]))};
}
async function locked(fn){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {busy:true};
 try{return await fn()}finally{lock.releaseLock()}
}
export async function prepare(){
 const me=telegram('getMe'),expected=get('BOT_USERNAME');
 if(!expected||me.username.toLowerCase()!==expected.replace(/^@/,'').toLowerCase())throw Error('BOT_USERNAME_MISMATCH');
 if(telegram('getWebhookInfo').url)throw Error('BOT_HAS_WEBHOOK_USE_A_DEDICATED_BOT');
 const chat=telegram('getChat',{chat_id:GROUP_ID});
 if(String(chat.id)!==GROUP_ID||!['group','supergroup'].includes(chat.type))throw Error('GROUP_MISMATCH');
 const member=telegram('getChatMember',{chat_id:GROUP_ID,user_id:me.id});
 if(!['member','administrator','creator'].includes(member.status))throw Error('ADD_BOT_TO_GROUP');
 if(!me.can_read_all_group_messages&&!['administrator','creator'].includes(member.status))throw Error('DISABLE_BOT_PRIVACY');
 config();
 const snapshot=await new GoogleSheet().read();
 return {bot:`@${me.username}`,groupId:GROUP_ID,sheet:SHEET_ID,tasks:snapshot.records.length,ready:true};
}
export async function start(){return locked(async()=>{
 const verified=await prepare();
 set('VERIFIED_BOT_ID',get('BOT_TOKEN').split(':')[0]);
 if(!get('STARTED_AT'))set('STARTED_AT',Math.floor(Date.now()/1000));
 if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()===HANDLER))ScriptApp.newTrigger(HANDLER).timeBased().everyMinutes(1).create();
 set('ENABLED','true');return {...verified,enabled:true};
})}
export async function run(){return locked(async()=>{
 if(get('ENABLED')!=='true')return {enabled:false};
 if(Number(get('RETRY_AFTER')||0)>Date.now())return {rateLimited:true};
 const began=Date.now();
 try{
  const cfg=config();if(!Number.isSafeInteger(cfg.startedAt)||cfg.startedAt<=0)throw Error('START_REQUIRED');
  if(get('BOT_TOKEN')?.split(':')[0]!==get('VERIFIED_BOT_ID'))throw Error('START_REQUIRED');
  const sheet=new GoogleSheet(),cursor=state();
  const updates=telegram('getUpdates',{offset:cursor.offset(),limit:50,timeout:0,allowed_updates:['message']});
  const result=await processUpdates(updates,{config:cfg,state:cursor,read:()=>sheet.read(),append:requests=>sheet.request(':batchUpdate',{requests}),shouldStop:()=>Date.now()-began>45000});
  set('LAST_OK',new Date().toISOString());set('LAST_ADDED',result.added);remove('LAST_ERROR');return result;
 }catch(error){
  // Sheet content/API responses can contain user text. Persist only a fixed error code.
  const code=String(error.message).match(/^(?:WRITE_UNCERTAIN|OWNER_MAP_INVALID|START_REQUIRED|BOT_TOKEN_MISSING|(?:TELEGRAM|SHEETS)_(?:NETWORK|RESPONSE|HTTP_\d+))\b/)?.[0]||'INTAKE_FAILED';
  set('LAST_ERROR',code);set('LAST_ERROR_AT',new Date().toISOString());throw Error(code);
 }
})}
export async function stop(){return locked(async()=>{
 set('ENABLED','false');for(const t of ScriptApp.getProjectTriggers())if(t.getHandlerFunction()===HANDLER)ScriptApp.deleteTrigger(t);
 return {enabled:false};
})}
export function check(){const pending=state().pending();return {
 enabled:get('ENABLED')==='true',groupId:GROUP_ID,bot:get('BOT_USERNAME'),lastSuccess:get('LAST_OK'),
 lastAdded:Number(get('LAST_ADDED')||0),lastError:get('LAST_ERROR'),lastErrorAt:get('LAST_ERROR_AT'),
 pending:pending?{id:pending.id,updateId:pending.updateId}:null,
}}
// Manual recovery only: after inspecting the sheet and waiting for any timed-out
// request to settle, put the exact pending ID in TELEGRAM_RETRY_PENDING_ID.
export async function retryPending(){return locked(async()=>{
 const cursor=state(),pending=cursor.pending();if(!pending)return {pending:false};
 if(get('RETRY_PENDING_ID')!==pending.id)throw Error('CONFIRM_PENDING_ID_IN_SCRIPT_PROPERTIES');
 const sheet=new GoogleSheet(),snapshot=await sheet.read();
 const requests=appendRequests(snapshot,pending.task);
 if(requests.length)await sheet.request(':batchUpdate',{requests});
 cursor.setOffset(Math.max(cursor.offset(),pending.updateId+1));cursor.clearPending();remove('RETRY_PENDING_ID');
 return {recovered:true};
})}
