/* ============================================================================
   cms-data.js - общий слой данных гибрида plan-hybrid.html.
   Читает Google-таблицу (gviz) + fallback на seed. Отдаёт данные, не рендерит.
   Новое: тело поста (обложка/текст/медиа), статусы «на согл», статистика постов
   со снэпшотами (48ч/7д) для KPI, преобразование Google-Drive ссылок в картинку.
   Экспорт: window.GGData = { load(), esc(), brandName(), driveImg(), STATUS }.
   ========================================================================== */
(function () {
  'use strict';
  var CFG = window.GG_CMS_CONFIG || null;
  var SEED = window.GG_CMS_SEED || { plan: [], stats: [] };

  function norm(s) { return String(s == null ? '' : s).trim(); }
  function low(s) { return norm(s).toLowerCase(); }
  function esc(s) { return norm(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function num(v) { var n = parseInt(String(v == null ? '' : v).replace(/[^\d-]/g, ''), 10); return isNaN(n) ? 0 : n; }
  function brandOf(v) { var x = low(v); return (x === 'v' || x === 'в' || x.indexOf('valonti') === 0 || x.indexOf('валонти') === 0) ? 'V' : 'G'; }
  function boolOf(v) { var x = low(v); return x === 'да' || x === 'true' || x === '1' || x === 'yes' || x === 'y' || x === '+'; }
  function statusOf(v) {
    var x = low(v);
    if (x.indexOf('опублик') === 0 || x === 'published' || x === 'live' || x === 'done') return 'опубликовано';
    if (x.indexOf('готов') === 0 || x.indexOf('на согл') === 0 || x.indexOf('согл') === 0 || x === 'ready' || x === 'review' || x === 'approval') return 'на согл';
    return 'план';
  }
  function pick(o) { for (var i = 1; i < arguments.length; i++) { var k = arguments[i]; if (o[k] != null && norm(o[k]) !== '') return o[k]; } return ''; }
  // gviz отдаёт даты как "Date(2026,5,17)" - месяц 0-индексный (5 = июнь). Чиним.
  function fmtDate(v) {
    var s = norm(v); var m = s.match(/^Date\((\d+),(\d+),(\d+)/);
    if (m) { var p = function (n) { return (n < 10 ? '0' : '') + n; }; return p(+m[3]) + '.' + p(+m[2] + 1) + '.' + m[1]; }
    return s;
  }
  // Google Drive ссылка -> прямой поток картинки (lh3, CORS *), с ресайзом.
  function driveImg(url, w) {
    var u = norm(url); if (!u) return '';
    var m = u.match(/\/d\/([A-Za-z0-9_-]+)/) || u.match(/[?&]id=([A-Za-z0-9_-]+)/);
    if (m) return 'https://lh3.googleusercontent.com/d/' + m[1] + (w ? '=w' + w : '');
    return u;
  }

  function gvizUrl(tab) { return 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(CFG.sheetId) + '/gviz/tq?tqx=out:json&headers=1' + (tab ? '&sheet=' + encodeURIComponent(tab) : '') + '&_=' + Date.now(); }
  function parseGviz(text) { var i = text.indexOf('setResponse('), j = text.lastIndexOf(')'); if (i < 0 || j < 0) throw new Error('gviz'); var obj = JSON.parse(text.slice(i + 12, j)); if (!obj.table) throw new Error('no table'); var cols = (obj.table.cols || []).map(function (c) { return low(c.label || c.id); }); return (obj.table.rows || []).map(function (r) { var o = {}; (r.c || []).forEach(function (cell, k) { var key = cols[k]; if (key) o[key] = cell ? (cell.f != null ? cell.f : (cell.v == null ? '' : cell.v)) : ''; }); return o; }).filter(function (o) { return Object.keys(o).some(function (k) { return norm(o[k]) !== ''; }); }); }
  function fetchTab(tab) { return fetch(gvizUrl(tab), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('http'); return r.text(); }).then(parseGviz); }

  function mapPlan(rows) {
    return rows.map(function (o, idx) {
      return {
        id: norm(pick(o, 'id', 'ид')) || ('row-' + idx),
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
        url: norm(pick(o, 'ссылка', 'url')),
        owner: norm(pick(o, 'ответственный', 'owner')),
        situational: boolOf(pick(o, 'ситуатив', 'situational')),
        // тело поста
        cover: norm(pick(o, 'картинка', 'обложка', 'фото', 'изображение', 'cover', 'image')),
        text: norm(pick(o, 'текст', 'текст_поста', 'text', 'caption')),
        media: low(pick(o, 'тип медиа', 'медиа', 'media')) || '',
        alt: norm(pick(o, 'alt', 'альт', 'описание картинки')),
        pubdate: fmtDate(pick(o, 'дата публикации', 'дата', 'pubdate', 'date')),
        extraUrl: norm(pick(o, 'доп ссылка', 'допссылка', 'доп.ссылка', 'extra', 'link2'))
      };
    }).filter(function (p) { return p.idea || p.rubric || p.text; });
  }
  function looksLikePlan(p) { return p.some(function (x) { return x.status || x.week; }); }
  // seed-посты хранят сырой статус ('готово') - нормализуем как и из таблицы
  function normPlan(arr) { return arr.map(function (p) { p.status = statusOf(p.status); return p; }); }

  function mapStats(rows) {
    return rows.map(function (o) {
      var reach = num(pick(o, 'охват', 'reach')), saves = num(pick(o, 'сохранения', 'saves')),
        clicks = num(pick(o, 'переходы', 'clicks')), contacts = num(pick(o, 'контакты', 'лиды', 'contacts'));
      var er = reach > 0 ? Math.round((saves + clicks + contacts) / reach * 1000) / 10 : null;
      var snap = low(pick(o, 'снэпшот тип', 'снэпшот', 'snapshot', 'тип')) || '';
      return { id: norm(pick(o, 'id', 'ид')), reach: reach, saves: saves, clicks: clicks, contacts: contacts, er: er, snap: snap.indexOf('48') >= 0 ? '48h' : (snap.indexOf('7') >= 0 ? '7d' : snap), date: fmtDate(pick(o, 'снэпшот дата', 'дата', 'date')) };
    }).filter(function (s) { return s.id; });
  }

  function attachStats(plan, stats) {
    var by = {}; stats.forEach(function (s) { (by[s.id] = by[s.id] || []).push(s); });
    plan.forEach(function (p) {
      var arr = by[p.id] || [];
      var seven = arr.filter(function (s) { return s.snap === '7d'; })[0];
      var any = seven || arr.filter(function (s) { return s.snap === '48h'; })[0] || arr[0];
      p.stats = any || null;
    });
    return plan;
  }

  function loadTabSafe(tabs, mapper, validate) {
    function attempt(i) {
      if (i >= tabs.length) return Promise.resolve(null);
      return fetchTab(tabs[i]).then(function (rows) { var m = mapper(rows); return (m.length && (!validate || validate(m))) ? m : attempt(i + 1); }).catch(function () { return attempt(i + 1); });
    }
    return attempt(0);
  }

  function load() {
    if (!CFG || !CFG.sheetId || CFG.sheetId === 'PASTE_SHEET_ID') {
      return Promise.resolve({ plan: attachStats(normPlan((SEED.plan || []).slice()), SEED.stats || []), src: 'seed', reason: 'таблица не настроена' });
    }
    return Promise.all([
      loadTabSafe([CFG.planTab || 'Контент-план', ''], mapPlan, looksLikePlan),
      loadTabSafe([CFG.statsTab || 'Статистика'], mapStats, null)
    ]).then(function (r) {
      var plan = r[0], stats = r[1] || (SEED.stats || []);
      if (!plan) return { plan: attachStats(normPlan((SEED.plan || []).slice()), SEED.stats || []), src: 'seed', reason: 'таблица недоступна' };
      return { plan: attachStats(plan, stats), src: 'sheet', statsLive: !!r[1] };
    }).catch(function () { return { plan: attachStats(normPlan((SEED.plan || []).slice()), SEED.stats || []), src: 'seed', reason: 'ошибка чтения' }; });
  }

  window.GGData = {
    load: load, esc: esc, num: num, driveImg: driveImg,
    brandName: function (b) { return b === 'V' ? 'VALONTI' : 'GENGLASS'; },
    STATUS: { 'опубликовано': { cls: 'pub', label: 'Опубликовано' }, 'на согл': { cls: 'sgl', label: 'На согласовании' }, 'план': { cls: 'pln', label: 'В плане' } }
  };
})();
