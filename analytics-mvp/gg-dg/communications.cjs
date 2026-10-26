'use strict';
const createDGNormalizer=require('./dialog-normalize.cjs');
const dgRealCommunication=type=>/^(Письмо|Звонок|SMS|Мессенджер ОЛ|Сообщение)/.test(type||'');
// Same contact masking rules as the pinned GG mask-contacts.mjs, after decoding.
function dgMaskContacts(text){
 return text.replace(/([\p{L}\p{N}_.+-]{1,64})@([\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+)/gu,(_,local,domain)=>(local.length<=2?local[0]:local.slice(0,2))+'****@'+domain)
 .replace(/(?<!\d)(\d{4})[ -]?(\d{4})[ -]?(\d{4})[ -]?(\d{4})(?!\d)/g,(_,a,b,c,last)=>'****'+last)
 .replace(/(?<![\p{L}\p{N}_+])((?:\+|&#43;\s?)?\d[\d \-()\u00a0]{8,26}\d)(?!\d)/gu,match=>{
  const plus=match.startsWith('+')||match.startsWith('&#43;'),digits=match.replace(/^&#43;/,'').replace(/\D/g,'');
  const phone=digits.length===11&&'78'.includes(digits[0])&&'3489'.includes(digits[1])||digits.length===10&&digits[0]==='9'||plus&&digits.length>=11&&digits.length<=13;
  if(!phone||!plus&&match.split(/\s*-+\s*/).every(p=>/^\d{1,3}(?:[ \u00a0]\d{3})+$/.test(p.trim())))return match;
  return (plus?'+':'')+digits.slice(0,4)+'****'+digits.slice(-2);
 });
}
function dgSafeText(value){let text=String(value??'');const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',laquo:'«',raquo:'»',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',ndash:'–',mdash:'—',hellip:'…',copy:'©',reg:'®'};let stable=false;for(let i=0;i<64;i++){const decoded=text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(whole,key)=>{if(key[0]!=='#')return named[key.toLowerCase()]??whole;const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10FFFF&&!(n>=0xD800&&n<=0xDFFF)?String.fromCodePoint(n):'�';});if(decoded===text){stable=true;break;}text=decoded;}if(!stable)throw Error('DG text entity nesting limit');text=text.replace(/(?:https?:\/\/|www\.)[^\s<>"\]\[]+/gi,'[ссылка скрыта]').replace(/\S*bitrix24\.\S*|\/rest\/\d+\/[a-z0-9]+\/?/gi,'[адрес CRM скрыт]').replace(/sk-(?:proj-)?[A-Za-z0-9_-]{16,}|\d{6,}:[A-Za-z0-9_-]{20,}/g,'[секрет скрыт]').replace(/B24_WEBHOOK_URL|OPENAI_API_KEY|api\.telegram\.org/gi,'[служебное поле скрыто]');return dgMaskContacts(text);}
function dgCleanEvent(event,entities){
 const ts=Number(event.ts)||Date.parse(event.raw||event.dt||'');if(!Number.isFinite(ts))throw Error('Invalid communication time');
 if(!event.src||!entities.length)throw Error('Unbound communication');
 const clean={id:String(event.src),ts,dt:new Date(ts).toISOString(),entities:[...new Set(entities)],type:dgSafeText(event.type||'Событие CRM'),dir:['входящее','исходящее'].includes(event.dir)?event.dir:'-',who:dgSafeText(event.who||'CRM'),title:dgSafeText(event.title),body:dgSafeText(event.body),status:dgSafeText(event.status),due:event.due||null,dur:dgSafeText(event.dur),refId:/^\d+$/.test(String(event.refId))?String(event.refId):null,guess:!!event.guess,roleGuess:!!event.roleGuess};
 clean.origin=['crm','dialog','history'].includes(event.origin)?event.origin:'crm';
 clean.undiar=!!event.undiar;clean.due=Number.isFinite(Date.parse(event.due||''))?new Date(event.due).toISOString():null;
 if(Array.isArray(event.speakers))clean.speakers=event.speakers.map(s=>({role:dgSafeText(s.role||s.label),text:dgSafeText(s.text)}));
 return clean;
}
async function dgDialogCache(allowed,fetcher=fetch){
 const origin='http://127.0.0.1:18764';
 const get=async path=>{const r=await fetcher(origin+path,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Dialog cache unavailable');return r.json();};
 for(let attempt=0;attempt<2;attempt++){
  const before=await get('/api/status'),events=new Map();let skippedUnattributed=0;
  if(!Number.isFinite(Date.parse(before.generatedAt||''))||!Number.isFinite(Date.parse(before.imported||'')))throw Error('Unknown Dialog cache version');
  for(const key of allowed){
   let count=0,total=null;
   for(let page=0;page<10000;page++){
    const r=await get('/api/events?key='+encodeURIComponent(key)+'&page='+page);
    if(!Array.isArray(r.items)||!Number.isInteger(r.total)||r.total<0)throw Error('Invalid Dialog page');
    if(total===null)total=r.total;if(total!==r.total)throw Error('Dialog cache changed during pagination');
    count+=r.items.length;
    for(const e of r.items){
     if(!['lead','deal'].includes(e.stage)){skippedUnattributed++;continue;}
     const stage=e.stage,primary=(stage==='lead'?'L'+e.leadId:'D'+e.dealId);
     // Conversion may move L-events under a D-key in Dialog. Use the original entity stage.
     if(!allowed.has(primary))continue;
     const clean=dgCleanEvent({...e,origin:'dialog'},[primary]);
     const old=events.get(clean.id);if(old)clean.entities=[...new Set([...old.entities,...clean.entities])];
     events.set(clean.id,clean);
    }
    if(count===total)break;
    if(!r.items.length||count>total||page===9999)throw Error('Incomplete Dialog cache');
   }
  }
  const after=await get('/api/status');
  if(before.generatedAt===after.generatedAt&&before.imported===after.imported)return {events:[...events.values()],generatedAt:before.generatedAt,status:'available',skippedUnattributed};
 }
 throw Error('Dialog cache version changed');
}
async function dgEnrich({leads,deals,call,names={},reasonFields=[],now=Date.now(),fetcher=fetch,throttleMs=550}){
 const entries=[...leads.map(r=>({key:'L'+r.ID,id:String(r.ID),type:1,raw:r})),...deals.map(r=>({key:'D'+r.ID,id:String(r.ID),type:2,raw:r}))],allowed=new Set(entries.map(x=>x.key));
 const normal=createDGNormalizer(names,now),events=new Map(),bindingCache=new Map();let lastCall=0;
 const rpc=async(method,params)=>{const delay=lastCall+throttleMs-Date.now();if(delay>0)await new Promise(r=>setTimeout(r,delay));lastCall=Date.now();return call(method,params);};
 async function list(method,params,nested=false){
  const rows=[];let start=0,total=null;
  for(let page=0;page<10000;page++){
   const r=await rpc(method,{...params,order:params.order||{ID:'ASC'},start});if(r.error)throw Error('CRM communication request failed');
   const batch=nested?r.result?.items:r.result;if(!Array.isArray(batch))throw Error('Invalid CRM communication list');
   const n=r.total??r.result?.total;if(n!=null&&total===null)total=Number(n);
   rows.push(...batch);const next=r.next??r.result?.next;
   if(next==null){if(total!==null&&total!==rows.length)throw Error('Incomplete CRM communication list');if(new Set(rows.map(x=>String(x.ID))).size!==rows.length)throw Error('Duplicate CRM communication ID');return rows;}
   if(!batch.length||Number(next)<=start)throw Error('Broken CRM communication pagination');start=Number(next);
  }throw Error('CRM communication page limit');
 }
 let cache;try{cache=await dgDialogCache(allowed,fetcher);}catch{cache={events:[],generatedAt:null,status:'unavailable'};}
 for(const e of cache.events)events.set(e.id,e);
 const histories={lead:[],deal:[]};
 for(const [type,kind]of [[1,'lead'],[2,'deal']]){
  const ids=entries.filter(x=>x.type===type).map(x=>x.id);
  for(let i=0;i<ids.length;i+=30){
   const chunk=ids.slice(i,i+30),rows=await list('crm.stagehistory.list',{entityTypeId:type,filter:{'@OWNER_ID':chunk},select:['*']},true);
   for(const row of rows){
    if(!chunk.includes(String(row.OWNER_ID)))throw Error('Foreign calendar history');
    const at=Date.parse(row.CREATED_TIME),code=String(type===1?row.STATUS_ID:row.STAGE_ID),semantic=type===1?row.STATUS_SEMANTIC_ID:row.STAGE_SEMANTIC_ID;
    if(!Number.isFinite(at)||!code||!['P','S','F'].includes(semantic))throw Error('Invalid calendar history');
    histories[kind].push({id:String(row.ID),key:(type===1?'L':'D')+row.OWNER_ID,at,code,semantic});
   }
  }
 }
 for(const entry of entries){const rows=histories[entry.type===1?'lead':'deal'].filter(e=>e.key===entry.key).sort((a,b)=>a.at-b.at||Number(a.id)-Number(b.id)),expected=entry.raw[entry.type===1?'STATUS_ID':'STAGE_ID'];if(expected&&(!rows.length||rows.at(-1).code!==expected))throw Error('CRM stage changed during snapshot or history incomplete');}
 const put=(event,keys)=>{const clean=dgCleanEvent({...event,origin:'crm'},keys),old=events.get(clean.id);if(old){clean.entities=[...new Set([...old.entities,...clean.entities])];if(!clean.speakers&&old.speakers)clean.speakers=old.speakers;}events.set(clean.id,clean);};
 for(const entry of entries){
  const acts=await list('crm.activity.list',{filter:{BINDINGS:[{OWNER_TYPE_ID:entry.type,OWNER_ID:entry.id}]},select:['ID','OWNER_TYPE_ID','OWNER_ID','TYPE_ID','PROVIDER_ID','DIRECTION','SUBJECT','DESCRIPTION','DESCRIPTION_TYPE','RESPONSIBLE_ID','AUTHOR_ID','CREATED','START_TIME','END_TIME','DEADLINE','COMPLETED','SETTINGS','ASSOCIATED_ENTITY_ID']});
  for(const a of acts){
   const primary=(Number(a.OWNER_TYPE_ID)===1?'L':Number(a.OWNER_TYPE_ID)===2?'D':'?')+a.OWNER_ID;
   let keys=[entry.key];
   if(primary!==entry.key){
    let bindings=bindingCache.get(String(a.ID));
    if(!bindings){const r=await rpc('crm.activity.binding.list',{activityId:a.ID});bindings=r.result;if(!Array.isArray(bindings))throw Error('Activity bindings unavailable');bindingCache.set(String(a.ID),bindings);}
    const bound=bindings.map(b=>(Number(b.entityTypeId)===1?'L':Number(b.entityTypeId)===2?'D':'?')+b.entityId);
    if(!bound.includes(entry.key))throw Error('Foreign bound activity');keys=bound.filter(k=>allowed.has(k));
   }
   const who=names[String(a.RESPONSIBLE_ID)]||names[String(a.AUTHOR_ID)]||names[String(entry.raw.ASSIGNED_BY_ID)]||'CRM';
   put(normal.activity(a,who),keys);
  }
  const comments=await list('crm.timeline.comment.list',{filter:{ENTITY_TYPE:entry.type===1?'lead':'deal',ENTITY_ID:entry.id}});
  for(const c of comments){const types={lead:1,deal:2,'1':1,'2':2};if((c.ENTITY_ID!=null&&String(c.ENTITY_ID)!==entry.id)||(c.ENTITY_TYPE!=null&&types[String(c.ENTITY_TYPE).toLowerCase()]!==entry.type)||(c.ENTITY_TYPE_ID!=null&&Number(c.ENTITY_TYPE_ID)!==entry.type))throw Error('Foreign timeline comment');put(normal.comment(c),[entry.key]);}
 }
 const all=[...events.values()].sort((a,b)=>a.ts-b.ts||a.id.localeCompare(b.id));
 const leadReasonDetails={};for(const l of leads){const text=l.STATUS_ID==='JUNK'?l[reasonFields[0]]:l.STATUS_ID==='3'?(l[reasonFields[2]]||l[reasonFields[1]]):null;if(text)leadReasonDetails['L'+l.ID]=dgSafeText(text);}
 return {calendar:{version:1,...histories,leadReasonDetails},communications:{version:1,generatedAt:new Date(now).toISOString(),cache:{status:cache.status,generatedAt:cache.generatedAt,skippedUnattributed:cache.skippedUnattributed||0},events:all}};
}
module.exports={dgEnrich,dgDialogCache,dgCleanEvent,dgSafeText,dgRealCommunication};
