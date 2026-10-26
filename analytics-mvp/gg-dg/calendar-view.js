// Calendar counts and the Dialog table hierarchy share the same eligible DG records.
S.dgCalPick=null;S.dgCalExpanded=new Set();S.dgCalManagers=new Set();S.dgCalRecords=new Set();S.dgCommChannel='all';S.dgCommAsc=true;
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
const DG_CAL_LOOK={leads:['#22D3EE','лиды'],leadLost:['#CC5867','лиды'],deals:['#22D3EE','сделки'],wip:['#818CF8','в работе'],kp:['#60A5FA','в работе'],prepay:['#2E9E74','движение заказа'],production:['#818CF8','движение заказа'],shipping:['#60A5FA','движение заказа'],completed:['#2E9E74','исход'],lost:['#CC5867','исход']};
function dgCalendarHeatInk(color,t){const alpha=.93-Math.min(1,Math.max(0,t))*.75,rgb=[0,2,4].map(i=>parseInt(color.slice(1+i,3+i),16)),bg=[14,20,26],l=rgb.reduce((s,c,i)=>s+[.2126,.7152,.0722][i]*(c*alpha+bg[i]*(1-alpha)),0)/255;return l>.44?'#0B1016':'#D7E1EA';}
function dgCalendarLine(row,keys,manager=null){
 const money=S.calUnit==='money',color=DG_CAL_LOOK[row.id][0],pick=k=>dgCalendarRows(row,k).filter(x=>manager===null||(x.record.mgr||'Не распределено')===manager),amount=x=>x.key[0]==='L'?(x.record.currency==='RUB'?x.record.budget:null):(S.amtMode==='prepay'?x.record.prepayAmt:x.record.budget),value=rows=>money?rows.reduce((n,x)=>n+(amount(x)??0),0):rows.length,show=rows=>money?fmtK(value(rows))+(rows.some(x=>amount(x)==null)?'*':''):fmt(rows.length);
 const series=keys.map(k=>({key:k,rows:pick(k)})),values=series.map(x=>value(x.rows)),max=Math.max(1,...values),nonzero=values.filter(v=>v>0),min=nonzero.length?Math.min(...nonzero):0,lo=min>0&&min/max>=.5?min*.92:0,fs=keys.length>60?6.5:keys.length>40?7:keys.length>24?8:9;
 const cells=series.map(({key,rows})=>{const v=value(rows),t=max>lo?(v-lo)/(max-lo):0,alpha=.93-Math.min(1,Math.max(0,t))*.75,bg=rows.length?color+Math.round(alpha*255).toString(16).padStart(2,'0'):'var(--bg-base)',selected=S.dgCalPick?.row===row.id&&S.dgCalPick?.bucket===key&&(S.dgCalPick?.manager??null)===manager;
 return `<button class="dg-heat-cell" ${rows.length?`data-dg-calcell="${row.id}|${key}"${manager!==null?` data-dg-calmanager="${esc(manager)}"`:''}`:'disabled'} style="background:${bg};color:${rows.length?dgCalendarHeatInk(color,t):'transparent'};font-size:${manager===null?fs:fs-1}px;${selected?'box-shadow:inset 0 0 0 2px #22D3EE':''}" aria-label="${esc(row.label+' · '+blabel(key,S.gran)+' · '+show(rows))}" data-tip="${esc(row.label+' · '+blabel(key,S.gran)+' · '+rows.length+' записей'+(money?' · '+show(rows)+' ₽':''))}">${rows.length?show(rows):''}</button>`;}).join('');
 const total=pick(null),open=S.dgCalExpanded.has(row.id),selected=S.dgCalPick?.row===row.id&&(S.dgCalPick?.manager??null)===manager;
 const label=manager===null?`<button class="dg-heat-label" data-dg-calrow="${row.id}" aria-expanded="${open}"><span class="dg-heat-arrow">${open?'▾':'▸'}</span> ${esc(row.label)}${row.mode!=='stock'?` <b style="color:${color}">${show(total)}</b>`:''}</button>`:`<button class="dg-heat-label dg-heat-manager" data-dg-calopen="${row.id}" data-dg-calmanager="${esc(manager)}"><span class="dg-heat-arrow">▸</span> ${esc(manager)}</button>`;
 return `<div class="chrow dg-heat-row ${manager!==null?'dg-heat-sub':''}">${label}<div class="dg-heat-cells">${cells}</div><button class="dg-heat-total" data-dg-calopen="${row.id}"${manager!==null?` data-dg-calmanager="${esc(manager)}"`:''} style="color:${color}" data-tip="${row.mode==='stock'?'Остаток на конец выбранного периода, не сумма столбцов':'Итог за выбранный период'}">${show(total)}${row.mode==='stock'?'<small>на конец</small>':''}</button></div>`;
}
function dgCalendarBlock(){
 const keys=dgCalendarKeys(),money=S.calUnit==='money',step=Math.max(1,Math.ceil(keys.length/12));let group='';
 const head=`<div class="dg-heat-head"><div class="dg-heat-spacer"></div><div class="dg-heat-cells">${keys.map((k,i)=>`<div>${keys.length<=16||i%step===0||i===keys.length-1?blabel(k,S.gran):''}</div>`).join('')}</div><div class="dg-heat-sigma">Σ ${money?'₽':'зап.'}</div></div>`;
 const body=DG_CAL_ROWS.map(row=>{const [color,g]=DG_CAL_LOOK[row.id];let h=group!==g?`<div class="dg-heat-group" style="color:${color};border-color:${color}">${g}</div>`:'';group=g;h+=dgCalendarLine(row,keys);
  if(S.dgCalExpanded.has(row.id)){const names=[...new Set([...(dgCalendarRows(row).map(x=>x.record.mgr||'Не распределено')),...keys.flatMap(k=>dgCalendarRows(row,k).map(x=>x.record.mgr||'Не распределено'))])].sort((a,b)=>a.localeCompare(b,'ru'));h+=names.map(m=>dgCalendarLine(row,keys,m)).join('');}
  if(S.dgCalPick?.row===row.id)h+=dgCalendarDetail(row);return h;
 }).join('');
 const coverage=DATA.communicationCoverage,cache=coverage?.cache,cacheNote=cache?.status==='available'?'Диалоги: '+dgCalendarDateTime(cache.generatedAt):'Дополнение из «Диалогов» недоступно';
 return `<section class="card dg-calendar dg-calendar-gg" id="dg-calendar"><div class="card-h"><div><div class="card-title">Календарь лидов и сделок</div><div class="card-sub">Клик по названию - менеджеры; по ячейке или итогу - записи и коммуникации</div></div><div class="seg"><button data-dg-calunit="count" class="${!money?'on':''}">Количество</button><button data-dg-calunit="money" class="${money?'on':''}">Сумма</button></div></div><div class="card-sub dg-heat-freshness">CRM: ${dgCalendarDateTime(coverage?.generatedAt)} · ${cacheNote}</div><div class="scroll"><div class="dg-heat-calendar" style="--dg-total:${money?108:84}px">${head}${body}</div></div><div class="dg-dist-note">Формирование ТЗ - открытый остаток на конец интервала. Остальные этапы - первые переходы; строки не складываются между собой. В суммах лиды показывают бюджет, сделки - выбранное поле. * - есть записи без суммы в ₽.</div></section>`;
}

function dgCalendarDetail(row){
 const bucket=S.dgCalPick?.bucket,rows=dgCalendarRows(row,bucket).filter(x=>!S.dgCalPick?.manager||(x.record.mgr||'Не распределено')===S.dgCalPick.manager);
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
 const rows=payload.events.slice().sort((a,b)=>(a.ts-b.ts)*(S.dgCommAsc?1:-1)).map(e=>{
  const day=dgMSKDay(e.ts),inRange=day>=S.start&&day<=S.end;
  const speakerNote=e.roleGuess?'<small>Роли определены по тексту и требуют проверки.</small>':'';const diarNote=e.undiar?'<small>Надёжного разделения говорящих нет.</small>':'';const speakers=e.speakers?.length?e.speakers.map(s=>`<div class="trln"><b>${esc(s.role)}:</b> ${esc(s.text)}</div>`).join(''):esc(e.body);
  const actual=e.entities.map(k=>k[0]==='L'?'лид '+k.slice(1):'сделка '+k.slice(1)).join(' · ');
  return `<tr class="erow2 ${inRange?'inrng':''}"><td class="etime">${new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'short'}).format(new Date(e.ts))}<small>${esc(actual)}</small></td><td class="${e.dir==='входящее'?'who-cli':e.dir==='исходящее'?'who-mgr':''}">${esc(e.who)}<small>${esc(e.dir)}${e.guess?' · сторона определена по тексту':''}</small></td><td><span class="badge">${esc(e.type)}</span></td><td class="ebody">${e.title?'<b>'+esc(e.title)+'</b><br>':''}${speakerNote}${diarNote}${speakers||'Текст события в CRM не заполнен'}${e.dur?'<small>Длительность: '+esc(e.dur)+'</small>':''}</td><td>${esc(e.status||'—')}<small>${e.origin==='dialog'?'Архив Диалогов':e.type==='Стадия'?'История CRM':'CRM'}</small>${e.due?'<small>Срок: '+dgDate(e.due)+'</small>':''}</td></tr>`;
 }).join('');
 return `<button data-dg-commsort>${S.dgCommAsc?'Сначала старые':'Сначала новые'} ↕</button><div class="feedscroll"><table class="tbl t3"><thead><tr><th>Время</th><th>Кто</th><th>Канал</th><th>Сообщение</th><th>Статус / срок</th></tr></thead><tbody>${rows||'<tr><td colspan="5">В доступной выгрузке по этой записи событий нет</td></tr>'}</tbody></table></div>`;
}
async function dgLoadCommunication(key){
 if(!/^[LD]\d+$/.test(key)||!DATA.communicationIndex?.[key])return;
 if(!dgCommCache.has(key))try{const r=await fetch('communications/'+key+'.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const p=await r.json();if(p.key!==key||!Array.isArray(p.events)||p.generatedAt!==DATA.communicationCoverage?.generatedAt)throw Error();dgCommCache.set(key,p);}catch{dgCommCache.set(key,{error:true});}
 const host=document.getElementById('dg-comm-'+key);if(host)host.innerHTML=dgCommunicationTable(key);
}
function dgCalendarRerender(){render();for(const key of S.dgCalRecords)dgLoadCommunication(key);}
document.addEventListener('click',e=>{
 const row=e.target.closest('[data-dg-calrow]'),cell=e.target.closest('[data-dg-calcell]'),open=e.target.closest('[data-dg-calopen]');
 if(row){const id=row.dataset.dgCalrow;if(S.dgCalExpanded.has(id)){S.dgCalExpanded.delete(id);if(S.dgCalPick?.row===id)S.dgCalPick=null;}else S.dgCalExpanded.add(id);S.dgCalRecords.clear();dgCalendarRerender();return;}
 if(cell||open){const target=cell||open,[id,bucket]=cell?cell.dataset.dgCalcell.split('|'):[open.dataset.dgCalopen,null],manager=target.dataset.dgCalmanager||null;S.dgCalPick=S.dgCalPick?.row===id&&S.dgCalPick?.bucket===bucket&&(S.dgCalPick?.manager??null)===manager?null:{row:id,bucket,manager,reason:''};S.dgCalManagers.clear();if(manager)S.dgCalManagers.add(manager);S.dgCalRecords.clear();S.dgCommChannel='all';dgCalendarRerender();return;}
 const unit=e.target.closest('[data-dg-calunit]');if(unit){S.calUnit=unit.dataset.dgCalunit;dgCalendarRerender();return;}
 const reason=e.target.closest('[data-dg-calreason]');if(reason){S.dgCalPick.reason=reason.dataset.dgCalreason;S.dgCalManagers.clear();S.dgCalRecords.clear();dgCalendarRerender();return;}
 const manager=e.target.closest('[data-dg-calmgr]');if(manager){const key=manager.dataset.dgCalmgr;if(S.dgCalManagers.has(key))S.dgCalManagers.delete(key);else S.dgCalManagers.add(key);dgCalendarRerender();return;}
 const record=e.target.closest('[data-dg-calrecord]');if(record){const key=record.dataset.dgCalrecord;if(S.dgCalRecords.has(key))S.dgCalRecords.delete(key);else S.dgCalRecords.add(key);S.dgCommChannel='all';dgCalendarRerender();return;}
 const channel=e.target.closest('[data-dg-commchannel]');if(channel){S.dgCommChannel=channel.dataset.dgCommchannel;for(const key of S.dgCalRecords){const host=document.getElementById('dg-comm-'+key);if(host)host.innerHTML=dgCommunicationTable(key);}return;}
 if(e.target.closest('[data-dg-commsort]')){S.dgCommAsc=!S.dgCommAsc;for(const key of S.dgCalRecords){const host=document.getElementById('dg-comm-'+key);if(host)host.innerHTML=dgCommunicationTable(key);}return;}
 const retry=e.target.closest('[data-dg-commretry]');if(retry){dgCommCache.delete(retry.dataset.dgCommretry);dgLoadCommunication(retry.dataset.dgCommretry);}
});
document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('[data-dg-calrecord]')){e.preventDefault();e.target.click();}});
