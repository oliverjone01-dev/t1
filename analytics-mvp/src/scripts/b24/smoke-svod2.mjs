// Smoke СВОД v2: исполняем собранный HTML, пересчитываем цифры независимо, кликаем
// интерактив, проверяем запрещённые формулировки. Guard'ы числовые (уроки ФЕНИКС v1):
// presence-чеки без пересчёта не принимаются.
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync('public/svod2.html','utf-8');
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',beforeParse(w){w.addEventListener('error',e=>errors.push(e.message));}});
const d=dom.window.document;
const t=id=>d.getElementById(id)?.textContent||'';
let fail=0;const ck=(n,ok,extra)=>{console.log((ok?'OK  ':'FAIL')+' '+n+(ok||extra==null?'':' | '+extra));if(!ok)fail++;};
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
// --- JS-ошибки последними
ck('нет JS-ошибок за весь прогон',errors.length===0);if(errors.length)console.log(errors.slice(0,5));
console.log(fail?`SMOKE FAIL: ${fail}`:'SMOKE PASS: все проверки зелёные');
process.exit(fail?1:0);
