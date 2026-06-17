/* ============================================================================
   cms-data.js - общий слой данных для вариантов дизайна plan-*.html.
   Берёт ту же Google-таблицу (gviz) + fallback на seed, что и cms.js, но НЕ
   рендерит сам - отдаёт данные, а каждая версия страницы рисует по-своему.
   Экспорт: window.GGData = { load(), esc(), brandName(), STATUS }.
   ========================================================================== */
(function () {
  'use strict';
  var CFG = window.GG_CMS_CONFIG || null;
  var SEED = window.GG_CMS_SEED || { rubricator: [], plan: [] };

  function norm(s) { return String(s == null ? '' : s).trim(); }
  function low(s) { return norm(s).toLowerCase(); }
  function esc(s) { return norm(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function brandOf(v) { var x = low(v); return (x === 'v' || x === 'в' || x.indexOf('valonti') === 0 || x.indexOf('валонти') === 0) ? 'V' : 'G'; }
  function boolOf(v) { var x = low(v); return x === 'да' || x === 'true' || x === '1' || x === 'yes' || x === 'y' || x === '+'; }
  function statusOf(v) { var x = low(v); if (x.indexOf('опублик') === 0 || x === 'published' || x === 'live' || x === 'done') return 'опубликовано'; if (x.indexOf('готов') === 0 || x === 'ready') return 'готово'; return 'план'; }
  function pick(o) { for (var i = 1; i < arguments.length; i++) { var k = arguments[i]; if (o[k] != null && norm(o[k]) !== '') return o[k]; } return ''; }

  function gvizUrl(tab) { return 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(CFG.sheetId) + '/gviz/tq?tqx=out:json&headers=1' + (tab ? '&sheet=' + encodeURIComponent(tab) : '') + '&_=' + Date.now(); }
  function parseGviz(text) { var i = text.indexOf('setResponse('), j = text.lastIndexOf(')'); if (i < 0 || j < 0) throw new Error('gviz'); var obj = JSON.parse(text.slice(i + 12, j)); if (!obj.table) throw new Error('no table'); var cols = (obj.table.cols || []).map(function (c) { return low(c.label || c.id); }); return (obj.table.rows || []).map(function (r) { var o = {}; (r.c || []).forEach(function (cell, k) { var key = cols[k]; if (key) o[key] = cell ? (cell.v == null ? '' : cell.v) : ''; }); return o; }).filter(function (o) { return Object.keys(o).some(function (k) { return norm(o[k]) !== ''; }); }); }
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
        situational: boolOf(pick(o, 'ситуатив', 'situational'))
      };
    }).filter(function (p) { return p.idea || p.rubric; });
  }
  function looksLikePlan(p) { return p.some(function (x) { return x.status || x.week; }); }

  function loadPlan() {
    if (!CFG || !CFG.sheetId || CFG.sheetId === 'PASTE_SHEET_ID') return Promise.resolve({ plan: SEED.plan || [], src: 'seed', reason: 'таблица не настроена' });
    var tabs = [CFG.planTab || 'Контент-план', ''];
    function attempt(i) {
      if (i >= tabs.length) return Promise.resolve({ plan: SEED.plan || [], src: 'seed', reason: 'таблица недоступна' });
      return fetchTab(tabs[i]).then(function (rows) { var m = mapPlan(rows); return (m.length && looksLikePlan(m)) ? { plan: m, src: 'sheet' } : attempt(i + 1); }).catch(function () { return attempt(i + 1); });
    }
    return attempt(0);
  }

  window.GGData = {
    load: loadPlan,
    esc: esc,
    brandName: function (b) { return b === 'V' ? 'VALONTI' : 'GENGLASS'; },
    STATUS: { 'опубликовано': { cls: 'pub', label: 'опубликовано' }, 'готово': { cls: 'rdy', label: 'готово' }, 'план': { cls: 'pln', label: 'в плане' } }
  };
})();
