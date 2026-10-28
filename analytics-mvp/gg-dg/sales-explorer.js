// DG-specific exploration. Uses the reference FD/FL/soldSet and amount semantics.
S.dgDistMode='deals';S.dgDistUnit='count';S.dgDetail=null;S.dgReason='';S.dgSearch='';S.dgSort='created';S.dgAsc=false;
const dgCategory=v=>String(v||'Не указано');
const dgDate=v=>v?String(v).slice(0,10).split('-').reverse().join('.'):'—';
function dgMoney(value,currency){return value==null?'—':fmt(value)+' '+(currency==='RUB'?'₽':esc(currency||'валюта не указана'));}
function dgCRM(kind,id){return `<span class="dg-record-id">${esc(String(id))}</span>`;}
function dgDistributionRows(){return S.dgDistMode==='sales'?soldSet():FD();}
function dgDistributionValue(d){return S.dgDistUnit==='count'?1:(S.dgDistMode==='sales'&&S.amtMode==='prepay'?(d.prepayAmt||0):d.budget);}
function dgDistributionGroups(rows,field){
  const groups=new Map();
  for(const d of rows){const name=dgCategory(d[field]);if(!groups.has(name))groups.set(name,{name,value:0,count:0,missing:0});const g=groups.get(name),value=dgDistributionValue(d);g.count++;if(value==null||!Number.isFinite(value))g.missing++;else g.value+=value;}
  return [...groups.values()].sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'ru'));
}
function dgDistributionBlock(){
  const rows=dgDistributionRows(),money=S.dgDistUnit==='money',sales=S.dgDistMode==='sales';
  const basis=sales?(S.dateBasis==='created'?'по дате создания сделки':'по дате продажи'):'по дате создания сделки';
  const valueBasis=money?(sales?(S.amtMode==='prepay'?'сумма предоплат':'сумма сделок'):'сумма сделок'):'количество';
  const modes=`<div class="seg" aria-label="Сделки или продажи"><button data-dg-mode="deals" class="${!sales?'on':''}" aria-pressed="${!sales}">Сделки</button><button data-dg-mode="sales" class="${sales?'on':''}" aria-pressed="${sales}">Продажи</button></div>`;
  const units=`<div class="seg" aria-label="Количество или сумма"><button data-dg-unit="count" class="${!money?'on':''}" aria-pressed="${!money}">Количество</button><button data-dg-unit="money" class="${money?'on':''}" aria-pressed="${money}">Сумма</button></div>`;
  const cards=[['dir','По направлению'],['assort','По ассортименту']].map(([field,title])=>{
    const groups=dgDistributionGroups(rows,field),total=groups.reduce((s,g)=>s+g.value,0),missing=groups.reduce((s,g)=>s+g.missing,0);
    const positive=groups.filter(g=>g.value>0),data=positive.map((g,i)=>[esc(g.name),g.value,PAL[i%PAL.length]]);
    let svg=donut(data,money?fmtK(total):fmt(total),money?'₽':(sales?'продаж':'сделок'),money);
    if(total===0)svg=svg.replace(/(<svg[^>]*>)/,'$1<circle class="dg-empty-ring" cx="100" cy="100" r="65" fill="none" stroke="#3F4855" stroke-width="30"/>');
    const legend=groups.map(g=>`<li><span>${esc(g.name)}</span><span>${money?dgMoney(g.value,'RUB'):fmt(g.value)} <small style="color:var(--ink-3)">· ${pct(total?g.value/total:0)}</small></span></li>`).join('');
    const empty=!rows.length?(sales?'Нет продаж за выбранный период':'Нет сделок за выбранный период'):money&&total===0?'Нет суммы по выбранным записям':'';
    return `<div class="card" data-dg-distribution="${field}"><div class="card-sub" style="font-weight:600;color:var(--ink-2);text-align:center;margin-bottom:6px">${title}</div><div style="text-align:center">${svg}</div><ul class="dg-breakdown">${legend}</ul>${empty||missing?`<div class="dg-dist-note">${empty}${missing?(empty?' · ':'')+'без суммы: '+fmt(missing):''}</div>`:''}</div>`;
  }).join('');
  return `<section class="dg-dist" aria-label="Распределение сделок и продаж"><div class="card-h"><div><div class="card-title">Распределение ${sales?'продаж':'сделок'}</div><div class="card-sub">${basis} · ${valueBasis} · ${rows.length} записей${sales?' · '+(S.revMode==='prepay'?'от предоплаты':'по успешному завершению'):''}</div></div><div class="dg-dist-controls">${modes}${units}</div></div><div class="grid2">${cards}</div></section>`;
}
function dgLeadRows(){
  const selection=S.dgDetail;if(!selection||selection.kind!=='leads')return [];
  const rows=FL();if(selection.status)return rows.filter(l=>l.status===selection.status);
  if(selection.stage==='Сделки')return rows.filter(l=>l.qual==='квал');
  if(selection.stage==='В работе')return rows.filter(l=>l.qual==='в работе');
  if(selection.stage==='Отказ')return rows.filter(l=>l.qual==='неквал');return rows;
}
function dgReasonName(l){return l.reason||(l.qual==='неквал'?'Не заполнена':'—');}
function dgSortRows(rows,kind){
  const q=S.dgSearch.trim().toLocaleLowerCase('ru');
  const filtered=rows.filter(d=>!q||[d.id,d.mgr,d.status,d.stage,d.reason,d.source,d.leadId,...(kind==='leads'?DATA.deals.filter(x=>String(x.leadId)===String(d.id)).map(x=>x.id):[])].some(v=>String(v||'').toLocaleLowerCase('ru').includes(q)));
  const value=d=>S.dgSort==='status'?(d.status||d.stage):S.dgSort==='reason'?(kind==='leads'?dgReasonName(d):d.reason):d[S.dgSort];
  return filtered.slice().sort((a,b)=>{const x=value(a),y=value(b);if(x==null&&y!=null)return 1;if(y==null&&x!=null)return -1;const c=S.dgSort==='budget'?Number(x)-Number(y):String(x||'').localeCompare(String(y||''),'ru',{numeric:true});return (S.dgAsc?1:-1)*c||Number(b.id)-Number(a.id);});
}
function dgDetailTools(kind,count,total){return `<div class="dg-tools"><input id="dg-search" type="search" aria-label="Поиск в таблице ${kind==='leads'?'лидов':'сделок'}" placeholder="ID, ответственный, статус или причина" value="${esc(S.dgSearch)}"><span class="card-sub">Показано ${count} из ${total}</span><button class="btn" data-dg-close>Закрыть таблицу</button></div>`;}
function dgTH(key,label){return `<th><button style="border:0;background:none;color:inherit;font:inherit;cursor:pointer" data-dg-sort="${key}">${label}${S.dgSort===key?(S.dgAsc?' ↑':' ↓'):''}</button></th>`;}
function dgLeadDetails(){
  const selection=S.dgDetail;if(!selection||selection.kind!=='leads')return '';
  const base=dgLeadRows(),refused=base.filter(l=>l.qual==='неквал'),reasonCounts=new Map();for(const l of refused){const r=dgReasonName(l);reasonCounts.set(r,(reasonCounts.get(r)||0)+1);}
  const reasons=[...reasonCounts].sort((a,b)=>b[1]-a[1]);
  const summary=reasons.length?`<div class="card-sub">Основные причины · ${refused.length} отказных лидов · из заполненных полей CRM</div><table class="dg-summary"><thead><tr><th>Причина</th><th>Лидов</th><th>Доля</th></tr></thead><tbody>${reasons.map(([r,n])=>`<tr><td><button data-dg-reason="${esc(r)}">${esc(r)}</button></td><td>${n}</td><td>${pct(n/refused.length)}</td></tr>`).join('')}</tbody></table>`:'';
  const selected=S.dgReason?base.filter(l=>dgReasonName(l)===S.dgReason):base,rows=dgSortRows(selected,'leads');
  const body=rows.map(l=>{const related=DATA.deals.filter(d=>String(d.leadId)===String(l.id));return `<tr data-dg-lead-row="${esc(l.id)}"><td>${dgCRM('lead',l.id)}<small>Создан ${dgDate(l.created)}</small><small>Обновлён ${dgDate(l.updated)}</small>${l.qual!=='в работе'&&l.closed?'<small>Завершён '+dgDate(l.closed)+'</small>':''}</td><td>${esc(l.mgr)}</td><td>${esc(l.status)}</td><td>${esc(dgReasonName(l))}</td><td>${dgMoney(l.budget,l.currency)}</td><td>${related.length?related.map(d=>dgCRM('deal',d.id)+'<small>'+esc(d.stage)+' · '+esc(d.mgr)+' · '+dgMoney(d.budget,d.currency)+'</small>').join('<br>'):'—'}</td><td>${esc(l.source)}<small>${esc(l.dir||'Не указано')}</small></td></tr>`;}).join('');
  return `<section class="card dg-detail" id="dg-lead-details"><div class="card-title">Лиды: ${esc(selection.status||selection.stage)} · ${base.length}</div><div class="card-sub">Лиды за выбранный период. Связанные сделки ДГ показаны за все даты и по всем ответственным. </div>${summary}${S.dgReason?`<div class="dg-tools"><span>Причина: ${esc(S.dgReason)}</span><button class="btn" data-dg-reason="">Все причины</button></div>`:''}${dgDetailTools('leads',rows.length,selected.length)}<div class="dg-table"><table><thead><tr>${dgTH('created','Лид и даты')}${dgTH('mgr','Ответственный')}${dgTH('status','Статус')}${dgTH('reason','Основная причина')}${dgTH('budget','Сумма лида')}<th>Связанные сделки ДГ</th><th>Источник / направление</th></tr></thead><tbody>${body||'<tr><td colspan="7">По выбранным условиям лидов нет</td></tr>'}</tbody></table></div></section>`;
}
function dgDealDetails(){
  const selection=S.dgDetail;if(!selection||selection.kind!=='deals')return '';
  const base=dgDistributionRows().filter(d=>dgCategory(d[selection.field])===selection.value),rows=dgSortRows(base,'deals');
  const body=rows.map(d=>`<tr data-dg-deal-row="${esc(d.id)}"><td>${dgCRM('deal',d.id)}<small>Создана ${dgDate(d.created)}</small>${(d.won||d.lost)&&d.closed?'<small>Закрыта '+dgDate(d.closed)+'</small>':''}</td><td>${esc(d.mgr)}</td><td>${esc(d.stage)}<small>${d.won?'Успешно':d.lost?'Отказ':'Открыта'}</small></td><td>${esc(d.lost?(d.reason||'Не заполнена'):'—')}</td><td>${dgMoney(d.budget,d.currency)}<small>Предоплата: ${dgMoney(d.prepayAmt,d.currency)}</small></td><td>${d.leadId?dgCRM('lead',d.leadId):'—'}</td><td>${esc(d.source)}<small>${esc(d.assort||'Ассортимент не указан')}</small></td><td>Касание: ${dgDate(d.lastTouch)}<small>Следующее дело: ${dgDate(d.taskDue)}</small></td></tr>`).join('');
  return `<section class="card dg-detail" id="dg-deal-details"><div class="card-title">${S.dgDistMode==='sales'?'Продажи':'Сделки'}: ${esc(selection.value)} · ${base.length}</div><div class="card-sub">Те же записи, что в выбранном сегменте. </div>${dgDetailTools('deals',rows.length,base.length)}<div class="dg-table"><table><thead><tr>${dgTH('created','Сделка и даты')}${dgTH('mgr','Ответственный')}${dgTH('status','Этап')}${dgTH('reason','Причина отказа')}${dgTH('budget','Сумма')}<th>Исходный лид</th><th>Источник / ассортимент</th><th>Коммуникации</th></tr></thead><tbody>${body||'<tr><td colspan="8">По выбранным условиям сделок нет</td></tr>'}</tbody></table></div></section>`;
}
function dgReveal(id){render();document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});}
document.addEventListener('click',e=>{
  const mode=e.target.closest('[data-dg-mode]'),unit=e.target.closest('[data-dg-unit]');
  if(mode||unit){if(mode)S.dgDistMode=mode.dataset.dgMode;if(unit)S.dgDistUnit=unit.dataset.dgUnit;S.dgDetail=null;S.dgSearch='';S.dgReason='';render();return;}
  const lead=e.target.closest('[data-dg-lead]'),status=e.target.closest('[data-dg-leadstatus]');
  if(lead||status){S.dgDetail={kind:'leads',stage:lead?.dataset.dgLead,status:status?.dataset.dgLeadstatus};S.dgSearch='';S.dgReason='';dgReveal('dg-lead-details');return;}
  const reason=e.target.closest('[data-dg-reason]');if(reason){S.dgReason=reason.dataset.dgReason;S.dgSearch='';dgReveal('dg-lead-details');return;}
  const sort=e.target.closest('[data-dg-sort]');if(sort){const key=sort.dataset.dgSort;S.dgAsc=S.dgSort===key?!S.dgAsc:true;S.dgSort=key;render();return;}
  if(e.target.closest('[data-dg-close]')){S.dgDetail=null;S.dgSearch='';S.dgReason='';render();}
});
document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('.lf-bar[role="button"]')){e.preventDefault();e.target.click();}});
document.addEventListener('input',e=>{if(e.target.id!=='dg-search')return;const start=e.target.selectionStart;S.dgSearch=e.target.value;render();const input=document.getElementById('dg-search');input?.focus({preventScroll:true});if(input)input.setSelectionRange(start,start);});
