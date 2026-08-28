// Smoke-тест собранного СВОДа: исполняем реальный HTML в jsdom и проверяем не только
// «блоки не пустые», но и АРИФМЕТИКУ - суммы на странице пересчитываются независимо
// и сверяются между собой (урок ФЕНИКС-аудита: presence-чеки пропускают ложь в цифрах).
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync('public/svod.html','utf-8');
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',beforeParse(w){w.addEventListener('error',e=>errors.push(e.message));}});
const d=dom.window.document;
const t=id=>d.getElementById(id)?.textContent?.trim()||'';
let fail=0;const ck=(n,ok,extra)=>{console.log((ok?'OK  ':'FAIL')+' '+n+(ok||extra==null?'':' | '+extra));if(!ok)fail++;};

// DATA из страницы - для независимого пересчёта
const DATA=dom.window.eval('DATA');
const PAIDS=new Set(['C49:EXECUTING','C49:FINAL_INVOICE','C49:1','C49:2','C49:WON']);
const BADQ=['waiting','ready','silent','nostep','nopush','fakedone','internal','overdue','promise','refuse','objection','lowprob'];
const isOU=x=>x.outcome==='open'&&!PAIDS.has(x.stageCode);

// --- презентация ---
ck('источники в шапке',t('src').includes('РОПа'));
ck('KPI наполнены',t('kpis').length>100&&t('kpis').includes('₽'));
ck('план показан',t('kpis').includes('План'));
ck('очереди наполнены',t('queues').length>50);
ck('таблица менеджеров',t('mtable').length>200);
ck('тренд отрисован',(d.getElementById('trendbox').innerHTML||'').includes('polyline'));
ck('тренд: два отдельных графика',(d.getElementById('trendbox').innerHTML.match(/<svg/g)||[]).length===2);
ck('прогноз наполнен',t('forecast').includes('₽'));

// --- числовые сверки ---
// 1) продано за месяц: сумма по менеджерам + hiddenMgr = deptWonRub (до рубля)
const mgrSum=DATA.managers.reduce((s,m)=>s+(m.wonRub||0),0);
const hidRub=DATA.hiddenMgr?DATA.hiddenMgr.rub:0;
ck('продано: колонка + вне разбора = плитка отдела',Math.round(mgrSum+hidRub)===Math.round(DATA.deptWonRub),`${mgrSum}+${hidRub} vs ${DATA.deptWonRub}`);
ck('hiddenMgr передан из сборки',!!DATA.hiddenMgr&&Array.isArray(DATA.hiddenMgr.names));
ck('сверка под таблицей показана',t('mrecon').length>20);
// 2) очереди: сумма плиток (шт) = KPI «Под риском» (шт)
const risk=DATA.deals.filter(x=>isOU(x)&&BADQ.includes(x.uKey));
const tileN=[...d.querySelectorAll('#queues .qv')].reduce((s,el)=>s+parseInt(el.textContent,10),0);
ck('очереди: сумма плиток = сделок под риском',tileN===risk.length,`${tileN} vs ${risk.length}`);
// 3) предоплаченные открытые исключены из риска и прогноза (нет двойного счёта)
const paidOpen=DATA.deals.filter(x=>x.outcome==='open'&&PAIDS.has(x.stageCode));
if(paidOpen.length){
  ck('предоплата: оговорка в прогнозе есть',t('forecast').includes('предоплат'));
  ck('предоплата: оговорка у очередей есть',t('qrecon').includes('предоплат'));
}
// 4) очереди overdue/objection присутствуют как плитки, если такие сделки есть
for(const k of ['overdue','objection']){
  const n=risk.filter(x=>x.uKey===k).length;
  if(n)ck(`очередь «${k}» видна (${n} сделок)`,[...d.querySelectorAll('#queues .qv')].length>0&&t('queues').length>0&&[...d.querySelectorAll('#queues .qcell')].some(c=>c.getAttribute('onclick')?.includes(k)));
}
// 5) план-выброс помечен гипотезой, если месяц в 1,8+ раза выше соседей
const M2=DATA.meta;
if(M2.planRev&&M2.planPrev&&M2.planNext&&M2.planRev>=1.8*M2.planPrev&&M2.planRev>=1.8*M2.planNext){
  ck('план-выброс помечен [ГИПОТЕЗА]',t('kpis').includes('выброс')&&t('kpis').includes('ГИПОТЕЗА'));
  // процент выполнения, посчитанный от спорного плана, не должен светиться зелёным
  const doneChip=[...d.querySelectorAll('#kpis .kpi')].find(k=>k.textContent.includes('Продано'))?.querySelector('.chip');
  ck('чип «Продано» не зелёный при спорном плане',!!doneChip&&!doneChip.classList.contains('up')&&doneChip.textContent.includes('ГИПОТЕЗА'));
}
// 6) прогноз: нет пустых клеток «Этап», записи без этапа оговорены
const emptyStageCell=[...d.querySelectorAll('#forecast tbody td:first-child')].some(td=>!td.textContent.trim());
ck('в прогнозе нет безымянных этапов',!emptyStageCell);
if(DATA.deals.some(x=>isOU(x)&&!x.stage))ck('записи без этапа оговорены под прогнозом',t('forecast').includes('без этапа'));
// 7) русские числительные проверяются ниже - по видимому тексту всех страниц разом

ck('дизайн-дисклеймер Ozon виден в подвале',t('foot').includes('Ozon')&&t('foot').includes('ГИПОТЕЗА'));

// --- интерактив ---
const qc=d.querySelector('.qcell');ck('очередь кликабельна',!!qc);
if(qc){qc.click();ck('drill очереди открылся',t('qdrill').length>50);}
const row=d.querySelector('#mtable tr.mrow');ck('строка менеджера есть',!!row);
if(row){row.click();
  ck('личная страница открылась',d.getElementById('scr-mgr').classList.contains('on'));
  const mb=t('mgr-body');
  ck('блок «хорошо» есть',mb.includes('Что хорошо'));
  ck('блок «плохо» есть',mb.includes('Что плохо'));
  ck('блок «фокус» есть',mb.includes('давить на следующей неделе'));
  ck('метки ДАННЫЕ присутствуют',mb.includes('ДАННЫЕ'));
  ck('упоминание об отсутствии перс. планов честное',mb.includes('Персональных планов в системе нет')||mb.includes('плана недоступен'));
}
// офисная роль: без звёзд и продажного разбора
const office=DATA.managers.find(m=>m.role==='office');
if(office){dom.window.eval(`openMgr(${JSON.stringify(office.mgr)})`);
  const ob=t('mgr-body');
  ck('офисная роль: отдельная страница без рейтинга',ob.includes('документооборот')&&!ob.includes('Что плохо'));
}
// --- запрещённые формулировки (уроки ФЕНИКС-вето) ---
// Ярлыки «главной утечки» живут ТОЛЬКО на личных страницах, поэтому сперва
// рендерим личную страницу КАЖДОГО менеджера и копим текст - иначе guard слепой.
// body.textContent включает текст <script> с сырым JSON (там плейсхолдеры легитимны),
// поэтому берём только видимые элементы страницы
const visText=()=>[...d.querySelectorAll('body>*:not(script)')].map(e=>e.textContent).join('\n');
let allText=visText();
for(const m of DATA.managers){dom.window.eval(`openMgr(${JSON.stringify(m.mgr)})`);allText+='\n'+t('mgr-body');}
ck('нет выдуманной «медианы отдела»',!allText.includes('медиана отдела выше'));
// ВАЖНО: \b в JS-регексах не работает рядом с кириллицей, поэтому границы - явные
// пробелы/скобки. Guard проверен мутацией: убери deN() из шаблона - обязан упасть.
const nHit=/«[^»]*[\s(«][N\u041D]([.\s»]|$)[^»]*»/.exec(allText);
ck('нет литерального плейсхолдера N в ярлыках (все личные страницы)',!nHit,nHit&&nHit[0]);
ck('нет удвоенного «дольше нормы»',!/дольше нормы[^»]{0,5}дольше нормы/.test(allText));
ck('нет «возвратов мало» без источника',!allText.includes('возвратов мало'));
ck('числительные согласованы на личных страницах',!/(^|\D)([2-9]?1)\s+(продаж|сделок|диалогов)([^а-яё]|$)/.test(allText.replace(/(^|\D)11\s+(продаж|сделок|диалогов)/g,'$1')));

// подсказки: расставлены и доступны с клавиатуры
ck('подсказки "?" расставлены',d.querySelectorAll('[data-t]').length>=15);
ck('подсказки доступны с клавиатуры (tabindex)',[...d.querySelectorAll('.q[data-t]')].every(el=>el.getAttribute('tabindex')==='0'));

// --- JS-ошибки проверяем ПОСЛЕДНИМИ: сюда попали и ошибки из кликов выше ---
ck('нет JS-ошибок за весь прогон',errors.length===0);if(errors.length)console.log(errors.slice(0,5));
console.log(fail?`SMOKE FAIL: ${fail}`:'SMOKE PASS: все проверки зелёные');
process.exit(fail?1:0);
