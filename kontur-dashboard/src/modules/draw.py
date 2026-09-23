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
/* Графики прежнего экрана уничтожаются до смены разметки. Иначе их DOM уже выброшен,
   а ApexCharts продолжает перерисовывать их на каждое изменение размера окна: в консоли
   сыплются NaN и отрицательные размеры SVG, а экземпляры копятся в памяти. */
function killCharts(){
  Object.keys(CH).forEach(k => { try{ CH[k].destroy(); }catch(e){} delete CH[k]; });
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

  /* динамика топ-50 по неделям: одна серия, точка только на последней */
  if(document.getElementById('c-wk')){
    mk('c-wk', Object.assign(base(270,'line'), {
      series:[{name:'Топ-50', data:dd.wk}],
      xaxis:{categories:wkCats, axisBorder:{show:false}, axisTicks:{show:false}},
      colors:[P(1)],
      markers:{size:5, hover:{size:8}, strokeWidth:2, strokeColors:SURF()},
      dataLabels:{enabled:true, formatter:(v,o)=> o.dataPointIndex===dd.wk.length-1 && v!=null ? nf(v) : '',
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
      markers:{size:4, hover:{size:8}, strokeWidth:2, strokeColors:SURF()},
      tooltip:{enabled:true, theme:A()?'dark':'light'} }));
  }

  /* вес страниц: один тон, площадь уже несёт величину */
  if(document.getElementById('c-tree')){
    mk('c-tree', Object.assign(base(300,'treemap'), {
      series:[{data: (d.pg||[]).map(r=>{ let u=String(r.url||''); try{ u=new URL(u).pathname; }catch(e){} return {x:u, y:r.keywords_top50||0}; })}],
      colors:[P(2)],
      plotOptions:{treemap:{distributed:false, enableShades:false}},
      dataLabels:{enabled:true, style:{fontSize:'11.5px', fontWeight:600}, offsetY:-2},
      stroke:{width:2, colors:[SURF()]},
      tooltip:{enabled:true, theme:A()?'dark':'light', y:{formatter:v=>nf(v)}} }));
  }

  /* объём рекламы у первой пятёрки конкурентов: настоящие объявления из выгрузки keys.so */
  if(document.getElementById('c-ads')){
    const top = (d.adc||[]).slice(0,5);
    mk('c-ads', Object.assign(base(290,'bar'), {
      series:[{name:'Объявлений', data:top.map(r=>r.ads_count||0)}],
      xaxis:{categories:top.map(r=>r.domain), axisBorder:{show:false}, axisTicks:{show:false}, labels:{style:{fontSize:'11px'}}},
      plotOptions:{bar:{borderRadius:4, borderRadiusApplication:'end', columnWidth:'50%'}},
      colors:[P(2)],
      dataLabels:{enabled:true, offsetY:-18, style:{fontSize:'11px', fontWeight:600, colors:[INK()]}, formatter:v=>nf(v)},
      tooltip:{enabled:true, theme:A()?'dark':'light'} }));
  }

}
'''
