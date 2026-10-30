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

const managerBlock=(text,name)=>text.split('\n\n').find(block=>block.includes('>'+name+'</a>'));
const kubanova=(id,userId,entered,name='Алена Кубанова')=>({...deal(id,25000,100000,entered),mgr:name,mgrId:userId});
const oldPayment=kubanova(10,'6699','2026-09-11','Алёна Кубанова');
const returned=await render({...base,deals:[oldPayment]});
assert.ok(managerBlock(returned,'Алёна Кубанова').includes('Без предоплат: <b>5 дн</b>'),'Counter starts at the current employment period, not an old account payment');
assert.ok(returned.split('\n\n')[1].includes('Без предоплат: <b>45 дн</b>'),'Employment start must not become a department payment');
for(const [generated_at,expected] of [['2026-10-21T06:00:00Z',0],['2026-10-22T06:00:00Z',1],['2026-10-28T06:00:00Z',7]]){
  const text=await render({...base,generated_at,deals:[]});
  assert.ok(managerBlock(text,'Алёна Кубанова').includes('Без предоплат: <b>'+expected+' дн</b>'),'No payments: count calendar days since return');
}
const paidToday=await render({...base,deals:[oldPayment,kubanova(11,'8397','2026-10-26T08:00:00+03:00')]});
assert.ok(managerBlock(paidToday,'Алёна Кубанова').includes('Без предоплат: <b>0 дн</b>'),'A new account payment today resets the counter');
const paidYesterday=await render({...base,deals:[kubanova(12,8397,'2026-10-25T23:30:00+03:00','Алёна Кубанова')]});
assert.ok(managerBlock(paidYesterday,'Алёна Кубанова').includes('Без предоплат: <b>1 дн</b>'),'Moscow calendar boundary and numeric user ID');
const legacyAfterReturn=await render({...base,deals:[oldPayment,kubanova(13,'6699','2026-10-26')]});
assert.ok(managerBlock(legacyAfterReturn,'Алёна Кубанова').includes('Без предоплат: <b>5 дн</b>'),'Old user account cannot reset current employment counter');
const reassignedHistory=await render({...base,deals:[kubanova(14,'8397','2026-10-20'),kubanova(15,'8397','2026-10-27')]});
assert.ok(managerBlock(reassignedHistory,'Алёна Кубанова').includes('Без предоплат: <b>5 дн</b>'),'Ignore historical payments before return and future-dated payments');
const unknownOwner=await render({...base,deals:[kubanova(16,undefined,'2026-10-26')]});
assert.ok(managerBlock(unknownOwner,'Алёна Кубанова').includes('Без предоплат: <b>5 дн</b>'),'A missing user ID is not evidence of a current account payment');
const beforeReturn=await render({...base,generated_at:'2026-10-20T06:00:00Z',deals:[oldPayment]});
assert.ok(managerBlock(beforeReturn,'Алёна Кубанова').includes('Без предоплат: <b>39 дн</b>'),'Return boundary does not rewrite historical snapshots before return');
console.log('PASS: employment boundary, old/new user IDs, no payments, reset, Moscow dates and department isolation.');

if(process.env.DIGEST_FIXTURE){
  const snapshot=JSON.parse(fs.readFileSync(process.env.DIGEST_FIXTURE,'utf8').replace(/^\uFEFF/,''));
  const text=await render(snapshot);
  const evening=await render(snapshot,'itogi');
  assert.equal(evening.replace('🌙 ИТОГИ ДНЯ','🌅 ПЛАН НА ДЕНЬ'),text);
  if(process.env.DIGEST_PREVIEW)fs.writeFileSync(process.env.DIGEST_PREVIEW,text+'\n');
  console.log(JSON.stringify({snapshot:snapshot.generated_at,length:text.length,department:text.split('\n\n')[1],affected:snapshot.deals.filter(d=>['100971','101021'].includes(String(d.id))).map(d=>({id:d.id,manager:d.mgr,prepayment:d.prepayAmt,budget:d.budget}))},null,2));
}
