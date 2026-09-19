# -*- coding: utf-8 -*-
NAV = r'''
/* ============ НАВИГАЦИЯ ============ */
const NAV = [
 {id:'obzor', t:'Обзор', i:'grid'},
 {t:'Деньги', i:'wallet', ch:[
   {id:'mn-bridge', t:'Мост до денег'},{id:'mn-plan', t:'План и факт'},
   {id:'mn-thr', t:'Пороги и ROI'},{id:'mn-block', t:'Что блокирует'}]},
 {t:'Органика', i:'search', ch:[
   {id:'org-sum', t:'Сводка по домену'},{id:'org-kw', t:'Запросы в топ-50'},
   {id:'org-pg', t:'Страницы'},{id:'org-lost', t:'Потерянные позиции'},
   {id:'org-comp', t:'Конкуренты'},{id:'org-tree', t:'Структура сайта'}]},
 {t:'Семантика', i:'layers', ch:[
   {id:'sem-cl', t:'Кластеры'},{id:'sem-base', t:'База запросов'},
   {id:'sem-ws', t:'Wordstat'},{id:'sem-sug', t:'Подсказки и расширение'}]},
 {t:'Динамика', i:'up', ch:[
   {id:'dyn-sum', t:'Стало лучше или хуже'},{id:'dyn-pos', t:'Позиции по дням'},
   {id:'dyn-ai', t:'Видимость в ИИ по дням'},{id:'dyn-ym', t:'Визиты по дням'},
   {id:'dyn-log', t:'Журнал съёмов'}]},
 {t:'Позиции', i:'chart', ch:[
   {id:'pos-mon', t:'Мониторинг'},{id:'pos-serp', t:'История выдачи'},
   {id:'pos-top', t:'Подсветка топов'}]},
 {t:'GEO и ИИ', i:'ai', ch:[
   {id:'geo-tr', t:'Трекер ИИ'},{id:'geo-men', t:'Упоминания'},
   {id:'geo-comp', t:'Конкуренты в ИИ'},{id:'geo-src', t:'Источники ответов'},
   {id:'geo-pr', t:'Промпты'}]},
 {t:'Реклама', i:'mega', ch:[
   {id:'ad-search', t:'Поиск'},{id:'ad-rsya', t:'РСЯ'},
   {id:'ad-comp', t:'Конкуренты в контексте'},{id:'ad-budget', t:'Прогноз бюджета'}]},
 {t:'Ссылки', i:'link', ch:[
   {id:'lnk-prof', t:'Профиль'},{id:'lnk-don', t:'Доноры'},
   {id:'lnk-anc', t:'Анкоры'},{id:'lnk-ip', t:'Сети и IP'}]},
 {t:'Метрика', i:'globe', demo:'ym', ch:[
   {id:'ym-traf', t:'Трафик'},{id:'ym-src', t:'Источники'},
   {id:'ym-beh', t:'Поведение'},{id:'ym-goal', t:'Цели и конверсии'}]},
 {t:'Директ', i:'bolt', demo:'direct', ch:[
   {id:'yd-camp', t:'Кампании'},{id:'yd-cost', t:'Расход и CPL'},
   {id:'yd-q', t:'Поисковые запросы'}]},
 {t:'Контент', i:'pen', ch:[
   {id:'ct-plan', t:'План публикаций'},{id:'ct-unit', t:'Задания и волны'},
   {id:'ct-idx', t:'Индексация'}]},
 {id:'compare', t:'Сравнение проектов', i:'cmp'},
 {t:'Регламент', i:'gear', ch:[
   {id:'rg-upd', t:'Как обновлять'},{id:'rg-api', t:'Источники и API'},
   {id:'rg-lim', t:'Ограничения сервиса'},{id:'rg-dec', t:'Журнал решений'}]},
 {id:'onepage', t:'Одна страница собственнику', i:'doc'}
];

let CUR = 'gm', VIEW = 'obzor';
const V  = () => DB.projects[CUR];
const OTH= () => CUR==='gm' ? DB.projects.gg : DB.projects.gm;

function buildNav(){
  const box = document.getElementById('nav');
  box.innerHTML = NAV.map((g, gi) => {
    if(!g.ch){
      return '<button data-v="'+g.id+'" onclick="go(\''+g.id+'\')" class="nv w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] hovr">'
        + '<span class="shrink-0 opacity-80">'+ic(g.i,'',17)+'</span><span class="lbl truncate">'+esc(g.t)+'</span></button>';
    }
    const kids = g.ch.map(c=>'<button data-v="'+c.id+'" onclick="go(\''+c.id+'\')" class="nv w-full text-left pl-[38px] pr-3 py-[7px] rounded-lg text-[12.5px] hovr"><span class="lbl">'+esc(c.t)+'</span></button>').join('');
    return '<div><button onclick="tog('+gi+')" class="nv w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] hovr">'
      + '<span class="shrink-0 opacity-80">'+ic(g.i,'',17)+'</span>'
      + '<span class="lbl truncate flex-1 text-left">'+esc(g.t)+'</span>'
      + '<span class="lbl" id="nb'+gi+'">'+navBadge(g)+'</span>'
      + '<span class="lbl chev shrink-0 opacity-50" id="cv'+gi+'">'+ic('up','rotate-90',13)+'</span></button>'
      + '<div class="sub space-y-[2px] mt-[2px]" id="sb'+gi+'">'+kids+'</div></div>';
  }).join('');
}
/* Бейдж раздела зависит от проекта: по GENGLASS Метрика уже отдаёт данные,
   по GLASS-MEMORY счётчика нет. Один статичный ярлык врал бы на половине случаев. */
function navBadge(g){
  if(!g.demo) return '';
  const has = !!V()[g.demo];
  return has ? '<span class="lbl kmark k-ok" title="выгрузка есть">ДАННЫЕ</span>'
             : '<span class="lbl kmark k-crit" title="выгрузки по этому проекту нет">НЕТ</span>';
}
/* Бейджи переставляются при каждой отрисовке: смена проекта через любой путь,
   а не только кликом по кнопке, не должна оставлять на меню вчерашнюю правду. */
function refreshBadges(){
  NAV.forEach((g,gi)=>{ const el=document.getElementById('nb'+gi); if(el) el.innerHTML = navBadge(g); });
}
function tog(gi){
  document.getElementById('sb'+gi).classList.toggle('on');
  document.getElementById('cv'+gi).classList.toggle('on');
}
function openFor(v){
  NAV.forEach((g,gi)=>{ if(g.ch && g.ch.some(c=>c.id===v)){
    document.getElementById('sb'+gi).classList.add('on');
    document.getElementById('cv'+gi).classList.add('on'); }});
}
function go(v){ VIEW = v; render(); }
'''
