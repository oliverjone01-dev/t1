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
 {t:'Метрика', i:'globe', demo:'ym', badge(){ return navBadge(this); }, ch:[
   {id:'ym-traf', t:'Трафик'},{id:'ym-src', t:'Источники'},
   {id:'ym-beh', t:'Поведение'},{id:'ym-goal', t:'Цели и конверсии'}]},
 {t:'Директ', i:'bolt', demo:'direct', badge(){ return navBadge(this); }, ch:[
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

/* Меню рисует кит (KS.nav) заново при каждой отрисовке: активный пункт, раскрытая
   группа и бейджи разделов всегда совпадают с текущим проектом.
   Бейдж раздела зависит от проекта: по GENGLASS Метрика уже отдаёт данные,
   по GLASS-MEMORY счётчика нет. Один статичный ярлык врал бы на половине случаев. */
function navBadge(g){
  return V()[g.demo] ? KS.badge('данные', 'ok', 'выгрузка есть')
                     : KS.badge('нет', 'crit', 'выгрузки по этому проекту нет');
}
/* Переход без анимации: его зовут палитра команд, ссылки внутри экранов и дымовой тест. */
function go(v){ VIEW = v; render(); }
'''
