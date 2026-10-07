// UI adapter only. DATA, cohort rules, totals and original interactions are untouched.
(function(){
 const byId=id=>document.getElementById(id);
 const move=(id,to)=>{const node=byId(id);if(node)byId(to).appendChild(node);};
 const selectOptions=(id,key,label)=>{const el=byId(id);el.replaceChildren(new Option(label,''));[...new Set([...AD,...AL].map(x=>x[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru')).forEach(v=>el.add(new Option(v,v)));el.onchange=()=>{S[{mgr:'fMgr',source:'fSrc',client:'fCli'}[key]]=el.value;render();};};
 move('freshTag','gg-freshness');move('nextUpd','gg-freshness');move('planRefresh','gg-plan-actions');move('planOpen','gg-plan-actions');
 const dock=byId('planDock');if(dock)dock.remove();
 move('dateBtn','gg-date-slot');move('period','gg-period-slot');
 const fw=byId('filtToggle')?.closest('.filt-wrap');if(fw)byId('gg-settings-slot').appendChild(fw);
 if(byId('filtToggle'))byId('filtToggle').firstChild.textContent='Настройки расчёта ';
 selectOptions('gg-manager','mgr','Все менеджеры');selectOptions('gg-source','source','Все источники');selectOptions('gg-client','client','Все типы клиентов');
 const escape=value=>String(value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const originalRender=render;
 function uiSync(){
  byId('gg-manager').value=S.fMgr;byId('gg-source').value=S.fSrc;byId('gg-client').value=S.fCli;
  if(byId('dateBtnTxt'))byId('dateBtnTxt').textContent=S.start.split('-').reverse().join('.')+' — '+S.end.split('-').reverse().join('.');
  const chips=[['fMgr','Менеджер'],['fSrc','Источник'],['fCli','Клиент'],['fDir','Направление']].filter(([key])=>S[key]).map(([key,label])=>'<button class="gg-chip" data-clear="'+key+'">'+label+': '+escape(S[key])+' <span>×</span></button>').join('');
  const count=flt(AD,true).length;
  byId('gg-active').innerHTML=chips+'<span>В снимке с учётом фильтров: '+count.toLocaleString('ru')+' сделок · период '+escape(S.start)+' — '+escape(S.end)+'</span>';
  byId('gg-active').querySelectorAll('[data-clear]').forEach(button=>button.onclick=()=>{S[button.dataset.clear]='';if(button.dataset.clear==='fDir')byId('dirSel').value='';render();});
 }
 render=function(){originalRender();uiSync();};
 byId('gg-reset').onclick=()=>{S.fMgr=S.fSrc=S.fCli=S.fDir='';S.dateBasis='outcome';S.revMode='prepay';S.amtMode='budget';S.gran='week';byId('dirSel').value='';for(const [id,attr,value] of [['dateSeg','b','outcome'],['revSeg','r','prepay'],['amtSeg','am','budget'],['gran','g','week']])byId(id)?.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset[attr]===value));byId('cf').value=byId('ct').value='';setPeriod('30');byId('period').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.p==='30'));render();};
 uiSync();
 const theme=()=>{let value='light';try{value=localStorage.getItem('gg-hub-theme')||'light';}catch{}document.documentElement.dataset.theme=value;};theme();
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
