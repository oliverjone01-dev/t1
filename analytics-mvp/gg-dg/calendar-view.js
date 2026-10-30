// Calendar counts and the Dialog table hierarchy share the same eligible DG records.
const DG_COMMUNICATIONS_VISIBLE=false;
S.dgCalView='managers';S.dgCalPick=null;S.dgCalGroup='leads';S.dgCalExpanded=new Set();S.dgCalManagers=new Set();S.dgCalRecords=new Set();S.dgCommChannel='all';
S.dgCalDealsOpen=false;
const dgCommCache=new Map();
S.dgLossKind='all';S.dgLossTop=10;S.dgLossPage=0;S.dgLossOpen=true;
function dgRefusalRows(){
 return ['leadLost','lost'].flatMap(id=>dgCalendarRows(DG_CAL_ROWS.find(row=>row.id===id))).filter(x=>S.dgLossKind==='all'||(S.dgLossKind==='lead')===(x.key[0]==='L')).map(x=>{const detail=String(DATA.calendar?.leadReasonDetails?.[x.key]||'').trim(),reason=String(x.reason||'').trim();return {...x,reason:detail||(reason==='—'?'':reason)||'Не заполнена'};}).sort((a,b)=>b.at.localeCompare(a.at)||Number(b.record.id)-Number(a.record.id));
}
function dgRefusalGroups(rows){
 const groups=new Map();for(const x of rows){const name=x.reason.trim().replace(/\s+/g,' '),key=name.toLocaleLowerCase('ru');if(!groups.has(key))groups.set(key,{name,count:0});groups.get(key).count++;}return [...groups.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ru'));
}
const DG_LOSS_COLUMNS=[['record','Лид / сделка'],['manager','Ответственный'],['created','Создана'],['refused','Отказ'],['activity','Активность'],['stage','Стадия отказа'],['reason','Причина отказа'],['assort','Ассортимент'],['lead','Исходная запись']];
S.dgLossFilters={};S.dgLossSort='refused';S.dgLossAsc=false;
function dgRefusalView(ignoreField=null){
 const rows=dgRefusalRows().map(x=>{const d=x.record,lead=x.key[0]==='L',related=lead?DATA.deals.filter(a=>String(a.leadId)===String(d.id)):[d],values=field=>[...new Set(related.map(a=>a[field]).filter(Boolean))].join(', ')||'—',ix=DATA.communicationIndex?.[x.key],last=(ix?.ids||[]).reduce((at,id)=>Math.max(at,dgBakedEvents.get(id)?.ts||0),0),history=dgHistory(d,lead?'lead':'deal').find(e=>e.semantic==='F'),stage=history?dgBakedEvents.get('stage#'+x.key+':'+history.id)?.body:null,activity=last?dgMSKDay(last):d.lastTouch||'',duplicate=lead&&(/^дубл/iu.test(d.status||'')||/^дубл/iu.test(x.reason));
  const raw={created:d.created,refused:x.at,activity},cells={record:(lead?'Лид ':'Сделка ')+d.id,manager:d.mgr||'Не распределено',created:dgDate(d.created),refused:dgDate(x.at),activity:dgDate(activity),stage:stage||d.status||d.stage||'—',reason:x.reason+(duplicate&&!d.duplicateRef?' · '+(d.duplicateLinkState==='empty'?'Ссылка на дубль не заполнена':d.duplicateLinkState==='unrecognized'?'Ссылка на дубль не распознана':'Ссылка на дубль не загружена'):''),assort:values('assort'),lead:duplicate&&d.duplicateRef?(d.duplicateRef.kind==='lead'?'Лид ':'Сделка ')+d.duplicateRef.id:!lead&&d.leadId?'Лид '+d.leadId:'—'};
  return {...x,cells,raw};
 }).filter(x=>DG_LOSS_COLUMNS.every(([key])=>key===ignoreField||dgLossMatches(x,key,S.dgLossFilters[key])));
 return rows.sort((a,b)=>{const key=S.dgLossSort;let result=key==='record'?Number(a.record.id)-Number(b.record.id):String(a.raw[key]??a.cells[key]??'').localeCompare(String(b.raw[key]??b.cells[key]??''),'ru',{numeric:true});return result*(S.dgLossAsc?1:-1)||a.key.localeCompare(b.key);});
}
const DG_LOSS_DATE_KEYS=['created','refused','activity'];
function dgLossMatches(row,key,filter){
 if(!filter)return true;
 if(Array.isArray(filter.values))return filter.values.includes(row.cells[key]);
 if(typeof filter==='object'&&DG_LOSS_DATE_KEYS.includes(key)){const value=String(row.raw[key]||'').slice(0,10);return (!filter.from&&!filter.to)||!!value&&(!filter.from||value>=filter.from)&&(!filter.to||value<=filter.to);}
 const q=String(filter).trim().toLocaleLowerCase('ru');return !q||String(row.cells[key]||'').toLocaleLowerCase('ru').includes(q)||String(row.raw[key]||'').includes(q);
}
function dgLossFilterLabel(key){const filter=S.dgLossFilters[key];if(!filter)return DG_LOSS_DATE_KEYS.includes(key)?'Дата…':'Все ▾';if(filter.values)return 'Выбрано: '+filter.values.length;return filter.from===filter.to?dgDate(filter.from):dgDate(filter.from).slice(0,5)+' – '+dgDate(filter.to).slice(0,5);}
function dgLossOptions(key){const counts=new Map();for(const row of dgRefusalView(key))counts.set(row.cells[key],(counts.get(row.cells[key])||0)+1);for(const value of S.dgLossFilters[key]?.values||[])if(!counts.has(value))counts.set(value,0);return [...counts].sort((a,b)=>a[0].localeCompare(b[0],'ru',{numeric:true}));}
function dgLossShiftMonth(month,by){const [y,m]=month.split('-').map(Number),date=new Date(Date.UTC(y,m-1+by,1));return date.toISOString().slice(0,7);}
function dgLossMonth(month){
 const [y,m]=month.split('-').map(Number),first=new Date(Date.UTC(y,m-1,1)),offset=(first.getUTCDay()+6)%7,last=new Date(Date.UTC(y,m,0)).getUTCDate(),name=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
 return `<section><h4>${esc(name)}</h4><div class="dg-loss-days">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>'<small>'+x+'</small>').join('')}${'<span></span>'.repeat(offset)}${Array.from({length:last},(_,i)=>{const day=month+'-'+String(i+1).padStart(2,'0');return '<button data-dg-loss-day="'+day+'" aria-label="'+dgDate(day)+'">'+(i+1)+'</button>';}).join('')}</div></section>`;
}
function dgPaintLossDates(){
 const p=document.getElementById('dg-loss-filter-pop'),menu=S.dgLossMenu;if(!p||!menu?.date)return;
 const end=menu.to||menu.hover||menu.from,low=menu.from&&end?(menu.from<end?menu.from:end):'',high=menu.from&&end?(menu.from>end?menu.from:end):'';
 for(const node of p.querySelectorAll('[data-dg-loss-day]')){const day=node.dataset.dgLossDay;node.classList.toggle('in-range',!!low&&day>=low&&day<=high);node.classList.toggle('endpoint',day===menu.from||day===menu.to);node.setAttribute('aria-pressed',String(!!low&&day>=low&&day<=high));}
 p.querySelector('[data-dg-loss-from]').value=menu.from;p.querySelector('[data-dg-loss-to]').value=menu.to;p.querySelector('[data-dg-loss-apply]').disabled=!menu.from||!menu.to;
}
function dgCloseLossFilter(){const p=document.getElementById('dg-loss-filter-pop');if(p?.matches(':popover-open'))p.hidePopover();}
function dgApplyLossFilter(reset=false){
 const menu=S.dgLossMenu;if(!menu)return;
 if(reset)delete S.dgLossFilters[menu.key];else if(menu.date){if(!menu.from||!menu.to)return;S.dgLossFilters[menu.key]={from:menu.from,to:menu.to};}else{const values=[...menu.selected];if(values.length===menu.options.length&&menu.options.every(([value])=>menu.selected.has(value)))delete S.dgLossFilters[menu.key];else S.dgLossFilters[menu.key]={values};}
 dgCloseLossFilter();dgCalendarRerender();document.getElementById('dg-loss-filter-'+menu.key)?.focus({preventScroll:true});
}
function dgOpenLossFilter(key,opener){
 const column=DG_LOSS_COLUMNS.find(x=>x[0]===key);if(!column)return;
 dgCloseLossFilter();const filter=S.dgLossFilters[key],date=DG_LOSS_DATE_KEYS.includes(key),options=date?[]:dgLossOptions(key);
 S.dgLossMenu={key,date,options,selected:new Set(filter?.values||options.map(([value])=>value)),from:filter?.from||'',to:filter?.to||'',month:(filter?.from||S.start||DATA.to).slice(0,7),opener};
 const menu=S.dgLossMenu;let p=document.getElementById('dg-loss-filter-pop');if(!p){p=document.createElement('div');p.id='dg-loss-filter-pop';p.setAttribute('popover','auto');p.setAttribute('role','dialog');document.body.append(p);p.addEventListener('toggle',e=>{if(e.newState==='closed'&&S.dgLossMenu?.opener?.isConnected&&(p.contains(document.activeElement)||document.activeElement===document.body))S.dgLossMenu.opener.focus({preventScroll:true});});}
 p.className='dg-loss-filter-pop'+(date?' dg-loss-date-pop':'');p.setAttribute('aria-label','Фильтр: '+column[1]);
 const content=date?`<p>Выберите начало и конец. Двойной клик по дню — точная дата.</p><div class="dg-loss-date-inputs"><label>От<input type="date" data-dg-loss-from aria-label="Дата от" value="${menu.from}"></label><label>До<input type="date" data-dg-loss-to aria-label="Дата до" value="${menu.to}"></label></div><div class="dg-loss-month-nav"><button data-dg-loss-month="-1" aria-label="Предыдущий месяц">‹</button><button data-dg-loss-month="1" aria-label="Следующий месяц">›</button></div><div class="dg-loss-months">${dgLossMonth(menu.month)}</div>`:`<input type="search" data-dg-loss-search placeholder="Быстрый поиск" aria-label="Поиск значений"><div class="dg-loss-choice-tools"><button data-dg-loss-select="all">Выбрать все</button><button data-dg-loss-select="none">Снять все</button></div><div class="dg-loss-options">${options.map(([value,count])=>`<label data-dg-loss-choice><input type="checkbox" data-dg-loss-option value="${esc(value)}" ${menu.selected.has(value)?'checked':''}><span>${esc(value)}</span><small>${count}</small></label>`).join('')||'<p>Доступных значений нет</p>'}</div>`;
 p.innerHTML=`<header><strong>${esc(column[1])}</strong><button data-dg-loss-close aria-label="Закрыть фильтр">×</button></header>${content}<footer><button data-dg-loss-reset>Сбросить</button><button data-dg-loss-apply>Применить</button></footer>`;p.showPopover();if(date)dgPaintLossDates();
 const r=opener.getBoundingClientRect(),box=p.getBoundingClientRect();p.style.left=Math.max(12,Math.min(window.innerWidth-box.width-12,r.left))+'px';p.style.top=Math.max(12,Math.min(window.innerHeight-box.height-12,r.bottom+6))+'px';p.querySelector(date?'[data-dg-loss-from]':'[data-dg-loss-search]').focus({preventScroll:true});
}
document.addEventListener('click',e=>{
 const trigger=e.target.closest('[data-dg-loss-filter]');if(trigger){dgOpenLossFilter(trigger.dataset.dgLossFilter,trigger);return;}
 if(e.target.closest('[data-dg-loss-close]')){dgCloseLossFilter();return;}
 if(e.target.closest('[data-dg-loss-reset]')){dgApplyLossFilter(true);return;}
 if(e.target.closest('[data-dg-loss-apply]')){dgApplyLossFilter();return;}
 const menu=S.dgLossMenu;if(!menu)return;
 const select=e.target.closest('[data-dg-loss-select]');if(select){menu.selected=new Set(select.dataset.dgLossSelect==='all'?menu.options.map(([value])=>value):[]);for(const node of document.querySelectorAll('#dg-loss-filter-pop [data-dg-loss-option]'))node.checked=menu.selected.has(node.value);return;}
 const nav=e.target.closest('[data-dg-loss-month]');if(nav){menu.month=dgLossShiftMonth(menu.month,Number(nav.dataset.dgLossMonth));document.querySelector('#dg-loss-filter-pop .dg-loss-months').innerHTML=dgLossMonth(menu.month);dgPaintLossDates();return;}
 const day=e.target.closest('[data-dg-loss-day]');if(day){const value=day.dataset.dgLossDay;if(!menu.from||menu.to){menu.from=value;menu.to='';}else{menu.to=value;if(menu.to<menu.from)[menu.from,menu.to]=[menu.to,menu.from];}menu.hover='';dgPaintLossDates();}
});
document.addEventListener('dblclick',e=>{const day=e.target.closest('[data-dg-loss-day]');if(!day||!S.dgLossMenu?.date)return;S.dgLossMenu.from=S.dgLossMenu.to=day.dataset.dgLossDay;dgApplyLossFilter();});
document.addEventListener('input',e=>{if(!e.target.matches('[data-dg-loss-search]'))return;const q=e.target.value.trim().toLocaleLowerCase('ru').replace(/ё/g,'е');for(const label of document.querySelectorAll('#dg-loss-filter-pop [data-dg-loss-choice]'))label.hidden=!label.querySelector('span').textContent.toLocaleLowerCase('ru').replace(/ё/g,'е').includes(q);});
document.addEventListener('change',e=>{
 const menu=S.dgLossMenu;if(!menu)return;
 if(e.target.matches('[data-dg-loss-option]')){if(e.target.checked)menu.selected.add(e.target.value);else menu.selected.delete(e.target.value);}
 if(e.target.matches('[data-dg-loss-from],[data-dg-loss-to]')){menu.from=document.querySelector('#dg-loss-filter-pop [data-dg-loss-from]').value;menu.to=document.querySelector('#dg-loss-filter-pop [data-dg-loss-to]').value;if(menu.from&&menu.to&&menu.to<menu.from)[menu.from,menu.to]=[menu.to,menu.from];menu.hover='';dgPaintLossDates();}
});
document.addEventListener('pointerover',e=>{const day=e.target.closest('[data-dg-loss-day]'),menu=S.dgLossMenu;if(day&&menu?.date&&menu.from&&!menu.to){menu.hover=day.dataset.dgLossDay;dgPaintLossDates();}});

function dgRefusalBlock(){
 const rows=dgRefusalView(),groups=dgRefusalGroups(rows),shown=groups.slice(0,S.dgLossTop),max=Math.max(1,...groups.map(g=>g.count));
 const kinds=`<div class="seg" aria-label="Вид отказных записей">${[['all','Все'],['lead','Лиды'],['deal','Сделки']].map(([id,label])=>`<button data-dg-loss-kind="${id}" class="${S.dgLossKind===id?'on':''}">${label}</button>`).join('')}</div>`;
 const bars=shown.map(g=>`<div class="dg-loss-bar" aria-label="${esc(g.name+' · '+g.count)}"><span data-tip="${esc(dt("Причина отказа",[[esc(g.name),fmt(g.count)]]))}">${esc(g.name)}</span><div class="dg-loss-track"><i style="width:${g.count/max*100}%"></i></div><b>${fmt(g.count)}</b></div>`).join('');
 const headers=DG_LOSS_COLUMNS.map(([key,label])=>`<th aria-sort="${S.dgLossSort===key?(S.dgLossAsc?'ascending':'descending'):'none'}"><button data-dg-loss-sort="${key}">${label}${S.dgLossSort===key?(S.dgLossAsc?' ↑':' ↓'):''}</button><button class="dg-loss-filter-button" id="dg-loss-filter-${key}" data-dg-loss-filter="${key}" aria-label="Фильтр: ${label}" aria-haspopup="dialog" data-tip="${esc(dgLossFilterLabel(key))}">${esc(dgLossFilterLabel(key))}</button></th>`).join('');
 const body=rows.map(x=>'<tr>'+DG_LOSS_COLUMNS.map(([key,label])=>`<td data-label="${label}"><div class="${["record","lead"].includes(key)?(/^Лид \d+$/.test(x.cells[key])?"dg-entity-lead":/^Сделка \d+$/.test(x.cells[key])?"dg-entity-deal":""):""}" data-tip="${esc('<div class="tip-hd">'+esc(label)+'</div><div class="qb">'+esc(x.cells[key])+'</div>')}">${esc(x.cells[key])}</div></td>`).join('')+'</tr>').join('');
 return `<section class="dg-refusals-grid dg-refusals-wide" id="dg-refusals"><div class="card"><div class="card-title">Причины отказов</div><div class="card-sub">По дате первого отказа в выбранном периоде · лиды и сделки считаются отдельно</div><div class="dg-loss-controls">${kinds}<div class="seg" aria-label="Число причин">${[10,30,50].map(n=>`<button data-dg-loss-top="${n}" class="${S.dgLossTop===n?'on':''}">Топ ${n}</button>`).join('')}</div></div><div class="dg-loss-chart">${bars||'<div class="card-sub">По текущим фильтрам отказов нет</div>'}</div><div class="card-sub">${rows.length} записей · ${groups.length} причин · показано ${shown.length}</div></div><div class="card"><button class="dg-loss-heading" data-dg-loss-toggle aria-expanded="${S.dgLossOpen}">${S.dgLossOpen?'▾':'▸'} Отказные лиды и сделки · ${rows.length}</button>${S.dgLossOpen?`<div class="card-sub">Сортировка — по заголовку, фильтр — под каждым столбцом. Активность — последнее событие истории. Ассортимент лида — по связанным сделкам.</div><div class="dg-loss-table-scroll"><table class="dg-refusal-table"><thead><tr>${headers}</tr></thead><tbody>${body||`<tr><td colspan="${DG_LOSS_COLUMNS.length}">По текущим фильтрам записей нет</td></tr>`}</tbody></table></div><div class="dg-loss-pagination">${rows.length} записей · до 10 строк на экране, остальные — прокруткой</div>`:''}</div></section>`;
}
document.addEventListener('click',e=>{
 const kind=e.target.closest('[data-dg-loss-kind]'),top=e.target.closest('[data-dg-loss-top]'),sort=e.target.closest('[data-dg-loss-sort]'),toggle=e.target.closest('[data-dg-loss-toggle]');
 if(kind)S.dgLossKind=kind.dataset.dgLossKind;else if(top)S.dgLossTop=Number(top.dataset.dgLossTop);else if(sort){S.dgLossAsc=S.dgLossSort===sort.dataset.dgLossSort?!S.dgLossAsc:true;S.dgLossSort=sort.dataset.dgLossSort;}else if(toggle)S.dgLossOpen=!S.dgLossOpen;else return;dgCalendarRerender();
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
 const hits=keys.map((key,i)=>{const [from,to]=dgBucketRange(key),date=dgDate(from)+(from!==to?' — '+dgDate(to):''),x=j=>values.length===1?50:2+j*96/(values.length-1),left=i?(x(i-1)+x(i))/2:0,right=i===keys.length-1?100:(x(i)+x(i+1))/2,rows=[['Дата',date],['Количество',fmt(counts[i]??0)]];if(S.calUnit==='money'){const unknown=missing[i]||0;rows.push([unknown?'Известная сумма':'Сумма',unknown&&unknown===counts[i]?'Не указана':fmt(values[i])+' ₽']);if(unknown)rows.push(['Записей без суммы',fmt(unknown)+' из '+fmt(counts[i])]);}return `<g class="dg-hover-column"><g class="dg-hover-mark"><line x1="${x(i)}" x2="${x(i)}" y1="0" y2="26" stroke="${color}" stroke-dasharray="2 2"/><circle cx="${x(i)}" cy="${24-values[i]/max*22}" r="2.2" fill="${color}" stroke="var(--bg-card)" stroke-width="1"/></g><rect class="dg-spark-hit" x="${left}" y="0" width="${right-left}" height="26" fill="transparent" data-tip="${esc(dt(esc(label),rows))}"/></g>`;}).join('');
 return `<svg class="dg-heat-spark" viewBox="0 0 100 26" role="img" aria-label="${esc(description)}"><line class="dg-chart-axis" x1="2" x2="98" y1="24" y2="24"/>${values.length===1?`<circle cx="50" cy="${24-values[0]/max*22}" r="2" fill="${color}"/>`:`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>`}${hits}</svg>`;
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
function dgStockPeriodRows(row){
 const snapshot=Date.parse(DATA.generatedAt||DATA.bakedAt),end=Math.min(Date.parse(S.end+'T23:59:59.999+03:00'),snapshot),start=Date.parse(S.start+'T00:00:00+03:00');if(start>end)return [];
 return flt(DATA.deals,true).flatMap(record=>{const spans=[];let entered=null;for(const e of dgHistory(record,'deal').filter(e=>e.at<=snapshot)){const on=e.code===row.code&&e.semantic==='P';if(on&&entered===null)entered=e.at;else if(!on&&entered!==null){spans.push({from:entered,to:e.at});entered=null;}}if(entered!==null)spans.push({from:entered,to:null});const visits=spans.filter(v=>v.from<=end&&(v.to===null||v.to>start));if(!visits.length)return [];return [{record,key:'D'+record.id,at:dgMSKDay(end),reason:record.reason||'Не заполнена',stockVisits:visits,stockActive:visits.some(v=>v.from<=end&&(v.to===null||v.to>end))}];});
}
function dgStockVisitText(visits){return (visits||[]).map(v=>dgDate(dgMSKDay(v.from))+' — '+(v.to===null?'по настоящее время':dgDate(dgMSKDay(v.to)))).join('; ');}
function dgCalendarSummary(rows){
 const eventIds=new Set(),commIds=new Set();let money=0,missing=0;
 for(const x of rows){const ix=DATA.communicationIndex?.[x.key];for(const id of ix?.ids||[])eventIds.add(id);for(const id of ix?.commIds||[])commIds.add(id);if(x.record.budget==null||x.record.currency!=='RUB')missing++;else money+=x.record.budget;}
 return {events:eventIds.size,comm:commIds.size,money,missing};
}
const DG_CAL_LOOK={leads:['#22D3EE','лиды'],leadLost:['#CC5867','лиды'],deals:['#22D3EE','сделки'],wip:['#818CF8','в работе'],kp:['#60A5FA','в работе'],prepay:['#2E9E74','движение заказа'],production:['#818CF8','движение заказа'],shipping:['#60A5FA','движение заказа'],completed:['#2E9E74','исход'],lost:['#CC5867','исход']};
function dgCalendarHeatInk(color,t){const alpha=.93-Math.min(1,Math.max(0,t))*.75,rgb=[0,2,4].map(i=>parseInt(color.slice(1+i,3+i),16)),bg=[14,20,26],l=rgb.reduce((s,c,i)=>s+[.2126,.7152,.0722][i]*(c*alpha+bg[i]*(1-alpha)),0)/255;return l>.44?'#0B1016':'#D7E1EA';}
function dgCalendarLine(row,keys,manager=null){
 const money=S.calUnit==='money',color=DG_CAL_LOOK[row.id][0],pick=k=>dgCalendarRows(row,k).filter(x=>manager===null||(x.record.mgr||'Не распределено')===manager),amount=x=>x.record.currency==='RUB'?x.record.budget:null,value=rows=>money?rows.reduce((n,x)=>n+(amount(x)??0),0):rows.length,show=rows=>money?fmtK(value(rows))+(rows.some(x=>amount(x)==null)?'*':''):fmt(rows.length);
 const series=keys.map(k=>({key:k,rows:pick(k)})),values=series.map(x=>value(x.rows)),max=Math.max(1,...values),nonzero=values.filter(v=>v>0),min=nonzero.length?Math.min(...nonzero):0,lo=min>0&&min/max>=.5?min*.92:0,fs=keys.length>60?6.5:keys.length>40?7:keys.length>24?8:9;
 const cells=series.map(({key,rows})=>{const v=value(rows),t=max>lo?(v-lo)/(max-lo):0,alpha=.93-Math.min(1,Math.max(0,t))*.75,bg=rows.length?color+Math.round(alpha*255).toString(16).padStart(2,'0'):'var(--bg-base)',selected=S.dgCalPick?.row===row.id&&S.dgCalPick?.bucket===key&&(S.dgCalPick?.manager??null)===manager;
 return `<button class="dg-heat-cell" ${rows.length?`data-dg-calcell="${row.id}|${key}"${manager!==null?` data-dg-calmanager="${esc(manager)}"`:''}`:'disabled'} style="background:${bg};color:${rows.length?dgCalendarHeatInk(color,t):'transparent'};font-size:${manager===null?fs:fs-1}px;${selected?'box-shadow:inset 0 0 0 2px #22D3EE':''}" aria-label="${esc(row.label+' · '+blabel(key,S.gran)+' · '+show(rows))}" data-tip="${esc(row.label+' · '+blabel(key,S.gran)+' · '+rows.length+' записей'+(money?' · '+show(rows)+' ₽':''))}">${rows.length?show(rows):''}</button>`;}).join('');
 const total=pick(null),open=row.id==='deals'?S.dgCalDealsOpen:S.dgCalExpanded.has(row.id),selected=S.dgCalPick?.row===row.id&&(S.dgCalPick?.manager??null)===manager;
 const label=manager===null?`<button style="border-left:2px solid ${color}" class="dg-heat-label" data-dg-calrow="${row.id}" aria-expanded="${open}"><span class="dg-heat-arrow">${open?'▾':'▸'}</span> ${esc(row.label)}${row.mode!=='stock'?` <b style="color:${color}">${show(total)}</b>`:''}</button>`:`<button class="dg-heat-label dg-heat-manager" data-dg-calopen="${row.id}" data-dg-calhistory="period" data-dg-calmanager="${esc(manager)}" aria-expanded="${selected}"><span class="dg-heat-arrow">${selected?'▾':'▸'}</span> ${esc(manager)}</button>`;
 return `<div class="chrow dg-heat-row ${manager!==null?'dg-heat-sub':''}" data-dg-heatrow="${row.id}">${label}<div class="dg-heat-cells">${cells}</div><button class="dg-heat-total" data-dg-calopen="${row.id}"${manager!==null?` data-dg-calmanager="${esc(manager)}"`:''} style="color:${color}" data-tip="${row.mode==='stock'?'Открытый остаток, не сумма столбцов':'Итог за выбранный период'}">${show(total)}</button>${dgCalendarSparkline(values,color,row.label+(manager?' · '+manager:''),keys,series.map(x=>x.rows.length),series.map(x=>x.rows.filter(r=>amount(r)==null).length))}</div>`;
}
function dgCalendarBlock(){
 const keys=dgCalendarKeys(),money=S.calUnit==='money',step=Math.max(1,Math.ceil(keys.length/12));
 const head=`<div class="dg-heat-head"><div class="dg-heat-spacer"></div><div class="dg-heat-cells">${keys.map((k,i)=>`<div>${keys.length<=16||i%step===0||i===keys.length-1?blabel(k,S.gran):''}</div>`).join('')}</div><div class="dg-heat-sigma">Σ ${money?'₽':'зап.'}</div><div class="dg-heat-spark-heading">Динамика</div></div>`;
 const draw=row=>{let h=dgCalendarLine(row,keys);
  const picked=S.dgCalPick?.row===row.id;
  if(S.dgCalView==='deals'){if(picked||S.dgCalExpanded.has(row.id))h+=dgCalendarDetail(row,picked?{...S.dgCalPick,manager:null}:{row:row.id,bucket:null,reason:''});return h;}
  if(picked&&!S.dgCalPick.manager)h+=dgCalendarDetail(row);
  if(S.dgCalExpanded.has(row.id)){const names=[...new Set([...(row.mode==='stock'?dgStockPeriodRows(row):dgCalendarRows(row)).map(x=>x.record.mgr||'Не распределено'),...keys.flatMap(k=>dgCalendarRows(row,k).map(x=>x.record.mgr||'Не распределено'))])].sort((a,b)=>a.localeCompare(b,'ru'));h+=names.map(m=>dgCalendarLine(row,keys,m)+(picked&&S.dgCalPick.manager===m?dgCalendarDetail(row):'')).join('');}
  return h;
 };
 const body=DG_CAL_ROWS.filter(row=>!DG_CAL_DEAL_STAGES.includes(row.id)).map(row=>draw(row)+(row.id==='deals'&&S.dgCalDealsOpen?`<div class="dg-deal-stages">${DG_CAL_DEAL_STAGES.map(id=>draw(DG_CAL_ROWS.find(r=>r.id===id))).join('')}</div>`:'')).join('');
 const coverage=DATA.communicationCoverage,cache=coverage?.cache,cacheNote=cache?.status==='available'?'Диалоги: '+dgCalendarDateTime(cache.generatedAt):'Дополнение из «Диалогов» недоступно';
 return `<section class="card dg-calendar dg-calendar-gg" id="dg-calendar"><div class="card-h"><div><div class="card-title">Календарь лидов и сделок</div><div class="card-sub">${S.dgCalView==='deals'?'Этап → лид или сделка':'Этап → ответственный → лид или сделка'}</div></div><div class="dg-calendar-controls"><div class="seg" aria-label="Уровень раскрытия календаря"><button data-dg-calview="managers" class="${S.dgCalView!=='deals'?'on':''}" aria-pressed="${S.dgCalView!=='deals'}">Менеджеры</button><button data-dg-calview="deals" class="${S.dgCalView==='deals'?'on':''}" aria-pressed="${S.dgCalView==='deals'}">Сделки</button></div><div class="seg"><button data-dg-calunit="count" class="${!money?'on':''}">Количество</button><button data-dg-calunit="money" class="${money?'on':''}">Сумма</button></div></div></div><div class="card-sub dg-heat-freshness">CRM: ${dgCalendarDateTime(coverage?.generatedAt)}${DG_COMMUNICATIONS_VISIBLE?' · '+cacheNote:''}</div><div class="dg-calendar-workspace"><div id="dg-calendar-panel" class="scroll dg-heat-scroll"><div class="dg-heat-calendar" style="--dg-total:${money?108:84}px">${head}${body}</div></div></div></section>`;
}

function dgCalendarDetail(row,pick=S.dgCalPick){
 const bucket=pick?.bucket,historyMode=row.mode==='stock'&&!bucket&&pick?.stockView!=='point',rows=(historyMode?dgStockPeriodRows(row):dgCalendarRows(row,bucket)).filter(x=>!pick?.manager||(x.record.mgr||'Не распределено')===pick.manager);
 pick={...pick,stockView:historyMode?'period':'point'};let filtered=rows;const reason=pick?.reason;
 if(reason)filtered=rows.filter(x=>x.reason===reason);
 if(S.dgCalView==='deals'||pick?.manager)return `<div class="dg-calendar-drill dg-direct-records">${dgCalendarRecordTable(filtered,row,pick)}</div>`;
 const managers=[...new Set(filtered.map(x=>x.record.mgr||'Не распределено'))].sort((a,b)=>a.localeCompare(b,'ru'));
 const html=managers.map(manager=>{
  const records=filtered.filter(x=>(x.record.mgr||'Не распределено')===manager),s=dgCalendarSummary(records),open=S.dgCalManagers.has(manager);
  return `<tr class="mrow"><td><button data-dg-calmgr="${esc(manager)}" aria-expanded="${open}">${open?'▾':'▸'} ${esc(manager)}</button></td><td>${records.length}</td><td>${dgMoney(s.money,'RUB')}${s.missing?' · без суммы '+s.missing:''}</td>${DG_COMMUNICATIONS_VISIBLE?`<td>${s.comm}</td><td>${s.events}</td>`:""}</tr>${open?`<tr class="subrow"><td colspan="${DG_COMMUNICATIONS_VISIBLE?5:3}">${dgCalendarRecordTable(records,row,pick)}</td></tr>`:''}`;
 }).join('');
 return `<div class="dg-calendar-drill"><h3>${esc(row.label)}${bucket?' · '+esc(blabel(bucket,S.gran)):''}</h3><div class="dg-records" tabindex="0" role="region" aria-label="Таблица ответственных"><table class="tbl t1"><thead><tr><th>Менеджер</th><th>Записей</th><th>Бюджет</th>${DG_COMMUNICATIONS_VISIBLE?'<th>Коммуникаций</th><th>Всех событий</th>':''}</tr></thead><tbody>${html||`<tr><td colspan="${DG_COMMUNICATIONS_VISIBLE?5:3}">Записей в этом интервале нет</td></tr>`}</tbody></table></div></div>`;
}
function dgCalendarRecordTable(rows,row,pick=S.dgCalPick){
 const refusal=row.mode==='lost',direct=S.dgCalView==='deals',showComm=DG_COMMUNICATIONS_VISIBLE,historyMode=row.mode==='stock'&&pick?.stockView==='period';
 const columns=7+(refusal?1:0)+(direct?1:0)+(showComm?2:0),bucket=pick?.row===row.id?pick.bucket:null,rangeEnd=bucket?dgBucketRange(bucket)[1]:S.end,snapshotDay=dgMSKDay(Date.parse(DATA.generatedAt||DATA.bakedAt)),stockDay=snapshotDay&&snapshotDay<rangeEnd?snapshotDay:rangeEnd;
 const context=historyMode?'<div class="card-sub dg-record-context">На этапе на '+dgDate(stockDay)+': '+rows.filter(x=>x.stockActive).length+' · Были в периоде: '+rows.length+'<br>Параметры и ответственный — из текущих карточек.</div>':row.mode==='stock'?'<div class="card-sub dg-record-context">Открытый остаток на '+dgDate(stockDay)+'</div>':'',empty=historyMode?'В выбранном периоде сделок на этом этапе не было.':row.mode==='stock'?'На эту дату открытых сделок на этапе нет. Для прежнего остатка нажмите ячейку нужной недели или дня.':'За выбранный интервал записей нет';
 return `${context}<div class="dg-record-list" tabindex="0" role="region" aria-label="Таблица лидов и сделок"><table class="tbl t2"><thead><tr><th>Тип / ID</th>${direct?'<th>Ответственный</th>':''}<th>${historyMode?'Текущая стадия':'Статус / этап'}</th><th>Тип ассортимента</th>${refusal?'<th>Причина отказа</th>':''}<th>Создана</th><th>${historyMode?'На этапе · с / по':row.mode==='stock'?'Дата остатка':'Событие'}</th><th>Бюджет</th><th>Предоплата</th>${showComm?'<th>Последняя коммуникация</th><th>Лента</th>':''}</tr></thead><tbody>${rows.map(x=>{
  const d=x.record,ix=DATA.communicationIndex?.[x.key],open=showComm&&S.dgCalRecords.has(x.key),assortment=row.kind==='lead'?[...new Set(DATA.deals.filter(a=>String(a.leadId)===String(d.id)).map(a=>String(a.assort||'').trim()).filter(Boolean))].join(', ')||'—':d.assort||'—';
  return `<tr class="${showComm?'drow':'dg-record-static'}${historyMode&&!x.stockActive?' dg-record-ghost':''}"${showComm?` data-dg-calrecord="${x.key}" tabindex="0" role="button" aria-expanded="${open}"`:""}><td>${showComm?(open?'▾ ':'▸ '):''}<span class="kind">${row.kind==='lead'?'Лид':'Сделка'}</span> <b>${esc(d.id)}</b>${historyMode?'<small class="dg-stock-mark">'+(x.stockActive?'На этапе на '+dgDate(stockDay):'Покинула этап к '+dgDate(stockDay))+'</small>':''}</td>${direct?'<td>'+esc(d.mgr||'Не распределено')+'</td>':''}<td>${esc(d.status||d.stage||'—')}</td><td class="dg-record-assort">${esc(assortment)}</td>${refusal?'<td class="dg-refusal-reason">'+esc(DATA.calendar?.leadReasonDetails?.[x.key]||x.reason||'Не заполнена')+'</td>':''}<td>${dgDate(d.created)}</td><td>${historyMode?esc(dgStockVisitText(x.stockVisits)):dgDate(row.mode==='stock'?stockDay:x.at)}</td><td>${dgMoney(d.budget,d.currency)}</td><td>${row.kind==='deal'?dgMoney(d.prepayAmt,d.currency):'—'}</td>${showComm?`<td>${dgDate(ix?.lastAt?dgMSKDay(ix.lastAt):null)}</td><td>${ix?.commIds?.length??'—'} комм.<small>${ix?.openTasks??'—'} открытых дел</small></td>`:""}</tr>${open?`<tr class="subrow2"><td colspan="${(refusal?10:9)+(direct?1:0)}"><div id="dg-comm-${x.key}" class="dg-comm-host">${dgCommCache.has(x.key)?dgCommunicationTable(x.key):'Загружаю историю…'}</div></td></tr>`:''}`;
 }).join('')||`<tr><td colspan="${columns}" class="dg-record-empty">${esc(empty)}</td></tr>`}</tbody></table></div>`;
}
// Keep source timestamps and bindings intact; only identical timestamps get a lifecycle tie-break.
function dgCommunicationText(value){return String(value??'').replace(/\r\n?/g,'\n').replace(/[^\S\n]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();}
function dgCommunicationEntity(key){return (key[0]==='L'?'Лид ':'Сделка ')+key.slice(1);}
function dgCommunicationEvents(payload,key){
 const rank=e=>e.type==='Стадия'?(e.entities.every(k=>k[0]==='L')?0:1):2;
 return payload.events.slice().sort((a,b)=>(a.ts-b.ts||rank(a)-rank(b)||String(a.id).localeCompare(String(b.id),'en',{numeric:true})));
}
function dgCommunicationTable(key){
 const payload=dgCommCache.get(key);if(!payload)return 'Загружаю историю…';if(payload.error)return '<div class="dg-comm-error">Историю сейчас не удалось загрузить. <button data-dg-commretry="'+key+'">Повторить</button></div>';
 const rows=dgCommunicationEvents(payload,key).map(e=>{
  const speakerNote=e.roleGuess?'<small>Роли определены по тексту и требуют проверки.</small>':'';const diarNote=e.undiar?'<small>Надёжного разделения говорящих нет.</small>':'';const speakers=e.speakers?.length?e.speakers.map(s=>`<div class="trln"><b>${esc(s.role)}:</b> ${esc(dgCommunicationText(s.text))}</div>`).join(''):esc(dgCommunicationText(e.body));
  const actual=e.entities.map(k=>'<span>'+esc(dgCommunicationEntity(k))+'</span>').join('');
  const technical=!/^(Письмо|Звонок|SMS|Мессенджер ОЛ|Сообщение)/.test(e.type||'');
  const channelLabel=e.type==='Комментарий-заметка'?'Комментарий':e.type;
  return `<tr class="erow2${technical?' dg-technical':''}"><td class="etime">${new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'medium'}).format(new Date(e.ts))}</td><td class="dg-event-entity">${actual}</td><td class="${e.dir==='входящее'?'who-cli':e.dir==='исходящее'?'who-mgr':''}">${esc(e.who)}<small>${esc(e.dir)}${e.guess?' · сторона определена по тексту':''}</small></td><td><span class="badge">${esc(channelLabel)}</span></td><td class="ebody">${e.title?'<b>'+esc(dgCommunicationText(e.title))+'</b><br>':''}${speakerNote}${diarNote}${speakers||'Текст события в CRM не заполнен'}${e.dur?'<small>Длительность: '+esc(e.dur)+'</small>':''}</td><td>${esc(e.status||'—')}<small>${e.origin==='dialog'?'Архив Диалогов':e.type==='Стадия'?'История CRM':'CRM'}</small>${e.due?'<small>Срок: '+dgDate(e.due)+'</small>':''}</td></tr>`;
 }).join('');
 return `<div class="feedscroll" tabindex="0" role="region" aria-label="Коммуникации ${key[0]==='L'?'лида':'сделки'} ${esc(key.slice(1))}"><table class="tbl t3"><thead><tr><th>Время · МСК</th><th>Сущность</th><th>Кто</th><th>Канал</th><th>Сообщение</th><th>Статус / срок</th></tr></thead><tbody>${rows||'<tr><td colspan="6">В доступной выгрузке по этой записи событий нет</td></tr>'}</tbody></table></div>`;
}
async function dgLoadCommunication(key){
 if(!DG_COMMUNICATIONS_VISIBLE)return;
 if(!/^[LD]\d+$/.test(key)||!DATA.communicationIndex?.[key])return;
 if(!dgCommCache.has(key))try{const r=await fetch('communications/'+key+'.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const p=await r.json();if(p.key!==key||!Array.isArray(p.events)||p.generatedAt!==DATA.communicationCoverage?.generatedAt)throw Error();dgCommCache.set(key,p);}catch{dgCommCache.set(key,{error:true});}
 const host=document.getElementById('dg-comm-'+key);if(host)host.innerHTML=dgCommunicationTable(key);
}
function dgCalendarRerender(){render();if(DG_COMMUNICATIONS_VISIBLE)for(const key of S.dgCalRecords)dgLoadCommunication(key);}
document.addEventListener('click',e=>{
 const group=e.target.closest('[data-dg-calgroup]');if(group&&DG_CAL_GROUPS.some(g=>g.id===group.dataset.dgCalgroup)){S.dgCalGroup=group.dataset.dgCalgroup;S.dgCalPick=null;S.dgCalExpanded.clear();S.dgCalManagers.clear();S.dgCalRecords.clear();dgCalendarRerender();document.getElementById('dg-tab-'+S.dgCalGroup)?.focus();return;}
 const row=e.target.closest('[data-dg-calrow]'),cell=e.target.closest('[data-dg-calcell]'),open=e.target.closest('[data-dg-calopen]');
 if(row){const id=row.dataset.dgCalrow;if(id==='deals'){S.dgCalDealsOpen=!S.dgCalDealsOpen;if(!S.dgCalDealsOpen){for(const stage of DG_CAL_DEAL_STAGES)S.dgCalExpanded.delete(stage);if(DG_CAL_DEAL_STAGES.includes(S.dgCalPick?.row))S.dgCalPick=null;}S.dgCalManagers.clear();S.dgCalRecords.clear();dgCalendarRerender();return;}if(S.dgCalExpanded.has(id)){S.dgCalExpanded.delete(id);if(S.dgCalPick?.row===id)S.dgCalPick=null;}else S.dgCalExpanded.add(id);S.dgCalRecords.clear();dgCalendarRerender();return;}
 if(cell||open){const target=cell||open,[id,bucket]=cell?cell.dataset.dgCalcell.split('|'):[open.dataset.dgCalopen,null],manager=target.dataset.dgCalmanager||null,stockView=target.dataset.dgCalhistory==='period'?'period':'point';S.dgCalPick=S.dgCalPick?.row===id&&S.dgCalPick?.bucket===bucket&&(S.dgCalPick?.manager??null)===manager&&S.dgCalPick?.stockView===stockView?null:{row:id,bucket,manager,reason:'',stockView};S.dgCalManagers.clear();S.dgCalRecords.clear();S.dgCommChannel='all';dgCalendarRerender();return;}
 const view=e.target.closest('[data-dg-calview]');if(view&&['managers','deals'].includes(view.dataset.dgCalview)){S.dgCalView=view.dataset.dgCalview;if(S.dgCalPick)S.dgCalPick={...S.dgCalPick,manager:null};S.dgCalManagers.clear();S.dgCalRecords.clear();dgCalendarRerender();return;}
 const unit=e.target.closest('[data-dg-calunit]');if(unit){S.calUnit=unit.dataset.dgCalunit;dgCalendarRerender();return;}
 const reason=e.target.closest('[data-dg-calreason]');if(reason){S.dgCalPick.reason=reason.dataset.dgCalreason;S.dgCalManagers.clear();S.dgCalRecords.clear();dgCalendarRerender();return;}
 const manager=e.target.closest('[data-dg-calmgr]');if(manager){const key=manager.dataset.dgCalmgr;if(S.dgCalManagers.has(key))S.dgCalManagers.delete(key);else S.dgCalManagers.add(key);dgCalendarRerender();return;}
 const record=e.target.closest('[data-dg-calrecord]');if(record&&DG_COMMUNICATIONS_VISIBLE){const key=record.dataset.dgCalrecord;if(S.dgCalRecords.has(key))S.dgCalRecords.delete(key);else S.dgCalRecords.add(key);S.dgCommChannel='all';dgCalendarRerender();return;}
 const retry=e.target.closest('[data-dg-commretry]');if(retry&&DG_COMMUNICATIONS_VISIBLE){dgCommCache.delete(retry.dataset.dgCommretry);dgLoadCommunication(retry.dataset.dgCommretry);}
});
document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('[data-dg-calrecord]')){e.preventDefault();e.target.click();}});

