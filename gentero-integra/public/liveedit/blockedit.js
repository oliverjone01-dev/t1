/* ============================================================================
   blockedit.js - правка любого блока прямо на странице, сохранение на сервер.

   Что делает:
     - находит текстовые блоки страницы (заголовки, абзацы, пункты списков,
       ячейки таблиц) и вешает на них правку по клику;
     - хранит НЕ страницу целиком, а карту патчей {block_id: html}. Шаблон
       остаётся в git и может переверстываться, патчи от этого не страдают;
     - патчи шифруются в браузере, если хост передал ключ (LiveCrypt);
     - отдаёт своё состояние модулю versions.js, чтобы тот снимал версии.

   Адресация блоков. Если у элемента есть data-edit="ид" - берётся он. Иначе
   идентификатор считается сам: документ / секция / тег / хэш исходного текста.
   Хэш от ШАБЛОННОГО текста, а не от отредактированного, поэтому патч живёт,
   пока я не переписал в шаблоне именно этот абзац. Когда переписал - патч
   становится «осиротевшим», молча не пропадает, а показывается в панели.

   Конфиг: window.BLOCKEDIT = {
     docKey, storage, selector, code, crypt, author
   }
   Публичные хуки:
     window.BLOCKEDIT_REFRESH()          - перепривязка после смены DOM
     window.BLOCKEDIT_SETCRYPT(crypt)    - отдать ключ, когда он появился
     window.BLOCKEDIT_STATE()            - {v, blocks}
     window.BLOCKEDIT_APPLY(state)       - применить и сохранить состояние
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.BLOCKEDIT || {};
  var DOCKEY = CFG.docKey || (location.pathname.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'page');
  var SEL = CFG.selector || 'h1,h2,h3,h4,h5,p,li,blockquote,figcaption,td,th,dd,dt,[data-edit]';
  var CODE = CFG.code || '';
  var ROOT_SEL = CFG.root || '#doc';
  var UI = CFG.ui !== false;      // зритель документа панелей не видит вообще

  var crypt = CFG.crypt || (window.LiveCrypt ? window.LiveCrypt.off : null);
  var store = window.LiveStore.blocks({ docKey: DOCKEY, storage: CFG.storage });

  var patches = {};        // block_id -> html (расшифрованный)
  var orig = {};           // block_id -> html шаблона (для «сбросить»)
  var loaded = false;
  var editing = false;     // включён ли режим правки
  var unlocked = !CODE;    // введён ли код
  var active = null;       // элемент под правкой
  var beforeEdit = '';
  var dirty = 0;

  /* ---------- служебное ---------- */

  function author() {
    var a = CFG.author || localStorage.getItem('liveedit:author') || '';
    return a;
  }
  function askAuthor() {
    var a = author();
    if (a) return a;
    a = (prompt('Как подписывать правки?', '') || '').trim().slice(0, 40);
    if (a) localStorage.setItem('liveedit:author', a);
    return a;
  }

  function hash8(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function norm(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function roots() {
    var r = document.querySelector(ROOT_SEL);
    return r || document.body;
  }

  /* Только самые внутренние совпадения: если <li> содержит <p>, правим <p>. */
  function scan() {
    var root = roots();
    var all = Array.prototype.slice.call(root.querySelectorAll(SEL));
    var out = [], seen = {};
    all.forEach(function (el) {
      if (el.closest('[data-noedit]')) return;
      if (el.closest('.le-bar') || el.closest('.le-panel') || el.closest('.ver-panel')) return;
      if (!el.hasAttribute('data-edit') && el.querySelector(SEL)) return;   // не самый внутренний
      if (!norm(el)) return;
      // data-le уже стоит - берём его. Иначе хэш посчитается от уже
      // отредактированного текста и патч потеряет свой же адрес.
      var id = el.getAttribute('data-edit') || el.getAttribute('data-le');
      if (!id) {
        var sec = el.closest('section[id],[data-sec]');
        var doc = root.getAttribute('data-doc') || 'doc';
        var key = doc + '/' + (sec ? (sec.id || sec.getAttribute('data-sec')) : 'root') +
                  '/' + el.tagName.toLowerCase() + '/' + hash8(norm(el));
        var n = (seen[key] = (seen[key] || 0) + 1);
        id = n > 1 ? key + '#' + n : key;
      }
      el.setAttribute('data-le', id);
      if (!(id in orig)) orig[id] = el.innerHTML;
      out.push(el);
    });
    return out;
  }

  /* ---------- санитайзер ---------- */

  var OK_TAG = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, BR: 1, SPAN: 1, A: 1, UL: 1, OL: 1, LI: 1, P: 1, SMALL: 1, SUP: 1, SUB: 1, CODE: 1, DIV: 1 };
  var OK_ATTR = { class: 1, href: 1, target: 1, rel: 1, 'data-edit': 1 };

  function clean(html) {
    var box = document.createElement('div');
    box.innerHTML = html;
    (function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      kids.forEach(function (n) {
        if (n.nodeType === 8) { n.remove(); return; }               // комментарии
        if (n.nodeType !== 1) return;
        if (!OK_TAG[n.tagName]) {                                   // разворачиваем чужой тег
          walk(n);
          while (n.firstChild) node.insertBefore(n.firstChild, n);
          n.remove();
          return;
        }
        Array.prototype.slice.call(n.attributes).forEach(function (a) {
          if (!OK_ATTR[a.name.toLowerCase()]) n.removeAttribute(a.name);
        });
        if (n.tagName === 'A') {
          var href = n.getAttribute('href') || '';
          if (/^\s*javascript:/i.test(href)) n.removeAttribute('href');
        }
        walk(n);
      });
    })(box);
    return box.innerHTML.replace(/ /g, ' ').trim();
  }

  /* ---------- применение патчей ---------- */

  function apply() {
    var els = scan(), hit = 0;
    els.forEach(function (el) {
      var id = el.getAttribute('data-le');
      if (patches[id] != null && el.innerHTML !== patches[id]) {
        el.innerHTML = patches[id];
        el.setAttribute('data-le-patched', '1');
        hit++;
      } else if (patches[id] != null) {
        el.setAttribute('data-le-patched', '1');
        hit++;
      }
    });
    return { total: els.length, applied: hit };
  }

  function orphans() {
    var live = {};
    Array.prototype.slice.call(roots().querySelectorAll('[data-le]'))
      .forEach(function (el) { live[el.getAttribute('data-le')] = 1; });
    return Object.keys(patches).filter(function (id) {
      // чужая вкладка не сирота: у неё другой префикс документа
      var doc = (roots().getAttribute('data-doc') || 'doc') + '/';
      return id.indexOf(doc) === 0 && !live[id];
    });
  }

  /* ---------- загрузка ---------- */

  function load() {
    return store.list().then(function (rows) {
      return Promise.all(rows.map(function (r) {
        return crypt.decrypt(r.payload)
          .then(function (html) { patches[r.block_id] = html; })
          .catch(function () { /* чужим ключом не расшифровать, пропускаем */ });
      }));
    }).then(function () {
      loaded = true;
      apply();
      paint();
    }).catch(function (e) {
      console.warn('blockedit: патчи не загрузились', e);
      loaded = true;
      paint();
    });
  }

  function save(id, html) {
    patches[id] = html;
    dirty++;
    return crypt.encrypt(html)
      .then(function (p) { return store.put(id, p, author()); })
      .then(function () {
        flash('сохранено');
        if (window.VERSIONS_TOUCH) window.VERSIONS_TOUCH();
      })
      .catch(function (e) { flash('не сохранилось: ' + e.message, true); });
  }

  function reset(id, el) {
    delete patches[id];
    el.innerHTML = orig[id];
    el.removeAttribute('data-le-patched');
    return store.drop(id).then(function () {
      flash('вернул шаблонный текст');
      if (window.VERSIONS_TOUCH) window.VERSIONS_TOUCH();
    });
  }

  /* ---------- правка ---------- */

  function startEdit(el) {
    if (active === el) return;
    if (active) stopEdit(true);
    active = el;
    beforeEdit = el.innerHTML;
    el.setAttribute('contenteditable', 'true');
    el.classList.add('le-active');
    el.focus();
    bar(el);
  }

  function stopEdit(commit) {
    if (!active) return;
    var el = active, id = el.getAttribute('data-le');
    el.removeAttribute('contenteditable');
    el.classList.remove('le-active');
    active = null;
    killBar();
    if (!commit) { el.innerHTML = beforeEdit; return; }
    var html = clean(el.innerHTML);
    if (html === clean(beforeEdit)) return;
    if (!html) { el.innerHTML = beforeEdit; flash('пустой блок не сохраняю', true); return; }
    el.innerHTML = html;
    el.setAttribute('data-le-patched', '1');
    save(id, html);
  }

  var barEl = null;
  function killBar() { if (barEl) { barEl.remove(); barEl = null; } }
  function bar(el) {
    killBar();
    var b = document.createElement('div');
    b.className = 'le-bar';
    b.innerHTML = '<button type="button" data-a="ok">Сохранить</button>' +
      '<button type="button" data-a="no">Отмена</button>' +
      '<button type="button" data-a="rs">Шаблон</button>' +
      '<span class="le-hint">Ctrl+Enter сохранить, Esc отменить</span>';
    document.body.appendChild(b);
    barEl = b;
    place();
    b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    b.addEventListener('click', function (ev) {
      var a = ev.target.getAttribute && ev.target.getAttribute('data-a');
      if (!a) return;
      if (a === 'ok') stopEdit(true);
      else if (a === 'no') stopEdit(false);
      else if (a === 'rs') { var e2 = active, id = e2.getAttribute('data-le'); stopEdit(false); reset(id, e2); }
    });
    function place() {
      var r = el.getBoundingClientRect();
      b.style.top = Math.max(8, r.top - 44) + 'px';
      b.style.left = Math.max(8, Math.min(r.left, innerWidth - 340)) + 'px';
    }
    b.__place = place;
  }
  addEventListener('scroll', function () { if (barEl && barEl.__place) barEl.__place(); }, { passive: true });
  addEventListener('resize', function () { if (barEl && barEl.__place) barEl.__place(); });

  /* ---------- тулбар ---------- */

  var tb, dot, msg;
  function buildUI() {
    tb = document.createElement('div');
    tb.className = 'le-tb';
    tb.innerHTML =
      '<button type="button" class="le-btn" id="le-toggle" aria-pressed="false">' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 6l4 4" stroke="currentColor" stroke-width="1.6"/></svg>' +
      '<span>Правка</span><i class="le-dot" id="le-dot"></i></button>' +
      '<span class="le-msg" id="le-msg" role="status" aria-live="polite"></span>';
    document.body.appendChild(tb);
    dot = tb.querySelector('#le-dot');
    msg = tb.querySelector('#le-msg');
    tb.querySelector('#le-toggle').addEventListener('click', toggle);
  }

  function flash(t, bad) {
    if (!msg) return;
    msg.textContent = t;
    msg.className = 'le-msg show' + (bad ? ' bad' : '');
    clearTimeout(flash.t);
    flash.t = setTimeout(function () { msg.className = 'le-msg'; }, 2600);
  }

  function paint() {
    if (!dot) return;
    dot.className = 'le-dot' + (store.local ? ' local' : '') + (crypt.on ? ' enc' : '');
    dot.title = (store.local ? 'только этот браузер' : 'сервер') + (crypt.on ? ', шифрование' : '');
  }

  function toggle() {
    if (!editing && !unlocked) {
      var c = (prompt('Код редактора', '') || '').trim();
      if (c !== CODE) { flash('код не подошёл', true); return; }
      unlocked = true;
    }
    editing = !editing;
    if (editing) askAuthor();
    document.documentElement.classList.toggle('le-on', editing);
    tb.querySelector('#le-toggle').setAttribute('aria-pressed', editing ? 'true' : 'false');
    if (!editing) stopEdit(true);
    flash(editing ? 'режим правки: кликай по тексту' : 'правка выключена');
  }

  /* ---------- слушатели на документе, вешаются один раз ---------- */

  function bindOnce() {
    if (window.__leBound) return;
    window.__leBound = true;

    document.addEventListener('click', function (ev) {
      if (!editing) return;
      var t = ev.target.closest && ev.target.closest('[data-le]');
      if (!t) { if (active && !ev.target.closest('.le-bar')) stopEdit(true); return; }
      if (t === active) return;
      ev.preventDefault();
      startEdit(t);
    }, true);

    document.addEventListener('keydown', function (ev) {
      if (!active) return;
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); stopEdit(false); }
      else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); stopEdit(true); }
    }, true);

    // вставка только текстом, иначе прилетает вёрстка из Word
    document.addEventListener('paste', function (ev) {
      if (!active) return;
      ev.preventDefault();
      var t = (ev.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t);
    });

    addEventListener('beforeunload', function (ev) {
      if (active) stopEdit(true);
      if (dirty && window.VERSIONS_FLUSH) window.VERSIONS_FLUSH();
    });
  }

  /* ---------- стили ---------- */

  function css() {
    var s = document.createElement('style');
    s.textContent = [
      '.le-tb{position:fixed;right:16px;bottom:16px;z-index:9400;display:flex;align-items:center;gap:10px;flex-direction:row-reverse;font-family:inherit}',
      '.le-btn{display:inline-flex;align-items:center;gap:8px;background:var(--card,#1E2025);border:1px solid var(--line2,#3C3F47);color:var(--ink,#F3F2EF);border-radius:999px;padding:10px 16px;font:700 13px/1 inherit;cursor:pointer;box-shadow:0 8px 26px rgba(0,0,0,.4);transition:.15s}',
      '.le-btn:hover{border-color:var(--cta,#E3BD72);transform:translateY(-1px)}',
      '.le-btn svg{width:17px;height:17px;display:block}',
      '.le-btn[aria-pressed="true"]{background:var(--cta,#E3BD72);color:var(--cta-ink,#1A1408);border-color:var(--cta,#E3BD72)}',
      '.le-dot{width:7px;height:7px;border-radius:50%;background:#6BBF7B;display:inline-block}',
      '.le-dot.local{background:#E3BD72}.le-dot.enc{box-shadow:0 0 0 3px rgba(107,191,123,.22)}',
      '.le-msg{opacity:0;transform:translateY(4px);transition:.2s;background:var(--card,#1E2025);border:1px solid var(--line,#2E3036);color:var(--ink2,#B4B6B8);border-radius:999px;padding:8px 14px;font-size:12.5px;pointer-events:none;white-space:nowrap}',
      '.le-msg.show{opacity:1;transform:none}.le-msg.bad{color:#E8805F;border-color:#E8805F}',
      '.le-on [data-le]{cursor:text;border-radius:6px;transition:box-shadow .12s,background .12s}',
      '.le-on [data-le]:hover{box-shadow:0 0 0 2px rgba(227,189,114,.45);background:rgba(227,189,114,.06)}',
      '.le-on [data-le-patched]{box-shadow:inset 3px 0 0 rgba(107,191,123,.7)}',
      '[data-le].le-active{outline:2px solid var(--cta,#E3BD72);outline-offset:3px;background:rgba(227,189,114,.08)}',
      '.le-bar{position:fixed;z-index:9600;display:flex;align-items:center;gap:6px;background:var(--card,#1E2025);border:1px solid var(--line2,#3C3F47);border-radius:999px;padding:6px 8px;box-shadow:0 10px 30px rgba(0,0,0,.5);font-family:inherit}',
      '.le-bar button{background:var(--card2,#26282E);border:1px solid var(--line2,#3C3F47);color:var(--ink,#F3F2EF);border-radius:999px;padding:6px 13px;font:700 12px/1 inherit;cursor:pointer}',
      '.le-bar button:hover{border-color:var(--cta,#E3BD72)}',
      '.le-bar button[data-a="ok"]{background:var(--cta,#E3BD72);color:var(--cta-ink,#1A1408);border-color:var(--cta,#E3BD72)}',
      '.le-hint{color:var(--ink2,#B4B6B8);font-size:11.5px;padding:0 6px}',
      '@media print{.le-tb,.le-bar{display:none}}',
      '@media(max-width:620px){.le-tb{right:10px;bottom:calc(10px + env(safe-area-inset-bottom))}.le-hint{display:none}}',
      '@media (prefers-reduced-motion:reduce){.le-btn,.le-msg,[data-le]{transition:none!important}.le-btn:hover{transform:none!important}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ---------- публичное ---------- */

  window.BLOCKEDIT_REFRESH = function () {
    if (!loaded) return;
    apply();
  };
  window.BLOCKEDIT_SETCRYPT = function (c) {
    crypt = c;
    patches = {};
    return load();
  };
  window.BLOCKEDIT_STATE = function () {
    return { v: 1, docKey: DOCKEY, blocks: JSON.parse(JSON.stringify(patches)) };
  };
  window.BLOCKEDIT_APPLY = function (state) {
    var next = (state && state.blocks) || {};
    var jobs = [];
    Object.keys(patches).forEach(function (id) {
      if (!(id in next)) jobs.push(store.drop(id));
    });
    Object.keys(next).forEach(function (id) {
      if (patches[id] !== next[id]) {
        jobs.push(crypt.encrypt(next[id]).then(function (p) { return store.put(id, p, author()); }));
      }
    });
    // шаблонный текст возвращаем там, где патч сняли
    Object.keys(patches).forEach(function (id) {
      if (!(id in next) && orig[id] != null) {
        var el = roots().querySelector('[data-le="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
        if (el) { el.innerHTML = orig[id]; el.removeAttribute('data-le-patched'); }
      }
    });
    patches = JSON.parse(JSON.stringify(next));
    apply();
    return Promise.all(jobs).then(function () { flash('версия восстановлена'); });
  };
  // Только показать состояние в DOM. Ни хранилище, ни карта патчей не трогаются:
  // отсюда всегда можно вернуться к текущей версии.
  window.BLOCKEDIT_PREVIEW = function (state) {
    var next = (state && state.blocks) || {};
    scan().forEach(function (el) {
      var id = el.getAttribute('data-le');
      if (next[id] != null) {
        if (el.innerHTML !== next[id]) el.innerHTML = next[id];
        el.setAttribute('data-le-patched', '1');
      } else if (orig[id] != null) {
        if (el.innerHTML !== orig[id]) el.innerHTML = orig[id];
        el.removeAttribute('data-le-patched');
      }
    });
    return Promise.resolve();
  };
  window.BLOCKEDIT_INFO = function () {
    var a = apply();
    return { total: a.total, patched: Object.keys(patches).length, orphans: orphans(), local: store.local, crypt: crypt.on };
  };

  /* ---------- старт ---------- */

  function init() {
    if (UI) { css(); buildUI(); bindOnce(); paint(); }
    if (!crypt.on) load();      // с шифрованием ждём ключ через BLOCKEDIT_SETCRYPT
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
