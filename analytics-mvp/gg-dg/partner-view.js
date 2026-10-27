// Partner-facing presentation. Keep record identifiers, never navigation into CRM.
function dgSafeMarkup(html){
  return String(html).replace(/<a\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/a>/gi,(whole,attrs,body)=>{
    const href=attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i),value=href&&(href[1]||href[2]||href[3]);
    if(/^#sec[123]$/.test(value||''))return whole;
    const clean=attrs.replace(/\s(?:href|target|rel|title|onclick)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'');
    return '<span'+clean+'>'+body.replace(/\s*↗/g,'')+'</span>';
  });
}
function dgVerticalConversion(leads,qualified,sales,cr1,cr2){
  const values=[leads,qualified,sales],labels=['Заявки','Квалифицированные лиды','Продажи'],max=Math.max(...values,1);
  return `<div class="dg-cross-layout"><div class="dg-cross-vertical">${values.map((value,i)=>`<div class="dg-cross-stage" data-cross-count="${value}"><span>${labels[i]}</span><div class="dg-cross-bar" style="width:${Math.max(14,100*value/max)}%;background:${i?'#2E9E74':'#3DAEC2'}"><b>${fmt(value)}</b></div>${i<2?`<small>${i?'CR2':'CR1'} · ${pct(i?cr2:cr1)}</small>`:''}</div>`).join('')}</div><div class="dg-cross-total"><span>Сквозная конверсия ОП</span><span class="dg-cross-caption">Заявка → продажа</span><b>${pct(leads?sales/leads:0)}</b></div></div>`;
}
function dgFirstStageDate(d,code){return (d.hist||[]).filter(h=>h[0]===code&&h[1]).map(h=>h[1]).sort()[0]||null;}
updBadge=()=>{const el=document.getElementById('nextUpd');if(el)el.textContent='↻ обновление на сервере каждые 15 минут'+(S.end===DATA.to?' · МСК · текущий день не завершён':'');};
function dgInitFilterDrawer(){
 const trigger=document.getElementById('filtToggle'),panel=document.getElementById('advFilters'),closeButton=document.getElementById('filtClose');
 if(!trigger||!panel||panel.dataset.dgDrawer==='ready')return;
 panel.dataset.dgDrawer='ready';panel.classList.add('dg-filter-drawer');panel.hidden=false;panel.inert=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Фильтры');panel.setAttribute('aria-hidden','true');
 trigger.setAttribute('aria-controls','advFilters');trigger.setAttribute('aria-expanded','false');
 const sections=document.createElement('div');sections.className='dg-filter-sections';
 const descriptions=[['#dateSeg','◷','Дата создания — выборка заведённых записей. Дата продажи — продажи и выручка по дате предоплаты или успеха.'],['#revSeg','₽','Когда учитывать продажу: с предоплаты или после успешного завершения.'],['#amtSeg','Σ','Сумма сделки или полученная предоплата. В календаре поле суммы выбирается отдельно.'],['#gran','▦','Как группировать даты на графиках и в календаре: по дням, неделям или месяцам.'],['#dirSel','◈','Выберите направление или оставьте все записи Домгласс.']];
 for(const [selector,icon,text]of descriptions){const row=panel.querySelector(selector)?.closest('.rev-toggle');if(!row)continue;const symbol=document.createElement('span');symbol.className='dg-filter-icon';symbol.setAttribute('aria-hidden','true');symbol.textContent=icon;row.querySelector('.ctl-lbl')?.prepend(symbol);const note=document.createElement('p');note.className='dg-filter-note';note.textContent=text;row.append(note);sections.append(row);}
 const footer=document.createElement('div');footer.className='dg-filter-footer';const help=document.createElement('a');help.className='dg-help-link';help.href='https://t.me/yanchoglov';help.target='_blank';help.rel='noopener noreferrer';help.textContent='Нужна помощь';footer.append(help);panel.append(sections,footer);
 const wrap=trigger.closest('.filt-wrap');if(wrap)wrap.parentElement.append(wrap);
 const backdrop=document.createElement('div');backdrop.className='dg-filter-backdrop';backdrop.setAttribute('aria-hidden','true');document.body.append(backdrop,panel);
 let open=false,previousOverflow='';
 const setOpen=value=>{
  if(value===open)return;open=value;
  if(open){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
  else document.body.style.overflow=previousOverflow;
  panel.inert=!open;panel.setAttribute('aria-hidden',String(!open));trigger.setAttribute('aria-expanded',String(open));
  panel.classList.toggle('dg-drawer-open',open);backdrop.classList.toggle('dg-drawer-open',open);
  (open?closeButton:trigger)?.focus({preventScroll:true});
 };
 trigger.onclick=e=>{e.stopPropagation();setOpen(!open);};
 if(closeButton)closeButton.onclick=e=>{e.stopPropagation();setOpen(false);};
 backdrop.onclick=()=>setOpen(false);
 document.addEventListener('keydown',e=>{
  if(!open)return;
  if(e.key==='Escape'){e.preventDefault();setOpen(false);return;}
  if(e.key!=='Tab')return;
  const controls=[...panel.querySelectorAll('button,select,input,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.offsetParent!==null),first=controls[0],last=controls.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 });
 document.addEventListener('focusin',e=>{if(open&&!panel.contains(e.target))closeButton?.focus({preventScroll:true});});
}
let dgKpiCacheKey='',dgKpiCache=null;
function dgShiftDay(day,n){const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function dgOpenBudgetAt(to){
 if(to>=DATA.to)return SNAP().filter(d=>!d.won&&!d.lost).reduce((sum,d)=>sum+(d.budget||0),0);
 const end=Date.parse(to+'T23:59:59.999+03:00');return flt(AD,true).filter(d=>{if(d.created>to)return false;const latest=dgHistory(d,'deal').filter(e=>e.at<=end).at(-1);if(latest)return latest.semantic==='P';return !((d.won||d.lost)&&d.closed&&d.closed<=to);}).reduce((sum,d)=>sum+(d.budget||0),0);
}
function dgKpiWindow(from,to){
 if(from>DATA.to)return null;
 const D=flt(AD,true).filter(d=>d.created>=from&&d.created<=to),L=flt(AL,false).filter(l=>l.created>=from&&l.created<=to),m=mtr(D,L,soldSet(from,to),lostSet(from,to));
 return {...m,cr1:m.leads?m.qual/m.leads:null,cr2:m.deals?m.conv:null,check:m.won?m.check:null,openM:dgOpenBudgetAt(to),nonqual:L.filter(l=>l.qual==='неквал').length,leadWork:L.filter(l=>l.qual==='в работе').length};
}
function dgKpiSeries(){
 const signature=JSON.stringify([S.start,S.end,S.gran,S.fMgr,S.fSrc,S.fCli,S.fDir,S.revMode,S.amtMode,S.dateBasis]);if(signature===dgKpiCacheKey&&dgKpiCache)return dgKpiCache;
 const shift=periodLen(),intervals=dgCalendarKeys().map(key=>{const [from,to]=dgBucketRange(key),previousFrom=dgShiftDay(from,-shift),previousTo=dgShiftDay(to,-shift);return {from,to,previousFrom,previousTo,current:dgKpiWindow(from,to),previous:dgKpiWindow(previousFrom,previousTo)};});
 dgKpiCacheKey=signature;return dgKpiCache={intervals};
}
function dgKpiGraphFor(item){
 const fields={'Всего лидов':['leads','count'],'Поступило лидов':['leads','count'],'CR1 · % в сделку':['cr1','ratio'],'CR1 · в сделку':['cr1','ratio'],'Всего сделок':['deals','count'],'Сделок':['deals','count'],'CR2 · % в продажу':['cr2','ratio'],'CR2 · в продажу':['cr2','ratio'],'Продажи':['won','count'],'Выручка':['rev','money'],'Средний чек':['check','money'],'В работе сейчас':['openM','money'],'Потеряно':['lostM','money'],'Неквал':['nonqual','count'],'В работе':['leadWork','count']},spec=fields[item.k];if(!spec)return '';
 const [field,unit]=spec,{intervals}=dgKpiSeries(),current=intervals.map(x=>x.current?.[field]??null),previous=intervals.map(x=>x.previous?.[field]??null),max=unit==='ratio'?1:Math.max(1,...current.concat(previous).filter(v=>v!=null)),color=item.ac==='accent'?'#22D3EE':item.ac||'#22D3EE',X=i=>intervals.length===1?50:2+96*i/(intervals.length-1),Y=v=>34-v/max*30,format=v=>v==null?'Нет базы':unit==='ratio'?pct(v):fmt(v)+(unit==='money'?' ₽':'');
 const path=(values,stroke,dash)=>{let groups=[],part=[];for(let i=0;i<values.length;i++){if(values[i]==null){if(part.length)groups.push(part);part=[];}else part.push([X(i),Y(values[i])]);}if(part.length)groups.push(part);return groups.map(g=>g.length===1?`<circle cx="${g[0][0]}" cy="${g[0][1]}" r="1.5" fill="${stroke}"/>`:`<polyline points="${g.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${stroke}" stroke-width="1.5" ${dash?'stroke-dasharray="3 2"':''}/>`).join('');};
 const hits=intervals.map((v,i)=>{const left=i?(X(i-1)+X(i))/2:0,right=i===intervals.length-1?100:(X(i)+X(i+1))/2,range=(a,b)=>dgDate(a)+(a===b?'':' — '+dgDate(b)),rows=[['Дата',range(v.from,v.to)],['Текущий период',format(current[i])],['Сравнение',range(v.previousFrom,v.previousTo)],['Предыдущий период',format(previous[i])]];if(field==='openM')rows.push(['Остаток','Оценка по истории этапов и текущим бюджетам']);return `<g class="dg-hover-column"><g class="dg-hover-mark"><line x1="${X(i)}" x2="${X(i)}" y1="0" y2="38" stroke="var(--ink-3)" stroke-dasharray="2 2"/>${current[i]!=null?`<circle cx="${X(i)}" cy="${Y(current[i])}" r="2.3" fill="${color}" stroke="var(--bg-card)" stroke-width="1"/>`:''}${previous[i]!=null?`<circle cx="${X(i)}" cy="${Y(previous[i])}" r="1.8" fill="#8692A6"/>`:''}</g><rect class="dg-kpi-hit" x="${left}" y="0" width="${right-left}" height="38" fill="transparent" data-tip="${esc(dt(esc(item.k),rows))}"/></g>`;}).join('');
 return `<div class="dg-kpi-chart" data-dg-kpi="${field}"><svg viewBox="0 0 100 38" role="img" aria-label="${esc(item.k+' · текущий и предыдущий равный период')}">${path(previous,'#8692A6',true)}${path(current,color,false)}${hits}</svg><div class="dg-kpi-legend"><span style="color:${color}">● текущий</span><span>┄ предыдущий</span></div>${field==='openM'?'<small>Оценка снимков; число выше — сейчас</small>':''}</div>`;
}
