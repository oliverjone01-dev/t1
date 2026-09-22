/* ==========================================================================
   Контур DS · графики на ApexCharts 3.54.1
   Цвета не записаны в коде: читаются из CSS-переменных текущей темы.
   Сменил тему в tokens.css, графики перекрасились сами. Hex в этом файле
   запрещён, это проверяет tools/check_ds.py.

   Правила, зашитые в пресеты:
   - категориальные цвета в фиксированном порядке, никогда по кругу, максимум пять;
   - одна серия без легенды, две и больше с легендой;
   - подпись значения только на конце линии, не на каждой точке;
   - сетка сплошная и тише фона, пунктира нет;
   - двух осей Y нет вообще: разные по величине ряды идут через KS.charts.index();
   - ряд из трёх и меньше точек получает маркеры, иначе линия просто не нарисуется;
   - у оси поля сверху и снизу, чтобы просевший ряд не ложился на границу.
   ========================================================================== */
(function(g){
const KS = g.KS = g.KS || {};
const C = KS.charts = { inst:{} };
/* Переменные читаются из самого контейнера графика: тема может быть задана не на
   корне, а на вложенном блоке с data-theme, и тогда график обязан взять её цвета. */
C._el = null;
const v = name => getComputedStyle(C._el || document.documentElement).getPropertyValue(name).trim();
const at = id => { C._el = document.getElementById(id); return C._el; };
C.cat = i => v('--cat-' + (((i - 1) % 5) + 1));      /* слот 1..5 */
C.seq = i => v('--seq-' + Math.max(1, Math.min(5, i)));
C.ink = () => v('--axis');
C.inkStrong = () => v('--text-strong');
C.surface = () => v('--surface');
C.neutral = () => v('--neutral-bar');
C.dark = () => { const box = C._el && C._el.closest('[data-theme]');
  if(box) return box.getAttribute('data-theme') === 'dark';
  return KS.theme ? KS.theme.isDark() : matchMedia('(prefers-color-scheme: dark)').matches; };
const nf = x => KS.fmt ? KS.fmt.nf(x) : String(x);

/* на телефоне у дат вида 20.08.2026 отрезается год: пять подписей помещаются в строку */
C.shortDate = v => typeof v === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(v) ? v.slice(0, 5) : v;
C.base = function(h, type){
  return {
    chart:{ type, height:h, fontFamily:v('--font-sans') || '-apple-system, BlinkMacSystemFont, Golos Text, sans-serif', foreColor:C.ink(),
            toolbar:{ show:false }, parentHeightOffset:0,
            animations:{ enabled:!matchMedia('(prefers-reduced-motion: reduce)').matches, easing:'easeinout', speed:520 } },
    grid:{ borderColor:v('--grid'), strokeDashArray:0, padding:{ left:14, right:18, top:0, bottom:12 } },
    dataLabels:{ enabled:false },
    legend:{ show:false },
    stroke:{ width:2, lineCap:'round', curve:'straight' },
    tooltip:{ theme:C.dark() ? 'dark' : 'light', style:{ fontSize:'12px' } },
    xaxis:{ axisBorder:{ show:false }, axisTicks:{ show:false }, labels:{ style:{ fontSize:'11px' } } },
    yaxis:{ labels:{ style:{ fontSize:'11px' }, formatter: x => nf(Math.round(x)) } },
    states:{ hover:{ filter:{ type:'lighten', value:.06 } } },
    /* телефон: ниже, меньше подписей по оси, уже поля; значения из ширины окна */
    responsive:[{ breakpoint:640, options:{ chart:{ height:Math.round(h * 0.84) }, xaxis:{ tickAmount:4, labels:{ formatter:C.shortDate } }, grid:{ padding:{ left:6, right:10, top:0, bottom:8 } } } }]
  };
};
C.legend = () => ({ show:true, position:'top', horizontalAlign:'left', fontSize:'12px', markers:{ width:9, height:9, radius:3 }, itemMargin:{ horizontal:8 } });
C.pad = function(arr, share){
  const x = arr.filter(n => n != null); if(!x.length) return {};
  const mn = Math.min(...x), mx = Math.max(...x), span = Math.max(1, mx - mn), k = share == null ? 0.18 : share;
  return { min: mn - span * k, max: mx + span * k };
};
C.dateAxis = cats => ({ categories:cats, axisBorder:{ show:false }, axisTicks:{ show:false }, tickAmount:Math.min(6, Math.max(2, cats.length)),
  labels:{ style:{ fontSize:'11px' }, rotate:-38, hideOverlappingLabels:true } });
/* Пустой ряд в ApexCharts даёт размеры NaN и пустую рамку. Вместо этого пишем,
   чего не хватает: график без данных должен выглядеть как отсутствие данных. */
C.empty = function(el, text){
  if(C.inst[el.id]){ try{ C.inst[el.id].destroy(); }catch(e){} delete C.inst[el.id]; }
  el.innerHTML = '<div style="height:100%;min-height:inherit;display:grid;place-items:center;text-align:center;'
    + 'color:var(--text-muted);font-size:var(--fs-small);border:1px dashed var(--border);border-radius:var(--r-md);padding:var(--sp-4)">'
    + (text || 'Данных за период нет') + '</div>';
  return null;
};
const hasData = opt => {
  const s = opt.series; if(!s || !s.length) return false;
  if(typeof s[0] === 'number') return s.some(x => x != null && x !== 0);
  return s.some(x => (x.data || []).some(p => p != null && (typeof p !== 'object' || p.y != null)));
};
C.render = function(id, opt){
  C.prune();
  const el = document.getElementById(id); if(!el) return null;
  if(!hasData(opt)) return C.empty(el, opt.emptyText);
  if(!g.ApexCharts) return C.empty(el, 'Библиотека графиков не загрузилась');
  if(C.inst[id]){ try{ C.inst[id].destroy(); }catch(e){} }
  C.inst[id] = new g.ApexCharts(el, opt); C.inst[id].render(); return C.inst[id];
};
C.destroyAll = () => { Object.values(C.inst).forEach(c => { try{ c.destroy(); }catch(e){} }); C.inst = {}; };
/* Экран перерисовали через innerHTML: контейнеры графиков исчезли, а экземпляры
   ApexCharts остались и продолжают слушать resize окна. На следующем изменении
   размера они рисуют в оторванный от документа узел шириной ноль: отсюда SVG с
   размерами NaN и утечка памяти. Чистим всё, чей контейнер больше не в документе. */
C.prune = function(){
  for(const [id, c] of Object.entries(C.inst)){
    const el = document.getElementById(id);
    if(!el || !el.isConnected || !el.querySelector('.apexcharts-canvas')){ try{ c.destroy(); }catch(e){} delete C.inst[id]; }
  }
};

/* Линия, одна серия. Подпись только на последней точке. */
C.line = function(id, { cats, data, name, slot, h, area, suffix } = {}){
  at(id);
  const o = C.base(h || 260, area ? 'area' : 'line');
  return C.render(id, Object.assign(o, {
    series:[{ name: name || '', data }], colors:[C.cat(slot || 3)], xaxis:C.dateAxis(cats),
    yaxis:Object.assign({ labels:{ style:{ fontSize:'11px' }, formatter: x => nf(Math.round(x)) } }, C.pad(data)),
    markers:{ size: data.filter(x => x != null).length <= 3 ? 6 : 0, hover:{ size:8 }, strokeWidth:2, strokeColors:C.surface() },
    fill: area ? { type:'gradient', gradient:{ shadeIntensity:.25, opacityFrom:.28, opacityTo:.02, stops:[0,100] } } : { type:'solid' },
    dataLabels:{ enabled:true, background:{ enabled:false }, offsetY:-9, style:{ fontSize:'11px', fontWeight:600, colors:[C.ink()] },
      formatter:(x, op) => op.dataPointIndex === data.length - 1 && x != null ? nf(x) + (suffix || '') : '' },
    tooltip:{ enabled:true, theme:C.dark() ? 'dark' : 'light', shared:true, intersect:false }
  }));
};
/* Несколько серий одной природы и одного масштаба. Легенда обязательна. */
C.multi = function(id, { cats, series, h, log, area } = {}){
  at(id);
  const o = C.base(h || 300, area ? 'area' : 'line');
  const all = series.flatMap(s => s.data);
  return C.render(id, Object.assign(o, {
    series, colors:series.map((s, i) => C.cat(s.slot || i + 1)), xaxis:C.dateAxis(cats), legend:C.legend(),
    yaxis: log ? { logarithmic:true, labels:{ style:{ fontSize:'11px' }, formatter: x => nf(Math.round(x)) } }
               : Object.assign({ labels:{ style:{ fontSize:'11px' }, formatter: x => nf(Math.round(x)) } }, C.pad(all)),
    markers:{ size:series.map(s => s.data.filter(x => x != null).length <= 3 ? 6 : 0), hover:{ size:8 }, strokeWidth:2, strokeColors:C.surface() },
    fill: area ? { type:'gradient', gradient:{ opacityFrom:.24, opacityTo:.02 } } : { type:'solid' },
    tooltip:{ enabled:true, theme:C.dark() ? 'dark' : 'light', shared:true, intersect:false }
  }));
};
/* Разные по величине ряды на одной оси: каждый приведён к 100 на старте. Вместо двух осей Y. */
C.index = function(id, { cats, series, h } = {}){
  at(id);
  const idx = series.map((s, i) => { const b = s.data.find(x => x != null);
    return { name:s.name, slot:s.slot || i + 1, data:s.data.map(x => x == null || !b ? null : Math.round(x / b * 100)) }; });
  const vals = idx.flatMap(s => s.data).filter(x => x != null);
  const lo = vals.length ? Math.floor((Math.min(...vals) - 12) / 10) * 10 : 0;
  const hi = vals.length ? Math.ceil((Math.max(...vals) + 12) / 10) * 10 : 120;
  const o = C.base(h || 300, 'line');
  return C.render(id, Object.assign(o, {
    series:idx, colors:idx.map(s => C.cat(s.slot)), xaxis:C.dateAxis(cats), legend:C.legend(),
    yaxis:{ min:lo, max:hi, tickAmount:Math.min(8, Math.max(3, Math.round((hi - lo) / 10))), labels:{ style:{ fontSize:'11px' }, formatter: x => Math.round(x) } },
    markers:{ size:idx.map(s => s.data.filter(x => x != null).length <= 3 ? 6 : 0), hover:{ size:8 }, strokeWidth:2, strokeColors:C.surface() },
    annotations:{ yaxis:[{ y:100, borderColor:v('--border-strong'), strokeDashArray:0,
      label:{ text:'старт периода', position:'left', offsetX:78, offsetY:-2, style:{ fontSize:'11px', background:C.surface(), color:C.ink() } } }] },
    tooltip:{ enabled:true, theme:C.dark() ? 'dark' : 'light', shared:true, intersect:false }
  }));
};
/* Горизонтальные полосы, одна серия. Число вынесено за торец, иначе садится на короткий столбец. */
C.hbar = function(id, { cats, data, name, slot, h } = {}){
  at(id);
  const o = C.base(h || 260, 'bar');
  return C.render(id, Object.assign(o, {
    series:[{ name: name || '', data }], colors:[C.cat(slot || 3)],
    xaxis:{ categories:cats, axisBorder:{ show:false }, axisTicks:{ show:false }, labels:{ style:{ fontSize:'11px' }, formatter: x => nf(Math.round(x)) } },
    plotOptions:{ bar:{ horizontal:true, borderRadius:4, borderRadiusApplication:'end', barHeight:'56%', dataLabels:{ position:'top' } } },
    dataLabels:{ enabled:true, textAnchor:'start', offsetX:9, offsetY:1, style:{ fontSize:'11px', fontWeight:600, colors:[C.ink()] }, formatter: x => nf(x) },
    tooltip:{ enabled:true, theme:C.dark() ? 'dark' : 'light' }
  }));
};
/* Столбцы с выделением одного: наш цветом слота, остальные нейтральным. Это единственный
   законный случай, когда в одной серии разные цвета: выделение, а не раскраска по величине. */
C.emphasis = function(id, { cats, data, focus, slot, h } = {}){
  at(id);
  const o = C.base(h || 290, 'bar');
  return C.render(id, Object.assign(o, {
    series:[{ name:'', data }], colors:cats.map((_, i) => i === (focus || 0) ? C.cat(slot || 3) : C.neutral()),
    xaxis:{ categories:cats, axisBorder:{ show:false }, axisTicks:{ show:false }, labels:{ style:{ fontSize:'11px' } } },
    plotOptions:{ bar:{ borderRadius:4, borderRadiusApplication:'end', columnWidth:'50%', distributed:true } },
    dataLabels:{ enabled:true, offsetY:-18, style:{ fontSize:'11px', fontWeight:600, colors:[C.ink()] }, formatter: x => nf(x) },
    tooltip:{ enabled:true, theme:C.dark() ? 'dark' : 'light' }
  }));
};
/* Пончик: до пяти долей, проценты в легенде (белая подпись на цветном секторе проваливает контраст), в центре итог */
C.donut = function(id, { labels, data, h } = {}){
  at(id);
  const o = C.base(h || 300, 'donut');
  const total = data.reduce((a, b) => a + b, 0);
  return C.render(id, Object.assign(o, {
    series:data, labels, colors:labels.map((_, i) => C.cat(i + 1)), stroke:{ width:2, colors:[C.surface()] },
    legend:{ show:true, position:'bottom', fontSize:'12px', markers:{ width:9, height:9, radius:3 }, itemMargin:{ horizontal:7, vertical:3 },
      formatter:(name, o) => name + '  ' + (total ? Math.round(o.w.globals.series[o.seriesIndex] / total * 100) : 0) + '%' },
    dataLabels:{ enabled:false },
    plotOptions:{ pie:{ donut:{ size:'62%', labels:{ show:true, total:{ show:true, label:'всего', fontSize:'12px', formatter:() => nf(total) } } } } },
    tooltip:{ enabled:true, theme:C.dark() ? 'dark' : 'light' }
  }));
};
/* Тепловая карта: последовательная шкала в один тон, границы классов в легенде */
C.heat = function(id, { rows, cols, matrix, ranges, h } = {}){
  at(id);
  const o = C.base(h || 320, 'heatmap');
  const rg = ranges || [[0,2],[3,4],[5,6],[7,8],[9,10]];
  return C.render(id, Object.assign(o, {
    series:rows.map((r, i) => ({ name:r, data:cols.map((c, j) => ({ x:c, y:matrix[i][j] })) })),
    plotOptions:{ heatmap:{ radius:3, enableShades:false,
      colorScale:{ ranges:rg.map((x, i) => ({ from:x[0], to:x[1], color:C.seq(i + 1), name:x[0] + '-' + x[1] })) } } },
    stroke:{ width:2, colors:[C.surface()] }, legend:{ show:true, position:'bottom', fontSize:'11px', markers:{ width:9, height:9, radius:3 } },
    tooltip:{ enabled:true, theme:C.dark() ? 'dark' : 'light' }
  }));
};
/* Кольцо заполнения: один показатель доли, например покрытие индексом */
C.gauge = function(id, { value, label, h } = {}){
  at(id);
  const o = C.base(h || 240, 'radialBar');
  return C.render(id, Object.assign(o, {
    series:[value == null ? 0 : value], labels:[label || ''], colors:[C.cat(3)],
    plotOptions:{ radialBar:{ hollow:{ size:'62%' }, track:{ background:v('--track') },
      dataLabels:{ name:{ fontSize:'12px', color:C.ink() }, value:{ fontSize:'22px', fontWeight:700, color:C.inkStrong(), formatter: x => value == null ? 'нет' : x + '%' } } } },
    tooltip:{ enabled:false }
  }));
};

/* Перерисовать все графики при смене темы: цвета берутся из переменных заново */
document.addEventListener('ks:theme', () => { if(C.onTheme) C.onTheme(); });
})(window);
