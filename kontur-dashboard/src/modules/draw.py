# -*- coding: utf-8 -*-
DRAW = r'''
/* ============ ГРАФИКИ ============
   Правила: категориальные тона в фиксированном порядке и никогда по кругу;
   одна серия - один цвет и без легенды; две и больше - легенда всегда;
   подписи значений выборочные; сетка сплошная и тише фона; у каждого графика есть таблица. */
const CH = {};
function base(h, type){
  return {
    chart:{ type:type, height:h, fontFamily:'"DM Sans", system-ui, sans-serif', foreColor:INK(),
            toolbar:{show:false}, animations:{enabled:true, easing:'easeinout', speed:520},
            parentHeightOffset:0 },
    grid:{ borderColor:GRID(), strokeDashArray:0, padding:{left:14,right:18,top:0,bottom:12} },
    dataLabels:{ enabled:false },
    legend:{ show:false },
    tooltip:{ theme:A()?'dark':'light', style:{fontSize:'12px'} },
    stroke:{ width:2, lineCap:'round', curve:'straight' },
    xaxis:{ axisBorder:{show:false}, axisTicks:{show:false}, labels:{style:{fontSize:'11px'}} },
    yaxis:{ labels:{style:{fontSize:'11px'}} }
  };
}
function mk(id, opt){
  const el = document.getElementById(id); if(!el) return;
  if(CH[id]){ try{ CH[id].destroy(); }catch(e){} }
  CH[id] = new ApexCharts(el, opt); CH[id].render();
}
const wkCats = ['н-1','н-2','н-3','н-4','н-5','н-6','н-7'];

function draw(){
  const d = V(), dd = DD(), sl = slice();
  const cats = sl.cur.map(r=>ruD(r.date));
  const pick = f => sl.cur.map(r=>r[f]==null? null : r[f]);
  const pad = (arr) => { const v = arr.filter(x=>x!=null); if(!v.length) return {};
    const mn=Math.min(...v), mx=Math.max(...v), span=Math.max(1, mx-mn);
    return { min: mn - span*0.18, max: mx + span*0.18 }; };
  const lineBase = (h) => Object.assign(base(h,'line'), {
    xaxis:{categories:cats, axisBorder:{show:false}, axisTicks:{show:false},
           tickAmount: Math.min(6, Math.max(2, cats.length)),
           labels:{style:{fontSize:'10.5px'}, rotate:-38, rotateAlways:false, hideOverlappingLabels:true, trim:false, offsetY:2}},
    markers:{size:0, hover:{size:8}, strokeWidth:2, strokeColors:SURF()},
    tooltip:{enabled:true, theme:A()?'dark':'light', shared:true, intersect:false} });

  /* запросы в топ-10 по дням: одна серия, подпись только на конце */
  if(document.getElementById('c-h10')){
    const v = pick('top10');
    mk('c-h10', Object.assign(lineBase(260), {
      series:[{name:'Топ-10', data:v}], colors:[P(2)],
      yaxis:Object.assign({labels:{style:{fontSize:'11px'}, formatter:x=>nf(Math.round(x))}}, pad(v)),
      dataLabels:{enabled:true, background:{enabled:false},
        formatter:(x,o)=> o.dataPointIndex===v.length-1 && x!=null ? nf(x) : '',
        offsetY:-9, style:{fontSize:'11px', fontWeight:600, colors:[INK()]}} }));
  }
  /* видимость в ИИ по дням */
  if(document.getElementById('c-hvis')){
    const v = pick('vis');
    mk('c-hvis', Object.assign(lineBase(280), {
      chart:Object.assign(lineBase(280).chart,{type:'area'}),
      series:[{name:'Видимость, %', data:v}], colors:[P(0)],
      yaxis:Object.assign({labels:{style:{fontSize:'11px'}, formatter:x=>Math.round(x)}}, pad(v)),
      fill:{type:'gradient', gradient:{shadeIntensity:.25, opacityFrom:.28, opacityTo:.02, stops:[0,100]}},
      dataLabels:{enabled:true, background:{enabled:false},
        formatter:(x,o)=> o.dataPointIndex===v.length-1 && x!=null ? x+'%' : '',
        offsetY:-9, style:{fontSize:'11px', fontWeight:600, colors:[INK()]}} }));
  }
  /* топ-10 и топ-50 вместе: логарифмическая ось, легенда обязательна */
  if(document.getElementById('c-pos')){
    mk('c-pos', Object.assign(lineBase(320), {
      series:[{name:'Топ-10', data:pick('top10')},{name:'Топ-50', data:pick('top50')}],
      colors:[P(2), P(1)],
      yaxis:{logarithmic:true, labels:{style:{fontSize:'11px'}, formatter:v=>nf(Math.round(v))}},
      legend:{show:true, position:'top', horizontalAlign:'left', fontSize:'11.5px', markers:{width:9,height:9,radius:3}} }));
  }
  /* всё на одной шкале через индекс: первая точка периода это 100 */
  if(document.getElementById('c-idx100')){
    const fs = [['top10','Топ-10'],['top50','Топ-50'],['vis','Видимость']];
    const ser = fs.map(([f,n],i)=>{
      const b = firstOf(sl.cur, f);
      return {name:n, data: sl.cur.map(r=> (r[f]==null||!b) ? null : Math.round(r[f]/b*100))};
    });
    // Поля по краям: без них ряд, просевший к низу шкалы, ложится на ось и не читается
    const vals = ser.flatMap(x=>x.data).filter(v=>v!=null);
    const lo = vals.length? Math.floor((Math.min(...vals) - 12) / 10) * 10 : 0;
    const hi = vals.length? Math.ceil((Math.max(...vals) + 12) / 10) * 10 : 100;
    // Ряд из одной-двух точек линией не рисуется: без маркеров легенда обещает серию,
    // которой на графике нет. Точкам такого ряда даём видимый маркер.
    const mk_ = ser.map(x => x.data.filter(v=>v!=null).length <= 3 ? 6 : 0);
    mk('c-idx100', Object.assign(lineBase(300), {
      series:ser, colors:[P(2),P(1),P(0)],
      markers:{size:mk_, strokeWidth:2, strokeColors:SURF(), hover:{size:8}},
      yaxis:{min:lo, max:hi, tickAmount:Math.min(8, Math.max(3, Math.round((hi-lo)/10))),
             labels:{style:{fontSize:'11px'}, formatter:v=>Math.round(v)}},
      annotations:{yaxis:[{y:100, borderColor:A()?'#39404A':'#C3CBD9', strokeDashArray:0,
        label:{text:'старт периода', position:'left', offsetX:78, offsetY:-2,
               style:{fontSize:'10px', background:SURF(), color:INK()}}}]},
      legend:{show:true, position:'top', horizontalAlign:'left', fontSize:'11.5px', markers:{width:9,height:9,radius:3}} }));
  }
  /* визиты Метрики: две серии */
  if(document.getElementById('c-ym') && d.ym){
    const days = d.ym.days || [];
    const cut = days.slice(Math.max(0, days.length - Math.min(PERIODS[PERIOD], days.length)));
    mk('c-ym', Object.assign(base(300,'area'), {
      series:[{name:'Визиты', data:cut.map(r=>r.visits)},{name:'Из поиска', data:cut.map(r=>r.search_visits)}],
      xaxis:{categories:cut.map(r=>ruD(r.date)), axisBorder:{show:false}, axisTicks:{show:false},
             tickAmount:Math.min(6,Math.max(2,cut.length)),
             labels:{style:{fontSize:'10.5px'}, rotate:-38, hideOverlappingLabels:true}},
      colors:[P(2), P(1)],
      fill:{type:'gradient', gradient:{opacityFrom:.26, opacityTo:.02}},
      markers:{size:0, hover:{size:8}},
      legend:{show:true, position:'top', horizontalAlign:'left', fontSize:'11.5px', markers:{width:9,height:9,radius:3}},
      tooltip:{enabled:true, theme:A()?'dark':'light', shared:true, intersect:false} }));
  }

  /* воронка топ-N: одна серия, логарифмическая ось, подпись только на концах */
  if(document.getElementById('c-fun')){
    const rows = [['топ-1',d.top1],['топ-3',d.top3],['топ-5',d.top5],['топ-10',d.top10],['топ-50',d.top50]]
      .filter(r=>r[1]&&r[1].v!=null);
    const mx = Math.max(...rows.map(r=>r[1].v));
    mk('c-fun', Object.assign(base(260,'bar'), {
      series:[{name:'Запросов', data:rows.map(r=>r[1].v)}],
      xaxis:{categories:rows.map(r=>r[0]), axisBorder:{show:false}, axisTicks:{show:false},
             labels:{style:{fontSize:'11px'}, formatter:v=>nf(Math.round(v))}},
      plotOptions:{bar:{horizontal:true, borderRadius:4, borderRadiusApplication:'end', barHeight:'56%',
        dataLabels:{position:'top'}}},
      colors:[P(2)],
      /* подпись выносится за торец полосы: на коротких столбцах она иначе ложится поверх заливки */
      dataLabels:{enabled:true, textAnchor:'start', offsetX:9, offsetY:1,
        style:{fontSize:'11px', fontWeight:600, colors:[INK()]},
        formatter:v=>nf(v)},
      tooltip:{enabled:true, theme:A()?'dark':'light'} }));
  }

  /* доля в ответах ИИ: одна серия, девять систем */
  if(document.getElementById('c-ai')){
    mk('c-ai', Object.assign(base(280,'bar'), {
      series:[{name:'Видимость, %', data:dd.ai.map(r=>r[1])}],
      xaxis:{categories:dd.ai.map(r=>r[0]), labels:{rotate:-38, style:{fontSize:'10px'}}, axisBorder:{show:false}, axisTicks:{show:false}},
      plotOptions:{bar:{borderRadius:4, borderRadiusApplication:'end', columnWidth:'52%'}},
      colors:[P(0)],
      tooltip:{enabled:true, theme:A()?'dark':'light'} }));
  }

  /* динамика топ-50 по неделям: одна серия, точка только на последней */
  if(document.getElementById('c-wk')){
    mk('c-wk', Object.assign(base(270,'line'), {
      series:[{name:'Топ-50', data:dd.wk}],
      xaxis:{categories:wkCats, axisBorder:{show:false}, axisTicks:{show:false}},
      colors:[P(1)],
      markers:{size:0, hover:{size:8}, strokeWidth:2, strokeColors:SURF()},
      dataLabels:{enabled:true, formatter:(v,o)=> o.dataPointIndex===dd.wk.length-1 ? nf(v) : '',
                  offsetY:-9, style:{fontSize:'11px', fontWeight:600, colors:[INK()]}, background:{enabled:false}},
      tooltip:{enabled:true, theme:A()?'dark':'light'} }));
  }

  /* видимость ИИ по неделям: площадь, одна серия */
  if(document.getElementById('c-aiwk')){
    mk('c-aiwk', Object.assign(base(280,'area'), {
      series:[{name:'Видимость, %', data:dd.aiwk}],
      xaxis:{categories:wkCats, axisBorder:{show:false}, axisTicks:{show:false}},
      colors:[P(0)],
      fill:{type:'gradient', gradient:{shadeIntensity:.25, opacityFrom:.30, opacityTo:.02, stops:[0,100]}},
      markers:{size:0, hover:{size:8}, strokeWidth:2, strokeColors:SURF()},
      tooltip:{enabled:true, theme:A()?'dark':'light'} }));
  }

  /* вес страниц: один тон, площадь уже несёт величину */
  if(document.getElementById('c-tree')){
    mk('c-tree', Object.assign(base(300,'treemap'), {
      series:[{data: dd.pg.map(r=>({x:r[0], y:r[2]}))}],
      colors:[P(2)],
      plotOptions:{treemap:{distributed:false, enableShades:false}},
      dataLabels:{enabled:true, style:{fontSize:'11.5px', fontWeight:600}, offsetY:-2},
      stroke:{width:2, colors:[SURF()]},
      tooltip:{enabled:true, theme:A()?'dark':'light', y:{formatter:v=>nf(v)}} }));
  }

  /* пончики: пять долей, легенда всегда, подписи процентов на секторах */
  [['c-src', dd.src, ['Свой сайт','Подборки «Топ-N»','Каталоги','Маркетплейсы','Прочее']],
   ['c-ymsrc',[52,18,15,9,6], ['Поиск Яндекс','Прямые','Google','Переходы','Соцсети']],
   ['c-anc', dd.anc.map(r=>r[1]), dd.anc.map(r=>r[0])]].forEach(([id,ser,lab])=>{
    if(!document.getElementById(id)) return;
    mk(id, Object.assign(base(300,'donut'), {
      series:ser, labels:lab,
      colors:[P(0),P(1),P(2),P(3),P(4)],
      stroke:{width:2, colors:[SURF()]},
      legend:{show:true, position:'bottom', fontSize:'11.5px', markers:{width:9,height:9,radius:3}, itemMargin:{horizontal:7,vertical:3}},
      dataLabels:{enabled:true, style:{fontSize:'11px', fontWeight:600}, dropShadow:{enabled:false}, formatter:v=>Math.round(v)+'%'},
      plotOptions:{pie:{donut:{size:'62%', labels:{show:true, total:{show:true, label:'всего', fontSize:'12px',
        formatter:()=>ser.reduce((a,b)=>a+b,0)+'%'}}}}},
      tooltip:{enabled:true, theme:A()?'dark':'light'} }));
  });

  /* история выдачи: ось перевёрнута, первая позиция сверху */
  if(document.getElementById('c-serp')){
    mk('c-serp', Object.assign(base(280,'line'), {
      series:[{name:'Позиция', data:[9,8,8,6,7,5,5]}],
      xaxis:{categories:wkCats, axisBorder:{show:false}, axisTicks:{show:false}},
      yaxis:{reversed:true, min:1, max:10, tickAmount:9, labels:{style:{fontSize:'11px'}}},
      colors:[P(1)],
      markers:{size:5, strokeWidth:2, strokeColors:SURF(), hover:{size:8}},
      tooltip:{enabled:true, theme:A()?'dark':'light'} }));
  }

  /* тепловая карта: последовательная шкала, один тон светлее к темнее */
  if(document.getElementById('c-heat')){
    const q = ['запрос 1','запрос 2','запрос 3','запрос 4','запрос 5'];
    const m = [[10,6,4,2,1],[6,10,5,3,2],[4,5,10,6,3],[2,3,6,10,7],[1,2,3,7,10]];
    mk('c-heat', Object.assign(base(320,'heatmap'), {
      series: q.map((n,i)=>({name:n, data:q.map((nn,j)=>({x:nn, y:m[i][j]}))})),
      colors:[PS(3)],
      plotOptions:{heatmap:{shadeIntensity:.55, radius:3, useFillColorAsStroke:false,
        colorScale:{ranges:[
          {from:0,to:2,color:PS(0),name:'0-2 общих URL'},
          {from:3,to:4,color:PS(1),name:'3-4'},
          {from:5,to:6,color:PS(2),name:'5-6'},
          {from:7,to:8,color:PS(3),name:'7-8'},
          {from:9,to:10,color:PS(4),name:'9-10'}]}}},
      stroke:{width:2, colors:[SURF()]},
      legend:{show:true, position:'bottom', fontSize:'11px', markers:{width:9,height:9,radius:3}},
      tooltip:{enabled:true, theme:A()?'dark':'light'} }));
  }

  /* объём рекламы: выделение одного столбца, остальные нейтральны */
  [['c-ads', 290],['c-ads2', 290]].forEach(([id,h])=>{
    if(!document.getElementById(id)) return;
    const our = CUR==='gm' ? (d.ads? d.ads.v : 0) : 0;
    const cats = ['мы','лидер ниши','второй','третий'];
    const vals = [our, 314, 186, 70];
    const neutral = A() ? '#39404A' : '#C3CBD9';
    mk(id, Object.assign(base(h,'bar'), {
      series:[{name:'Объявлений', data:vals}],
      xaxis:{categories:cats, axisBorder:{show:false}, axisTicks:{show:false}, labels:{style:{fontSize:'11px'}}},
      plotOptions:{bar:{borderRadius:4, borderRadiusApplication:'end', columnWidth:'50%', distributed:true}},
      colors:[P(2), neutral, neutral, neutral],
      legend:{show:false},
      dataLabels:{enabled:true, offsetY:-18, style:{fontSize:'11px', fontWeight:600, colors:[INK()]}, formatter:v=>nf(v)},
      tooltip:{enabled:true, theme:A()?'dark':'light'} }));
  });

  /* рост доноров */
  if(document.getElementById('c-don')){
    mk('c-don', Object.assign(base(280,'line'), {
      series:[{name:'Доноров', data:[498,503,507,511,514,517,519]}],
      xaxis:{categories:wkCats, axisBorder:{show:false}, axisTicks:{show:false}},
      colors:[P(4)], markers:{size:0, hover:{size:8}},
      tooltip:{enabled:true, theme:A()?'dark':'light'} }));
  }

  /* визиты Метрики: площадь, заглушка */
  if(document.getElementById('c-traf')){
    mk('c-traf', Object.assign(base(280,'area'), {
      series:[{name:'Визиты', data:[0,0,0,0,0,0,0]}],
      xaxis:{categories:['пн','вт','ср','чт','пт','сб','вс'], axisBorder:{show:false}, axisTicks:{show:false}},
      yaxis:{max:10, labels:{style:{fontSize:'11px'}}},
      colors:[P(3)],
      fill:{type:'gradient', gradient:{opacityFrom:.20, opacityTo:.02}},
      noData:{text:'Счётчик не подключён', style:{fontSize:'13px', color:INK()}},
      tooltip:{enabled:true, theme:A()?'dark':'light'} }));
  }

  /* расход и лиды: две серии, значит легенда обязательна */
  if(document.getElementById('c-cost')){
    mk('c-cost', Object.assign(base(280,'bar'), {
      series:[{name:'Расход, ₽', data:[0,0,0,0,0,0,0]},{name:'Лиды', data:[0,0,0,0,0,0,0]}],
      xaxis:{categories:wkCats, axisBorder:{show:false}, axisTicks:{show:false}},
      plotOptions:{bar:{borderRadius:4, borderRadiusApplication:'end', columnWidth:'54%'}},
      colors:[P(2), P(1)],
      stroke:{width:2, colors:[SURF()]},
      legend:{show:true, position:'top', horizontalAlign:'left', fontSize:'11.5px', markers:{width:9,height:9,radius:3}},
      noData:{text:'Кабинет не подключён', style:{fontSize:'13px', color:INK()}},
      tooltip:{enabled:true, theme:A()?'dark':'light', shared:true, intersect:false} }));
  }

  /* покрытие индексом */
  if(document.getElementById('c-idx')){
    mk('c-idx', Object.assign(base(260,'radialBar'), {
      series:[0], labels:['в индексе'],
      colors:[P(2)],
      plotOptions:{radialBar:{hollow:{size:'62%'}, track:{background:A()?'#1A1E24':'#EEF1F6'},
        dataLabels:{name:{fontSize:'12px', color:INK()}, value:{fontSize:'22px', fontWeight:700, color:INKH(), formatter:v=>v+'%'}}}},
      tooltip:{enabled:false} }));
  }
}
'''
