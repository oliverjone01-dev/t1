import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const workflowPath=process.env.DIGEST_WORKFLOW||path.resolve(here,'../workflows/rop-tg-bot.yml');
const workflow=fs.readFileSync(workflowPath,'utf8');
const match=workflow.match(/cat > \/tmp\/digest\.mjs <<'MJS'\r?\n([\s\S]*?)^          MJS\s*$/m);
assert.ok(match,'Digest heredoc must exist');
const script=match[1].replace(/^          /gm,'').replace("import fs from 'node:fs';",'').replaceAll('process.exit(0);','return;');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const execute=new AsyncFunction('fs','process','fetch','console',script);

async function render(snapshot,mode='plan'){
  const messages=[];
  await execute({readFileSync(file){assert.equal(file,'/tmp/rop.json');return JSON.stringify(snapshot);}},
    {env:{MODE:mode,BOT_TOKEN:'offline-test-only',CHAT_ID:'offline-test-only'},exit(code){throw Error('Unexpected exit '+code);}},
    async(url,options)=>{assert.equal(url,'https://api.telegram.org/botoffline-test-only/sendMessage');messages.push(JSON.parse(options.body));return {json:async()=>({ok:true,result:{message_id:1}})};},
    {log(){},error(){}});
  assert.equal(messages.length,1);
  assert.ok(messages[0].text.length<=4096);
  return messages[0].text;
}

const base={generated_at:'2026-10-26T06:29:57.645Z',leads:[]};
const deal=(id,prepayAmt,budget,entered='2026-10-26T08:00:00+03:00')=>({id,mgr:'Юлия Лысанова',category:49,won:false,lost:false,stageCode:'C49:EXECUTING',prepayAmt,budget,hist:[['C49:EXECUTING',entered]]});
const cases=[
  {name:'positive prepayment keeps the advance',prepay:25000,budget:100000,expected:25000,fallback:false,missing:false},
  {name:'zero uses deal amount',prepay:0,budget:100000,expected:100000,fallback:true,missing:false},
  {name:'empty uses deal amount',prepay:'',budget:100000,expected:100000,fallback:true,missing:false},
  {name:'null uses deal amount',prepay:null,budget:100000,expected:100000,fallback:true,missing:false},
  {name:'missing both stays visible',prepay:0,budget:0,expected:0,fallback:false,missing:true},
  {name:'negative is not silently replaced',prepay:-100,budget:100000,expected:-100,fallback:false,missing:true}
];
for(const c of cases){
  const text=await render({...base,deals:[deal(1,c.prepay,c.budget)]});
  assert.ok(text.includes('Предоплаты за день: <b>1 шт · '+Math.round(c.expected).toLocaleString('ru-RU')+' ₽'),c.name);
  assert.equal(text.includes('(у 1 взята сумма сделки)'),c.fallback,c.name);
  assert.equal(text.includes('(у 1 сумма не заполнена)'),c.missing,c.name);
}
const boundaries=await render({...base,deals:[deal(1,0,100000,'2026-10-25T23:30:00+03:00'),deal(2,25000,100000),deal(3,0,50000,'2026-09-30T23:30:00+03:00')]});
assert.ok(boundaries.includes('Предоплаты за день: <b>1 шт · 25\u00a0000 ₽'));
assert.ok(boundaries.includes('Предоплаты за месяц: <b>2 шт · 125\u00a0000 ₽ (у 1 взята сумма сделки)'));
assert.ok(boundaries.includes('Без предоплат: <b>0 дн</b>'));
const department=await render({...base,deals:[deal(1,25000,100000),{...deal(2,0,100000),mgr:'Татьяна Лакомова'}]});
assert.ok(department.split('\n\n')[1].includes('Предоплаты за месяц: <b>2 шт · 125\u00a0000 ₽ (у 1 взята сумма сделки)'));
console.log('PASS: fallback, positive/negative values, missing amounts, Moscow boundaries and Telegram size; no network calls.');

if(process.env.DIGEST_FIXTURE){
  const snapshot=JSON.parse(fs.readFileSync(process.env.DIGEST_FIXTURE,'utf8').replace(/^\uFEFF/,''));
  const text=await render(snapshot);
  const evening=await render(snapshot,'itogi');
  assert.equal(evening.replace('🌙 ИТОГИ ДНЯ','🌅 ПЛАН НА ДЕНЬ'),text);
  if(process.env.DIGEST_PREVIEW)fs.writeFileSync(process.env.DIGEST_PREVIEW,text+'\n');
  console.log(JSON.stringify({snapshot:snapshot.generated_at,length:text.length,department:text.split('\n\n')[1],affected:snapshot.deals.filter(d=>['100971','101021'].includes(String(d.id))).map(d=>({id:d.id,manager:d.mgr,prepayment:d.prepayAmt,budget:d.budget}))},null,2));
}
