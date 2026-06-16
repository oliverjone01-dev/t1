/* ============================================================================
   cms.js - слой данных контент-системы GENGROUP.

   Источник: Google-таблица (см. cms-config.js + README-cms.md). Сайт читает её
   при каждой загрузке через gviz JSON-эндпоинт (без бэкенда, без API-ключа).
   SMM правит таблицу → сайт обновляется при следующей загрузке.

   Надёжность:
   - если таблица не настроена / недоступна / вкладка переименована - рендерим
     из window.GG_CMS_SEED, сайт НЕ пустеет (видно плашку «источник: резерв»).
   - cache-bust в URL + cache:'no-store', чтобы правки подхватывались быстро.

   Привязка комментов: каждый пост рендерится как блок с data-annotate-key =
   "post-<id>" - комментарий нашей системы annotate держится за конкретный пост
   и не сползает при переупорядочивании строк в таблице.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.GG_CMS_CONFIG || null;
  var SEED = window.GG_CMS_SEED || { rubricator: [], plan: [], updated: '' };

  /* ---------- нормализация значений ---------- */
  function norm(s) { return String(s == null ? '' : s).trim(); }
  function low(s) { return norm(s).toLowerCase(); }
  function esc(s) { return norm(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function brandOf(v) {
    var x = low(v);
    if (x === 'v' || x === 'в' || x.indexOf('valonti') === 0 || x.indexOf('валонти') === 0) return 'V';
    return 'G'; // дефолт - GENGLASS
  }
  function boolOf(v) { var x = low(v); return x === 'да' || x === 'true' || x === '1' || x === 'yes' || x === 'y' || x === '+'; }
  function statusOf(v) {
    var x = low(v);
    if (x.indexOf('опублик') === 0 || x === 'published' || x === 'live' || x === 'done') return 'опубликовано';
    if (x.indexOf('готов') === 0 || x === 'ready') return 'готово';
    return 'план'; // дефолт - план/черновик
  }

  /* ---------- gviz: запрос и разбор ---------- */
  function gvizUrl(tab) {
    // tab пустой -> читаем первую вкладку (на случай неизвестного имени листа).
    return 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(CFG.sheetId) +
      '/gviz/tq?tqx=out:json&headers=1' + (tab ? '&sheet=' + encodeURIComponent(tab) : '') + '&_=' + Date.now();
  }
  function parseGviz(text) {
    var i = text.indexOf('setResponse('), j = text.lastIndexOf(')');
    if (i < 0 || j < 0) throw new Error('gviz: неожиданный ответ');
    var obj = JSON.parse(text.slice(i + 'setResponse('.length, j));
    if (!obj.table) throw new Error('gviz: нет table (проверьте доступ к таблице)');
    var cols = (obj.table.cols || []).map(function (c) { return low(c.label || c.id); });
    return (obj.table.rows || []).map(function (r) {
      var o = {};
      (r.c || []).forEach(function (cell, k) {
        var key = cols[k]; if (!key) return;
        o[key] = cell ? (cell.v == null ? '' : cell.v) : '';
      });
      return o;
    }).filter(function (o) { return Object.keys(o).some(function (k) { return norm(o[k]) !== ''; }); });
  }
  function fetchTab(tab) {
    return fetch(gvizUrl(tab), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('gviz HTTP ' + r.status); return r.text();
    }).then(parseGviz);
  }

  /* ---------- маппинг строк таблицы в модель ---------- */
  function pick(o) { for (var i = 1; i < arguments.length; i++) { var k = arguments[i]; if (o[k] != null && norm(o[k]) !== '') return o[k]; } return ''; }
  function mapRubric(rows) {
    return rows.map(function (o) {
      return {
        brand: brandOf(pick(o, 'бренд', 'brand')),
        rubric: norm(pick(o, 'рубрика', 'rubric')),
        format: norm(pick(o, 'формат', 'format')),
        channel: norm(pick(o, 'канал', 'channel')),
        task: norm(pick(o, 'задача', 'task')),
        freq: norm(pick(o, 'частота', 'freq')),
        kpi: norm(pick(o, 'kpi', 'kpi-сигнал', 'кпи')),
        active: (function () { var v = pick(o, 'активна', 'active'); return v === '' ? true : boolOf(v); })()
      };
    }).filter(function (r) { return r.rubric; });
  }
  function mapPlan(rows) {
    return rows.map(function (o, idx) {
      var id = norm(pick(o, 'id', 'ид')) || ('row-' + idx);
      return {
        id: id,
        week: parseInt(pick(o, 'неделя', 'week'), 10) || 0,
        slot: norm(pick(o, 'слот', 'день', 'slot')),
        brand: brandOf(pick(o, 'бренд', 'brand')),
        channel: norm(pick(o, 'канал', 'channel')),
        format: norm(pick(o, 'формат', 'format')),
        rubric: norm(pick(o, 'рубрика', 'rubric')),
        idea: norm(pick(o, 'идея', 'idea', 'заголовок')),
        hook: norm(pick(o, 'хук', 'hook')),
        goal: norm(pick(o, 'цель', 'goal')),
        status: statusOf(pick(o, 'статус', 'status')),
        url: norm(pick(o, 'ссылка', 'url', 'ссылка_на_пост')),
        owner: norm(pick(o, 'ответственный', 'owner')),
        situational: boolOf(pick(o, 'ситуатив', 'situational'))
      };
    }).filter(function (p) { return p.idea || p.rubric; });
  }

  /* ---------- загрузка с фоллбэком ---------- */
  function fromSeed(reason) {
    return Promise.resolve({ src: 'seed', reason: reason || '', updated: SEED.updated || '', rubricator: SEED.rubricator || [], plan: SEED.plan || [] });
  }
  // Каждая вкладка тянется независимо: если одну переименовали/закрыли - падает
  // только она и подменяется резервом, остальная часть остаётся живой.
  // Пробуем имена вкладок по очереди (последним — первую вкладку, tab='').
  function loadTab(tabs, mapper, seedArr) {
    var list = tabs.slice();
    function attempt() {
      if (!list.length) return Promise.resolve({ ok: false, data: seedArr });
      var t = list.shift();
      return fetchTab(t).then(function (rows) {
        var m = mapper(rows); return m.length ? { ok: true, data: m } : attempt();
      }).catch(attempt);
    }
    return attempt();
  }
  function load() {
    if (!CFG || !CFG.sheetId || CFG.sheetId === 'PASTE_SHEET_ID') return fromSeed('таблица не настроена');
    return Promise.all([
      loadTab([CFG.rubricTab || 'Рубрикатор'], mapRubric, SEED.rubricator || []),
      loadTab([CFG.planTab || 'Контент-план', ''], mapPlan, SEED.plan || [])
    ]).then(function (r) {
      var anyLive = r[0].ok || r[1].ok;
      return {
        src: anyLive ? 'sheet' : 'seed',
        reason: anyLive ? '' : 'таблица недоступна (проверьте доступ «по ссылке»)',
        partial: !(r[0].ok && r[1].ok),
        rubricator: r[0].data, plan: r[1].data
      };
    }).catch(function (e) { return fromSeed((e && e.message) || 'ошибка чтения'); });
  }

  /* ---------- рендер: рубрикатор ---------- */
  var STATUS = {
    'опубликовано': { cls: 'pub', label: 'опубликовано' },
    'готово': { cls: 'rdy', label: 'готово' },
    'план': { cls: 'pln', label: 'в плане' }
  };
  function chip(text, cls) { return '<span class="chip ' + (cls || '') + '">' + esc(text) + '</span>'; }
  function rubricCard(r) {
    var b = r.brand === 'V' ? 'v' : 'gg';
    return '<article class="rcard ' + b + (r.active ? '' : ' off') + '">' +
      '<div class="rc-top"><h4>' + esc(r.rubric) + '</h4>' + (r.active ? '' : '<span class="chip off">пауза</span>') + '</div>' +
      '<p class="rc-idea">' + esc(r.format) + '</p>' +
      '<div class="rc-meta">' + chip(r.channel, 'ch') + chip('задача: ' + r.task, '') + chip(r.freq, 'fr') + '</div>' +
      '<div class="rc-kpi"><span>KPI-сигнал</span>' + esc(r.kpi) + '</div>' +
      '</article>';
  }
  function renderRubricator(data) {
    var g = document.getElementById('cms-rubricator-g'), v = document.getElementById('cms-rubricator-v');
    if (g) g.innerHTML = data.rubricator.filter(function (r) { return r.brand !== 'V'; }).map(rubricCard).join('') || '<p class="cms-empty">нет рубрик</p>';
    if (v) v.innerHTML = data.rubricator.filter(function (r) { return r.brand === 'V'; }).map(rubricCard).join('') || '<p class="cms-empty">нет рубрик</p>';
  }

  /* ---------- рендер: контент-план постами ---------- */
  function postCard(p) {
    var b = p.brand === 'V' ? 'v' : 'gg';
    var st = STATUS[p.status] || STATUS['план'];
    var published = p.status === 'опубликовано';
    var head = '<div class="pc-head">' +
      '<span class="pc-brand ' + b + '">' + (p.brand === 'V' ? 'VALONTI' : 'GENGLASS') + '</span>' +
      (p.slot ? '<span class="pc-slot">' + esc(p.slot) + '</span>' : '') +
      '<span class="chip st-' + st.cls + '">' + st.label + '</span>' +
      (p.situational ? '<span class="chip sit">ситуатив</span>' : '') + '</div>';
    var rub = p.rubric && p.rubric !== '-' ? '<div class="pc-rub">' + esc(p.rubric) + '</div>' : '';
    var idea = '<div class="pc-idea">' + esc(p.idea || '-') + '</div>';
    var hook = p.hook && p.hook !== '-' ? '<div class="pc-hook">' + esc(p.hook) + '</div>' : '';
    var foot = '<div class="pc-foot">' +
      (p.channel ? chip(p.channel, 'ch') : '') + (p.format ? chip(p.format, '') : '') +
      (p.goal && p.goal !== '-' ? chip('цель: ' + p.goal, 'gl') : '') +
      (p.owner ? '<span class="pc-owner">' + esc(p.owner) + '</span>' : '') + '</div>';
    var link = published && p.url ? '<a class="pc-link" href="' + esc(p.url) + '" target="_blank" rel="noopener">Открыть пост ↗</a>' : '';
    return '<article class="pcard ' + b + ' s-' + st.cls + (p.situational ? ' is-sit' : '') + '"' +
      ' data-annotate-section data-annotate-key="post-' + esc(p.id) + '" data-annotate-label="' + esc((p.slot ? p.slot + ' · ' : '') + (p.idea || p.rubric)) + '">' +
      head + rub + idea + hook + foot + link + '</article>';
  }
  function renderPlan(data) {
    var host = document.getElementById('cms-plan'); if (!host) return;
    var weeks = {};
    data.plan.forEach(function (p) { (weeks[p.week] = weeks[p.week] || []).push(p); });
    var keys = Object.keys(weeks).map(Number).sort(function (a, b) { return a - b; });
    if (!keys.length) { host.innerHTML = '<p class="cms-empty">план пуст</p>'; return; }
    host.innerHTML = keys.map(function (w) {
      var items = weeks[w];
      var pub = items.filter(function (p) { return p.status === 'опубликовано'; }).length;
      var planned = items.filter(function (p) { return !p.situational; }).length;
      var pct = planned ? Math.round(pub / planned * 100) : 0;
      return '<section class="wk">' +
        '<div class="wk-h"><h3>' + (w ? 'Неделя ' + w : 'Без недели') + '</h3>' +
        '<div class="wk-prog"><span style="width:' + pct + '%"></span></div>' +
        '<span class="wk-cnt">' + pub + '/' + planned + ' опубл.</span></div>' +
        '<div class="pgrid">' + items.map(postCard).join('') + '</div></section>';
    }).join('');
  }

  /* ---------- рендер: дашборд контроля (Рома) ---------- */
  function renderDashboard(data) {
    var host = document.getElementById('cms-dashboard'); if (!host) return;
    var pl = data.plan;
    function cnt(arr, st) { return arr.filter(function (p) { return p.status === st; }).length; }
    var real = pl.filter(function (p) { return !p.situational; });
    var pub = cnt(real, 'опубликовано'), rdy = cnt(real, 'готово'), pln = cnt(real, 'план');
    var total = real.length, pct = total ? Math.round(pub / total * 100) : 0;
    var g = real.filter(function (p) { return p.brand !== 'V'; }), v = real.filter(function (p) { return p.brand === 'V'; });
    function tile(num, lbl, cls) { return '<div class="dtile ' + (cls || '') + '"><div class="dn">' + num + '</div><div class="dl">' + lbl + '</div></div>'; }
    host.innerHTML =
      '<div class="dash-row">' +
      tile(total, 'постов в плане', '') +
      tile(pub, 'опубликовано', 'pub') +
      tile(rdy, 'готово к выходу', 'rdy') +
      tile(pln, 'в работе', 'pln') +
      '<div class="dtile wide"><div class="dl">выполнение плана</div>' +
      '<div class="dbar"><span style="width:' + pct + '%"></span></div>' +
      '<div class="dpct">' + pct + '%</div></div>' +
      '</div>' +
      '<div class="dash-brands">' +
      '<div class="db gg"><b>GENGLASS</b> опубл. ' + cnt(g, 'опубликовано') + ' / ' + g.length + '</div>' +
      '<div class="db v"><b>VALONTI</b> опубл. ' + cnt(v, 'опубликовано') + ' / ' + v.length + '</div>' +
      '</div>';
  }

  /* ---------- индикатор источника ---------- */
  function renderSource(data) {
    var els = document.querySelectorAll('.cms-source');
    els.forEach && els.forEach(function (el) {
      if (data.src === 'sheet') {
        el.innerHTML = '<span class="ok">● связано с Google-таблицей</span> · данные тянутся при загрузке' +
          (data.partial ? ' · <span class="warn">часть данных из резерва</span> (проверьте имена вкладок)' : '');
        el.className = 'cms-source live';
      } else {
        el.innerHTML = '<span class="warn">○ резервные данные</span> · ' + esc(data.reason || 'таблица не подключена') + ' - правьте cms-config.js';
        el.className = 'cms-source seed';
      }
    });
  }

  /* ---------- старт ---------- */
  function boot() {
    load().then(function (data) {
      renderSource(data);
      renderRubricator(data);
      renderDashboard(data);
      renderPlan(data);
      // перепривязать маркеры комментариев к свежеотрендеренным постам
      if (window.ANNOTATE_REFRESH) setTimeout(window.ANNOTATE_REFRESH, 60);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
