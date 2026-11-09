// Read-only setup check. Never poll messages, change webhook or print API bodies.
const token=process.env.TELEGRAM_TASK_BOT_TOKEN||'';
const group=-5372356223;
async function request(method,payload={}){
 let r,data;
 try{r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(15000)});data=await r.json()}
 catch{throw Error('Telegram network failure (details redacted)')}
 if(!r.ok||!data.ok)throw Error(`Telegram ${method}: HTTP ${r.status}`);
 return data.result;
}
try{
 if(!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token))throw Error('TELEGRAM_TASK_BOT_TOKEN is missing or invalid');
 const me=await request('getMe');
 if(me.username?.toLowerCase()!=='gg_om_tasks_bot'||String(me.id)!=='9180394823')throw Error('Token belongs to another bot');
 const webhook=await request('getWebhookInfo');
 const member=await request('getChatMember',{chat_id:group,user_id:me.id});
 const memberOk=['member','administrator','creator'].includes(member.status);
 const readsAll=!!me.can_read_all_group_messages||['administrator','creator'].includes(member.status);
 console.log(JSON.stringify({bot:'@gg_om_tasks_bot',groupId:group,member:memberOk,readsOrdinaryMessages:readsAll,webhookPresent:!!webhook.url}));
 if(!memberOk||!readsAll||webhook.url)process.exitCode=1;
}catch(e){console.error(e.message);process.exitCode=1}
