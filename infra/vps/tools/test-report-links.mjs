import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gg-link-test-'));const file=path.join(dir,'mode.json');process.env.GG_ROUTING_STATE=file;
let calls=[];globalThis.fetch=async(u,o)=>{calls.push({u,o});return new Response('{"ok":true}')};
const m=await import('./report-links-preload.mjs');
for(const mode of['ip','domain']){
 fs.writeFileSync(file,JSON.stringify({mode}));const base=mode==='ip'?'https://201.51.7.251:8443':'https://dash.genglas.ru';
 const body={chat_id:'fixture',text:'A https://dash.genglas.ru/rop/ B https://201.51.7.251:8443/dialog/ C https://oliverjone01-dev.github.io/t1/rop-kubanova/ CRM https://glassmemory.bitrix24.ru/crm/deal/details/1/',reply_markup:{inline_keyboard:[[{text:'ROP',url:'https://dash.genglas.ru/rop/'}]]}};
 const out=m.routeTelegramPayload(body);assert(out.text.includes(base+'/rop/'));assert(out.text.includes(base+'/dialog/'));assert(out.text.includes(base+'/rop-kubanova/'));assert(out.text.includes('https://glassmemory.bitrix24.ru/crm/'));assert.equal(out.reply_markup.inline_keyboard[0][0].url,base+'/rop/');assert.equal(body.reply_markup.inline_keyboard[0][0].url,'https://dash.genglas.ru/rop/');
 await fetch('https://api.telegram.org/botfixture/sendMessage',{method:'POST',body:JSON.stringify(body)});assert.equal(JSON.parse(calls.at(-1).o.body).reply_markup.inline_keyboard[0][0].url,base+'/rop/');
}
const untouched={body:'{"text":"https://dash.genglas.ru/rop/"}'};await fetch('https://example.invalid/other',untouched);assert.equal(calls.at(-1).o,untouched);
fs.rmSync(dir,{recursive:true});console.log('PASS report links: both modes, fresh state per send, text/keyboards, preserved CRM links; all requests mocked, no API calls');
