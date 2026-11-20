import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gg-guard-links-'));process.env.GG_ROUTING_STATE=path.join(dir,'mode.json');process.env.GG_DIGEST_DELIVERY_DIR=path.join(dir,'receipts');let sent=[];globalThis.fetch=async(u,o)=>{sent.push(JSON.parse(o.body));return new Response('{"ok":true,"result":{"message_id":1}}')};
await import('./report-links-preload.mjs');await import('./digest-delivery-guard.mjs');
for(const [mode,type]of[['ip','plan'],['domain','itogi']]){
 process.env.MODE=type;fs.writeFileSync(process.env.GG_ROUTING_STATE,JSON.stringify({mode}));
 const payload={chat_id:'fixture',text:'Отдел https://oliverjone01-dev.github.io/t1/rop/'};
 let r=await fetch('https://api.telegram.org/botfixture/sendMessage',{method:'POST',body:JSON.stringify(payload)});assert.equal(r.status,200);
 const expected=(mode==='ip'?'https://201.51.7.251:8443':'https://dash.genglas.ru')+'/rop/';
 assert(sent.at(-1).text.includes(expected));
 const file=fs.readdirSync(process.env.GG_DIGEST_DELIVERY_DIR).find(f=>f.includes('-'+type+'-'));const receipt=JSON.parse(fs.readFileSync(path.join(process.env.GG_DIGEST_DELIVERY_DIR,file),'utf8'));assert.equal(receipt.textHash,crypto.createHash('sha256').update(sent.at(-1).text).digest('hex'));
 const n=sent.length;r=await fetch('https://api.telegram.org/botfixture/sendMessage',{method:'POST',body:JSON.stringify(payload)});assert.equal(r.status,409);assert.equal(sent.length,n);
}fs.rmSync(dir,{recursive:true});console.log('PASS links plus delivery guard: receipts match selected URLs, duplicate sends stay blocked; fetch mocked, no network/API calls');

