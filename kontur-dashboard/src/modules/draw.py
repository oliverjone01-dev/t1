# -*- coding: utf-8 -*-
DRAW = r'''
/* ============ ГРАФИКИ ============
   Только пресеты кита (kontur-ds/kit/charts.js): цвета из --cat-1..5 текущей темы,
   слоты в фиксированном порядке; одна серия без легенды, две и больше с легендой;
   подпись значения только на конце; двух осей Y нет, разные ряды идут через индекс.
   Пустой ряд кит рисует как отсутствие данных, а не пустой рамкой.
   Hex в этом файле запрещён: tools/check_dash.py. */
const wkCats = ['н-1','н-2','н-3','н-4','н-5','н-6','н-7'];
const has = id => !!document.getElementById(id);

function draw(){
  const d = V(), dd = DD(), sl = slice();
  const cats = sl.cur.map(r => ruD(r.date));
  const pick = f => sl.cur.map(r => r[f] == null ? null : r[f]);

  /* запросы в топ-10 по дням: одна серия */
  if(has('c-h10')) KS.charts.line('c-h10', { cats, data:pick('top10'), name:'Топ-10', slot:3, h:260 });
  /* видимость в ИИ по дням */
  if(has('c-hvis')) KS.charts.line('c-hvis', { cats, data:pick('vis'), name:'Видимость, %', slot:1, h:280, area:true, suffix:'%' });
  /* топ-10 и топ-50 вместе: одна природа, разный масштаб, логарифмическая ось */
  if(has('c-pos')) KS.charts.multi('c-pos', { cats, h:320, log:true, series:[
    { name:'Топ-10', data:pick('top10'), slot:3 }, { name:'Топ-50', data:pick('top50'), slot:2 }] });
  /* всё на одной шкале через индекс: первая точка периода это 100 */
  if(has('c-idx100')) KS.charts.index('c-idx100', { cats, h:300, series:[
    { name:'Топ-10', data:pick('top10'), slot:3 }, { name:'Топ-50', data:pick('top50'), slot:2 },
    { name:'Видимость', data:pick('vis'), slot:1 }] });
  /* визиты Метрики: две серии одной природы */
  if(has('c-ym') && d.ym){
    const days = d.ym.days || [];
    const cut = days.slice(Math.max(0, days.length - Math.min(PERIODS[PERIOD], days.length)));
    KS.charts.multi('c-ym', { cats:cut.map(r => ruD(r.date)), h:300, area:true, series:[
      { name:'Визиты', data:cut.map(r => r.visits), slot:3 }, { name:'Из поиска', data:cut.map(r => r.search_visits), slot:2 }] });
  }
  /* воронка топ-N: одна серия полосами */
  if(has('c-fun')){
    const rows = [['топ-1',d.top1],['топ-3',d.top3],['топ-5',d.top5],['топ-10',d.top10],['топ-50',d.top50]]
      .filter(r => r[1] && r[1].v != null);
    KS.charts.hbar('c-fun', { cats:rows.map(r => r[0]), data:rows.map(r => r[1].v), name:'Запросов', slot:3, h:260 });
  }
  /* динамика топ-50 по неделям: одна серия */
  if(has('c-wk')) KS.charts.line('c-wk', { cats:wkCats, data:dd.wk, name:'Топ-50', slot:2, h:270 });
  /* видимость ИИ по неделям: площадь, одна серия */
  if(has('c-aiwk')) KS.charts.line('c-aiwk', { cats:wkCats, data:dd.aiwk, name:'Видимость, %', slot:1, h:280, area:true, suffix:'%' });
  /* вес страниц: десять самых сильных страниц полосами. Площадь дерева читается хуже
     длины полосы, и у дерева нет законного места для подписи длинного адреса. */
  if(has('c-tree')){
    const top = (d.pg || []).map(r => { let u = String(r.url || ''); try{ u = new URL(u).pathname; }catch(e){} return [u, r.keywords_top50 || 0]; })
      .sort((a, b) => b[1] - a[1]).slice(0, 10);
    KS.charts.hbar('c-tree', { cats:top.map(r => r[0]), data:top.map(r => r[1]), name:'Запросов в топ-50', slot:3, h:Math.max(220, 34 * top.length + 40) });
  }
  /* объём рекламы у первой пятёрки конкурентов: настоящие объявления из выгрузки keys.so */
  if(has('c-ads')){
    const top = (d.adc || []).slice(0, 5);
    KS.charts.hbar('c-ads', { cats:top.map(r => r.domain), data:top.map(r => r.ads_count || 0), name:'Объявлений', slot:3, h:260 });
  }
}
'''
