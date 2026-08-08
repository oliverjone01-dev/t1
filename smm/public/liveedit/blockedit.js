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
   идентификатор считается сам: документ / секция / тег / хэш исходного текста
   (для ячеек таблиц плюс подпись строки и номер колонки). Хэш от ШАБЛОННОГО
   текста, а не от отредактированного, поэтому патч живёт, пока в шаблоне не
   переписан именно этот абзац. Когда переписан - патч становится осиротевшим и
   попадает в красную плашку сверху, которую видит и зритель.

   Право писать проверяет сервер (RLS "to authenticated"), вход через auth.js.
   Кода доступа в разметке нет: страница публичная, атрибут виден любому.

   Конфиг: window.BLOCKEDIT = { docKey, storage, root, selector, code, ui, crypt }
   Публичные хуки перечислены в README.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.BLOCKEDIT || {};
  var DOCKEY = CFG.docKey || (location.pathname.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'page');
  var SEL = CFG.selector || 'h1,h2,h3,h4,h5,p,li,blockquote,figcaption,td,th,dd,dt,[data-edit]';
  var CODE = CFG.code || '';
  var ROOT_SEL = CFG.root || '#doc';
  var UI = CFG.ui !== false;      // зритель документа панелей не видит вообще

  // Один недогруженный файл не должен убивать модуль без единого слова.
  if (!window.LiveCrypt || !window.LiveStore) {
    console.error('blockedit: не загрузились crypt.js или store.js, правка выключена');
    return;
  }
  var crypt = CFG.crypt || window.LiveCrypt.off;
  // объект конфига живой: store читает cfg.crypt в момент записи, чтобы флаг
  // crypt в строке соответствовал тому, что реально лежит в payload
  var storeCfg = { docKey: DOCKEY, storage: CFG.storage, crypt: crypt };
  var store = window.LiveStore.blocks(storeCfg);

  var patches = {};        // block_id -> html (расшифрованный)
  var orig = {};           // block_id -> html шаблона (для «сбросить»)
  var loaded = false;
  var editing = false;     // включён ли режим правки
  var unlocked = false;    // прошёл ли вход редактора
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

  /* Ячейки таблиц сплошь и рядом повторяют друг друга: «да», «нет», «-».
     Один хэш текста их не различает, а порядковый номер переезжает на соседа
     при вставке строки, и правка садится не в ту ячейку. Поэтому адрес ячейки
     дополняем подписью её строки (первая ячейка) и номером колонки: вставка и
     перестановка строк такой адрес не ломают. */
  function rowKey(el) {
    var tag = el.tagName;
    if (tag !== 'TD' && tag !== 'TH') return '';
    var tr = el.closest('tr');
    if (!tr) return '';
    var cells = Array.prototype.slice.call(tr.children);
    var col = cells.indexOf(el);
    var head = cells[0] === el ? '' : (cells[0].textContent || '').replace(/\s+/g, ' ').trim();
    return '|r:' + head + '|c:' + col;
  }

  /* Только самые внутренние совпадения: если <li> содержит <p>, правим <p>. */
  function scan() {
    var root = roots();
    var all = Array.prototype.slice.call(root.querySelectorAll(SEL));
    var out = [], seen = {};
    all.forEach(function (el) {
      if (el.closest('[data-noedit]')) return;
      if (el.closest('.le-bar') || el.closest('.le-panel') || el.closest('.ver-panel')) return;
      // «самый внутренний» проверяем по data-le, а не по data-edit: иначе
      // сохранённый в блок список делает родителя невыбираемым, дети
      // регистрируются заново, и orig[] снимается уже с правленого текста
      if (!el.hasAttribute('data-le') && el.querySelector(SEL)) return;
      if (!norm(el)) return;
      // data-le уже стоит - берём его. Иначе хэш посчитается от уже
      // отредактированного текста и патч потеряет свой же адрес.
      var id = el.getAttribute('data-edit') || el.getAttribute('data-le');
      if (!id) {
        var sec = el.closest('section[id],[data-sec]');
        var doc = root.getAttribute('data-doc') || 'doc';
        var key = doc + '/' + (sec ? (sec.id || sec.getAttribute('data-sec')) : 'root') +
                  '/' + el.tagName.toLowerCase() + '/' + hash8(norm(el) + rowKey(el));
        // Порядковый суффикс это последнее средство: он сдвигается при вставке
        // соседа, поэтому сначала пытаемся развести блоки содержательно (rowKey).
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
  // data-edit намеренно НЕ в списке: иначе содержимое базы чеканит
  // произвольные идентификаторы блоков
  var OK_ATTR = { class: 1, href: 1, target: 1, rel: 1 };

  // Разбор идёт в inert-документе, а не в живом div: там <img onerror> и
  // <iframe> не начнут грузиться и выполняться ещё до того, как мы их вырежем.
  function clean(html) {
    var doc2 = document.implementation.createHTMLDocument('');
    var box = doc2.createElement('div');
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
          // \s не покрывает управляющие символы C0, а браузер их при резолве
          // URL выбрасывает, поэтому "\x01javascript:" прошло бы фильтр
          var href = (n.getAttribute('href') || '').replace(/[\u0000-\u0020]/g, '').toLowerCase();
          if (/^(javascript|data|vbscript):/.test(href)) n.removeAttribute('href');
        }
        walk(n);
      });
    })(box);
    return box.innerHTML.replace(/\u00A0/g, ' ').trim();
  }

  /* ---------- применение патчей ---------- */

  // Санитайзер обязан стоять и на выходе из хранилища, а не только на входе:
  // в базу пишет не только этот код, и доверять её содержимому нельзя.
  function put(el, html) {
    var safe = clean(html);
    if (el.innerHTML !== safe) el.innerHTML = safe;
    return safe;
  }

  function apply() {
    // В режиме просмотра версии в DOM лежит старый текст. Наложить поверх него
    // текущие патчи значило бы врать: баннер продолжает обещать старую версию.
    if (window.VERSIONS_PREVIEWING && window.VERSIONS_PREVIEWING()) {
      return { total: roots().querySelectorAll('[data-le]').length, applied: 0 };
    }
    var els = scan(), hit = 0;
    els.forEach(function (el) {
      var id = el.getAttribute('data-le');
      if (patches[id] == null) return;
      put(el, patches[id]);
      el.setAttribute('data-le-patched', '1');
      hit++;
    });
    return { total: els.length, applied: hit };
  }

  function orphans() {
    var live = {};
    Array.prototype.slice.call(roots().querySelectorAll('[data-le]'))
      .forEach(function (el) { live[el.getAttribute('data-le')] = 1; });
    var doc = (roots().getAttribute('data-doc') || 'doc') + '/';
    return Object.keys(patches).filter(function (id) {
      if (live[id]) return false;
      // Сирота это патч, которому НЕ соответствует живой блок. Проверять его
      // наличие в orig нельзя: orig наполняется только по элементам из DOM,
      // и такое условие отрицало бы само определение сироты.
      // Блок другой вкладки сиротой не считаем: у него префикс чужого
      // документа, он появится, когда вкладку откроют. Ручной data-edit
      // префикса не имеет вообще, поэтому попадает в счёт всегда.
      if (/^[^\/]+\//.test(id) && id.indexOf(doc) !== 0) return false;
      return true;
    });
  }

  /* ---------- загрузка ---------- */

  // Шифротекст привязан к своему слоту через AAD, иначе payload одного блока
  // валидно встаёт на место другого.
  function aad(id) { return DOCKEY + '|' + id; }

  var health = { ok: false, err: null, rows: 0, bad: 0, write: 0, cut: false, late: false };

  function load() {
    var w = health.write || 0;
    health = { ok: false, err: null, rows: 0, bad: 0, write: w, cut: false, late: false };
    return store.list().then(function (rows) {
      health.rows = rows.length;
      if (rows.truncated) health.cut = rows.truncated;
      return Promise.all(rows.map(function (r) {
        return crypt.decrypt(r.payload, aad(r.block_id))
          .then(function (html) { patches[r.block_id] = html; })
          .catch(function () { health.bad++; });   // не наш ключ или подменённый слот
      }));
    }).then(function () {
      loaded = true;
      health.ok = true;
      if (window.LIVEEDIT_TOOLATE && window.LIVEEDIT_TOOLATE()) {
        // Экран уже снят по таймауту. Накладывать патчи сейчас значит менять
        // цифры на глазах у зала, поэтому только предупреждаем.
        health.late = true;
        paint();
        report();
        return;
      }
      apply();
      paint();
      report();
    }).catch(function (e) {
      // Молчаливая деградация на цифрах сделки недопустима: показываем плашку,
      // а не console.warn, который на показе никто не увидит.
      console.warn('blockedit: патчи не загрузились', e);
      loaded = true;
      health.err = e.message || 'нет связи с хранилищем';
      paint();
      report();
    });
  }

  function save(id, html) {
    var was = patches[id];
    patches[id] = html;
    dirty++;
    return crypt.encrypt(html, aad(id))
      .then(function (p) { return store.put(id, p, author()); })
      .then(function () {
        flash('сохранено');
        if (health.write) { health.write = 0; report(); }   // расхождение с базой ушло
        if (window.VERSIONS_TOUCH) window.VERSIONS_TOUCH();
      })
      .catch(function (e) {
        // Карта обязана остаться равной базе. Иначе ближайший авто-снимок
        // зафиксирует редакцию, которой на сервере нет, и на другом экране
        // блок покажет шаблон без единого признака расхождения.
        if (was == null) delete patches[id]; else patches[id] = was;
        health.write = (health.write || 0) + 1;
        flash('НЕ сохранилось: ' + e.message, true);
        report();
      });
  }

  function reset(id, el) {
    delete patches[id];
    put(el, orig[id]);
    el.removeAttribute('data-le-patched');
    return store.drop(id).then(function () {
      flash('вернул шаблонный текст');
      if (window.VERSIONS_TOUCH) window.VERSIONS_TOUCH();
    }).catch(function (e) { flash('НЕ удалось убрать правку: ' + e.message, true); });
  }

  /* ---------- плашка состояния ----------
     Видна всем, включая зрителя без ?edit=1, и только когда есть о чём
     предупредить. Показывать шаблонные цифры вместо правленых молча нельзя. */

  var noteEl = null;
  function report() {
    var o = orphans().length;
    var bad = [];
    if (health.late) bad.push('правки пришли слишком поздно и НЕ наложены. Обновите страницу');
    if (health.cut) bad.push('правок в базе больше, чем загружено: показаны первые ' + health.cut);
    if (health.write) bad.push('правок не сохранилось на сервер: ' + health.write + '. На экране они есть, в базе нет');
    if (health.err) bad.push('правки не загрузились: ' + health.err + '. На экране шаблонный текст');
    else if (health.bad) bad.push(health.bad + ' из ' + health.rows + ' правок не открылись этим ключом');
    if (o) bad.push('правок без блока: ' + o + ' (текст в шаблоне переписан, правка осталась в базе)');
    if (!bad.length) { if (noteEl) { noteEl.remove(); noteEl = null; } return; }
    if (!noteEl) {
      noteEl = document.createElement('div');
      noteEl.className = 'le-warn';
      noteEl.setAttribute('role', 'status');
      noteEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(noteEl);
    }
    // textContent, а не innerHTML: сюда попадает тело ответа сервера, а этот
    // же модуль в двух шагах выше объявляет, что содержимому базы не доверяет
    noteEl.textContent = '';
    var sp = document.createElement('span');
    sp.textContent = bad.join('. ');
    var bt = document.createElement('button');
    bt.type = 'button';
    bt.textContent = 'Скрыть';
    bt.setAttribute('aria-label', 'Скрыть предупреждение');
    bt.onclick = function () { noteEl.remove(); noteEl = null; };
    noteEl.appendChild(sp);
    noteEl.appendChild(bt);
  }

  /* ---------- правка ---------- */

  function startEdit(el) {
    if (active === el) return;
    // В режиме просмотра старой версии в DOM лежит не текущий текст. Правка
    // здесь записала бы старую редакцию как новую и тихо откатила блок.
    if (window.VERSIONS_PREVIEWING && window.VERSIONS_PREVIEWING()) {
      flash('идёт просмотр старой версии, правка выключена', true);
      return;
    }
    if (active) stopEdit(true);
    active = el;
    beforeEdit = el.innerHTML;
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('aria-describedby', 'le-hint');
    el.classList.add('le-active');
    el.focus();
    // При входе с клавиатуры элемент уже был в фокусе, и caret в него не
    // встаёт сам: ввод уходил в никуда. При входе мышью каретку ставит клик,
    // поэтому трогаем выделение, только если оно вне блока.
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) {
      try {
        var rg = document.createRange();
        rg.selectNodeContents(el);
        rg.collapse(false);
        sel.removeAllRanges();
        sel.addRange(rg);
      } catch (e) { }
    }
    bar(el);
  }

  function stopEdit(commit) {
    if (!active) return;
    var el = active, id = el.getAttribute('data-le');
    el.removeAttribute('contenteditable');
    el.removeAttribute('aria-describedby');
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
    b.setAttribute('role', 'toolbar');
    b.setAttribute('aria-label', 'Правка блока');
    b.innerHTML = '<button type="button" data-a="ok">Сохранить</button>' +
      '<button type="button" data-a="no">Отмена</button>' +
      '<button type="button" data-a="rs">Шаблон</button>' +
      '<span class="le-hint" id="le-hint">Ctrl+Enter сохранить, Esc отменить</span>';
    document.body.appendChild(b);
    barEl = b;
    place();
    // мышью кнопки не забирают фокус у правимого блока, но с клавиатуры
    // до них надо доходить, поэтому гасим только мышиный mousedown
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

  var tb, dot, msg, state;
  function buildUI() {
    // тулбар общий с модулем версий: кто загрузился первым, тот и создал
    tb = document.querySelector('.le-tb');
    if (!tb) { tb = document.createElement('div'); tb.className = 'le-tb'; document.body.appendChild(tb); }
    // порядок в разметке совпадает с порядком на экране, иначе Tab идёт не туда
    tb.insertAdjacentHTML('afterbegin',
      '<span class="le-msg" id="le-msg" role="status" aria-live="polite" aria-atomic="true"></span>' +
      '<button type="button" class="le-btn" id="le-toggle" aria-pressed="false">' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 6l4 4" stroke="currentColor" stroke-width="1.6"/></svg>' +
      '<span>Правка</span><i class="le-dot" id="le-dot" aria-hidden="true"></i>' +
      '<span class="le-sr" id="le-state"></span></button>');
    dot = tb.querySelector('#le-dot');
    msg = tb.querySelector('#le-msg');
    state = tb.querySelector('#le-state');
    tb.querySelector('#le-toggle').addEventListener('click', toggle);
  }

  function flash(t, bad) {
    if (!msg) return;
    msg.textContent = '';
    msg.className = 'le-msg show' + (bad ? ' bad' : '');
    // пустой кадр перед записью, иначе повтор того же текста не переозвучится
    requestAnimationFrame(function () { msg.textContent = t; });
    clearTimeout(flash.t);
    flash.t = setTimeout(function () { msg.className = 'le-msg'; msg.textContent = ''; }, 2600);
  }

  function paint() {
    if (!dot) return;
    dot.className = 'le-dot' + (store.local ? ' local' : '') + (crypt.on ? ' enc' : '');
    var t = (store.local ? 'сохранение только в этот браузер' : 'сохранение на сервер') +
            (crypt.on ? ', шифрование включено' : ', без шифрования');
    dot.title = t;
    if (state) state.textContent = t;   // цветом состояние передавать нельзя
  }

  /* ---------- вход редактора ----------
     Форма живёт в auth.js: она нужна и модулю версий тоже. На сервере право
     писать проверяет Supabase, локально хватает кода.                        */

  function gateOpen() {
    var srv = !store.local && window.LiveAuth && window.LiveAuth.ready();
    if (!window.LiveAuth) { flash('модуль входа не загрузился', true); return; }
    window.LiveAuth.prompt({ server: srv, code: CODE }).then(function (ok) {
      if (!ok) return;
      unlocked = true;
      if (window.VERSIONS_PAINTAUTH) window.VERSIONS_PAINTAUTH();  // панель версий тоже разблокируется
      toggle();
    });
  }

  // Правимые блоки это абзацы и заголовки, они не фокусируемы сами по себе.
  // В режиме правки выдаём им tabindex, чтобы до правки можно было дойти с
  // клавиатуры, а не только мышью.
  function reach() {
    scan().forEach(function (el) {
      if (editing) el.setAttribute('tabindex', '0');
      else el.removeAttribute('tabindex');
    });
  }

  function toggle() {
    if (!editing && !unlocked) { gateOpen(); return; }
    editing = !editing;
    if (editing) askAuthor();
    document.documentElement.classList.toggle('le-on', editing);
    tb.querySelector('#le-toggle').setAttribute('aria-pressed', editing ? 'true' : 'false');
    reach();
    if (!editing) stopEdit(true);
    flash(editing ? 'режим правки: выберите текст мышью или клавишей Enter' : 'правка выключена');
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
      // вход в правку с клавиатуры: без этого блок доступен только мышью
      if (!active && editing && ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey) {
        var t = ev.target.closest && ev.target.closest('[data-le]');
        if (t) { ev.preventDefault(); startEdit(t); return; }
      }
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

    // Обычный fetch при выгрузке страницы браузер убивает, поэтому последняя
    // правка уходит через keepalive-запрос, а пользователя ещё и спрашиваем.
    addEventListener('beforeunload', function (ev) {
      if (!active) return;
      var el = active, id = el.getAttribute('data-le');
      var html = clean(el.innerHTML);
      if (html && html !== clean(beforeEdit)) {
        patches[id] = html;
        crypt.encrypt(html, aad(id))
          .then(function (p) { return store.putSync(id, p, author()); })
          .catch(function () { health.write = (health.write || 0) + 1; });
        ev.preventDefault();
        ev.returnValue = '';    // «правка ещё сохраняется»
      }
    });
  }

  /* ---------- стили ---------- */

  // Яркость фактической поверхности хоста. Ниже 0.4 считаем тёмной.
  function pickTheme() {
    var el = document.querySelector(ROOT_SEL) || document.body;
    var c = '';
    while (el && !c) {
      var bg = getComputedStyle(el).backgroundColor;
      if (bg && bg !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(bg)) c = bg;
      el = el.parentElement;
    }
    if (!c) c = getComputedStyle(document.documentElement).backgroundColor || 'rgb(255,255,255)';
    var m = (c.match(/\d+(\.\d+)?/g) || [255, 255, 255]).slice(0, 3).map(Number);
    var lum = m.map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var Y = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
    document.documentElement.setAttribute('data-le-theme', Y > 0.4 ? 'light' : 'dark');
  }

  function css() {
    var s = document.createElement('style');
    s.textContent = [
      // Семантические цвета объявлены токенами: на светлом фоне золото как
      // индикатор фокуса даёт 1.78:1, а красный и зелёный проваливают текст.
      // Тему выбираем по ФАКТИЧЕСКОМУ фону хоста, а не по prefers-color-scheme:
      // страница может быть жёстко тёмной, а система у зрителя светлой, и тогда
      // светлые токены сядут на тёмную поверхность и провалят контраст.
      ':root{--le-ok:#6BBF7B;--le-bad:#E8805F;--le-ring:var(--cta,#E3BD72);--le-edge:#6A6E78}',
      ':root[data-le-theme="light"]{--le-ok:#1B6B2C;--le-bad:#A83810;--le-ring:#8A6A1E;--le-edge:#767A84}',
      '.le-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
      '.le-tb{position:fixed;right:16px;bottom:16px;z-index:9400;display:flex;align-items:center;gap:10px;font-family:inherit}',
      '.le-btn{display:inline-flex;align-items:center;gap:8px;background:var(--card,#1E2025);border:1px solid var(--le-edge);color:var(--ink,#F3F2EF);border-radius:999px;padding:10px 16px;font:700 13px/1 inherit;cursor:pointer;box-shadow:0 8px 26px rgba(0,0,0,.4);transition:.15s}',
      '.le-btn:hover{border-color:var(--le-ring);transform:translateY(-1px)}',
      '.le-btn svg{width:17px;height:17px;display:block}',
      '.le-btn[aria-pressed="true"]{background:var(--cta,#E3BD72);color:var(--cta-ink,#1A1408);border-color:var(--cta,#E3BD72)}',
      '.le-dot{width:7px;height:7px;border-radius:50%;background:var(--le-ok);display:inline-block}',
      '.le-dot.local{background:var(--cta,#E3BD72);box-shadow:0 0 0 1px var(--le-edge)}',
      '.le-dot.enc{outline:2px solid var(--le-ok);outline-offset:2px}',
      '.le-msg{opacity:0;transform:translateY(4px);transition:.2s;background:var(--card,#1E2025);border:1px solid var(--line,#2E3036);color:var(--ink2,#B4B6B8);border-radius:999px;padding:8px 14px;font-size:12.5px;pointer-events:none;white-space:nowrap}',
      '.le-msg.show{opacity:1;transform:none}.le-msg.bad{color:var(--le-bad);border-color:var(--le-bad)}',
      '.le-on [data-le]{cursor:text;border-radius:6px;transition:box-shadow .12s,background .12s}',
      '.le-on [data-le]:hover{box-shadow:0 0 0 2px var(--le-ring);background:rgba(227,189,114,.06)}',
      '.le-on [data-le]:focus-visible{outline:2px solid var(--le-ring);outline-offset:3px}',
      '.le-on [data-le-patched]{box-shadow:inset 3px 0 0 var(--le-ok)}',
      '[data-le].le-active{outline:2px solid var(--le-ring);outline-offset:3px;background:rgba(227,189,114,.08)}',
      '.le-bar{position:fixed;z-index:9600;display:flex;align-items:center;gap:6px;background:var(--card,#1E2025);border:1px solid var(--le-edge);border-radius:999px;padding:6px 8px;box-shadow:0 10px 30px rgba(0,0,0,.5);font-family:inherit}',
      '.le-bar button{background:var(--card2,#26282E);border:1px solid var(--le-edge);color:var(--ink,#F3F2EF);border-radius:999px;padding:7px 13px;min-height:26px;font:700 12px/1 inherit;cursor:pointer}',
      '.le-bar button:hover{border-color:var(--le-ring)}',
      '.le-bar button[data-a="ok"]{background:var(--cta,#E3BD72);color:var(--cta-ink,#1A1408);border-color:var(--cta,#E3BD72)}',
      '.le-hint{color:var(--ink2,#B4B6B8);font-size:11.5px;padding:0 6px}',
      // вход редактора
      '.le-ov{position:fixed;inset:0;z-index:9800;background:rgba(5,5,5,.72);backdrop-filter:blur(6px);display:grid;place-items:center;padding:20px;font-family:inherit}',
      '.le-modal{background:var(--card,#1E2025);border:1px solid var(--le-edge);border-radius:20px;padding:26px;width:390px;max-width:100%;box-shadow:0 24px 70px rgba(0,0,0,.6)}',
      '.le-modal h2{color:var(--ink,#F3F2EF);font:800 20px/1.2 inherit;margin:0 0 8px}',
      '.le-modal p{color:var(--ink2,#B4B6B8);font-size:13.5px;line-height:1.5;margin:0 0 16px}',
      '.le-modal label{display:block;color:var(--ink2,#B4B6B8);font-size:12px;margin:0 0 5px}',
      '.le-modal input{width:100%;background:var(--bg2,#191B20);border:1px solid var(--le-edge);border-radius:13px;color:var(--ink,#F3F2EF);font-family:inherit;font-size:15px;padding:11px 13px;margin:0 0 13px}',
      '.le-modal input:focus{border-color:var(--le-ring);outline:none;box-shadow:0 0 0 3px rgba(227,189,114,.3)}',
      '.le-err{color:var(--le-bad);font-size:12.5px;min-height:1.2em;margin:0 0 10px}',
      '.le-row{display:flex;gap:8px;justify-content:flex-end}',
      '.le-primary,.le-ghost{border-radius:999px;padding:10px 18px;font:700 13px/1 inherit;cursor:pointer;font-family:inherit}',
      '.le-primary{background:var(--cta,#E3BD72);color:var(--cta-ink,#1A1408);border:1px solid var(--cta,#E3BD72)}',
      '.le-ghost{background:var(--card2,#26282E);color:var(--ink,#F3F2EF);border:1px solid var(--le-edge)}',
      '.le-tb :focus-visible,.le-bar :focus-visible,.le-modal :focus-visible,.le-warn :focus-visible{outline:2px solid var(--le-ring);outline-offset:2px}',
      // плашка состояния: видна и зрителю, поэтому сверху и поперёк
      '.le-warn{position:fixed;top:0;left:0;right:0;z-index:9750;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;background:var(--le-bad);color:#fff;font:600 13px/1.4 inherit;padding:10px 16px;text-align:center}',
      '.le-warn button{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.5);color:#fff;border-radius:999px;padding:6px 14px;font:700 12px/1 inherit;cursor:pointer}',
      '@media print{.le-tb,.le-bar,.le-ov{display:none}.le-warn{position:static;background:none;color:#000;border-bottom:2px solid #000}.le-warn button{display:none}[data-le].le-active{outline:none;background:none}.le-on [data-le-patched]{box-shadow:none}}',
      '@media(max-width:620px){.le-tb{right:10px;bottom:calc(10px + env(safe-area-inset-bottom))}' +
        '.le-hint{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;padding:0}}',
      '@media (prefers-reduced-motion:reduce){.le-btn,.le-msg,[data-le]{transition:none!important}.le-btn:hover{transform:none!important}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ---------- публичное ---------- */

  window.BLOCKEDIT_REFRESH = function () {
    if (!loaded) return;
    // Документ перерисован (переключили вкладку). Просмотр старой версии к
    // новому DOM отношения не имеет: оставить баннер значило бы показывать
    // чистый шаблон под обещанием старой версии.
    if (window.VERSIONS_PREVIEWING && window.VERSIONS_PREVIEWING() && window.VERSIONS_EXITPREVIEW) {
      window.VERSIONS_EXITPREVIEW();
    }
    apply();
    reach();          // после смены DOM новые блоки тоже должны быть доступны с клавиатуры
  };
  // перечитать сервер: нужно перед откатом, чтобы не стереть чужие правки,
  // сделанные пока эта вкладка стояла открытой
  window.BLOCKEDIT_RELOAD = function () {
    patches = {};       // иначе блоки, удалённые другой вкладкой, воскресают
    return load();
  };
  window.BLOCKEDIT_SETCRYPT = function (c) {
    crypt = c;
    storeCfg.crypt = c;
    patches = {};
    return load();
  };
  window.BLOCKEDIT_STATE = function () {
    return { v: 1, docKey: DOCKEY, blocks: JSON.parse(JSON.stringify(patches)) };
  };
  function byId(id) {
    var all = roots().querySelectorAll('[data-le]');
    for (var i = 0; i < all.length; i++) if (all[i].getAttribute('data-le') === id) return all[i];
    return null;   // перебором: id содержит / и #, селектору их пришлось бы экранировать
  }

  window.BLOCKEDIT_APPLY = function (state) {
    if (!unlocked) return Promise.reject(new Error('нет прав на запись'));
    var next = (state && state.blocks) || {};
    var jobs = [];
    Object.keys(patches).forEach(function (id) {
      if (!(id in next)) {
        jobs.push(store.drop(id));
        if (orig[id] != null) {
          var el = byId(id);
          if (el) { put(el, orig[id]); el.removeAttribute('data-le-patched'); }
        }
      }
    });
    Object.keys(next).forEach(function (id) {
      if (patches[id] !== next[id]) {
        jobs.push(crypt.encrypt(next[id], aad(id)).then(function (p) { return store.put(id, p, author()); }));
      }
    });
    var back = JSON.parse(JSON.stringify(patches));
    patches = JSON.parse(JSON.stringify(next));
    apply();
    report();
    // Откат меняет весь документ, а не один блок, поэтому предохранитель тут
    // нужнее, чем в save(): без него карта утверждала бы восстановленное
    // состояние, которого на сервере нет, и это попало бы в авто-снимок.
    return Promise.all(jobs.map(function (j) {
      return j.then(function () { return true; }, function () { return false; });
    })).then(function (res) {
      var fail = res.filter(function (x) { return !x; }).length;
      if (!fail) { flash('версия восстановлена'); return; }
      patches = back;
      apply();
      health.write = (health.write || 0) + fail;
      report();
      flash('откат НЕ прошёл: ' + fail + ' из ' + res.length + ' записей отклонено', true);
      throw new Error('откат не прошёл');
    });
  };
  // Только показать состояние в DOM. Ни хранилище, ни карта патчей не трогаются:
  // отсюда всегда можно вернуться к текущей версии.
  window.BLOCKEDIT_PREVIEW = function (state) {
    var next = (state && state.blocks) || {};
    scan().forEach(function (el) {
      var id = el.getAttribute('data-le');
      if (next[id] != null) {
        put(el, next[id]);
        el.setAttribute('data-le-patched', '1');
      } else if (orig[id] != null) {
        put(el, orig[id]);
        el.removeAttribute('data-le-patched');
      }
    });
    return Promise.resolve();
  };
  window.BLOCKEDIT_INFO = function () {
    // read-only: раньше здесь стоял apply(), а вызывают INFO часто
    return {
      total: roots().querySelectorAll('[data-le]').length,
      patched: Object.keys(patches).length, orphans: orphans(),
      local: store.local, crypt: crypt.on, health: health, canWrite: unlocked
    };
  };
  // Выгрузка расшифрованной карты патчей и заголовков версий. Без неё текст
  // документа существует ровно в одном месте, и любая потеря базы окончательна.
  window.BLOCKEDIT_EXPORT = function () {
    return {
      docKey: DOCKEY, at: new Date().toISOString(),
      orig: JSON.parse(JSON.stringify(orig)),
      blocks: JSON.parse(JSON.stringify(patches))
    };
  };

  /* ---------- старт ---------- */

  function init() {
    if (UI) { css(); pickTheme(); buildUI(); bindOnce(); }
    else { var s = document.createElement('style'); s.textContent = warnCss(); document.head.appendChild(s); }
    paint();
    if (store.local) {
      unlocked = !CODE;                 // локально писать некуда, кроме своего браузера
    } else if (window.LiveAuth && CFG.storage && CFG.storage.url) {
      window.LiveAuth.init({ url: CFG.storage.url, key: CFG.storage.key });
      unlocked = window.LiveAuth.can(); // токен мог сохраниться в этой вкладке
    }
    // Ждём ключ - не грузим ничего: бесключевой load() набил бы карту
    // шифротекстом и, что хуже, отрапортовал бы готовность, из-за чего гейт
    // снимал парольный экран до наложения правок.
    if (CFG.awaitKey && !crypt.on) return;
    load();
  }
  function warnCss() {
    return '.le-warn{position:fixed;top:0;left:0;right:0;z-index:9750;display:flex;gap:12px;align-items:center;' +
      'justify-content:center;flex-wrap:wrap;background:#A83810;color:#fff;font:600 13px/1.4 sans-serif;padding:10px 16px;text-align:center}' +
      '.le-warn button{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.5);color:#fff;border-radius:999px;padding:6px 14px;font:700 12px/1 inherit;cursor:pointer}' +
      '@media print{.le-warn{position:static;background:none;color:#000;border-bottom:2px solid #000}.le-warn button{display:none}}';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
