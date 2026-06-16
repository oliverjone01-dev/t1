/* ============================================================================
   annotate.js - переиспользуемый модуль комментирования выделенных областей
   для внутренних веб-страниц (как комментарии в Figma / Google Drive).

   Возможности:
   - выделение прямоугольной области на странице -> комментарий к ней
   - имя автора спрашивается один раз, сохраняется в браузере
   - дата/время у каждого комментаря, ответы (треды)
   - маркеры-пины на странице + боковая панель со списком
   - пометка «решено», удаление своих
   - переключаемое хранилище: 'local' (один браузер) или 'supabase' (общее облако)

   Подключение на любой странице:
     <script>window.ANNOTATE = {
        pageKey: 'ton-pitch-deck',         // уникальный ключ страницы
        sectionSelector: '.slide',         // к каким блокам привязываем области
        storage: 'local'                   // или см. блок supabase ниже
     };</script>
     <script src="../annotate/annotate.js" defer></script>

   Для общего облака (Supabase), storage:
     storage: { type:'supabase', url:'https://xxx.supabase.co', key:'ANON_KEY', table:'annotations' }
   SQL для таблицы - внизу файла в комментарии.
   ========================================================================== */
(function () {
  'use strict';
  var CFG = window.ANNOTATE || {};
  var PAGE = CFG.pageKey || location.pathname.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'page';
  var SECTION_SEL = CFG.sectionSelector || '[data-annotate-section]';
  var POLL_MS = CFG.pollMs || 6000;

  /* ---------- утилиты ---------- */
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function sections() { return Array.prototype.slice.call(document.querySelectorAll(SECTION_SEL)); }
  function fmtAbs(iso) {
    var d = new Date(iso), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fmtRel(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 45) return 'только что';
    if (s < 3600) return Math.round(s / 60) + ' мин назад';
    if (s < 86400) return Math.round(s / 3600) + ' ч назад';
    if (s < 7 * 86400) return Math.round(s / 86400) + ' дн назад';
    return fmtAbs(iso);
  }

  /* ---------- имя автора ---------- */
  function getName() { return localStorage.getItem('annotate_name') || ''; }
  function setName(n) { localStorage.setItem('annotate_name', n); }
  function ensureName(cb) {
    if (getName()) return cb(getName());
    var ov = el('div', 'anno-modal-ov');
    ov.innerHTML = '<div class="anno-modal"><h3>Как вас зовут?</h3>' +
      '<p>Имя покажется рядом с вашими комментариями. Сохраним в этом браузере.</p>' +
      '<input id="anno-name-in" type="text" placeholder="Имя и фамилия" autocomplete="name" maxlength="40">' +
      '<div class="anno-modal-row"><button class="anno-btn primary" id="anno-name-ok">Продолжить</button></div></div>';
    document.body.appendChild(ov);
    var inp = ov.querySelector('#anno-name-in'); inp.focus();
    function ok() { var v = inp.value.trim(); if (v.length < 2) { inp.focus(); inp.classList.add('err'); return; } setName(v); ov.remove(); cb(v); }
    ov.querySelector('#anno-name-ok').onclick = ok;
    inp.onkeydown = function (e) { if (e.key === 'Enter') ok(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  }

  /* ---------- хранилище (адаптеры) ---------- */
  function LocalStore(page) {
    var KEY = 'annotate:' + page;
    function read() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
    function write(a) { localStorage.setItem(KEY, JSON.stringify(a)); }
    return {
      list: function () { return Promise.resolve(read()); },
      add: function (item) { var a = read(); a.push(item); write(a); return Promise.resolve(item); },
      update: function (id, patch) { var a = read().map(function (x) { return x.id === id ? Object.assign(x, patch) : x; }); write(a); return Promise.resolve(); },
      remove: function (id) { write(read().filter(function (x) { return x.id !== id && x.parent_id !== id; })); return Promise.resolve(); },
      realtime: false
    };
  }
  function SupabaseStore(page, opt) {
    var base = opt.url.replace(/\/$/, '') + '/rest/v1/' + (opt.table || 'annotations');
    var h = { 'apikey': opt.key, 'Authorization': 'Bearer ' + opt.key, 'Content-Type': 'application/json' };
    function row2item(r) { return { id: r.id, page_key: r.page_key, section: r.section, rect: r.rect, author: r.author, body: r.body, parent_id: r.parent_id, resolved: r.resolved, created_at: r.created_at }; }
    return {
      list: function () {
        return fetch(base + '?page_key=eq.' + encodeURIComponent(page) + '&order=created_at.asc', { headers: h })
          .then(function (r) { return r.json(); }).then(function (rows) { return (rows || []).map(row2item); });
      },
      add: function (item) {
        return fetch(base, { method: 'POST', headers: Object.assign({ 'Prefer': 'return=representation' }, h), body: JSON.stringify(item) })
          .then(function (r) { return r.json(); }).then(function (rows) { return rows[0]; });
      },
      update: function (id, patch) { return fetch(base + '?id=eq.' + id, { method: 'PATCH', headers: h, body: JSON.stringify(patch) }); },
      remove: function (id) { return fetch(base + '?id=eq.' + id, { method: 'DELETE', headers: h }).then(function () { return fetch(base + '?parent_id=eq.' + id, { method: 'DELETE', headers: h }); }); },
      realtime: false
    };
  }
  var sconf = CFG.storage || 'local';
  var STORE = (sconf && sconf.type === 'supabase') ? SupabaseStore(PAGE, sconf) : LocalStore(PAGE);
  var SHARED = !!(sconf && sconf.type === 'supabase');

  /* ---------- состояние ---------- */
  var DATA = [];          // все аннотации (родители + ответы) плоско
  var MODE = false;       // режим комментирования
  var PANEL_OPEN = false;
  var OPEN_THREAD = null; // id открытого треда

  function parents() { return DATA.filter(function (x) { return !x.parent_id; }).sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); }); }
  function repliesOf(id) { return DATA.filter(function (x) { return x.parent_id === id; }).sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); }); }

  function refresh() {
    return STORE.list().then(function (rows) { DATA = rows || []; renderMarkers(); renderPanel(); });
  }

  /* ---------- маркеры на странице ---------- */
  function renderMarkers() {
    Array.prototype.slice.call(document.querySelectorAll('.anno-marker,.anno-region')).forEach(function (m) { m.remove(); });
    var secs = sections();
    var ordered = parents();
    ordered.forEach(function (a, i) {
      var sec = secs[a.section]; if (!sec || !a.rect) return;
      if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative';
      var rx = Math.max(1, Math.min(99, a.rect.x)), ry = Math.max(1, Math.min(99, a.rect.y));
      if (OPEN_THREAD === a.id && a.rect.w > 1) {
        var reg = el('div', 'anno-region');
        reg.style.cssText = 'left:' + a.rect.x + '%;top:' + a.rect.y + '%;width:' + a.rect.w + '%;height:' + a.rect.h + '%';
        sec.appendChild(reg);
      }
      var m = el('button', 'anno-marker' + (a.resolved ? ' done' : '') + (OPEN_THREAD === a.id ? ' active' : ''));
      m.style.left = rx + '%'; m.style.top = ry + '%';
      m.textContent = (i + 1);
      m.title = a.author + ': ' + (a.body || '').slice(0, 60);
      m.onclick = function (e) { e.stopPropagation(); openThread(a.id, true); };
      sec.appendChild(m);
    });
  }

  /* ---------- панель ---------- */
  var panel, toolbar;
  function renderPanel() {
    if (!panel) return;
    var list = panel.querySelector('.anno-list');
    var ps = parents();
    panel.querySelector('.anno-count').textContent = ps.length;
    if (!ps.length) { list.innerHTML = '<div class="anno-empty">Пока нет комментариев.<br>Нажмите «Комментировать» и выделите участок.</div>'; return; }
    list.innerHTML = '';
    ps.forEach(function (a, i) {
      var reps = repliesOf(a.id);
      var item = el('div', 'anno-item' + (a.resolved ? ' done' : ''));
      item.innerHTML =
        '<div class="anno-item-h"><span class="anno-pin">' + (i + 1) + '</span>' +
        '<b>' + esc(a.author) + '</b><span class="anno-time" title="' + fmtAbs(a.created_at) + '">' + fmtRel(a.created_at) + '</span></div>' +
        '<div class="anno-body">' + esc(a.body) + '</div>' +
        '<div class="anno-meta">слайд ' + (a.section + 1) + (reps.length ? ' · ' + reps.length + ' отв.' : '') + (a.resolved ? ' · решено' : '') + '</div>';
      item.onclick = function () { openThread(a.id, true); };
      list.appendChild(item);
    });
  }

  /* ---------- тред (карточка комментария + ответы) ---------- */
  var threadBox;
  function openThread(id, jump) {
    OPEN_THREAD = id;
    var a = DATA.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    if (jump) {
      var sec = sections()[a.section];
      if (sec) { if (sec.scrollIntoView) sec.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' }); }
    }
    renderMarkers();
    if (threadBox) threadBox.remove();
    threadBox = el('div', 'anno-thread');
    drawThread(a);
    document.body.appendChild(threadBox);
    positionThread(a);
  }
  function positionThread(a) {
    var sec = sections()[a.section]; if (!sec || !threadBox) return;
    var r = sec.getBoundingClientRect();
    var x = r.left + r.width * a.rect.x / 100, y = r.top + r.height * a.rect.y / 100;
    var bw = 320, vw = window.innerWidth;
    var left = Math.min(Math.max(12, x + 16), vw - bw - 12);
    if (vw < 620) { left = (vw - Math.min(bw, vw - 24)) / 2; }
    threadBox.style.left = left + 'px';
    threadBox.style.top = Math.min(Math.max(70, y), window.innerHeight - 260) + 'px';
  }
  function drawThread(a) {
    var reps = repliesOf(a.id), me = getName();
    var html = '<div class="anno-th-head"><b>Комментарий</b>' +
      '<div class="anno-th-actions">' +
      '<button class="anno-ic" data-act="resolve" title="' + (a.resolved ? 'Вернуть' : 'Отметить решённым') + '">' + (a.resolved ? '↺' : '✓') + '</button>' +
      (a.author === me ? '<button class="anno-ic" data-act="del" title="Удалить">🗑</button>' : '') +
      '<button class="anno-ic" data-act="close" title="Закрыть">✕</button></div></div>';
    html += '<div class="anno-th-body">';
    html += msgHtml(a);
    reps.forEach(function (r) { html += msgHtml(r); });
    html += '</div>';
    html += '<div class="anno-reply"><textarea placeholder="Ответить..." rows="2"></textarea><button class="anno-btn primary" data-act="send">Ответить</button></div>';
    threadBox.innerHTML = html;
    threadBox.querySelector('[data-act=close]').onclick = function () { OPEN_THREAD = null; threadBox.remove(); threadBox = null; renderMarkers(); };
    threadBox.querySelector('[data-act=resolve]').onclick = function () { STORE.update(a.id, { resolved: !a.resolved }).then(refresh).then(function () { OPEN_THREAD = null; if (threadBox) { threadBox.remove(); threadBox = null; } }); };
    var del = threadBox.querySelector('[data-act=del]'); if (del) del.onclick = function () { if (confirm('Удалить комментарий и ответы?')) STORE.remove(a.id).then(refresh).then(function () { OPEN_THREAD = null; if (threadBox) { threadBox.remove(); threadBox = null; } }); };
    var ta = threadBox.querySelector('textarea');
    threadBox.querySelector('[data-act=send]').onclick = function () {
      var v = ta.value.trim(); if (!v) return;
      ensureName(function (nm) {
        var item = { id: uid(), page_key: PAGE, section: a.section, rect: a.rect, author: nm, body: v, parent_id: a.id, resolved: false, created_at: new Date().toISOString() };
        STORE.add(item).then(refresh).then(function () { openThread(a.id, false); });
      });
    };
    ta.onkeydown = function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') threadBox.querySelector('[data-act=send]').click(); };
  }
  function msgHtml(m) {
    return '<div class="anno-msg' + (m.parent_id ? ' reply' : '') + '"><div class="anno-msg-h"><b>' + esc(m.author) +
      '</b><span class="anno-time" title="' + fmtAbs(m.created_at) + '">' + fmtRel(m.created_at) + '</span></div>' +
      '<div class="anno-msg-b">' + esc(m.body) + '</div></div>';
  }

  /* ---------- режим выделения области ---------- */
  var overlay, drawRect, start;
  function setMode(on) {
    MODE = on;
    document.body.classList.toggle('anno-commenting', on);
    toolbar.querySelector('[data-act=mode]').classList.toggle('on', on);
    toolbar.querySelector('[data-act=mode] span').textContent = on ? 'Готово' : 'Комментировать';
    if (on && !overlay) {
      overlay = el('div', 'anno-overlay');
      document.body.appendChild(overlay);
      overlay.addEventListener('pointerdown', onDown);
    }
    if (overlay) overlay.style.display = on ? 'block' : 'none';
    if (!on) cleanupDraw();
  }
  function cleanupDraw() { if (drawRect) { drawRect.remove(); drawRect = null; } start = null; }
  function onDown(e) {
    overlay.style.pointerEvents = 'none';
    var under = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.pointerEvents = '';
    var sec = under && under.closest(SECTION_SEL);
    if (!sec) return;
    e.preventDefault();
    var r = sec.getBoundingClientRect();
    start = { sec: sec, r: r, x: e.clientX, y: e.clientY };
    drawRect = el('div', 'anno-draw'); document.body.appendChild(drawRect);
    moveDraw(e);
    try { overlay.setPointerCapture(e.pointerId); } catch (err) { }
    overlay.addEventListener('pointermove', moveDraw);
    overlay.addEventListener('pointerup', onUp);
    overlay.addEventListener('pointercancel', onCancel);
  }
  function onCancel() {
    overlay.removeEventListener('pointermove', moveDraw);
    overlay.removeEventListener('pointerup', onUp);
    overlay.removeEventListener('pointercancel', onCancel);
    cleanupDraw();
  }
  function moveDraw(e) {
    if (!start) return;
    var x = Math.min(e.clientX, start.x), y = Math.min(e.clientY, start.y);
    var w = Math.abs(e.clientX - start.x), h = Math.abs(e.clientY - start.y);
    drawRect.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
  }
  function onUp(e) {
    overlay.removeEventListener('pointermove', moveDraw);
    overlay.removeEventListener('pointerup', onUp);
    overlay.removeEventListener('pointercancel', onCancel);
    if (!start) { cleanupDraw(); return; }
    var r = start.r;
    var x0 = Math.min(e.clientX, start.x), y0 = Math.min(e.clientY, start.y);
    var w = Math.abs(e.clientX - start.x), h = Math.abs(e.clientY - start.y);
    if (w < 8 && h < 8) { w = 26; h = 26; x0 = e.clientX - 13; y0 = e.clientY - 13; } // клик = маленький пин
    var rect = {
      x: Math.max(0, Math.min(100, (x0 - r.left) / r.width * 100)),
      y: Math.max(0, Math.min(100, (y0 - r.top) / r.height * 100)),
      w: Math.min(100, w / r.width * 100), h: Math.min(100, h / r.height * 100)
    };
    var sec = start.sec, idx = sections().indexOf(sec);
    if (drawRect) { drawRect.remove(); drawRect = null; } start = null;
    openComposer(idx, rect, e.clientX, e.clientY);
  }
  function openComposer(secIdx, rect, px, py) {
    setMode(false);
    var box = el('div', 'anno-thread anno-composer');
    box.innerHTML = '<div class="anno-th-head"><b>Новый комментарий</b><button class="anno-ic" data-act="close" title="Отмена">✕</button></div>' +
      '<div class="anno-who">от <b>' + esc(getName() || 'вас') + '</b> <button class="anno-link" data-act="rename">сменить имя</button></div>' +
      '<textarea placeholder="Что не так с этим участком? Что предложить?" rows="3" autofocus></textarea>' +
      '<div class="anno-modal-row"><button class="anno-btn" data-act="cancel">Отмена</button><button class="anno-btn primary" data-act="save">Оставить комментарий</button></div>';
    document.body.appendChild(box);
    var bw = 320, vw = window.innerWidth;
    box.style.left = Math.min(Math.max(12, px + 12), vw - bw - 12) + 'px';
    box.style.top = Math.min(Math.max(70, py), window.innerHeight - 240) + 'px';
    if (vw < 620) box.style.left = (vw - Math.min(bw, vw - 24)) / 2 + 'px';
    var ta = box.querySelector('textarea'); setTimeout(function () { ta.focus(); }, 30);
    function close() { box.remove(); }
    box.querySelector('[data-act=close]').onclick = close;
    box.querySelector('[data-act=cancel]').onclick = close;
    box.querySelector('[data-act=rename]').onclick = function () { localStorage.removeItem('annotate_name'); ensureName(function (n) { box.querySelector('.anno-who b').textContent = n; }); };
    box.querySelector('[data-act=save]').onclick = function () {
      var v = ta.value.trim(); if (!v) { ta.focus(); return; }
      ensureName(function (nm) {
        var item = { id: uid(), page_key: PAGE, section: secIdx, rect: rect, author: nm, body: v, parent_id: null, resolved: false, created_at: new Date().toISOString() };
        STORE.add(item).then(refresh).then(function () { close(); openThread(item.id, false); if (!PANEL_OPEN) togglePanel(true); });
      });
    };
    ta.onkeydown = function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') box.querySelector('[data-act=save]').click(); };
  }

  /* ---------- UI: тулбар и панель ---------- */
  function togglePanel(force) {
    PANEL_OPEN = (typeof force === 'boolean') ? force : !PANEL_OPEN;
    panel.classList.toggle('open', PANEL_OPEN);
    toolbar.querySelector('[data-act=panel]').classList.toggle('on', PANEL_OPEN);
  }
  function buildUI() {
    toolbar = el('div', 'anno-toolbar');
    toolbar.innerHTML =
      '<button class="anno-tb" data-act="mode"><i>✎</i><span>Комментировать</span></button>' +
      '<button class="anno-tb" data-act="panel"><i>☰</i> Комментарии</button>' +
      '<span class="anno-store" title="' + (SHARED ? 'Комментарии общие для всех участников' : 'Комментарии видны только в этом браузере. Подключите облако для общего доступа.') + '">' + (SHARED ? '<b style="color:#6FAE7B">●</b> общие' : '○ локально') + '</span>';
    document.body.appendChild(toolbar);
    toolbar.querySelector('[data-act=mode]').onclick = function () { ensureName(function () { setMode(!MODE); }); };
    toolbar.querySelector('[data-act=panel]').onclick = function () { togglePanel(); };

    panel = el('div', 'anno-panel');
    panel.innerHTML = '<div class="anno-panel-h"><b>Комментарии</b> <span class="anno-count">0</span><button class="anno-ic" data-act="x" title="Закрыть">✕</button></div><div class="anno-list"></div>';
    document.body.appendChild(panel);
    panel.querySelector('[data-act=x]').onclick = function () { togglePanel(false); };

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (MODE) setMode(false); else if (OPEN_THREAD && threadBox) { OPEN_THREAD = null; threadBox.remove(); threadBox = null; renderMarkers(); } }
    });
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { renderMarkers(); if (OPEN_THREAD) { var a = DATA.filter(function (x) { return x.id === OPEN_THREAD; })[0]; if (a) positionThread(a); } }, 120); });
    // следим за прокруткой дека, чтобы тред ехал за слайдом
    document.addEventListener('scroll', function () { if (OPEN_THREAD) { var a = DATA.filter(function (x) { return x.id === OPEN_THREAD; })[0]; if (a) positionThread(a); } }, true);
  }

  /* ---------- стили ---------- */
  function injectCSS() {
    var c = getComputedStyle(document.documentElement);
    var css = `
    .anno-toolbar{position:fixed;left:14px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:9000;display:flex;gap:8px;align-items:center;font-family:inherit}
    .anno-tb{display:inline-flex;align-items:center;gap:7px;background:rgba(22,20,15,.82);color:#F5F1E8;border:1px solid #33302A;border-radius:30px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer;backdrop-filter:blur(8px);transition:.2s}
    .anno-tb i{font-style:normal;color:#4f8cff}
    .anno-tb:hover{border-color:#4f8cff}
    .anno-tb.on{background:#4f8cff;color:#ffffff;border-color:#4f8cff}.anno-tb.on i{color:#ffffff}
    .anno-store{font-size:10.5px;color:#A39E92;border:1px solid #33302A;border-radius:20px;padding:5px 9px;background:rgba(10,10,10,.5)}
    .anno-marker{position:absolute;transform:translate(-50%,-50%);min-width:26px;height:26px;padding:0 7px;border-radius:14px 14px 14px 3px;background:#4f8cff;color:#ffffff;border:2px solid #ffffff;font-weight:800;font-size:12.5px;cursor:pointer;z-index:40;box-shadow:0 0 0 4px rgba(79,140,255,.28),0 4px 14px rgba(0,0,0,.55);transition:transform .15s}
    .anno-marker:hover,.anno-marker.active{transform:translate(-50%,-50%) scale(1.22);background:#7aa9ff;box-shadow:0 0 0 5px rgba(79,140,255,.45),0 6px 18px rgba(0,0,0,.6)}
    .anno-marker.done{background:#6FAE7B;opacity:.7}
    .anno-region{position:absolute;z-index:39;border:2px solid #4f8cff;background:rgba(79,140,255,.14);border-radius:6px;pointer-events:none;box-shadow:0 2px 12px rgba(0,0,0,.3)}
    .anno-overlay{position:fixed;inset:0;z-index:8000;cursor:crosshair;background:rgba(10,10,10,.04);touch-action:none}
    body.anno-commenting .deck,body.anno-commenting [data-annotate-root]{overflow:hidden !important}
    body.anno-commenting{cursor:crosshair}
    .anno-draw{position:fixed;z-index:8500;border:2px solid #4f8cff;background:rgba(79,140,255,.16);border-radius:4px;pointer-events:none}
    .anno-panel{position:fixed;top:0;right:-380px;width:348px;max-width:90vw;height:100dvh;z-index:8800;background:#0F1116;border-left:3px solid #4f8cff;box-shadow:-26px 0 70px rgba(0,0,0,.72);transition:right .3s cubic-bezier(.22,.61,.36,1);display:flex;flex-direction:column;font-family:inherit}
    .anno-panel.open{right:0}
    .anno-panel-h{display:flex;align-items:center;gap:10px;padding:18px 18px 14px;border-bottom:1px solid #262320;color:#F5F1E8;font-size:15px}
    .anno-panel-h .anno-count{background:#4f8cff;color:#ffffff;border-radius:20px;font-size:11px;font-weight:800;padding:2px 8px}
    .anno-panel-h .anno-ic{margin-left:auto}
    .anno-list{overflow-y:auto;padding:10px 12px;flex:1}
    .anno-empty{color:#6B665C;font-size:13px;text-align:center;padding:40px 16px;line-height:1.6}
    .anno-item{background:#171a21;border:1px solid #2a2e38;border-left:3px solid #4f8cff;border-radius:10px;padding:13px 14px;margin-bottom:10px;cursor:pointer;transition:.15s}
    .anno-item:hover{border-color:#4f8cff}
    .anno-item.done{opacity:.6}
    .anno-item-h{display:flex;align-items:center;gap:8px;font-size:13.5px;color:#F5F1E8}
    .anno-pin{background:#4f8cff;color:#ffffff;font-weight:800;font-size:11px;min-width:18px;height:18px;border-radius:9px;display:inline-grid;place-items:center;padding:0 5px}
    .anno-time{margin-left:auto;color:#6B665C;font-size:11px;font-weight:400}
    .anno-body{color:#A39E92;font-size:13px;margin-top:6px;line-height:1.45}
    .anno-meta{color:#6B665C;font-size:11px;margin-top:7px;letter-spacing:.02em}
    .anno-thread{position:fixed;z-index:8900;width:320px;max-width:calc(100vw - 24px);background:#0F1116;border:1px solid #2a2e38;border-top:3px solid #4f8cff;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.65);font-family:inherit;overflow:hidden}
    .anno-th-head{display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid #262320;color:#F5F1E8;font-size:13.5px}
    .anno-th-actions{margin-left:auto;display:flex;gap:4px}
    .anno-ic{background:none;border:1px solid #33302A;color:#A39E92;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:13px;display:grid;place-items:center;transition:.15s}
    .anno-ic:hover{border-color:#4f8cff;color:#4f8cff}
    .anno-th-body{max-height:46vh;overflow-y:auto;padding:6px 14px}
    .anno-msg{padding:11px 0;border-bottom:1px solid #1c1a16}
    .anno-msg:last-child{border-bottom:none}
    .anno-msg.reply{margin-left:14px;border-left:2px solid #262320;padding-left:12px}
    .anno-msg-h{display:flex;align-items:center;gap:8px;color:#F5F1E8;font-size:13px}
    .anno-msg-b{color:#A39E92;font-size:13px;margin-top:4px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
    .anno-reply{display:flex;gap:8px;padding:12px 14px;border-top:1px solid #262320;align-items:flex-end}
    .anno-reply textarea,.anno-thread textarea{flex:1;background:#16140F;border:1px solid #33302A;border-radius:9px;color:#F5F1E8;font-family:inherit;font-size:13px;padding:9px 11px;resize:vertical;min-height:38px}
    .anno-composer{padding:14px;width:340px}
    .anno-composer textarea{width:100%;margin:6px 0 12px}
    .anno-who{font-size:12px;color:#A39E92;margin-top:2px}.anno-who b{color:#F5F1E8}
    .anno-link{background:none;border:none;color:#4f8cff;cursor:pointer;font-size:12px;text-decoration:underline;padding:0}
    .anno-modal-row{display:flex;gap:8px;justify-content:flex-end}
    .anno-btn{background:#16140F;border:1px solid #33302A;color:#F5F1E8;border-radius:9px;padding:9px 15px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
    .anno-btn:hover{border-color:#4f8cff}
    .anno-btn.primary{background:#4f8cff;color:#ffffff;border-color:#4f8cff}
    .anno-modal-ov{position:fixed;inset:0;z-index:9500;background:rgba(5,5,5,.7);backdrop-filter:blur(6px);display:grid;place-items:center;font-family:inherit;padding:20px}
    .anno-modal{background:#0F0E0C;border:1px solid #33302A;border-radius:16px;padding:26px;width:380px;max-width:100%;box-shadow:0 20px 60px rgba(0,0,0,.6)}
    .anno-modal h3{color:#F5F1E8;font-size:20px;margin:0 0 8px}
    .anno-modal p{color:#A39E92;font-size:13.5px;margin:0 0 16px;line-height:1.5}
    .anno-modal input{width:100%;background:#16140F;border:1px solid #33302A;border-radius:10px;color:#F5F1E8;font-family:inherit;font-size:15px;padding:12px 14px;margin-bottom:16px}
    .anno-modal input.err{border-color:#D9694C}
    @media(max-width:620px){
      .anno-toolbar{left:10px;bottom:calc(12px + env(safe-area-inset-bottom))}
      .anno-tb{padding:9px 12px;font-size:12px}.anno-store{display:none}
      .anno-thread{left:0 !important;right:0 !important;top:auto !important;bottom:0 !important;width:100% !important;max-width:100% !important;border-radius:18px 18px 0 0;max-height:84vh;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom)}
      .anno-th-body{max-height:none;flex:1}
      .anno-composer{width:100% !important;padding:16px 16px calc(16px + env(safe-area-inset-bottom))}
      .anno-panel{width:100%;max-width:100%}
      .anno-marker{min-width:28px;height:28px;font-size:13px}
    }
    `;
    var s = el('style'); s.textContent = css; document.head.appendChild(s);
  }

  /* ---------- старт ---------- */
  function init() {
    injectCSS(); buildUI(); refresh();
    if (SHARED) setInterval(refresh, POLL_MS);            // общий режим: подтягиваем чужие комментарии
    window.addEventListener('storage', function (e) { if (e.key === 'annotate:' + PAGE) refresh(); }); // локальный: меж-вкладки
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* ============================================================================
   SQL для Supabase (выполнить один раз в SQL editor проекта):

   create table annotations (
     id text primary key,
     page_key text not null,
     section int,
     rect jsonb,
     author text,
     body text,
     parent_id text,
     resolved boolean default false,
     created_at timestamptz default now()
   );
   alter table annotations enable row level security;
   create policy "read"   on annotations for select using (true);
   create policy "insert" on annotations for insert with check (true);
   create policy "update" on annotations for update using (true);
   create policy "delete" on annotations for delete using (true);

   Затем на странице:
   <script>window.ANNOTATE={pageKey:'ton-pitch-deck',sectionSelector:'.slide',
     storage:{type:'supabase',url:'https://ВАШ.supabase.co',key:'ANON_KEY'}};</script>
   ========================================================================== */
