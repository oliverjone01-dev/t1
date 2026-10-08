// UI adapter only. DATA, cohort rules, totals and original interactions are untouched.
(function(){
 const byId=id=>document.getElementById(id);
 const move=(id,to)=>{const node=byId(id);if(node)byId(to).appendChild(node);};
 const selectOptions=(id,key,label)=>{const el=byId(id);el.replaceChildren(new Option(label,''));[...new Set([...AD,...AL].map(x=>x[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru')).forEach(v=>el.add(new Option(v,v)));el.onchange=()=>{S[{mgr:'fMgr',source:'fSrc',client:'fCli'}[key]]=el.value;render();};};
 move('freshTag','gg-freshness');move('nextUpd','gg-freshness');move('planRefresh','gg-plan-actions');move('planOpen','gg-plan-actions');
 const dock=byId('planDock');if(dock)dock.remove();
 move('dateBtn','gg-date-slot');move('period','gg-period-slot');
 const advanced=byId('advFilters');if(advanced)[...advanced.children].filter(el=>!el.classList.contains('advf-hd')).forEach(el=>byId('gg-settings-slot').appendChild(el));
 const granularity=byId('gran')?.parentElement;if(granularity)byId('gg-gran-slot').appendChild(granularity);
 selectOptions('gg-manager','mgr','Все менеджеры');selectOptions('gg-source','source','Все источники');selectOptions('gg-client','client','Все типы клиентов');
 const escape=value=>String(value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const originalRender=render;
 function uiSync(){
  document.querySelectorAll('#root .kpi-strip').forEach(strip=>{const cards=[...strip.children];if(cards.length<2)return;const top=Math.ceil(cards.length/2),bottom=cards.length-top;strip.style.setProperty('--gg-kpi-grid',top*bottom);cards.forEach((card,index)=>card.style.gridColumn='span '+(index<top?bottom:top));});
  byId('gg-manager').value=S.fMgr;byId('gg-source').value=S.fSrc;byId('gg-client').value=S.fCli;
  if(byId('dateBtnTxt'))byId('dateBtnTxt').textContent=S.start.split('-').reverse().join('.')+' — '+S.end.split('-').reverse().join('.');
  const chips=[['fMgr','Менеджер'],['fSrc','Источник'],['fCli','Клиент'],['fDir','Направление']].filter(([key])=>S[key]).map(([key,label])=>'<button class="gg-chip" data-clear="'+key+'">'+label+': '+escape(S[key])+' <span>×</span></button>').join('');
  const count=flt(AD,true).length;
  const activeCount=['fMgr','fSrc','fCli','fDir'].filter(key=>S[key]).length+(S.dateBasis!=='outcome'?1:0)+(S.revMode!=='prepay'?1:0)+(S.amtMode!=='budget'?1:0)+(S.gran!=='week'?1:0);
  byId('gg-filter-count').textContent=activeCount;byId('gg-filter-count').hidden=!activeCount;
  byId('gg-active').innerHTML=chips+'<span>В снимке с учётом фильтров: '+count.toLocaleString('ru')+' сделок · период '+escape(S.start)+' — '+escape(S.end)+'</span>';
  byId('gg-active').querySelectorAll('[data-clear]').forEach(button=>button.onclick=()=>{S[button.dataset.clear]='';if(button.dataset.clear==='fDir')byId('dirSel').value='';render();});
 }
 render=function(){originalRender();uiSync();};
 byId('gg-reset').onclick=()=>{S.fMgr=S.fSrc=S.fCli=S.fDir='';S.dateBasis='outcome';S.revMode='prepay';S.amtMode='budget';S.gran='week';byId('dirSel').value='';for(const [id,attr,value] of [['dateSeg','b','outcome'],['revSeg','r','prepay'],['amtSeg','am','budget'],['gran','g','week']])byId(id)?.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset[attr]===value));byId('cf').value=byId('ct').value='';setPeriod('30');byId('period').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.p==='30'));render();};
 uiSync();
 const drawer=byId('gg-filter-drawer'),filterTrigger=byId('gg-filters-open'),filterBackdrop=byId('gg-filter-backdrop');let previousOverflow='';
 function closeFilters(){if(drawer.hidden)return;drawer.hidden=true;filterBackdrop.hidden=true;filterTrigger.setAttribute('aria-expanded','false');document.querySelector('.gg-main').inert=false;byId('gg-sidebar').inert=false;document.body.style.overflow=previousOverflow;filterTrigger.focus();}
 filterTrigger.onclick=()=>{previousOverflow=document.body.style.overflow;drawer.hidden=false;filterBackdrop.hidden=false;filterTrigger.setAttribute('aria-expanded','true');document.querySelector('.gg-main').inert=true;byId('gg-sidebar').inert=true;document.body.style.overflow='hidden';byId('gg-filters-close').focus();};
 byId('gg-filters-close').onclick=closeFilters;byId('gg-filters-done').onclick=closeFilters;filterBackdrop.onclick=closeFilters;
 document.addEventListener('keydown',e=>{if(drawer.hidden)return;if(e.key==='Escape'){closeFilters();return;}if(e.key!=='Tab')return;const focusable=[...drawer.querySelectorAll('button,select,input,a[href]'),...document.querySelectorAll('#calPop button,#calPop input')].filter(el=>el.getClientRects().length&&!el.disabled);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
 const theme=()=>{let value='dark';try{value=localStorage.getItem('gg-hub-theme')==='light'?'light':'dark';}catch{}document.documentElement.dataset.theme=value;};theme();
 byId('gg-theme').onclick=()=>{const value=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=value;try{localStorage.setItem('gg-hub-theme',value);}catch{}};
 const closeMenu=()=>{byId('gg-sidebar').classList.remove('gg-open');byId('gg-backdrop').hidden=true;byId('gg-menu').setAttribute('aria-expanded','false');};
 byId('gg-menu').onclick=()=>{const open=byId('gg-sidebar').classList.toggle('gg-open');byId('gg-backdrop').hidden=!open;byId('gg-menu').setAttribute('aria-expanded',String(open));};byId('gg-backdrop').onclick=closeMenu;
 const menuButton=byId('gg-company-button'),options=byId('gg-company-options');
 options.querySelectorAll('[data-company]').forEach(a=>a.addEventListener('click',()=>{try{localStorage.setItem('gg-hub-brand',a.dataset.company);}catch{}}));
 function closeOptions(){options.hidden=true;menuButton.setAttribute('aria-expanded','false');}
 menuButton.onclick=()=>{options.hidden=!options.hidden;menuButton.setAttribute('aria-expanded',String(!options.hidden));};
 menuButton.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();options.hidden=false;menuButton.setAttribute('aria-expanded','true');options.querySelector(e.key==='ArrowDown'?'a:first-child':'a:last-child').focus();}};
 options.onkeydown=e=>{const all=[...options.querySelectorAll('a')],i=all.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();all[e.key==='Home'?0:e.key==='End'?all.length-1:(i+(e.key==='ArrowDown'?1:-1)+all.length)%all.length].focus();}};
 document.addEventListener('click',e=>{if(!e.target.closest('.gg-company'))closeOptions();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();if(!options.hidden){closeOptions();menuButton.focus();}}});
 const sections=[...document.querySelectorAll('.gg-sections a[href^="#sec"]')];sections.forEach(a=>a.onclick=e=>{const target=document.querySelector(a.getAttribute('href'));if(!target)return;e.preventDefault();target.scrollIntoView({behavior:'smooth',block:'start'});history.replaceState(null,'',a.getAttribute('href'));closeMenu();});
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{const entry=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(entry)sections.forEach(a=>a.classList.toggle('gg-current',a.hash==='#'+entry.target.id));},{rootMargin:'-60px 0px -70% 0px'});document.querySelectorAll('#root .sec-div[id]').forEach(el=>observer.observe(el));}
})();
// User removed this widget from the ROP workspace; source data and calculations remain available.
(function(){
 function hideRemovedWidget(){document.querySelectorAll('#root .card').forEach(card=>{const title=card.querySelector('.card-title,.card-t');if(title?.textContent.trim().startsWith('Передано без карточки СП'))card.hidden=true;});}
 const before=render;render=function(){before();hideRemovedWidget();};hideRemovedWidget();
})();

// TURBIUM controls: styled listboxes proxy the existing selects and their original events.
(function(){
 const menus=[];
 document.querySelectorAll('#gg-filter-drawer select').forEach(select=>{
  select.hidden=true;select.tabIndex=-1;const host=document.createElement('div');host.className='gg-ds-select';
  const button=document.createElement('button');button.type='button';button.className='gg-input';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',select.closest('label')?.querySelector('span')?.textContent||'Выбрать значение');
  const panel=document.createElement('div');panel.className='gg-ds-menu';panel.hidden=true;
  const input=document.createElement('input');input.placeholder='Найти…';input.setAttribute('aria-label','Поиск вариантов');const list=document.createElement('div');list.setAttribute('role','listbox');
  panel.append(input,list);host.append(button,panel);select.after(host);
  function close(){panel.hidden=true;button.setAttribute('aria-expanded','false');}
  function sync(){button.textContent=(select.selectedOptions[0]?.textContent||'Все');list.replaceChildren();[...select.options].forEach(option=>{const item=document.createElement('button');item.type='button';item.textContent=option.textContent;item.dataset.value=option.value;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.value===select.value));item.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));close();button.focus();sync();};list.append(item);});}
  button.onclick=()=>{const open=panel.hidden;menus.forEach(m=>m.close());if(open){sync();panel.hidden=false;button.setAttribute('aria-expanded','true');input.value='';input.focus();}};
  input.oninput=()=>list.querySelectorAll('button').forEach(item=>item.hidden=!item.textContent.toLowerCase().includes(input.value.toLowerCase()));
  host.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.stopPropagation();close();button.focus();}if(['ArrowDown','ArrowUp'].includes(e.key)&&!panel.hidden){e.preventDefault();const items=[...list.children].filter(x=>!x.hidden),index=items.indexOf(document.activeElement);items[(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}});
  sync();menus.push({host,close,sync});
 });
 document.addEventListener('click',e=>menus.forEach(m=>{if(!m.host.contains(e.target))m.close();}));
 const previous=render;render=function(){previous();menus.forEach(m=>m.sync());};
 const toolbar=document.querySelector('.gg-filter-toolbar');if(toolbar&&'ResizeObserver'in window)new ResizeObserver(()=>{document.documentElement.style.setProperty('--gg-sticky-offset',(58+toolbar.getBoundingClientRect().height+16)+'px');}).observe(toolbar);
})();