// Smoke СВОД v2: исполняем собранный HTML, пересчитываем цифры независимо, кликаем
// интерактив, проверяем запрещённые формулировки. Guard'ы числовые (уроки ФЕНИКС v1):
// presence-чеки без пересчёта не принимаются.
import {readFileSync,writeFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync('public/svod2.html','utf-8');
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',beforeParse(w){w.addEventListener('error',e=>errors.push(e.message));}});
const d=dom.window.document;
const t=id=>d.getElementById(id)?.textContent||'';
let fail=0,total=0;const ck=(n,ok,extra)=>{total++;console.log((ok?'OK  ':'FAIL')+' '+n+(ok||extra==null?'':' | '+extra));if(!ok)fail++;};
const DATA=dom.window.eval('DATA');
const HIST=DATA.hist,last=HIST[HIST.length-1];
const BADQ=['waiting','ready','silent','nostep','nopush','fakedone','internal','overdue','promise','refuse','objection','lowprob'];

// --- KPI: воронка по умолчанию (неделя разбора) сверяется пересчётом когорты
const P=dom.window.eval('PERIOD');
ck('дефолтный период = окно разбора',P.key==='win');
const sel=DATA.cohort.filter(c=>c.c>=P.from&&c.c<=P.to);
const kpiTxt=t('kpis');
ck('воронка: создано пересчиталось',kpiTxt.includes(String(sel.length)),`ожидалось ${sel.length}`);
ck('воронка: предоплаты пересчитались',kpiTxt.includes(String(sel.filter(c=>c.sold).length)+' Предоплата'),`ожидалось ${sel.filter(c=>c.sold).length}`);
// риск = сумма очередей снимка на конец периода
let riskRub=0;for(const k of BADQ){const q=last.queues[k];if(q)riskRub+=q.money;}
const fmtR=dom.window.eval('fmtR');
ck('под риском = сумма очередей снимка',kpiTxt.includes(fmtR(riskRub)),fmtR(riskRub));
ck('плитки Продано/План отсутствуют (до сверки с учётом)',!kpiTxt.includes('Продано за')&&!kpiTxt.includes('План на'));
// --- команда
const rows=d.querySelectorAll('#team tr').length-1;
const expected=DATA.managers.filter(m=>m.role!=='office'&&last.mgrs[m.mgr]).length;
ck('команда: все продавцы из снимка',rows===expected,`${rows} vs ${expected}`);
ck('СРАВНИТЬ включён по умолчанию (чипы дельт)',d.querySelectorAll('#team .cmp').length>0);
// дельта одного менеджера = пересчёт из истории
const cd=dom.window.eval('cmpDay()');
const anyM=DATA.managers.find(m=>m.role!=='office'&&last.mgrs[m.mgr]?.rating!=null&&cd&&cd.mgrs[m.mgr]?.rating!=null);
if(anyM){const delta=(last.mgrs[anyM.mgr].rating-cd.mgrs[anyM.mgr].rating).toFixed(1);
  ck('дельта рейтинга сходится с историей',t('team').includes((delta>0?'+':'')+delta),`ожидалась ${delta} у ${anyM.mgr}`);}
// свечи кликабельны и дают разбор дня с датой дд.мм.гггг
const candle=d.querySelector('#team rect[data-day]');
ck('свечи менеджеров отрисованы',!!candle);
if(candle){candle.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));
  ck('клик по свече - разбор дня',/Разбор дня \d{2}\.\d{2}\.\d{4}/.test(t('mgr-day-ann')));}
// мини-дашборд
dom.window.eval('expand(0)');
ck('мини-дашборд открылся',t('team').includes('Личная воронка'));
ck('мини-дашборд: топ-5 сделок или пусто честно',t('team').includes('Сделки, которые ждут')||t('team').includes('в проблемных очередях пусто'));
dom.window.eval('expand(0)');
// --- очереди
const qcells=d.querySelectorAll('#queues .qcell').length;
ck('очереди отрисованы',qcells>=6,qcells);
const qr=d.querySelector('#queues rect[data-qday]');
if(qr){qr.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));
  ck('клик по свече очереди - панель дня',/День \d{2}\.\d{2}\.\d{4}/.test(t('qpanel')));
  const link=d.querySelector('#qpanel a.dl');
  ck('сделка ведёт в CRM',!!link&&/\/crm\/(deal|lead)\/details\/\d+\//.test(link.href),link&&link.href);}
// «?» на плитке очереди - выпадающий список с переходами
dom.window.eval("togglePop('qh-waiting')");
ck('поповер очереди открылся со списком менеджеров',d.getElementById('pop-qh-waiting').classList.contains('on')&&d.getElementById('pop-qh-waiting').querySelectorAll('tr').length>2);
// --- пульс
ck('пульс: 3 линии',d.getElementById('pulse').querySelectorAll('svg').length===3);
const pc2=d.querySelector('#pulse circle[data-pday]');
if(pc2){pc2.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));
  ck('клик по точке пульса - разбивка по менеджерам',/по менеджерам/.test(t('ppanel'))&&/\d{2}\.\d{2}\.\d{4}/.test(t('ppanel')));}
ck('ИИ-РОП аннотация к пульсу',!d.getElementById('pulse-ann').hidden&&t('pulse-ann').length>50);
// --- мёрзнет
ck('«Мёрзнет» есть, «гниё» отсутствует',d.body.textContent.includes('Мёрзнет')&&!d.body.textContent.toLowerCase().includes('гниё'));
const fr=d.querySelector('#freeze .fr');
if(fr){fr.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));
  const links=d.querySelectorAll('#zpanel a.dl').length;
  ck('этап заморозки: топ до 5 сделок с CRM-ссылками',links>0&&links<=5,links);}
ck('ИИ-РОП аннотация к заморозке',!d.getElementById('freeze-ann').hidden&&t('freeze-ann').length>50);
// сумма заморозки = пересчёт
const rotSum=DATA.rot.reduce((s,r)=>s+r.frozenRub,0);
ck('заморозка: суммы этапов в вёрстке',t('freeze').includes(fmtR(DATA.rot[0].frozenRub)),fmtR(DATA.rot[0].frozenRub));
// --- ИИ-РОП
ck('вкладки: отдел + 11 менеджеров',d.querySelectorAll('#ai-tabs .tb').length===1+11,d.querySelectorAll('#ai-tabs .tb').length);
ck('живой срез отдела показан (окно совпадает)',t('ai-text').length>400&&!t('ai-text').includes('Автосводка'));
ck('имена кликабельны (в тексте + ряд «Полные срезы»)',d.querySelectorAll('#ai-text .name-l').length+d.querySelectorAll('#ai-names .name-l').length>=11,d.querySelectorAll('#ai-names .name-l').length);
dom.window.eval('aiCmp()');
ck('СРАВНИТЬ отдела показывает текст',!d.getElementById('ai-cmp').hidden&&t('ai-cmp').length>100);
dom.window.eval("setAiTab('Маслова Ольга')");
ck('персональный срез открывается',t('ai-text').includes('Маслова')&&t('ai-text').length>400);
dom.window.eval("setAiTab('dept')");
// автосводка на произвольный период (окно не совпадает)
dom.window.eval("setPeriod('30')");
ck('произвольный период - честная автосводка',t('ai-text').includes('Автосводка')&&t('ai-hint').includes('отличается'));
dom.window.eval("setPeriod('win')");
// --- запрещённые формулировки по всем вкладкам ИИ + вёрстке
let all=[...d.querySelectorAll('body>*:not(script)')].map(e=>e.textContent).join('\n');
for(const m of DATA.managers){dom.window.eval(`setAiTab(${JSON.stringify(m.mgr)})`);all+='\n'+t('ai-text');}
dom.window.eval("setAiTab('dept')");
const nHit=/«[^»]*[\s(][N\u041D](?![a-z0-9])(?![а-яё])[^»]*»/.exec(all);
ck('нет плейсхолдера N в ярлыках',!nHit,nHit&&nHit[0]);
ck('нет «медианы отдела выше»',!all.includes('медиана отдела выше'));
ck('нет em dash в текстах',!all.includes(String.fromCharCode(8212)));
ck('числительные согласованы',!/(^|\D)([2-9]?1)\s+(продаж|сделок|диалогов)([^а-яё]|$)/.test(all.replace(/(^|\D)11\s+(продаж|сделок|диалогов)/g,'$1')));
ck('даты в формате дд.мм.гггг присутствуют',/\d{2}\.\d{2}\.\d{4}/.test(all));
ck('честная пометка генерации ИИ',t('foot').includes('РАСЧЁТ+ГИПОТЕЗА')||t('ai-hint').includes('РАСЧЁТ+ГИПОТЕЗА'));
// --- iter-3: приёмки п.3/п.4/п.5 + сверка августа в ИИ-текстах со страницей
ck('п.3: на неделе разбора нет ложной пометки фолбэка',!t('q-hint').includes('меньше 2 дней'));
dom.window.eval("setPeriod('today')");
ck('п.3: на однодневном периоде пометка фолбэка есть',t('q-hint').includes('меньше 2 дней'));
ck('п.4: пульс честно называет подставленные дни',t('pulse').includes('показаны все дни с данными'));
dom.window.eval("setPeriod('win')");
ck('п.5: у сервисного риска указано окно данных',t('kpis').includes('по окну разбора')||!t('kpis').includes('сервисный риск'));
{const augc=DATA.cohort.filter(c=>c.c>='2026-08-01'&&c.c<='2026-08-31');
 const augSold=augc.filter(c=>c.sold).length,augCreated=augc.length;
 const dtxt=[DATA.ai?.dept?.summary,DATA.ai?.dept?.funnelNote].join(' ');
 if(/август/i.test(dtxt)&&/создано\s+\d+/i.test(dtxt))
   ck('п.1: август в ИИ-тексте = когорте страницы',dtxt.includes(String(augCreated))&&dtxt.includes(String(augSold)),`ждали ${augCreated}/${augSold}`);
 ck('п.1: старая общая когорта (364/76) не цитируется',!/(^|\D)364(\D|$)/.test(dtxt));}
// --- R1: ВСЕ CRM-ссылки страницы и панелей имеют непустой id
let badLinks=0;
for(const dd2 of DATA.deals){ if(!dd2.id){badLinks++;} }
ck('R1: у всех сделок есть id для CRM-ссылки',badLinks===0,badLinks+' без id');
ck('R1: нет ссылок вида /details//',![...d.querySelectorAll('a.dl')].some(a=>/\/details\/\//.test(a.href)));
// --- R6: пометка сервисного риска на KPI
ck('R6: оговорка про предоплату в очередях',t('kpis').includes('сервисный риск')||!DATA.deals.some(x=>x.o==='open'&&['C49:EXECUTING','C49:FINAL_INVOICE','C49:1','C49:2','C49:WON'].includes(x.sc)&&BADQ.includes(x.u)));
// --- R2/R7: деградация - сборка без истории обязана жить
import {execSync} from 'node:child_process';
try{
  execSync('HIST_JSON=/nonexistent AI_JSON=/nonexistent OUT=/tmp/svod2-degrade.html ROP_JSON='+(process.env.ROP_JSON||'/tmp/rop.json')+' npx tsx src/scripts/b24/build-svod2.ts',{stdio:'pipe'});
  const dhtml=readFileSync('/tmp/svod2-degrade.html','utf-8');
  const derr=[];
  const ddom=new JSDOM(dhtml,{runScripts:'dangerously',beforeParse(w){w.addEventListener('error',e=>derr.push(e.message));}});
  const dt=[...ddom.window.document.querySelectorAll('body>*:not(script)')].map(e=>e.textContent).join('\n');
  ck('R2: без истории - ни одной JS-ошибки',derr.length===0,derr[0]);
  ck('R2: без истории - нет баннера «Ошибка рендера»',!dt.includes('Ошибка рендера'));
  ck('R7: без истории - честная заглушка пульса',dt.includes('истории')&&dt.includes('нет данных'));
  ck('R2: воронка и заморозка отрисованы после пульса',ddom.window.document.querySelectorAll('#freeze .fr').length>0&&ddom.window.document.getElementById('funnel-big').textContent.length>10);
}catch(e){ck('R2: деградационная сборка выполнилась',false,String(e).slice(0,120));}
// --- CR-ФИЧИ (согласованы 01.09): независимые пересчёты
{
  // Фича 1: долг - сумма сегментов полосы = итогу; пересчёт непогашенных из deals невозможен без events,
  // поэтому сверяем внутреннюю согласованность payload и вёрстки
  const debt=DATA.debt||[];
  const total=debt.reduce((s2,x)=>s2+x.b,0);
  ck('фича1: итог долга в бейдже',t('debt-total').includes(fmtR(total)),fmtR(total));
  ck('фича1: сегментов полосы = менеджеров с долгом',d.querySelectorAll('#dstrip .sseg').length===new Set(debt.map(x=>x.m)).size);
  const combN=[...d.querySelectorAll('#dcomb .cn')].reduce((s2,el)=>s2+(+el.textContent||0),0);
  ck('фича1: сумма столбиков гребёнки = позиций долга',combN===debt.length,combN+' vs '+debt.length);
  dom.window.eval("debtList('b',5)");
  ck('фича1: клик по столбику - список с CRM-ссылками',d.querySelectorAll('#dpanel a.dl').length>0||t('dpanel').includes('Долга нет'));
  const rl=(DATA.replyLine||[]).filter(r=>r.n>=3);
  ck('фича1: линия ответа клиента отрисована',d.querySelectorAll('#dreply circle').length===rl.length,rl.length);
  // G1 (ФЕНИКС): проценты «в течение суток vs позже» - из DATA.replyStats, не константы
  const RS=DATA.replyStats||{};
  const in24=(RS.pairs||0)-(RS.over24||0), in24b=(RS.back||0)-(RS.over24back||0);
  const p24=in24?Math.round(100*in24b/in24):0, pLate=RS.over24?Math.round(100*(RS.over24back||0)/RS.over24):0;
  const dh=t('pop-debt-help');
  ck('G1: справка долга цитирует пересчитанные проценты',dh.includes('в '+p24+' случаях')&&dh.includes('в '+pLate+' из 100'),p24+'/'+pLate);
  ck('G1: справка называет число поздних наблюдений',dh.includes(String(RS.over24||0))&&dh.includes('наблюдений мало'));
  const vis=[...d.querySelectorAll('body>*:not(script)')].map(e=>e.textContent).join('\n');
  ck('G1: захардкоженный «только в 46» исчез',!vis.includes('только в 46'));
  // G3 (ФЕНИКС): невоспроизводимый «39%» снят, разрез по типам клиентов помечен гипотезой
  ck('G3: «39% сделок - один клиент» удалён',!vis.includes('39% сделок'));
  ck('G3: разрез по типам клиентов помечен как гипотеза фазы 2',vis.includes('точный разрез по типам клиентов - фаза 2'));
  // Куратор по памятке (решение Ивана 03.09: отдел видит всех)
  const K=DATA.kurator;
  ck('куратор: payload присутствует',!!K&&!!K.mgrs);
  const sellers=new Set(DATA.managers.filter(m=>m.role!=='office').map(m=>m.mgr));
  // B2 ФЕНИКСА: инварианты от ПРАВДЫ, не от реализации - сверка через независимый sameName
  const kTok=s=>[...String(s).toLowerCase().split(/\s+/).filter(Boolean)].sort().join('|');
  const kSame=(a,b)=>kTok(a)===kTok(b);
  const roster=DATA.managers.filter(m=>m.role!=='office').map(m=>m.mgr);
  // (б) каждая строка ростера присутствует ровно один раз, даже пустая
  const rowNames=[...d.querySelectorAll('#kur-table tr')].slice(1).map(tr=>tr.querySelector('td')?.textContent.trim()).filter(Boolean);
  const missing=roster.filter(m=>!rowNames.some(n=>kSame(n,m)));
  ck('куратор Б2(б): каждый продавец ростера - ровно одна строка',missing.length===0&&rowNames.filter(n=>roster.some(m=>kSame(n,m))).length===roster.length,'нет строк: '+missing.join(', '));
  // (в) ни один ключ payload не остаётся неотнесённым к ростеру (канонизация сработала)
  const orphan=Object.keys(K.mgrs).filter(k2=>!roster.some(m=>kSame(k2,m)));
  ck('куратор Б2(в): ключи payload = канонические имена ростера',orphan.length===0,'сироты: '+orphan.join(', '));
  // (а) сумма улик в ТАБЛИЦЕ = сумме viol в payload по ростеру МИНУС правила, скрытые
  // боевой калибровкой (K1: с 04.09 файл разметки Ивана живёт в данных)
  const kcal=K.calibration&&K.calibration.byRule?K.calibration.byRule:null;
  const kHidden=kcal?Object.keys(kcal).filter(r=>kcal[r].n&&100*kcal[r].ok/kcal[r].n<90):[];
  const payRaw=Object.entries(K.mgrs).filter(([k2])=>roster.some(m=>kSame(k2,m))).reduce((s2,[,v])=>s2+v.viol,0);
  const paySum=Object.entries(K.mgrs).filter(([k2])=>roster.some(m=>kSame(k2,m))).reduce((s2,[,v])=>s2+v.viol-kHidden.reduce((h,r)=>h+((v.byRule||{})[r]||0),0),0);
  const tblSum=[...d.querySelectorAll('#kur-table tr')].slice(1).filter(tr=>roster.some(m=>kSame(tr.querySelector('td')?.textContent.trim()||'',m))).reduce((s2,tr)=>{const b=tr.querySelectorAll('td')[3]?.querySelector('b');return s2+(b?+b.textContent:0);},0);
  ck('куратор Б2(а): сумма улик таблицы = сумме payload',tblSum===paySum,tblSum+' vs '+paySum);
  // K3 ФЕНИКСА: второй независимый инвариант - ключи payload СТРОГО равны строкам ростера
  // (никакой токенизации: расщепление «Татьяна Лакомова»/«Лакомова Татьяна» валит его)
  ck('куратор K3: ключи payload строго === именам ростера',Object.keys(K.mgrs).every(k2=>roster.includes(k2)),Object.keys(K.mgrs).filter(k2=>!roster.includes(k2)).join(', '));
  // K4 ФЕНИКСА: калибровка с правилом <90% - бейдж и таблица пересчитываются, а не прячут
  // улики молча; проверяется на подложенном файле разметки
  try{
    writeFileSync('/tmp/kcal-test.json',JSON.stringify({measuredAt:'тест',by:'smoke',sampleRef:'фикстура',byRule:{R1:{n:30,ok:9}}}));
    execSync('KCAL_JSON=/tmp/kcal-test.json OUT=/tmp/svod2-cal.html HIST_JSON='+(process.env.HIST_JSON||'dialog/data/history.json')+' ROP_JSON='+(process.env.ROP_JSON||'/tmp/rop.json')+' npx tsx src/scripts/b24/build-svod2.ts',{stdio:'pipe'});
    const chtml=readFileSync('/tmp/svod2-cal.html','utf-8');
    const cdom=new JSDOM(chtml,{runScripts:'dangerously'});
    const cd=cdom.window.document;
    const cK=cdom.window.eval('DATA').kurator;
    const hidR1=Object.entries(cK.mgrs).filter(([k2])=>roster.some(m=>kSame(k2,m))).reduce((s2,[,v])=>s2+((v.byRule||{}).R1||0),0);
    // K4-сборка живёт под ТЕСТОВОЙ калибровкой (только R1<90) - сравнивать с сырой суммой
    const expTot=payRaw-hidR1;
    const cTbl=[...cd.querySelectorAll('#kur-table tr')].slice(1).filter(tr=>roster.some(m=>kSame(tr.querySelector('td')?.textContent.trim()||'',m))).reduce((s2,tr)=>{const b=tr.querySelectorAll('td')[3]?.querySelector('b');return s2+(b?+b.textContent:0);},0);
    ck('куратор K4: при калибровке R1<90% таблица = payload минус скрытые',cTbl===expTot,cTbl+' vs '+expTot+' (спрятано R1: '+hidR1+')');
    ck('куратор K4: бейдж пересчитан по отфильтрованным',(cd.getElementById('kur-total')?.textContent||'').includes(String(expTot)));
    ck('куратор K4: провенанс разметки печатается',(cd.getElementById('kur-qual')?.textContent||'').includes('smoke'));
  }catch(e){ck('куратор K4: калиброванная сборка прошла',false,String(e.message||e).slice(0,160));}
  // МУТАЦИОННЫЕ фикстуры движка (G11 ФЕНИКСА): синтетика с известным ответом,
  // любой дрейф правил валит tsx-прогон - литеральных grep-гвардов больше нет
  let fixOut='';
  try{fixOut=execSync('npx tsx src/scripts/b24/test-pamyatka-rules.ts',{stdio:'pipe'}).toString();}catch(e){fixOut=(e.stdout||Buffer.from('')).toString()+(e.stderr||Buffer.from('')).toString();}
  ck('куратор: мутационные фикстуры движка зелёные',fixOut.includes('PAMYATKA-RULES TEST PASS'),fixOut.split('\n').filter(l=>l.startsWith('FAIL')).join('; ').slice(0,200));
  // настоящий гвард окна: каждая дата в уликах (дд.мм) существует в диапазоне окна
  const winDates=new Set();{
    let t0=new Date(DATA.meta.dlgFrom),t1=new Date(DATA.meta.dlgTo);
    for(let t=t0.getTime();t<=t1.getTime()+864e5;t+=864e5){const d2=new Date(t);winDates.add(String(d2.getUTCDate()).padStart(2,'0')+'.'+String(d2.getUTCMonth()+1).padStart(2,'0'));}
  }
  let outOfWin=null;
  for(const s of Object.values(K.mgrs))for(const dd2 of s.deals)for(const v of dd2.viol){
    const m2=v.d.match(/^(\d{2}\.\d{2})/);
    if(m2&&!winDates.has(m2[1]))outOfWin=v.r+' '+v.d;
  }
  ck('куратор: все улики датированы внутри окна',!outOfWin,outOfWin||'');
  // атрибуция: офисные авторы не в таблице продавцов, первая линия отдельно
  ck('куратор: у офисной первой линии свой счёт',!!K.firstLine&&typeof K.firstLine.fr==='number');
  ck('куратор: бейдж честности - черновик, не ДАННЫЕ',(function(){const h2=[...d.querySelectorAll('.card h2')].find(x=>x.textContent.includes('Разбор недели по памятке'));return h2&&h2.textContent.includes('ЧЕРНОВИК');})());
  ck('куратор: тотал в бейдже = сумме по продавцам',(function(){const tot=Object.entries(K.mgrs).filter(([m])=>sellers.has(m)).reduce((s2,[,v])=>s2+v.viol,0);return t('kur-total').includes(String(tot));})());
  // клик «Разбор» рисует панель с CRM-ссылками и заменами
  const kbtn=[...d.querySelectorAll('#kur-table button')].find(b=>!b.disabled);
  if(kbtn){kbtn.click();
    ck('куратор: разбор открылся с CRM-ссылками',d.querySelectorAll('#kur-panel a[href*="/crm/"]').length>0);
    ck('куратор: у каждой улики есть «Как надо»',[...d.querySelectorAll('#kur-panel [style*="border-left"]')].length>0&&t('kur-panel').includes('Как надо'));
  }
  ck('куратор: квалификация отдела названа честно',t('kur-qual').includes('бюджете')&&t('kur-qual').includes('исходящих'));
  // Фича 2: труба - пересчёт из cohort
  const C=DATA.cohort;
  const f={created:C.length,tz:C.filter(c=>c.tz).length,kp:C.filter(c=>c.kp).length,dec:C.filter(c=>c.dec).length,sold:C.filter(c=>c.sold).length,mk:C.filter(c=>c.mk).length};
  for(const k of ['created','tz','kp','dec','sold','mk'])
    ck('фича2: pipe.F.'+k+' = пересчёту когорты',DATA.pipe.F[k]===f[k],DATA.pipe.F[k]+' vs '+f[k]);
  ck('фича2: честные флаги - продажи мимо КП существуют и видны',f.mk>0?t('pipe-note').includes(String(f.mk)):true);
  ck('фича2: НЕТ бага «|| sold» (kp < sold+kp_честный максимум)',f.kp<f.created&&C.some(c=>c.sold&&!c.kp));
  const grey=[...d.querySelectorAll('#mpipe .ci.grey')].length;
  ck('фича2: серые строки погрешности присутствуют',grey>0,grey);
  dom.window.eval("pipeCoach('Лакомова Татьяна',17.4,true)");
  ck('фича2: клик по имени - слой действия',t('mcoach').includes('погрешности')||t('mcoach').includes('планёрке'));
  // Фича 3: вход - честный режим
  const unseen=DATA.stik.leads-DATA.stik.seen;
  ck('фича3: все три числа входа на месте',t('stik').includes(String(DATA.stik.leads))&&t('stik').includes(String(DATA.stik.seen))&&t('stik').includes(String(unseen)));
  ck('фича3: невидимые заявки названы честно («не выгружает»)',t('stik-note').includes('не выгружает'));
  ck('фича3: выдуманных счётчиков разбора нет (норматив/конвертация не показаны цифрами)',!/разобрано\s+\d|конвертировано\s+\d/i.test(t('stik')));
}
// --- JS-ошибки последними
ck('нет JS-ошибок за весь прогон',errors.length===0);if(errors.length)console.log(errors.slice(0,5));
console.log(fail?`SMOKE FAIL: ${fail} из ${total}`:`SMOKE PASS: ${total}/${total} проверок зелёные`);
process.exit(fail?1:0);
