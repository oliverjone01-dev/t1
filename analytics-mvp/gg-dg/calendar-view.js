// Calendar counts and the Dialog table hierarchy share the same eligible DG records.
S.dgCalAmount='budget';S.dgCalPick=null;S.dgCalGroup='leads';S.dgCalExpanded=new Set();S.dgCalManagers=new Set();S.dgCalRecords=new Set();S.dgCommChannel='all';S.dgCommAsc=true;
S.dgCalDealsOpen=false;
const dgCommCache=new Map();
S.dgLossKind='all';S.dgLossTop=10;S.dgLossPage=0;S.dgLossOpen=true;
function dgRefusalRows(){
 return ['leadLost','lost'].flatMap(id=>dgCalendarRows(DG_CAL_ROWS.find(row=>row.id===id))).filter(x=>S.dgLossKind==='all'||(S.dgLossKind==='lead')===(x.key[0]==='L')).map(x=>{const detail=String(DATA.calendar?.leadReasonDetails?.[x.key]||'').trim(),reason=String(x.reason||'').trim();return {...x,reason:detail||(reason==='—'?'':reason)||'Не заполнена'};}).sort((a,b)=>b.at.localeCompare(a.at)||Number(b.record.id)-Number(a.record.id));
}
function dgRefusalGroups(rows){
 const groups=new Map();for(const x of rows){const name=x.reason.trim().replace(/\s+/g,' '),key=name.toLocaleLowerCase('ru');if(!groups.has(key))groups.set(key,{name,count:0});groups.get(key).count++;}return [...groups.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ru'));
}
function dgRefusalBlock(){
 const rows=dgRefusalRows(),groups=dgRefusalGroups(rows),shown=groups.slice(0,S.dgLossTop),max=Math.max(1,...groups.map(g=>g.count)),pages=Math.max(1,Math.ceil(rows.length/20)),page=Math.min(S.dgLossPage,pages-1),slice=rows.slice(page*20,page*20+20);
 const kinds=`<div class="seg" aria-label="Вид отказных записей">${[['all','Все'],['lead','Лиды'],['deal','Сделки']].map(([id,label])=>`<button data-dg-loss-kind="${id}" class="${S.dgLossKind===id?'on':''}">${label}</button>`).join('')}</div>`;
 const bars=shown.map(g=>`<div class="dg-loss-bar" aria-label="${esc(g.name+' · '+g.count)}"><span title="${esc(g.name)}">${esc(g.name)}</span><div class="dg-loss-track"><i style="width:${g.count/max*100}%"></i></div><b>${fmt(g.count)}</b></div>`).join('');
 const td=(label,body)=>`<td data-label="${label}"><div>${body}</div></td>`;
 const body=slice.map(x=>{const d=x.record,lead=x.key[0]==='L',related=lead?DATA.deals.filter(a=>String(a.leadId)===String(d.id)):[d],values=field=>[...new Set(related.map(a=>a[field]).filter(Boolean))].join(', ')||'—',ix=DATA.communicationIndex?.[x.key],last=(ix?.ids||[]).reduce((at,id)=>Math.max(at,dgBakedEvents.get(id)?.ts||0),0),history=dgHistory(d,lead?'lead':'deal').find(e=>e.semantic==='F'),stage=history?dgBakedEvents.get('stage#'+x.key+':'+history.id)?.body:null;
  return `<tr>${td('Лид / сделка',(lead?'Лид ':'Сделка ')+esc(d.id))}${td('Ответственный',esc(d.mgr||'Не распределено'))}${td('Даты',`<small>Создана</small>${dgDate(d.created)}<small>Отказ</small>${dgDate(x.at)}<small>Активность</small>${dgDate(last?dgMSKDay(last):d.lastTouch)}`)}${td('Стадия отказа',esc(stage||d.status||d.stage||'—'))}${td('Причина',esc(x.reason))}${td('Тип клиента',esc(values('client')))}${td('Ассортимент',esc(values('assort')))}${td('Исходный лид',!lead&&d.leadId?esc(d.leadId):'—')}</tr>`;
 }).join('');
 return `<section class="dg-refusals-grid" id="dg-refusals"><div class="card"><div class="card-title">Причины отказов</div><div class="card-sub">По дате первого отказа в выбранном периоде · лиды и сделки считаются отдельно</div><div class="dg-loss-controls">${kinds}<div class="seg" aria-label="Число причин">${[10,30,50].map(n=>`<button data-dg-loss-top="${n}" class="${S.dgLossTop===n?'on':''}">Топ ${n}</button>`).join('')}</div></div><div class="dg-loss-chart">${bars||'<div class="card-sub">В выбранном периоде отказов нет</div>'}</div><div class="card-sub">${rows.length} записей · ${groups.length} причин · показано ${shown.length}</div></div><div class="card"><button class="dg-loss-heading" data-dg-loss-toggle aria-expanded="${S.dgLossOpen}">${S.dgLossOpen?'▾':'▸'} Отказные лиды и сделки · ${rows.length}</button>${S.dgLossOpen?`<div class="card-sub">Последняя активность — последнее событие в истории записи. У лида тип клиента и ассортимент показаны по связанным сделкам.</div><div class="dg-loss-table-scroll"><table class="dg-refusal-table"><thead><tr>${['Лид / сделка','Ответственный','Даты','Стадия отказа','Причина отказа','Тип клиента','Ассортимент','Исходный лид'].map(t=>'<th>'+t+'</th>').join('')}</tr></thead><tbody>${body||'<tr><td colspan="8">В выбранном периоде отказов нет</td></tr>'}</tbody></table></div><div class="dg-loss-pagination"><span>${rows.length?page*20+1:0}–${Math.min((page+1)*20,rows.length)} из ${rows.length} · до 20 строк</span>${pages>1?`<button data-dg-loss-page="${page-1}" ${page===0?'disabled':''}>Назад</button><span>${page+1} / ${pages}</span><button data-dg-loss-page="${page+1}" ${page===pages-1?'disabled':''}>Вперёд</button>`:''}</div>`:''}</div></section>`;
}
document.addEventListener('click',e=>{
 const kind=e.target.closest('[data-dg-loss-kind]'),top=e.target.closest('[data-dg-loss-top]'),page=e.target.closest('[data-dg-loss-page]'),toggle=e.target.closest('[data-dg-loss-toggle]');
 if(kind){S.dgLossKind=kind.dataset.dgLossKind;S.dgLossPage=0;}else if(top)S.dgLossTop=Number(top.dataset.dgLossTop);else if(page)S.dgLossPage=Math.max(0,Number(page.dataset.dgLossPage));else if(toggle)S.dgLossOpen=!S.dgLossOpen;else return;dgCalendarRerender();
});
// Keep records and communications in the same authenticated snapshot, even across server refreshes.
const dgBakedEvents=new Map((DATA.communicationEvents||[]).map(event=>[event.id,event]));
for(const [key,index]of Object.entries(DATA.communicationIndex||{}))if(index.ids.every(id=>dgBakedEvents.has(id)))dgCommCache.set(key,{key,generatedAt:DATA.communicationCoverage?.generatedAt,events:index.ids.map(id=>dgBakedEvents.get(id))});
const DG_CAL_GROUPS=[{id:'leads',label:'Лиды',rows:['leads','leadLost']},{id:'deals',label:'Сделки',rows:['deals']},{id:'wip',label:'В работе',rows:['wip','kp']},{id:'movement',label:'Движение заказа',rows:['prepay','production','shipping']},{id:'outcome',label:'Исход',rows:['completed','lost']}];
const DG_CAL_ROWS=[
 {id:'leads',label:'Лиды',kind:'lead',mode:'created'},
 {id:'leadLost',label:'Отказы лидов',kind:'lead',mode:'lost'},
 {id:'deals',label:'Сделки',kind:'deal',mode:'created'},
 {id:'wip',label:'Формирование ТЗ',kind:'deal',mode:'stock',code:'C49:PREPARATION'},
 {id:'kp',label:'КП отправлено',kind:'deal',code:'C49:PREPAYMENT_INVOIC'},
 {id:'prepay',label:'Предоплата',kind:'deal',code:'C49:EXECUTING'},
 {id:'production',label:'В производстве',kind:'deal',code:'C49:FINAL_INVOICE'},
 {id:'shipping',label:'Отгрузка',kind:'deal',code:'C49:2'},
 {id:'completed',label:'Успех',kind:'deal',code:'C49:WON'},
 {id:'lost',label:'Отказ сделок',kind:'deal',mode:'lost'}
];
const DG_CAL_DEAL_STAGES=['wip','kp','prepay','production','shipping'];
function dgCalendarSparkline(values,color,label,keys=[],counts=[],missing=[]){
 const max=Math.max(1,...values),points=values.map((v,i)=>`${values.length===1?50:2+i*96/(values.length-1)},${24-v/max*22}`).join(' '),description=label+' · '+(S.calUnit==='money'?'₽':'записей')+': '+values.map((v,i)=>fmt(v)+(S.calUnit==='money'&&missing[i]?'*':'')).join(' → ');
 const hits=keys.map((key,i)=>{const [from,to]=dgBucketRange(key),date=dgDate(from)+(from!==to?' — '+dgDate(to):''),x=j=>values.length===1?50:2+j*96/(values.length-1),left=i?(x(i-1)+x(i))/2:0,right=i===keys.length-1?100:(x(i)+x(i+1))/2,rows=[['Дата',date],['Количество',fmt(counts[i]??0)]];if(S.calUnit==='money'){const unknown=missing[i]||0;rows.push([unknown?'Известная сумма':'Сумма',unknown&&unknown===counts[i]?'Не указана':fmt(values[i])+' ₽']);if(unknown)rows.push(['Записей без суммы',fmt(unknown)+' из '+fmt(counts[i])]);}return `<rect class="dg-spark-hit" x="${left}" y="0" width="${right-left}" height="26" fill="transparent" data-tip="${esc(dt(esc(label),rows))}"/>`;}).join('');
 return `<svg class="dg-heat-spark" viewBox="0 0 100 26" role="img" aria-label="${esc(description)}">${values.length===1?`<circle cx="50" cy="${24-values[0]/max*22}" r="2" fill="${color}"/>`:`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>`}${hits}</svg>`;
}
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
 const money=S.calUnit==='money',color=DG_CAL_LOOK[row.id][0],pick=k=>dgCalendarRows(row,k).filter(x=>manager===null||(x.record.mgr||'Не распределено')===manager),amount=x=>x.key[0]==='L'?(x.record.currency==='RUB'?x.record.budget:null):(S.dgCalAmount==='prepay'?x.record.prepayAmt:x.record.budget),value=rows=>money?rows.reduce((n,x)=>n+(amount(x)??0),0):rows.length,show=rows=>money?fmtK(value(rows))+(rows.some(x=>amount(x)==null)?'*':''):fmt(rows.length);
 const series=keys.map(k=>({key:k,rows:pick(k)})),values=series.map(x=>value(x.rows)),max=Math.max(1,...values),nonzero=values.filter(v=>v>0),min=nonzero.length?Math.min(...nonzero):0,lo=min>0&&min/max>=.5?min*.92:0,fs=keys.length>60?6.5:keys.length>40?7:keys.length>24?8:9;
 const cells=series.map(({key,rows})=>{const v=value(rows),t=max>lo?(v-lo)/(max-lo):0,alpha=.93-Math.min(1,Math.max(0,t))*.75,bg=rows.length?color+Math.round(alpha*255).toString(16).padStart(2,'0'):'var(--bg-base)',selected=S.dgCalPick?.row===row.id&&S.dgCalPick?.bucket===key&&(S.dgCalPick?.manager??null)===manager;
 return `<button class="dg-heat-cell" ${rows.length?`data-dg-calcell="${row.id}|${key}"${manager!==null?` data-dg-calmanager="${esc(manager)}"`:''}`:'disabled'} style="background:${bg};color:${rows.length?dgCalendarHeatInk(color,t):'transparent'};font-size:${manager===null?fs:fs-1}px;${selected?'box-shadow:inset 0 0 0 2px #22D3EE':''}" aria-label="${esc(row.label+' · '+blabel(key,S.gran)+' · '+show(rows))}" data-tip="${esc(row.label+' · '+blabel(key,S.gran)+' · '+rows.length+' записей'+(money?' · '+show(rows)+' ₽':''))}">${rows.length?show(rows):''}</button>`;}).join('');
 const total=pick(null),open=row.id==='deals'?S.dgCalDealsOpen:S.dgCalExpanded.has(row.id),selected=S.dgCalPick?.row===row.id&&(S.dgCalPick?.manager??null)===manager;
 const label=manager===null?`<button style="border-left:2px solid ${color}" class="dg-heat-label" data-dg-calrow="${row.id}" aria-expanded="${open}"><span class="dg-heat-arrow">${open?'▾':'▸'}</span> ${esc(row.label)}${row.mode!=='stock'?` <b style="color:${color}">${show(total)}</b>`:''}</button>`:`<button class="dg-heat-label dg-heat-manager" data-dg-calopen="${row.id}" data-dg-calmanager="${esc(manager)}" aria-expanded="${selected}"><span class="dg-heat-arrow">${selected?'▾':'▸'}</span> ${esc(manager)}</button>`;
 return `<div class="chrow dg-heat-row ${manager!==null?'dg-heat-sub':''}" data-dg-heatrow="${row.id}">${label}<div class="dg-heat-cells">${cells}</div><button class="dg-heat-total" data-dg-calopen="${row.id}"${manager!==null?` data-dg-calmanager="${esc(manager)}"`:''} style="color:${color}" data-tip="${row.mode==='stock'?'Открытый остаток, не сумма столбцов':'Итог за выбранный период'}">${show(total)}</button>${dgCalendarSparkline(values,color,row.label+(manager?' · '+manager:''),keys,series.map(x=>x.rows.length),series.map(x=>x.rows.filter(r=>amount(r)==null).length))}</div>`;
}
function dgCalendarBlock(){
 const keys=dgCalendarKeys(),money=S.calUnit==='money',step=Math.max(1,Math.ceil(keys.length/12));
 const head=`<div class="dg-heat-head"><div class="dg-heat-spacer"></div><div class="dg-heat-cells">${keys.map((k,i)=>`<div>${keys.length<=16||i%step===0||i===keys.length-1?blabel(k,S.gran):''}</div>`).join('')}</div><div class="dg-heat-sigma">Σ ${money?'₽':'зап.'}</div><div class="dg-heat-spark-heading">Динамика</div></div>`;
 const draw=row=>{let h=dgCalendarLine(row,keys);
  const picked=S.dgCalPick?.row===row.id;
  if(picked&&!S.dgCalPick.manager)h+=dgCalendarDetail(row);
  if(S.dgCalExpanded.has(row.id)){const names=[...new Set([...(dgCalendarRows(row).map(x=>x.record.mgr||'Не распределено')),...keys.flatMap(k=>dgCalendarRows(row,k).map(x=>x.record.mgr||'Не распределено'))])].sort((a,b)=>a.localeCompare(b,'ru'));h+=names.map(m=>dgCalendarLine(row,keys,m)+(picked&&S.dgCalPick.manager===m?dgCalendarDetail(row):'')).join('');}
  return h;
 };
 const body=DG_CAL_ROWS.filter(row=>!DG_CAL_DEAL_STAGES.includes(row.id)).map(row=>draw(row)+(row.id==='deals'&&S.dgCalDealsOpen?`<div class="dg-deal-stages">${DG_CAL_DEAL_STAGES.map(id=>draw(DG_CAL_ROWS.find(r=>r.id===id))).join('')}</div>`:'')).join('');
 const coverage=DATA.communicationCoverage,cache=coverage?.cache,cacheNote=cache?.status==='available'?'Диалоги: '+dgCalendarDateTime(cache.generatedAt):'Дополнение из «Диалогов» недоступно';
 return `<section class="card dg-calendar dg-calendar-gg" id="dg-calendar"><div class="card-h"><div><div class="card-title">Календарь лидов и сделок</div><div class="card-sub">Этап → ответственный → лид или сделка → коммуникации</div></div><div class="dg-calendar-controls">${money?`<div class="seg" aria-label="Поле суммы календаря"><button data-dg-calamount="budget" class="${S.dgCalAmount!=='prepay'?'on':''}">Бюджет</button><button data-dg-calamount="prepay" class="${S.dgCalAmount==='prepay'?'on':''}">Предоплата</button></div>`:''}<div class="seg"><button data-dg-calunit="count" class="${!money?'on':''}">Количество</button><button data-dg-calunit="money" class="${money?'on':''}">Сумма</button></div></div></div><div class="card-sub dg-heat-freshness">CRM: ${dgCalendarDateTime(coverage?.generatedAt)} · ${cacheNote}</div><div class="dg-calendar-workspace"><div id="dg-calendar-panel" class="scroll dg-heat-scroll"><div class="dg-heat-calendar" style="--dg-total:${money?108:84}px">${head}${body}</div></div></div></section>`;
}

function dgCalendarDetail(row){
 const bucket=S.dgCalPick?.bucket,rows=dgCalendarRows(row,bucket).filter(x=>!S.dgCalPick?.manager||(x.record.mgr||'Не распределено')===S.dgCalPick.manager);
 let filtered=rows;const reason=S.dgCalPick?.reason;
 if(reason)filtered=rows.filter(x=>x.reason===reason);
 if(S.dgCalPick?.manager)return `<div class="dg-calendar-drill dg-direct-records">${dgCalendarRecordTable(filtered,row)}</div>`;
 const managers=[...new Set(filtered.map(x=>x.record.mgr||'Не распределено'))].sort((a,b)=>a.localeCompare(b,'ru'));
 const html=managers.map(manager=>{
  const records=filtered.filter(x=>(x.record.mgr||'Не распределено')===manager),s=dgCalendarSummary(records),open=S.dgCalManagers.has(manager);
  return `<tr class="mrow"><td><button data-dg-calmgr="${esc(manager)}" aria-expanded="${open}">${open?'▾':'▸'} ${esc(manager)}</button></td><td>${records.length}</td><td>${dgMoney(s.money,'RUB')}${s.missing?' · без суммы '+s.missing:''}</td><td>${s.comm}</td><td>${s.events}</td></tr>${open?`<tr class="subrow"><td colspan="5">${dgCalendarRecordTable(records,row)}</td></tr>`:''}`;
 }).join('');
 return `<div class="dg-calendar-drill"><h3>${esc(row.label)}${bucket?' · '+esc(blabel(bucket,S.gran)):''}</h3><div class="dg-records" tabindex="0" role="region" aria-label="Таблица ответственных"><table class="tbl t1"><thead><tr><th>Менеджер</th><th>Записей</th><th>Бюджет</th><th>Коммуникаций</th><th>Всех событий</th></tr></thead><tbody>${html||'<tr><td colspan="5">Записей в этом интервале нет</td></tr>'}</tbody></table></div></div>`;
}
function dgCalendarRecordTable(rows,row){
 const refusal=row.mode==='lost';
 return `<div class="dg-record-list" tabindex="0" role="region" aria-label="Таблица лидов и сделок"><table class="tbl t2"><thead><tr><th>Тип / ID</th><th>Статус / этап</th>${refusal?'<th>Причина отказа</th>':''}<th>Создана</th><th>${row.mode==='stock'?'Дата остатка':'Событие'}</th><th>Бюджет</th><th>Предоплата</th><th>Последняя коммуникация</th><th>Лента</th></tr></thead><tbody>${rows.map(x=>{
  const d=x.record,ix=DATA.communicationIndex?.[x.key],open=S.dgCalRecords.has(x.key);
  return `<tr class="drow" data-dg-calrecord="${x.key}" tabindex="0" role="button" aria-expanded="${open}"><td>${open?'▾':'▸'} <span class="kind">${row.kind==='lead'?'Лид':'Сделка'}</span> <b>${esc(d.id)}</b></td><td>${esc(d.status||d.stage||'—')}</td>${refusal?'<td class="dg-refusal-reason">'+esc(DATA.calendar?.leadReasonDetails?.[x.key]||x.reason||'Не заполнена')+'</td>':''}<td>${dgDate(d.created)}</td><td>${dgDate(x.at)}</td><td>${dgMoney(d.budget,d.currency)}</td><td>${row.kind==='deal'?dgMoney(d.prepayAmt,d.currency):'—'}</td><td>${dgDate(ix?.lastAt?dgMSKDay(ix.lastAt):null)}</td><td>${ix?.commIds?.length??'—'} комм.<small>${ix?.openTasks??'—'} открытых дел</small></td></tr>${open?`<tr class="subrow2"><td colspan="${refusal?9:8}"><div id="dg-comm-${x.key}" class="dg-comm-host">${dgCommCache.has(x.key)?dgCommunicationTable(x.key):'Загружаю историю…'}</div></td></tr>`:''}`;
 }).join('')}</tbody></table></div>`;
}
function dgCommunicationTable(key){
 const payload=dgCommCache.get(key);if(!payload)return 'Загружаю историю…';if(payload.error)return '<div class="dg-comm-error">Историю сейчас не удалось загрузить. <button data-dg-commretry="'+key+'">Повторить</button></div>';
 const types=[...new Set(payload.events.map(e=>e.type))],selected=S.dgCommChannel;
 const filters=`<div class="dg-comm-filters"><button data-dg-commchannel="all">Все · ${payload.events.length}</button>${types.map(t=>`<button data-dg-commchannel="${esc(t)}" class="${selected===t?'on':''}">${esc(t)} · ${payload.events.filter(e=>e.type===t).length}</button>`).join('')}</div>`;
 const rows=payload.events.slice().sort((a,b)=>(a.ts-b.ts)*(S.dgCommAsc?1:-1)).map(e=>{
  const speakerNote=e.roleGuess?'<small>Роли определены по тексту и требуют проверки.</small>':'';const diarNote=e.undiar?'<small>Надёжного разделения говорящих нет.</small>':'';const speakers=e.speakers?.length?e.speakers.map(s=>`<div class="trln"><b>${esc(s.role)}:</b> ${esc(s.text)}</div>`).join(''):esc(e.body);
  const actual=e.entities.map(k=>k[0]==='L'?'лид '+k.slice(1):'сделка '+k.slice(1)).join(' · ');
  const technical=!/^(Письмо|Звонок|SMS|Мессенджер ОЛ|Сообщение)/.test(e.type||'');
  const channelLabel=e.type==='Комментарий-заметка'?'Комментарий':e.type;
  return `<tr class="erow2${technical?' dg-technical':''}"><td class="etime">${new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'short'}).format(new Date(e.ts))}<small>${esc(actual)}</small></td><td class="${e.dir==='входящее'?'who-cli':e.dir==='исходящее'?'who-mgr':''}">${esc(e.who)}<small>${esc(e.dir)}${e.guess?' · сторона определена по тексту':''}</small></td><td><span class="badge">${esc(channelLabel)}</span></td><td class="ebody">${e.title?'<b>'+esc(e.title)+'</b><br>':''}${speakerNote}${diarNote}${speakers||'Текст события в CRM не заполнен'}${e.dur?'<small>Длительность: '+esc(e.dur)+'</small>':''}</td><td>${esc(e.status||'—')}<small>${e.origin==='dialog'?'Архив Диалогов':e.type==='Стадия'?'История CRM':'CRM'}</small>${e.due?'<small>Срок: '+dgDate(e.due)+'</small>':''}</td></tr>`;
 }).join('');
 return `<button data-dg-commsort>${S.dgCommAsc?'Сначала старые':'Сначала новые'} ↕</button><div class="feedscroll" tabindex="0" role="region" aria-label="Коммуникации ${key[0]==='L'?'лида':'сделки'} ${esc(key.slice(1))}"><table class="tbl t3"><thead><tr><th>Время</th><th>Кто</th><th>Канал</th><th>Сообщение</th><th>Статус / срок</th></tr></thead><tbody>${rows||'<tr><td colspan="5">В доступной выгрузке по этой записи событий нет</td></tr>'}</tbody></table></div>`;
}
async function dgLoadCommunication(key){
 if(!/^[LD]\d+$/.test(key)||!DATA.communicationIndex?.[key])return;
 if(!dgCommCache.has(key))try{const r=await fetch('communications/'+key+'.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const p=await r.json();if(p.key!==key||!Array.isArray(p.events)||p.generatedAt!==DATA.communicationCoverage?.generatedAt)throw Error();dgCommCache.set(key,p);}catch{dgCommCache.set(key,{error:true});}
 const host=document.getElementById('dg-comm-'+key);if(host)host.innerHTML=dgCommunicationTable(key);
}
function dgCalendarRerender(){render();for(const key of S.dgCalRecords)dgLoadCommunication(key);}
document.addEventListener('click',e=>{
 const group=e.target.closest('[data-dg-calgroup]');if(group&&DG_CAL_GROUPS.some(g=>g.id===group.dataset.dgCalgroup)){S.dgCalGroup=group.dataset.dgCalgroup;S.dgCalPick=null;S.dgCalExpanded.clear();S.dgCalManagers.clear();S.dgCalRecords.clear();dgCalendarRerender();document.getElementById('dg-tab-'+S.dgCalGroup)?.focus();return;}
 const row=e.target.closest('[data-dg-calrow]'),cell=e.target.closest('[data-dg-calcell]'),open=e.target.closest('[data-dg-calopen]');
 if(row){const id=row.dataset.dgCalrow;if(id==='deals'){S.dgCalDealsOpen=!S.dgCalDealsOpen;if(!S.dgCalDealsOpen){for(const stage of DG_CAL_DEAL_STAGES)S.dgCalExpanded.delete(stage);if(DG_CAL_DEAL_STAGES.includes(S.dgCalPick?.row))S.dgCalPick=null;}S.dgCalManagers.clear();S.dgCalRecords.clear();dgCalendarRerender();return;}if(S.dgCalExpanded.has(id)){S.dgCalExpanded.delete(id);if(S.dgCalPick?.row===id)S.dgCalPick=null;}else S.dgCalExpanded.add(id);S.dgCalRecords.clear();dgCalendarRerender();return;}
 if(cell||open){const target=cell||open,[id,bucket]=cell?cell.dataset.dgCalcell.split('|'):[open.dataset.dgCalopen,null],manager=target.dataset.dgCalmanager||null;S.dgCalPick=S.dgCalPick?.row===id&&S.dgCalPick?.bucket===bucket&&(S.dgCalPick?.manager??null)===manager?null:{row:id,bucket,manager,reason:''};S.dgCalManagers.clear();S.dgCalRecords.clear();S.dgCommChannel='all';dgCalendarRerender();return;}
 const amount=e.target.closest('[data-dg-calamount]');if(amount){S.dgCalAmount=amount.dataset.dgCalamount;dgCalendarRerender();return;}
 const unit=e.target.closest('[data-dg-calunit]');if(unit){S.calUnit=unit.dataset.dgCalunit;dgCalendarRerender();return;}
 const reason=e.target.closest('[data-dg-calreason]');if(reason){S.dgCalPick.reason=reason.dataset.dgCalreason;S.dgCalManagers.clear();S.dgCalRecords.clear();dgCalendarRerender();return;}
 const manager=e.target.closest('[data-dg-calmgr]');if(manager){const key=manager.dataset.dgCalmgr;if(S.dgCalManagers.has(key))S.dgCalManagers.delete(key);else S.dgCalManagers.add(key);dgCalendarRerender();return;}
 const record=e.target.closest('[data-dg-calrecord]');if(record){const key=record.dataset.dgCalrecord;if(S.dgCalRecords.has(key))S.dgCalRecords.delete(key);else S.dgCalRecords.add(key);S.dgCommChannel='all';dgCalendarRerender();return;}
 const channel=e.target.closest('[data-dg-commchannel]');if(channel){S.dgCommChannel=channel.dataset.dgCommchannel;for(const key of S.dgCalRecords){const host=document.getElementById('dg-comm-'+key);if(host)host.innerHTML=dgCommunicationTable(key);}return;}
 if(e.target.closest('[data-dg-commsort]')){S.dgCommAsc=!S.dgCommAsc;for(const key of S.dgCalRecords){const host=document.getElementById('dg-comm-'+key);if(host)host.innerHTML=dgCommunicationTable(key);}return;}
 const retry=e.target.closest('[data-dg-commretry]');if(retry){dgCommCache.delete(retry.dataset.dgCommretry);dgLoadCommunication(retry.dataset.dgCommretry);}
});
document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('[data-dg-calrecord]')){e.preventDefault();e.target.click();}});

