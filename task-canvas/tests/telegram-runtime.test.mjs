import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
import {SERVICE_HEADERS,TAB_ID,SHEET_ID} from '../public/sync-model.mjs';

const built=await build({entryPoints:['telegram/entry.mjs'],bundle:true,write:false,format:'iife',globalName:'TelegramTaskIntake',target:'es2020'});
const token='123456:'+ 'test_secret_'.repeat(3);
function harness(){
 const properties=new Map([['TELEGRAM_BOT_TOKEN',token],['TELEGRAM_BOT_USERNAME','@tasks_bot']]);
 const triggers=[],calls=[],rows=[[],[],Array.from({length:16},()=>({})).concat(SERVICE_HEADERS.map(v=>({formattedValue:v,userEnteredValue:{stringValue:v}})))];
 let updates=[],locked=false,fail=null,webhook='',privacy=true;
 const body=(code,data)=>({getResponseCode:()=>code,getContentText:()=>JSON.stringify(data)});
 const context=vm.createContext({console,PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,v),deleteProperty:k=>properties.delete(k)})},LockService:{getScriptLock:()=>({tryLock:()=>!locked,releaseLock:()=>{}})},ScriptApp:{getOAuthToken:()=>'google_test_token',getProjectTriggers:()=>triggers,deleteTrigger:t=>triggers.splice(triggers.indexOf(t),1),newTrigger:name=>({timeBased:()=>({everyMinutes:minutes=>({create:()=>triggers.push({minutes,getHandlerFunction:()=>name})})})})},UrlFetchApp:{fetch:(url,opts)=>{
  calls.push({url,opts});if(fail&&(!(typeof fail==='function')||fail(url)))throw Error('Failed request '+url);
  if(url.startsWith('https://api.telegram.org/')){
   const method=url.split('/').at(-1);
   if(method==='getMe')return body(200,{ok:true,result:{id:123456,username:'tasks_bot',can_read_all_group_messages:privacy}});
   if(method==='getChat')return body(200,{ok:true,result:{id:-5372356223,type:'group'}});
   if(method==='getChatMember')return body(200,{ok:true,result:{status:'member'}});
   if(method==='getWebhookInfo')return body(200,{ok:true,result:{url:webhook}});
   if(method==='getUpdates')return body(200,{ok:true,result:updates});
   throw Error('unexpected Telegram method');
  }
  assert.ok(url.startsWith(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`));
  if(url.endsWith(':batchUpdate')){
   const requests=JSON.parse(opts.payload).requests;
   for(const r of requests){assert.ok(r.appendCells);rows.push(r.appendCells.rows[0].values)}
   return body(200,{});
  }
  if(url.includes('fields=spreadsheetId'))return body(200,{sheets:[{properties:{sheetId:TAB_ID,index:0,title:'Тест',gridProperties:{rowCount:100,columnCount:22}}}]});
  return body(200,{sheets:[{data:[{rowData:rows.map(values=>({values}))}]}]});
 }}});
 vm.runInContext(built.outputFiles[0].text,context);
 return {api:context.TelegramTaskIntake,properties,triggers,calls,rows,setUpdates:v=>updates=v,setLocked:v=>locked=v,setFail:v=>fail=v,setWebhook:v=>webhook=v,setPrivacy:v=>privacy=v};
}
test('private runtime starts once, validates identity and appends one task through Sheets',async()=>{
 const h=harness();assert.equal((await h.api.run()).enabled,false);assert.equal(h.calls.length,0);
 await h.api.start();await h.api.start();assert.equal(h.triggers.length,1);assert.equal(h.triggers[0].minutes,1);
 h.setUpdates([{update_id:100,message:{message_id:12,date:Math.floor(Date.now()/1000),chat:{id:-5372356223},from:{first_name:'Тест'},text:'Подготовь каталог'}}]);
 assert.equal((await h.api.run()).added,1);assert.equal(h.rows.length,4);
 await h.api.run();assert.equal(h.rows.length,4);
 assert.equal(h.properties.get('TELEGRAM_OFFSET'),'101');assert.equal(h.api.check().pending,null);
 await h.api.stop();assert.equal(h.triggers.length,0);assert.equal((await h.api.run()).enabled,false);
});
test('runtime never changes a webhook or enables a bot with unreadable group messages',async()=>{
 const h=harness();h.setWebhook('https://another.example/webhook');await assert.rejects(h.api.start(),/BOT_HAS_WEBHOOK/);assert.equal(h.triggers.length,0);
 h.setWebhook('');h.setPrivacy(false);await assert.rejects(h.api.start(),/DISABLE_BOT_PRIVACY/);assert.equal(h.triggers.length,0);
 assert.ok(h.calls.every(c=>!c.url.includes('deleteWebhook')));
});
test('network errors cannot leak token or request URL into logs/status',async()=>{
 const h=harness();await h.api.start();h.setFail(`Failed fetching https://api.telegram.org/bot${token}/getUpdates`);
 await assert.rejects(h.api.run(),e=>e.message==='TELEGRAM_NETWORK');
 assert.equal(h.api.check().lastError,'TELEGRAM_NETWORK');assert.ok(!JSON.stringify(h.api.check()).includes(token));
});
test('script lock and token-identity fence prevent unintended consumers',async()=>{
 const h=harness();await h.api.start();const n=h.calls.length;h.setLocked(true);assert.equal((await h.api.run()).busy,true);assert.equal(h.calls.length,n);
 h.setLocked(false);h.properties.set('TELEGRAM_BOT_TOKEN','789:'+token.split(':')[1]);await assert.rejects(h.api.run(),/START_REQUIRED/);assert.equal(h.calls.length,n);
});
test('uncertain append stores long Cyrillic text within property limits and requires explicit retry',async()=>{
 const h=harness();await h.api.start();
 const text='Подготовь '+ 'я'.repeat(4000);
 h.setUpdates([{update_id:100,message:{message_id:12,date:Math.floor(Date.now()/1000),chat:{id:-5372356223},from:{first_name:'Тест'},text}}]);
 h.setFail(url=>url.endsWith(':batchUpdate'));await assert.rejects(h.api.run(),/SHEETS_NETWORK/);
 const pending=h.api.check().pending;assert.ok(pending);assert.equal(h.properties.get('TELEGRAM_OFFSET'),undefined);
 for(const [key,value] of h.properties)if(key.startsWith('TELEGRAM_PENDING_'))assert.ok(Buffer.byteLength(value)<9000);
 h.setFail(null);await assert.rejects(h.api.run(),/WRITE_UNCERTAIN/);assert.equal(h.rows.length,3);
 await assert.rejects(h.api.retryPending(),/CONFIRM_PENDING_ID/);
 h.properties.set('TELEGRAM_RETRY_PENDING_ID',pending.id);assert.equal((await h.api.retryPending()).recovered,true);
 assert.equal(h.rows.length,4);assert.equal(h.rows[3][14].userEnteredValue.stringValue,text);
 assert.equal(h.api.check().pending,null);assert.equal(h.properties.get('TELEGRAM_OFFSET'),'101');
 await h.api.run();assert.equal(h.rows.length,4);
});
