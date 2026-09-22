/* ===== Авито API: OLD-G / NEW-B. Все цифры считаются здесь из D.av.chats, одна версия правды. ===== */
const EXPORT_TS=Math.floor(Date.parse("2026-09-22T14:45:36Z")/1000);
const MON={"04":"Апрель","05":"Май","06":"Июнь","07":"Июль","08":"Август","09":"Сентябрь"};
const WD=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const CABS=["OLD-G","NEW-B"];
const CABC={"OLD-G":"var(--s1)","NEW-B":"var(--s2)"};
const KIND={self:"Клиент написал сам",vendor:"Поставщик, соискатель или тест",in:"Входящие",cold_reply:"Ответ на холодную рассылку",cold:"Холодная рассылка без ответа"};
const PROB={
 noresp:{l:"Не ответили вообще",rule:"Клиент написал текстом, а живого ответа нет: ни сообщения менеджера, ни принятого звонка. Автоответ «Вам ответит первый освободившийся...» ответом не считается.",todo:"Ответить сегодня, даже если прошло время. Извиниться за задержку и сразу ответить по сути."},
 abandoned:{l:"Клиент задал вопрос последним, ответа нет",rule:"Последнее сообщение от клиента: вопрос, номер телефона или содержательный текст. Ответа на него нет. «Спасибо», «подумаем», «напишу позже» сюда не попадают.",todo:"Ответить на его последний вопрос. Это самые тёплые клиенты: они уже писали нам сами."},
 phoneleft:{l:"Оставил телефон: проверьте перезвон",rule:"Последнее сообщение клиента - номер телефона, после него в чате тишина и нет принятого звонка через Авито. Звонили ли с мобильного, по данным Авито не видно.",todo:"Проверить, что клиенту перезвонили. Если нет, позвонить сегодня."},
 slow:{l:"Первый ответ дольше часа",rule:"От первого сообщения клиента до первого ответа компании прошло больше 60 минут.",todo:"Цель: первый ответ за 15 минут в рабочее время. Вечерние обращения закрыть первым делом утром."},
 noprice:{l:"Спросили цену, суммы нет",rule:"Клиент спросил цену, а в ответах нет суммы («20 000 руб», «32 000р.», «49 000», «40 тыс»). Не считаются: цену отправили на почту, в мессенджер или на калькулятор; клиенту нужен не наш товар; менеджер попросил размер для расчёта, а клиент не ответил.",todo:"Называть цену «от» и за какой размер. Одна утверждённая формулировка на весь отдел."},
 noquestion:{l:"Клиенту не задали ни одного вопроса",rule:"В ответах компании нет ни знака «?», ни просьбы «напишите», «пришлите», «уточните».",todo:"В каждом первом ответе один вопрос: размер, фото или срок. Без этого нельзя посчитать цену и продолжить разговор."},
 noname:{l:"Не назвали клиента по имени",rule:"Имя клиента есть в профиле Авито, а в ответах компании его нет.",todo:"Начинать ответ с имени клиента: «Имя, добрый день!»"},
 nofollow:{l:"Нет дожима",rule:"Компания ответила, клиент замолчал, и больше суток никто не напомнил о себе.",todo:"Через сутки тишины одно короткое напоминание с вопросом."},
 robotonly:{l:"Напоминал только робот Авито",rule:"В чате есть заметка Авито «Мы аккуратно напомнили собеседнику о диалоге», а менеджер после паузы больше суток сам не написал.",todo:"Робот не продаёт. После его напоминания менеджер пишет сам, по делу."},
 misscall:{l:"Пропущенный звонок без перезвона",rule:"В переписке есть пропущенный входящий звонок, исходящего звонка нет.",todo:"Перезванивать на каждый пропущенный в течение часа."},
 warranty:{l:"Срок гарантии назван без опоры на базу",rule:"Менеджер назвал срок гарантии в годах (чаще «5 лет»). В базе знаний (PRL v6) гарантия GLASS-MEMORY записана как «по договору».",todo:"Говорить «гарантия по договору». Срок не называть, пока его не сверят с шаблоном договора."}
};
const SHORT={phoneleft:"Оставил телефон",slow:"Ответ дольше часа",noprice:"Цену не назвали",noquestion:"Без вопроса клиенту",abandoned:"Клиент писал последним",nofollow:"Нет дожима"};
const PRECISION={noresp:"21 из 22, все случаи",abandoned:"11-13 из 13: 2 спорных случая",warranty:"25 из 25, проверка ФЕНИКСА",phoneleft:"20 из 20 на выборке: номер действительно последнее сообщение; был ли звонок с мобильного, по Авито не проверить",noprice:"14 из 20 и 16 из 20 на двух случайных выборках; в «Сегодня» попадает, только если последним написал клиент"};
const OWNER_NOTE="Выгрузку обновляет Иван раз в неделю, по понедельникам.";
const MILESTONE="06.10.2026";
function precTag(p){return PRECISION[p]?`<span class="tag data" title="${esc(PRECISION[p])}">проверено вручную: ${esc(PRECISION[p].split(/[;:,]/)[0])}</span>`:`<span class="tag hyp">точность не замерялась</span>`;}
function weekStart(ts){const d=Math.floor((ts+10800)/86400);return (d-((d+3)%7))*86400-10800;}
const COMPL_NOTE=1;
const PORDER=["noresp","abandoned","phoneleft","slow","noprice","noquestion","noname","nofollow","robotonly","misscall","warranty"];
const AV={cab:"all",mon:"all",kind:"in",ad:"all",prob:"all",flag:"all",q:"",sort:"recent",limit:40,today:14,tcab:"all"};

function avMon(c){return new Date((c.t+10800)*1000).toISOString().slice(5,7);}
function avAll(){return D.av.chats;}
function avSel(o){o=Object.assign({},AV,o||{});return avAll().filter(c=>
  (o.cab==="all"||c.cab===o.cab)&&(o.mon==="all"||avMon(c)===o.mon)&&
  (o.kind==="all"||(o.kind==="in"?(c.kind!=="cold"&&c.kind!=="vendor"&&c.nc>0):o.kind==="self"?(c.kind==="in"&&c.nc>0):c.kind===o.kind))&&
  (o.ad==="all"||c.ad===+o.ad));}
function med(a){if(!a.length)return null;a=a.slice().sort((x,y)=>x-y);const m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function P(v){return String(v).replace(".",",")+"%";}
function pct(a,b){return b?Math.round(a*1000/b)/10:0;}
function fL(s){if(s==null)return"-";s=Math.round(s);if(s<3600)return Math.max(1,Math.round(s/60))+" мин";if(s<86400){const h=Math.floor(s/3600),m=Math.round(s%3600/60);return h+" ч"+(m?" "+m+" мин":"");}const d=Math.floor(s/86400),h=Math.round(s%86400/3600);return d+" дн"+(h?" "+h+" ч":"");}
function fD(ts){const d=new Date((ts+10800)*1000);return d.toISOString().slice(8,10)+"."+d.toISOString().slice(5,7)+" "+d.toISOString().slice(11,16);}
function cabTag(c){return `<span class="cab ${c==="OLD-G"?"g":"b"}">${c}</span>`;}
function adName(i){return D.av.ads[i]||"-";}
function firstName(n){n=(n||"").trim().split(/\s+/)[0]||"";return /^[А-ЯЁ][а-яё]{1,}$/.test(n)?n:(n?n:"Клиент");}
function lastClientText(c){const M=D.av.msgs[c.id]||[];for(let i=M.length-1;i>=0;i--){if(M[i][1]==="c"&&M[i][2]!=="c")return M[i][3];}return "";}
function avStats(L){
  const withText=L.filter(c=>c.nc>0), lags=withText.map(c=>c.lag).filter(x=>x!=null);
  const n=withText.length, pq=withText.filter(c=>c.pq).length;
  const cnt=k=>withText.filter(c=>c.p.includes(k)).length;
  const after18=withText.filter(c=>{const h=new Date((c.t+10800)*1000).getUTCHours();return h>=18||h<9;});
  const calls=L.reduce((a,c)=>({in:a.in+c.cin,out:a.out+c.cout,miss:a.miss+c.cmiss,dur:a.dur+c.cdur}),{in:0,out:0,miss:0,dur:0});
  const cdur=[];L.forEach(c=>{if(!(c.cin||c.cout))return;(D.av.msgs[c.id]||[]).forEach(m=>{if(m[2]==="c"&&m[4]==="success")cdur.push(m[6]);});});
  return {n,med:med(lags),f15:pct(lags.filter(x=>x<=900).length,n),noresp:cnt("noresp"),noresp_p:pct(cnt("noresp"),n),
    pq,noprice:cnt("noprice"),noprice_p:pct(cnt("noprice"),pq),abandoned:cnt("abandoned"),aband_p:pct(cnt("abandoned"),n),
    after18_p:pct(after18.length,n),after18_med:med(after18.map(c=>c.lag).filter(x=>x!=null)),
    day_med:med(withText.filter(c=>!after18.includes(c)).map(c=>c.lag).filter(x=>x!=null)),
    calls,call_med:med(cdur),cnt,push:withText.filter(c=>c.push).length};
}
function cabsInScope(){return AV.cab==="all"?CABS:[AV.cab];}

/* ---- tooltip ---- */
function tipOn(e,h){const t=document.getElementById("avtip");t.innerHTML=h;t.style.display="block";tipMove(e);}
function tipMove(e){const t=document.getElementById("avtip");const x=Math.min(e.clientX+14,window.innerWidth-t.offsetWidth-8);t.style.left=x+"px";t.style.top=(e.clientY+14)+"px";}
function tipOff(){document.getElementById("avtip").style.display="none";}
document.addEventListener("click",e=>{if(!e.target.closest("[data-tip]"))tipOff();});
function wireTips(root){root.querySelectorAll("[data-tip]").forEach(n=>{if(!n.hasAttribute("data-go"))n.addEventListener("click",e=>{e.stopPropagation();tipOn(e,n.getAttribute("data-tip"));});n.addEventListener("mouseenter",e=>tipOn(e,n.getAttribute("data-tip")));n.addEventListener("mousemove",tipMove);n.addEventListener("mouseleave",tipOff);});}

/* ---- общий фильтр: кабинет > период > тип > объявление ---- */
function chipRow(label,dim,opts,cls){return `<div class="frow"><span class="fl">${label}</span>${opts.map(([v,l])=>`<span class="fchip ${cls||""} ${String(AV[dim])===String(v)?"on":""}" data-av="${dim}" data-v="${v}">${esc(l)}</span>`).join("")}</div>`;}
function avBar(opts){
  opts=opts||{};
  const mons=[["all","Всё время"]].concat(Object.keys(MON).map(k=>[k,MON[k]]));
  let h=`<div class="avbar">`+chipRow("Кабинет","cab",[["all","Оба кабинета"],["OLD-G","OLD-G · старый"],["NEW-B","NEW-B · новый"]])+chipRow("Период","mon",mons);
  if(!opts.nokind)h+=chipRow("Кто начал","kind",[["in","Все клиенты"],["self","Написал сам"],["cold_reply","Ответил на рассылку"],["all","Все чаты"]]);
  const cr=[];
  cr.push("<b>"+(AV.cab==="all"?"Оба кабинета":AV.cab+(AV.cab==="OLD-G"?" (старый кабинет)":" (новый кабинет)"))+"</b>");
  cr.push("<b>"+(AV.mon==="all"?"31.03 - 22.09.2026":MON[AV.mon])+"</b>");
  if(!opts.nokind)cr.push("<b>"+({all:"все чаты",in:"все клиенты",self:"клиент написал сам",cold_reply:"ответил на рассылку"}[AV.kind])+"</b>");
  if(AV.ad!=="all")cr.push(`объявление <b>${esc(adName(+AV.ad))}</b><span class="x" data-clr="ad">убрать</span>`);
  if(AV.prob!=="all"&&opts.showprob)cr.push(`проблема <b>${esc(PROB[AV.prob].l)}</b><span class="x" data-clr="prob">убрать</span>`);
  h+=`<div class="crumbs">Сейчас смотрим: ${cr.join(" › ")}</div></div>`;
  return h;
}
function wireBar(root){
  root.querySelectorAll("[data-av]").forEach(c=>c.addEventListener("click",()=>{AV[c.getAttribute("data-av")]=c.getAttribute("data-v");AV.limit=40;avRenderAll();}));
  root.querySelectorAll("[data-clr]").forEach(c=>c.addEventListener("click",()=>{AV[c.getAttribute("data-clr")]="all";AV.limit=40;avRenderAll();}));
}
function avGo(page,preset){Object.assign(AV,preset||{});AV.limit=40;avRenderAll();showPage(page);}
function showPage(p){document.querySelectorAll("#nav a").forEach(x=>x.classList.toggle("active",x.getAttribute("data-p")===p));document.querySelectorAll(".page").forEach(pg=>pg.classList.remove("active"));const el=document.getElementById("p-"+p);if(el)el.classList.add("active");closeDrawer();window.scrollTo(0,0);}
function wireGo(root){root.querySelectorAll("[data-go]").forEach(n=>n.addEventListener("click",e=>{e.stopPropagation();const pr=JSON.parse(n.getAttribute("data-pre")||"{}");avGo(n.getAttribute("data-go"),pr);}));
  root.querySelectorAll("[data-th]").forEach(n=>n.addEventListener("click",()=>openThread(n.getAttribute("data-th"))));}
function goAttr(page,pre){return `data-go="${page}" data-pre='${JSON.stringify(pre).replace(/'/g,"&#39;")}'`;}

/* ---- графики: сгруппированные столбцы по месяцам, одна ось ---- */
function monthBars(valFn,fmt,unit,ov){
  const cabs=cabsInScope(), mons=Object.keys(MON), W=Math.max(520,mons.length*cabs.length*34+80), H=190, pl=44, pb=26, pt=12;
  const vals={};let mx=0;
  cabs.forEach(cb=>mons.forEach(m=>{const v=valFn(avSel(Object.assign({cab:cb,mon:m},ov||{})));vals[cb+m]=v;if(v!=null&&v>mx)mx=v;}));
  mx=mx||1;const gw=(W-pl-10)/mons.length, bw=Math.min(26,(gw-14)/cabs.length);
  let s=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`;
  for(let i=0;i<=3;i++){const y=pt+(H-pt-pb)*(1-i/3);s+=`<line x1="${pl}" x2="${W-6}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-width="1"/><text x="${pl-6}" y="${y+4}" text-anchor="end">${fmt(mx*i/3)}</text>`;}
  mons.forEach((m,i)=>{const x0=pl+i*gw+(gw-bw*cabs.length-2*(cabs.length-1))/2;
    cabs.forEach((cb,j)=>{const v=vals[cb+m];if(v==null)return;const h=Math.max(2,(H-pt-pb)*v/mx),x=x0+j*(bw+2),y=H-pb-h;
      s+=`<path d="M${x},${H-pb} V${y+4} Q${x},${y} ${x+4},${y} H${x+bw-4} Q${x+bw},${y} ${x+bw},${y+4} V${H-pb} Z" fill="${CABC[cb]}" data-tip="<b>${cb}</b> · ${MON[m]}<br>${fmt(v)}${unit||""}" style="cursor:pointer" ${goAttr("avdlg",{cab:cb,mon:m})}/>`;});
    s+=`<text x="${pl+i*gw+gw/2}" y="${H-8}" text-anchor="middle">${MON[m].slice(0,3)}</text>`;});
  s+="</svg>";
  const leg=cabs.length>1?`<div class="legend">${cabs.map(c=>`<span><i style="background:${CABC[c]}"></i>${c}</span>`).join("")}</div>`:"";
  const tbl=`<details class="kv" style="margin-top:6px"><summary style="cursor:pointer">Показать таблицей</summary><table class="av" style="margin-top:6px"><thead><tr><th>Месяц</th>${cabs.map(c=>`<th class="n">${c}</th>`).join("")}</tr></thead><tbody>${mons.map(m=>`<tr><td>${MON[m]}</td>${cabs.map(c=>`<td class="n">${vals[c+m]==null?"-":fmt(vals[c+m])}${unit||""}</td>`).join("")}</tr>`).join("")}</tbody></table></details>`;
  return leg+`<div class="chart">${s}</div>`+tbl;
}
function hoursFmt(v){return v==null?"-":(v/3600).toFixed(v<36000?1:0).replace(".",",")+" ч";}

/* ---- Пульс ОП (экран РОПа) ---- */
function renderPulse(){
  const host=document.getElementById("p-pulse");const cabs=cabsInScope();
  const S={};cabs.forEach(c=>S[c]=avStats(avSel({cab:c})));
  const SA={};cabs.forEach(c=>SA[c]=avStats(avSel({cab:c,kind:"all"})));
  const colAll=(f)=>`<div class="duo ${cabs.length<2?"one":""}">${cabs.map(c=>`<div>${cabTag(c)}${f(SA[c],c)}</div>`).join("")}</div>`;
  const col=(f)=>`<div class="duo ${cabs.length<2?"one":""}">${cabs.map(c=>`<div>${cabTag(c)}${f(S[c],c)}</div>`).join("")}</div>`;
  const w=(t,sub,body,act)=>`<div class="w"><h3>${t}</h3><div class="wsub">${sub}</div>${body}${act?`<div class="wact">${act}</div>`:""}</div>`;
  const ads=D.av.ads.map((a,i)=>({i,a,L:avSel({ad:i})})).filter(x=>x.L.filter(c=>c.nc>0).length>=15).sort((a,b)=>b.L.length-a.L.length).slice(0,7);
  const probs=["slow","noprice","noquestion","abandoned","nofollow"];
  const heat=v=>`background:rgba(229,115,94,${Math.min(.85,v/100*1.1).toFixed(2)})`;
  const mtx=`<table class="av"><thead><tr><th style="min-width:210px">Объявление</th><th class="n">Диалогов</th>${probs.map(p=>`<th class="n" title="${esc(PROB[p].rule)}">${esc(SHORT[p])}</th>`).join("")}</tr></thead><tbody>`+
    ads.map(x=>{const T=x.L.filter(c=>c.nc>0);const pqn=T.filter(c=>c.pq).length;return `<tr><td><span class="lnk" ${goAttr("avdlg",{ad:String(x.i),prob:"all"})}>${esc(x.a.slice(0,46))}</span></td><td class="n">${T.length}</td>`+
      probs.map(p=>{const base=p==="noprice"?pqn:T.length;const v=pct(T.filter(c=>c.p.includes(p)).length,base);return `<td class="n"><span class="heat lnk" style="${heat(v)}" ${goAttr("avdlg",{ad:String(x.i),prob:p})} data-tip="${esc(x.a)}<br>${esc(PROB[p].l)}: ${P(v)}">${P(v)}</span></td>`;}).join("")+"</tr>";}).join("")+"</tbody></table>";
  host.innerHTML=`<div class="ph-kicker">Для РОПа</div><h1 class="pt">Пульс отдела продаж</h1>
    <p class="pt-sub">Главные показатели, по которым видно, где теряем клиентов. Любая цифра кликается и открывает список диалогов. Данные из выгрузки Авито по API, точное время каждого сообщения. ${OWNER_NOTE}</p>
    <div class="fresh"><b>Первая проверка эффекта: ${MILESTONE}.</b> Смотрят Иван и РОП. Сравниваем в таблице «По неделям» неделю 14-20.09 с неделей 28.09-04.10: медиана первого ответа, «не ответили вообще», «клиент задал вопрос последним», перезвон по оставленным телефонам.</div>
    ${avBar()}
    <div class="wgrid">
    ${w("Скорость первого ответа","Медиана: половина клиентов ждала меньше, половина дольше.",
      col(s=>`<div class="num2">${fL(s.med)}</div><div class="kv">за 15 мин: <b>${P(s.f15)}</b></div><div class="kv">днём (9-18): <b>${fL(s.day_med)}</b></div><div class="kv">вечер и ночь: <b>${fL(s.after18_med)}</b>, это ${P(s.after18_p)} обращений</div>`),
      "Сравнить с прошлой неделей в таблице «По неделям» ниже. Если хуже, разобрать на планёрке. Решить, кто отвечает на вечерние обращения.")}
    ${w("Не ответили вообще","Клиент написал, от нас ни слова.",
      col((s,c)=>`<div class="num2 lnk" ${goAttr("avdlg",{cab:c,prob:"noresp"})}>${s.noresp} <small>из ${s.n}</small></div><div class="kv">${P(s.noresp_p)} диалогов</div>`)+precTag("noresp"),
      "Раздать до обеда. Клик по цифре открывает список.")}
    ${w("Клиент задал вопрос последним","Его последний вопрос остался без ответа.",
      col((s,c)=>`<div class="num2 lnk" ${goAttr("avdlg",{cab:c,prob:"abandoned"})}>${s.abandoned}</div><div class="kv">${P(s.aband_p)} диалогов</div>`)+precTag("abandoned"),
      "Поручить ответ и после следующей выгрузки проверить, что список стал короче.")}
    ${w("Оставили телефон","Последним клиент прислал номер, в чате после этого тишина.",
      col((s,c)=>`<div class="num2 lnk" ${goAttr("avdlg",{cab:c,prob:"phoneleft"})}>${s.cnt("phoneleft")}</div><div class="kv">диалогов</div>`)+precTag("phoneleft"),
      "Проверить, что всем перезвонили. Звонок с мобильного Авито не видит.")}
    ${w("Спросили цену, суммы нет","Из тех, кто спросил про цену.",
      col((s,c)=>`<div class="num2 lnk" ${goAttr("avdlg",{cab:c,prob:"noprice"})}>${P(s.noprice_p)}</div><div class="kv">${s.noprice} из ${s.pq} спросивших</div>`)+precTag("noprice"),
      "Утвердить один ответ про цену с числом. Через неделю сравнить в таблице «По неделям».")}
    ${w("Звонки","Входящие через Авито и наши исходящие. Считаются все чаты, включая те, где клиент только звонил.",
      colAll((s,c)=>`<div class="num2 lnk" ${goAttr("avcalls",{cab:c})}>${s.calls.out} <small>исходящих</small></div><div class="kv">входящих принято: <b>${s.calls.in}</b></div><div class="kv">пропущено: <b>${s.calls.miss}</b></div><div class="kv">медиана разговора: <b>${s.call_med==null?"-":Math.round(s.call_med)+" с"}</b></div>`),
      "Ввести правило: на каждый пропущенный перезвонить в течение часа.")}
    ${w("Срок гарантии называют без опоры на базу","Менеджеры называют срок в годах, чаще «5 лет». В базе знаний: «по договору».",
      col((s,c)=>`<div class="num2 lnk" ${goAttr("avdlg",{cab:c,prob:"warranty"})}>${s.cnt("warranty")}</div><div class="kv">диалогов с гарантией в годах</div>`)+precTag("warranty"),
      "Говорить «гарантия по договору». Срок не называть, пока его не сверят с шаблоном договора.")}
    </div>
    <h2 class="sec"><span class="bar"></span>По неделям</h2>
    <p class="pt-sub" style="margin-bottom:10px">Последние 8 недель, понедельник - воскресенье. Неделя считается по первому сообщению клиента. Последняя неделя неполная: выгрузка сделана 22.09.</p>
    <div class="card tight chart">${weekTable()}</div>
    <h2 class="sec"><span class="bar"></span>Объявления и проблемы</h2>
    <p class="pt-sub" style="margin-bottom:10px">Доля диалогов с проблемой по каждому объявлению (от 15 диалогов). Чем краснее клетка, тем хуже. Клик открывает эти диалоги.</p>
    <div class="card tight chart">${mtx}</div>`;
  wireBar(host);wireGo(host);wireTips(host);
}

function weekTable(){
  const cabs=cabsInScope();const last=weekStart(EXPORT_TS);const weeks=[];for(let i=7;i>=0;i--)weeks.push(last-i*604800);
  const f=ts=>{const d=new Date((ts+10800)*1000);return d.toISOString().slice(8,10)+"."+d.toISOString().slice(5,7);};
  const row=(cb,w)=>{const L=avSel({cab:cb,mon:"all"}).filter(c=>c.t>=w&&c.t<w+604800&&c.nc>0);const s=avStats(L);
    return `<td class="n">${L.length}</td><td class="n">${fL(s.med)}</td><td class="n">${P(s.f15)}</td><td class="n">${s.noresp}</td><td class="n">${s.abandoned+s.cnt("phoneleft")}</td><td class="n">${s.pq?P(s.noprice_p):"-"}</td>`;};
  return `<table class="av"><thead><tr><th>Неделя</th><th>Кабинет</th><th class="n">Диалогов</th><th class="n">Медиана ответа</th><th class="n">За 15 мин</th><th class="n">Не ответили</th><th class="n">Вопрос или телефон без ответа</th><th class="n">Цена без суммы</th></tr></thead><tbody>`+
    weeks.slice().reverse().map(w=>cabs.map((cb,j)=>`<tr>${j===0?`<td rowspan="${cabs.length}">${f(w)} - ${f(w+6*86400)}${w===last?" (неполная)":""}</td>`:""}<td>${cabTag(cb)}</td>${row(cb,w)}</tr>`).join("")).join("")+"</tbody></table>";
}

/* ---- Скорость ---- */
function renderAvSpeed(){
  const host=document.getElementById("p-avspeed");const cabs=cabsInScope();
  const L=avSel(), T=L.filter(c=>c.nc>0);
  const bk=[[0,900,"до 15 мин"],[900,3600,"15-60 мин"],[3600,14400,"1-4 часа"],[14400,86400,"4-24 часа"],[86400,1e12,"больше суток"]];
  const dist=cabs.map(cb=>{const X=avSel({cab:cb}).filter(c=>c.nc>0),n=X.length;
    return `<div style="margin-bottom:8px">${cabTag(cb)}`+bk.map(([a,b,l])=>{const k=X.filter(c=>c.lag!=null&&c.lag>=a&&c.lag<b).length;const v=pct(k,n);return `<div class="pbar"><span style="font-size:11.5px;color:var(--muted)">${l}</span><div class="tr"><div class="fi" style="width:${Math.max(1,v)}%;background:${CABC[cb]}"></div></div><span class="vv">${P(v)} <span style="color:var(--muted2)">(${k})</span></span></div>`;}).join("")+
    (()=>{const k=X.filter(c=>c.p.includes("noresp")).length;return `<div class="pbar"><span style="font-size:11.5px;color:var(--bad)">нет ответа</span><div class="tr"><div class="fi" style="width:${Math.max(1,pct(k,n))}%;background:var(--bad)"></div></div><span class="vv">${P(pct(k,n))} <span style="color:var(--muted2)">(${k})</span></span></div>`;})()+`</div>`;}).join("");
  // тепловая карта: день недели x час, объём входящих, подсказка с медианой
  const cell={};T.forEach(c=>{const d=new Date((c.t+10800)*1000);const k=((d.getUTCDay()+6)%7)+"_"+d.getUTCHours();(cell[k]=cell[k]||[]).push(c.lag);});
  let mx=1;Object.values(cell).forEach(a=>{if(a.length>mx)mx=a.length;});
  let hm=`<div class="hm"><div></div>${Array.from({length:24},(_,h)=>`<div style="text-align:center">${h%3===0?h:""}</div>`).join("")}`;
  for(let d=0;d<7;d++){hm+=`<div class="hl">${WD[d]}</div>`;for(let h=0;h<24;h++){const a=cell[d+"_"+h]||[];const md=med(a.filter(x=>x!=null));const al=a.length?(.12+.88*a.length/mx):0.03;
    hm+=`<div class="c" style="background:rgba(57,135,229,${al.toFixed(2)})" data-tip="${WD[d]}, ${h}:00-${h+1}:00<br>обращений: <b>${a.length}</b><br>медиана ответа: <b>${fL(md)}</b>"></div>`;}}
  hm+="</div>";
  host.innerHTML=`<div class="ph-kicker">Аналитика Авито</div><h1 class="pt">Скорость первого ответа</h1>
    <p class="pt-sub">Сколько клиент ждал от первого своего сообщения до первого ответа живого человека. Автоответы и напоминания робота Авито ответом не считаются.</p>
    ${avBar()}
    <h2 class="sec"><span class="bar"></span>Медиана по месяцам</h2>
    <div class="card">${monthBars(X=>med(X.filter(c=>c.nc>0).map(c=>c.lag).filter(x=>x!=null)),hoursFmt,"")}<div class="kv">Столбец кликается: откроются диалоги этого месяца.</div></div>
    <h2 class="sec"><span class="bar"></span>Доля ответов за 15 минут по месяцам</h2>
    <div class="card">${monthBars(X=>{const T=X.filter(c=>c.nc>0);return T.length?pct(T.filter(c=>c.lag!=null&&c.lag<=900).length,T.length):null;},v=>Math.round(v)+"%","")}</div>
    <h2 class="sec"><span class="bar"></span>Как быстро отвечаем</h2>
    <div class="card">${dist}</div>
    <h2 class="sec"><span class="bar"></span>Когда пишут клиенты</h2>
    <p class="pt-sub" style="margin-bottom:8px">Чем ярче клетка, тем больше обращений в этот час. Наведите или нажмите на клетку, чтобы увидеть, сколько обычно ждали ответа (медиана). Время московское.</p>
    <div class="card chart" style="min-width:0"><div style="min-width:560px">${hm}</div></div>`;
  wireBar(host);wireGo(host);wireTips(host);
}

/* ---- Типовые проблемы ---- */
function renderAvProblems(){
  const host=document.getElementById("p-avprob");const cabs=cabsInScope();
  const S={};cabs.forEach(c=>{const X=avSel({cab:c}).filter(x=>x.nc>0);S[c]={X,n:X.length,pq:X.filter(x=>x.pq).length};});
  const all=avSel().filter(x=>x.nc>0);
  const order=PORDER.slice().sort((a,b)=>all.filter(c=>c.p.includes(b)).length-all.filter(c=>c.p.includes(a)).length);
  const rows=order.map(p=>{
    const bars=cabs.map(c=>{const base=p==="noprice"?S[c].pq:S[c].n;const k=S[c].X.filter(x=>x.p.includes(p)).length;const v=pct(k,base);
      return `<div class="pbar"><span>${cabTag(c)}</span><div class="tr"><div class="fi" style="width:${Math.max(1,v)}%;background:${CABC[c]}"></div></div><span class="vv lnk" ${goAttr("avdlg",{cab:c,prob:p})}>${k} · ${P(v)}</span></div>`;}).join("");
    return `<div class="prb"><div class="top"><b>${esc(PROB[p].l)} ${precTag(p)}</b><span class="btn ghost" style="padding:4px 10px;font-size:12px" ${goAttr("avdlg",{prob:p})}>Показать диалоги</span></div>
      <div class="rule">Как считаем: ${esc(PROB[p].rule)}${p==="noprice"?" Доля от тех, кто спросил цену.":" Доля от диалогов, где клиент писал текстом."}</div>${bars}<div class="todo">Что делать: ${esc(PROB[p].todo)}</div></div>`;}).join("");
  host.innerHTML=`<div class="ph-kicker">Аналитика Авито</div><h1 class="pt">Типовые проблемы</h1>
    <p class="pt-sub">Каждая проблема найдена программой по правилу, а не на глаз. Правило написано под названием. Отсортировано: вверху самые частые.</p>
    ${avBar()}${rows}`;
  wireBar(host);wireGo(host);
}

/* ---- Объявления ---- */
function renderAvAds(){
  const host=document.getElementById("p-avads");
  const rows=D.av.ads.map((a,i)=>{const L=avSel({ad:i});const T=L.filter(c=>c.nc>0);if(!L.length)return null;
    const pq=T.filter(c=>c.pq).length;
    return {i,a,n:L.length,t:T.length,cold:L.filter(c=>c.kind==="cold").length,med:med(T.map(c=>c.lag).filter(x=>x!=null)),
      np:pct(T.filter(c=>c.p.includes("noprice")).length,pq),ab:pct(T.filter(c=>c.p.includes("abandoned")).length,T.length),nf:pct(T.filter(c=>c.p.includes("nofollow")).length,T.length),
      g:L.filter(c=>c.cab==="OLD-G").length,b:L.filter(c=>c.cab==="NEW-B").length};}).filter(Boolean).sort((x,y)=>y.n-x.n);
  host.innerHTML=`<div class="ph-kicker">Аналитика Авито</div><h1 class="pt">Объявления</h1>
    <p class="pt-sub">С какого объявления пришёл клиент и как с ним поговорили. Клик по строке открывает диалоги этого объявления.</p>
    ${avBar()}
    <div class="card tight chart"><table class="av"><thead><tr><th>Объявление</th><th class="n">Всего чатов</th><th class="n">OLD-G</th><th class="n">NEW-B</th><th class="n">Клиент писал</th><th class="n">Медиана ответа</th><th class="n">Цена не названа</th><th class="n">Брошены</th><th class="n">Нет дожима</th></tr></thead><tbody>
    ${rows.map(r=>`<tr class="click" ${goAttr("avdlg",{ad:String(r.i),prob:"all"})}><td>${esc(r.a)}</td><td class="n">${r.n}</td><td class="n">${r.g}</td><td class="n">${r.b}</td><td class="n">${r.t}</td><td class="n">${fL(r.med)}</td><td class="n">${P(r.np)}</td><td class="n">${P(r.ab)}</td><td class="n">${P(r.nf)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="kv">«Всего чатов» учитывает фильтр «Диалоги». «Цена не названа» считается от тех, кто спросил цену.</p>`;
  wireBar(host);wireGo(host);
}

/* ---- Звонки ---- */
function renderAvCalls(){
  const host=document.getElementById("p-avcalls");const cabs=cabsInScope();
  const S={};cabs.forEach(c=>S[c]=avStats(avSel({cab:c,kind:"all"})));
  const L=avSel({kind:"all"}).filter(c=>c.cin||c.cout||c.cmiss).sort((a,b)=>b.last-a.last);
  host.innerHTML=`<div class="ph-kicker">Аналитика Авито</div><h1 class="pt">Звонки</h1>
    <p class="pt-sub">Звонки через Авито: клиент нажал «позвонить» в объявлении. И наши звонки клиенту.</p>
    ${avBar({nokind:true})}
    <div class="wgrid">${cabs.map(c=>`<div class="w"><h3>${cabTag(c)}</h3><div class="num2">${S[c].calls.out} <small>исходящих за полгода</small></div>
      <div class="kv">входящих принято: <b>${S[c].calls.in}</b></div><div class="kv">пропущено: <b>${S[c].calls.miss}</b></div>
      <div class="kv">медиана разговора: <b>${S[c].call_med==null?"-":Math.round(S[c].call_med)+" с"}</b></div><div class="kv">диалогов со звонком: <b>${avSel({cab:c,kind:"all"}).filter(x=>x.cin||x.cmiss||x.cout).length}</b></div></div>`).join("")}</div>
    <div class="note-simple"><b>Главное.</b> Через Авито менеджеры почти не звонят сами: исходящих за полгода 1 в OLD-G и 0 в NEW-B. Звонки с мобильного Авито не видит, их надо проверять по телефону или в Bitrix24. Пропущенный входящий без перезвона - это клиент, который уже набрал нас и ушёл.</div>
    <h2 class="sec"><span class="bar"></span>Диалоги со звонками (${L.length})</h2>
    ${L.slice(0,60).map(dcard).join("")}`;
  wireBar(host);wireGo(host);
}

/* ---- Холодная рассылка ---- */
function renderAvCold(){
  const host=document.getElementById("p-avcold");const cabs=cabsInScope();
  const X=cabs.map(c=>{const L=avSel({cab:c,kind:"all"});const sent=L.filter(x=>x.kind==="cold"||x.kind==="cold_reply").length;const rep=L.filter(x=>x.kind==="cold_reply").length;return {c,sent,rep};});
  host.innerHTML=`<div class="ph-kicker">Аналитика Авито</div><h1 class="pt">Холодная рассылка</h1>
    <p class="pt-sub">Сообщение тем, кто смотрел объявление, но не написал: «Добрый день! Вы просматривали наше объявление...». Считается отдельно от входящих, иначе портит скорость ответа.</p>
    ${avBar({nokind:true})}
    <div class="wgrid">${X.map(x=>`<div class="w"><h3>${cabTag(x.c)}</h3><div class="num2">${P(pct(x.rep,x.sent))} <small>ответили</small></div><div class="kv">отправлено: <b>${x.sent}</b></div><div class="kv">клиент ответил: <b class="lnk" ${goAttr("avdlg",{cab:x.c,kind:"cold_reply",prob:"all"})}>${x.rep}</b></div></div>`).join("")}</div>
    <h2 class="sec"><span class="bar"></span>Сколько отправили по месяцам</h2>
    <div class="card">${monthBars(L=>{const k=L.filter(c=>c.kind==="cold"||c.kind==="cold_reply").length;return k||null;},v=>Math.round(v)+""," отправлено",{kind:"all"})}</div>`;
  wireBar(host);wireGo(host);wireTips(host);
}

/* ---- Все диалоги (API) ---- */
function dcard(c){
  const M=D.av.msgs[c.id]||[];const lc=lastClientText(c);
  const hot=["noresp","abandoned","noprice"];
  return `<div class="dcard" data-th="${esc(c.id)}"><div class="h">${cabTag(c.cab)}<b>${esc(firstName(c.cn))}</b><span>${fD(c.t)}</span><span>· ${esc(adName(c.ad).slice(0,40))}</span>${c.lag!=null?`<span>· первый ответ через ${fL(c.lag)}</span>`:""}${c.cin||c.cmiss?`<span>· звонок</span>`:""}${c.both?`<span>· писал в оба кабинета</span>`:""}${c.phone?`<span>· оставил телефон</span>`:""}${c.b2b?`<span>· партнёр или опт</span>`:""}${c.kind==="vendor"?`<span>· не клиент</span>`:""}${c.compl?`<span style="color:var(--bad)">· жалоба</span>`:""}</div>
    ${lc?`<div class="lastc">«${esc(lc.slice(0,180))}${lc.length>180?"...":""}»</div>`:""}
    <div class="pp">${c.p.map(p=>`<span class="${hot.includes(p)?"hot":""}">${esc(PROB[p].l)}</span>`).join("")}${c.p.length?"":`<span>без замечаний</span>`}<span>${M.length} сообщ.</span></div></div>`;
}
function renderAvDlg(){
  const host=document.getElementById("p-avdlg");
  let L=avSel();
  if(AV.prob!=="all")L=L.filter(c=>c.p.includes(AV.prob));
  if(AV.flag==="call")L=L.filter(c=>c.cin||c.cmiss||c.cout);
  if(AV.flag==="last")L=L.filter(c=>c.p.includes("abandoned"));
  if(AV.flag==="both")L=L.filter(c=>c.both);
  if(AV.flag==="phone")L=L.filter(c=>c.phone);
  if(AV.flag==="compl")L=L.filter(c=>c.compl);
  if(AV.flag==="b2b")L=L.filter(c=>c.b2b);
  if(AV.flag==="clean")L=L.filter(c=>c.nc>0&&!c.p.length);
  if(AV.q.trim()){const q=AV.q.toLowerCase();L=L.filter(c=>(c.cn+" "+(D.av.msgs[c.id]||[]).map(m=>m[3]).join(" ")).toLowerCase().includes(q));}
  const S={recent:(a,b)=>b.t-a.t,wait:(a,b)=>(b.lag==null?-1:b.lag)-(a.lag==null?-1:a.lag),worst:(a,b)=>b.p.length-a.p.length||b.t-a.t,old:(a,b)=>a.t-b.t};
  L=L.slice().sort(S[AV.sort]||S.recent);
  const probOpts=[["all","Любая"]].concat(PORDER.map(p=>[p,PROB[p].l]));
  const adOpts=[["all","Все объявления"]].concat(D.av.ads.map((a,i)=>[String(i),a.slice(0,50)]));
  host.innerHTML=`<div class="ph-kicker">Разборы</div><h1 class="pt">Все диалоги Авито</h1>
    <p class="pt-sub">${avAll().length} переписок из двух кабинетов, каждое сообщение с точным временем. Нажмите на карточку, чтобы открыть переписку целиком.</p>
    ${avBar({showprob:true})}
    <div class="filterbar">
      <div class="frow"><span class="fl">Проблема</span><select class="fsearch" id="avprob" style="max-width:320px">${probOpts.map(([v,l])=>`<option value="${v}" ${AV.prob===v?"selected":""}>${esc(l)}</option>`).join("")}</select>
        <select class="fsearch" id="avad" style="max-width:320px">${adOpts.map(([v,l])=>`<option value="${v}" ${String(AV.ad)===v?"selected":""}>${esc(l)}</option>`).join("")}</select></div>
      ${chipRow("Отметки","flag",[["all","Все"],["compl","Жалоба"],["last","Клиент писал последним"],["phone","Оставил телефон"],["call","Был звонок"],["b2b","Партнёр или опт"],["both","Писал в оба кабинета"],["clean","Без замечаний"]])}
      <div class="frow"><span class="fl">Порядок</span>${[["recent","Сначала свежие"],["wait","Дольше ждали ответа"],["worst","Больше проблем"],["old","Сначала старые"]].map(([v,l])=>`<span class="fchip ${AV.sort===v?"on":""}" data-av="sort" data-v="${v}">${l}</span>`).join("")}</div>
      <div class="frow"><span class="fl">Поиск</span><input class="fsearch" id="avq" placeholder="слово в переписке или имя клиента" value="${esc(AV.q)}"></div>
    </div>
    <div class="fcount">Найдено: <b>${L.length}</b></div>
    <div id="avlist">${L.slice(0,AV.limit).map(dcard).join("")}</div>
    ${L.length>AV.limit?`<div class="morewrap"><button class="morebtn" id="avmore">Показать ещё ${Math.min(40,L.length-AV.limit)}</button></div>`:""}`;
  wireBar(host);wireGo(host);
  host.querySelector("#avprob").addEventListener("change",e=>{AV.prob=e.target.value;AV.limit=40;avRenderAll();});
  host.querySelector("#avad").addEventListener("change",e=>{AV.ad=e.target.value;AV.limit=40;avRenderAll();});
  const q=host.querySelector("#avq");q.addEventListener("input",e=>{AV.q=e.target.value;AV.limit=40;clearTimeout(window.__avq);window.__avq=setTimeout(()=>{renderAvDlg();const n=document.getElementById("avq");n.focus();n.setSelectionRange(n.value.length,n.value.length);},250);});
  const mb=host.querySelector("#avmore");if(mb)mb.addEventListener("click",()=>{AV.limit+=40;renderAvDlg();});
}

/* ---- Переписка целиком ---- */
function openThread(id){
  const c=avAll().find(x=>x.id===id);if(!c)return;const M=D.av.msgs[id]||[];
  const PQ=/(сколько|стоимост|цена|цены|ценник|почём|почем|прайс)/i;
  let h=`<button class="close" onclick="closeThread()">Закрыть</button>
    <div class="path">${c.cab} › ${MON[avMon(c)]||"до апреля"} › ${esc(adName(c.ad))} › диалог</div>
    <h2 style="font-size:20px;margin:4px 0 6px">${esc(c.cn||"Клиент")}</h2>
    <div class="kv">${cabTag(c.cab)} · ${esc(KIND[c.kind])} · начало ${fD(M.length?M[0][0]:c.t)} · ${c.lag!=null?"первый ответ через <b>"+fL(c.lag)+"</b>":(c.nc>0?"<b>ответа не было</b>":"клиент не писал текстом")}</div>
    <div style="margin:12px 0"><a class="btn" href="https://www.avito.ru/profile/messenger/channel/${encodeURIComponent(c.id)}" target="_blank" rel="noopener">Открыть в Авито</a></div>`;
  if(c.p.length)h+=`<div class="card tight" style="margin-top:6px">${c.p.map(p=>`<div style="margin:4px 0"><b style="color:var(--bad)">${esc(PROB[p].l)}.</b> <span style="color:var(--muted);font-size:13px">${esc(PROB[p].rule)}</span><div class="todo" style="color:var(--ok);font-size:13px">Как надо: ${esc(PROB[p].todo)}</div></div>`).join("")}</div>`;
  h+=`<div class="tl">`;let prev=null,prevWho=null;
  M.forEach(m=>{const [ts,who,tp,tx]=m;
    if(prev!=null&&(who==="c"||who==="m")&&ts-prev>=3600){const bad=prevWho==="c"&&who==="m";h+=`<div class="gap ${bad?"bad":""}">${bad?"клиент ждал ответа ":"прошло "}${fL(ts-prev)}</div>`;}
    const icon=tp==="c"?"☎ ":"";const flag=(who==="c"&&c.p.includes("noprice")&&PQ.test(tx))?" flag":"";
    if((who==="c"||who==="m")&&who!==prevWho)h+=`<div class="whoami ${who==="m"?"r":""}">${who==="m"?"Glass Memory ("+c.cab+")":"Клиент"}</div>`;
    h+=`<div class="bub ${who}${flag}">${who==="a"?"Автоответ: ":""}${icon}${esc(tx)}<span class="tm">${fD(ts)}</span></div>`;
    if(who==="c"||who==="m"){prev=ts;prevWho=who;}});
  h+=`</div>`;
  const t=document.getElementById("thread");t.querySelector(".pan").innerHTML=h;t.classList.add("open");t.querySelector(".pan").scrollTop=0;
}
function closeThread(){document.getElementById("thread").classList.remove("open");}

/* ---- Сегодня (экран менеджера) ---- */
function expTs(cab){return Math.floor(Date.parse(D.av.recon[cab].exported)/1000);}
function renderToday(){
  const host=document.getElementById("p-today");
  const now=Math.max(Math.floor(Date.now()/1000),EXPORT_TS);
  const since=AV.today==="all"?0:EXPORT_TS-AV.today*86400;
  const base=avAll().filter(c=>(AV.tcab==="all"||c.cab===AV.tcab)&&c.nc>0&&c.kind!=="vendor"&&c.lw==="c"&&(c.lc||c.t)>=since);
  const st=[
    {k:"compl",t:"Жалоба клиента",why:"Клиент пишет о проблеме с изделием. Это первое, на что нужно ответить.",hint:"Извинитесь, попросите фото, скажите, когда перезвоните. Передайте РОПу."},
    {k:"noresp",t:"Клиент ждёт ответа",why:"Написал нам, а живого ответа не получил.",hint:"Назовите клиента по имени, извинитесь за паузу и ответьте на его вопрос. В конце задайте один вопрос: размер или фото."},
    {k:"abandoned",t:"Клиент задал вопрос последним",why:"Мы отвечали, клиент спросил ещё, и тишина.",hint:"Ответьте на его последнее сообщение. Если вопрос про цену, назовите «от» и за какой размер."},
    {k:"phoneleft",t:"Оставил телефон",why:"Прислал номер, после этого в чате тишина. Звонок с мобильного Авито не видит.",hint:"Проверьте, что клиенту перезвонили. Если нет, позвоните сегодня."},
    {k:"noprice",t:"Спросил цену, суммы не было",why:"Спросил, сколько стоит, и написал последним.",hint:"Назовите цену «от» и за какой размер, по утверждённому ответу отдела. Спросите размер, чтобы посчитать точно."}];
  const seen=new Set();
  const stacks=st.map(x=>{const L=base.filter(c=>(x.k==="compl"?c.compl:c.p.includes(x.k))&&!seen.has(c.id)).sort((a,b)=>(b.lc||b.t)-(a.lc||a.t));L.forEach(c=>seen.add(c.id));return Object.assign({L},x);});
  const total=stacks.reduce((a,x)=>a+x.L.length,0);
  const age=d=>Math.floor((now-d)/86400);
  const cabs=AV.tcab==="all"?CABS:[AV.tcab];
  const fresh=cabs.map(c=>`${c}: ${fD(expTs(c))}`).join(", ");
  const old=Math.max(...cabs.map(c=>age(expTs(c))));
  const card=(c,x)=>{const lc=lastClientText(c);const t=c.lc||c.t;
    return `<div class="tq"><div class="nm">${esc(firstName(c.cn))} ${cabTag(c.cab)}</div><div class="wait">написал ${fD(t)}, ${age(t)<1?"меньше суток назад":age(t)+" дн назад"}</div>
      ${lc?`<div class="said">«${esc(lc.slice(0,220))}${lc.length>220?"...":""}»</div>`:""}
      <div class="hint">Что сделать: ${esc(x.hint)}</div>
      <div class="meta">${esc(adName(c.ad))}</div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="https://www.avito.ru/profile/messenger/channel/${encodeURIComponent(c.id)}" target="_blank" rel="noopener">Открыть в Авито</a><span class="btn ghost" data-th="${esc(c.id)}">Посмотреть переписку</span></div></div>`;};
  const opts=(dim,arr)=>arr.map(([v,l])=>`<span class="fchip bigchip ${String(AV[dim])===String(v)?"on":""}" data-av="${dim}" data-v="${v}">${l}</span>`).join("");
  host.innerHTML=`<div class="ph-kicker">Для менеджера</div><h1 class="pt">Сегодня</h1>
    <p class="pt-sub" style="font-size:16px">Кому ответить в первую очередь. Здесь только чаты, где последним написал клиент.</p>
    <div class="fresh ${old>=1?"stale":""}">Данные выгрузки: <b>${fresh}</b>. ${old>=1?`С выгрузки прошло <b>${old} дн</b>. Перед ответом откройте чат в Авито: возможно, клиенту уже ответили.`:"Перед ответом откройте чат в Авито: возможно, клиенту уже ответили."} ${OWNER_NOTE}</div>
    <div class="filterbar"><div class="frow"><span class="fl">Кабинет</span>${opts("tcab",[["all","Оба"],["OLD-G","OLD-G · старый"],["NEW-B","NEW-B · новый"]])}</div>
    <div class="frow"><span class="fl">Клиент писал</span>${opts("today",[[3,"за 3 дня"],[14,"за 2 недели"],[30,"за месяц"],["all","за всё время"]])}</div></div>
    <p style="font-size:18px;margin:6px 0 0">Всего нужно ответить: <span class="count-pill ${total?"":"ok"}">${total}</span></p>
    ${stacks.map(x=>`<div class="stack"><h2>${x.t} <span class="count-pill ${x.L.length?"":"ok"}">${x.L.length}</span></h2><div class="why">${x.why}</div>
      ${x.L.slice(0,10).map(c=>card(c,x)).join("")}${x.L.length>10?`<p class="kv" style="font-size:15px">и ещё ${x.L.length-10}: <span class="lnk" ${goAttr("avdlg",{cab:AV.tcab,prob:x.k,mon:"all",kind:"in"})}>показать все</span></p>`:""}${x.L.length?"":`<p style="color:var(--ok)">За выбранный срок здесь пусто.</p>`}</div>`).join("")}`;
  host.querySelectorAll("[data-av]").forEach(c=>c.addEventListener("click",()=>{const d=c.getAttribute("data-av"),v=c.getAttribute("data-v");AV[d]=(d==="today"&&v!=="all")?+v:v;renderToday();}));
  wireGo(host);
}

/* ---- О данных ---- */
function renderAvData(){
  const host=document.getElementById("p-avdata");const R=D.av.recon;
  const n=c=>avAll().filter(x=>x.cab===c);
  host.innerHTML=`<div class="ph-kicker">Справка</div><h1 class="pt">Откуда цифры</h1>
    <p class="pt-sub">Все разделы «Сегодня», «Пульс ОП», «Аналитика Авито» и «Все диалоги» считаются из одной выгрузки. Здесь написано, что в ней есть, как считаем и что поменялось по сравнению с разбором по скриншотам.</p>
    <h2 class="sec"><span class="bar"></span>Источники</h2>
    <div class="card tight chart"><table class="av"><thead><tr><th>Кабинет</th><th>Аккаунт Авито</th><th class="n">Чатов в JSON</th><th class="n">Сообщений</th><th class="n">Строк в CSV</th><th>Выгружено</th></tr></thead><tbody>
      ${CABS.map(c=>`<tr><td>${cabTag(c)}</td><td>${c==="OLD-G"?"GLASS MEMORY (старый)":"Glass Memory (новый)"}</td><td class="n">${R[c].json_chats}</td><td class="n">${R[c].json_msgs}</td><td class="n">${R[c].csv_rows}</td><td>${fD(Math.floor(Date.parse(R[c].exported)/1000))} МСК</td></tr>`).join("")}
    </tbody></table></div>
    <div class="note-simple"><b>Сверка.</b> У OLD-G число чатов в JSON и CSV совпадает: ${R["OLD-G"].json_chats} = ${R["OLD-G"].csv_rows}. У NEW-B CSV обрывается на ${R["NEW-B"].csv_max}, поэтому в нём ${R["NEW-B"].csv_rows} строк против ${R["NEW-B"].json_chats} в JSON. Чатов, которых нет в CSV, ${R["NEW-B"].json_chats-R["NEW-B"].csv_rows}: созданы в сентябре ${R["NEW-B"].miss.sep}, с 22 по 31 августа ${R["NEW-B"].miss.late_aug}, в середине августа ${R["NEW-B"].miss.mid}, раньше апреля ${R["NEW-B"].miss.old}. Почему часть августовских чатов не попала в CSV, по файлам установить нельзя. Везде на сайте используется JSON.<br><br><b>Период.</b> Выгрузка за 31.03 - 22.09.2026, но в неё попали и старые чаты, где клиент писал раньше: OLD-G ${R["OLD-G"].before_apr}, NEW-B ${R["NEW-B"].before_apr}. Поэтому сумма по месяцам чуть меньше итога «Всё время».<br><br><b>Глубина.</b> Из-за ограничения выгрузки в каждом чате хранится не больше 100 последних сообщений.</div>
    <p class="kv">${OWNER_NOTE} Первая проверка эффекта: ${MILESTONE}.</p>
    <h2 class="sec"><span class="bar"></span>Что считаем и как</h2>
    <div class="card"><ul class="clean">
      <li><b>Входящий диалог</b> - клиент написал нам сам или ответил на рассылку. Холодная рассылка без ответа (${avAll().filter(c=>c.kind==="cold").length} чатов) в скорость и проблемы не входит.</li>
      <li><b>Не клиенты</b> - поставщики, соискатели и тестовые сообщения (${avAll().filter(c=>c.kind==="vendor").length} чатов). Их видно в «Все диалоги» при выборе «Все», в цифры они не входят. Партнёрские и оптовые запросы (${avAll().filter(c=>c.b2b&&c.kind!=="vendor").length}) остаются клиентами с отметкой «партнёр или опт».</li>
      <li><b>Удалённые сообщения</b> клиента («Сообщение удалено») не считаются его текстом.</li>
      <li><b>Первый ответ</b> - от первого текстового сообщения клиента до первого сообщения живого человека (текст, фото, ссылка, файл). Автоответы («Вам ответит первый освободившийся...», ${avAll().reduce((a,c)=>a+(D.av.msgs[c.id]||[]).filter(m=>m[1]==="a").length,0)} шт.), звонки и напоминания робота Авито ответом не считаются.</li>
      <li><b>Диалог со звонком без текста</b> - клиент только позвонил. Если звонок принят, это ответ, в «не ответили» такой диалог не попадает.</li>
      <li><b>Медиана</b> - половина клиентов ждала меньше, половина дольше. Среднее не используем: один ответ через неделю испортил бы всё.</li>
      ${PORDER.map(p=>`<li><b>${esc(PROB[p].l)}</b> - ${esc(PROB[p].rule)}${PRECISION[p]?` <span class="tag data">проверено вручную: ${PRECISION[p]}</span>`:` <span class="tag hyp">точность вручную не замерялась</span>`}</li>`).join("")}
    </ul></div>
    <h2 class="sec"><span class="bar"></span>Чего в данных нет</h2>
    <div class="card"><p><b>Кто из менеджеров отвечал.</b> Авито отдаёт одного отправителя на весь кабинет. В текстах в обоих кабинетах представляются одни и те же люди, поэтому разделить цифры по менеджерам нельзя. Для этого нужен график смен или связка с Bitrix24. Поэтому цифры Авито по менеджерам не делятся. Профили в разделе «Менеджеры (Bitrix)» построены по разборам штатного аналитика по сделкам Bitrix24, это отдельный источник, с цифрами Авито он не связан.</p>
      <p style="margin-top:8px"><b>Сделки и деньги.</b> Чем закончился разговор, в Авито не видно. Раздел про деньги вернётся после связки с Bitrix24.</p></div>
    <h2 class="sec"><span class="bar"></span>Что исправлено</h2>
    <div class="card"><ul class="clean">
      <li><b>Скорость ответа.</b> По скриншотам выходило «в среднем 46 минут». Точное время из API: медиана OLD-G ${fL(avStats(avSel({cab:"OLD-G",mon:"all",kind:"in",ad:"all"})).med)}, NEW-B ${fL(avStats(avSel({cab:"NEW-B",mon:"all",kind:"in",ad:"all"})).med)}. Скриншоты показывали в основном удачные диалоги.</li>
      <li><b>Обращение по имени.</b> По скриншотам было 0,6%. По API, среди клиентов с русским именем в профиле: OLD-G ${P(nameShare("OLD-G"))}, NEW-B ${P(nameShare("NEW-B"))}.</li>
      <li><b>Цена.</b> По скриншотам «не назвали цену» было 48% от всех диалогов. По API считаем честнее: от тех, кто спросил цену. OLD-G ${avStats(avSel({cab:"OLD-G",mon:"all",kind:"in",ad:"all"})).noprice_p}%, NEW-B ${avStats(avSel({cab:"NEW-B",mon:"all",kind:"in",ad:"all"})).noprice_p}%.</li>
    </ul></div>
    <p class="kv">Разделы в группе «Архив» построены по скриншотам июля и оставлены для сравнения. Для решений используйте цифры отсюда.</p>`;
}

function nameShare(cab){const L=avAll().filter(c=>c.cab===cab&&c.nc>0&&c.nm>0&&/^[А-ЯЁ][а-яё]{2,}$/.test((c.cn||"").trim().split(/\s+/)[0]||""));return pct(L.filter(c=>!c.p.includes("noname")).length,L.length);}
function avRenderAll(){renderToday();renderPulse();renderAvSpeed();renderAvProblems();renderAvAds();renderAvCalls();renderAvCold();renderAvDlg();renderAvData();}
function archiveBanners(){["teardowns","actions","scripts"].forEach(p=>{const el=document.getElementById("p-"+p);if(!el||el.querySelector(".archive-banner"))return;const b=document.createElement("div");b.className="archive-banner";b.innerHTML=`Раздел составлен в июле по скриншотам переписок. Цифры в нём не пересчитаны по выгрузке API. Актуальные цифры: <a onclick="showPage('pulse')">Пульс ОП</a>.`;el.prepend(b);});
  ["overview","problems","speed","quality","funnel","dialogues"].forEach(p=>{const el=document.getElementById("p-"+p);if(!el||el.querySelector(".archive-banner"))return;const b=document.createElement("div");b.className="archive-banner";b.innerHTML=`Архив. Цифры посчитаны по скриншотам июля и частью неточны. Актуальные цифры по API: <a onclick="showPage('pulse')">Пульс ОП</a>, <a onclick="showPage('avdata')">откуда цифры</a>.`;el.prepend(b);});}
