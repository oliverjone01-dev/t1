(function(){
 if(!document.querySelector('#gg-sidebar'))return;
 document.querySelectorAll('.gg-nav a[href="/dialog/"]').forEach(a=>{if(/ИИ/.test(a.textContent))a.href='/dialog/#ai-analysis';else if(/Скорость/.test(a.textContent))a.href='/dialog/#response-speed';else if(/Дожим/.test(a.textContent))a.href='/dialog/#follow-up';else if(/Хронология/.test(a.textContent))a.href='/dialog/#chronology';});
 const nav=document.querySelector('.gg-nav');
 function active(){
  nav.querySelectorAll('details').forEach(n=>n.open=false);
  nav.querySelectorAll('[aria-current],.gg-selected,.gg-current').forEach(n=>{n.removeAttribute('aria-current');n.classList.remove('gg-selected','gg-current');});
  const candidates=[...nav.querySelectorAll('a[href]')],pathname=location.pathname==='/'||location.pathname==='/dashboards/'?'/structure/':location.pathname;
  const hash=location.hash||(pathname==='/dialog/'?'#chronology':''),url=pathname+hash;
  let chosen=candidates.find(a=>new URL(a.href).pathname+new URL(a.href).hash===url)||candidates.find(a=>new URL(a.href).pathname===pathname&&!new URL(a.href).hash)||(pathname==='/rop/'&&!hash?candidates.find(a=>new URL(a.href).pathname==='/rop/'&&new URL(a.href).hash==='#sec1'):null);
  if(!chosen){const department=document.getElementById('gg-workspace')?.dataset.ggDepartment;chosen=[...nav.querySelectorAll(':scope > details > summary,:scope > a')].find(n=>(n.querySelector('.gg-nav-label')||n.querySelector('span'))?.textContent.trim()===department);}
  if(chosen){chosen.classList.add('gg-current');chosen.setAttribute('aria-current','page');for(let n=chosen.parentElement;n&&n!==nav;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;}
 }
 active();window.addEventListener('hashchange',active);
})();

(function(){document.querySelectorAll(".gg-native-frame").forEach(frame=>{frame.addEventListener("load",()=>{const doc=frame.contentDocument;if(!doc)return;const link=doc.createElement("link");link.rel="stylesheet";link.href="shared-design.css";doc.head.append(link);doc.body.id="gg-dashboard";doc.body.classList.add("gg-generic");const theme=()=>{doc.documentElement.dataset.theme=document.documentElement.dataset.theme;doc.documentElement.classList.toggle("dark",document.documentElement.dataset.theme!=="light");};theme();new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});const resize=()=>{frame.style.height=Math.max(800,doc.body.scrollHeight)+"px";};new ResizeObserver(resize).observe(doc.body);resize();});});})();

// BEGIN GG_COMMUNICATIONS_CALL_LINKING
// The export uses the same wall-clock timestamp convention for call events and footer dates.
// Match the footer's call time, never the later transcription publication time.
(function(){
 const digits=value=>String(value||'').replace(/\D/g,''),phone=value=>{const d=digits(value);return d.length===11&&/^[78]/.test(d)?d.slice(1):d.length===10?d:'';};
 const duration=value=>{const m=/^(?:(\d+):)?(\d+):(\d{2})$/.exec(String(value||''));return m?(Number(m[1]||0)*3600+Number(m[2])*60+Number(m[3])):null;};
 const direction=value=>/^вход/i.test(String(value||''))?'in':/^исход/i.test(String(value||''))?'out':'';
 function head(event){
  const source=(event.speakers||[]).map(s=>s.text||'').join('\n')+'\n'+String(event.body||'');
  const re=/Звонок\s+от\s+(\d{2})\.(\d{2})\.(\d{4})[\s,]+(\d{2}):(\d{2})\s*,\s*длительность\s+(\d+):(\d{2})\s*,\s*((?:вход|исход)[^,\n]*)\s*,\s*номер[ \t]*\+?(\d[\d \t\-()]*\d)/gi;
  const all=[...source.matchAll(re)],m=all.at(-1);if(!m)return null;
  const at=Date.parse(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00Z`),p=phone(m[9]);
  if(!Number.isFinite(at)||!p)return null;
  return{at,dur:Number(m[6])*60+Number(m[7]),durTxt:Number(m[6])+':'+m[7],dir:direction(m[8])==='in'?'входящее':'исходящее',phone:p};
 }
 function phonesOf(event){
  const found=new Set();
  for(const value of [event.phone,event.tel,event.title,event.body])for(const m of String(value||'').matchAll(/\+?\d[\d ()\t-]{8,}\d/g)){const p=phone(m[0]);if(p)found.add(p);}
  return found;
 }
 function build(events){
  const calls=new Map(),byCall={},byTr={},entity=e=>e.dealId?'D'+e.dealId:e.leadId?'L'+e.leadId:'';
  for(const c of events)if(c.type==='Звонок'&&entity(c)){const key=entity(c);if(!calls.has(key))calls.set(key,[]);calls.get(key).push({event:c,phones:phonesOf(c),seconds:duration(c.dur),direction:direction(c.dir)});}
  for(const t of events){if(t.type!=='Транскрипт звонка')continue;const h=head(t);if(!h){byTr[t.src]={how:'нет подписи звонка'};continue;}
   const candidates=(calls.get(entity(t))||[]).filter(c=>c.phones.has(h.phone)&&Math.floor(Number(c.event.ts)/60000)===Math.floor(h.at/60000)&&(!c.direction||c.direction===direction(h.dir))&&(c.seconds==null||c.seconds===0||c.seconds===h.dur));
   if(candidates.length!==1){byTr[t.src]={how:candidates.length?'неоднозначное совпадение':'звонок не найден',head:h};continue;}
   const call=candidates[0].event,how='дата, время, номер, направление и длительность';byTr[t.src]={call,how,head:h};
   const previous=byCall[call.src];if(!previous||Number(t.ts)>=Number(previous.tr.ts))byCall[call.src]={tr:t,how,head:h};
  }
  return{byCall,byTr};
 }
 window.ggBuildCallTranscriptIndex=build;
 if(!/^\/dialog\/?$/.test(location.pathname)||typeof callTrIndex!=='function')return;
 let cache=null;callTrIndex=function(){return cache||(cache=build(DATA.events||[]));};
})();

// END GG_COMMUNICATIONS_CALL_LINKING

// BEGIN GG_COMMUNICATIONS_ROSTER
// Communications follows the approved ROP manager roster without rewriting native data/rules.
(function(){
 'use strict';
 const normalize=value=>String(value||'').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е').split(/\s+/).filter(Boolean).sort().join(' ');
 const labelOf=value=>typeof value==='string'?value:(value&&typeof value==='object'?(value.label||value.name||value.mgr||''):'');
 function create({approved,managers,state}={}){
  const source=Array.isArray(managers)?managers:[],names=new Map(),approvedNames=new Map();
  for(const manager of source){const key=String(manager?.mgr||''),norm=normalize(key);if(!norm)continue;if(!names.has(norm))names.set(norm,new Set());names.get(norm).add(key);}
  for(const entry of Array.isArray(approved)?approved:[]){const label=String(labelOf(entry)).trim(),norm=normalize(label);if(!norm)continue;if(!approvedNames.has(norm))approvedNames.set(norm,new Set());approvedNames.get(norm).add(label);}
  const items=[],unmatched=[],ambiguous=[];
  for(const [norm,labels] of approvedNames){const matches=names.get(norm);if(labels.size!==1||matches?.size>1){ambiguous.push(...labels);continue;}if(!matches?.size){unmatched.push(...labels);continue;}items.push({key:[...matches][0],label:[...labels][0]});}
  const allowed=new Set(items.map(item=>item.key)),labels=new Map(items.map(item=>[item.key,item.label])),stack=[];
  // An empty native fMgrs means "all", so no valid approved match requires a non-matching key.
  let emptyKey='__GG_COMM_NO_APPROVED_MANAGER__';const sourceKeys=new Set(source.map(m=>m?.mgr));while(sourceKeys.has(emptyKey))emptyKey+='_';
  const getState=typeof state==='function'?state:()=>state;
  function requested(){const current=getState();return stack.length?stack[0]:(current?.fMgrs instanceof Set?current.fMgrs:new Set());}
  function withScope(callback){
   if(typeof callback!=='function')throw new TypeError('withScope requires a synchronous callback');
   const current=getState();if(!current)return callback();
   const previous=current.fMgrs,actual=requested(),effective=new Set(actual.size?[...actual].filter(key=>allowed.has(key)):allowed);
   if(!effective.size)effective.add(emptyKey);
   stack.push(previous instanceof Set?previous:new Set());current.fMgrs=effective;
   try{return callback();}finally{current.fMgrs=previous;stack.pop();}
  }
  return{items,allowed,unmatched,ambiguous,requested,withScope,label:key=>labels.get(key)||key,normalize};
 }
 window.ggCreateCommunicationsRoster=create;
 const injected=Object.prototype.hasOwnProperty.call(window,'GG_ROP_MANAGER_ROSTER');
 const approved=injected?window.GG_ROP_MANAGER_ROSTER:[...document.querySelectorAll('.gg-sections a[href^="/rop-"]')].map(a=>a.dataset.managerName||a.textContent.trim());
 window.ggCommunicationsRoster=create({approved,managers:typeof SC!=='undefined'&&SC?(SC.managers||[]):[],state:()=>typeof S!=='undefined'?S:null});
})();

// END GG_COMMUNICATIONS_ROSTER

// BEGIN GG_COMMUNICATIONS_METRICS
// Shared Communications data, presented through the lens selected by the route.
// Response fields respMed/firstResp/ballWait are working MINUTES; takeH is HOURS.
// The scorer's stored response/discipline facts cover the whole dialogue history.
(function(){
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const integer=v=>Number(v).toLocaleString('ru-RU'),decimal=v=>Number(v).toLocaleString('ru-RU',{maximumFractionDigits:1});
 const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 const add=(ds,key)=>ds.reduce((a,d)=>a+(valid(d[key])?d[key]:0),0);
 // Same even-sample convention as score-dialog.ts med(). Missing values are excluded.
 const median=vs=>{const v=vs.filter(valid).sort((a,b)=>a-b),i=v.length>>1;return v.length?(v.length%2?v[i]:Math.round((v[i-1]+v[i])/2)):null;};
 const percent=(n,d)=>d?100*n/d:null;
 const minutes=v=>v==null?'—':v<60?decimal(v)+' мин':decimal(v/60)+' ч';
 const postSale=new Set(['C49:EXECUTING','C49:FINAL_INVOICE','C49:1','C49:2']);
 const paidStages=new Set(['Предоплата получена','Заказ в производстве','Заказ произведен','Заказ отправлен','Сделка успешна']);
 const palette={msg:'var(--cat-1,#83c9ae)',call:'var(--cat-2,#929ccd)',mail:'var(--cat-3,#cda67e)',good:'var(--cat-1,#83c9ae)',warn:'var(--cat-3,#cda67e)',bad:'var(--negative,#df929f)',unknown:'var(--ink-4,#76818d)'};

 function filteredScope(){
  const roster=window.ggCommunicationsRoster?.allowed||new Set(),from=S.dFrom?Date.parse(S.dFrom+'T00:00:00+03:00'):0,to=S.dTo?Date.parse(S.dTo+'T23:59:59+03:00'):0;
  const inPeriod=d=>{
   if(!from&&!to)return true;
   const timestamps=(window.EVTS&&EVTS[d.key])||[];
   if(S.dMode==='created'){
    // Mirrors renderTree(): creation date, then first event; unknown dates remain visible.
    const created=d.createdAt?Date.parse(d.createdAt+'T12:00:00+03:00'):(d.firstTs||(timestamps.length?Math.min.apply(null,timestamps):0));
    return !created||((!from||created>=from)&&(!to||created<=to));
   }
   return timestamps.some(t=>(!from||t>=from)&&(!to||t<=to));
  };
  const ds=(SC.deals||[]).filter(d=>roster.has(d.mgr)&&(!S.fMgrs.size||S.fMgrs.has(d.mgr))&&(!S.fDealIds.size||S.fDealIds.has(String(d.dealId||d.leadId)))&&(S.oc==='all'||(d.outcome||'open')===S.oc)&&inPeriod(d));
  return{ds,from,to};
 }

 function card(key,label,value,detail,options={}){
  const n=make('article','gg-comm-kpi'+(options.attention?' attention':''));n.dataset.metric=key;n.dataset.value=value==null?'':String(value);n.dataset.unit=options.unit||'dialogs';
  if(options.denominator!=null)n.dataset.denominator=String(options.denominator);
  if(options.count!=null)n.dataset.count=String(options.count);
  n.append(make('span','',label),make('b','',options.formatted||(value==null?'—':integer(value))),make('small','gg-comm-kpi-detail',detail));
  if(options.why)n.title=options.why;
  return n;
 }
 function panel(title,hint){const box=make('article','gg-comm-metric-panel');box.append(make('h3','',title),make('p','gg-comm-panel-hint',hint));return box;}
 function bars(box,rows,denominator,unit='диалогов'){
  const max=Math.max(1,...rows.map(r=>r.n)),list=make('div','gg-comm-metric-bars');
  rows.forEach(r=>{const row=make('div','gg-comm-metric-row');row.dataset.metricBucket=r.key;row.dataset.count=String(r.n);
   const track=make('span','gg-comm-metric-track'),fill=make('i');fill.style.width=(100*r.n/max)+'%';fill.style.background=r.color||palette.good;track.append(fill);
   const pct=percent(r.n,denominator),value=make('b','',integer(r.n)+(pct==null?'':' · '+decimal(pct)+'%'));
   row.title=r.label+': '+integer(r.n)+' '+unit+(denominator?' из '+integer(denominator):'');row.append(make('span','gg-comm-metric-label',r.label),track,value);list.append(row);
  });box.append(list);
 }
 function scopeNote(text){return make('p','gg-comm-metric-source',text);}

 window.ggPresentCommunicationMetrics=function({mode,overview}){
  if(!overview||typeof SC==='undefined'||!SC||typeof S==='undefined'||!['chronology','response-speed','follow-up'].includes(mode)){if(overview)overview.replaceChildren();return;}
  const {ds,from,to}=filteredScope(),n=ds.length,opened=ds.filter(d=>(d.outcome||'open')==='open');
  overview.replaceChildren();overview.dataset.metricView=mode;overview.dataset.cohortCount=String(n);
  const visuals=make('section','gg-comm-metric-visuals');visuals.setAttribute('aria-label','Показатели раздела');
  if(mode==='chronology'){
   const totals={msg:0,call:0,mail:0},fullness={full:0,partial:0,empty:0};let without=0;
   for(const d of ds){const mix=mixOf(d,from,to)||{},comm=(mix.msg||0)+(mix.call||0)+(mix.mail||0),system=(mix.task||0)+(mix.note||0),ratio=comm+system?comm/(comm+system):0;
    for(const k of Object.keys(totals))totals[k]+=mix[k]||0;
    if(!comm)without++;fullness[ratio>=.6?'full':ratio>=.3?'partial':'empty']++;
   }
   const communications=totals.msg+totals.call+totals.mail,leads=ds.filter(d=>d.isLead).length;
   overview.append(
    card('dialogs','Сделок и лидов',n,integer(n-leads)+' сделок · '+integer(leads)+' лидов'),
    card('communications','Клиентских коммуникаций',communications,'сообщения, звонки и письма',{unit:'events',why:'События трёх клиентских каналов только в выбранных датах, по тому же набору сделок и лидов, что в таблице. Дела и заметки сюда не входят.'}),
    card('messages','Сообщений',totals.msg,'мессенджеры и открытые линии',{unit:'events'}),
    card('calls','Звонков',totals.call,'все зарегистрированные в CRM',{unit:'events',why:'Количество событий звонка, включая попытки и пропущенные звонки. Наличие записи не означает состоявшийся разговор.'}),
    card('emails','Писем',totals.mail,'входящие и исходящие',{unit:'events'}),
    card('without-contact','Без клиентских коммуникаций',without,(n?decimal(percent(without,n))+'% · ':'')+'из '+integer(n)+' сделок и лидов',{denominator:n,attention:without>0,why:'В выбранных датах у этих сделок и лидов нет сообщений, звонков и писем в CRM. Системные дела и заметки не считаются клиентскими коммуникациями.'})
   );
   const channels=panel('Каналы общения','Доли событий трёх клиентских каналов за выбранные даты');
   bars(channels,[{key:'msg',label:'Сообщения',n:totals.msg,color:palette.msg},{key:'call',label:'Звонки',n:totals.call,color:palette.call},{key:'mail',label:'Письма',n:totals.mail,color:palette.mail}],communications,'событий');
   const completeness=panel('Полнота коммуникаций','Насколько клиентское общение преобладает над делами и заметками');
   bars(completeness,[{key:'full',label:'От 60% клиентских событий',n:fullness.full,color:palette.good},{key:'partial',label:'От 30% до 60%',n:fullness.partial,color:palette.warn},{key:'empty',label:'Меньше 30% или пусто',n:fullness.empty,color:palette.bad}],n);
   visuals.append(channels,completeness);overview.append(scopeNote('Все показатели — по выборке таблицы. Даты ограничивают события; режим «по дате создания» также определяет состав сделок и лидов.'),visuals);
  }else if(mode==='response-speed'){
   const answered=ds.filter(d=>valid(d.respMed)),first=ds.filter(d=>valid(d.firstResp)),take=ds.filter(d=>valid(d.takeH)),fast=first.filter(d=>d.firstResp<=15).length,waiting=opened.filter(d=>valid(d.ballWait)&&d.ballWait>240),response=median(answered.map(d=>d.respMed)),firstResponse=median(first.map(d=>d.firstResp)),taking=take.length>=3?median(take.map(d=>d.takeH)):null;
   overview.append(
    card('response-median','Медиана ответа',response,integer(answered.length)+' диалогов с измерением',{unit:'minutes',denominator:answered.length,formatted:minutes(response),why:'Медиана сохранённых медиан времени ответа по выбранным сделкам и лидам. Рабочие минуты, 09:00–19:00 МСК; короткие отписки и согласованные паузы не считаются ответом или задержкой.'}),
    card('first-response-median','Первый ответ',firstResponse,integer(first.length)+' диалогов с измерением',{unit:'minutes',denominator:first.length,formatted:minutes(firstResponse),why:'Медиана времени первого содержательного ответа в каждом выбранном диалоге. Рабочие минуты, 09:00–19:00 МСК.'}),
    card('take-median','Взяли в работу',taking,take.length>=3?integer(take.length)+' диалогов · ориентир по дате создания':'Для медианы нужно 3 измерения; есть '+integer(take.length),{unit:'hours',denominator:take.length,formatted:taking==null?'—':decimal(taking)+' ч',why:'Медиана рабочих часов от даты создания до первого слова клиенту. В снимке дата создания без времени; это ориентир для сравнения, а не точный SLA.'}),
    card('first-response-fast','Первый ответ за 15 минут',percent(fast,first.length),integer(fast)+' из '+integer(first.length)+' измеренных диалогов',{unit:'percent',denominator:first.length,count:fast,formatted:first.length?decimal(percent(fast,first.length))+'%':'—',why:'Доля выбранных диалогов с первым содержательным ответом не позже 15 рабочих минут. Диалоги без измерения исключены из знаменателя.'}),
    card('waiting-long','Ждут ответа дольше 4 часов',waiting.length,integer(waiting.length)+' из '+integer(opened.length)+' в работе',{denominator:opened.length,attention:waiting.length>0,why:'Текущее состояние выбранных открытых сделок и лидов: последним написал клиент и ждёт более 240 рабочих минут. Если согласованный срок ещё не истёк, счётчик ожидания равен нулю.'}),
    card('response-measured','Ответ измерен',percent(answered.length,n),integer(answered.length)+' из '+integer(n)+' сделок и лидов',{unit:'percent',denominator:n,count:answered.length,formatted:n?decimal(percent(answered.length,n))+'%':'—',why:'Охват измерением обычного ответа. Нулевое время является измерением; отсутствие значения исключается из медианы.'})
   );
   const distribution=panel('Первый ответ клиенту','Рабочее время; один диалог — одно измерение');
   const rows=[{key:'fast',label:'До 15 минут',n:first.filter(d=>d.firstResp<=15).length,color:palette.good},{key:'hour',label:'От 15 минут до 1 часа',n:first.filter(d=>d.firstResp>15&&d.firstResp<=60).length,color:palette.call},{key:'four-hours',label:'От 1 до 4 часов',n:first.filter(d=>d.firstResp>60&&d.firstResp<=240).length,color:palette.warn},{key:'slow',label:'Дольше 4 часов',n:first.filter(d=>d.firstResp>240).length,color:palette.bad},{key:'unknown',label:'Нет измерения',n:n-first.length,color:palette.unknown}];bars(distribution,rows,n);
   const ranks=panel('Где клиенты ждут ответа','Открытые сделки и лиды с ожиданием больше 4 рабочих часов');
   const counts=new Map();waiting.forEach(d=>counts.set(d.mgr,(counts.get(d.mgr)||0)+1));
   const ranking=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ru')).slice(0,5).map(([label,total])=>({key:label,label,n:total,color:palette.bad}));
   if(ranking.length){bars(ranks,ranking,waiting.length);if(counts.size>5)ranks.append(make('p','gg-comm-panel-hint','Показаны 5 менеджеров из '+integer(counts.size)+'. Все ответственные доступны в таблице.'));}else ranks.append(make('p','gg-comm-metric-empty','В выбранной группе никто не ждёт дольше 4 рабочих часов.'));
   visuals.append(distribution,ranks);overview.append(scopeNote('Период и фильтры определяют выборку таблицы. Время ответа — по всей сохранённой истории выбранных диалогов; ожидание — на дату снимка. Это не время только ответов внутри выбранных дат.'),visuals);
  }else{
   const work=opened.filter(d=>!d.goalReached&&!postSale.has(d.stageCode)&&!paidStages.has(d.stage)),total=work.length;
   const noStep=work.filter(d=>!d.nextStep),silent=work.filter(d=>valid(d.silenceD)&&d.silenceD>=4),kp=work.filter(d=>(d.stageCode==='C49:PREPAYMENT_INVOIC'||d.stage==='КП отправлено')&&valid(d.silenceD)&&d.silenceD>=2),objections=work.filter(d=>(d.objTotal||0)>(d.objWorked||0)),promises=work.filter(d=>(d.promiseBroken||0)+(d.vagueProm||0)>0),objectionCount=work.reduce((a,d)=>a+Math.max(0,(d.objTotal||0)-(d.objWorked||0)),0),promiseCount=add(work,'promiseBroken')+add(work,'vagueProm');
   overview.append(
    card('follow-up-work','В работе до предоплаты',total,'из '+integer(n)+' сделок и лидов выборки',{denominator:n,why:'Выбранные открытые сделки и лиды, которые ещё не достигли предоплаты. Производство, отгрузка и достигшие цели исключены из очереди дожима.'}),
    card('no-next-step','Без следующего шага',noStep.length,(total?decimal(percent(noStep.length,total))+'% · ':'')+'из '+integer(total)+' в работе',{denominator:total,attention:noStep.length>0,why:'В текущем снимке CRM нет открытого дела или задачи; считаются только сделки и лиды в работе до предоплаты.'}),
    card('silent-long','Тишина 4 дня и больше',silent.length,(total?decimal(percent(silent.length,total))+'% · ':'')+'из '+integer(total)+' в работе',{denominator:total,attention:silent.length>0,why:'Календарные дни после последней клиентской коммуникации на дату снимка. Дела и заметки не обнуляют тишину. Производство и отгрузка исключены.'}),
    card('kp-no-push','КП без дожима',kp.length,'нет общения 2 дня и больше',{denominator:total,attention:kp.length>0,why:'В работе на стадии «КП отправлено», без клиентской коммуникации не менее двух календарных дней на дату снимка.'}),
    card('unworked-objections','Возражений без аргумента',objectionCount,'в '+integer(objections.length)+' сделках и лидах',{unit:'objections',denominator:add(work,'objTotal'),attention:objectionCount>0,why:'Сумма objTotal − objWorked по открытым диалогам до предоплаты. Сохранённые сигналы из переписки за всю историю, не число сделок.'}),
    card('problem-promises','Проблемных обещаний',promiseCount,'в '+integer(promises.length)+' сделках и лидах',{unit:'promises',denominator:promiseCount+add(work,'promiseKept'),attention:promiseCount>0,why:'Нарушенные обещания с истёкшим сроком плюс обещания без конкретного срока, из сохранённой истории выбранных диалогов.'})
   );
   const actions=panel('Где требуется действие','Количество сделок и лидов в работе до предоплаты');
   bars(actions,[{key:'no-step',label:'Поставить следующий шаг',n:noStep.length,color:palette.call},{key:'silent',label:'Возобновить общение',n:silent.length,color:palette.warn},{key:'kp',label:'Дожать после КП',n:kp.length,color:palette.mail},{key:'objections',label:'Вернуться к возражению',n:objections.length,color:palette.bad},{key:'promises',label:'Проверить обещание',n:promises.length,color:palette.msg}],total);
   const promiseBreakdown=panel('Обещания клиентам','Число обещаний в сохранённой истории открытых диалогов');
   const kept=add(work,'promiseKept'),broken=add(work,'promiseBroken'),vague=add(work,'vagueProm');
   bars(promiseBreakdown,[{key:'kept',label:'Со сроком и выполнены',n:kept,color:palette.good},{key:'broken',label:'Срок прошёл, не выполнены',n:broken,color:palette.bad},{key:'vague',label:'Без конкретного срока',n:vague,color:palette.warn}],kept+broken+vague,'обещаний');
   visuals.append(actions,promiseBreakdown);overview.append(scopeNote('Выборка — та же, что в таблице; дожим — только в работе до предоплаты. Тишина и следующий шаг — на дату снимка; возражения и обещания — за сохранённую историю. Одна сделка может требовать нескольких действий.'),visuals);
  }
 };
})();

// END GG_COMMUNICATIONS_METRICS

// BEGIN GG_COMMUNICATIONS_DEAL_AI
// Present the original deal review and its supporting events together in a right panel.
// Native review text, event markup, recording links and selection handlers remain the source.
(function(){
 'use strict';
 const AXES=[['polite','Вежливость'],['qual','Квалификация'],['deadline','Сроки'],['process','Ведение'],['result','Результат']];
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const fmt=n=>n.toLocaleString('ru-RU',{maximumFractionDigits:1}),valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=5;
 let state=null,eventMap=null;
 function events(){if(!eventMap){eventMap=new Map();if(typeof DATA!=='undefined')for(const e of DATA.events||[])if(e.src)eventMap.set(String(e.src),e);}return eventMap;}
 function deal(key){return typeof SCD!=='undefined'?SCD[key]:null;}
 function radar(d){
  const scores=d.ai?.scores||{};if(!AXES.some(([k])=>valid(scores[k])))return null;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 320 270');svg.classList.add('gg-deal-radar');svg.setAttribute('role','img');
  svg.setAttribute('aria-label','ИИ-оценки этой сделки. Шкала от 0 до 5. '+AXES.map(([k,t])=>t+': '+(valid(scores[k])?fmt(scores[k]):'нет оценки')).join('. '));
  const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!=null)n.textContent=text;svg.append(n);return n;};
  const point=(i,v)=>[160+Math.sin(i*2*Math.PI/5)*v*17,128-Math.cos(i*2*Math.PI/5)*v*17],poly=vs=>vs.map((v,i)=>point(i,v).join(',')).join(' ');
  [1,2,3,4,5].forEach(v=>add('polygon',{points:poly(AXES.map(()=>v)),class:'gg-deal-radar-grid'}));
  AXES.forEach(([k,label],i)=>{const p=point(i,5),q=point(i,6.5);add('path',{d:'M160 128L'+p.join(' '),class:'gg-deal-radar-grid'});const t=add('text',{x:q[0],y:q[1]-3,'text-anchor':'middle',class:'gg-deal-radar-label'},label),v=document.createElementNS(ns,'tspan');v.setAttribute('x',q[0]);v.setAttribute('dy','15');v.classList.add('gg-deal-radar-value');v.textContent=valid(scores[k])?fmt(scores[k]):'—';t.append(v);});
  // Missing scores stay missing: a complete polygon is only drawn for five real scores.
  if(AXES.every(([k])=>valid(scores[k])))add('polygon',{points:poly(AXES.map(([k])=>scores[k])),class:'gg-deal-radar-shape'});
  AXES.forEach(([k,label],i)=>{if(!valid(scores[k]))return;const p=point(i,scores[k]),dot=add('circle',{cx:p[0],cy:p[1],r:3.3,class:'gg-deal-radar-dot',tabindex:0,'data-deal-ai-axis':k,'data-deal-ai-score':scores[k]}),title=document.createElementNS(ns,'title');title.textContent=label+': '+fmt(scores[k])+' из 5';dot.append(title);});return svg;
 }
 function timestamp(e,fallback){const ts=Number(e?.ts);return Number.isFinite(ts)?ts:fallback;}
 function minutes(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0)return null;if(value===0)return '0 мин';if(value<1)return '<1 мин';if(value<60)return fmt(value)+' мин';if(value<2880)return fmt(value/60)+' ч';return fmt(value/1440)+' дн';}
 function fixChronology(review,d){
  // The same native deal table formats respMed via fmtMinShort: both response fields are minutes.
  // DEPT_NORM stores their raw medians. takeH remains hours and is intentionally unchanged.
  const norms=typeof DEPT_NORM==='function'?DEPT_NORM():{};
  const fields={'Первый ответ клиенту':['firstResp','first'],'Обычный ответ в переписке':['respMed','resp']};
  review.querySelectorAll('.ch-tbl tr').forEach(row=>{const pair=fields[row.cells[0]?.textContent.trim()];if(!pair)return;const value=minutes(d[pair[0]]),norm=minutes(norms[pair[1]]);if(value!=null){row.cells[1].textContent=value;row.cells[1].dataset.responseMinutes=String(d[pair[0]]);}row.cells[2].textContent=norm!=null?'норма отдела '+norm:'';});
 }
 // Transcript metadata uses the export's wall-clock convention; do not add another offset.
 function eventTime(ts,fallback){if(!Number.isFinite(ts))return fallback||'';return new Date(ts).toLocaleString('ru-RU',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
 function buildFeed(nativeFeed,d){
  const feed=make('section','gg-deal-history feedscroll'),heading=make('header','gg-deal-section-heading'),headingText=make('div');headingText.append(make('h3','','История общения'),make('p','','Сохранённый ИИ-разбор. Фильтр канала меняет только просмотр. События выбранного периода выделены.'));heading.append(headingText);
  const sort=make('button','gg-deal-order','Сначала старые');sort.type='button';sort.setAttribute('aria-label','Изменить порядок событий');heading.append(sort);feed.append(heading);
  const filters=make('nav','gg-deal-feed-filters');filters.setAttribute('aria-label','Каналы истории');feed.append(filters);
  const items=make('div','gg-deal-feed-items');feed.append(items);
  const systemEvents=new Map();for(const stage of d.stageRows||[])systemEvents.set('stage#'+stage.code+stage.date,{type:'Стадия',ts:stage.ts,dt:new Date(stage.ts).toISOString(),sys:1});for(const owner of d.owners||[])systemEvents.set('own#'+owner.at,{type:'Ответственный',ts:Date.parse(owner.at+'T12:00:00+03:00'),dt:owner.at+'T12:00:00+03:00',sys:1});
  const records=[...nativeFeed.querySelectorAll('tr.erow2')].map((row,i)=>{const cells=[...row.cells],e=events().get(row.dataset.src)||systemEvents.get(row.dataset.src),timeCell=cells[0]?.cloneNode(true);timeCell?.querySelector('.lstage')?.remove();const time=timeCell?.textContent.trim()||'',article=make('article','gg-deal-event '+row.className);article.dataset.src=row.dataset.src||'';article.dataset.evcat=row.dataset.evcat||'sys';article.dataset.dealEvent=String(i);article.id='gg-deal-event-'+i;if(row.onclick)article.onclick=row.onclick;if(row.hasAttribute('onclick'))article.setAttribute('onclick',row.getAttribute('onclick'));
   if(e?.dir==='исходящее')article.classList.add('gg-deal-outgoing');else if(e?.dir==='входящее')article.classList.add('gg-deal-incoming');else article.classList.add('gg-deal-service');
   const meta=make('div','gg-deal-event-meta'),who=make('span','gg-deal-event-who'),channel=make('span','gg-deal-event-channel'),when=make('time','gg-deal-event-time',time);if(e?.dt){when.dateTime=e.dt;when.title=e.dt;}
   if(cells[1])while(cells[1].firstChild)who.append(cells[1].firstChild);if(cells[2])while(cells[2].firstChild)channel.append(cells[2].firstChild);meta.append(who,channel,when);article.append(meta);
   const bubble=make('div','gg-deal-event-bubble'),body=make('div','gg-deal-event-body ebody');if(cells[3])while(cells[3].firstChild)body.append(cells[3].firstChild);bubble.append(body);
   if(cells[4]?.textContent.trim()){const marks=make('div','gg-deal-event-marks');while(cells[4].firstChild)marks.append(cells[4].firstChild);bubble.append(marks);}article.append(bubble);
   const stage=cells[0]?.querySelector('.lstage');if(stage)meta.append(stage);return{e,time,sourceEvents:e?[e]:[],article,ts:timestamp(e,i),source:String(row.dataset.src||''),body,bubble};});
  const bySource=new Map(records.map(r=>[r.source,r])),removed=new Set(),ix=typeof callTrIndex==='function'?callTrIndex():{byCall:{},byTr:{}};
  // A transcript is displayed on the original call even when its upload happened later.
  for(const r of records){if(r.e?.type!=='Звонок')continue;const match=ix.byCall[r.source],tr=match?.tr&&bySource.get(String(match.tr.src));if(!tr)continue;
   const details=make('details','gg-deal-transcript');details.open=false;details.dataset.src=tr.source;details.dataset.evcat='call';details.append(make('summary','','Расшифровка разговора'));
   const note=make('p','gg-deal-source-note','К этому звонку · '+(match.head?.durTxt||r.e.dur||'')+' · '+(match.how||''));details.append(note,tr.body);
   const marks=tr.bubble.querySelector('.gg-deal-event-marks');if(marks)details.append(marks);r.bubble.append(details);removed.add(tr);r.sourceEvents.push(tr.e);
   const chip=r.body.querySelector('.trchip');if(chip){chip.textContent='Расшифровка ниже';chip.setAttribute('data-tip','Расшифровка прикреплена к этому звонку по времени, номеру и длительности.');}
  }
  // BitrixGPT already records the activity reference. Keep that review on its source call.
  for(const r of records){if(r.e?.type!=='Резюме BitrixGPT'||!r.e.refId)continue;const call=bySource.get('act#'+r.e.refId);if(!call||call.e?.type!=='Звонок')continue;const details=make('details','gg-deal-transcript gg-deal-call-summary');details.dataset.src=r.source;details.dataset.evcat='call';details.append(make('summary','','Резюме звонка BitrixGPT'),r.body);const marks=r.bubble.querySelector('.gg-deal-event-marks');if(marks)details.append(marks);call.bubble.append(details);call.sourceEvents.push(r.e);removed.add(r);}
  for(const r of records){if(r.e?.type==='Транскрипт звонка'&&!removed.has(r)){const h=ix.byTr[r.source]?.head;if(h&&Number.isFinite(h.at)){r.ts=h.at;r.article.querySelector('time').textContent=eventTime(h.at);r.article.querySelector('time').dateTime=new Date(h.at).toISOString();const upload=make('p','gg-deal-source-note','Расшифровка загружена '+r.time+'. Исходный звонок не найден.');r.body.prepend(upload);}else r.body.prepend(make('p','gg-deal-source-note','Расшифровка без подтверждённой привязки к звонку. Время показывает загрузку.'));}}
  const displayed=records.filter(r=>!removed.has(r));let channel='all',ascending=true;
  const counts={all:displayed.length};displayed.forEach(r=>counts[r.article.dataset.evcat]=(counts[r.article.dataset.evcat]||0)+1);
  const labels={all:'Все',msg:'Сообщения',call:'Звонки',mail:'Письма',task:'Дела',note:'Заметки',sys:'CRM'};
  const show=()=>{displayed.sort((a,b)=>(a.ts-b.ts)*(ascending?1:-1));displayed.forEach(r=>{r.article.hidden=channel!=='all'&&r.article.dataset.evcat!==channel;items.append(r.article);});filters.querySelectorAll('button').forEach(b=>{b.classList.toggle('on',b.dataset.channel===channel);b.setAttribute('aria-pressed',String(b.dataset.channel===channel));});};
  Object.entries(labels).forEach(([key,label])=>{if(!counts[key])return;const b=make('button','',label+' '+counts[key]);b.type='button';b.dataset.channel=key;b.onclick=()=>{channel=key;show();};filters.append(b);});sort.onclick=()=>{ascending=!ascending;sort.textContent=ascending?'Сначала старые':'Сначала новые';show();};show();
  if(!displayed.length)items.append(make('p','gg-deal-empty','В истории пока нет событий.'));
  // Quote links use the exact original text; no inferred or fabricated evidence references.
  const sourceForQuote=q=>{const quote=String(q||'').trim().replace(/^[«“"]|[»”"]$/g,'');if(quote.length<8)return null;const matches=displayed.filter(r=>r.sourceEvents.some(e=>String(e?.body||'').includes(quote)||String(e?.speakers?.map(s=>s.text).join('\n')||'').includes(quote)));return matches.length===1?matches[0]:null;};
  return{feed,sourceForQuote,items,displayed};
 }
 function create(list,options){
  const shade=make('button','gg-deal-backdrop');shade.type='button';shade.hidden=true;shade.setAttribute('aria-label','Закрыть разбор сделки');
  const panel=make('aside','gg-deal-drawer');panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','gg-deal-drawer-title');
  const header=make('header','gg-deal-drawer-heading'),intro=make('div'),title=make('h2','','Разбор и коммуникации');title.id='gg-deal-drawer-title';const name=make('p','gg-deal-drawer-name');intro.append(title,name);const close=make('button','gg-deal-close','×');close.type='button';close.setAttribute('aria-label','Закрыть разбор сделки');header.append(intro,close);const body=make('div','gg-deal-drawer-body');panel.append(header,body);document.body.append(shade,panel);
  state={list,options,panel,shade,body,name,key:null,trigger:null,observer:null,closingTimer:null};
  close.onclick=shade.onclick=()=>closePanel(true,true);
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closePanel(true,true);}else if(e.key==='Tab'){const ns=[...panel.querySelectorAll('button,a[href],input,select,summary,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length),first=ns[0],last=ns.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
  window.addEventListener('hashchange',()=>closePanel(false,true));
  let pending=false;state.observer=new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;enhance(list,state.options);});});state.observer.observe(list,{childList:true,subtree:true});return state;
 }
 function closePanel(restore=true,clearNative=true){if(!state||!state.key)return;const key=state.key,trigger=state.trigger;state.key=null;state.panel.classList.add('closing');state.shade.classList.add('closing');document.body.classList.remove('gg-deal-drawer-open');const finish=()=>{if(state.key)return;state.panel.hidden=true;state.shade.hidden=true;state.body.replaceChildren();state.panel.classList.remove('closing');state.shade.classList.remove('closing');};clearTimeout(state.closingTimer);state.closingTimer=setTimeout(finish,matchMedia('(prefers-reduced-motion: reduce)').matches?0:180);
  if(clearNative&&typeof S!=='undefined'&&S.td.has(key)){S.td.delete(key);if(typeof renderTree==='function')renderTree();}if(restore){const row=[...state.list.querySelectorAll('.drow')].find(r=>r.dataset.d===key)||trigger;if(row?.isConnected){if(!row.hasAttribute('tabindex'))row.tabIndex=0;row.focus({preventScroll:true});}}
 }
 function enhance(list,options={}){
  if(!list||typeof S==='undefined')return;const st=state||create(list,options);st.options=options;
  const nativeHost=[...list.querySelectorAll('[id^="tree-"]')].find(n=>n.childElementCount&&S.td.has(n.id.slice(5)));
  if(!nativeHost){if(st.key&&!S.td.has(st.key))closePanel(false,false);return;}
  const key=nativeHost.id.slice(5),d=deal(key);if(!d)return;
  const changed=st.key!==key,oldReview=st.body.querySelector('.gg-deal-review'),oldHistory=st.body.querySelector('.gg-deal-history'),scrolls=[oldReview?.scrollTop||0,oldHistory?.scrollTop||0];
  if(changed)options.beforeOpen?.();clearTimeout(st.closingTimer);st.key=key;st.trigger=[...list.querySelectorAll('.drow')].find(r=>r.dataset.d===key);st.panel.classList.remove('closing');st.shade.classList.remove('closing');
  const nativeFeed=nativeHost.querySelector('.feedscroll'),history=nativeFeed?buildFeed(nativeFeed,d):null,review=make('section','gg-deal-review'),reviewHeader=make('div','gg-deal-section-heading');reviewHeader.append(make('h3','','ИИ-разбор сделки'));review.append(reviewHeader);
  const children=[...nativeHost.children];children.forEach(n=>{if(n!==nativeFeed)review.append(n);});nativeFeed?.remove();fixChronology(review,d);
  const scores=review.querySelector('.sc-grid'),chart=options.radar===true?radar(d):null;review.classList.toggle('gg-deal-no-radar',!chart);if(chart){const layout=make('div','gg-deal-score-layout'),figure=make('figure','gg-deal-radar-figure');figure.append(chart,make('figcaption','','Оценки этой сделки · 0–5'));layout.append(figure);if(scores)layout.append(scores);const verdict=review.querySelector('.dsum-v');if(verdict)verdict.after(layout);else reviewHeader.after(layout);}
  if(history){review.querySelectorAll('.mk-q').forEach(q=>{const source=history.sourceForQuote(q.textContent);if(!source)return;const b=make('button','gg-deal-evidence','Показать в диалоге →');b.type='button';b.onclick=()=>{history.feed.querySelector('[data-channel="all"]')?.click();source.article.hidden=false;source.article.querySelectorAll('.gg-deal-transcript').forEach(n=>n.open=true);source.article.classList.add('gg-deal-evidence-on');source.article.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});source.article.tabIndex=-1;source.article.focus({preventScroll:true});setTimeout(()=>source.article.classList.remove('gg-deal-evidence-on'),2200);};q.append(b);});}
  const placeholder=nativeHost.closest('.subrow2');if(placeholder)placeholder.hidden=true;nativeHost.classList.add('gg-deal-native-panel');nativeHost.replaceChildren(review);if(history)nativeHost.append(history.feed);st.body.replaceChildren(nativeHost);
  st.name.textContent=(d.isLead?'Лид ':'Сделка ')+(d.dealId||d.leadId||key)+' · '+d.title;headerMeta(st,d);
  st.panel.hidden=false;st.shade.hidden=false;document.body.classList.add('gg-deal-drawer-open');if(changed){st.panel.querySelector('.gg-deal-close').focus();}else{review.scrollTop=scrolls[0];if(history)history.feed.scrollTop=scrolls[1];}
 }
 function headerMeta(st,d){let meta=st.panel.querySelector('.gg-deal-drawer-meta');if(!meta){meta=make('div','gg-deal-drawer-meta');st.name.after(meta);}meta.replaceChildren();meta.append(make('span','','Ответственный: '+(d.mgr||'не назначен')),make('span','',(d.stage||'Лид')));const portal=typeof DATA!=='undefined'?DATA.portal:null;if((d.dealId||d.leadId)&&portal){const a=make('a','','Открыть в CRM ↗');a.href=String(portal).replace(/\/$/,'')+'/crm/'+(d.isLead?'lead':'deal')+'/details/'+(d.isLead?d.leadId:d.dealId)+'/';a.target='_blank';a.rel='noopener';meta.append(a);}}
 window.ggEnhanceDealAI=enhance;window.ggCloseDealDrawer=closePanel;
})();

// END GG_COMMUNICATIONS_DEAL_AI

// Communications uses the native calculation and handlers; only its presentation changes.
(function(){
 if(!/^\/dialog\/?$/.test(location.pathname)||typeof renderTree!=='function')return;
 const root=document.getElementById('gg-workspace'),host=document.getElementById('gg-dashboard'),list=document.getElementById('list');
 if(!root||!host||!list)return;
 root.classList.add('gg-communications');document.body.classList.add('gg-communications');
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const number=n=>Number(n).toLocaleString('ru-RU'),count=n=>Number(String(n||'').replace(/\D/g,''))||0;
 const roster=window.ggCommunicationsRoster;
 const nativeAiSave=aiSave;aiSave=function(){const effective=S.fMgrs;S.fMgrs=roster.requested();try{return nativeAiSave.apply(this,arguments);}finally{S.fMgrs=effective;}};
 // The approved ROP roster is the common base for the table and native AI selector.
 // These are derived selection indexes; exported CRM data and saved scores stay intact.
 if(typeof TABLE_MGRS!=='undefined'){TABLE_MGRS.clear();roster.allowed.forEach(m=>TABLE_MGRS.add(m));}
 if(typeof AI_MGRS!=='undefined')AI_MGRS.splice(0,AI_MGRS.length,...AI_MGRS.filter(m=>roster.allowed.has(m)));
 const approvedIds=new Set((SC.deals||[]).filter(d=>roster.allowed.has(d.mgr)).map(d=>String(d.dealId||d.leadId)));
 if(S.picks?.length){S.picks=S.picks.map(p=>({...p,deals:(p.deals||[]).filter(id=>approvedIds.has(String(id)))})).filter(p=>p.deals.length);aiApplyPicks();}
 const views={chronology:{title:'Хронология диалогов',hint:'Менеджеры → сделки → история общения',metrics:null},'response-speed':{title:'Скорость ответа',hint:'Ответ клиенту, ожидание и принятие сделки в работу',metrics:['resp','ball','take']},'follow-up':{title:'Дожим и возражения',hint:'Тишина, следующий шаг и работа с возражениями',metrics:['silent','step','ghost','promise','obj','date']},'ai-analysis':{title:'ИИ-разборы',hint:'Покрытие разбором и состояние диалогов; детали — в сделке',metrics:[]}};
 let mode='chronology',chronologyMetrics=S.showMetrics,entries=new Map(),selected=null,returnFocus=null;
 const toolbar=el('section','gg-comm-toolbar');toolbar.setAttribute('aria-label','Фильтры коммуникаций');
 let dateToolbar=document.querySelector('.gg-comm-date-toolbar');
 if(!dateToolbar){dateToolbar=el('section','gg-filter-toolbar gg-comm-date-toolbar');dateToolbar.setAttribute('aria-label','Период коммуникаций');dateToolbar.innerHTML='<div class="gg-toolbar-top"><div id="gg-period-slot"></div><div id="gg-date-slot"></div></div>';document.querySelector('.gg-content').prepend(dateToolbar);}
 const periodSlot=dateToolbar.querySelector('#gg-period-slot'),dateSlot=dateToolbar.querySelector('#gg-date-slot');
 let filterTrigger=document.getElementById('gg-filters-open');if(!filterTrigger){filterTrigger=el('button','gg-input');filterTrigger.id='gg-filters-open';filterTrigger.type='button';filterTrigger.innerHTML='<span aria-hidden="true">☰</span> Фильтры <span id="gg-filter-count" hidden></span>';dateToolbar.querySelector('.gg-toolbar-top').append(filterTrigger);}
 filterTrigger.setAttribute('aria-haspopup','dialog');filterTrigger.setAttribute('aria-controls','gg-filter-drawer');filterTrigger.setAttribute('aria-expanded','false');
 const filterBackdrop=el('button');filterBackdrop.id='gg-filter-backdrop';filterBackdrop.hidden=true;filterBackdrop.setAttribute('aria-label','Закрыть фильтры');
 const filterDrawer=el('section','gg-filter-panel gg-comm-filter-panel');filterDrawer.id='gg-filter-drawer';filterDrawer.hidden=true;filterDrawer.setAttribute('role','dialog');filterDrawer.setAttribute('aria-modal','true');filterDrawer.setAttribute('aria-labelledby','gg-filter-title');
 filterDrawer.innerHTML='<div class="gg-drawer-heading"><h2 id="gg-filter-title">Фильтры</h2><button id="gg-filters-close" class="gg-icon-button" aria-label="Закрыть фильтры">×</button></div><div class="gg-drawer-body"><h3 class="gg-filter-section-title">Область данных</h3><label class="gg-comm-manager-filter"><span>Менеджер</span><select id="gg-comm-manager"><option value="">Все менеджеры</option></select></label><h3 class="gg-settings-title">Настройки расчёта</h3><div id="gg-settings-slot"></div><div class="gg-comm-filter-ai-slot"></div></div><div class="gg-drawer-footer"><button id="gg-reset" class="gg-text-button">Сбросить</button><button id="gg-filters-done" class="gg-input">Готово</button></div>';
 filterDrawer.querySelector('#gg-settings-slot').append(toolbar);document.body.append(filterBackdrop,filterDrawer);
 const managerFilter=filterDrawer.querySelector('#gg-comm-manager');roster.items.slice().sort((a,b)=>a.label.localeCompare(b.label,'ru')).forEach(m=>managerFilter.add(new Option(m.label,m.key)));
 managerFilter.onchange=()=>{S.fMgrs.clear();if(managerFilter.value)S.fMgrs.add(managerFilter.value);S.fDealIds.clear();S.picks=[];S.dashNote='';aiApplyPicks();aiSyncScope({mgr:managerFilter.value});renderTree();};
 function closeFilters(){filterDrawer.hidden=true;filterBackdrop.hidden=true;filterTrigger.setAttribute('aria-expanded','false');document.body.classList.remove('gg-comm-filters-open');filterTrigger.focus();}
 filterTrigger.onclick=()=>{window.ggCloseDealDrawer?.(false,true);closeDrawer(false);filterDrawer.hidden=false;filterBackdrop.hidden=false;filterTrigger.setAttribute('aria-expanded','true');document.body.classList.add('gg-comm-filters-open');filterDrawer.querySelector('#gg-filters-close').focus();};
 filterDrawer.querySelector('#gg-filters-close').onclick=closeFilters;filterDrawer.querySelector('#gg-filters-done').onclick=closeFilters;filterBackdrop.onclick=closeFilters;
 filterDrawer.querySelector('#gg-reset').onclick=()=>{S.fMgrs.clear();S.fDealIds.clear();S.oc='all';S.picks=[];S.dashNote='';aiApplyPicks();setPeriod('','','comm');aiSyncScope({});};
 document.addEventListener('keydown',e=>{if(filterDrawer.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeFilters();}else if(e.key==='Tab'){const nodes=[...filterDrawer.querySelectorAll('button,select,input,a[href]')].filter(n=>n.getClientRects().length&&!n.disabled),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}},true);
 const tabs=el('nav','gg-comm-tabs');tabs.setAttribute('aria-label','Разделы коммуникаций');
 Object.entries(views).forEach(([key,v])=>{const a=el('a','',v.title);a.href='/dialog/#'+key;a.dataset.commView=key;tabs.append(a);});
 const overview=el('section','gg-comm-overview');overview.setAttribute('aria-label','Итоги выбранного периода');
 host.prepend(tabs,overview);
 const aiProfiles=el('section','gg-comm-ai-profiles');aiProfiles.hidden=true;overview.after(aiProfiles);
 const axes=[['polite','Вежливость'],['qual','Квалификация'],['deadline','Сроки'],['process','Ведение'],['result','Результат']];
 const managerData=new Map((SC.managers||[]).filter(m=>roster.allowed.has(m.mgr)).map(m=>[m.mgr,m])),dealsByManager=new Map();
 for(const d of SC.deals||[]){if(!dealsByManager.has(d.mgr))dealsByManager.set(d.mgr,[]);dealsByManager.get(d.mgr).push(d);}
 function profile(ds){
  const fresh=ds.filter(d=>d.aiState==='fresh'),eligible=ds.filter(d=>['fresh','stale','none'].includes(d.aiState));
  return{total:ds.length,deals:ds.filter(d=>!d.isLead).length,leads:ds.filter(d=>d.isLead).length,eligible:eligible.length,fresh:fresh.length,stale:ds.filter(d=>d.aiState==='stale').length,pending:ds.filter(d=>d.aiState==='none').length,
   scores:axes.map(([key])=>{const values=fresh.map(d=>d.ai?.scores?.[key]).filter(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=5);return{key,n:values.length,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null};})};
 }
 const profiles=new Map([...managerData.keys()].map(mgr=>[mgr,profile(dealsByManager.get(mgr)||[])]));
 const departmentProfile=profile((SC.deals||[]).filter(d=>managerData.has(d.mgr))),decimal=v=>v==null?'—':v.toLocaleString('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1});
 function radar(p,mgr){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 360 305');svg.classList.add('gg-comm-ai-radar');svg.setAttribute('role','img');svg.setAttribute('aria-label','Средние актуальные ИИ-оценки: '+mgr+'. Шкала от 0 до 5. '+p.scores.map((s,i)=>axes[i][1]+': '+decimal(s.mean)+', '+number(s.n)+' диалогов').join('. '));
  const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!=null)n.textContent=text;svg.append(n);return n;};
  const point=(i,value)=>[180+Math.sin(i*2*Math.PI/5)*value*20,145-Math.cos(i*2*Math.PI/5)*value*20],polygon=values=>values.map((v,i)=>point(i,v).join(',')).join(' ');
  [1,2,3,4,5].forEach(v=>add('polygon',{points:polygon(axes.map(()=>v)),class:'gg-ai-gridline'}));
  axes.forEach(([key,label],i)=>{const end=point(i,5),l=point(i,6.4);add('path',{d:'M180 145L'+end.join(' '),class:'gg-ai-gridline'});const text=add('text',{x:l[0],y:l[1]-4,'text-anchor':'middle',class:'gg-ai-axis-label'},label);const value=document.createElementNS(ns,'tspan');value.setAttribute('x',l[0]);value.setAttribute('dy','15');value.classList.add('gg-ai-axis-value');value.textContent=decimal(p.scores[i].mean);text.append(value);});
  if(departmentProfile.scores.every(s=>s.mean!=null))add('polygon',{points:polygon(departmentProfile.scores.map(s=>s.mean)),class:'gg-ai-department-shape'});
  if(p.scores.every(s=>s.mean!=null))add('polygon',{points:polygon(p.scores.map(s=>s.mean)),class:'gg-ai-manager-shape'});
  p.scores.forEach((s,i)=>{if(s.mean==null)return;const q=point(i,s.mean),dot=add('circle',{cx:q[0],cy:q[1],r:'3.5',class:'gg-ai-dot',tabindex:'0'}),tip=document.createElementNS(ns,'title');tip.textContent=axes[i][1]+': '+decimal(s.mean)+' из 5, '+number(s.n)+' актуальных диалогов';dot.append(tip);});
  return svg;
 }
 function aiProfileCard(mgr,inline=false){
  const p=profiles.get(mgr)||profile([]),a=SC.aiDemo===true?null:managerData.get(mgr)?.ai,card=el('article','gg-comm-ai-profile'+(inline?' gg-comm-ai-inline':''));card.dataset.aiManager=mgr;card.dataset.aiScope='snapshot';card.dataset.aiFresh=String(p.fresh);card.dataset.aiEligible=String(p.eligible);
  const head=el('header','gg-ai-profile-header');head.append(el('h3','',inline?'ИИ-профиль · '+roster.label(mgr):roster.label(mgr)),el('span','',number(p.deals)+' сделок · '+number(p.leads)+' лидов в снимке'));
  const content=el('div','gg-ai-profile-content'),visual=el('div','gg-ai-profile-visual'),info=el('div','gg-ai-profile-info');
  if(p.fresh&&p.scores.some(s=>s.mean!=null)){
   visual.append(radar(p,mgr));const legend=el('div','gg-ai-profile-legend');legend.append(el('span','gg-ai-own','Менеджер'),el('span','gg-ai-average','Отдел: среднее по диалогам'));visual.append(legend);
  }else visual.append(el('div','gg-ai-no-scores','Актуальных ИИ-оценок пока нет'),el('p','gg-ai-empty-note','Профиль появится после сохранения актуальных разборов.'));
  const coverage=el('div','gg-ai-profile-coverage');coverage.append(el('b','',number(p.fresh)+' / '+number(p.eligible)),el('span','',p.eligible?'актуальных разборов из подлежащих анализу · '+decimal(p.fresh/p.eligible*100)+'%':'диалогов, подлежащих анализу'));
  const strip=el('div','gg-ai-coverage-strip'),coverageLegend=el('div','gg-ai-coverage-legend');
  [['fresh',p.fresh,'Актуальные'],['stale',p.stale,'Нужны обновления'],['pending',p.pending,'Ждут разбора']].forEach(([key,n,label])=>{const explanation=label+': '+number(n)+' из '+number(p.eligible)+' · '+decimal(p.eligible?n/p.eligible*100:0)+'%';if(n){const part=el('i','gg-ai-'+key);part.style.flex=String(n);part.title=explanation;part.tabIndex=0;part.setAttribute('role','img');part.setAttribute('aria-label',explanation);part.dataset.aiCoverage=key;strip.append(part);}const item=el('span','gg-ai-'+key,label+' · '+number(n));item.title=explanation;coverageLegend.append(item);});
  info.append(coverage,strip,coverageLegend);
  const values=el('div','gg-ai-score-values');p.scores.forEach((s,i)=>{const item=el('div');item.dataset.aiAxis=s.key;item.dataset.aiMean=s.mean==null?'':String(s.mean);item.dataset.aiN=String(s.n);item.append(el('span','',axes[i][1]),el('b','',decimal(s.mean)+' / 5'));values.append(item);});info.append(values);
  if(a?.verdict){const verdict=el('p','gg-ai-profile-verdict',a.verdict);info.append(el('p','gg-ai-source-note','Сохранённая сводка · '+number(a.reviewed||0)+' разборов'),verdict);}
  const details=el('details','gg-ai-profile-details');details.append(el('summary','','Выводы и действия'));
  if(a){details.append(el('p','gg-ai-source-note','Сводка по всем сделкам и лидам снимка; её охват может отличаться от актуальных оценок выше.'));
   [['Сильные стороны',a.strengths],['Проблемы',a.weaknesses]].forEach(([label,items])=>{details.append(el('h4','',label));if(Array.isArray(items)&&items.length){const ul=el('ul');items.forEach(item=>ul.append(el('li','',typeof item==='string'?item:item.text||item.label||'')));details.append(ul);}else details.append(el('p','gg-ai-source-note','В сохранённой сводке не отмечены.'));});if(a.action){details.append(el('h4','','Что сделать'),el('p','',a.action));}
  }else details.append(el('p','gg-ai-source-note','Текстовая сводка по менеджеру ещё не сохранена.'));
  const sourceLink=el('button','gg-ai-profile-dialogs','Сделки и диалоги менеджера →');sourceLink.type='button';sourceLink.onclick=()=>{S.fMgrs.clear();S.fMgrs.add(mgr);S.fDealIds.clear();S.oc='all';S.picks=[];S.dashNote='';S.tm.add(mgr);S.deptOpen=true;Object.keys(S.grpOpen).forEach(k=>S.grpOpen[k]=true);aiApplyPicks();setPeriod('','','comm');aiSyncScope({mgr});location.hash='chronology';requestAnimationFrame(()=>requestAnimationFrame(()=>{const row=[...list.querySelectorAll('.mgrrow')].find(n=>n.dataset.m===mgr);if(row){row.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});row.tabIndex=-1;row.focus({preventScroll:true});}}));};
  info.append(details,sourceLink);content.append(visual,info);card.append(head,content,el('footer','gg-ai-profile-source','Средние оценки актуальных сохранённых разборов, 0–5. По всем сделкам и лидам менеджера в снимке; выбранный период не меняет профиль. Неоценённые диалоги исключены из среднего.'));
  return card;
 }
 function presentAIProfiles(table){
  root.dataset.commView=mode;aiProfiles.hidden=mode!=='ai-analysis';
  if(mode==='ai-analysis'&&!aiProfiles.childElementCount){
   const h=el('div','gg-ai-profiles-heading');h.append(el('h2','','ИИ-профили менеджеров'),el('p','','Все сделки и лиды каждого менеджера в текущем снимке. Радар — по актуальным сохранённым разборам.'));
   const grid=el('div','gg-ai-profile-grid');[...managerData.keys()].sort((a,b)=>(profiles.get(b).fresh-profiles.get(a).fresh)||a.localeCompare(b,'ru')).forEach(mgr=>grid.append(aiProfileCard(mgr)));aiProfiles.append(h,grid);
  }
  table.querySelectorAll(':scope > tbody > .mgrrow').forEach(row=>{const sub=row.nextElementSibling;if(sub?.classList.contains('subrow')){const link=el('a','gg-comm-manager-ai-link','ИИ-профиль менеджера →');link.href='/dialog/#ai-analysis';link.dataset.aiManager=row.dataset.m;link.onclick=e=>{e.preventDefault();closeDrawer(false);location.hash='ai-analysis';requestAnimationFrame(()=>requestAnimationFrame(()=>{const card=[...aiProfiles.querySelectorAll('[data-ai-manager]')].find(n=>n.dataset.aiManager===row.dataset.m);if(card){card.scrollIntoView({block:'start'});card.tabIndex=-1;card.focus({preventScroll:true});}}));};sub.cells[0].prepend(link);}});
 }
 const title=document.querySelector('.gg-heading h1'),subtitle=document.querySelector('.gg-heading h1+p'),fresh=document.getElementById('gg-freshness'),stamp=document.getElementById('sub');
 if(fresh&&stamp)fresh.append(stamp);
 const burger=document.getElementById('burger');if(burger){burger.className='gg-comm-ai-button';burger.textContent='Настроить ИИ-разбор';filterDrawer.querySelector('.gg-comm-filter-ai-slot').append(burger);burger.addEventListener('click',()=>{closeDrawer(false);closeFilters();});}
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
 function openDrawer(key,button){window.ggCloseDealDrawer?.(false,true);const entry=entries.get(key);if(!entry)return;selected=key;returnFocus=button;aiToggle(false);fillDrawer(entry);shade.hidden=false;drawer.hidden=false;document.body.classList.add('gg-comm-drawer-open');x.focus();}
 function present(){
  list.querySelector('[data-vhelp]')?.closest('.legend')?.remove();
  const controls=list.querySelector(':scope > .controls');if(controls){
   toolbar.replaceChildren(controls);periodSlot.replaceChildren();dateSlot.replaceChildren();const filters=el('div','gg-comm-filters');
   [...controls.children].forEach(n=>{if(n.id==='pset'){n.id='period';periodSlot.append(n);}else if(n.matches('#dateBtn,[data-dreset]'))dateSlot.append(n);else if(!n.classList.contains('cdiv')&&!(n.tagName==='SPAN'&&n.textContent.trim()==='Период'))filters.append(n);});controls.append(filters);
   periodSlot.querySelector('[data-pset="3"]')?.remove();
   const labels={today:'Сегодня',yst:'Вчера','7':'7 дн','30':'30 дн',tm:'Текущий месяц',lm:'Прошлый месяц',all:'Всё'};
   periodSlot.querySelectorAll('[data-pset]').forEach(b=>b.textContent=labels[b.dataset.pset]||b.textContent);
   const sixty=el('button','','60 дн');sixty.type='button';sixty.dataset.pset='60';const range=presetRange('60');sixty.classList.toggle('on',S.dFrom===range[0]&&S.dTo===range[1]);sixty.onclick=()=>setPeriod(...presetRange('60'));periodSlot.querySelector('[data-pset="30"]').after(sixty);
   const dateButton=dateSlot.querySelector('#dateBtn');if(dateButton){[...dateButton.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.textContent=n.textContent.replace(/[📅🗓]/gu,''));dateButton.insertAdjacentHTML('afterbegin','<svg class="gg-calendar-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M15 14h2M7 17h2"/></svg>');}
   const text=dateSlot.querySelector('#dateBtnTxt');if(text)text.textContent=S.dFrom||S.dTo?[S.dFrom,S.dTo].map(d=>d?d.split('-').reverse().join('.'):'…').join(' — '):'Все даты';
   const requested=roster.requested();managerFilter.value=requested.size===1?[...requested][0]:'';const activeCount=requested.size+(S.dMode!=='comm'?1:0)+(S.oc!=='all'?1:0)+(S.fDealIds.size?1:0),badge=document.getElementById('gg-filter-count');badge.textContent=String(activeCount);badge.hidden=!activeCount;
   const outcomeCounts={all:0,open:0,won:0,lost:0},from=S.dFrom?Date.parse(S.dFrom+'T00:00:00+03:00'):0,to=S.dTo?Date.parse(S.dTo+'T23:59:59+03:00'):0;
   (SC.deals||[]).filter(d=>{if(!roster.allowed.has(d.mgr)||S.fDealIds.size&&!S.fDealIds.has(String(d.dealId||d.leadId)))return false;if(!from&&!to)return true;const times=EVTS[d.key]||[];if(S.dMode==='created'){const t=d.createdAt?Date.parse(d.createdAt+'T12:00:00+03:00'):(d.firstTs||(times.length?Math.min(...times):0));return !t||(!from||t>=from)&&(!to||t<=to);}return times.some(t=>(!from||t>=from)&&(!to||t<=to));}).forEach(d=>{outcomeCounts.all++;const key=d.outcome||'open';if(key in outcomeCounts)outcomeCounts[key]++;});
   const outcomeLabels={all:'Все',open:'В работе',won:'Успех',lost:'Отказ'};toolbar.querySelectorAll('[data-oc]').forEach(b=>{const key=b.dataset.oc;b.textContent=outcomeLabels[key]+' '+number(outcomeCounts[key]);});
  }
  const table=list.querySelector('.tbl.t1');if(!table)return;const headers=[...table.rows[0].cells],keys=headers.map(n=>n.dataset.k),act=keys.indexOf('act');
  const v=views[mode];title.textContent=v.title;subtitle.textContent=v.hint;const crumb=document.querySelector('.gg-breadcrumb');if(crumb)crumb.textContent='GENGROUP / Коммуникации / '+v.title;tabs.querySelectorAll('a').forEach(a=>{a.classList.toggle('on',a.dataset.commView===mode);if(a.dataset.commView===mode)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  headers.forEach((th,i)=>{if(th.dataset.ggNamed)return;th.dataset.ggNamed='1';const labels={act:'Коммуникации',temp:'Температура',aicov:'Разбор ИИ',compl:'Полнота'};if(labels[keys[i]])th.firstChild.textContent=labels[keys[i]];});
  // Metric-focused routes expose existing calculated columns, not a second dataset.
  const base=mode==='ai-analysis'?['mgr','deals','aicov','sum','temp','act','compl']:['mgr','deals','sum','alerts','hot','act'];
  const visible=keys.map(k=>v.metrics===null||base.includes(k)||v.metrics.includes(k));
  [...table.rows].filter(r=>r.parentElement===table.tBodies[0]).forEach(r=>{if(r.classList.contains('subrow')||r.classList.contains('aggrow')){r.cells[0].colSpan=visible.filter(Boolean).length;return;}[...r.cells].forEach((td,i)=>td.hidden=!visible[i]);});
  ggPresentCommunicationMetrics({mode,overview});
  let heading=list.querySelector('.gg-comm-table-heading');if(!heading){heading=el('div','gg-comm-table-heading');table.parentElement.before(heading);}heading.replaceChildren(el('h2','','Отдел и менеджеры'),el('p','','Раскройте строку для сделок. Каналы — в панели справа.'));
  entries=new Map();
  [...table.querySelectorAll(':scope > tbody > .mrow2,:scope > tbody > .grprow')].forEach(row=>{
   const key=row.dataset.m||'__grp_'+row.dataset.g,td=row.cells[act];if(!td||td.dataset.ggChannels)return;td.dataset.ggChannels='1';const label=row.cells[0].querySelector('b')?.textContent||key;
   const nodes=[...td.querySelectorAll('.cgrid > span')],channels=COMM_TYPES.map((c,i)=>({...c,node:nodes[i]||el('span'),value:count(nodes[i]?.querySelector('b')?.textContent)}));
   const entry={key,label,row,handler:row.classList.contains('mrow2')?row.onclick:null,channels,total:channels.reduce((s,c)=>s+c.value,0)};entries.set(key,entry);
   const button=el('button','gg-comm-open','Каналы ↗');button.type='button';button.setAttribute('aria-label','Коммуникации: '+label);button.onclick=e=>{e.stopPropagation();openDrawer(key,button);};td.replaceChildren(button);entry.button=button;
  });
  if(selected){const entry=entries.get(selected);if(entry){returnFocus=entry.button;fillDrawer(entry);}else closeDrawer(false);}
  presentAIProfiles(table);
  window.ggEnhanceDealAI?.(list,{beforeOpen:()=>{closeDrawer(false);if(!filterDrawer.hidden)closeFilters();}});
  const mt=toolbar.querySelector('[data-metrics]');if(mt){mt.hidden=mode!=='chronology';mt.textContent=S.showMetrics?'Скрыть метрики':'Метрики регламента';}
 }
 const native=renderTree;renderTree=function(){const context=this,args=arguments;return roster.withScope(()=>{const result=native.apply(context,args);present();return result;});};
 function route(){if(mode==='chronology')chronologyMetrics=S.showMetrics;mode=views[location.hash.slice(1)]?location.hash.slice(1):'chronology';S.showMetrics=mode==='chronology'?chronologyMetrics:views[mode].metrics.length>0;renderTree();}
 window.addEventListener('hashchange',route);route();
})();



// BEGIN GG_WORKSPACE_SHARED_FRAME
// Adapt audited native page controls to the shared ROP shell without recalculating data.
(function(){
 'use strict';
 const slug=location.pathname.replace(/^\/+|\/+$/g,''),root=document.getElementById('gg-workspace'),host=document.getElementById('gg-dashboard'),content=document.querySelector('.gg-content');
 if(!root||!host||!content||['rop','dialog'].includes(slug))return;
 const specs={
  office:{period:'#presetSeg',dates:['#dFrom','#dTo','#applyCustom'],settings:[],header:':scope > .hdr',nav:'#nav',fresh:'#fresh'},
  prod:{period:'#presetSeg',dates:['#dFrom','#dTo','#applyCustom'],settings:[['Направление','#dirSel'],['Срез по дате','#modeSeg',true],['Изделия','#dealSeg'],['Гранулярность','#granSeg']],header:':scope > .hdr',nav:'#nav',fresh:'#fresh'},
  economics:{period:'#presets',calendar:'#dateBtn',settings:[['Период по','#econBasis'],['Сумма','#econAmt']],header:':scope > .wrap > .hrow',fresh:'#fresh',actions:'#burger',oldControls:'#presets'},
  pto:{header:':scope > .wrap > h1',fresh:'#stamp'}
 };
 root.classList.add('gg-native-page');root.dataset.sharedFrame=slug;
 const spec=specs[slug];
 if(!spec){const outerTitle=document.querySelector('.gg-heading h1')?.textContent.trim();const dedupe=()=>{if(!outerTitle)return;host.querySelectorAll('h1').forEach(h=>{if(h.textContent.trim()===outerTitle&&!h.closest('#gate,.gbox,[role="dialog"],.dialog'))h.classList.add('gg-frame-hidden-header');});};dedupe();new MutationObserver(dedupe).observe(host,{childList:true,subtree:true});return;}
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const find=sel=>host.querySelector(sel)||(/^#[\w-]+$/.test(sel)?root.querySelector(sel):null),move=(n,target)=>{if(n&&target&&!target.contains(n))target.append(n);};
 let toolbar=null,periodSlot=null,dateSlot=null,drawer=null,settingsBody=null,backdrop=null,trigger=null,calendar=null,calendarTrigger=null,returnFocus=null,adaptPending=false;
 const controls=new Map();
 const calendarIcon='<svg class="gg-calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>';
 function ensureToolbar(){if(toolbar)return;toolbar=make('section','gg-filter-toolbar gg-shared-frame-toolbar');toolbar.setAttribute('aria-label','Период и фильтры');const top=make('div','gg-toolbar-top');periodSlot=make('div','gg-frame-period');periodSlot.id='gg-period-slot';dateSlot=make('div','gg-frame-dates');dateSlot.id='gg-date-slot';top.append(periodSlot,dateSlot);toolbar.append(top);content.prepend(toolbar);}
 function focusable(scope){return[...scope.querySelectorAll('button,a[href],input,select,summary,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);}
 function closeFilters(restore=true){if(!drawer||drawer.hidden)return;drawer.hidden=true;backdrop.hidden=true;trigger.setAttribute('aria-expanded','false');document.body.classList.remove('gg-native-filters-open');if(restore)trigger.focus();}
 function ensureDrawer(){if(drawer)return;ensureToolbar();trigger=make('button','gg-input');trigger.type='button';trigger.id='gg-filters-open';trigger.innerHTML='<span aria-hidden="true">☰</span> Фильтры <span id="gg-filter-count" hidden></span>';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','gg-filter-drawer');trigger.setAttribute('aria-expanded','false');toolbar.querySelector('.gg-toolbar-top').append(trigger);
  backdrop=make('button');backdrop.id='gg-filter-backdrop';backdrop.type='button';backdrop.hidden=true;backdrop.setAttribute('aria-label','Закрыть фильтры');drawer=make('section','gg-filter-panel gg-shared-frame-filter-panel');drawer.id='gg-filter-drawer';drawer.hidden=true;drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-labelledby','gg-filter-title');
  drawer.innerHTML='<div class="gg-drawer-heading"><h2 id="gg-filter-title">Фильтры</h2><button id="gg-filters-close" class="gg-icon-button" aria-label="Закрыть фильтры">×</button></div><div class="gg-drawer-body"><h3 class="gg-filter-section-title">Настройки</h3><div class="gg-shared-frame-settings"></div></div><div class="gg-drawer-footer"><button id="gg-reset" class="gg-text-button">Сбросить</button><button id="gg-filters-done" class="gg-input">Готово</button></div>';
  settingsBody=drawer.querySelector('.gg-shared-frame-settings');root.append(backdrop,drawer);trigger.onclick=()=>{closeDates();returnFocus=document.activeElement;drawer.hidden=false;backdrop.hidden=false;trigger.setAttribute('aria-expanded','true');document.body.classList.add('gg-native-filters-open');drawer.querySelector('#gg-filters-close').focus();};drawer.querySelector('#gg-filters-close').onclick=()=>closeFilters();drawer.querySelector('#gg-filters-done').onclick=()=>closeFilters();backdrop.onclick=()=>closeFilters();
  drawer.querySelector('#gg-reset').onclick=()=>{for(const item of controls.values()){if(item.select){item.select.value=item.initial;item.select.dispatchEvent(new Event('change',{bubbles:true}));}else{const b=[...item.node.querySelectorAll('button')].find(n=>JSON.stringify(n.dataset)===item.initial);b?.click();}}updateCount();};
  drawer.addEventListener('click',()=>queueMicrotask(updateCount));drawer.addEventListener('change',()=>queueMicrotask(updateCount));drawer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeFilters();}else if(e.key==='Tab'){const ns=focusable(drawer),first=ns[0],last=ns.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
 }
 function updateCount(){if(!drawer)return;let count=0;for(const item of controls.values()){if(item.select){if(item.select.value!==item.initial)count++;}else{const current=item.node.querySelector('button.on,button[aria-pressed="true"]');if(current&&JSON.stringify(current.dataset)!==item.initial)count++;}}const badge=trigger.querySelector('#gg-filter-count');badge.textContent=String(count);badge.hidden=!count;}
 function addSetting(label,selector,wholeWrapper=false){const node=find(selector);if(!node)return;ensureDrawer();let field=settingsBody.querySelector('[data-native-control="'+node.id+'"]');if(!field){field=make('div','gg-shared-frame-field');field.dataset.nativeControl=node.id;field.append(make('span','gg-label',label));settingsBody.append(field);}const owner=wholeWrapper&&node.parentElement.classList.contains('rev-toggle')?node.parentElement:node;move(owner,field);
  if(!controls.has(node.id)){const select=node.tagName==='SELECT'?node:node.querySelector('select'),active=node.querySelector('button.on,button[aria-pressed="true"]');controls.set(node.id,{node,select,initial:select?select.value:JSON.stringify((active||node.querySelector('button'))?.dataset||{})});}updateCount();}
 function closeDates(){if(!calendar||calendar.hidden)return;calendar.hidden=true;calendarTrigger.setAttribute('aria-expanded','false');}
 function customDates(){const nodes=spec.dates.map(find);if(nodes.some(n=>!n))return;ensureToolbar();if(!calendar){calendarTrigger=make('button','dbtn gg-shared-frame-calendar-button');calendarTrigger.type='button';calendarTrigger.innerHTML=calendarIcon;calendarTrigger.setAttribute('aria-label','Выбрать диапазон дат');calendarTrigger.setAttribute('aria-haspopup','dialog');calendarTrigger.setAttribute('aria-controls','gg-shared-frame-calendar');calendarTrigger.setAttribute('aria-expanded','false');dateSlot.append(calendarTrigger);
   calendar=make('section','gg-shared-frame-calendar');calendar.id='gg-shared-frame-calendar';calendar.hidden=true;calendar.setAttribute('role','dialog');calendar.setAttribute('aria-label','Диапазон дат');const title=make('div','gg-shared-frame-calendar-title');title.append(make('b','','Диапазон дат'));const close=make('button','gg-icon-button','×');close.type='button';close.setAttribute('aria-label','Закрыть выбор дат');close.onclick=()=>{closeDates();calendarTrigger.focus();};title.append(close);calendar.append(title);root.append(calendar);
   calendarTrigger.onclick=()=>{closeFilters(false);calendar.hidden=!calendar.hidden;calendarTrigger.setAttribute('aria-expanded',String(!calendar.hidden));if(!calendar.hidden){const r=calendarTrigger.getBoundingClientRect();calendar.style.top=Math.min(r.bottom+8,innerHeight-190)+'px';calendar.style.right=Math.max(12,innerWidth-r.right)+'px';calendar.querySelector('input')?.focus();}};
   calendar.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeDates();calendarTrigger.focus();}});document.addEventListener('click',e=>{if(!calendar.hidden&&!calendar.contains(e.target)&&!calendarTrigger.contains(e.target))closeDates();});window.addEventListener('resize',closeDates);
  }
  nodes.forEach((n,i)=>{if(calendar.contains(n))return;if(i<2){const label=make('label');label.append(make('span','',i?'По':'С'));label.append(n);calendar.append(label);}else{n.classList.add('gg-shared-frame-apply');calendar.append(n);n.addEventListener('click',()=>queueMicrotask(()=>{closeDates();calendarTrigger.focus();}));}});
  const label=find('#periodLabel');if(label)move(label,calendarTrigger);else if(!calendarTrigger.querySelector('span'))calendarTrigger.append(make('span','','Даты'));
 }
 function adapt(){
  // Only static global headers from audited routes are adapted; widget controls stay local.
  const oldHeader=spec.header&&find(spec.header),fresh=spec.fresh&&find(spec.fresh),freshSlot=document.getElementById('gg-freshness');move(fresh,freshSlot);if(fresh?.parentElement===freshSlot)fresh.classList.add('gg-native-freshness');
  const nav=spec.nav&&find(spec.nav);if(nav){nav.classList.add('gg-native-page-tabs');if(nav.parentElement!==host)host.prepend(nav);}
  const action=spec.actions&&find(spec.actions);if(action){const target=document.getElementById('gg-plan-actions');action.classList.add('gg-native-page-action');move(action,target);}
  const period=spec.period&&find(spec.period);if(period){ensureToolbar();move(period,periodSlot);}
  if(spec.dates)customDates();
  const nativeCalendar=spec.calendar&&find(spec.calendar);if(nativeCalendar){ensureToolbar();nativeCalendar.classList.add('gg-shared-frame-calendar-button','dbtn');if(!nativeCalendar.querySelector('.gg-calendar-icon')){[...nativeCalendar.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.includes('📅')).forEach(n=>n.remove());nativeCalendar.insertAdjacentHTML('afterbegin',calendarIcon);}move(nativeCalendar,dateSlot);}
  for(const args of spec.settings||[])addSetting(...args);
  if(oldHeader)oldHeader.classList.add('gg-frame-hidden-header');
  if(slug==='economics'){const bar=find('#dfrom')?.parentElement;if(bar?.classList.contains('bar')){const count=bar.querySelector('#cnt');if(count){count.classList.add('gg-native-result-count');host.prepend(count);}bar.classList.add('gg-frame-hidden-controls');}const ver=find(':scope > .wrap > .ver');if(ver&&!ver.textContent.trim())ver.classList.add('gg-frame-hidden-header');for(const id of ['drawer','scrim']){const n=find('#'+id);if(n){n.classList.add('gg-native-instructions');move(n,root);}}}
  for(const id of ['tip','tt']){const n=find('#'+id);if(n){n.classList.add('gg-native-tooltip');move(n,root);}}
 }
 adapt();new MutationObserver(()=>{if(adaptPending)return;adaptPending=true;queueMicrotask(()=>{adaptPending=false;adapt();});}).observe(host,{childList:true,subtree:true});
 window.ggAdaptSharedFrame=adapt;
})();

// END GG_WORKSPACE_SHARED_FRAME
