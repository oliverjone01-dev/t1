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
  function nearestSection(x, y) { var ss = sections(), best = null, bd = Infinity; for (var i = 0; i < ss.length; i++) { var r = ss[i].getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; var dx = x < r.left ? r.left - x : (x > r.right ? x - r.right : 0); var dy = y < r.top ? r.top - y : (y > r.bottom ? y - r.bottom : 0); var d = dx * dx + dy * dy; if (d < bd) { bd = d; best = ss[i]; } } return best; }
  function safeAdd(item, after) { try { localStorage.setItem('annotate_pending', JSON.stringify(item)); } catch (e) {} return STORE.add(item).then(function (r) { try { localStorage.removeItem('annotate_pending'); } catch (e) {} return (after ? after(r) : r); }).catch(function (err) { try { var bk = JSON.parse(localStorage.getItem('annotate_backup') || '[]'); bk.push(item); localStorage.setItem('annotate_backup', JSON.stringify(bk)); } catch (e) {} alert('Сеть недоступна - комментарий сохранён локально и отправится позже. Текст не потерян.'); DATA.push(item); renderMarkers(); renderPanel(); }); }
  // Стабильная привязка комментария к блоку. Если у блока есть data-annotate-key
  // (например динамически отрендеренный пост из таблицы) - section = детерминир.
  // хэш ключа (большое число), не зависит от порядка/вставок. Иначе - индекс
  // (обратная совместимость со старыми страницами, где section хранился как 0..n).
  function hashKey(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return 100000 + (h % 2000000000); }
  function secIdentity(elm, idx) { var k = elm && elm.getAttribute && elm.getAttribute('data-annotate-key'); return k ? hashKey(k) : idx; }
  function secByIdentity(S) { var ss = sections(); for (var i = 0; i < ss.length; i++) { if (secIdentity(ss[i], i) === S) return ss[i]; } return ss[S]; }
  function secLabel(S) { if (S === -1) return 'вся страница'; var ss = sections(); for (var i = 0; i < ss.length; i++) { if (secIdentity(ss[i], i) === S) { var l = ss[i].getAttribute && ss[i].getAttribute('data-annotate-label'); return l || ('блок ' + (i + 1)); } } return 'блок ' + ((typeof S === 'number' ? S : 0) + 1); }
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
          .then(function (r) { if (!r.ok) throw new Error('list ' + r.status); return r.json(); }).then(function (rows) { return (rows || []).map(row2item); });
      },
      add: function (item) {
        var col = { id: item.id, page_key: item.page_key, section: item.section, rect: item.rect, author: item.author, body: item.body, parent_id: item.parent_id, resolved: item.resolved, created_at: item.created_at };
        return fetch(base, { method: 'POST', headers: Object.assign({ 'Prefer': 'return=representation' }, h), body: JSON.stringify(col) })
          .then(function (r) { if (!r.ok) throw new Error('add ' + r.status); return r.json(); }).then(function (rows) { return rows[0]; });
      },
      update: function (id, patch) { return fetch(base + '?id=eq.' + id, { method: 'PATCH', headers: h, body: JSON.stringify(patch) }).then(function (r) { if (!r.ok) throw new Error('update ' + r.status); return r; }); },
      remove: function (id) { return fetch(base + '?id=eq.' + id, { method: 'DELETE', headers: h }).then(function (r) { if (!r.ok) throw new Error('del ' + r.status); return fetch(base + '?parent_id=eq.' + id, { method: 'DELETE', headers: h }); }); },
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

  function annoTyping() { var a = document.activeElement; return !!(a && a.tagName === 'TEXTAREA' && a.closest && a.closest('.anno-panel,.anno-thread')); }
  function refresh() {
    return STORE.list().then(function (rows) { DATA = rows || []; renderMarkers(); if (!annoTyping()) renderPanel(); }).catch(function () { /* сеть/Supabase сбой - оставляем текущие DATA, не падаем, не теряем ввод */ });
  }

  /* ---------- маркеры на странице ---------- */
  function renderMarkers() {
    Array.prototype.slice.call(document.querySelectorAll('.anno-marker,.anno-region')).forEach(function (m) { m.remove(); });
    var ordered = parents();
    ordered.forEach(function (a, i) {
      var sec = secByIdentity(a.section); if (!sec || !a.rect) return;
      if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative';
      var rx = Math.max(1, Math.min(99, a.rect.x)), ry = Math.max(1, Math.min(99, a.rect.y));
      var col = colorFor(a.author);
      if (OPEN_THREAD === a.id && a.rect.w > 1) {
        var reg = el('div', 'anno-region');
        reg.style.cssText = 'left:' + a.rect.x + '%;top:' + a.rect.y + '%;width:' + a.rect.w + '%;height:' + a.rect.h + '%;border-color:' + col;
        sec.appendChild(reg);
      }
      var m = el('button', 'anno-marker' + (a.resolved ? ' done' : '') + (OPEN_THREAD === a.id ? ' active' : ''));
      m.style.left = rx + '%'; m.style.top = ry + '%';
      if (!a.resolved) m.style.background = col;
      m.textContent = (i + 1);
      m.title = a.author + ': ' + (a.body || '').slice(0, 60);
      m.onclick = function (e) { e.stopPropagation(); openThread(a.id, true); };
      sec.appendChild(m);
    });
  }

  /* ---------- цвет автора ---------- */
  var ICON_PENCIL='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  var ICON_CHAT='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5Z"/></svg>';
  var ICON_CHECK='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  var ICON_REOPEN='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.5 8A9 9 0 1 1 3 12"/></svg>';
  var ICON_TRASH='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>';
  var ICON_SEND='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13"/><path d="m12 5 7 7-7 7"/></svg>';
  var ICON_CLOSE='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  var PALETTE = ['#7E9CC2', '#CE9080', '#7FB59E', '#B49AC6', '#7FB4C2', '#CC95AE', '#A6BC86', '#9E9AC4', '#C9A678', '#84BBB0'];
  function colorFor(name) { name = name || '?'; var h = 0; for (var i = 0; i < name.length; i++) { h = (h * 31 + name.charCodeAt(i)) >>> 0; } return PALETTE[h % PALETTE.length]; }

  /* ---------- панель: список + дерево ответов + поле ответа ---------- */
  var panel, toolbar;
  function renderPanel() {
    if (!panel) return;
    var list = panel.querySelector('.anno-list');
    var ps = parents();
    panel.querySelector('.anno-count').textContent = ps.length;
    if (!ps.length) { list.innerHTML = '<div class="anno-empty">Пока нет комментариев.<br>Нажмите «Комментировать» и выделите участок.</div>'; return; }
    list.innerHTML = '';
    var me = getName();
    ps.forEach(function (a, i) {
      var col = colorFor(a.author), reps = repliesOf(a.id);
      var item = el('div', 'anno-item' + (a.resolved ? ' done' : '') + (OPEN_THREAD === a.id ? ' on' : ''));
      item.setAttribute('data-id', a.id);
      var html = '<div class="anno-item-h">' +
        '<span class="anno-av" style="background:' + col + '">' + (i + 1) + '</span>' +
        '<b>' + esc(a.author) + '</b>' +
        '<span class="anno-time" title="' + fmtAbs(a.created_at) + '">' + fmtRel(a.created_at) + '</span>' +
        '<span class="anno-row-act">' +
        '<button class="anno-mini" data-do="resolve" aria-label="' + (a.resolved ? 'Вернуть' : 'Решено') + '" title="' + (a.resolved ? 'Вернуть' : 'Решено') + '">' + (a.resolved ? ICON_REOPEN : ICON_CHECK) + '</button>' +
        (a.author === me ? '<button class="anno-mini" data-do="del" aria-label="Удалить" title="Удалить">' + ICON_TRASH + '</button>' : '') +
        '</span></div>' +
        '<div class="anno-body">' + esc(a.body) + '</div>' +
        '<div class="anno-meta">' + esc(secLabel(a.section)) + (a.resolved ? ' · решено' : '') + '</div>';
      if (reps.length) {
        html += '<div class="anno-tree">';
        reps.forEach(function (r) {
          var rc = colorFor(r.author);
          html += '<div class="anno-rep"><div class="anno-rep-h"><span class="anno-dot" style="background:' + rc + '"></span><b>' + esc(r.author) + '</b><span class="anno-time" title="' + fmtAbs(r.created_at) + '">' + fmtRel(r.created_at) + '</span></div><div class="anno-rep-b">' + esc(r.body) + '</div></div>';
        });
        html += '</div>';
      }
      html += '<div class="anno-replybox"><textarea rows="1" placeholder="Ответить..."></textarea><button class="anno-mini send" data-do="send" aria-label="Ответить" title="Ответить">' + ICON_SEND + '</button></div>';
      item.innerHTML = html;
      item.querySelector('.anno-item-h').onclick = function (e) { if (e.target.closest('.anno-mini')) return; openThread(a.id, true); };
      item.querySelector('.anno-body').onclick = function () { openThread(a.id, true); };
      var rs = item.querySelector('[data-do=resolve]'); if (rs) rs.onclick = function (e) { e.stopPropagation(); STORE.update(a.id, { resolved: !a.resolved }).then(refresh); };
      var dl = item.querySelector('[data-do=del]'); if (dl) dl.onclick = function (e) { e.stopPropagation(); if (confirm('Удалить комментарий и ответы?')) { if (OPEN_THREAD === a.id) OPEN_THREAD = null; STORE.remove(a.id).then(refresh); } };
      var ta = item.querySelector('.anno-replybox textarea');
      function send() { var v = ta.value.trim(); if (!v) return; ensureName(function (nm) { ta.value=''; safeAdd({ id: uid(), page_key: PAGE, page_url: location.pathname + location.search, section: a.section, rect: a.rect, author: nm, body: v, parent_id: a.id, resolved: false, created_at: new Date().toISOString() }, refresh); }); }
      item.querySelector('[data-do=send]').onclick = function (e) { e.stopPropagation(); var b = this; if (b.disabled) return; b.disabled = true; send(); setTimeout(function () { b.disabled = false; }, 1200); };
      ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
      ta.oninput = function () { ta.style.height = 'auto'; ta.style.height = Math.min(96, ta.scrollHeight) + 'px'; };
      list.appendChild(item);
    });
    if (OPEN_THREAD) { var on = list.querySelector('[data-id="' + OPEN_THREAD + '"]'); if (on) on.scrollIntoView({ block: 'nearest' }); }
  }

  /* ---------- фокус треда: подсветка области на слайде + карточка в панели ---------- */
  function openThread(id, jump) {
    var a = DATA.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    OPEN_THREAD = id;
    if (jump) { var sec = secByIdentity(a.section); if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' }); }
    renderMarkers();
    togglePanel(true);
    renderPanel();
  }
  var threadBox; // не используется для чтения (треды теперь в панели)
  function positionThread(a) {
    var sec = secByIdentity(a.section); if (!sec || !threadBox) return;
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
      '<button class="anno-ic" data-act="resolve" aria-label="' + (a.resolved ? 'Вернуть' : 'Отметить решённым') + '" title="' + (a.resolved ? 'Вернуть' : 'Отметить решённым') + '">' + (a.resolved ? ICON_REOPEN : ICON_CHECK) + '</button>' +
      (a.author === me ? '<button class="anno-ic" data-act="del" aria-label="Удалить" title="Удалить">' + ICON_TRASH + '</button>' : '') +
      '<button class="anno-ic" data-act="close" aria-label="Закрыть" title="Закрыть">' + ICON_CLOSE + '</button></div></div>';
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
    if (!sec) sec = nearestSection(e.clientX, e.clientY);
    e.preventDefault();
    var pageLevel = !sec;
    var r = sec ? sec.getBoundingClientRect() : { left: 0, top: 0, width: Math.max(1, window.innerWidth), height: Math.max(1, window.innerHeight) };
    start = { sec: sec, r: r, x: e.clientX, y: e.clientY, page: pageLevel };
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
    var sec = start.sec, idx = sec ? sections().indexOf(sec) : -1, pageLevel = start.page;
    if (drawRect) { drawRect.remove(); drawRect = null; } start = null;
    openComposer(pageLevel ? -1 : secIdentity(sec, idx), rect, e.clientX, e.clientY);
  }
  function openComposer(secIdx, rect, px, py) {
    setMode(false);
    var box = el('div', 'anno-thread anno-composer'); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-label','Новый комментарий');
    box.innerHTML = '<div class="anno-th-head"><b>Новый комментарий</b><button class="anno-ic" data-act="close" aria-label="Отмена" title="Отмена">' + ICON_CLOSE + '</button></div>' +
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
        var item = { id: uid(), page_key: PAGE, page_url: location.pathname + location.search, section: secIdx, rect: rect, author: nm, body: v, parent_id: null, resolved: false, created_at: new Date().toISOString() };
        close();                 // карточка ввода исчезает сразу, не закрывая контент
        OPEN_THREAD = item.id;
        safeAdd(item, function () { return refresh().then(function () { togglePanel(true); }); });
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
      '<button class="anno-tb" data-act="mode"><i>' + ICON_PENCIL + '</i><span>Комментировать</span></button>' +
      '<button class="anno-tb" data-act="panel"><i>' + ICON_CHAT + '</i> Комментарии</button>' +
      '<span class="anno-store" title="' + (SHARED ? 'Комментарии общие для всех участников' : 'Комментарии видны только в этом браузере. Подключите облако для общего доступа.') + '">' + (SHARED ? '<b style="color:var(--mint,#5FD09B)">●</b> общие' : '○ локально') + '</span>';
    document.body.appendChild(toolbar);
    toolbar.querySelector('[data-act=mode]').onclick = function () { ensureName(function () { setMode(!MODE); }); };
    toolbar.querySelector('[data-act=panel]').onclick = function () { togglePanel(); };

    panel = el('div', 'anno-panel'); panel.setAttribute('role','region'); panel.setAttribute('aria-label','Комментарии');
    panel.innerHTML = '<div class="anno-panel-h"><b>Комментарии</b> <span class="anno-count" aria-live="polite">0</span><button class="anno-ic" data-act="x" aria-label="Закрыть" title="Закрыть">' + ICON_CLOSE + '</button></div><div class="anno-list"></div>';
    document.body.appendChild(panel);
    panel.querySelector('[data-act=x]').onclick = function () { togglePanel(false); };

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (MODE) setMode(false); else if (PANEL_OPEN) togglePanel(false); }
    });
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(renderMarkers, 120); });
  }

  /* ---------- стили ---------- */
  function injectCSS() {
    var c = getComputedStyle(document.documentElement);
    var css = `
    .anno-toolbar{position:fixed;left:14px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:9000;display:flex;gap:8px;align-items:center;font-family:inherit}
    .anno-tb{display:inline-flex;align-items:center;gap:7px;background:var(--card,#1E2025);color:var(--ink,#F3F2EF);border:1px solid var(--line2,#3C3F47);border-radius:var(--radius-pill,999px);padding:9px 15px;font-size:13px;font-weight:700;cursor:pointer;backdrop-filter:blur(8px);box-shadow:0 4px 14px rgba(0,0,0,.3);transition:.18s cubic-bezier(.22,.61,.36,1)}
    .anno-tb i{font-style:normal;color:var(--gold,#E3BD72)}
    .anno-tb:hover{border-color:var(--cta,#E3BD72);transform:translateY(-1px)}
    .anno-tb:active{transform:translateY(0)}
    .anno-tb.on{background:var(--cta,#E3BD72);color:var(--cta-ink,#1A1408);border-color:var(--cta,#E3BD72);box-shadow:0 4px 14px rgba(227,189,114,.35)}.anno-tb.on i{color:var(--cta-ink,#1A1408)}
    .anno-store{font-size:11px;color:var(--ink3,#888A8D);border:1px solid var(--line2,#3C3F47);border-radius:var(--radius-pill,999px);padding:6px 11px;background:var(--card2,#26282E)}
    .anno-marker{position:absolute;transform:translate(-50%,-50%);min-width:28px;height:28px;padding:0 7px;border-radius:999px;background:var(--cta,#E3BD72);color:#15120B;border:2px solid var(--card,#1E2025);font-weight:800;font-size:13px;cursor:pointer;z-index:40;box-shadow:0 0 0 2px var(--cta,#E3BD72),0 4px 14px rgba(0,0,0,.5);transition:transform .15s cubic-bezier(.34,1.3,.64,1)}
    .anno-marker:hover,.anno-marker.active{transform:translate(-50%,-50%) scale(1.22);box-shadow:0 0 0 5px rgba(227,189,114,.4),0 6px 18px rgba(0,0,0,.6)}
    .anno-marker.done{background:var(--mint,#5FD09B);opacity:.72}
    .anno-region{position:absolute;z-index:39;border:2px solid var(--cta,#E3BD72);background:rgba(227,189,114,.14);border-radius:8px;pointer-events:none;box-shadow:0 2px 12px rgba(0,0,0,.3)}
    .anno-overlay{position:fixed;inset:0;z-index:8000;cursor:crosshair;background:rgba(10,10,10,.04);touch-action:none}
    body.anno-commenting .deck,body.anno-commenting [data-annotate-root]{overflow:hidden !important}
    body.anno-commenting{cursor:crosshair}
    .anno-draw{position:fixed;z-index:8500;border:2px solid var(--cta,#E3BD72);background:rgba(227,189,114,.16);border-radius:6px;pointer-events:none}
    .anno-panel{position:fixed;top:0;right:-380px;width:348px;max-width:90vw;height:100dvh;z-index:8800;background:var(--card,#1E2025);border-left:1px solid var(--line,#2E3036);box-shadow:-26px 0 70px rgba(0,0,0,.6);transition:right .32s cubic-bezier(.22,.61,.36,1);display:flex;flex-direction:column;font-family:inherit}
    .anno-panel.open{right:0}
    .anno-panel-h{position:relative;display:flex;align-items:center;gap:10px;padding:18px 18px 14px;border-bottom:1px solid var(--line,#2E3036);color:var(--ink,#F3F2EF);font-size:15px;font-weight:700}
    .anno-panel-h .anno-count{background:var(--cta,#E3BD72);color:var(--cta-ink,#1A1408);border-radius:var(--radius-pill,999px);font-size:11px;font-weight:800;padding:2px 8px}
    .anno-panel-h .anno-ic{margin-left:auto}
    .anno-list{overflow-y:auto;padding:10px 12px;flex:1}
    .anno-empty{color:var(--ink3,#888A8D);font-size:13px;text-align:center;padding:40px 16px;line-height:1.6}
    .anno-item{background:var(--card2,#26282E);border:1px solid var(--line,#2E3036);border-radius:var(--radius-s,13px);padding:13px 14px;margin-bottom:10px;cursor:pointer;transition:transform .15s cubic-bezier(.22,.61,.36,1),border-color .15s}
    .anno-item:hover{border-color:var(--line2,#3C3F47);transform:translateY(-1px)}
    .anno-item.done{opacity:.6}
    .anno-item-h{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ink,#F3F2EF)}
    .anno-pin{background:var(--cta,#E3BD72);color:var(--cta-ink,#1A1408);font-weight:800;font-size:11px;min-width:18px;height:18px;border-radius:var(--radius-pill,999px);display:inline-grid;place-items:center;padding:0 5px}
    .anno-time{margin-left:auto;color:var(--ink3,#888A8D);font-size:11px;font-weight:400}
    .anno-body{color:var(--ink2,#B4B6B8);font-size:13px;margin-top:6px;line-height:1.45}
    .anno-meta{color:var(--ink3,#888A8D);font-size:11px;margin-top:7px;letter-spacing:.02em}
    .anno-av{flex:none;min-width:22px;height:22px;border-radius:var(--radius-pill,999px);display:inline-grid;place-items:center;color:#15120B;font-weight:800;font-size:11px;padding:0 5px;box-shadow:0 0 0 2px rgba(255,255,255,.18)}
    .anno-row-act{margin-left:auto;display:flex;gap:4px}
    .anno-mini{background:none;border:1px solid var(--line2,#3C3F47);color:var(--ink2,#B4B6B8);border-radius:9px;min-width:30px;height:30px;cursor:pointer;font-size:13px;display:grid;place-items:center;transition:.15s}
    .anno-mini:hover{border-color:var(--cta,#E3BD72);color:var(--ink,#F3F2EF)}
    .anno-mini.send{min-width:34px;color:var(--cta-ink,#1A1408);background:var(--cta,#E3BD72);border-color:var(--cta,#E3BD72);font-size:15px}
    .anno-item.on{border-color:var(--cta,#E3BD72);box-shadow:0 0 0 2px rgba(227,189,114,.35)}
    .anno-tree{margin-top:10px;display:flex;flex-direction:column;gap:8px}
    .anno-rep{border-left:2px solid var(--line2,#3C3F47);padding:1px 0 1px 10px;margin-left:4px}
    .anno-rep-h{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink,#F3F2EF)}
    .anno-rep-h .anno-dot{width:9px;height:9px;border-radius:50%;flex:none}
    .anno-rep-h b{font-weight:700}
    .anno-rep-b{color:var(--ink2,#B4B6B8);font-size:12.5px;margin-top:3px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
    .anno-replybox{display:flex;gap:7px;margin-top:10px;align-items:flex-end}
    .anno-replybox textarea{flex:1;background:var(--bg2,#191B20);border:1px solid var(--line2,#3C3F47);border-radius:var(--radius-s,13px);color:var(--ink,#F3F2EF);font-family:inherit;font-size:13px;padding:9px 11px;resize:none;min-height:38px;line-height:1.35}
    .anno-replybox textarea:focus{border-color:var(--cta,#E3BD72);outline:none}
    .anno-thread{position:fixed;z-index:8900;width:320px;max-width:calc(100vw - 24px);background:var(--card,#1E2025);border:1px solid var(--line,#2E3036);border-top:3px solid var(--cta,#E3BD72);border-radius:var(--radius,20px);box-shadow:0 18px 50px rgba(0,0,0,.6);font-family:inherit;overflow:hidden}
    .anno-th-head{display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line,#2E3036);color:var(--ink,#F3F2EF);font-size:13.5px;font-weight:700}
    .anno-th-actions{margin-left:auto;display:flex;gap:4px}
    .anno-ic{background:none;border:1px solid var(--line2,#3C3F47);color:var(--ink2,#B4B6B8);border-radius:9px;width:30px;height:30px;cursor:pointer;font-size:13px;display:grid;place-items:center;transition:.15s}
    .anno-ic:hover{border-color:var(--cta,#E3BD72);color:var(--gold,#E3BD72)}
    .anno-th-body{max-height:46vh;overflow-y:auto;padding:6px 14px}
    .anno-msg{padding:11px 0;border-bottom:1px solid var(--line,#2E3036)}
    .anno-msg:last-child{border-bottom:none}
    .anno-msg.reply{margin-left:14px;border-left:2px solid var(--line2,#3C3F47);padding-left:12px}
    .anno-msg-h{display:flex;align-items:center;gap:8px;color:var(--ink,#F3F2EF);font-size:13px}
    .anno-msg-b{color:var(--ink2,#B4B6B8);font-size:13px;margin-top:4px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
    .anno-reply{display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--line,#2E3036);align-items:flex-end}
    .anno-reply textarea,.anno-thread textarea{flex:1;background:var(--bg2,#191B20);border:1px solid var(--line2,#3C3F47);border-radius:var(--radius-s,13px);color:var(--ink,#F3F2EF);font-family:inherit;font-size:13px;padding:9px 11px;resize:vertical;min-height:40px}
    .anno-composer{padding:14px;width:340px}
    .anno-composer textarea{width:100%;margin:6px 0 12px}
    .anno-who{font-size:12px;color:var(--ink2,#B4B6B8);margin-top:2px}.anno-who b{color:var(--ink,#F3F2EF)}
    .anno-link{background:none;border:none;color:var(--gold,#E3BD72);cursor:pointer;font-size:12px;text-decoration:underline;padding:0}
    .anno-modal-row{display:flex;gap:8px;justify-content:flex-end}
    .anno-btn{background:var(--card2,#26282E);border:1px solid var(--line2,#3C3F47);color:var(--ink,#F3F2EF);border-radius:var(--radius-pill,999px);padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:.15s}
    .anno-btn:hover{border-color:var(--cta,#E3BD72)}
    .anno-btn.primary{background:var(--cta,#E3BD72);color:var(--cta-ink,#1A1408);border-color:var(--cta,#E3BD72)}
    .anno-btn.primary:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(227,189,114,.35)}
    .anno-modal-ov{position:fixed;inset:0;z-index:9500;background:rgba(5,5,5,.7);backdrop-filter:blur(6px);display:grid;place-items:center;font-family:inherit;padding:20px}
    .anno-modal{background:var(--card,#1E2025);border:1px solid var(--line,#2E3036);border-radius:var(--radius,20px);padding:26px;width:380px;max-width:100%;box-shadow:0 20px 60px rgba(0,0,0,.6)}
    .anno-modal h3{color:var(--ink,#F3F2EF);font-size:20px;margin:0 0 8px;font-weight:800}
    .anno-modal p{color:var(--ink2,#B4B6B8);font-size:13.5px;margin:0 0 16px;line-height:1.5}
    .anno-modal input{width:100%;background:var(--bg2,#191B20);border:1px solid var(--line2,#3C3F47);border-radius:var(--radius-s,13px);color:var(--ink,#F3F2EF);font-family:inherit;font-size:15px;padding:12px 14px;margin-bottom:16px}
    .anno-modal input:focus{border-color:var(--cta,#E3BD72);outline:none}
    .anno-modal input.err{border-color:var(--rose,#E8805F)}
    .anno-tb i svg,.anno-ic svg,.anno-mini svg,.anno-th-head svg{display:block}.anno-mini.send svg{width:17px;height:17px}
    .anno-tb:focus-visible,.anno-ic:focus-visible,.anno-mini:focus-visible,.anno-btn:focus-visible,.anno-marker:focus-visible,.anno-link:focus-visible{outline:2px solid var(--cta,#E3BD72);outline-offset:2px}
    .anno-replybox textarea:focus,.anno-modal input:focus,.anno-reply textarea:focus,.anno-thread textarea:focus{box-shadow:0 0 0 3px rgba(227,189,114,.30)}
    @media (prefers-reduced-motion:reduce){.anno-tb,.anno-marker,.anno-item,.anno-panel,.anno-btn,.anno-thread,.anno-mini,.anno-ic{transition:none!important}.anno-marker:hover,.anno-marker.active{transform:translate(-50%,-50%)!important}.anno-tb:hover,.anno-item:hover{transform:none!important}}
    @media(max-width:620px){
      .anno-toolbar{left:10px;bottom:calc(12px + env(safe-area-inset-bottom))}
      .anno-tb{padding:11px 14px;font-size:13px;min-height:44px}.anno-store{display:none}
      .anno-marker{min-width:32px;height:32px;font-size:14px}
      .anno-mini,.anno-ic{min-width:44px;height:44px}
      .anno-panel{top:auto;right:0;left:0;bottom:-100%;width:100%;max-width:100%;height:auto;max-height:88dvh;border-left:none;border-top:3px solid var(--cta,#E3BD72);border-radius:20px 20px 0 0;box-shadow:0 -20px 60px rgba(0,0,0,.6);transition:bottom .32s cubic-bezier(.22,.61,.36,1)}
      .anno-panel.open{right:0;bottom:0}
      .anno-panel-h::before{content:"";position:absolute;top:7px;left:50%;transform:translateX(-50%);width:38px;height:4px;border-radius:999px;background:var(--line2,#3C3F47)}
      .anno-list{padding:10px 14px calc(18px + env(safe-area-inset-bottom))}
      .anno-thread{left:0 !important;right:0 !important;top:auto !important;bottom:0 !important;width:100% !important;max-width:100% !important;border-radius:20px 20px 0 0;max-height:84vh;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom)}
      .anno-th-body{max-height:none;flex:1}
      .anno-composer{width:100% !important;padding:16px 16px calc(16px + env(safe-area-inset-bottom))}
      .anno-modal{padding:22px}
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
  // Публичный хук: после динамического рендера (например постов из таблицы)
  // вызвать window.ANNOTATE_REFRESH(), чтобы перепривязать маркеры к новым блокам.
  window.ANNOTATE_REFRESH = function () { try { return refresh(); } catch (e) { } };
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
