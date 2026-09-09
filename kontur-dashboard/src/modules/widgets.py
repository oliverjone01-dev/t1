# -*- coding: utf-8 -*-
WIDGETS = r'''
/* ============ ВИДЖЕТЫ ============ */
function ic(n,cl,sz){ return '<svg class="'+(cl||'')+'" width="'+(sz||17)+'" height="'+(sz||17)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+(I[n]||I.grid)+'"/></svg>'; }

const bAPI  = '<span class="kmark k-ok" title="Данные приходят по API keys.so">API</span>';
const bDEMO = '<span class="kmark k-crit" title="Кабинет не подключён, экран собран на заглушках">ДЕМО</span>';
const bSOON = '<span class="kmark k-warn" title="Метод есть, выгрузка ещё не настроена">СБОРКА</span>';

function head(t, sub, src, prio, badge, money){
  const pr = prio ? '<span class="kmark k-neu" title="Приоритет виджета: P0 самый высокий">'+prio+'</span>' : '';
  return '<div class="mb-4">'
   + '<div class="flex flex-wrap items-center gap-2 mb-1"><h1 class="text-[19px] font-bold hd">'+esc(t)+'</h1>'+(badge||'')+pr+'</div>'
   + (sub? '<p class="text-[13px] max-w-3xl leading-snug">'+esc(sub)+'</p>':'')
   + (src? '<div class="text-[11px] mt-1 opacity-55 font-mono">'+esc(src)+'</div>':'')
   + (money? '<div class="mt-3 rounded-lg border border-dashed bdr px-3 py-2 text-[12.5px] flex items-start gap-2"><span class="mt-[2px] opacity-60">'+ic('wallet','',15)+'</span><span>'+money+'</span></div>':'')
   + '</div>';
}

/* Плитка. Иконка в тонированном квадрате, значение, дельта и класс цифры. */
function mini(label, f, slot, icon, dfield){
  const c = P(slot);
  const d = dfield ? '<div class="mt-1">'+dbadge(dfield)+'</div>' : '';
  const shown = (f && typeof f==='object' && 'v' in f);
  return '<div class="cd pane p-3.5">'
   + '<div class="flex items-start justify-between gap-2">'
   +   '<div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style="background:color-mix(in oklab, '+c+' 14%, transparent);color:'+c+'">'+ic(icon||'chart','',18)+'</div>'
   +   (shown? kmark(f.k) : '')
   + '</div>'
   + '<div class="mt-2.5 hero text-[22px] font-bold hd leading-none">'+(shown? val(f) : esc(f))+'</div>'
   + d
   + '<div class="text-[11.5px] mt-1.5 leading-tight">'+esc(label)+'</div>'
   + (shown? srcline(f) : '')
   + '</div>';
}

/* Карточка графика. У каждого графика есть таблица-двойник: переключатель в шапке. */
let _tw = 0;
function card(t, sub, body, cls, right, table){
  let tgl = '', tb = '';
  if(table){
    const id = 'tv'+(++_tw);
    tgl = '<button onclick="tv(\''+id+'\',this)" class="noprint text-[11px] px-2 py-1 rounded-md border bdr hovr transition">таблица</button>';
    tb  = '<div id="'+id+'" hidden class="mt-3 scroll-x">'+table+'</div>';
  }
  return '<div class="cd pane p-4 '+(cls||'')+'">'
   + '<div class="flex items-start justify-between gap-3 mb-3">'
   +   '<div><div class="font-semibold text-[14px] hd">'+esc(t)+'</div>'
   +   (sub? '<div class="text-[11.5px] mt-0.5 opacity-70 leading-tight">'+esc(sub)+'</div>':'')+'</div>'
   +   '<div class="flex items-center gap-1.5 shrink-0">'+(right||'')+tgl+'</div>'
   + '</div>' + body + tb + '</div>';
}
function tv(id, btn){
  const el = document.getElementById(id); if(!el) return;
  el.hidden = !el.hidden; btn.textContent = el.hidden ? 'таблица' : 'скрыть';
}
const ch = (id, h) => '<div id="'+id+'" style="min-height:'+h+'px"></div>';

/* Таблица. cols: [заголовок, выравнивание вправо?] */
function tbl(cols, rows, foot){
  let h = '<div class="scroll-x"><table class="dv"><thead><tr>' + cols.map(c=>'<th'+(c[1]?' style="text-align:right"':'')+'>'+esc(c[0])+'</th>').join('') + '</tr></thead><tbody>';
  h += rows.map(r=>'<tr>'+r.map((c,i)=>'<td'+(cols[i]&&cols[i][1]?' style="text-align:right" class="num"':'')+'>'+c+'</td>').join('')+'</tr>').join('');
  h += '</tbody>' + (foot? '<tfoot><tr>'+foot.map((c,i)=>'<td'+(cols[i]&&cols[i][1]?' style="text-align:right" class="num font-semibold"':' class="font-semibold"')+'>'+c+'</td>').join('')+'</tr></tfoot>':'') + '</table></div>';
  return h;
}
/* Горизонтальные полосы. Один ряд - один цвет слота, никакой заливки по величине. */
function bars(items, slot){
  const c = P(slot||0);
  const mx = Math.max(...items.map(i=>i[1]), 1);
  return '<div class="space-y-2.5">' + items.map(i=>
    '<div><div class="flex justify-between text-[12px] mb-1"><span class="truncate pr-2">'+esc(i[0])+'</span><span class="num font-semibold hd">'+nf(i[1])+(i[2]?' <span class="opacity-50 font-normal">'+esc(i[2])+'</span>':'')+'</span></div>'
    + '<div class="h-[7px] rounded-full trk overflow-hidden"><div style="width:'+Math.max(2,i[1]/mx*100)+'%;background:'+c+'" class="h-full rounded-full"></div></div></div>'
  ).join('') + '</div>';
}
function note(t, body, tone){
  const to = tone||'info';
  const icn = {ok:'check',warn:'warn',crit:'warn',info:'bulb'}[to];
  return '<div class="nt nt-'+to+'">'
   + '<span class="nt-i">'+ic(icn,'',17)+'</span>'
   + '<div><div class="font-semibold text-[13px] hd mb-0.5">'+esc(t)+'</div><div class="text-[12.5px] leading-snug">'+body+'</div></div></div>';
}
/* Следующий шаг: без имени и даты блок не рисуется. Шаг 7 ядра Богдана. */
function act(what, who, when, crit){
  return '<div class="cd pane p-4">'
   + '<div class="flex items-center gap-2 mb-2 hd font-semibold text-[13px]">'+ic('target','',16)+'Следующий шаг</div>'
   + '<div class="text-[13px] leading-snug mb-2.5">'+esc(what)+'</div>'
   + '<div class="flex flex-wrap gap-x-5 gap-y-1 text-[12px]">'
   +   '<span class="opacity-60">кто:</span><span class="font-semibold hd">'+esc(who)+'</span>'
   +   '<span class="opacity-60">когда:</span><span class="font-semibold hd">'+esc(when)+'</span>'
   + '</div>'
   + (crit? '<div class="text-[12px] mt-2 pt-2 border-t bdr"><span class="opacity-60">критерий «идём дальше»:</span> '+esc(crit)+'</div>':'')
   + '</div>';
}
/* Вердикт для собственника: одна строка, отвечающая на вопрос «стало лучше или хуже».
   Считается по ряду, а не по ощущению, и честно говорит, когда ряда не хватает. */
function verdict(){
  const fields = [['top10','запросы в топ-10'],['top50','запросы в топ-50'],['visibility','видимость в ИИ']];
  const rows = fields.map(([f,n])=>[n, dyn(f), f]).filter(r=>r[1].abs!=null);
  const single = fields.map(([f,n])=>[n, dyn(f)]).filter(r=>r[1].one && r[1].now!=null);
  const s = slice();
  if(!rows.length){
    return note('Сравнить не с чем',
      'За выбранный период ('+PERIOD_LABEL[PERIOD]+') в ряду нет двух точек. Возьми период шире или дождись следующего съёма.','warn');
  }
  const good = rows.filter(r=>tone(r[2], r[1].abs)==='good').length;
  const bad  = rows.filter(r=>tone(r[2], r[1].abs)==='bad').length;
  const tail = !s.full
    ? ' Ряд короче выбранного периода: сравнение идёт от первой имеющейся точки '+ruD(SER()[0] ? SER()[0].date : '')+', а не от полной глубины.'
    : '';
  const body = rows.map(r=>{
      const d=r[1], t=tone(r[2],d.abs), col=t==='good'?ST('ok'):t==='bad'?ST('crit'):INK();
      return '<div class="flex items-baseline gap-2 flex-wrap"><span class="hd font-medium">'+esc(r[0])+':</span>'
        + '<span class="num">'+nf(d.was)+' в '+ruD(d.from.toISOString().slice(0,10))+'</span>'
        + '<span class="opacity-50">до</span><span class="num hd font-semibold">'+nf(d.now)+' в '+ruD(d.to.toISOString().slice(0,10))+'</span>'
        + '<span class="font-semibold" style="color:'+col+'">'+(d.abs>0?'+':'')+nf(d.abs)+'</span>'
        + (d.vsPrev!=null? '<span class="opacity-55 text-[12px]">отрезком раньше было '+nf(d.prev)+'</span>':'')
        + '</div>';
    }).join('');
  const head = bad===0 ? 'Стало лучше' : good===0 ? 'Стало хуже' : 'Разнонаправленно';
  const tn   = bad===0 ? 'ok' : good===0 ? 'crit' : 'warn';
  return note(head + ' за ' + PERIOD_LABEL[PERIOD],
    '<div class="space-y-1.5 mt-1">'+body+'</div>'
    + '<div class="mt-2 opacity-70">Точек в периоде: '+nf(s.cur.length)+'.'+esc(tail)
    + (single.length? ' По метрикам «'+single.map(r=>esc(r[0])).join('», «')+'» в периоде одна точка, они в вердикт не входят.' : '')
    + '</div>', tn);
}

const g2 = 'grid grid-cols-1 lg:grid-cols-2 gap-4';
const g3 = 'grid grid-cols-2 lg:grid-cols-4 gap-4';
const g4 = 'grid grid-cols-1 xl:grid-cols-3 gap-4';
'''
