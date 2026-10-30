import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
// A durable claim is created BEFORE Telegram; ambiguous transport errors are not retried.
const originalFetch=globalThis.fetch;
globalThis.fetch=async function(url,options){
 if(!String(url).endsWith('/sendMessage'))return originalFetch(url,options);
 const body=JSON.parse(options.body),mode=process.env.MODE;
 if(!['plan','itogi'].includes(mode))throw Error('Unexpected digest mode');
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const dir=process.env.GG_DIGEST_DELIVERY_DIR||'/srv/gg/state/digest-delivery';fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,`${date}-${mode}-${body.chat_id}.json`);
 const state={date,mode,chat:String(body.chat_id),status:'pending',started:new Date().toISOString(),textHash:crypto.createHash('sha256').update(body.text).digest('hex')};
 let fd;try{fd=fs.openSync(file,'wx',0o640);}catch(e){if(e.code==='EEXIST')return new Response(JSON.stringify({ok:false,description:'Daily digest already sent or pending; duplicate blocked'}),{status:409});throw e;}
 fs.writeFileSync(fd,JSON.stringify(state));fs.fsyncSync(fd);fs.closeSync(fd);
 function save(){const temp=file+'.new';fs.writeFileSync(temp,JSON.stringify(state),{mode:0o640});const f=fs.openSync(temp,'r');fs.fsyncSync(f);fs.closeSync(f);fs.renameSync(temp,file);}
 try{
  const response=await originalFetch(url,{...options,signal:AbortSignal.timeout(30000)});
  const result=await response.clone().json();
  state.finished=new Date().toISOString();state.status=result.ok?'sent':'rejected';
  if(result.ok)state.message_id=result.result.message_id;else state.error_code=result.error_code;
  save();return response;
 }catch(e){state.status='unknown';state.finished=new Date().toISOString();save();throw Error('Telegram delivery uncertain; automatic retry blocked');}
};

