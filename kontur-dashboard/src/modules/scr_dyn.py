# -*- coding: utf-8 -*-
SCR_DYN = r'''
const SCREENS_DYN = {
'dyn-sum': () => {
  const s = slice(), d = V();
  const rows = [['top10','Запросов в топ-10'],['top50','Запросов в топ-50'],
                ['visibility','Видимость в ИИ, %'],['ai_answers','Ответов ИИ с упоминанием']]
    .map(([f,n])=>{ const y=dyn(f); return [n, f, y]; });
  return head('Стало лучше или хуже', 'Экран, который открывают перед собственником. Одна таблица, где по каждой метрике видно начало периода, конец и предыдущий отрезок такой же длины.',
      'наш ряд data/history/positions.ndjson плюс history из keysso.json', 'P0', bAPI,
      'Абсолютное значение метрики собственнику ничего не говорит. Говорит направление и скорость: за сколько дней сколько прибавилось.')
   + '<div class="mb-4">'+verdict()+'</div>'
   + card('Разбор по метрикам','Период: '+PERIOD_LABEL[PERIOD]+(s.from? ', с '+ruD(s.from.toISOString().slice(0,10))+' по '+ruD(s.to.toISOString().slice(0,10)) : ''),
      tbl([['Метрика'],['Было',1],['Стало',1],['Изменение',1],['Отрезком раньше',1],['Точек',1]],
        rows.map(([n,f,y])=>[
          esc(n),
          (y.was==null || y.one)? '<span class="opacity-40">нет</span>' : nf(y.was),
          y.now==null? '<span class="opacity-40">нет</span>' : nf(y.now),
          y.one? '<span class="opacity-40">одна точка</span>' : y.abs==null? '<span class="opacity-40">нет</span>'
            : '<span style="color:'+(tone(f,y.abs)==='good'?ST('ok'):tone(f,y.abs)==='bad'?ST('crit'):INK())+'">'
              +(y.abs>0?'+':'')+nf(y.abs)+'</span>',
          y.prev==null? '<span class="opacity-40">нет</span>' : nf(y.prev),
          nf(y.points)])))
   + '<div class="mt-4">'+card('Все метрики на одной шкале','Индекс: первая точка периода это 100. Разные по величине ряды иначе не сравнить на одной оси',
      ch('c-idx100',300),'',bAPI, idxTable())+'</div>'
   + '<div class="mt-4">'+note('Почему индекс, а не две оси',
      'Топ-50 измеряется тысячами, видимость единицами процентов. На одной обычной оси меньший ряд превращается в прямую линию, а две оси Y на одном графике рисуют корреляцию, которой в данных нет. Поэтому оба ряда приведены к сотне на старте периода.','info')+'</div>';
},

'dyn-pos': () => {
  const s = slice();
  return head('Позиции по дням', 'Накопленный ряд по ступеням топа. Это то, что нельзя восстановить задним числом: у сводки домена в keys.so нет ретроспективы.',
      'data/history/positions.ndjson', 'P0', bAPI,
      'Каждый запрос, поднятый из топ-50 в топ-10, меняет визиты примерно в восемь раз. Скорость этого перехода и есть смысл экрана.')
   + '<div class="'+g3+' mb-4">'+[
      mini('Запросов в топ-1', V().top1, 0,'up','top1'),
      mini('Запросов в топ-3', V().top3, 1,'target','top3'),
      mini('Запросов в топ-10', V().top10, 2,'chart','top10'),
      mini('Запросов в топ-50', V().top50, 3,'search','top50')].join('')+'</div>'
   + card('Топ-10 и топ-50 по дням','Две серии, поэтому легенда обязательна. Шкала логарифмическая: иначе топ-10 прижимается к нулю рядом с топ-50',
      ch('c-pos',320),'',bAPI,
      tbl([['Дата'],['Топ-10',1],['Топ-50',1]],
        s.cur.map(r=>[ruD(r.date), r.top10==null?'-':nf(r.top10), r.top50==null?'-':nf(r.top50)])))
   + '<div class="mt-4">'+gapNote()+'</div>'
   + (anomalyNote('top10','запросы в топ-10') ? '<div class="mt-4">'+anomalyNote('top10','запросы в топ-10')+'</div>' : '');
},

'dyn-ai': () => {
  const s = slice();
  return head('Видимость в ИИ по дням', 'Доля ответов нейросетей, где нас называют. Второй ряд, который ведём сами.',
      'keys.so ai tracker через keysso.json', 'P1', bAPI,
      'Канал, где вход дешевле, чем в поиске. Скорость роста здесь единственная метрика, по которой можно решать, вкладываться дальше или нет.')
   + '<div class="'+g3+' mb-4">'+[
      mini('Видимость в ИИ, %', V().aivis, 0,'ai','visibility'),
      mini('Ответов с упоминанием', V().aians, 1,'list','ai_answers'),
      mini('Точек в периоде', String(s.cur.length), 2,'clock'),
      mini('Глубина ряда, дней', String(SER().length? Math.round((dOf(SER()[SER().length-1].date)-dOf(SER()[0].date))/86400000) : 0), 3,'db')].join('')+'</div>'
   + card('Видимость по дням','Одна серия, точка подписана на конце',ch('c-hvis',300),'',bAPI, serTable('vis'))
   + (anomalyNote('visibility','видимость в ИИ') ? '<div class="mt-4">'+anomalyNote('visibility','видимость в ИИ')+'</div>' : '')
   + '<div class="mt-4">'+note('Что здесь считается видимостью',
      'Процент промптов набора, в ответе на которые система назвала бренд или дала ссылку на домен. Меняешь набор промптов, значит обнуляешь ряд: сравнивать до и после смены набора нельзя.','warn')+'</div>';
},

'dyn-ym': () => {
  const d=V(), ym=d.ym;
  if(!ym){
    const o = OTH(), om = o.ym;
    return head('Визиты по дням', 'Счётчик Метрики по этому проекту не подключён. Экран показывает, чего именно не хватает и что появится сразу после подключения.',
        'нужен номер счётчика', 'P0', bDEMO,
        'Это второе звено моста до денег. Пока его нет, конверсия визита в лид остаётся бенчмарком, а значит и выручка от поиска остаётся гипотезой.')
     + note('По этому проекту счётчика нет, и цифры здесь не нарисованы',
        'Соседний проект '+esc(o.name)+' уже отдаёт данные: счётчик '+(om? esc(String(om.counter.v)) : 'подключён')
        +', ряд из '+(om? nf((om.days||[]).length) : '0')+' дней. Значит механика работает и упирается только в номер счётчика по этому домену.','warn')
     + '<div class="'+g2+' mt-4">'
     +   card('Что появится сразу после подключения','Ни одной новой строки кода для этого не нужно',
          '<div class="space-y-2 text-[12.5px]">'
          + ['визиты и визиты из поиска по дням за любой период',
             'страницы входа с числом визитов',
             'поисковые фразы, по которым реально приходят',
             'отказы и глубина просмотра',
             'сравнение половин периода вместо сравнения последнего дня с первым'
            ].map(x=>'<div class="flex gap-2"><span class="ok-i shrink-0 mt-[2px]">'+ic('check','',14)+'</span><span>'+esc(x)+'</span></div>').join('')
          + '</div>')
     +   card('Чего не даст даже подключение','Это придётся закрывать отдельно',
          '<div class="space-y-2 text-[12.5px]">'
          + ['конверсию в лид: нужны настроенные цели, а их нет ни на одном счётчике',
             'вклад рекламы отдельно от органики: нужна разметка utm',
             'выручку по каналу: нужна выгрузка сделок из CRM'
            ].map(x=>'<div class="flex gap-2"><span class="crit-i shrink-0 mt-[2px]">'+ic('warn','',14)+'</span><span>'+esc(x)+'</span></div>').join('')
          + '</div>')
     + '</div>'
     + '<div class="mt-4">'+act('Дать номер счётчика Метрики по '+esc(V().dom)+' и доступ на чтение','Иван','до 11.09','счётчик отдаёт визиты по API, ряд появляется в этом экране без правок')+'</div>';
  }
  const days = ym.days || [];
  const cut = days.slice(Math.max(0, days.length - Math.min(PERIODS[PERIOD], days.length)));
  const sum = a => a.reduce((x,r)=>x+(r.visits||0),0);
  const sums = a => a.reduce((x,r)=>x+(r.search_visits||0),0);
  const half = Math.floor(cut.length/2);
  const a1 = cut.slice(0,half), a2 = cut.slice(half);
  const dv = (sum(a2)-sum(a1));
  return head('Визиты по дням', 'Данные Яндекс.Метрики, счётчик '+esc(String(ym.counter.v))+'. Ряд из '+nf(days.length)+' дней.',
      'gg-seo-geo-monster/data/'+(CUR==='gg'?'genglass':'glass-memory')+'/metrika.json · снято '+ruD(ym.at), 'P0', bAPI,
      'Единственный источник настоящих визитов. Оценку трафика от keys.so не используем нигде: при 547 запросах в топ-50 она показывает около двух визитов.')
   + '<div class="'+g3+' mb-4">'+[
      mini('Визитов за период', {v:sum(cut),k:'ДАННЫЕ',s:'metrika.json',at:ym.at}, 0,'users'),
      mini('Из них из поиска', {v:sums(cut),k:'ДАННЫЕ',s:'metrika.json',at:ym.at}, 1,'search'),
      mini('Отказы, %', ym.bounce, 2,'loss'),
      mini('Глубина просмотра', ym.depth, 3,'layers')].join('')+'</div>'
   + card('Визиты и визиты из поиска','Две серии, легенда обязательна',ch('c-ym',300),'',bAPI,
      tbl([['Дата'],['Визиты',1],['Из поиска',1]], cut.map(r=>[ruD(r.date), nf(r.visits), nf(r.search_visits)])))
   + '<div class="mt-4">'+note(
      dv>0 ? 'Вторая половина периода выше первой' : dv<0 ? 'Вторая половина периода ниже первой' : 'Половины периода равны',
      'Первая половина: '+nf(sum(a1))+' визитов. Вторая: '+nf(sum(a2))+'. Разница '+(dv>0?'+':'')+nf(dv)+'. '
      +'Сравнение половинами устойчивее к выходным, чем сравнение последнего дня с первым.', dv>0?'ok':dv<0?'crit':'info')+'</div>'
   + '<div class="mt-4">'+g2Cards(
      card('Страницы входа','По визитам', tbl([['Страница'],['Визиты',1]], (ym.top_pages||[]).slice(0,10).map(r=>['<span class="font-mono text-[12px]">'+esc(r.url)+'</span>', nf(r.visits)]))),
      card('Поисковые фразы','По визитам', tbl([['Фраза'],['Визиты',1]], (ym.top_phrases||[]).slice(0,10).map(r=>[esc(r.phrase), nf(r.visits)]))))+'</div>'
   + ((ym.goals||[]).length===0 ? '<div class="mt-4">'+note('Целей в счётчике нет',
      'Визиты есть, а целей ноль. Значит конверсия визита в лид не измеряется и остаётся бенчмарком в мосте до денег. Это самая дешёвая из оставшихся правок: три цели закрывают вопрос.','crit')+'</div>' : '');
},

'dyn-log': () => {
  const s = SER();
  const rows = s.slice().reverse().slice(0,60).map(r=>[
    ruD(r.date),
    r.top10==null?'-':nf(r.top10), r.top50==null?'-':nf(r.top50),
    r.vis==null?'-':nf(r.vis), r.ai==null?'-':nf(r.ai),
    '<span class="opacity-60">'+esc(r.src||'-')+'</span>']);
  return head('Журнал съёмов', 'Каждая точка ряда с датой и источником. Экран нужен, чтобы видеть не только цифру, но и то, откуда она взялась и не пропущена ли неделя.',
      'data/history/positions.ndjson', 'P1', bAPI,
      'Пропущенный съём не восстанавливается. Любая дыра в этом журнале это дыра в сравнении периодов на всех остальных экранах.')
   + '<div class="'+g3+' mb-4">'+[
      mini('Точек в ряду', {v:s.length,k:'ДАННЫЕ',s:'positions.ndjson',at:s.length? s[s.length-1].date:''}, 0,'db'),
      mini('Первая точка', s.length? ruD(s[0].date):'нет', 1,'clock'),
      mini('Последняя точка', s.length? ruD(s[s.length-1].date):'нет', 2,'check'),
      mini('Разрывов больше 8 дней', String(gaps().length), 3, gaps().length? 'warn':'check')].join('')+'</div>'
   + gapNote()
   + '<div class="mt-4">'+card('Последние 60 точек','Новые сверху',
      tbl([['Дата'],['Топ-10',1],['Топ-50',1],['Видимость',1],['Ответов ИИ',1],['Источник']], rows))+'</div>';
}
};

function gaps(){
  const s = SER(); const out=[];
  for(let i=1;i<s.length;i++){
    const dd = (dOf(s[i].date) - dOf(s[i-1].date)) / 86400000;
    if(dd > 8) out.push([s[i-1].date, s[i].date, Math.round(dd)]);
  }
  return out;
}
function gapNote(){
  const g = gaps(), s = SER();
  if(!s.length) return note('Ряда нет','Ни одной точки не записано. Запусти tools/snapshot.py.','crit');
  const stale = Math.round((Date.now() - dOf(s[s.length-1].date)) / 86400000);
  if(g.length) return note('В ряду есть разрывы',
    g.map(x=>'с '+ruD(x[0])+' по '+ruD(x[1])+', '+x[2]+' дней без съёма').join('; ')
    + '. Сравнение периодов на этих отрезках опирается на интерполяцию глазом, а не на данные.','warn');
  if(stale > 8) return note('Последний съём просрочен',
    'Свежей точке '+stale+' дней. Регламент требует еженедельного съёма, иначе недельное сравнение теряет смысл.','crit');
  return note('Ряд без разрывов','Последняя точка '+ruD(s[s.length-1].date)+', свежесть '+stale+' дн. Съём идёт по регламенту.','ok');
}
function g2Cards(a,b){ return '<div class="'+g2+'">'+a+b+'</div>'; }
function idxTable(){
  const s = slice().cur;
  const base = {}; ['top10','top50','vis'].forEach(f=>{ base[f] = firstOf(s,f); });
  const rows = s.map(r=>[ruD(r.date)].concat(['top10','top50','vis'].map(f=>
    (r[f]==null || !base[f]) ? '-' : Math.round(r[f]/base[f]*100))));
  return rows.length ? tbl([['Дата'],['Топ-10',1],['Топ-50',1],['Видимость',1]], rows)
                     : '<div class="text-[12.5px] opacity-70">В периоде нет точек.</div>';
}
'''
