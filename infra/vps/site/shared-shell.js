(function(){
 if(!document.querySelector('#gg-sidebar'))return;
 document.querySelectorAll('.gg-nav a[href="/dialog/"]').forEach(a=>{if(/ИИ/.test(a.textContent))a.href='/dialog/#ai-analysis';else if(/Скорость/.test(a.textContent))a.href='/dialog/#response-speed';else if(/Дожим/.test(a.textContent))a.href='/dialog/#follow-up';else if(/Хронология/.test(a.textContent))a.href='/dialog/#chronology';});
 const nav=document.querySelector('.gg-nav');
 function active(){
  nav.querySelectorAll('details').forEach(n=>n.open=false);
  nav.querySelectorAll('[aria-current],.gg-selected,.gg-current').forEach(n=>{n.removeAttribute('aria-current');n.classList.remove('gg-selected','gg-current');});
  const candidates=[...nav.querySelectorAll('a[href]')],pathname=location.pathname==='/'||location.pathname==='/dashboards/'?'/structure/':location.pathname;
  const hash=location.hash||(pathname==='/dialog/'?'#chronology':''),url=pathname+hash;
  const chosen=candidates.find(a=>new URL(a.href).pathname+new URL(a.href).hash===url)||candidates.find(a=>new URL(a.href).pathname===pathname&&!new URL(a.href).hash);
  if(chosen){chosen.classList.add('gg-current');chosen.setAttribute('aria-current','page');for(let n=chosen.parentElement;n&&n!==nav;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;}
 }
 active();window.addEventListener('hashchange',active);
})();

(function(){document.querySelectorAll(".gg-native-frame").forEach(frame=>{frame.addEventListener("load",()=>{const doc=frame.contentDocument;if(!doc)return;const link=doc.createElement("link");link.rel="stylesheet";link.href="shared-design.css";doc.head.append(link);doc.body.id="gg-dashboard";doc.body.classList.add("gg-generic");const theme=()=>{doc.documentElement.dataset.theme=document.documentElement.dataset.theme;doc.documentElement.classList.toggle("dark",document.documentElement.dataset.theme!=="light");};theme();new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});const resize=()=>{frame.style.height=Math.max(800,doc.body.scrollHeight)+"px";};new ResizeObserver(resize).observe(doc.body);resize();});});})();

// Communications uses the native calculation and handlers; only its presentation changes.
(function(){
 if(!/^\/dialog\/?$/.test(location.pathname)||typeof renderTree!=='function')return;
 const root=document.getElementById('gg-workspace'),host=document.getElementById('gg-dashboard'),list=document.getElementById('list');
 if(!root||!host||!list)return;
 root.classList.add('gg-communications');document.body.classList.add('gg-communications');
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const number=n=>Number(n).toLocaleString('ru-RU'),count=n=>Number(String(n||'').replace(/\D/g,''))||0;
 const views={chronology:{title:'Хронология диалогов',hint:'Менеджеры → сделки → история общения',metrics:null},'response-speed':{title:'Скорость ответа',hint:'Ответ клиенту, ожидание и принятие сделки в работу',metrics:['resp','ball','take']},'follow-up':{title:'Дожим и возражения',hint:'Тишина, следующий шаг и работа с возражениями',metrics:['silent','step','ghost','promise','obj','date']},'ai-analysis':{title:'ИИ-разборы',hint:'Покрытие разбором и состояние диалогов; детали — в сделке',metrics:[]}};
 let mode='chronology',chronologyMetrics=S.showMetrics,entries=new Map(),selected=null,returnFocus=null;
 const toolbar=el('section','gg-comm-toolbar');toolbar.setAttribute('aria-label','Фильтры коммуникаций');
 const tabs=el('nav','gg-comm-tabs');tabs.setAttribute('aria-label','Разделы коммуникаций');
 Object.entries(views).forEach(([key,v])=>{const a=el('a','',v.title);a.href='/dialog/#'+key;a.dataset.commView=key;tabs.append(a);});
 const overview=el('section','gg-comm-overview');overview.setAttribute('aria-label','Итоги выбранного периода');
 host.prepend(tabs,toolbar,overview);
 const title=document.querySelector('.gg-heading h1'),subtitle=document.querySelector('.gg-heading h1+p'),fresh=document.getElementById('gg-freshness'),stamp=document.getElementById('sub');
 if(fresh&&stamp)fresh.append(stamp);
 const burger=document.getElementById('burger');if(burger){burger.className='gg-comm-ai-button';burger.textContent='Настроить ИИ-разбор';document.getElementById('gg-plan-actions')?.append(burger);burger.addEventListener('click',()=>closeDrawer(false));}
 // Native AI dialogs must sit above the common shell, outside the dashboard's isolation.
 ['apanel','scrim','picktray','tip'].forEach(id=>{const node=document.getElementById(id);if(node)document.body.append(node);});
 const shade=el('button','gg-comm-backdrop');shade.hidden=true;shade.type='button';shade.setAttribute('aria-label','Закрыть коммуникации');
 const drawer=el('aside','gg-comm-drawer');drawer.hidden=true;drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-labelledby','gg-comm-drawer-title');
 const dh=el('header','gg-comm-drawer-header'),dhtext=el('div'),dtitle=el('h2','','Коммуникации');dtitle.id='gg-comm-drawer-title';const name=el('p','gg-comm-drawer-name');dhtext.append(dtitle,name);
 const x=el('button','gg-comm-close','×');x.type='button';x.setAttribute('aria-label','Закрыть коммуникации');dh.append(dhtext,x);
 const body=el('div','gg-comm-drawer-body');drawer.append(dh,body);document.body.append(shade,drawer);
 function closeDrawer(restore=true){selected=null;drawer.hidden=true;shade.hidden=true;document.body.classList.remove('gg-comm-drawer-open');if(restore&&returnFocus?.isConnected)returnFocus.focus();}
 x.onclick=()=>closeDrawer();shade.onclick=()=>closeDrawer();
 document.addEventListener('keydown',e=>{if(drawer.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeDrawer();}else if(e.key==='Tab'){const focus=[...drawer.querySelectorAll('button,[tabindex="0"]')];const first=focus[0],last=focus.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}},true);
 function fillDrawer(entry){
  const focusKey=drawer.contains(document.activeElement)?document.activeElement.closest('[data-comm]')?.dataset.comm:null;
  name.textContent=entry.label;body.replaceChildren();
  const range=el('p','gg-comm-range',(S.dFrom||S.dTo?([S.dFrom,S.dTo].filter(Boolean).map(d=>d.split('-').reverse().join('.')).join(' — ')):'За весь доступный период')+' · '+(S.dMode==='created'?'по дате создания':'по коммуникациям'));
  const total=el('div','gg-comm-total'),v=el('b','',number(entry.total));total.append(v,el('span','','событий по пяти каналам'));
  const bar=el('div','gg-comm-channel-mix');bar.setAttribute('aria-label','Доли каналов коммуникации');
  entry.channels.forEach(c=>{if(c.value){const seg=el('span');seg.style.flex=String(c.value);seg.style.background=c.col;seg.title=c.t+': '+number(c.value)+' · '+(100*c.value/entry.total).toLocaleString('ru-RU',{maximumFractionDigits:1})+'%';bar.append(seg);}});
  const cards=el('div','gg-comm-channel-list');
  const max=Math.max(1,...entry.channels.map(c=>c.value));
  entry.channels.forEach(c=>{
   const row=c.node;row.className='gg-comm-channel'+(row.classList.contains('con')?' con':'');row.style.setProperty('--channel-color',c.col);row.removeAttribute('style');row.style.setProperty('--channel-color',c.col);row.replaceChildren();
   const text=el('div','gg-comm-channel-line');text.append(el('span','',c.t),el('b','',number(c.value)));const track=el('div','gg-comm-channel-track'),fill=el('i');fill.style.width=(100*c.value/max)+'%';track.append(fill);row.append(text,track);
   const share=el('small','',(entry.total?(100*c.value/entry.total).toLocaleString('ru-RU',{maximumFractionDigits:1}):'0')+'% всех событий');row.append(share);
   if(c.value&&entry.handler){row.classList.add('cchip');row.dataset.comm=c.k;row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label',c.t+': '+number(c.value)+'. Показать сделки');row.title='Показать сделки с этим каналом';row.removeAttribute('data-tip');row.onclick=e=>entry.handler.call(entry.row,e);row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.click();}};}
   else{row.removeAttribute('data-tip');row.removeAttribute('data-comm');}
   cards.append(row);
  });
  body.append(range,total,bar,el('h3','','Каналы общения и активности'),cards,el('p','gg-comm-drawer-hint',entry.handler?'Нажмите на канал — в таблице раскроются сделки с этой коммуникацией.':'Суммарные события группы. Раскройте группу в таблице, чтобы выбрать менеджера и его сделки.'));
  if(focusKey){const next=[...cards.querySelectorAll('[data-comm]')].find(n=>n.dataset.comm===focusKey);(next||x).focus();}
 }
 function openDrawer(key,button){const entry=entries.get(key);if(!entry)return;selected=key;returnFocus=button;aiToggle(false);fillDrawer(entry);shade.hidden=false;drawer.hidden=false;document.body.classList.add('gg-comm-drawer-open');x.focus();}
 function present(){
  const controls=list.querySelector(':scope > .controls');if(controls){toolbar.replaceChildren(controls);const period=el('div','gg-comm-period'),filters=el('div','gg-comm-filters');[...controls.children].forEach(n=>{if(n.matches('#pset,#dateBtn,[data-dreset]')||(n.classList.contains('ctl-lbl')&&n.textContent==='Период'))period.append(n);else if(!n.classList.contains('cdiv'))filters.append(n);});controls.append(period,filters);}
  const table=list.querySelector('.tbl.t1');if(!table)return;const headers=[...table.rows[0].cells],keys=headers.map(n=>n.dataset.k),act=keys.indexOf('act');
  const v=views[mode];title.textContent=v.title;subtitle.textContent=v.hint;const crumb=document.querySelector('.gg-breadcrumb');if(crumb)crumb.textContent='GENGROUP / Коммуникации / '+v.title;tabs.querySelectorAll('a').forEach(a=>{a.classList.toggle('on',a.dataset.commView===mode);if(a.dataset.commView===mode)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  headers.forEach((th,i)=>{if(th.dataset.ggNamed)return;th.dataset.ggNamed='1';const labels={act:'Коммуникации',temp:'Температура',aicov:'Разбор ИИ',compl:'Полнота'};if(labels[keys[i]])th.firstChild.textContent=labels[keys[i]];});
  // Metric-focused routes expose existing calculated columns, not a second dataset.
  const base=mode==='ai-analysis'?['mgr','deals','aicov','sum','temp','act','compl']:['mgr','deals','sum','alerts','hot','act'];
  const visible=keys.map(k=>v.metrics===null||base.includes(k)||v.metrics.includes(k));
  [...table.rows].filter(r=>r.parentElement===table.tBodies[0]).forEach(r=>{if(r.classList.contains('subrow')||r.classList.contains('aggrow')){r.cells[0].colSpan=visible.filter(Boolean).length;return;}[...r.cells].forEach((td,i)=>td.hidden=!visible[i]);});
  const first=table.querySelector('.deptrow');overview.replaceChildren();
  [['deals','Сделок и лидов'],['sum','Портфель'],['alerts','Требуют внимания'],['hot','Бюджет под риском']].forEach(([key,label])=>{const value=first?.cells[keys.indexOf(key)]?.textContent.trim()||'—';const card=el('div','gg-comm-kpi'+(['alerts','hot'].includes(key)?' attention':''));card.append(el('span','',label),el('b','',value));overview.append(card);});
  let heading=list.querySelector('.gg-comm-table-heading');if(!heading){heading=el('div','gg-comm-table-heading');table.parentElement.before(heading);}heading.replaceChildren(el('h2','','Отдел и менеджеры'),el('p','','Раскройте строку для сделок. Каналы — в панели справа.'));
  entries=new Map();
  [...table.querySelectorAll(':scope > tbody > .mrow2,:scope > tbody > .grprow')].forEach(row=>{
   const key=row.dataset.m||'__grp_'+row.dataset.g,td=row.cells[act];if(!td||td.dataset.ggChannels)return;td.dataset.ggChannels='1';const label=row.cells[0].querySelector('b')?.textContent||key;
   const nodes=[...td.querySelectorAll('.cgrid > span')],channels=COMM_TYPES.map((c,i)=>({...c,node:nodes[i]||el('span'),value:count(nodes[i]?.querySelector('b')?.textContent)}));
   const entry={key,label,row,handler:row.classList.contains('mrow2')?row.onclick:null,channels,total:channels.reduce((s,c)=>s+c.value,0)};entries.set(key,entry);
   const button=el('button','gg-comm-open','Каналы ↗');button.type='button';button.setAttribute('aria-label','Коммуникации: '+label);button.onclick=e=>{e.stopPropagation();openDrawer(key,button);};td.replaceChildren(button);entry.button=button;
  });
  if(selected){const entry=entries.get(selected);if(entry){returnFocus=entry.button;fillDrawer(entry);}else closeDrawer(false);}
  const mt=toolbar.querySelector('[data-metrics]');if(mt){mt.hidden=mode!=='chronology';mt.textContent=S.showMetrics?'Скрыть метрики':'Метрики регламента';}
 }
 const native=renderTree;renderTree=function(){const result=native.apply(this,arguments);present();return result;};
 function route(){if(mode==='chronology')chronologyMetrics=S.showMetrics;mode=views[location.hash.slice(1)]?location.hash.slice(1):'chronology';S.showMetrics=mode==='chronology'?chronologyMetrics:views[mode].metrics.length>0;renderTree();}
 window.addEventListener('hashchange',route);if(location.hash&&location.hash!=='#chronology')route();else present();
})();


