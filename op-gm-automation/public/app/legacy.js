/* Разделы v3 (архив по скриншотам, разборы, скрипты, план, профили Bitrix). Перекрашены на токены Контур DS.
   Прежний заголовок v3: анализ Авито (568) + фильтруемые разборы + скрипты + профили. Данные из D (расшифровка). */
let D=null, FS={account:"all",speed:"all",outcome:"all",problem:"all",q:"",sort:"worst",limit:60};
function el(t,c,h){const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;}
function esc(s){return (s==null?"":String(s)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
const SPD={fast:"за 10 мин",ok:"10-60 мин",slow:"больше часа",overnight:"на след. день"};
const OUT={progressing:"живой",stalled:"завис",dropped:"ушёл",ordered:"заказ",unclear:"неясно"};

function tile(num,lab,tone,sub){return `<div class="box"><div class="big ${tone||''}">${esc(num)}</div><div class="lab">${esc(lab)}</div>${sub?`<div class="sub2">${esc(sub)}</div>`:''}</div>`;}

function renderOverview(){
  const M=D.metrics,m=D.meta,T=D.talks,h=T.hero;
  const sb=M.speed_buckets, slow=Math.round((sb.slow||0)+(sb.overnight||0));
  const big=tile(M.name+"%","Обращаются к человеку по имени","bad")+
            tile(slow+"%","Отвечаем медленнее часа или на след. день","bad")+
            tile(M.follow+"%","Напоминаем о себе, если человек замолчал","bad")+
            tile(M.left+"%","Клиент прочитал ответ и ушёл молча","warn");
  const kpi=tile(m.total,"Всего переписок","","64 старый + 504 новый")+
            tile(m.processed,"Разобрано подробно","", m.processed>=560?"полный разбор":"выборка")+
            tile(M.lag_median+" мин","Средний первый ответ","bad","норма Авито - до 15 минут")+
            tile((M.outcomes.stalled||0)+"%","Переписок зависли","warn","человек спросил и пропал");
  document.getElementById("p-overview").innerHTML=`
    <div class="ph-kicker">Авито · GLASS-MEMORY (стеклянные портреты на памятник)</div>
    <h1 class="pt">Как мы теряем клиентов в переписке</h1>
    <p class="pt-sub" style="max-width:820px">${esc(h.line)}</p>
    <div class="kpi" style="margin-top:18px">${big}</div>
    <div class="note-simple">${esc(T.howto)}</div>
    <h2 class="sec"><span class="bar"></span>Коротко о цифрах</h2>
    <div class="kpi">${kpi}</div>
    <div class="note-simple" style="border-color:color-mix(in oklab, var(--primary) 30%, transparent);background:color-mix(in oklab, var(--primary) 7%, transparent)"><b style="color:var(--accent)">Почему это деньги.</b> На Авито из обращения в заказ доходит обычно 3-5 человек из 100 <span class="tag hyp" style="margin-left:4px">гипотеза, бенчмарк рынка</span>. Мы сами роняем людей раньше этой точки - на скорости ответа и молчании после цены. Каждый процент, который мы отыграем на этих простых вещах, - это заказы, которые уже пришли к нам и которые мы теряем без борьбы.</div>
    <p style="color:var(--muted2);font-size:var(--fs-caption);margin-top:8px"><span class="tag data">ДАННЫЕ</span>Разобрано ${m.processed} переписок (${D.meta.valid} с читаемым текстом, остальные - пустые или нечитаемые скрины). Это чаты Авито на уровне аккаунта - имя менеджера в переписке не видно (менеджеры не подписываются), поэтому смотрим по аккаунту и по каждому диалогу. Тайминги ответов восстановлены из скринов и местами приблизительны; выводы о поведении (имя, дожим, приветствие) точные.</p>`;
}

function bar(name,pct,tone,note){const w=Math.max(2,Math.min(100,pct));
  return `<div class="bar-row"><div class="name">${esc(name)}</div><div class="bar-track"><div class="bar-fill ${tone||''}" style="width:${w}%"></div></div><div class="val">${pct}%</div></div>${note?`<div style="grid-column:2;color:var(--muted2);font-size:var(--fs-micro);margin:-6px 0 4px 0">${esc(note)}</div>`:''}`;}

function renderProblems(){
  const P=D.problem_scale, max=P.length?P[0].count:1;
  const rows=P.map(p=>`<div class="prow"><div class="pt2"><span class="pl">${esc(p.label)}</span><span class="pv">${p.count} <span style="color:var(--muted2);font-weight:400">(${p.pct}%)</span></span></div><div class="ptrack"><div class="pfill" style="width:${Math.max(3,Math.round(100*p.count/max))}%"></div></div></div>`).join("");
  document.getElementById("p-problems").innerHTML=`
    <div class="ph-kicker">Шкала проблем</div>
    <h1 class="pt">Типовые проблемы и сколько раз встретились</h1>
    <p class="pt-sub">Каждая полоса - конкретная ошибка в переписке и сколько диалогов ей задето (из ${D.meta.valid} разобранных). Чем длиннее полоса, тем больше денег утекает.</p>
    <div class="pscale">${rows}</div>`;
}

function renderSpeed(){
  const S=D.talks.speed, sb=D.metrics.speed_buckets;
  const map=[["fast","За 10 минут","good","так и надо"],["ok","За 10-60 минут","warn","уже поздновато"],["slow","Дольше часа (в тот же день)","bad","человек уже пишет другим"],["overnight","На следующий день или позже","bad","чаще всего заказ уже ушёл"]];
  const rows=map.map(([k,n,t,note])=>bar(n,sb[k]||0,t,note)).join("");
  document.getElementById("p-speed").innerHTML=`
    <div class="ph-kicker">Скорость ответа</div><h1 class="pt">${esc(S.title)}</h1>
    <p class="pt-sub">${esc(S.sub)}</p>
    <div class="card"><div class="bars">${rows}</div></div>
    <div class="note-simple"><b>Главное.</b> ${esc(S.punch)}</div>`;
}

function renderQuality(){
  const Q=D.talks.quality,M=D.metrics,a=M.accounts;
  const bars=[["Поздоровались",M.greet,true],["Назвали человека по имени",M.name,true],["Спросили, что именно нужно",M.qual,true],["Назвали цену",M.price,true],["Напомнили о себе",M.follow,true],["Клиент прочитал и ушёл молча",M.left,false]];
  const rows=bars.map(([n,v,gh])=>{const tone=gh?(v>=60?'good':v>=30?'warn':'bad'):(v>=40?'bad':v>=20?'warn':'good');return bar(n,v,tone);}).join("");
  document.getElementById("p-quality").innerHTML=`
    <div class="ph-kicker">Качество общения</div><h1 class="pt">${esc(Q.title)}</h1>
    <p class="pt-sub">${esc(Q.sub)}</p>
    <div class="card"><div class="bars">${rows}</div></div>
    <h2 class="sec"><span class="bar"></span>Старый аккаунт против нового</h2>
    <div class="card tight"><table class="matrix"><thead><tr><th>Показатель</th><th>Старый (${a.old.n})</th><th>Новый (${a.new.n})</th></tr></thead><tbody>
      <tr><td>Средний первый ответ</td><td>${a.old.lag_median} мин</td><td>${a.new.lag_median} мин</td></tr>
      <tr><td>Прочитал и ушёл молча</td><td><span class="pill hi">${a.old.left}%</span></td><td><span class="pill ${a.new.left>40?'hi':'mid'}">${a.new.left}%</span></td></tr>
      <tr><td>Напомнили о себе</td><td><span class="pill hi">${a.old.follow}%</span></td><td><span class="pill hi">${a.new.follow}%</span></td></tr>
      <tr><td>Переписок зависло</td><td><span class="pill hi">${a.old.stalled}%</span></td><td><span class="pill mid">${a.new.stalled}%</span></td></tr>
    </tbody></table></div>
    <div class="note-simple"><b>Главное.</b> ${esc(Q.punch)}</div>`;
}

function renderFunnel(){
  const F=D.talks.funnel,R=D.talks.redflags,M=D.metrics;
  const prog=Math.round((M.outcomes.progressing||0)+(M.outcomes.ordered||0));
  const steps=[["Написали нам",100,"plan",""],["Получили ответ",97,"plan","часть бросили сразу"],["Узнали цену",Math.round(M.price),"warn","половине даже цену не назвали"],["Разговор продолжился",prog,"good","остальные зависли или ушли"]];
  const sh=steps.map(([lab,val,tone,drop])=>`<div class="funnel-step" style="width:${Math.max(30,val)}%"><span class="fl">${esc(lab)} <span class="fp">${val} из 100</span></span>${drop?`<span class="drop">${esc(drop)}</span>`:''}</div>`).join("");
  const flags=R.items.map((f,i)=>`<div class="init"><div class="n">${i+1}</div><div class="body"><b>${esc(f.t)}</b><span>${esc(f.d)}</span></div><div class="meta"><span class="pill hi" style="margin:0">${esc(f.freq)}</span></div></div>`).join("");
  document.getElementById("p-funnel").innerHTML=`
    <div class="ph-kicker">Где теряем деньги</div><h1 class="pt">${esc(F.title)}</h1>
    <p class="pt-sub">${esc(F.sub)}</p>
    <div class="card"><div class="funnel">${sh}</div></div>
    <div class="note-simple"><b>Главное.</b> ${esc(F.punch)}</div>
    <h2 class="sec"><span class="bar"></span>${esc(R.title)}</h2>${flags}`;
}

/* ---- filterable dialogue browser ---- */
function fchips(dim,opts){return opts.map(([v,l])=>`<span class="fchip ${FS[dim]===v?'on':''}" data-dim="${dim}" data-v="${v}">${esc(l)}</span>`).join("");}
function buildFilterUI(){
  const probOpts=[["all","Любая проблема"]].concat(D.problem_scale.map(p=>[p.key,p.label+" ("+p.count+")"]));
  const host=document.getElementById("p-dialogues");
  host.innerHTML=`
    <div class="ph-kicker">Все переписки</div><h1 class="pt">Разбор всех диалогов</h1>
    <p class="pt-sub">${D.meta.valid} переписок с читаемым текстом (из ${D.meta.processed} всего) с фильтрами и поиском. Выбирай аккаунт, скорость ответа, исход или конкретную проблему - список сразу пересобирается.</p>
    <div class="filterbar">
      <div class="frow"><span class="fl">Аккаунт</span>${fchips("account",[["all","Все"],["old","Старый"],["new","Новый"]])}</div>
      <div class="frow"><span class="fl">Скорость</span>${fchips("speed",[["all","Любая"],["fast","За 10 мин"],["ok","10-60 мин"],["slow","Больше часа"],["overnight","На след. день"]])}</div>
      <div class="frow"><span class="fl">Исход</span>${fchips("outcome",[["all","Любой"],["progressing","Живой"],["stalled","Завис"],["dropped","Ушёл"],["ordered","Заказ"]])}</div>
      <div class="frow"><span class="fl">Проблема</span><select class="fsearch" id="fprob" style="max-width:340px">${probOpts.map(([v,l])=>`<option value="${v}" ${FS.problem===v?'selected':''}>${esc(l)}</option>`).join("")}</select></div>
      <div class="frow"><span class="fl">Поиск</span><input class="fsearch" id="fq" placeholder="слово в переписке..." value="${esc(FS.q)}"><span class="fchip ${FS.sort==='worst'?'on':''}" data-dim="sort" data-v="worst">Худшие сверху</span><span class="fchip ${FS.sort==='default'?'on':''}" data-dim="sort" data-v="default">По порядку</span></div>
    </div>
    <div class="fcount" id="fcount"></div><div id="dlist"></div>
    <div class="morewrap" id="morewrap"></div>`;
  host.querySelectorAll(".fchip").forEach(c=>c.addEventListener("click",()=>{const d=c.getAttribute("data-dim"),v=c.getAttribute("data-v");FS[d]=v;FS.limit=60;applyF();}));
  host.querySelector("#fprob").addEventListener("change",e=>{FS.problem=e.target.value;FS.limit=60;applyF();});
  host.querySelector("#fq").addEventListener("input",e=>{FS.q=e.target.value;FS.limit=60;applyF();});
  applyF();
}
const SEVRANK={overnight:0,slow:1,ok:2,fast:3};
function applyF(){
  let list=D.dialogues.filter(d=>!d.empty);
  if(FS.account!=="all")list=list.filter(d=>d.account===FS.account);
  if(FS.speed!=="all")list=list.filter(d=>d.speed===FS.speed);
  if(FS.outcome!=="all")list=list.filter(d=>d.outcome===FS.outcome);
  if(FS.problem!=="all")list=list.filter(d=>d.problems.includes(FS.problem));
  if(FS.q.trim()){const q=FS.q.toLowerCase();list=list.filter(d=>(d.summary+" "+d.quote+" "+d.id).toLowerCase().includes(q));}
  if(FS.sort==="worst")list=list.slice().sort((a,b)=>(SEVRANK[a.speed]-SEVRANK[b.speed])||(b.problems.length-a.problems.length));
  document.querySelectorAll("#p-dialogues .fchip").forEach(c=>{const d=c.getAttribute("data-dim"),v=c.getAttribute("data-v");c.classList.toggle("on",FS[d]===v);});
  const total=list.length, shown=list.slice(0,FS.limit);
  document.getElementById("fcount").innerHTML=`Найдено <b>${total}</b> переписок`+(total>FS.limit?` (показаны первые ${FS.limit})`:``);
  document.getElementById("dlist").innerHTML=shown.map(dRow).join("")||`<div class="empty">Ничего не найдено. Смягчите фильтры.</div>`;
  const mw=document.getElementById("morewrap");
  mw.innerHTML=total>FS.limit?`<button class="morebtn" id="moreb">Показать ещё ${Math.min(60,total-FS.limit)}</button>`:``;
  if(total>FS.limit)document.getElementById("moreb").addEventListener("click",()=>{FS.limit+=60;applyF();});
}
const PROBSHORT={slow_reply:"медленно",no_name:"без имени",no_followup:"не дожали",left_on_read:"ушёл молча",no_price:"без цены",no_qualify:"без вопросов",no_greeting:"без привета",scope_refusal:"«не работаем с камнем»",template_only:"шаблон",redirect_calculator:"на калькулятор",phone_instead_of_answer:"просил телефон",objection_unhandled:"возражение"};
function dRow(d){
  const probs=d.problems.map(p=>`<span class="cc prob">${esc(PROBSHORT[p]||p)}</span>`).join("");
  const mgr=d.manager?`<span class="cc mgr">${esc(d.manager)}</span>`:"";
  return `<div class="drow"><div class="dh"><span class="did">${esc(d.id)}</span><span class="cc acc">${d.account==='old'?'старый':'новый'}</span><span class="cc spd-${d.speed}">${esc(SPD[d.speed]||'?')}</span><span class="cc out-${d.outcome}">${esc(OUT[d.outcome]||d.outcome)}</span>${mgr}</div>${d.summary?`<div class="dsum">${esc(d.summary)}</div>`:''}${d.quote?`<div class="dq">«${esc(d.quote)}»</div>`:''}${probs?`<div class="dprob">${probs}</div>`:''}</div>`;
}

function renderTeardowns(){
  const cards=D.talks.teardowns.map(t=>{
    const chat=t.chat.map(m=>`<div class="msg ${m.who==='Клиент'?'cli':'mgr'}"><span class="who">${esc(m.who)}</span><span class="tx">${esc(m.tx)}${m.tm?`<span class="tm">${esc(m.tm)}</span>`:''}</span></div>`).join("");
    const wrong=(t.wrong||[]).map(x=>`<li class="bad">${esc(x)}</li>`).join("");
    const right=(t.right&&t.right.length?t.right:["-"]).map(x=>`<li class="good">${esc(x)}</li>`).join("");
    const sl=t.sev==='red'?'потеряли':t.sev==='yellow'?'спорно':'хорошо';
    return `<div class="teardown"><div class="th"><span class="cli">${esc(t.cli)}</span><span class="sev ${t.sev}">${sl}</span><span class="meta2">${esc(t.acc)} аккаунт · ${esc(t.date)}</span></div><div class="chat">${chat}</div><div class="td-grid"><div class="col bad"><h4>Что не так</h4><ul class="clean">${wrong}</ul></div><div class="col good"><h4>Что хорошо</h4><ul class="clean">${right}</ul></div></div><div class="td-fix"><b>Как надо:</b> ${esc(t.fix)}</div></div>`;
  }).join("");
  document.getElementById("p-teardowns").innerHTML=`<div class="ph-kicker">Детальные разборы</div><h1 class="pt">Разбор диалогов: что пошло не так</h1><p class="pt-sub">14 показательных переписок. Красный - клиента потеряли, жёлтый - спорно, зелёный - хороший пример. Внизу каждого - как надо было.</p>${cards}`;
}

/* ---- scripts library ---- */
function copyBtn(){return `<button class="copybtn" onclick="navigator.clipboard&&navigator.clipboard.writeText(this.parentElement.querySelector('.stext,.mpitch').innerText)">копировать</button>`;}
function renderScripts(){
  const core=(D.scripts&&D.scripts.core&&D.scripts.core.categories)||[];
  const objs=(D.scripts&&D.scripts.objections&&D.scripts.objections.objections)||[];
  const mags=(D.magnets&&D.magnets.magnets)||[];
  const tabs=core.map((c,i)=>`<span class="tab ${i===0?'on':''}" data-t="sc${i}">${esc(c.title)}</span>`).join("")
    +`<span class="tab" data-t="obj">Возражения (${objs.length})</span><span class="tab" data-t="mag">Лид-магниты (${mags.length})</span>`;
  const coreCats=core.map((c,i)=>`<div class="scat ${i===0?'on':''}" id="sc${i}">${(c.scripts||[]).map(s=>`<div class="scard"><div class="scase">${esc(s.case)}</div>${copyBtn()}<div class="stext">${esc(s.text)}</div>${s.note?`<div class="snote">${esc(s.note)}</div>`:''}</div>`).join("")}</div>`).join("");
  const objCat=`<div class="scat" id="obj">${objs.map(o=>`<div class="scard obj"><div class="scase">${esc(o.name)}</div>${copyBtn()}<div class="otrig">Клиент: «${esc(o.trigger)}»</div>${o.psych?`<div class="opsych">${esc(o.psych)}</div>`:''}<div class="stext">${esc(o.response)}</div>${o.then?`<div class="othen"><b>Дальше:</b> ${esc(o.then)}</div>`:''}</div>`).join("")}</div>`;
  const magCat=`<div class="scat" id="mag"><div class="note-simple">Это готовые идеи лид-магнитов. Каждый нужно один раз собрать (каталог, гайд, видео, образец договора) - дальше менеджер просто высылает готовый файл по подводке ниже. Начать с первых трёх - они закрывают самые частые сомнения.</div>${mags.map(m=>`<div class="magcard"><h4>${esc(m.name)}</h4>${m.when?`<span class="mwhen">${esc(m.when)}</span>`:''}<div class="mwhat">${esc(m.what)}${m.format?` · <span style="color:var(--muted2)">${esc(m.format)}</span>`:''}</div>${m.pitch?`${copyBtn()}<div class="mpitch">${esc(m.pitch)}</div>`:''}</div>`).join("")}</div>`;
  document.getElementById("p-scripts").innerHTML=`
    <div class="ph-kicker">Библиотека скриптов</div><h1 class="pt">Скрипты на все случаи + лид-магниты</h1>
    <p class="pt-sub">Готовые фразы, которые менеджер копирует и отправляет. По вкладкам: первый ответ, квалификация, цена, дожим, закрытие, отработка возражений и лид-магниты. [Имя] заменить на имя клиента из чата.</p>
    <div class="tabs" id="stabs">${tabs}</div>${coreCats}${objCat}${magCat}`;
  document.getElementById("stabs").querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
    document.querySelectorAll("#stabs .tab").forEach(x=>x.classList.remove("on"));t.classList.add("on");
    document.querySelectorAll("#p-scripts .scat").forEach(s=>s.classList.remove("on"));
    document.getElementById(t.getAttribute("data-t")).classList.add("on");window.scrollTo(0,0);
  }));
}

function renderActions(){
  const cards=D.talks.actions.map((a,i)=>`<div class="act"><div class="num">${i+1}</div><div><h3>${esc(a.t)} <span class="pill ${a.pr==='P1'?'hi':'mid'}" style="margin-left:6px">${esc(a.pr)}</span></h3><p>${esc(a.why)}</p><div class="meta3"><b>Что делать:</b> ${esc(a.how)}<br><b>Кто:</b> ${esc(a.who)}</div></div></div>`).join("");
  document.getElementById("p-actions").innerHTML=`<div class="ph-kicker">План действий</div><h1 class="pt">Что делать дальше</h1><p class="pt-sub">Семь простых шагов. Первые три (красные, P1) - самые важные и почти бесплатные.</p>${cards}`;
}

function renderNavNames(){document.querySelectorAll(".nm").forEach(sp=>{const k=sp.getAttribute("data-mgr");sp.textContent=D.MGRS[k].name;});}
function renderManager(key){const m=D.MGRS[key],host=document.getElementById("p-"+key);if(!host)return;
  const strong=m.strong.map(s=>`<li class="good">${esc(s)}</li>`).join(""),weak=m.weak.map(s=>`<li class="bad">${esc(s)}</li>`).join("");
  host.innerHTML=`<div class="ph-kicker">Профиль менеджера (разбор аналитика по Bitrix) · ${m.deals} сделок</div><div class="mgr-head"><div class="avatar" style="--slot:var(--cat-${({m1:3,m2:2,m3:1})[key]||3});background:color-mix(in oklab, var(--slot) 14%, transparent);color:var(--slot)">${m.initials}</div><h1 class="pt" style="margin:0">${esc(m.name)}</h1></div><div class="oneliner">${esc(m.oneliner)}</div><div class="card"><p>${esc(m.profile)}</p></div><div class="split"><div class="card"><h3 style="color:var(--ok)">Сильные стороны</h3><ul class="clean">${strong}</ul></div><div class="card"><h3 style="color:var(--bad)">Провалы</h3><ul class="clean">${weak}</ul></div></div><h2 class="sec"><span class="bar"></span>Поведенческая подпись</h2><div class="card"><p class="q">${esc(m.sign)}</p></div><h2 class="sec"><span class="bar"></span>Что чинить</h2><div class="card"><p>${esc(m.fix)}</p></div>`;}

