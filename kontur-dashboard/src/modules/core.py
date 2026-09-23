# -*- coding: utf-8 -*-
CORE = r'''
/* ============ ЦВЕТ ============
   Своих цветов у дашборда нет: всё из токенов Контур DS (kontur-ds/tokens/tokens.css).
   В разметке цвет пишется ссылкой на переменную, поэтому тема меняет его сама.
   Графики красятся пресетами KS.charts по слотам --cat-1..5 (draw.py).
   Порядок слотов фиксирован: фиолетовый, бирюзовый, синий, янтарный, голубой. */
const P  = i => 'var(--cat-' + (((i % 5) + 5) % 5 + 1) + ')';
const PS = i => 'var(--seq-' + (Math.max(0, Math.min(4, i)) + 1) + ')';
const ST = n => 'var(--' + ({ ser:'serious' }[n] || n) + ')';
const INK  = () => 'var(--text-muted)';
const INKH = () => 'var(--text-strong)';

/* ============ ФОРМАТ И РАЗМЕТКА ПО ПРОТОКОЛУ 9 ============ */
const esc = t => String(t==null?'':t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* Десятичная запятая, неразрывный пробел в разрядах только у целой части: в русском
   тексте «4,78%» рядом с «+2,6%», а не «4.78%». Раньше точка оставалась точкой. */
const nf  = n => { if(n==null||n==='') return '-';
  const [i, f] = String(n).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g,' ') + (f!==undefined ? ','+f : ''); };
/* Открытые вопросы текущего проекта: свои и общие. Строка про один проект
   на экранах другого уже дважды выдавала собственнику неправду. */
const BL = () => DB.blockers.filter(b => !b[4] || b[4]===CUR);
const BLN = { gg:'GENGLASS', gm:'GLASS-MEMORY' };
/* Выгрузка Директа по проекту оказалась копией чужого кабинета (build_data.py,
   direct_owner): своих цифр Директа у проекта нет, и экран говорит это прямо. */
function copyNote(){
  const c = V().direct_copy; if(!c) return '';
  return note('Своей выгрузки Директа у проекта нет',
    'Сборщик ходит в Директ одним логином на все проекты, это кабинет '+esc(c.of)+'. Поэтому в файле direct.json по этому проекту лежит выгрузка чужого кабинета: '
    +npl(c.camps.length,'кампания','кампании','кампаний')+(c.camps.length ? ', например «'+esc(c.camps[0])+'»' : '')
    +'. Цифр Директа здесь нет. Если у проекта есть свой кабинет, его логин нужно добавить в сборщик отдельно.','warn');
}
/* Согласование числа и слова: pl(144,'заявка','заявки','заявок') -> «заявки». */
const pl = (n, one, few, many) => { const m = Math.abs(Math.round(n)) % 100, d = m % 10;
  return (m>=11 && m<=14) ? many : d===1 ? one : (d>=2 && d<=4) ? few : many; };
/* Решения текущего проекта и общие, как BL() для открытых вопросов. */
const DL = () => DB.decisions.filter(d => !d[4] || d[4]===CUR);
/* Кто и когда по задачам, которые стоят на нескольких экранах: одна запись на всех.
   Сверку моста и средний чек Иван назначил 23.09: исполнитель он, срок конец
   отчётного месяца. Выгрузку сделок никто не назначал, и экраны так и пишут. */
const WHO = {
  bridge: ['Иван', 'до 30.09.2026, конец отчётного месяца; предложена промежуточная точка 27.09: сверка по одной странице карты посадочных'],
  chk:    ['Иван', 'до 30.09.2026, конец отчётного месяца'],
  deals:  ['Иван ставит задачу, исполнитель не назначен', 'срок не назначен'],
};
/* Значение с видимым классом: метка стоит рядом с цифрой и видна при печати. */
const vk = f => f ? val(f) + (f.k && f.k !== 'ДАННЫЕ' ? ' ' + kmark(f.k) : '') : '-';
/* Во сколько раз модель моста завышает визиты против счётчика (как на «Мосте до денег»). */
function modelGap(p){
  const core = (p.facts||{}).core, cv = p.ym && p.ym.conv && p.ym.conv.organic;
  if(!core || core.v==null || !cv || !cv.visits) return null;
  return Number((core.v * DB.assum.ctr.v / 100 / cv.visits).toFixed(1));
}
/* Правда про бота съёма зависит от того, кто собрал страницу. */
const botLine = () => DB.bot
  ? ' Съём пишет бот kontur-snapshot.yml по будням и добирает пропущенные дни из истории выгрузок в git.'
  : ' Съём пишет бот kontur-snapshot.yml из main, эта сборка сделана не им. Пропущенные дни бот добирает из истории выгрузок в git.';
/* Число со словом: npl(147,'заявка','заявки','заявок') -> «147 заявок». */
const npl = (n, one, few, many) => nf(n) + ' ' + pl(n, one, few, many);
/* Потолок маркетинга по проекту как конверт: класс наследует от плана и доли. */
const CAPF = d => { const k = [d.plan.k, DB.thresh.mkt_share.k].includes('ГИПОТЕЗА') ? 'ГИПОТЕЗА' : 'ДАННЫЕ';
  return {v:d.plan.v*DB.thresh.mkt_share.v, k, s:'план H2 × доля маркетинга', at:'', n: k==='ГИПОТЕЗА' ? 'план и доля названы без документа в репозитории' : ''}; };
const money = n => (n==null||!isFinite(n)) ? '-' : nf(Math.round(n)) + ' ₽';
const pc  = n => (n==null||!isFinite(n)) ? '-' : (n*100).toFixed(n<0.1?1:0).replace('.',',') + '%';

/* Класс цифры, значение и источник рисует кит: точка и слово строчными, источник и
   дата приклеены к самой цифре подсказкой. Скриншот плитки уносит с собой разметку. */
const kmark = kind => KS.kind(kind);
const val = (f, fmt) => f ? KS.val(f, fmt) : '-';
const rud = d => !d ? '' : d.split('-').reverse().join('.');
const srcline = f => f ? KS.src(f) : '';
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
/* Дельта чипом кита. Даты периода кит ждёт строками ГГГГ-ММ-ДД. */
function dbadge(field){
  const d = dyn(field), iso = x => x ? x.toISOString().slice(0,10) : null;
  return KS.delta(Object.assign({}, d, { from: iso(d.from), to: iso(d.to) }), GOODUP[field] !== 0);
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
      // Порог и в долях, и в абсолютных единицах: 1 -> 2 это +100%, но при видимости в
      // единицы процентов такой шаг шум, а не скачок.
      const absLim = f==='vis' ? 5 : f==='ai' ? 10 : f==='top10' ? 10 : 50;
      if(Math.abs(rel) >= lim && Math.abs(r[f]-prev.v) >= absLim) out.push({from: prev.d, to: r.date, was: prev.v, now: r[f], rel});
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
    + ' (' + (x.rel>0?'+':'') + Math.round(x.rel*100) + '%). '
    + (()=>{ const dd = Math.round((dOf(x.to)-dOf(x.from))/86400000); return 'За '+nf(dd)+' '+pl(dd,'день','дня','дней')+' органика так не двигается. '; })()
    + 'Прежде чем нести это собственнику, надо проверить в кабинете keys.so, не сменился ли состав промптов или методика счёта. '
    + 'Скачок оставлен в ряду как есть: подчищать данные, чтобы график выглядел ровнее, нельзя.', 'warn');
}
"""
