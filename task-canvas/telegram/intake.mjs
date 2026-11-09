import {buildWriteRequests} from '../public/sync-model.mjs';
import {parseAssignee} from '../public/people.mjs';

export const GROUP_ID='-5372356223';
const imperative=/^(?:сделайте|сделай|подготовьте|подготовь|проверьте|проверь|согласуйте|согласуй|обновите|обнови|соберите|собери|отправьте|отправь|запустите|запусти|добавьте|добавь|исправьте|исправь|составьте|составь|разработайте|разработай|разместите|размести|закажите|закажи|свяжись)(?=\s|$)/iu;
const infinitive=/^[а-яё]+(?:ть|ться|ти|чь)(?=\s|$)/iu;
const requestPattern=/^(?:нужно|надо|необходимо|прошу|поручаю|можешь|можете|давайте)\s+(?:пожалуйста[, ]+)?(.+)/iu;
const isAction=body=>imperative.test(body)||infinitive.test(body.match(requestPattern)?.[1]||'');
export function extractTask(text,{date=new Date(),owners={'катя':'Екатерина Машкова'},botUsername=''}={}){
 text=String(text||'').trim();if(!text)return null;
 let body=text,owner='',explicit=false;
 const command=body.match(/^(?:\/task(?:@[a-z0-9_]+)?|#задача)(?:\s+|$)/iu);
 if(command?.[0].includes('@')&&command[0].split('@')[1].trim().toLowerCase()!==botUsername.toLowerCase())return null;
 if(command){explicit=true;body=body.slice(command[0].length).trim()}
 const address=body.match(/^(@?[\p{L}\p{N}_-]+(?: [\p{L}-]+)?),\s*/u);
 if(address&&isAction(body.slice(address[0].length).replace(/^пожалуйста[, ]+/iu,''))){const key=address[1].toLocaleLowerCase('ru');owner=Object.hasOwn(owners,key)?owners[key]:'';body=body.slice(address[0].length)}
 if(owner&&parseAssignee(owner)===null)throw Error('OWNER_MAP_INVALID');
 const action=body.replace(/^пожалуйста[, ]+/iu,'');
 if(!explicit){
  if(/^(?:не\s|не\s+надо|отмен|уже\s|готово|сделал|сделано)/iu.test(action))return null;
  if(!isAction(action))return null;
 }
 if(body.length<4)return null;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const part=key=>parts.find(p=>p.type===key).value;
 const today=`${part('year')}-${part('month')}-${part('day')}`;
 let due='';
 if(/(?:^|\s)(?:до\s+)?завтра(?=$|[\s.,!?])/iu.test(body)){const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);due=d.toISOString().slice(0,10)}
 else if(/(?:^|\s)(?:до\s+)?сегодня(?=$|[\s.,!?])/iu.test(body))due=today;
 const rawDate=body.match(/(?:до|срок[: ]+)\s*(\d{1,2})[.](\d{1,2})(?:[.](\d{4}))?(?=$|[\s.,!?])/iu);
 if(rawDate){const iso=`${rawDate[3]||today.slice(0,4)}-${rawDate[2].padStart(2,'0')}-${rawDate[1].padStart(2,'0')}`;const d=new Date(iso+'T12:00:00Z');if(Number.isFinite(+d)&&d.toISOString().slice(0,10)===iso)due=iso}
 return {title:body.split('\n')[0].slice(0,300),description:text,owner,due,status:'В ожидании',priority:'',positions:{},unit:'',direction:'',comment:''};
}
export function taskFromUpdate(update,config){
 const m=update.message;if(!m||String(m.chat?.id)!==config.chatId||m.from?.is_bot||m.sender_chat||m.forward_origin||!Number.isSafeInteger(m.date)||m.date<config.startedAt)return null;
 if(!Number.isSafeInteger(m.message_id)||!Number.isSafeInteger(update.update_id))return null;
 const task=extractTask(m.text||m.caption,{date:new Date(m.date*1000),owners:config.owners,botUsername:config.botUsername});if(!task)return null;
 const link=m.chat.username?`https://t.me/${m.chat.username}/${m.message_id}`:String(m.chat.id).startsWith('-100')?`https://t.me/c/${String(m.chat.id).slice(4)}/${m.message_id}`:'';
 return {...task,id:`tg-${m.chat.id}-${m.message_id}`,sourceId:`ТГ-${m.message_id}`,requester:[m.from?.first_name,m.from?.last_name].filter(Boolean).join(' '),link,telegramText:m.text||m.caption,sentAt:new Date(m.date*1000).toISOString()};
}
export function appendRequests(snapshot,task){
 if(snapshot.records.some(r=>r.id===task.id))return [];
 const requests=buildWriteRequests(snapshot,[{id:task.id,type:'upsert',task}],snapshot.board.owners);
 const values=requests.find(r=>r.appendCells).appendCells.rows[0].values;
 for(const [col,value] of [[13,task.sentAt],[14,task.telegramText],[15,task.link||`Telegram · ${GROUP_ID} · сообщение ${task.sourceId}`]])values[col].userEnteredValue={stringValue:value};
 return requests;
}
export async function processUpdates(updates,{config,state,read,append,shouldStop=()=>false}){
 let snapshot=null,added=0;
 const getSnapshot=async()=>snapshot??=await read();
 const pending=state.pending();
 if(pending){if(!(await getSnapshot()).records.some(r=>r.id===pending.id))throw Error('WRITE_UNCERTAIN: проверьте строку в таблице; автоматический повтор остановлен');state.clearPending()}
 for(const update of [...updates].sort((a,b)=>a.update_id-b.update_id)){
  if(shouldStop())break;
  if(!Number.isSafeInteger(update.update_id)||update.update_id<state.offset())continue;
  const task=taskFromUpdate(update,config);
  if(task){const s=await getSnapshot(),requests=appendRequests(s,task);if(requests.length){state.setPending({id:task.id,updateId:update.update_id,task});await append(requests);s.records.push({id:task.id});state.clearPending();added++}}
  state.setOffset(update.update_id+1);
 }
 return {added};
}
