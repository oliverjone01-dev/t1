// Calendar counts and the Dialog table hierarchy share the same eligible DG records.
S.dgCalPick=null;S.dgCalManagers=new Set();S.dgCalRecords=new Set();S.dgCommChannel='all';S.dgCommAsc=true;
const dgCommCache=new Map();
const DG_CAL_ROWS=[
 {id:'leads',label:'Лиды',kind:'lead',mode:'created'},
 {id:'leadLost',label:'Отказы лидов · по причинам',kind:'lead',mode:'lost'},
 {id:'deals',label:'Сделки',kind:'deal',mode:'created'},
 {id:'wip',label:'В работе · Формирование ТЗ',kind:'deal',mode:'stock',code:'C49:PREPARATION'},
 {id:'kp',label:'КП отправлено',kind:'deal',code:'C49:PREPAYMENT_INVOIC'},
 {id:'prepay',label:'Предоплата',kind:'deal',code:'C49:EXECUTING'},
 {id:'production',label:'В производстве',kind:'deal',code:'C49:FINAL_INVOICE'},
 {id:'shipping',label:'Отгрузка',kind:'deal',code:'C49:2'},
 {id:'completed',label:'Успех',kind:'deal',code:'C49:WON'},
 {id:'lost',label:'Отказ сделок',kind:'deal',mode:'lost'}
];
function dgMSKDay(at){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));}
function dgCalendarDateTime(at){return at&&Number.isFinite(Date.parse(at))?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'short'}).format(new Date(at)):'не загружено';}
function dgCalendarKeys(){const keys=[];for(let day=S.start;day<=S.end;){const k=bkey(day,S.gran);if(!keys.includes(k))keys.push(k);const date=new Date(day+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+1);day=date.toISOString().slice(0,10);}return keys;}
function dgBucketRange(key){
 let from=key,to=key;
 if(S.gran==='month'){from=key.slice(0,7)+'-01';const date=new Date(from+'T00:00:00Z');date.setUTCMonth(date.getUTCMonth()+1);date.setUTCDate(0);to=date.toISOString().slice(0,10);}
 if(S.gran==='week'){const date=new Date(key+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+6);to=date.toISOString().slice(0,10);}
 return [from<S.start?S.start:from,to>S.end?S.end:to];
}
function dgHistory(record,kind){
 const key=(kind==='lead'?'L':'D')+record.id,source=DATA.calendar?.[kind];
 if(source)return source.filter(e=>e.key===key).slice().sort((a,b)=>a.at-b.at||Number(a.id)-Number(b.id));
 // Compatibility for old/synthetic snapshots only; production requires v1 history.
 return (record.hist||[]).map(([code,day],i)=>({id:String(i),key,at:Date.parse(day+'T12:00:00+03:00'),code,semantic:code==='C49:WON'?'S':code==='C49:LOSE'?'F':'P'})).sort((a,b)=>a.at-b.at||Number(a.id)-Number(b.id));
}
function dgCalendarRows(row,key=null){
 const [from,to]=key?dgBucketRange(key):[S.start,S.end],base=flt(row.kind==='lead'?DATA.leads:DATA.deals,row.kind==='deal');
 return base.flatMap(record=>{
  const history=dgHistory(record,row.kind);let at=null;
  if(row.mode==='created')at=record.created;
  else if(row.mode==='stock'){
   const end=Math.min(Date.parse(to+'T23:59:59.999+03:00'),Date.parse(DATA.generatedAt||DATA.bakedAt));
   const latest=history.filter(e=>e.at<=end).at(-1);
   if(!latest||latest.code!==row.code||latest.semantic!=='P')return [];
   at=to;
  }else{
   const hit=history.find(e=>row.mode==='lost'?e.semantic==='F':e.code===row.code);
   if(hit)at=dgMSKDay(hit.at);
   else if(!DATA.calendar&&((row.id==='completed'&&record.won)||(row.id==='lost'&&record.lost)))at=record.closed;
  }
  if(!at||at<from||at>to)return [];
  return [{record,key:(row.kind==='lead'?'L':'D')+record.id,at,reason:row.kind==='lead'?dgReasonName(record):(record.reason||'Не заполнена')}];
 });
}
function dgCalendarSummary(rows){
 const eventIds=new Set(),commIds=new Set();let money=0,missing=0;
 for(const x of rows){const ix=DATA.communicationIndex?.[x.key];for(const id of ix?.ids||[])eventIds.add(id);for(const id of ix?.commIds||[])commIds.add(id);if(x.record.budget==null||x.record.currency!=='RUB')missing++;else money+=x.record.budget;}
 return {events:eventIds.size,comm:commIds.size,money,missing};
}
function dgCalendarBlock(){
 const keys=dgCalendarKeys(),unit=S.calUnit==='money'?'money':'count',value=x=>x.key[0]==='L'?(x.record.currency==='RUB'?x.record.budget:null):(S.amtMode==='prepay'?x.record.prepayAmt:x.record.budget),label=x=>unit==='money'?fmtK(x.reduce((sum,r)=>sum+(value(r)??0),0))+(x.some(r=>value(r)==null)?'*':''):fmt(x.length);
 const body=DG_CAL_ROWS.map(row=>{
  const total=dgCalendarRows(row),active=S.dgCalPick?.row===row.id;
  const cells=keys.map(k=>{const rows=dgCalendarRows(row,k);return `<td><button data-dg-calcell="${row.id}|${k}" aria-label="${esc(row.label+' · '+blabel(k,S.gran))}">${rows.length?label(rows):'<span class="dg-zero">0</span>'}</button></td>`;}).join('');
  const detail=active?`<tr class="dg-cal-detail"><td colspan="${keys.length+2}">${dgCalendarDetail(row)}</td></tr>`:'';
  return `<tr class="${active?'on':''}"><th><button data-dg-calrow="${row.id}" aria-expanded="${active}">${active?'▾':'▸'} ${row.label}${row.mode==='stock'?'<small>остаток на конец · не сумма</small>':''}</button></th>${cells}<td class="dg-cal-total">${label(total)}${row.mode==='stock'?'<small>на конец</small>':''}</td></tr>${detail}`;
 }).join('');
 const coverage=DATA.communicationCoverage,cache=coverage?.cache;
 const cacheNote=cache?.status==='available'?'Дополнение из «Диалогов»: '+dgCalendarDateTime(cache.generatedAt):'Дополнение из «Диалогов» недоступно';
 return `<section class="card dg-calendar" id="dg-calendar"><div class="card-h"><div><div class="card-title">Календарь лидов и сделок</div><div class="card-sub">Лиды и сделки - создание. Этапы - первый переход. Отказы - первый отказ. Формирование ТЗ - открытый остаток.</div></div><div class="seg"><button data-dg-calunit="count" class="${unit==='count'?'on':''}">Количество</button><button data-dg-calunit="money" class="${unit==='money'?'on':''}">Сумма</button></div></div><div class="card-sub">CRM: ${dgCalendarDateTime(coverage?.generatedAt)} · ${cacheNote}${cache?.skippedUnattributed?' · архивных событий без подтверждённого типа: '+cache.skippedUnattributed:''} · в раскрытии полная история, выбранный период выделен</div><div class="scroll"><table class="tbl dg-cal-table"><thead><tr><th>Показатель</th>${keys.map(k=>`<th>${blabel(k,S.gran)}</th>`).join('')}<th>За период / на конец</th></tr></thead><tbody>${body}</tbody></table></div><p class="dg-dist-note">Сумма: у лидов - бюджет в ₽; у сделок - выбранное поле суммы. * - есть записи без суммы в ₽. Строки отражают разные события одной цепочки и не складываются в общий итог. Коммуникации в сводке считаются по уникальному событию.</p></section>`;
}
function dgCalendarDetail(row){
 const bucket=S.dgCalPick?.bucket,rows=dgCalendarRows(row,bucket);
 let filtered=rows;const reason=S.dgCalPick?.reason;
 const reasons=row.mode==='lost'?`<div class="dg-reasons"><button data-dg-calreason="" class="${!reason?'on':''}">Все причины · ${rows.length}</button>${[...new Set(rows.map(x=>x.reason))].sort().map(r=>`<button data-dg-calreason="${esc(r)}" class="${reason===r?'on':''}">${esc(r)} · ${rows.filter(x=>x.reason===r).length}</button>`).join('')}</div>`:'';
 if(reason)filtered=rows.filter(x=>x.reason===reason);
 const sum=dgCalendarSummary(filtered);
 const managers=[...new Set(filtered.map(x=>x.record.mgr||'Не распределено'))].sort((a,b)=>a.localeCompare(b,'ru'));
 const html=managers.map(manager=>{
  const records=filtered.filter(x=>(x.record.mgr||'Не распределено')===manager),s=dgCalendarSummary(records),open=S.dgCalManagers.has(manager);
  return `<tr class="mrow"><td><button data-dg-calmgr="${esc(manager)}" aria-expanded="${open}">${open?'▾':'▸'} ${esc(manager)}</button></td><td>${records.length}</td><td>${dgMoney(s.money,'RUB')}${s.missing?' · без суммы '+s.missing:''}</td><td>${s.comm}</td><td>${s.events}</td></tr>${open?`<tr class="subrow"><td colspan="5">${dgCalendarRecordTable(records,row)}</td></tr>`:''}`;
 }).join('');
 return `<div class="dg-calendar-drill"><h3>${esc(row.label)}${bucket?' · '+esc(blabel(bucket,S.gran)):''}</h3><div class="dg-cal-facts"><b>${filtered.length}${reason?' из '+rows.length:''} ${row.kind==='lead'?'лидов':'сделок'}</b><span>${dgMoney(sum.money,'RUB')} · бюджет${sum.missing?' · без суммы '+sum.missing:''}</span><span>${sum.comm} коммуникаций</span><span>${sum.events} событий</span></div><p class="card-sub">Менеджер - текущий ответственный. Коммуникации - за всю историю записи.${row.mode==='lost'?' Причина и статус - из текущей карточки; дата - первый отказ.':''}</p>${reasons}<div class="scroll"><table class="tbl t1"><thead><tr><th>Менеджер</th><th>Записей</th><th>Бюджет</th><th>Коммуникаций</th><th>Всех событий</th></tr></thead><tbody>${html||'<tr><td colspan="5">Записей в этом интервале нет</td></tr>'}</tbody></table></div></div>`;
}
function dgCalendarRecordTable(rows,row){
 return `<table class="tbl t2"><thead><tr><th>Тип / ID</th><th>Статус / этап</th><th>Создана</th><th>${row.mode==='stock'?'Остаток на':'Событие'}</th><th>Бюджет</th><th>Предоплата</th><th>Последняя коммуникация</th><th>Лента</th></tr></thead><tbody>${rows.map(x=>{
  const d=x.record,ix=DATA.communicationIndex?.[x.key],open=S.dgCalRecords.has(x.key);
  return `<tr class="drow" data-dg-calrecord="${x.key}" tabindex="0" role="button" aria-expanded="${open}"><td>${open?'▾':'▸'} <span class="kind">${row.kind==='lead'?'Лид':'Сделка'}</span> <b>${esc(d.id)}</b></td><td>${esc(d.status||d.stage||'—')}${row.mode==='lost'?'<small>'+esc(x.reason)+'</small>'+((DATA.calendar?.leadReasonDetails?.[x.key])?'<small>'+esc(DATA.calendar.leadReasonDetails[x.key])+'</small>':''):''}</td><td>${dgDate(d.created)}</td><td>${dgDate(x.at)}</td><td>${dgMoney(d.budget,d.currency)}</td><td>${row.kind==='deal'?dgMoney(d.prepayAmt,d.currency):'—'}</td><td>${dgDate(ix?.lastAt?new Date(ix.lastAt).toISOString():null)}</td><td>${ix?.commIds?.length??'—'} комм.<small>${ix?.openTasks??'—'} открытых дел</small></td></tr>${open?`<tr class="subrow2"><td colspan="8"><div id="dg-comm-${x.key}" class="dg-comm-host">${dgCommCache.has(x.key)?dgCommunicationTable(x.key):'Загружаю историю…'}</div></td></tr>`:''}`;
 }).join('')}</tbody></table>`;
}
function dgCommunicationTable(key){
 const payload=dgCommCache.get(key);if(!payload)return 'Загружаю историю…';if(payload.error)return '<div class="dg-comm-error">Историю сейчас не удалось загрузить. <button data-dg-commretry="'+key+'">Повторить</button></div>';
 const types=[...new Set(payload.events.map(e=>e.type))],selected=S.dgCommChannel;
 const filters=`<div class="dg-comm-filters"><button data-dg-commchannel="all">Все · ${payload.events.length}</button>${types.map(t=>`<button data-dg-commchannel="${esc(t)}" class="${selected===t?'on':''}">${esc(t)} · ${payload.events.filter(e=>e.type===t).length}</button>`).join('')}</div>`;
 const rows=payload.events.filter(e=>selected==='all'||e.type===selected).slice().sort((a,b)=>(a.ts-b.ts)*(S.dgCommAsc?1:-1)).map(e=>{
  const day=dgMSKDay(e.ts),inRange=day>=S.start&&day<=S.end;
  const speakerNote=e.roleGuess?'<small>Роли определены по тексту и требуют проверки.</small>':'';const diarNote=e.undiar?'<small>Надёжного разделения говорящих нет.</small>':'';const speakers=e.speakers?.length?e.speakers.map(s=>`<div class="trln"><b>${esc(s.role)}:</b> ${esc(s.text)}</div>`).join(''):esc(e.body);
  const actual=e.entities.map(k=>k[0]==='L'?'лид '+k.slice(1):'сделка '+k.slice(1)).join(' · ');
  return `<tr class="erow2 ${inRange?'inrng':''}"><td class="etime">${new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'short'}).format(new Date(e.ts))}<small>${esc(actual)}</small></td><td class="${e.dir==='входящее'?'who-cli':e.dir==='исходящее'?'who-mgr':''}">${esc(e.who)}<small>${esc(e.dir)}${e.guess?' · сторона определена по тексту':''}</small></td><td><span class="badge">${esc(e.type)}</span></td><td class="ebody">${e.title?'<b>'+esc(e.title)+'</b><br>':''}${speakerNote}${diarNote}${speakers||'Текст события в CRM не заполнен'}${e.dur?'<small>Длительность: '+esc(e.dur)+'</small>':''}</td><td>${esc(e.status||'—')}<small>${e.origin==='dialog'?'Архив Диалогов':e.type==='Стадия'?'История CRM':'CRM'}</small>${e.due?'<small>Срок: '+dgDate(e.due)+'</small>':''}</td></tr>`;
 }).join('');
 return `<div class="dg-comm-title">Полная история · ${payload.events.length} событий · МСК</div>${filters}<button data-dg-commsort>${S.dgCommAsc?'Сначала старые':'Сначала новые'} ↕</button><div class="feedscroll"><table class="tbl t3"><thead><tr><th>Время</th><th>Кто</th><th>Канал</th><th>Сообщение</th><th>Статус / срок</th></tr></thead><tbody>${rows||'<tr><td colspan="5">В доступной выгрузке по этой записи событий нет</td></tr>'}</tbody></table></div>`;
}
async function dgLoadCommunication(key){
 if(!/^[LD]\d+$/.test(key)||!DATA.communicationIndex?.[key])return;
 if(!dgCommCache.has(key))try{const r=await fetch('communications/'+key+'.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const p=await r.json();if(p.key!==key||!Array.isArray(p.events)||p.generatedAt!==DATA.communicationCoverage?.generatedAt)throw Error();dgCommCache.set(key,p);}catch{dgCommCache.set(key,{error:true});}
 const host=document.getElementById('dg-comm-'+key);if(host)host.innerHTML=dgCommunicationTable(key);
}
function dgCalendarRerender(){render();for(const key of S.dgCalRecords)dgLoadCommunication(key);}
document.addEventListener('click',e=>{
 const row=e.target.closest('[data-dg-calrow]'),cell=e.target.closest('[data-dg-calcell]');
 if(row||cell){const [id,bucket]=cell?cell.dataset.dgCalcell.split('|'):[row.dataset.dgCalrow,null];S.dgCalPick=S.dgCalPick?.row===id&&S.dgCalPick?.bucket===bucket?null:{row:id,bucket,reason:''};S.dgCalManagers.clear();S.dgCalRecords.clear();S.dgCommChannel='all';dgCalendarRerender();return;}
 const unit=e.target.closest('[data-dg-calunit]');if(unit){S.calUnit=unit.dataset.dgCalunit;dgCalendarRerender();return;}
 const reason=e.target.closest('[data-dg-calreason]');if(reason){S.dgCalPick.reason=reason.dataset.dgCalreason;S.dgCalManagers.clear();S.dgCalRecords.clear();dgCalendarRerender();return;}
 const manager=e.target.closest('[data-dg-calmgr]');if(manager){const key=manager.dataset.dgCalmgr;if(S.dgCalManagers.has(key))S.dgCalManagers.delete(key);else S.dgCalManagers.add(key);dgCalendarRerender();return;}
 const record=e.target.closest('[data-dg-calrecord]');if(record){const key=record.dataset.dgCalrecord;if(S.dgCalRecords.has(key))S.dgCalRecords.delete(key);else S.dgCalRecords.add(key);S.dgCommChannel='all';dgCalendarRerender();return;}
 const channel=e.target.closest('[data-dg-commchannel]');if(channel){S.dgCommChannel=channel.dataset.dgCommchannel;for(const key of S.dgCalRecords){const host=document.getElementById('dg-comm-'+key);if(host)host.innerHTML=dgCommunicationTable(key);}return;}
 if(e.target.closest('[data-dg-commsort]')){S.dgCommAsc=!S.dgCommAsc;for(const key of S.dgCalRecords){const host=document.getElementById('dg-comm-'+key);if(host)host.innerHTML=dgCommunicationTable(key);}return;}
 const retry=e.target.closest('[data-dg-commretry]');if(retry){dgCommCache.delete(retry.dataset.dgCommretry);dgLoadCommunication(retry.dataset.dgCommretry);}
});
document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('[data-dg-calrecord]')){e.preventDefault();e.target.click();}});
