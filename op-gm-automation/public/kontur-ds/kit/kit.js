/* ==========================================================================
   Контур DS · компоненты на чистом JavaScript
   Каждая функция возвращает строку HTML. Никаких фреймворков: одинаково
   работает в артефакте Claude, на GitHub Pages и с диска. Для React/Vue
   переносятся классы ks-* и разметка, логика данных остаётся той же.
   Зависит от icons.js (KS.ic) и tokens.css + kit.css.
   ========================================================================== */
(function(g){
const KS = g.KS = g.KS || {};
const ic = (...a) => KS.ic(...a);

/* ---------------- формат ---------------- */
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Разделитель тысяч это узкий неразрывный пробел: число не рвётся на строки */
const nf = n => (n == null || n === '' || (typeof n === 'number' && !isFinite(n))) ? '-' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace('.', ',');
const money = n => (n == null || !isFinite(n)) ? '-' : nf(Math.round(n)) + ' ₽';
const pct = (n, digits) => (n == null || !isFinite(n)) ? '-' : (n * 100).toFixed(digits == null ? (Math.abs(n) < 0.1 ? 1 : 0) : digits).replace('.', ',') + '%';
const ruDate = s => !s ? '' : String(s).slice(0, 10).split('-').reverse().join('.');
KS.fmt = { esc, nf, money, pct, ruDate };

/* ---------------- Протокол 9: конверт цифры ----------------
   Любое значение на экране приезжает в конверте. Выгрузки нет, значит v:null
   и класс ДЕМО. Правдоподобное число вместо null запрещено. */
const KIND = {
  'ДАННЫЕ':   { tone:'ok',   hint:'Есть источник и дата съёма. Можно показывать как факт.' },
  'ГИПОТЕЗА': { tone:'warn', hint:'Бенчмарк или оценка. В план идёт только пессимистичный сценарий.' },
  'ДЕМО':     { tone:'crit', hint:'Заглушка. Выгрузки нет, значение не показывается.' }
};
KS.F = (v, k, s, at, n) => ({ v, k, s: s || '', at: at || '', n: n || '' });
KS.KIND = KIND;

function badge(text, tone, title){
  return '<span class="ks-badge ks-badge--' + (tone || 'neutral') + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(text) + '</span>';
}
function kind(k){ const m = KIND[k]; return m ? badge(k, m.tone, m.hint) : ''; }
/* Значение с источником и датой, приклеенными к самой цифре через title */
function val(f, fmt){
  if(!f || typeof f !== 'object') return esc(f);
  const t = [f.k, f.s, f.at ? 'снято ' + ruDate(f.at) : '', f.n].filter(Boolean).join(' · ');
  const shown = f.v == null ? '<span class="ks-empty">нет</span>' : (fmt ? fmt(f.v) : nf(f.v));
  return '<span title="' + esc(t) + '">' + shown + '</span>';
}
function src(f){
  if(!f || typeof f !== 'object') return '';
  const s = f.s || (f.k === 'ДЕМО' ? 'выгрузки нет, поле ждёт подключения' : 'источник не указан');
  return '<div class="ks-tile-src">' + esc(s) + (f.at ? '<br>снято ' + esc(ruDate(f.at)) : '') + '</div>';
}
KS.badge = badge; KS.kind = kind; KS.val = val; KS.src = src;

/* ---------------- шапка экрана ---------------- */
KS.head = function({ title, sub, src: source, badges, prio, lead } = {}){
  return '<header class="ks-page-head">'
    + '<div class="ks-row"><h1 class="ks-h1">' + esc(title) + '</h1>' + (badges || []).join('')
    + (prio ? badge(prio, 'neutral', 'Приоритет: P0 самый высокий') : '') + '</div>'
    + (sub ? '<p class="ks-page-sub">' + esc(sub) + '</p>' : '')
    + (source ? '<div class="ks-page-src">' + esc(source) + '</div>' : '')
    + (lead ? '<div class="ks-lead">' + ic('wallet', 15) + '<span>' + lead + '</span></div>' : '')
    + '</header>';
};

/* ---------------- плитка показателя ----------------
   slot 1..5 это категориальный цвет иконки. delta это готовая строка из KS.delta().
   drill делает плитку кликабельной и открывает панель деталей. */
KS.tile = function({ label, f, slot, icon, delta, drill } = {}){
  const isF = f && typeof f === 'object' && 'v' in f;
  const attrs = drill ? ' class="ks-tile is-interactive" role="button" tabindex="0" data-drill="' + esc(drill) + '"' : ' class="ks-tile"';
  return '<div' + attrs + ' style="--slot:var(--cat-' + (slot || 3) + ')">'
    + '<div class="ks-tile-top"><div class="ks-tile-icon">' + ic(icon || 'chart', 18) + '</div>' + (isF ? kind(f.k) : '') + '</div>'
    + '<div class="ks-tile-value ks-hero' + (isF && f.v == null ? ' ks-tile-empty' : '') + '">' + (isF ? val(f) : esc(f)) + '</div>'
    + (delta || '')
    + '<div class="ks-tile-label">' + esc(label) + '</div>'
    + (isF ? src(f) : '')
    + '</div>';
};

/* ---------------- карточка ----------------
   table это таблица-двойник графика: у каждого графика она обязана быть. */
let _tw = 0;
KS.card = function({ title, sub, body, actions, table, cls, drill } = {}){
  let tgl = '', twin = '';
  if(table){
    const id = 'ks-tw-' + (++_tw);
    tgl = '<button type="button" class="ks-btn ks-btn--secondary ks-btn--sm ks-noprint" aria-expanded="false" aria-controls="' + id + '" onclick="KS.toggleTwin(this)">таблица</button>';
    twin = '<div id="' + id + '" hidden style="margin-top:var(--sp-3)">' + table + '</div>';
  }
  const open = drill ? ' role="button" tabindex="0" data-drill="' + esc(drill) + '"' : '';
  return '<section class="ks-card ' + (drill ? 'is-interactive ' : '') + (cls || '') + '"' + open + '>'
    + (title ? '<div class="ks-card-head"><div><div class="ks-card-title">' + esc(title) + '</div>'
      + (sub ? '<div class="ks-card-sub">' + esc(sub) + '</div>' : '') + '</div>'
      + '<div class="ks-card-actions">' + (actions || '') + tgl + '</div></div>' : '')
    + (body || '') + twin + '</section>';
};
KS.toggleTwin = function(btn){
  const el = document.getElementById(btn.getAttribute('aria-controls')); if(!el) return;
  el.hidden = !el.hidden; btn.setAttribute('aria-expanded', String(!el.hidden));
  btn.textContent = el.hidden ? 'таблица' : 'скрыть';
};
KS.chart = (id, h) => '<div id="' + esc(id) + '" class="ks-chart" style="--h:' + (h || 260) + 'px"></div>';

/* ---------------- таблица ----------------
   cols: [['Заголовок'], ['Число', true]] второй элемент true значит «числовая, вправо».
   stack: на узком контейнере строки становятся карточками «подпись: значение».
   По умолчанию включается сам, если колонок четыре и больше: три колонки на телефоне
   ещё помещаются строкой. Роли ARIA сохраняют таблицу для экранного диктора, когда
   строки меняют раскладку. */
KS.table = function(cols, rows, { foot, interactive, stack } = {}){
  const st = stack == null ? cols.length >= 4 : !!stack;
  const r = st ? ' role="row"' : '';
  const cell = (c, i, tag) => '<' + tag + (st ? ' role="cell"' : '') + ' data-label="' + esc(cols[i] ? cols[i][0] : '') + '"'
    + (cols[i] && cols[i][1] ? ' class="is-num"' : '') + '>' + (c == null ? '<span class="ks-empty">-</span>' : c) + '</' + tag + '>';
  return '<div class="ks-table-wrap"><table class="ks-table' + (st ? ' ks-table--stack" role="table' : '') + '"><thead><tr' + r + '>'
    + cols.map(c => '<th' + (st ? ' role="columnheader"' : '') + (c[1] ? ' class="is-num"' : '') + ' scope="col">' + esc(c[0]) + '</th>').join('')
    + '</tr></thead><tbody>'
    + rows.map(row => '<tr' + r + (interactive ? ' class="is-interactive" tabindex="0"' : '') + '>' + row.map((c, i) => cell(c, i, 'td')).join('') + '</tr>').join('')
    + '</tbody>' + (foot ? '<tfoot><tr' + r + '>' + foot.map((c, i) => cell(c, i, 'td')).join('') + '</tr></tfoot>' : '')
    + '</table></div>';
};
KS.bars = function(items, slot){
  const mx = Math.max(1, ...items.map(i => i[1] || 0));
  return '<div class="ks-bars" style="--slot:var(--cat-' + (slot || 3) + ')">' + items.map(i =>
    '<div><div class="ks-bar-head"><span class="ks-bar-name">' + esc(i[0]) + '</span>'
    + '<span class="ks-bar-value">' + nf(i[1]) + (i[2] ? ' <span class="ks-muted" style="font-weight:400">' + esc(i[2]) + '</span>' : '') + '</span></div>'
    + '<div class="ks-bar-track"><div class="ks-bar-fill" style="width:' + Math.max(2, (i[1] || 0) / mx * 100) + '%"></div></div></div>'
  ).join('') + '</div>';
};

/* ---------------- врезка ---------------- */
KS.note = function(title, body, tone){
  const t = tone || 'info';
  const icon = { ok:'check', warn:'warn', crit:'warn', info:'bulb' }[t];
  return '<div class="ks-note ks-note--' + t + '" role="' + (t === 'crit' ? 'alert' : 'note') + '">'
    + '<span class="ks-note-ic">' + ic(icon, 17) + '</span>'
    + '<div><div class="ks-note-title">' + esc(title) + '</div><div class="ks-note-body">' + (body || '') + '</div></div></div>';
};

/* ---------------- следующий шаг: без имени и даты не рисуется ---------------- */
KS.action = function({ what, who, when, crit } = {}){
  if(!what || !who || !when) return KS.note('Следующий шаг не назначен', 'Нет исполнителя или даты. Шаг без имени и срока это пожелание, а не план.', 'warn');
  return '<section class="ks-card"><div class="ks-action-title">' + ic('target', 16) + 'Следующий шаг</div>'
    + '<div class="ks-action-what">' + esc(what) + '</div>'
    + '<dl class="ks-action-meta"><dt>кто:</dt><dd>' + esc(who) + '</dd><dt>когда:</dt><dd>' + esc(when) + '</dd></dl>'
    + (crit ? '<div class="ks-action-crit"><span class="ks-muted">критерий «идём дальше»:</span> ' + esc(crit) + '</div>' : '')
    + '</section>';
};

/* ---------------- шаги и чек-лист ---------------- */
KS.steps = items => '<ol class="ks-steps">' + items.map((it, i) =>
  '<li class="ks-step"><span class="ks-step-n" style="--slot:var(--seq-' + Math.min(5, 1 + Math.floor(i / 2)) + ')">' + (i + 1) + '</span>'
  + '<div><div class="ks-step-title">' + esc(it[0]) + '</div>' + (it[1] ? '<div class="ks-step-sub">' + esc(it[1]) + '</div>' : '') + '</div></li>').join('') + '</ol>';
KS.checks = (items, tone) => '<div class="ks-stack" style="gap:var(--sp-2)">' + items.map(x =>
  '<div class="ks-check ks-check--' + (tone || 'ok') + '">' + ic(tone === 'crit' || tone === 'warn' ? 'warn' : 'check', 14) + '<span>' + esc(x) + '</span></div>').join('') + '</div>';

/* ==========================================================================
   Динамика: ряды, периоды, дельты, вердикт
   series: [{date:'2026-09-19', top10:432, vis:23}, ...] по возрастанию даты
   ========================================================================== */
const dOf = s => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
const S = KS.series = {};
/* Текущий отрезок и предыдущий такой же длины */
S.slice = function(series, days){
  if(!series || !series.length) return { cur:[], prev:[], from:null, to:null, full:false };
  const to = dOf(series[series.length - 1].date);
  const from = new Date(to); from.setUTCDate(from.getUTCDate() - days);
  const pfrom = new Date(from); pfrom.setUTCDate(pfrom.getUTCDate() - days);
  const inR = (d, a, b) => { const x = dOf(d); return x > a && x <= b; };
  return { cur: series.filter(r => inR(r.date, from, to)), prev: series.filter(r => inR(r.date, pfrom, from)),
           from, to, full: dOf(series[0].date) <= from };
};
/* Дельта считается по точкам именно этой метрики. Одна точка значит «сравнивать не с чем»,
   а не «ноль изменений»: ноль это утверждение, его нельзя делать без второй точки. */
S.dyn = function(series, field, days){
  const s = S.slice(series, days);
  const pts = s.cur.filter(r => r[field] != null);
  const prevPts = s.prev.filter(r => r[field] != null);
  const now = pts.length ? pts[pts.length - 1][field] : null;
  const was = pts.length ? pts[0][field] : null;
  const prev = prevPts.length ? prevPts[prevPts.length - 1][field] : null;
  const one = pts.length < 2;
  const abs = (!one && now != null && was != null) ? now - was : null;
  return { now, was, prev, abs, one, points: pts.length,
           rel: (abs != null && was) ? abs / was : null,
           vsPrev: (now != null && prev != null) ? now - prev : null,
           from: pts.length ? pts[0].date : null, to: pts.length ? pts[pts.length - 1].date : null, full: s.full };
};
/* goodUp=false для метрик, где меньше значит лучше: позиция в выдаче, CPL, отказы */
S.tone = (abs, goodUp) => abs == null || abs === 0 ? 'flat' : ((abs > 0) === (goodUp !== false) ? 'good' : 'bad');
KS.delta = function(d, goodUp){
  if(d.one && d.now != null) return '<div class="ks-delta is-na" title="в периоде по этой метрике одна точка">одна точка</div>';
  if(d.abs == null) return '<div class="ks-delta is-na">нет ряда</div>';
  if(d.abs === 0) return '<div class="ks-delta is-flat">без изменений</div>';
  const t = S.tone(d.abs, goodUp);
  const rel = d.rel == null ? '' : ' ' + (d.rel > 0 ? '+' : '') + (d.rel * 100).toFixed(Math.abs(d.rel) < 0.1 ? 1 : 0).replace('.', ',') + '%';
  const title = 'было ' + nf(d.was) + ' на ' + ruDate(d.from) + ', стало ' + nf(d.now) + ' на ' + ruDate(d.to)
    + (d.vsPrev != null ? '; отрезком раньше ' + nf(d.prev) : '');
  return '<div class="ks-delta is-' + t + '" title="' + esc(title) + '">' + ic(d.abs > 0 ? 'arrow-up' : 'arrow-down', 12)
    + '<span class="ks-num">' + (d.abs > 0 ? '+' : '') + nf(d.abs) + rel + '</span></div>';
};
/* Вердикт одной строкой: «Стало лучше», «Стало хуже», «Разнонаправленно» */
KS.verdict = function(series, fields, days, label){
  const rows = fields.map(([f, name, goodUp]) => [name, S.dyn(series, f, days), goodUp]).filter(r => r[1].abs != null);
  const single = fields.map(([f, name]) => [name, S.dyn(series, f, days)]).filter(r => r[1].one && r[1].now != null);
  if(!rows.length) return KS.note('Сравнить не с чем', 'За период ' + esc(label || '') + ' в ряду нет двух точек. Возьми период шире или дождись следующего съёма.', 'warn');
  const good = rows.filter(r => S.tone(r[1].abs, r[2]) === 'good').length;
  const bad  = rows.filter(r => S.tone(r[1].abs, r[2]) === 'bad').length;
  const body = rows.map(([n, d, gu]) => {
    const t = S.tone(d.abs, gu), col = t === 'good' ? 'var(--ok)' : t === 'bad' ? 'var(--crit)' : 'var(--text-muted)';
    return '<div class="ks-row" style="gap:var(--sp-2);align-items:baseline"><span class="ks-strong" style="font-weight:500">' + esc(n) + ':</span>'
      + '<span class="ks-num">' + nf(d.was) + ' на ' + ruDate(d.from) + '</span><span class="ks-muted">до</span>'
      + '<span class="ks-num ks-strong" style="font-weight:600">' + nf(d.now) + ' на ' + ruDate(d.to) + '</span>'
      + '<span class="ks-num" style="font-weight:600;color:' + col + '">' + (d.abs > 0 ? '+' : '') + nf(d.abs) + '</span>'
      + (d.vsPrev != null ? '<span class="ks-muted" style="font-size:var(--fs-caption)">отрезком раньше ' + nf(d.prev) + '</span>' : '') + '</div>';
  }).join('');
  const head = bad === 0 ? 'Стало лучше' : good === 0 ? 'Стало хуже' : 'Разнонаправленно';
  const tone = bad === 0 ? 'ok' : good === 0 ? 'crit' : 'warn';
  const tail = single.length ? ' По метрикам «' + single.map(r => esc(r[0])).join('», «') + '» в периоде одна точка, они в вердикт не входят.' : '';
  return KS.note(head + (label ? ' за ' + label : ''), '<div class="ks-stack" style="gap:var(--sp-1-5);margin-top:var(--sp-1)">' + body + '</div>'
    + '<div class="ks-muted" style="margin-top:var(--sp-2)">Точек в периоде: ' + S.slice(series, days).cur.length + '.' + tail + '</div>', tone);
};
/* Разрывы в ряду: пропущенный съём не восстанавливается, прятать его нельзя */
S.gaps = function(series, maxDays){
  const out = [], lim = maxDays || 8;
  for(let i = 1; i < series.length; i++){
    const dd = (dOf(series[i].date) - dOf(series[i - 1].date)) / 86400000;
    if(dd > lim) out.push({ from: series[i - 1].date, to: series[i].date, days: Math.round(dd) });
  }
  return out;
};
/* Скачок между соседними точками выше порога: либо новость, либо смена методики у источника */
S.anomalies = function(series, field, relLimit){
  const lim = relLimit || 0.4, out = []; let prev = null;
  for(const r of series){
    if(r[field] == null) continue;
    if(prev && prev.v){ const rel = (r[field] - prev.v) / prev.v; if(Math.abs(rel) >= lim) out.push({ from: prev.d, to: r.date, was: prev.v, now: r[field], rel }); }
    prev = { d: r.date, v: r[field] };
  }
  return out;
};
KS.anomalyNote = function(series, field, label){
  const a = S.anomalies(series, field); if(!a.length) return '';
  const x = a[a.length - 1];
  return KS.note('Резкий скачок в ряду: ' + label, 'С ' + ruDate(x.from) + ' по ' + ruDate(x.to) + ' значение изменилось с ' + nf(x.was) + ' на ' + nf(x.now)
    + ' (' + (x.rel > 0 ? '+' : '') + Math.round(x.rel * 100) + '%). Прежде чем показывать это как факт, проверь у источника, не менялась ли методика. '
    + 'Скачок оставлен в ряду как есть: подчищать данные ради ровного графика нельзя.', 'warn');
};

/* ==========================================================================
   Панель деталей: проваливание в виджет
   Четыре обязательных блока: из чего сложилось, как менялось, откуда взято, что делать.
   Состояние в адресе: #/проект/экран/период/показатель, ссылку можно переслать.
   ========================================================================== */
const D = KS.drawer = { providers:{}, last:null };
D.register = (key, fn) => { D.providers[key] = fn; };
D.ensure = function(){
  if(document.getElementById('ks-drawer')) return;
  const bd = document.createElement('div'); bd.id = 'ks-drawer-bd'; bd.className = 'ks-backdrop'; bd.hidden = true;
  bd.addEventListener('click', () => D.close());
  const el = document.createElement('aside'); el.id = 'ks-drawer'; el.className = 'ks-drawer';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'ks-drawer-title'); el.tabIndex = -1;
  document.body.append(bd, el);
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && el.classList.contains('is-open')) D.close(); });
  /* Любой элемент с data-drill открывает панель: мышью, Enter или пробелом */
  document.addEventListener('click', e => { const t = e.target.closest('[data-drill]'); if(t && !e.target.closest('button,a,input,select')) D.open(t.dataset.drill, t); });
  document.addEventListener('keydown', e => { const t = e.target.closest && e.target.closest('[data-drill]');
    if(t && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); D.open(t.dataset.drill, t); } });
};
/* Делегирование кликов ставится сразу при загрузке, а не при первом открытии:
   иначе первый клик по плитке некому поймать и панель не откроется никогда. */
if(document.readyState !== 'loading') D.ensure(); else document.addEventListener('DOMContentLoaded', D.ensure);

D.open = function(key, origin){
  D.ensure();
  const p = D.providers[key];
  const c = p ? p() : { title: key, missing: true };
  const el = document.getElementById('ks-drawer');
  const blocks = c.missing
    ? KS.note('Деталей для этого показателя нет', 'Выгрузка, из которой он раскладывается, не подключена. ' + esc(c.need || 'Какой метод нужен, описано в регламенте проекта.'), 'warn')
    : [ KS.card({ title:'Из чего сложилась цифра', body: c.compose || KS.note('Разложения нет', esc(c.composeMissing || 'Источник не отдаёт составляющие.'), 'warn') }),
        KS.card({ title:'Как менялась', body: c.trend || '<div class="ks-muted">Ряда нет.</div>', table: c.trendTable }),
        KS.card({ title:'Откуда взята', body: c.source || '<div class="ks-muted">Источник не указан.</div>' }),
        c.action ? KS.action(c.action) : KS.note('Следующий шаг не назначен', 'Нет исполнителя или даты.', 'warn') ].join('');
  el.innerHTML = '<div class="ks-drawer-head"><div><div class="ks-row">' + '<h2 class="ks-h2" id="ks-drawer-title">' + esc(c.title) + '</h2>' + (c.kind ? kind(c.kind) : '') + '</div>'
    + (c.sub ? '<div class="ks-card-sub">' + esc(c.sub) + '</div>' : '') + '</div>'
    + '<button type="button" class="ks-btn ks-btn--ghost ks-btn--icon" aria-label="Закрыть" onclick="KS.drawer.close()">' + ic('x', 18) + '</button></div>'
    + '<div class="ks-drawer-body">' + blocks + '</div>';
  document.getElementById('ks-drawer-bd').hidden = false;
  el.classList.add('is-open'); D.last = origin || null; el.focus();
  document.documentElement.classList.add('ks-lock');
  if(c.afterOpen) requestAnimationFrame(c.afterOpen);
  if(KS.route) KS.route.set({ drill: key });
};
D.close = function(){
  const el = document.getElementById('ks-drawer'); if(!el) return;
  el.classList.remove('is-open'); document.getElementById('ks-drawer-bd').hidden = true;
  if(!(KS.shell && KS.shell.isOpen && KS.shell.isOpen())) document.documentElement.classList.remove('ks-lock');
  /* графики панели уничтожаем вместе с её содержимым, иначе они живут в закрытой панели */
  setTimeout(() => { if(!el.classList.contains('is-open')){ el.innerHTML = ''; if(KS.charts) KS.charts.prune(); } }, 320);
  if(D.last && D.last.focus) D.last.focus();
  if(KS.route) KS.route.set({ drill: null });
};

/* ---------------- маршрут в адресе ----------------
   Формат #проект.экран.период.показатель, например #gg.dyn-sum.30.top10
   Разделитель точка, а не слэш: в артефакте Claude до location.hash доходят только
   буквы, цифры и символы . _ ~ -. Ссылка со слэшами там молча теряется.
   Поэтому идентификаторы экранов и показателей не должны содержать точку. */
const R = KS.route = { sep:'.', onChange:null };
R.parse = function(){
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const parts = raw.includes('/') ? raw.split('/') : raw.split(R.sep);   /* старые ссылки со слэшем тоже читаем */
  const [project, view, period, drill] = parts;
  return { project: project || null, view: view || null, period: period || null, drill: drill || null };
};
/* Состояние берётся из адреса в момент загрузки кита. Если сначала что-то перерисует
   страницу и перепишет адрес, присланная ссылка на раскрытый показатель потеряется. */
R.state = R.parse();
R.set = function(patch){
  Object.assign(R.state, patch);
  const s = R.state, parts = [s.project, s.view, s.period, s.drill];
  while(parts.length && !parts[parts.length - 1]) parts.pop();
  const h = parts.length ? '#' + parts.map(x => x || '').join(R.sep) : '';
  if(location.hash !== h){ try{ history.replaceState(null, '', h || location.pathname + location.search); }catch(e){} }
};

/* ---------------- тема: система, светлая, тёмная ----------------
   Хост (например, просмотрщик артефактов Claude) может сам поставить data-theme
   на корень по выбору зрителя. Пока человек не переключил тему внутри страницы,
   кит этот выбор не трогает: иначе страница перебьёт настройку зрителя. */
const T = KS.theme = {};
T.get = () => document.documentElement.getAttribute('data-theme') || 'system';
T.isDark = () => { const t = T.get(); return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); };
T.emit = () => document.dispatchEvent(new CustomEvent('ks:theme', { detail:{ mode:T.get(), dark:T.isDark() } }));
T.set = function(mode, opts){
  const r = document.documentElement;
  if(mode === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', mode);
  r.classList.toggle('dark', T.isDark());
  if(!opts || opts.persist !== false){ try{ localStorage.setItem('ks-theme', mode); }catch(e){} }
  T.emit();
};
T.toggle = () => T.set(T.isDark() ? 'light' : 'dark');
T.init = function(){
  let m = null; try{ m = localStorage.getItem('ks-theme'); }catch(e){}
  if(m === 'light' || m === 'dark') T.set(m, { persist:false });
  else document.documentElement.classList.toggle('dark', T.isDark());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if(T.get() === 'system'){ document.documentElement.classList.toggle('dark', T.isDark()); T.emit(); } });
  /* хост сменил data-theme сам: перерисовать графики под новую тему */
  new MutationObserver(() => { document.documentElement.classList.toggle('dark', T.isDark()); T.emit(); })
    .observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
};
T.icon = () => ic(T.isDark() ? 'sun' : 'moon', 17);

/* ---------------- меню с аккордеоном ----------------
   tree: [{id,t,i}, {t,i,ch:[{id,t}], badge:()=>html}] */
KS.nav = function(tree, active){
  return tree.map((g, gi) => {
    if(!g.ch) return '<button type="button" class="ks-nav-item' + (g.id === active ? ' is-active' : '') + '" data-view="' + esc(g.id) + '"' + (g.id === active ? ' aria-current="page"' : '') + '>'
      + ic(g.i, 17) + '<span class="ks-lbl">' + esc(g.t) + '</span></button>';
    const open = g.ch.some(c => c.id === active);
    return '<div><button type="button" class="ks-nav-item" aria-expanded="' + open + '" aria-controls="ks-sub-' + gi + '" data-group="' + gi + '">'
      + ic(g.i, 17) + '<span class="ks-lbl">' + esc(g.t) + '</span>' + (g.badge ? '<span class="ks-lbl" style="flex:0">' + g.badge() + '</span>' : '')
      + '<span class="ks-lbl ks-chev' + (open ? ' is-open' : '') + '" style="flex:0">' + ic('chev', 13) + '</span></button>'
      + '<div class="ks-nav-sub' + (open ? ' is-open' : '') + '" id="ks-sub-' + gi + '"><div class="ks-nav-sub-in">'
      + g.ch.map(c => '<button type="button" class="ks-nav-item' + (c.id === active ? ' is-active' : '') + '" data-view="' + esc(c.id) + '"' + (c.id === active ? ' aria-current="page"' : '') + '><span class="ks-lbl">' + esc(c.t) + '</span></button>').join('')
      + '</div></div></div>';
  }).join('');
};
/* ---------------- каркас: меню ----------------
   KS.shell.init({ sidebar:'#sb', backdrop:'#bd', menu:'#menu' })
   До 1024 пикселей меню уезжает за край и выезжает поверх по кнопке, закрывается
   кликом мимо, Esc, выбором пункта; страница под ним не прокручивается.
   На широком экране та же кнопка сворачивает меню в полосу иконок. */
KS.shell = (function(){
  const S = { sb:null, bd:null, btn:null };
  const $ = x => typeof x === 'string' ? document.querySelector(x) : x;
  const narrow = () => matchMedia('(max-width:1023px)').matches;
  S.isOpen = () => !!(S.sb && S.sb.classList.contains('is-open'));
  S.open = () => { if(!S.sb) return; S.sb.classList.add('is-open'); if(S.bd) S.bd.hidden = false;
    document.documentElement.classList.add('ks-lock'); if(S.btn) S.btn.setAttribute('aria-expanded', 'true');
    const f = S.sb.querySelector('.ks-nav-item.is-active, .ks-nav-item'); if(f) f.focus(); };
  S.close = () => { if(!S.sb || !S.isOpen()) return; S.sb.classList.remove('is-open'); if(S.bd) S.bd.hidden = true;
    const d = document.getElementById('ks-drawer'); if(!(d && d.classList.contains('is-open'))) document.documentElement.classList.remove('ks-lock');
    if(S.btn){ S.btn.setAttribute('aria-expanded', 'false'); S.btn.focus(); } };
  S.toggle = () => { if(narrow()) (S.isOpen() ? S.close() : S.open()); else if(S.sb) S.sb.classList.toggle('is-collapsed'); };
  S.init = function({ sidebar, backdrop, menu } = {}){
    S.sb = $(sidebar); S.bd = $(backdrop); S.btn = $(menu);
    if(S.btn){ S.btn.classList.add('ks-menu-btn'); if(!S.btn.innerHTML.trim()) S.btn.innerHTML = ic('menu', 18);
      S.btn.setAttribute('aria-expanded', 'false'); if(S.sb && S.sb.id) S.btn.setAttribute('aria-controls', S.sb.id);
      S.btn.addEventListener('click', S.toggle); }
    if(S.bd) S.bd.addEventListener('click', S.close);
    document.addEventListener('keydown', e => { if(e.key === 'Escape' && S.isOpen()) S.close(); });
    /* выбрали пункт на телефоне: меню закрывается само */
    if(S.sb) S.sb.addEventListener('click', e => { if(narrow() && e.target.closest('[data-view]')) S.close(); });
    /* повернули экран или расширили окно: открытое поверх меню не должно остаться висеть */
    matchMedia('(max-width:1023px)').addEventListener('change', () => { S.close(); if(S.sb) S.sb.classList.remove('is-collapsed'); });
    /* лента фильтров шапки: отмечаем, что она не влезла и где её край */
    document.querySelectorAll('.ks-topbar-tools').forEach(t => {
      const upd = () => { const over = t.scrollWidth > t.clientWidth + 1;
        t.classList.toggle('is-overflow', over); t.classList.toggle('is-end', over && t.scrollLeft + t.clientWidth >= t.scrollWidth - 2); };
      t.addEventListener('scroll', upd, { passive:true });
      if(window.ResizeObserver) new ResizeObserver(upd).observe(t); else window.addEventListener('resize', upd);
      if(window.MutationObserver) new MutationObserver(upd).observe(t, { childList:true, subtree:true });
      upd();
    });
    return S;
  };
  return S;
})();

KS.navWire = function(root, onGo){
  root.addEventListener('click', e => {
    const v = e.target.closest('[data-view]'); if(v){ onGo(v.dataset.view); return; }
    const gr = e.target.closest('[data-group]'); if(gr){
      const sub = document.getElementById('ks-sub-' + gr.dataset.group), open = !sub.classList.contains('is-open');
      sub.classList.toggle('is-open', open); gr.setAttribute('aria-expanded', open);
      const ch = gr.querySelector('.ks-chev'); if(ch) ch.classList.toggle('is-open', open);
    }
  });
};
})(window);
