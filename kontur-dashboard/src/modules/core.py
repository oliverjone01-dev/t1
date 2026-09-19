# -*- coding: utf-8 -*-
ICONS = open('/home/claude/gm/build/icons.txt', encoding='utf-8').read()

CORE = r'''
/* ============ ПАЛИТРА ГРАФИКОВ ============
   Проверена scripts/validate_palette.js из скилла dataviz.
   Категориальные, фиксированный порядок: purple, teal, blue, amber, cyan.
   light /#FFFFFF  и  dark /#101317 - обе прошли все пять проверок без послаблений. */
const PAL = {
  cat:  { l:['#7B3BC4','#00806A','#3561C9','#A87400','#0F7CB8'],
          d:['#8A5FE9','#00AD81','#5D8AFF','#CE7F00','#009EEC'] },
  seq:  { l:['#96B2EB','#6F93E0','#4A71CB','#2E52AB','#1C3D82'],
          d:['#33507F','#3E6BC0','#5081E4','#6E96FF','#A6C0FF'] },
  div:  { l:{warm:'#A85A00',cool:'#3561C9',mid:'#9AA4B4'},
          d:{warm:'#C57E14',cool:'#5D8AFF',mid:'#64748B'} },
  /* статусные цвета зарезервированы: никогда не используются как «серия N» */
  st:   { l:{ok:'#0F7A52',warn:'#9A6A00',ser:'#B5541A',crit:'#B3261E'},
          d:{ok:'#37D39B',warn:'#E0A82E',ser:'#F0873F',crit:'#FF6B6B'} }
};
const A = () => document.documentElement.classList.contains('dark');
const P  = i => PAL.cat[A()?'d':'l'][i % 5];
const PS = i => PAL.seq[A()?'d':'l'][Math.max(0,Math.min(4,i))];
const ST = n => PAL.st[A()?'d':'l'][n];
const INK  = () => A() ? '#949BA6' : '#5A6A85';
const INKH = () => A() ? '#E7EAEF' : '#2A3547';
const GRID = () => A() ? '#1C2026' : '#EFF2F7';
const SURF = () => A() ? '#101317' : '#FFFFFF';

/* ============ ФОРМАТ И РАЗМЕТКА ПО ПРОТОКОЛУ 9 ============ */
const esc = t => String(t==null?'':t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf  = n => (n==null||n==='') ? '-' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const money = n => (n==null||!isFinite(n)) ? '-' : nf(Math.round(n)) + ' ₽';
const pc  = n => (n==null||!isFinite(n)) ? '-' : (n*100).toFixed(n<0.1?1:0).replace('.',',') + '%';

const KMAP = {
  'ДАННЫЕ':  {cl:'ok',   t:'ДАННЫЕ',   h:'Есть источник и дата съёма. Можно нести Богдану.'},
  'ГИПОТЕЗА':{cl:'warn', t:'ГИПОТЕЗА', h:'Источника нет или это бенчмарк. В план идёт только пессимистичный сценарий.'},
  'ДЕМО':    {cl:'crit', t:'ДЕМО',     h:'Заглушка. Кабинет не подключён, цифра выдумана для вёрстки.'}
};
function kmark(kind){
  const m = KMAP[kind]; if(!m) return '';
  const c = {ok:'k-ok', warn:'k-warn', crit:'k-crit'}[m.cl];
  return '<span class="kmark '+c+'" title="'+esc(m.h)+'">'+m.t+'</span>';
}
/* Каждая цифра проходит через val(): класс, источник и дата приклеены к самой цифре,
   а не к шапке карточки. Скриншот одной плитки уносит с собой свою разметку. */
function val(f, fmt){
  if(!f) return '-';
  const v = (f.v==null) ? null : (fmt? fmt(f.v) : nf(f.v));
  const ttl = f.k + (f.s? ' · '+f.s : '') + (f.at? ' · снято '+f.at : '') + (f.n? ' · '+f.n : '');
  return '<span title="'+esc(ttl)+'">'+(v==null?'<span class="opacity-40">нет</span>':v)+'</span>';
}
const rud = d => !d ? '' : d.split('-').reverse().join('.');
const srcline = f => !f ? '' : '<div class="text-[10.5px] mt-1 opacity-55 leading-tight">'
  + esc(f.s || (f.k==='ДЕМО' ? 'выгрузки нет, поле ждёт подключения' : 'источник не указан'))
  + (f.at ? '<br><span class="whitespace-nowrap">снято ' + esc(rud(f.at)) + '</span>' : '')
  + '</div>';
'''

CORE += r'''
/* ============ ПЕРИОДЫ И ДИНАМИКА ============
   Отчёт без сравнения не отвечает на вопрос «стало лучше или хуже», а его
   собственник задаёт вторым после вопроса про деньги. Поэтому период выбирается
   один раз наверху и действует на все экраны сразу. */
const PERIODS = { '7d':7, '30d':30, '90d':90, 'all':100000 };
const PERIOD_LABEL = { '7d':'7 дней', '30d':'30 дней', '90d':'90 дней', 'all':'весь ряд' };
let PERIOD = '30d';

const dOf = s => new Date(s + 'T00:00:00Z');
const ruD = s => !s ? '' : s.split('-').reverse().join('.');
const SER = () => (V().series || []);

/* Текущий и предыдущий отрезок одинаковой длины. Предыдущий нужен, чтобы
   «плюс два запроса» можно было сравнить с тем, что было отрезком раньше. */
function slice(){
  const s = SER();
  if(!s.length) return { cur:[], prev:[], from:null, to:null, days:0, full:false };
  const to = dOf(s[s.length-1].date), days = PERIODS[PERIOD];
  const from = new Date(to); from.setUTCDate(from.getUTCDate() - days);
  const pfrom = new Date(from); pfrom.setUTCDate(pfrom.getUTCDate() - days);
  const inR = (d,a,b) => { const x = dOf(d); return x > a && x <= b; };
  const cur = s.filter(r => inR(r.date, from, to));
  const prev = s.filter(r => inR(r.date, pfrom, from));
  const full = dOf(s[0].date) <= from;
  return { cur, prev, from, to, days, full };
}
/* Имя метрики в ряду и имя в выгрузке различаются. Карта держит их в одном месте,
   иначе плитка молча показывает «нет ряда» рядом с нарисованным графиком. */
const SF = { visibility:'vis', ai_answers:'ai', vis:'vis', ai:'ai',
             top1:'top1', top3:'top3', top10:'top10', top50:'top50' };
const sf = f => SF[f] || f;
const lastOf  = (rows,f) => { f=sf(f); for(let i=rows.length-1;i>=0;i--) if(rows[i][f]!=null) return rows[i][f]; return null; };
const firstOf = (rows,f) => { f=sf(f); for(const r of rows) if(r[f]!=null) return r[f]; return null; };

/* Дельта по метрике: сколько было в начале периода, сколько стало, и что было
   отрезком раньше. Пустое поле возвращает null, а не ноль: ноль это утверждение. */
function dyn(field){
  const s = slice(), f = sf(field);
  // Считаем точки именно по этой метрике. Общее число точек периода обманывает:
  // топ-50 может стоять в одной строке из восемнадцати, и «ноль изменений» тогда
  // означает не стабильность, а отсутствие второй точки.
  const pts = s.cur.filter(r => r[f] != null);
  const now = pts.length ? pts[pts.length-1][f] : null;
  const was = pts.length ? pts[0][f] : null;
  const prev = lastOf(s.prev, field);
  const one = pts.length < 2;                       // сравнивать не с чем
  const abs = (!one && now!=null && was!=null) ? now - was : null;
  const rel = (abs!=null && was) ? abs / was : null;
  const vsPrev = (now!=null && prev!=null) ? now - prev : null;
  return { now, was, prev, abs, rel, vsPrev, one, points: pts.length,
           from: pts.length? dOf(pts[0].date) : s.from,
           to: pts.length? dOf(pts[pts.length-1].date) : s.to, full: s.full };
}
/* Куда «хорошо». У позиции в выдаче хорошо это меньше, у всего остального больше. */
const GOODUP = { top1:1, top3:1, top10:1, top50:1, visibility:1, vis:1, ai_answers:1, ai:1, visits:1 };
function tone(field, abs){
  if(abs==null || abs===0) return 'flat';
  const up = GOODUP[field] !== 0;
  return (abs > 0) === !!up ? 'good' : 'bad';
}
function dbadge(field){
  const d = dyn(field);
  if(d.one) return '<span class="text-[11px] opacity-45" title="в выбранном периоде по этой метрике одна точка, сравнивать не с чем">одна точка</span>';
  if(d.abs==null) return '<span class="text-[11px] opacity-45">нет ряда</span>';
  const t = tone(field, d.abs);
  const col = t==='good' ? ST('ok') : t==='bad' ? ST('crit') : INK();
  if(d.abs===0) return '<span class="text-[11px] font-semibold whitespace-nowrap" style="color:'+INK()+'" '
    + 'title="' + esc('за период не менялось: ' + nf(d.now)) + '">без изменений</span>';
  const ar = d.abs>0 ? '▲' : '▼';
  const rel = d.rel==null ? '' : ' ' + (d.rel>0?'+':'') + (d.rel*100).toFixed(Math.abs(d.rel)<0.1?1:0).replace('.',',') + '%';
  return '<span class="text-[11px] font-semibold whitespace-nowrap" style="color:'+col+'" '
    + 'title="' + esc('было ' + nf(d.was) + ' на ' + ruD(d.from ? d.from.toISOString().slice(0,10) : '')
      + ', стало ' + nf(d.now) + ' на ' + ruD(d.to ? d.to.toISOString().slice(0,10) : '')
      + (d.vsPrev!=null ? '; отрезком раньше было ' + nf(d.prev) : '')) + '">'
    + ar + ' ' + (d.abs>0?'+':'') + nf(d.abs) + rel + '</span>';
}
'''


CORE += r"""
/* Скачок между соседними точками больше порога это либо новость, либо смена
   методики счёта у сервиса. Молчать про такое нельзя: на графике он выглядит
   как факт, а проверить его никто не догадается. */
function anomalies(field, relLimit){
  const rows = SER(), f = sf(field), lim = relLimit || 0.4, out = [];
  let prev = null;
  for(const r of rows){
    if(r[f]==null) continue;
    if(prev && prev.v) {
      const rel = (r[f] - prev.v) / prev.v;
      if(Math.abs(rel) >= lim) out.push({from: prev.d, to: r.date, was: prev.v, now: r[f], rel});
    }
    prev = {d: r.date, v: r[f]};
  }
  return out;
}
function anomalyNote(field, label){
  const a = anomalies(field);
  if(!a.length) return '';
  const x = a[a.length-1];
  return note('Резкий скачок в ряду: ' + label,
    'С ' + ruD(x.from) + ' по ' + ruD(x.to) + ' значение изменилось с ' + nf(x.was) + ' на ' + nf(x.now)
    + ' (' + (x.rel>0?'+':'') + Math.round(x.rel*100) + '%). За три дня органика так не двигается. '
    + 'Прежде чем нести это собственнику, надо проверить в кабинете keys.so, не сменился ли состав промптов или методика счёта. '
    + 'Скачок оставлен в ряду как есть: подчищать данные, чтобы график выглядел ровнее, нельзя.', 'warn');
}
"""
