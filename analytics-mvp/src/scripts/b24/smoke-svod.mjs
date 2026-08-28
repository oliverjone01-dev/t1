import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync('public/svod.html','utf-8');
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',beforeParse(w){w.addEventListener('error',e=>errors.push(e.message));}});
const d=dom.window.document;
const t=id=>d.getElementById(id)?.textContent?.trim()||'';
let fail=0;const ck=(n,ok)=>{console.log((ok?'OK  ':'FAIL')+' '+n);if(!ok)fail++;};
ck('нет JS-ошибок',errors.length===0);if(errors.length)console.log(errors.slice(0,3));
ck('источники в шапке',t('src').includes('РОПа'));
ck('KPI наполнены',t('kpis').length>100&&t('kpis').includes('₽'));
ck('план показан',t('kpis').includes('План'));
ck('очереди наполнены',t('queues').length>50);
ck('таблица менеджеров',t('mtable').length>200);
ck('тренд отрисован',(d.getElementById('trend').innerHTML||'').includes('polyline'));
ck('прогноз наполнен',t('forecast').includes('₽'));
// drill очереди
const qc=d.querySelector('.qcell');ck('очередь кликабельна',!!qc);
if(qc){qc.click();ck('drill очереди открылся',t('qdrill').length>50);}
// личная страница
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
// подсказки
ck('подсказки "?" расставлены',d.querySelectorAll('[data-t]').length>=15);
console.log(fail?`SMOKE FAIL: ${fail}`:'SMOKE PASS: все проверки зелёные');
process.exit(fail?1:0);
