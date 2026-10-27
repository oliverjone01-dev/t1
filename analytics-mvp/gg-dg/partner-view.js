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
  const controls=[...panel.querySelectorAll('button,select,input,[tabindex="0"]')].filter(el=>!el.disabled&&el.offsetParent!==null),first=controls[0],last=controls.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 });
 document.addEventListener('focusin',e=>{if(open&&!panel.contains(e.target))closeButton?.focus({preventScroll:true});});
}
