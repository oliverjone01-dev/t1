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

/* Пояснение к элементу: data-tip показывает KS.tip стеклянной подсказкой (мышь и фокус) */
const tipAttr = t => t ? ' data-tip="' + esc(t) + '"' : '';
function badge(text, tone, title){
  return '<span class="ks-badge ks-badge--' + (tone || 'neutral') + '"' + tipAttr(title) + '>' + esc(text) + '</span>';
}
/* Класс цифры точкой и словом. «Данные» тихие, «гипотеза» и «демо» цветные: громче исключение */
function kind(k){ const m = KIND[k]; return m ? '<span class="ks-kind ks-kind--' + m.tone + '"' + tipAttr(k + ': ' + m.hint) + '><i class="ks-dot"></i>' + esc(k.toLowerCase()) + '</span>' : ''; }
/* Статус точкой и словом: для таблиц и списков вместо цветной плашки */
function status(text, tone, hint){ return '<span class="ks-status ks-status--' + (tone || 'neutral') + '"' + tipAttr(hint) + '><i class="ks-dot"></i>' + esc(text) + '</span>'; }
/* Значение с источником и датой, приклеенными к самой цифре подсказкой.
   Простое число помечено data-num: KS.ticker плавно переведёт его к новому значению при обновлении данных. */
function val(f, fmt){
  if(!f || typeof f !== 'object') return esc(f);
  const t = [f.k, f.s, f.at ? 'снято ' + ruDate(f.at) : '', f.n].filter(Boolean).join('\n');
  const plain = !fmt && typeof f.v === 'number' && isFinite(f.v);
  const shown = f.v == null ? '<span class="ks-empty">нет</span>' : (fmt ? fmt(f.v) : nf(f.v));
  return '<span' + tipAttr(t) + (plain ? ' data-num data-v="' + f.v + '"' : '') + '>' + shown + '</span>';
}
function src(f){
  if(!f || typeof f !== 'object') return '';
  const s = f.s || (f.k === 'ДЕМО' ? 'выгрузки нет, поле ждёт подключения' : 'источник не указан');
  return '<div class="ks-tile-src">' + esc(s) + (f.at ? ' · снято ' + esc(ruDate(f.at)) : '') + '</div>';
}
KS.badge = badge; KS.kind = kind; KS.status = status; KS.val = val; KS.src = src;

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

/* ---------------- спарклайн ----------------
   Тренд рядом с числом, без осей. Пропуск в ряду рвёт линию: разрыв виден, а не заштопан.
   Ряд из трёх и меньше точек получает точки на каждом значении, последняя точка выделена. */
KS.spark = function(data, { w, h, label } = {}){
  const W = w || 76, H = h || 24, pad = 3, pts = (data || []).map((v, i) => [i, v]).filter(p => p[1] != null && isFinite(p[1]));
  if(pts.length < 2) return '';
  const vs = pts.map(p => p[1]), mn = Math.min(...vs), mx = Math.max(...vs), n = Math.max(1, data.length - 1);
  const X = i => (i / n * (W - pad * 2) + pad).toFixed(1), Y = v => (mx === mn ? H / 2 : H - pad - (v - mn) / (mx - mn) * (H - pad * 2)).toFixed(1);
  const segs = []; let cur = [];
  data.forEach((v, i) => { if(v == null || !isFinite(v)){ if(cur.length) segs.push(cur); cur = []; } else cur.push(X(i) + ' ' + Y(v)); });
  if(cur.length) segs.push(cur);
  const paths = segs.filter(sg => sg.length > 1).map(sg => '<path pathLength="1" d="M' + sg.join(' L') + '"/>').join('')
    + pts.slice(1).filter((p, j) => p[0] - pts[j][0] > 1).map((p, j) => { const a = pts[pts.indexOf(p) - 1];
      return '<path class="is-gap" d="M' + X(a[0]) + ' ' + Y(a[1]) + ' L' + X(p[0]) + ' ' + Y(p[1]) + '"/>'; }).join('');
  const last = pts[pts.length - 1];
  const dots = (pts.length <= 3 ? pts.slice(0, -1).map(p => '<circle cx="' + X(p[0]) + '" cy="' + Y(p[1]) + '" r="2"/>').join('') : '')
    + '<circle class="is-last" cx="' + X(last[0]) + '" cy="' + Y(last[1]) + '" r="2.75"/>';
  const aria = (label ? label + ': ' : 'ряд: ') + data.map(v => v == null ? 'пропуск' : nf(v)).join(', ');
  return '<svg class="ks-spark" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(aria) + '">' + paths + dots + '</svg>';
};

/* ---------------- плитка показателя ----------------
   Подпись сверху, число, дельта чипом, спарклайн, источник. slot 1..5 это цвет спарклайна.
   delta это строка из KS.delta(). spark это массив значений ряда (null там, где съёма не было).
   drill делает плитку кликабельной и открывает панель деталей. */
KS.tile = function({ label, f, slot, icon, delta, drill, spark } = {}){
  const isF = f && typeof f === 'object' && 'v' in f;
  const attrs = drill ? ' class="ks-tile is-interactive" role="button" tabindex="0" data-drill="' + esc(drill) + '"' : ' class="ks-tile"';
  const sp = spark ? KS.spark(spark, { label }) : '';
  return '<div' + attrs + ' style="--slot:var(--cat-' + (slot || 3) + ')">'
    + '<div class="ks-tile-head"><span class="ks-tile-label">' + (icon ? ic(icon, 14) : '') + esc(label) + (drill ? ic('chev', 12, 'ks-ic ks-tile-go') : '') + '</span>' + (isF ? kind(f.k) : '') + '</div>'
    + '<div class="ks-tile-value ks-hero' + (isF && f.v == null ? ' ks-tile-empty' : '') + '" data-k="' + esc(label) + '">' + (isF ? val(f) : esc(f)) + '</div>'
    + ((delta || sp) ? '<div class="ks-tile-foot">' + (delta || '<span></span>') + sp + '</div>' : '')
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
  if(d.one && d.now != null) return '<div class="ks-delta is-na" data-tip="в периоде по этой метрике одна точка: сравнивать не с чем">одна точка</div>';
  if(d.abs == null) return '<div class="ks-delta is-na">нет ряда</div>';
  if(d.abs === 0) return '<div class="ks-delta is-flat">без изменений</div>';
  const t = S.tone(d.abs, goodUp);
  const rel = d.rel == null ? '' : ' ' + (d.rel > 0 ? '+' : '') + (d.rel * 100).toFixed(Math.abs(d.rel) < 0.1 ? 1 : 0).replace('.', ',') + '%';
  const title = 'было ' + nf(d.was) + ' на ' + ruDate(d.from) + ', стало ' + nf(d.now) + ' на ' + ruDate(d.to)
    + (d.vsPrev != null ? '; отрезком раньше ' + nf(d.prev) : '');
  return '<div class="ks-delta is-' + t + '" data-tip="' + esc(title) + '">' + ic(d.abs > 0 ? 'arrow-up' : 'arrow-down', 12)
    + '<span class="ks-num">' + (d.abs > 0 ? '+' : '') + nf(d.abs) + rel + '</span></div>';
};
/* Вердикт: главная строка экрана. «Стало лучше», «Стало хуже» или «Разнонаправленно»,
   под ним по строке на метрику: было, стало, изменение, отрезком раньше. */
KS.verdict = function(series, fields, days, label){
  const rows = fields.map(([f, name, goodUp]) => [name, S.dyn(series, f, days), goodUp]).filter(r => r[1].abs != null);
  const single = fields.map(([f, name]) => [name, S.dyn(series, f, days)]).filter(r => r[1].one && r[1].now != null);
  if(!rows.length) return KS.note('Сравнить не с чем', 'За период ' + esc(label || '') + ' в ряду нет двух точек. Возьми период шире или дождись следующего съёма.', 'warn');
  const good = rows.filter(r => S.tone(r[1].abs, r[2]) === 'good').length;
  const bad  = rows.filter(r => S.tone(r[1].abs, r[2]) === 'bad').length;
  const d5 = x => ruDate(x).slice(0, 5);
  const body = rows.map(([n, d, gu]) => '<div class="ks-verdict-row">'
      + '<span class="ks-verdict-name">' + esc(n) + '</span>'
      + '<span class="ks-verdict-path" data-tip="' + esc('было ' + nf(d.was) + ' на ' + ruDate(d.from) + ', стало ' + nf(d.now) + ' на ' + ruDate(d.to)) + '">'
      +   '<span>' + nf(d.was) + '</span><span class="ks-muted">' + d5(d.from) + '</span><span class="ks-muted" aria-hidden="true">→</span>'
      +   '<b style="font-weight:600">' + nf(d.now) + '</b><span class="ks-muted">' + d5(d.to) + '</span></span>'
      + '<span class="ks-delta-cell">' + KS.delta(d, gu) + '</span>'
      + '<span class="ks-verdict-prev">' + (d.vsPrev != null ? 'отрезком раньше ' + nf(d.prev) : '') + '</span></div>').join('');
  const head = bad === 0 ? 'Стало лучше' : good === 0 ? 'Стало хуже' : 'Разнонаправленно';
  const tone = bad === 0 ? 'ok' : good === 0 ? 'crit' : 'warn';
  const tail = single.length ? ' По метрикам «' + single.map(r => esc(r[0])).join('», «') + '» в периоде одна точка, они в вердикт не входят.' : '';
  return '<section class="ks-verdict ks-verdict--' + tone + '" aria-label="Вердикт">'
    + '<div class="ks-verdict-head">' + ic(tone === 'ok' ? 'up' : tone === 'crit' ? 'loss' : 'cmp', 18)
    + '<span class="ks-verdict-title">' + head + '</span>'
    + '<span class="ks-verdict-per">' + (label ? 'за ' + esc(label) + ' · ' : '') + 'точек в периоде ' + S.slice(series, days).cur.length + '</span></div>'
    + '<div class="ks-verdict-rows">' + body + '</div>'
    + (tail ? '<div class="ks-verdict-note">' + tail + '</div>' : '') + '</section>';
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
T.toggle = () => { const r = document.documentElement, m = T.isDark() ? 'light' : 'dark';
  r.classList.add('ks-theme-switching'); clearTimeout(T._sw); T._sw = setTimeout(() => r.classList.remove('ks-theme-switching'), 450);
  return KS.vt(() => T.set(m), { types:['ks-theme'] }); };
T.init = function(){
  let m = null; try{ m = localStorage.getItem('ks-theme'); }catch(e){}
  const pd = KS.prefs && KS.prefs.get().layout && KS.prefs.get().layout.theme;
  if(m === 'light' || m === 'dark') T.set(m, { persist:false });
  /* тема по умолчанию из настроек вида, если человек не выбирал сам и хост не поставил свою */
  else if((pd === 'light' || pd === 'dark') && !document.documentElement.hasAttribute('data-theme')) T.set(pd, { persist:false });
  else document.documentElement.classList.toggle('dark', T.isDark());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if(T.get() === 'system'){ document.documentElement.classList.toggle('dark', T.isDark()); T.emit(); } });
  /* хост сменил data-theme сам: перерисовать графики под новую тему */
  new MutationObserver(() => { document.documentElement.classList.toggle('dark', T.isDark()); T.emit(); })
    .observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
};
T.icon = () => ic(T.isDark() ? 'sun' : 'moon', 17, 'ks-ic ks-theme-ic');

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

/* ==========================================================================
   1.3: движение со смыслом и слои поверх контента
   Всё на transform, opacity и clip-path; при prefers-reduced-motion ничего не движется.
   ========================================================================== */
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.getAttribute('data-motion') === 'off';
const onReady = fn => document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn);

/* ---------------- сегмент с переезжающей плашкой ----------------
   KS.seg.wire(el): плашка едет к кнопке с aria-pressed="true". Следит за атрибутом сама,
   поэтому экрану достаточно переключить aria-pressed. Движение через clip-path: без пересчёта раскладки. */
const SG = KS.seg = {};
SG.place = function(el, instant){
  const pill = el.querySelector(':scope > .ks-seg-pill'), on = el.querySelector('button[aria-pressed="true"]');
  if(!pill) return;
  const i = pill.firstElementChild;
  if(!on){ el.classList.remove('has-pill'); return; }
  const W = pill.clientWidth, l = on.offsetLeft - pill.offsetLeft, r = W - l - on.offsetWidth;
  if(instant) i.style.transition = 'none';
  i.style.setProperty('--pill-l', Math.max(0, l) + 'px'); i.style.setProperty('--pill-r', Math.max(0, r) + 'px');
  if(instant){ i.getBoundingClientRect(); i.style.transition = ''; }
  el.classList.add('has-pill');
};
SG.wire = function(el){
  if(!el || el._ksSeg) return; el._ksSeg = true;
  const ensure = () => { if(!el.querySelector(':scope > .ks-seg-pill')){ const p = document.createElement('span'); p.className = 'ks-seg-pill'; p.setAttribute('aria-hidden', 'true'); p.appendChild(document.createElement('i')); el.prepend(p); SG.place(el, true); return true; } return false; };
  ensure(); requestAnimationFrame(() => SG.place(el, true));
  new MutationObserver(() => { if(!ensure()) SG.place(el); }).observe(el, { attributes:true, subtree:true, attributeFilter:['aria-pressed'], childList:true });
  if(window.ResizeObserver) new ResizeObserver(() => SG.place(el, true)).observe(el);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => SG.place(el, true));
};
onReady(() => document.querySelectorAll('.ks-seg').forEach(SG.wire));

/* ---------------- подсказка ----------------
   Любой элемент с data-tip: мышь (через 300 мс) и фокус с клавиатуры. Одна подсказка на страницу,
   стекло, не выходит за край экрана. На касании не показывается: там источник виден в плитке. */
const TP = KS.tip = { el:null, cur:null, timer:0 };
TP.show = function(t){
  const text = t && t.getAttribute('data-tip'); if(!text) return;
  if(!TP.el){ TP.el = document.createElement('div'); TP.el.id = 'ks-tip'; TP.el.className = 'ks-tip ks-glass'; TP.el.setAttribute('role', 'tooltip'); document.body.appendChild(TP.el); }
  const box = t.closest('[data-theme]'); if(box) TP.el.setAttribute('data-theme', box.getAttribute('data-theme')); else TP.el.removeAttribute('data-theme');
  TP.el.textContent = text; TP.cur = t; t.setAttribute('aria-describedby', 'ks-tip');
  const r = t.getBoundingClientRect(), w = TP.el.offsetWidth, h = TP.el.offsetHeight, m = 8;
  let x = Math.min(Math.max(m, r.left + r.width / 2 - w / 2), innerWidth - w - m), y = r.top - h - 8;
  if(y < m) y = r.bottom + 8;
  TP.el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  TP.el.classList.add('is-on');
};
TP.hide = function(){ clearTimeout(TP.timer); if(TP.cur){ TP.cur.removeAttribute('aria-describedby'); TP.cur = null; } if(TP.el) TP.el.classList.remove('is-on'); };
document.addEventListener('pointerover', e => { if(e.pointerType === 'touch') return; const t = e.target.closest && e.target.closest('[data-tip]');
  if(t && t !== TP.cur){ clearTimeout(TP.timer); TP.timer = setTimeout(() => TP.show(t), 300); } else if(!t) TP.hide(); });
document.addEventListener('pointerout', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if(t && !t.contains(e.relatedTarget)) TP.hide(); });
document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if(t && t.matches(':focus-visible')) TP.show(t); });
document.addEventListener('focusout', () => TP.hide());
document.addEventListener('keydown', e => { if(e.key === 'Escape') TP.hide(); });
addEventListener('scroll', () => TP.hide(), { passive:true, capture:true });

/* ---------------- уведомление ----------------
   KS.toast('Ссылка скопирована') или KS.toast('Выгрузка не пришла', 'warn'). Живёт 2,8 секунды. */
KS.toast = function(text, tone){
  let box = document.getElementById('ks-toasts');
  if(!box){ box = document.createElement('div'); box.id = 'ks-toasts'; box.className = 'ks-toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const t = document.createElement('div'), tn = tone || 'ok';
  t.className = 'ks-toast ks-glass'; t.style.setProperty('--tone', 'var(--' + tn + ')');
  t.innerHTML = (tn === 'ok' ? KS.motion.check(16) : ic(tn === 'info' ? 'info' : 'warn', 16)) + '<span>' + esc(text) + '</span>';
  box.appendChild(t);
  setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), reduced() ? 0 : 200); }, 2800);
};

/* ---------------- палитра команд (Cmd+K, Ctrl+K) ----------------
   KS.cmdk.set([{ group, label, hint, icon, keywords, run }]); кнопка в шапке: KS.cmdk.button().
   Поиск по словам в любом порядке, стрелки, Enter, Esc; фокус возвращается туда, откуда открыли. */
const K = KS.cmdk = { items:[], open:false, act:0, shown:[], last:null };
const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
K.set = items => { K.items = items || []; };
K.button = label => '<button type="button" class="ks-cmdk-btn" data-cmdk aria-label="Команды и поиск" aria-keyshortcuts="' + (mac ? 'Meta+K' : 'Control+K') + '">'
  + ic('search', 15) + '<span class="ks-cmdk-lbl">' + esc(label || 'Поиск') + '</span><kbd class="ks-kbd">' + (mac ? '⌘K' : 'Ctrl K') + '</kbd></button>';
const norm = t => String(t || '').toLowerCase().replace(/ё/g, 'е');
K.filter = function(q){
  const words = norm(q).split(/\s+/).filter(Boolean);
  if(!words.length) return K.items.slice();
  return K.items.map(it => { const hay = norm([it.label, it.hint, it.group, it.keywords].join(' '));
      return words.every(w => hay.includes(w)) ? [it, norm(it.label).indexOf(words[0])] : null; })
    .filter(Boolean).sort((a, b) => (a[1] < 0) - (b[1] < 0) || a[1] - b[1]).map(x => x[0]);
};
K.draw = function(){
  const list = K.bd.querySelector('.ks-cmdk-list'), q = K.bd.querySelector('.ks-cmdk-input').value;
  K.shown = K.filter(q); K.act = Math.min(K.act, Math.max(0, K.shown.length - 1));
  if(!K.shown.length){ list.innerHTML = '<div class="ks-cmdk-empty">Ничего не нашлось. Попробуй другое слово.</div>'; K.bd.querySelector('.ks-cmdk-input').removeAttribute('aria-activedescendant'); return; }
  let html = '', g = null;
  K.shown.forEach((it, i) => {
    if(it.group !== g){ g = it.group; if(g) html += '<div class="ks-cmdk-group" role="presentation">' + esc(g) + '</div>'; }
    html += '<div class="ks-cmdk-item" role="option" id="ks-cmdk-' + i + '" data-i="' + i + '" aria-selected="' + (i === K.act) + '">'
      + ic(it.icon || 'chev', 16) + '<span class="ks-cmdk-label">' + esc(it.label) + '</span>' + (it.hint ? '<span class="ks-cmdk-hint">' + esc(it.hint) + '</span>' : '') + '</div>';
  });
  list.innerHTML = html;
  K.bd.querySelector('.ks-cmdk-input').setAttribute('aria-activedescendant', 'ks-cmdk-' + K.act);
};
K.move = function(d){
  if(!K.shown.length) return; K.act = (K.act + d + K.shown.length) % K.shown.length;
  K.bd.querySelectorAll('.ks-cmdk-item').forEach(x => x.setAttribute('aria-selected', String(+x.dataset.i === K.act)));
  const a = K.bd.querySelector('#ks-cmdk-' + K.act); if(a) a.scrollIntoView({ block:'nearest' });
  K.bd.querySelector('.ks-cmdk-input').setAttribute('aria-activedescendant', 'ks-cmdk-' + K.act);
};
K.run = function(i){ const it = K.shown[i]; if(!it) return; K.hide(); if(it.run) setTimeout(() => it.run(), 0); };
K.ensure = function(){
  if(K.bd) return;
  K.bd = document.createElement('div'); K.bd.className = 'ks-cmdk-bd'; K.bd.hidden = true;
  K.bd.innerHTML = '<div class="ks-cmdk ks-glass" role="dialog" aria-modal="true" aria-label="Команды и поиск">'
    + '<div class="ks-cmdk-top">' + ic('search', 17) + '<input class="ks-cmdk-input" type="text" role="combobox" aria-expanded="true" aria-controls="ks-cmdk-list" aria-autocomplete="list" placeholder="Экран, задача, действие" autocomplete="off" spellcheck="false"></div>'
    + '<div class="ks-cmdk-list" id="ks-cmdk-list" role="listbox"></div>'
    + '<div class="ks-cmdk-foot"><span><kbd class="ks-kbd">↑</kbd><kbd class="ks-kbd">↓</kbd>выбор</span><span><kbd class="ks-kbd">Enter</kbd>открыть</span><span><kbd class="ks-kbd">Esc</kbd>закрыть</span></div></div>';
  document.body.appendChild(K.bd);
  const inp = K.bd.querySelector('.ks-cmdk-input');
  inp.addEventListener('input', () => { K.act = 0; K.draw(); });
  inp.addEventListener('keydown', e => {
    if(e.key === 'ArrowDown'){ e.preventDefault(); K.move(1); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); K.move(-1); }
    else if(e.key === 'Enter'){ e.preventDefault(); K.run(K.act); }
    else if(e.key === 'Escape'){ e.preventDefault(); K.hide(); }
    else if(e.key === 'Tab'){ e.preventDefault(); }
  });
  K.bd.addEventListener('mousedown', e => { if(e.target === K.bd) K.hide(); });
  K.bd.addEventListener('click', e => { const it = e.target.closest('.ks-cmdk-item'); if(it) K.run(+it.dataset.i); });
  K.bd.addEventListener('mousemove', e => { const it = e.target.closest('.ks-cmdk-item'); if(it && +it.dataset.i !== K.act){ K.act = +it.dataset.i - 0; K.move(0); } });
};
K.show = function(){
  K.ensure(); K.last = document.activeElement; K.open = true; K.act = 0;
  const inp = K.bd.querySelector('.ks-cmdk-input'); inp.value = ''; K.draw();
  K.bd.hidden = false; document.documentElement.classList.add('ks-lock'); inp.focus();
};
K.hide = function(){
  if(!K.bd || !K.open) return; K.open = false; K.bd.hidden = true;
  const d = document.getElementById('ks-drawer'), sb = KS.shell && KS.shell.isOpen && KS.shell.isOpen();
  if(!(d && d.classList.contains('is-open')) && !sb) document.documentElement.classList.remove('ks-lock');
  if(K.last && K.last.focus) K.last.focus();
};
document.addEventListener('keydown', e => { if((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л')){ e.preventDefault(); K.open ? K.hide() : K.show(); } });
document.addEventListener('click', e => { if(e.target.closest && e.target.closest('[data-cmdk]')) K.show(); });

/* ---------------- число переходит к новому значению ----------------
   Только при обновлении данных, не при загрузке: на первом показе число сразу на месте.
   KS.ticker.run(корень) вызывается после каждой отрисовки экрана. 450 мс, без перелёта. */
const TK = KS.ticker = { cache:{} };
TK.run = function(root){
  const rm = reduced();
  (root || document).querySelectorAll('[data-k] [data-num]').forEach(el => {
    const k = el.closest('[data-k]').getAttribute('data-k'), to = +el.getAttribute('data-v'), from = TK.cache[k];
    TK.cache[k] = to;
    if(rm || from == null || from === to || !isFinite(from) || !isFinite(to)) return;
    const t0 = performance.now(), dur = 450, dec = (String(to).split('.')[1] || '').length;
    const step = t => { const q = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - q, 3);
      el.textContent = nf(+(from + (to - from) * e).toFixed(dec)); if(q < 1) requestAnimationFrame(step); else el.textContent = nf(to); };
    requestAnimationFrame(step);
  });
};

/* ---------------- подсветка под курсором на кликабельном ----------------
   Пишет --mx и --my плитке или карточке под курсором; сам отлив рисует CSS. Только мышь. */
let spotEl = null, spotRaf = 0, spotEv = null;
document.addEventListener('pointermove', e => {
  if(e.pointerType !== 'mouse') return; spotEv = e;
  if(spotRaf) return;
  spotRaf = requestAnimationFrame(() => { spotRaf = 0;
    const t = spotEv.target.closest && spotEv.target.closest('.ks-tile.is-interactive, .ks-card.is-interactive');
    if(spotEl && spotEl !== t){ spotEl.style.removeProperty('--mx'); spotEl.style.removeProperty('--my'); }
    spotEl = t || null; if(!t) return;
    const r = t.getBoundingClientRect(); t.style.setProperty('--mx', (spotEv.clientX - r.left) + 'px'); t.style.setProperty('--my', (spotEv.clientY - r.top) + 'px');
  });
}, { passive:true });

/* ---------------- заглушка на время загрузки ----------------
   KS.skeleton(3) это три строки; KS.skeleton(0, 180) это блок высотой 180 под график.
   Не путать с ДЕМО: там выгрузки нет, здесь она едет. */
KS.skeleton = (lines, height) => '<div class="ks-stack" style="gap:var(--sp-2)" aria-busy="true" aria-label="Загрузка">'
  + (height ? '<span class="ks-skeleton" style="height:' + height + 'px"></span>' : Array.from({ length: lines || 3 }, (_, i) => '<span class="ks-skeleton" style="width:' + (i % 3 === 2 ? 60 : 100) + '%"></span>').join('')) + '</div>';
/* ==========================================================================
   1.4: плотность, липкие шапки таблиц, переходы между экранами, микроанимации, Rive
   ========================================================================== */

/* ---------------- переход между экранами ----------------
   KS.vt(() => { VIEW = v; render(); scrollTo(0, 0); }) : старое гаснет, новое проявляется.
   Нет View Transitions, «меньше движения», скрытая вкладка, открыто меню, панель или палитра:
   обновление выполняется сразу, без анимации. Быстрые повторные клики не копятся. */
let vtCur = null;
KS.vt = function(update, opts){
  const o = opts || {}, d = document, run = () => { update(); };
  const dr = d.getElementById('ks-drawer');
  const busy = (KS.shell && KS.shell.isOpen && KS.shell.isOpen()) || (dr && dr.classList.contains('is-open')) || (KS.cmdk && KS.cmdk.open);
  if(typeof d.startViewTransition !== 'function' || reduced() || d.documentElement.hasAttribute('data-motion') || d.visibilityState !== 'visible' || busy){ run(); return Promise.resolve(); }
  if(vtCur){ try{ vtCur.skipTransition(); }catch(e){} }
  const types = (o.types || []).slice();
  if(!types.length && (window.scrollY || 0) > 64) types.push('ks-jump');
  let t;
  try{ t = types.length ? d.startViewTransition({ update:run, types }) : d.startViewTransition(run); }
  catch(e){ try{ t = d.startViewTransition(run); }catch(e2){ run(); return Promise.resolve(); } }
  vtCur = t;
  t.ready.catch(() => {});
  t.finished.catch(() => {}).finally(() => { if(vtCur === t) vtCur = null; });
  return t.updateCallbackDone.catch(() => {});
};

/* ---------------- плотность: просторно или компактно ----------------
   KS.density.set('compact') ставит data-density="compact" на корень и запоминает выбор.
   Просторно это вид по умолчанию. Цели пальца на касании не уменьшаются никогда. */
const DN = KS.density = {};
DN.get = () => document.documentElement.getAttribute('data-density') === 'compact' ? 'compact' : 'comfortable';
DN.set = function(mode, opts){
  const r = document.documentElement, o = opts || {};
  const apply = () => { if(mode === 'compact') r.setAttribute('data-density', 'compact'); else r.removeAttribute('data-density');
    document.dispatchEvent(new CustomEvent('ks:density', { detail:{ mode:DN.get() } })); };
  if(o.persist !== false){ try{ localStorage.setItem('ks-density', mode); }catch(e){} }
  return o.instant ? (apply(), Promise.resolve()) : KS.vt(apply, { types:['ks-density'] });
};
DN.toggle = () => DN.set(DN.get() === 'compact' ? 'comfortable' : 'compact');
DN.label = () => DN.get() === 'compact' ? 'Компактно' : 'Просторно';
DN.icon = size => ic(DN.get() === 'compact' ? 'rows-dense' : 'rows', size || 17);
/* выбор из прошлого визита ставится сразу при загрузке кита, до первой отрисовки */
try{ if(localStorage.getItem('ks-density') === 'compact') document.documentElement.setAttribute('data-density', 'compact'); }catch(e){}

/* ---------------- таблицы: липкая шапка ----------------
   Шапка держится за страницу, если таблица влезла по ширине (класс is-fit снимает прокрутку вбок),
   и за свою обёртку, если это .ks-table-wrap--scroll. Под прилипшей шапкой появляется мягкая тень. */
const TB = KS.tables = { seen:new WeakSet() };
TB.fit = function(w){
  if(w.classList.contains('ks-table-wrap--scroll')) return;
  const t = w.querySelector(':scope > table'); if(!t) return;
  w.classList.toggle('is-fit', t.offsetWidth <= w.clientWidth + 1);
};
TB.scan = function(root){
  (root || document).querySelectorAll('.ks-table-wrap').forEach(w => {
    TB.fit(w);
    if(!TB.seen.has(w)){ TB.seen.add(w); if(TB.ro) TB.ro.observe(w); }
  });
  TB.stuck();
};
TB.stuck = function(){
  document.querySelectorAll('.ks-table-wrap thead').forEach(h => {
    const th = h.querySelector('th'); if(!th) return;
    const a = h.parentElement.getBoundingClientRect(), b = th.getBoundingClientRect();
    h.classList.toggle('is-stuck', b.top - a.top > 1 && a.bottom > b.bottom + 4);
  });
};
if(window.ResizeObserver) TB.ro = new ResizeObserver(es => es.forEach(e => TB.fit(e.target)));
let tbRaf = 0;
const tbLater = fn => { if(tbRaf) return; tbRaf = requestAnimationFrame(() => { tbRaf = 0; fn(); }); };
addEventListener('scroll', () => tbLater(TB.stuck), { passive:true, capture:true });
onReady(() => {
  TB.scan(document);
  if(window.MutationObserver) new MutationObserver(ms => { if(ms.some(m => m.addedNodes.length)) tbLater(() => TB.scan(document)); })
    .observe(document.body, { childList:true, subtree:true });
});

/* ---------------- меню: подложка выбранного пункта переезжает ----------------
   KS.navhl.wire(nav) подключается сама ко всем .ks-nav. Меню можно перерисовывать целиком через
   innerHTML: подложка появится там, где была, и переедет к новому выбранному пункту. */
const NH = KS.navhl = {};
NH.wire = function(nav){
  if(!nav || nav._ksHl) return;
  const st = nav._ksHl = { x:0, y:0, w:0, h:0, on:false };
  const put = (hl, v) => { hl.style.setProperty('--hl-x', v.x + 'px'); hl.style.setProperty('--hl-y', v.y + 'px');
    hl.style.setProperty('--hl-w', v.w + 'px'); hl.style.setProperty('--hl-h', v.h + 'px'); };
  const place = instant => {
    let hl = nav.querySelector(':scope > .ks-nav-hl'); const fresh = !hl;
    if(fresh){ hl = document.createElement('span'); hl.className = 'ks-nav-hl'; hl.setAttribute('aria-hidden', 'true'); nav.prepend(hl);
      if(st.on){ hl.style.transition = 'none'; put(hl, st); hl.getBoundingClientRect(); hl.style.transition = ''; } }
    nav.classList.add('has-hl');
    const a = nav.querySelector('.ks-nav-item.is-active');
    if(!a || a.offsetParent === null || a.closest('.ks-nav-sub:not(.is-open)')){ hl.classList.add('is-hidden'); return; }
    const v = { x:a.offsetLeft, y:a.offsetTop, w:a.offsetWidth, h:a.offsetHeight };
    const jump = instant || !st.on || reduced();
    if(jump) hl.style.transition = 'none';
    Object.assign(st, v, { on:true }); put(hl, v); hl.classList.remove('is-hidden');
    if(jump){ hl.getBoundingClientRect(); hl.style.transition = ''; }
  };
  NH.place = place;
  place(true);
  new MutationObserver(ms => {
    if(ms.some(m => m.type === 'childList' ? [...m.addedNodes].some(n => !(n.classList && n.classList.contains('ks-nav-hl')))
      : m.target !== nav && m.target.classList && m.target.classList.contains('ks-nav-item'))) place(false);
  }).observe(nav, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  /* аккордеон раскрывается: пункты под ним едут, подложка идёт следом кадр в кадр */
  let loop = 0;
  const follow = () => { place(true); loop = requestAnimationFrame(follow); };
  nav.addEventListener('transitionstart', e => { if(e.propertyName === 'grid-template-rows' && !loop) loop = requestAnimationFrame(follow); });
  nav.addEventListener('transitionend', e => { if(e.propertyName === 'grid-template-rows'){ cancelAnimationFrame(loop); loop = 0; place(true); } });
  if(window.ResizeObserver) new ResizeObserver(() => place(true)).observe(nav);
};
onReady(() => document.querySelectorAll('.ks-nav').forEach(NH.wire));

/* ---------------- микроанимации ----------------
   Родные, на SVG и CSS: работают везде, при «меньше движения» стоят на месте.
   Если подключён KS.rive, те же места получают анимацию Rive, родная остаётся запасной. */
const MO = KS.motion = {};
const SYNC = { idle:'Данные не обновлялись', loading:'Данные обновляются', done:'Данные обновлены', error:'Обновление не удалось' };
/* KS.motion.sync('loading') и KS.motion.setSync(el, 'done'). Только для настоящей загрузки. */
MO.sync = (state, size) => { const s = SYNC[state] ? state : 'idle';
  return '<span class="ks-sync" data-rive="sync" data-state="' + s + '" role="img" aria-label="' + SYNC[s] + '"' + (size ? ' style="--sync-s:' + size + 'px"' : '') + '>'
    + '<svg viewBox="0 0 20 20" aria-hidden="true"><circle class="ks-sync-track" cx="10" cy="10" r="7"/><circle class="ks-sync-arc" cx="10" cy="10" r="7" pathLength="100"/>'
    + '<path class="ks-sync-ok" pathLength="1" d="M6.9 10.2l2.1 2.1 4.1-4.5"/><path class="ks-sync-err" pathLength="1" d="M10 6.4v4.2"/><circle class="ks-sync-dot" cx="10" cy="13.4" r="1"/></svg></span>'; };
MO.setSync = (el, state) => { if(!el || !SYNC[state]) return; el.setAttribute('data-state', state); el.setAttribute('aria-label', SYNC[state]); };
/* галочка подтверждения: круг, потом галочка; в уведомлении KS.toast она уже стоит */
MO.check = size => { const s = size || 16;
  return '<span class="ks-check-draw" data-rive="success" style="width:' + s + 'px;height:' + s + 'px" aria-hidden="true">'
    + '<svg viewBox="0 0 20 20" width="' + s + '" height="' + s + '"><circle pathLength="1" cx="10" cy="10" r="7.6" transform="rotate(-90 10 10)"/><path pathLength="1" d="M6.7 10.3l2.3 2.3 4.4-4.9"/></svg></span>'; };
/* пустой график: ось, сетка, линия с разрывом пунктиром, точка на конце */
MO.emptyArt = () => '<span class="ks-empty-art" data-rive="empty" aria-hidden="true"><svg viewBox="0 0 160 96">'
  + '<path class="g" d="M12 24H148M12 48H148"/><path class="a" d="M12 72H148"/>'
  + '<path class="l" pathLength="1" d="M16 62 34 48 52 55 70 40"/><path class="gap" d="M76 41 90 45"/>'
  + '<path class="l l2" pathLength="1" d="M96 46 114 36 132 42 146 28"/><circle class="d" cx="146" cy="28" r="3.2"/></svg></span>';

/* ---------------- Rive: анимации из файлов .riv поверх родных ----------------
   KS.rive.enable() подгружает рантайм @rive-app/canvas-single (WASM внутри JS, без запросов за .wasm)
   и заменяет родные микроанимации там, где есть data-rive="sync|success|empty". Файлы берутся из
   window.KS_RIVE_FILES (kit/motion.riv.js, base64). Цвета приходят из токенов и меняются вместе с темой.
   Нет сети, запрет WASM в песочнице, «меньше движения»: остаются родные анимации, ничего не ломается. */
const RV = KS.rive = { on:false, live:[], url:'https://cdn.jsdelivr.net/npm/@rive-app/canvas-single@2.43.0/rive.min.js' };
const RV_STATE = { idle:0, loading:1, done:2, error:3 };
const RV_COLORS = { ink:'--text-strong', muted:'--text-muted', accent:'--primary', ok:'--ok', crit:'--crit' };
RV.load = function(){
  if(window.rive && window.rive.Rive) return Promise.resolve();
  if(RV._p) return RV._p;
  RV._p = new Promise((ok, no) => { const s = document.createElement('script'); s.src = RV.url; s.async = true;
    s.onload = () => window.rive && window.rive.Rive ? ok() : no(new Error('rive')); s.onerror = no; document.head.appendChild(s);
    setTimeout(() => no(new Error('timeout')), 20000); });
  return RV._p;
};
RV.buffer = name => { const b = (window.KS_RIVE_FILES || {})[name]; if(!b) return null;
  const s = atob(b), u = new Uint8Array(s.length); for(let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
RV.rgb = (el, tok) => { const p = document.createElement('i'); p.style.cssText = 'position:absolute;width:0;height:0;color:var(' + tok + ')'; el.appendChild(p);
  const m = getComputedStyle(p).color.match(/\d+(\.\d+)?/g) || [0, 0, 0]; p.remove(); return m.slice(0, 3).map(x => Math.round(+x)); };
RV.paint = it => { const vm = it.r.viewModelInstance; if(!vm) return;
  for(const [k, tok] of Object.entries(RV_COLORS)){ try{ const c = RV.rgb(it.el, tok); vm.color(k).argb(255, c[0], c[1], c[2]); }catch(e){} } };
RV.state = it => { const vm = it.r.viewModelInstance; if(vm && it.name === 'sync'){ try{ vm.number('state').value = RV_STATE[it.el.getAttribute('data-state')] || 0; }catch(e){} } };
RV.mount = function(el){
  if(el._ksRive) return; const name = el.getAttribute('data-rive'), buf = RV.buffer(name); if(!buf) return;
  el._ksRive = true;
  const box = el.getBoundingClientRect(), cv = document.createElement('canvas');
  cv.className = 'ks-rive-canvas'; cv.setAttribute('aria-hidden', 'true');
  cv.width = Math.max(1, Math.round(box.width)); cv.height = Math.max(1, Math.round(box.height)); el.appendChild(cv);
  const it = { el, cv, name, r:null };
  try{
    it.r = new window.rive.Rive({ canvas:cv, buffer:buf, stateMachine:name, autoplay:true, autoBind:true,
      layout:new window.rive.Layout({ fit:window.rive.Fit.Contain, alignment:window.rive.Alignment.Center }),
      onLoad:() => { try{ it.r.resizeDrawingSurfaceToCanvas(); RV.paint(it); RV.state(it); el.classList.add('is-rive'); }catch(e){ RV.drop(it); } },
      onLoadError:() => RV.drop(it) });
  }catch(e){ RV.drop(it); return; }
  if(name === 'sync') it.mo = new MutationObserver(() => RV.state(it)), it.mo.observe(el, { attributes:true, attributeFilter:['data-state'] });
  if(RV.io) RV.io.observe(el);
  RV.live.push(it);
};
RV.drop = it => { try{ it.r && it.r.cleanup(); }catch(e){} if(it.mo) it.mo.disconnect(); if(RV.io) RV.io.unobserve(it.el);
  it.cv.remove(); it.el.classList.remove('is-rive'); it.el._ksRive = false; RV.live = RV.live.filter(x => x !== it); };
RV.scan = function(root){
  RV.live.filter(it => !it.el.isConnected).forEach(RV.drop);
  (root || document).querySelectorAll('[data-rive]').forEach(RV.mount);
};
RV.enable = function(opts){
  const o = opts || {};
  if(o.url) RV.url = o.url; if(o.files) window.KS_RIVE_FILES = o.files;
  if(reduced() || document.documentElement.hasAttribute('data-motion') || !window.KS_RIVE_FILES) return Promise.resolve(false);
  return RV.load().then(() => {
    if(RV.on) return true; RV.on = true;
    if(window.IntersectionObserver) RV.io = new IntersectionObserver(es => es.forEach(e => {
      const it = RV.live.find(x => x.el === e.target); if(it && it.r){ try{ e.isIntersecting ? it.r.play() : it.r.pause(); }catch(err){} } }));
    RV.scan(document);
    new MutationObserver(ms => { if(ms.some(m => m.addedNodes.length || m.removedNodes.length)) requestAnimationFrame(() => RV.scan(document)); })
      .observe(document.body, { childList:true, subtree:true });
    document.addEventListener('ks:theme', () => requestAnimationFrame(() => RV.live.forEach(RV.paint)));
    return true;
  }, () => false);
};
/* ==========================================================================
   1.5: настройки вида шаблона (KS.prefs)
   Источник: настройки из этого браузера (localStorage 'ks-prefs'), иначе настройки проекта
   window.KS_BRAND (kit/brand.js), иначе вид Контура по умолчанию. Готовые значения CSS
   считает страница templates/nastroyki.html и кладёт в prefs.vars; кит их только вставляет,
   поэтому в ките нет ни одного цвета мимо токенов. Контраст проверен на странице настроек.
   ========================================================================== */
const PF = KS.prefs = { KEY:'ks-prefs', cur:null };
const PF_KEY = /^--[\w-]+$/, PF_VAL = /^[#\w\s().,%+\-*/]+$/, PF_IMG = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
PF.get = () => PF.cur || {};
PF.load = function(){
  let p = null; try{ p = JSON.parse(localStorage.getItem(PF.KEY) || 'null'); }catch(e){}
  return p && typeof p === 'object' ? p : (window.KS_BRAND && typeof window.KS_BRAND === 'object' ? window.KS_BRAND : null);
};
/* Переменные в CSS: имена и значения проверяются, чтобы импорт чужого файла не протащил лишнего */
const pfDecl = o => Object.entries(o || {}).filter(([k, v]) => PF_KEY.test(k) && PF_VAL.test(String(v))).map(([k, v]) => k + ':' + v).join(';');
PF.css = function(p, scope){
  const V = (p && p.vars) || {}, root = !scope || scope === ':root';
  const S = root ? ':root' : scope;
  const light = root ? ':root,[data-theme="light"]' : S + ',' + S + ' [data-theme="light"]';
  const dark = root ? '[data-theme="dark"],:root.dark' : S + '[data-theme="dark"],' + S + ' [data-theme="dark"]';
  let out = '';
  if(V.base) out += S + '{' + pfDecl(V.base) + '}';
  if(V.light) out += light + '{' + pfDecl(V.light) + '}';
  if(V.dark){ out += dark + '{' + pfDecl(V.dark) + '}';
    if(root) out += '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]):not(.light){' + pfDecl(V.dark) + '}}'; }
  if(V.compact) out += (root ? ':root[data-density="compact"],:root [data-density="compact"]' : S + '[data-density="compact"],' + S + ' [data-density="compact"]') + '{' + pfDecl(V.compact) + '}';
  if(V.comfortable) out += (root ? ':root [data-density="comfortable"]' : S + ' [data-density="comfortable"]') + '{' + pfDecl(V.comfortable) + '}';
  return out;
};
/* Логотип и подпись в блоке бренда: знак в квадрате или логотип целиком, отдельный файл или инверсия для тёмной */
PF.brandImgs = function(b){
  if(!b || !PF_IMG.test(b.logo || '')) return '';
  const dark = b.darkLogo === 'file' && PF_IMG.test(b.logoDark || '');
  return '<img class="ks-brand-img ks-brand-img--light' + (dark ? ' has-dark' : '') + (b.darkLogo === 'invert' ? ' ks-brand-img--invert' : '') + '" src="' + b.logo + '" alt="">'
    + (dark ? '<img class="ks-brand-img ks-brand-img--dark" src="' + b.logoDark + '" alt="">' : '');
};
PF.brandDom = function(p, root){
  const b = (p && p.brand) || {}, imgs = PF.brandImgs(b);
  (root || document).querySelectorAll('.ks-brand-mark').forEach(m => {
    if(!m._ksSvg) m._ksSvg = m.innerHTML;
    m.querySelectorAll('.ks-brand-img').forEach(x => x.remove());
    m.classList.toggle('has-img', !!imgs);
    if(imgs) m.insertAdjacentHTML('beforeend', imgs);
  });
  (root || document).querySelectorAll('.ks-brand').forEach(br => {
    br.classList.toggle('ks-brand--wide', !!imgs && b.logoMode === 'wide');
    const n = br.querySelector('.ks-brand-name'), s = br.querySelector('.ks-brand-sub');
    if(n){ if(n._ksText == null) n._ksText = n.textContent; n.textContent = b.name || n._ksText; }
    if(s){ if(s._ksText == null) s._ksText = s.textContent; s.textContent = b.sub != null && b.sub !== '' ? b.sub : s._ksText; }
    const img = br.querySelector('.ks-brand-img'); if(img) img.alt = b.name || (n ? n.textContent : '');
  });
  /* иконка вкладки из логотипа */
  if(!root && PF_IMG.test(b.logo || '')){ let l = document.querySelector('link[rel="icon"]');
    if(!l){ l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); } l.href = b.logo; }
};
PF.apply = function(p){
  PF.cur = p || null;
  const r = document.documentElement, x = PF.cur || {};
  let st = document.getElementById('ks-prefs-style');
  const css = PF.css(x, ':root');
  if(css && !st){ st = document.createElement('style'); st.id = 'ks-prefs-style'; document.head.appendChild(st); }
  if(st) st.textContent = css;
  const mo = x.motion === 'calm' || x.motion === 'off' ? x.motion : null;
  if(mo) r.setAttribute('data-motion', mo); else r.removeAttribute('data-motion');
  r.classList.toggle('ks-has-logo', !!(x.brand && PF_IMG.test(x.brand.logo || '')));
  if(document.body) PF.brandDom(x);
  document.dispatchEvent(new CustomEvent('ks:prefs', { detail:x }));
};
PF.save = function(p){ try{ localStorage.setItem(PF.KEY, JSON.stringify(p)); }catch(e){ return false; } PF.apply(p); return true; };
PF.reset = function(){ try{ localStorage.removeItem(PF.KEY); }catch(e){} PF.apply(window.KS_BRAND || null); };
/* Код для проекта: kit/brand.js с этими настройками увидят все, кто откроет шаблоны */
PF.code = p => '/* Контур DS · настройки вида проекта. Создано на странице templates/nastroyki.html */\nwindow.KS_BRAND = ' + JSON.stringify(p) + ';\n';

/* старт: вид применяется до первой отрисовки, логотип и подпись после разбора страницы */
PF.apply(PF.load());
(function(){ const L = PF.get().layout || {};
  let d = null; try{ d = localStorage.getItem('ks-density'); }catch(e){}
  if(!d && L.density === 'compact') document.documentElement.setAttribute('data-density', 'compact'); })();
onReady(() => {
  PF.brandDom(PF.get());
  const L = PF.get().layout || {};
  if(L.collapsed && !matchMedia('(max-width:1023px)').matches) document.querySelectorAll('.ks-sidebar').forEach(s => s.classList.add('is-collapsed'));
});
})(window);
