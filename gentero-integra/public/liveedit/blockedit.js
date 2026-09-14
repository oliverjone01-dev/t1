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
  // Режим показа. Панелей нет и в обычном режиме зрителя, но там остаётся
  // диагностика на случай, когда на экране НЕ тот текст. Во время показа на
  // большом экране красная полоса поперёк слайда дороже любой диагностики:
  // человек по ней ничего сделать не может, а вопрос задаст вслух. То же
  // касается страницы, отправленной контрагенту: получатель коммерческого
  // предложения не должен читать от самой страницы, что цифры на ней могут
  // быть шаблонными. Здесь модуль молчит и пишет только в консоль.
  //
  // Оговорка важнее самого режима: у того, кто открыл страницу на правку,
  // диагностика остаётся всегда. Прятать её от редактора незачем, а вот
  // редактировать вслепую по неоткрывшейся базе он не должен.
  var SHOW = CFG.show === true || /[?&]show=1(&|$)/.test(location.search);

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

  var SEEN = 'liveedit:seen:' + DOCKEY;
  var health = { ok: false, err: null, rows: 0, bad: 0, write: 0, cut: false, late: false, legacy: 0, applied: 0 };
  var legacyIds = [];      // патчи, записанные до привязки шифра к слоту
  var unread = [];         // строки, не открывшиеся текущим ключом
  var altCrypts = [];      // ключи прошлых сборок

  function load() {
    var w = health.write || 0;
    health = { ok: false, err: null, rows: 0, bad: 0, write: w, cut: false, late: false, legacy: 0 };
    legacyIds = [];
    return store.list().then(function (rows) {
      health.rows = rows.length;
      if (rows.truncated) health.cut = rows.truncated;
      return Promise.all(rows.map(function (r) {
        return crypt.decrypt(r.payload, aad(r.block_id))
          .then(function (html) { patches[r.block_id] = html; })
          .catch(function () {
            // Патчи, записанные до появления AAD, открываются без неё. Терять
            // из-за смены формата уже сохранённый текст нельзя, поэтому
            // читаем по-старому и помечаем строку на перезапись.
            return crypt.decrypt(r.payload)
              .then(function (html) {
                patches[r.block_id] = html;
                legacyIds.push(r.block_id);
                health.legacy++;
              })
              .catch(function () {
                // Ключ выводится из соли страницы, а до стабилизации соли она
                // менялась на каждой сборке. Такие строки открываются ключом
                // той сборки, при которой их сохранили.
                unread.push(r);
                health.bad++;
                return tryAlt(r);
              });
          });
      }));
    }).then(function () {
      loaded = true;
      health.ok = true;
      // помним, что для этого документа правки существуют: только тогда есть
      // смысл тревожить зрителя красной полосой при следующем сбое
      if (health.rows) { try { localStorage.setItem(SEEN, '1'); } catch (e) { } }
      if (window.LIVEEDIT_TOOLATE && window.LIVEEDIT_TOOLATE()) {
        // Экран уже снят по таймауту. Накладывать патчи сейчас значит менять
        // цифры на глазах у зала, поэтому только предупреждаем.
        health.late = true;
        paint();
        report();
        return;
      }
      health.applied = apply().applied;
      paint();
      report();
      migrate();
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

  // Перезапись патчей старого формата. Требует прав, поэтому запускается
  // после загрузки и повторно после входа редактора.
  function migrate() {
    if (!legacyIds.length || !unlocked) return Promise.resolve();
    var ids = legacyIds.slice();
    return Promise.all(ids.map(function (id) {
      return crypt.encrypt(patches[id], aad(id))
        .then(function (p) { return store.put(id, p, author()); })
        .then(function () { return true; }, function () { return false; });
    })).then(function (res) {
      var ok = res.filter(Boolean).length;
      if (!ok) return;
      legacyIds = legacyIds.filter(function (id) { return ids.indexOf(id) < 0; });
      health.legacy = Math.max(0, health.legacy - ok);
      report();
      flash('правок переведено в новый формат: ' + ok);
    });
  }

  // Попытка открыть строку ключами прошлых сборок.
  function tryAlt(r) {
    if (!altCrypts.length) return;
    var i = 0;
    function step() {
      if (i >= altCrypts.length) return;
      var c = altCrypts[i++];
      return c.decrypt(r.payload, aad(r.block_id))
        .catch(function () { return c.decrypt(r.payload); })
        .then(function (html) {
          patches[r.block_id] = html;
          legacyIds.push(r.block_id);
          health.legacy++;
          health.bad = Math.max(0, health.bad - 1);
          unread = unread.filter(function (x) { return x !== r; });
        })
        .catch(step);
    }
    return step();
  }

  // Ключи прошлых сборок приходят из гейта позже основного, чтобы не задерживать
  // показ документа. Пробуем ими всё, что не открылось.
  window.BLOCKEDIT_ALTKEYS = function (crypts) {
    altCrypts = crypts || [];
    if (!unread.length || !altCrypts.length) return Promise.resolve(0);
    var todo = unread.slice();
    return Promise.all(todo.map(tryAlt)).then(function () {
      health.applied = apply().applied;
      report();
      migrate();
      var got = todo.length - unread.length;
      if (got) flash('прочитано правок прежним ключом: ' + got);
      return got;
    });
  };

  function save(id, html) {
    var was = patches[id];
    patches[id] = html;
    dirty++;
    return crypt.encrypt(html, aad(id))
      .then(function (p) { return store.put(id, p, author()); })
      .then(function () {
        flash('сохранено');
        if (health.write) { health.write = 0; report(); }   // расхождение с базой ушло
        // Авто-снимок только с полной картой. Снимок неполной карты выглядит
        // как обычная версия, а откат к нему сносит с сервера всё, чего в нём
        // нет, то есть все правки, не успевшие загрузиться.
        if (!health.err && window.VERSIONS_TOUCH) window.VERSIONS_TOUCH();
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
  function seen() { try { return localStorage.getItem(SEEN) === '1'; } catch (e) { return false; } }
  // «Хранилища ещё нет» это несделанная настройка, а не поломка документа.
  // Такое сообщение адресовано редактору, зрителю оно ничего не говорит.
  function notSetUp(msg) { return /does not exist|PGRST205|schema cache|404/i.test(msg || ''); }

  function report() {
    var o = orphans().length;
    var bad = [];
    if (UI && health.legacy) bad.push('правок в прежнем формате или прежним ключом: ' + health.legacy +
      '. Текст на экране верный, войдите как редактор, и они перезапишутся сами');
    if (health.late) bad.push('правки пришли слишком поздно и НЕ наложены. Обновите страницу');
    if (health.cut) bad.push('правок в базе больше, чем загружено: показаны первые ' + health.cut);
    if (health.write) bad.push('правок не сохранилось на сервер: ' + health.write + '. На экране они есть, в базе нет');
    if (health.err) {
      // Зрителю про сбой загрузки говорим, только если для этого документа
      // правки хоть раз приходили: иначе терять нечего и пугать незачем.
      if (UI && notSetUp(health.err)) bad.push('хранилище правок ещё не создано: выполните schema.sql в Supabase');
      else if (UI || seen()) bad.push('правки не загрузились: ' + health.err + '. На экране шаблонный текст');
    }
    else if (UI && health.bad) bad.push(health.bad + ' из ' + health.rows + ' правок не открылись этим ключом');
    // Только редактору: сирота означает, что на экране лежит текст из шаблона,
    // то есть базовая редакция. Зритель по этой строке не может ничего, кроме
    // как встревожиться.
    if (UI && o) bad.push('правки не встали на место: ' + o +
      '. Откройте историю версий и перенесите их вручную');
    if (SHOW && !UI) {
      if (bad.length) console.warn('liveedit: ' + bad.join('. '));
      if (noteEl) { noteEl.hidden = true; warnHeight(); }
      return;
    }
    if (!bad.length) { if (noteEl) { noteEl.hidden = true; warnHeight(); } return; }
    noteEl = warnBox();
    // textContent, а не innerHTML: сюда попадает тело ответа сервера, а этот
    // же модуль в двух шагах выше объявляет, что содержимому базы не доверяет
    noteEl.textContent = '';
    var sp = document.createElement('span');
    sp.textContent = bad.join('. ');
    noteEl.appendChild(sp);
    // Отказ загрузки лечится повтором, и кнопка обязана быть в плашке: без
    // неё единственным выходом остаётся перезагрузка страницы, а она на
    // зашифрованном документе означает ввод пароля заново.
    if (health.err) {
      var rt = document.createElement('button');
      rt.type = 'button';
      rt.className = 'le-b';
      rt.textContent = 'Загрузить снова';
      rt.onclick = function () {
        rt.disabled = true;
        rt.textContent = 'Загружаю...';
        health.err = null;
        load().then(function () {
          if (!health.err) flash('правки загрузились');
        });
      };
      noteEl.appendChild(rt);
    }
    var bt = document.createElement('button');
    bt.type = 'button';
    bt.className = 'le-b';
    bt.textContent = 'Скрыть';
    bt.setAttribute('aria-label', 'Скрыть предупреждение');
    bt.onclick = function () { noteEl.hidden = true; warnHeight(); };
    noteEl.appendChild(bt);
    noteEl.hidden = false;
    warnHeight();
  }

  // Живая область обязана существовать в дереве доступности ДО того, как в
  // ней появится текст: иначе экранный диктор не объявит появление, потому
  // что для него область и сообщение возникли одновременно.
  var warnEl = null;
  function warnBox() {
    if (warnEl) return warnEl;
    warnEl = document.createElement('div');
    warnEl.className = 'le-warn le-ui';
    warnEl.setAttribute('role', 'status');
    warnEl.setAttribute('aria-live', 'polite');
    warnEl.hidden = true;
    (document.body || document.documentElement).appendChild(warnEl);
    addEventListener('resize', warnHeight);
    return warnEl;
  }

  // Высота плашки уезжает в переменную страницы. По ней панель версий и
  // панель правки блока отступают сверху: пока плашка просто висела поверх
  // всего с самым большим z-index, она закрывала шапку панели вместе с
  // крестиком, и панель нельзя было закрыть мышью вообще.
  function warnHeight() {
    var h = (warnEl && !warnEl.hidden) ? warnEl.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty('--le-warn-h', Math.round(h) + 'px');
    if (barEl && barEl.__place) barEl.__place();
  }

  /* ---------- правка ---------- */

  function startEdit(el) {
    if (active === el) return;
    if (health.err) { flash('правки не загрузились, править нельзя', true); return; }
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
    // Пока блок правится, он поле ввода, а не кнопка. Роль «button» на
    // contenteditable заставляет диктор молчать о том, что текст можно набирать.
    el.setAttribute('role', 'textbox');
    el.setAttribute('aria-label', 'Текст блока');
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
    el.removeAttribute('role');
    el.classList.remove('le-active');
    if (editing) el.setAttribute('aria-label', 'Править блок');
    active = null;
    // Фокус возвращается на сам блок ДО удаления панели: нажатие кнопки
    // убивало элемент, на котором стоял фокус, и он падал в body, откуда Tab
    // начинал обход страницы заново.
    var inBar = barEl && barEl.contains(document.activeElement);
    killBar();
    if (inBar && el.isConnected) { try { el.focus(); } catch (e) { } }
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
    b.className = 'le-bar le-ui';
    b.setAttribute('role', 'group');
    b.setAttribute('aria-label', 'Правка блока');
    b.innerHTML = '<button type="button" class="le-b le-b-main" data-a="ok">Сохранить</button>' +
      '<button type="button" class="le-b" data-a="no">Отмена</button>' +
      // Существительное «Шаблон» не говорило, что кнопка делает, а делает она
      // безвозвратное: удаляет правку с сервера. Теперь глагол и подтверждение.
      '<button type="button" class="le-b le-b-bad" data-a="rs">Убрать правку</button>' +
      '<span class="le-hint" id="le-hint">Ctrl+Enter сохранить, Esc отменить</span>';
    // Панель встаёт сразу после правимого блока, а не в конец body: иначе Tab
    // из блока уходил гулять по всей странице и до кнопок не доходил вовсе.
    if (el.parentNode) el.parentNode.insertBefore(b, el.nextSibling);
    else document.body.appendChild(b);
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
      else if (a === 'rs') {
        if (!confirm('Убрать правку и вернуть текст из шаблона?\n' +
          'Правка удалится с сервера. Достать её потом можно будет только откатом к версии.')) return;
        var e2 = active, id = e2.getAttribute('data-le'); stopEdit(false); reset(id, e2);
      }
    });
    function place() {
      var r = el.getBoundingClientRect();
      // Верхняя граница считается от нижнего края плашки состояния. Иначе у
      // блока в начале страницы панель прижималась к top:8 и оказывалась под
      // плашкой: кнопки «Сохранить», «Отмена» и «Шаблон» переставали
      // нажиматься мышью вовсе.
      // Проект объявляет --le-safe-top высотой своей фиксированной шапки.
      // Без этого панель правки для блока в начале страницы уезжала под
      // шапку хоста, и её кнопки переставали нажиматься мышью.
      var top = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--le-safe-top'), 10) || 8;
      b.style.top = Math.max(top, r.top - 44) + 'px';
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
    if (!tb) { tb = document.createElement('div'); tb.className = 'le-tb le-ui'; document.body.appendChild(tb); }
    // порядок в разметке совпадает с порядком на экране, иначе Tab идёт не туда
    tb.insertAdjacentHTML('afterbegin',
      '<span class="le-msg" id="le-msg" role="status" aria-live="polite" aria-atomic="true"></span>' +
      '<button type="button" class="le-btn" id="le-toggle" aria-pressed="false">' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 6l4 4" stroke="currentColor" stroke-width="1.6"/></svg>' +
      '<span>Правка</span><i class="le-dot" id="le-dot" aria-hidden="true"></i>' +
      '</button><span class="le-sr" id="le-state"></span>');
    dot = tb.querySelector('#le-dot');
    msg = tb.querySelector('#le-msg');
    state = tb.querySelector('#le-state');
    // Состояние вынесено из кнопки наружу и подключено описанием: внутри
    // кнопки оно попадало в её имя, и диктор читал «Правка сохранение только
    // в этот браузер, без шифрования» вместо «Правка».
    var tg = tb.querySelector('#le-toggle');
    tg.setAttribute('aria-describedby', 'le-state');
    tg.addEventListener('click', toggle);
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
    // Отказ загрузки это состояние тулбара, а не только плашки: плашку можно
    // закрыть, а править после этого всё равно нельзя.
    dot.className = 'le-dot' + (health.err ? ' off' : '') +
      (store.local ? ' local' : '') + (crypt.on ? ' enc' : '');
    var t = health.err
      ? 'правки не загрузились, правка недоступна'
      : (store.local ? 'сохранение только в этот браузер' : 'сохранение на сервер') +
        (crypt.on ? ', шифрование включено' : ', без шифрования');
    dot.title = t;
    if (state) state.textContent = t;   // цветом состояние передавать нельзя
    var tg = tb && tb.querySelector('#le-toggle');
    if (tg) tg.disabled = !!health.err;
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
      migrate();
      toggle();
    });
  }

  // Правимые блоки это абзацы и заголовки, они не фокусируемы сами по себе.
  // В режиме правки выдаём им tabindex, чтобы до правки можно было дойти с
  // клавиатуры, а не только мышью.
  function reach() {
    scan().forEach(function (el) {
      if (editing) {
        el.setAttribute('tabindex', '0');
        // Без имени и роли диктор читает обычный абзац и молчит о том, что по
        // нему можно нажать. Роль ставим только на время режима правки: в
        // режиме показа абзац обязан остаться абзацем.
        if (el !== active) {
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', 'Править блок');
        }
      } else {
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
        el.removeAttribute('aria-label');
      }
    });
  }

  function toggle() {
    if (!editing && health.err) {
      flash('правки не загрузились, править нельзя: на экране шаблон, а не ваш текст', true);
      return;
    }
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
  // Тему и токены держит theme.js: он же нужен модулю версий, подключаемому
  // отдельно, и держать две копии измерения фона незачем.
  function pickTheme() {
    if (window.LiveTheme) window.LiveTheme.apply(ROOT_SEL);
  }

  function css() {
    if (document.getElementById('le-blockedit-css')) return;
    var s = document.createElement('style');
    s.id = 'le-blockedit-css';
    // Палитра, типографика и форма кнопки живут в theme.js. Здесь только
    // раскладка и то, что относится к правке текста в самом документе.
    s.textContent = [
      /* ---------- нижний тулбар ---------- */

      '.le-tb{position:fixed;right:16px;bottom:calc(16px + var(--le-warn-h,0px));z-index:9400;',
      'display:flex;align-items:center;gap:8px;',
      'font-family:inherit;transition:right .3s var(--le-ease)}',
      // Тулбар крупнее прочих кнопок модуля: это единственное, что видно на
      // странице до открытия панели, и попадать в него надо не целясь.
      '.le-btn{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 16px;',
      'background:var(--le-surface-2);border:1px solid var(--le-edge);color:var(--le-text);',
      'border-radius:999px;font-family:inherit;font-size:13px;font-weight:700;line-height:1;',
      'white-space:nowrap;cursor:pointer;box-shadow:var(--le-shadow);',
      'transition:border-color .15s var(--le-ease),transform .15s var(--le-ease)}',
      '.le-btn:hover{border-color:var(--le-text-2);transform:translateY(-1px)}',
      '.le-btn[disabled]{cursor:not-allowed;border-style:dashed;color:var(--le-text-2);transform:none}',
      '.le-btn svg{width:16px;height:16px;display:block;flex:none}',
      '.le-btn[aria-pressed="true"]{background:var(--le-a);color:var(--le-a-ink);border-color:var(--le-a)}',

      // Индикатор режима. Цвет здесь не единственный носитель смысла:
      // у локального режима ещё и кольцо, у шифрованного вторая обводка.
      '.le-dot{width:7px;height:7px;border-radius:50%;background:var(--le-ok);display:inline-block;flex:none}',
      '.le-dot.local{background:var(--le-bad);box-shadow:0 0 0 2px var(--le-surface-2),0 0 0 3px var(--le-bad)}',
      '.le-dot.enc{outline:2px solid currentColor;outline-offset:2px}',
      // Недоступность передаётся формой: заливки нет, остаётся только кольцо.
      '.le-dot.off{background:transparent;box-shadow:inset 0 0 0 2px var(--le-bad)}',

      '.le-msg{opacity:0;transform:translateY(4px);transition:.2s var(--le-ease);background:var(--le-surface-2);',
      'border:1px solid var(--le-line);color:var(--le-text-2);border-radius:999px;padding:8px 14px;',
      'font-family:inherit;font-size:12px;pointer-events:none;white-space:nowrap}',
      '.le-msg.show{opacity:1;transform:none}',
      '.le-msg.bad{color:var(--le-bad);border-color:var(--le-bad)}',

      /* ---------- правимый блок в документе ---------- */

      // Подсветка блока строится на обводке, а не на заливке: заливка
      // непредсказуемо смешивается с фоном чужой страницы.
      '.le-on [data-le]{cursor:text;border-radius:6px;transition:box-shadow .12s var(--le-ease)}',
      '.le-on [data-le]:hover{box-shadow:0 0 0 2px var(--le-a)}',
      '.le-on [data-le]:focus-visible{outline:2px solid var(--le-a);outline-offset:3px}',
      '.le-on [data-le-patched]{box-shadow:inset 3px 0 0 var(--le-ok)}',
      '[data-le].le-active{outline:2px solid var(--le-a);outline-offset:3px}',

      /* ---------- панель над правимым блоком ---------- */

      '.le-bar{position:fixed;z-index:9600;display:flex;align-items:center;gap:6px;',
      'background:var(--le-surface-2);border:1px solid var(--le-edge);border-radius:999px;',
      'padding:6px 8px;box-shadow:var(--le-shadow);font-family:inherit}',
      '.le-hint{color:var(--le-text-3);font-family:inherit;font-size:11px;padding:0 6px}',

      /* ---------- вход редактора ---------- */

      '.le-ov{position:fixed;inset:0;z-index:9800;background:rgba(6,6,8,.72);backdrop-filter:blur(6px);',
      'display:grid;align-items:start;justify-items:center;overflow:auto;padding:20px;font-family:inherit}',
      '.le-ov>*{margin:auto 0}',
      '.le-modal{background:var(--le-surface);border:1px solid var(--le-line);border-radius:18px;',
      'padding:24px;width:390px;max-width:100%;box-shadow:var(--le-shadow)}',
      '.le-modal h2{font-family:inherit;font-size:18px;font-weight:700;line-height:1.25;color:var(--le-text);margin:0 0 8px}',
      '.le-modal p{font-family:inherit;font-size:13px;line-height:1.5;color:var(--le-text-2);margin:0 0 16px}',
      '.le-modal label{display:block;font-family:inherit;font-size:12px;color:var(--le-text-2);margin:0 0 5px}',
      '.le-modal .le-in{width:100%;margin:0 0 12px;font-size:15px}',
      '.le-err{color:var(--le-bad);font-family:inherit;font-size:12.5px;min-height:1.2em;margin:0 0 10px}',
      '.le-row{display:flex;gap:8px;justify-content:flex-end}',
      '.le-row .le-b{min-height:38px;padding:0 18px;font-size:13px}',

      /* ---------- плашка состояния ---------- */

      // Её видит и зритель, поэтому она поперёк страницы и не зависит от
      // палитры модуля: сообщение о поломке обязано читаться на любой теме.
      '.le-warn{position:fixed;bottom:0;left:0;right:0;z-index:9450;padding-bottom:calc(10px + env(safe-area-inset-bottom,0));display:flex;gap:12px;align-items:center;',
      'justify-content:center;flex-wrap:wrap;background:var(--le-alarm,#A8351C);color:var(--le-alarm-ink,#fff);font-family:inherit;',
      'font-size:13px;font-weight:600;line-height:1.4;padding:10px 16px;text-align:center}',
      '.le-warn .le-b{background:rgba(0,0,0,.22);border-color:rgba(255,255,255,.5);color:#fff}',
      '.le-warn .le-b:hover{border-color:#fff}',

      '@media print{.le-tb,.le-bar,.le-ov{display:none}',
      '.le-warn{position:static;background:none;color:#000;border-bottom:2px solid #000}',
      '.le-warn .le-b{display:none}[data-le].le-active{outline:none}',
      '.le-on [data-le-patched]{box-shadow:none}}',
      '@media(max-width:620px){.le-tb{right:10px;bottom:calc(10px + var(--le-warn-h,0px) + env(safe-area-inset-bottom))}',
      '.le-hint{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);',
      'white-space:nowrap;padding:0}}',
      '@media (prefers-reduced-motion:reduce){.le-tb,.le-btn,.le-msg,[data-le]{transition:none!important}',
      '.le-btn:hover{transform:none!important}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ---------- публичное ---------- */

  window.BLOCKEDIT_REFRESH = function () {
    if (!loaded) return;
    // report() в конце обязателен: сироты фильтруются по data-doc корня, а
    // вкладка его переписывает. Без пересчёта плашка описывала документ,
    // которого на экране уже нет, числом из прошлой вкладки.
    // Документ перерисован (переключили вкладку). Просмотр старой версии к
    // новому DOM отношения не имеет: оставить баннер значило бы показывать
    // чистый шаблон под обещанием старой версии.
    if (window.VERSIONS_PREVIEWING && window.VERSIONS_PREVIEWING() && window.VERSIONS_EXITPREVIEW) {
      window.VERSIONS_EXITPREVIEW();
    }
    health.applied = apply().applied;
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
    health.applied = apply().applied;
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
      health.applied = apply().applied;
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
  // Сколько правок лежит в ЭТОМ браузере. Режим ?store=local пишет только
  // сюда, и человек, правивший документ в нём, на сервере ничего не увидит.
  window.BLOCKEDIT_LOCAL_COUNT = function () {
    try {
      var raw = localStorage.getItem('liveedit:blocks:' + DOCKEY);
      return raw ? (JSON.parse(raw) || []).length : 0;
    } catch (e) { return 0; }
  };

  // Перенос правок из браузера на сервер. Читаем локальные строки тем же
  // ключом (со старым форматом тоже), пишем на сервер уже с привязкой к слоту.
  window.BLOCKEDIT_IMPORT_LOCAL = function () {
    if (!unlocked) return Promise.reject(new Error('сначала войдите как редактор'));
    if (store.local) return Promise.reject(new Error('страница и так открыта в локальном режиме'));
    var local = window.LiveStore.blocks({ docKey: DOCKEY, storage: 'local' });
    return local.list().then(function (rows) {
      if (!rows.length) return { total: 0, ok: 0 };
      return Promise.all(rows.map(function (r) {
        return crypt.decrypt(r.payload, aad(r.block_id))
          .catch(function () { return crypt.decrypt(r.payload); })
          .then(function (html) {
            patches[r.block_id] = html;
            return crypt.encrypt(html, aad(r.block_id))
              .then(function (p) { return store.put(r.block_id, p, r.author || author()); })
              .then(function () { return true; });
          })
          .catch(function () { return false; });
      })).then(function (res) {
        var ok = res.filter(Boolean).length;
        health.applied = apply().applied;
        report();
        return { total: rows.length, ok: ok };
      });
    });
  };

  window.BLOCKEDIT_INFO = function () {
    // read-only: раньше здесь стоял apply(), а вызывают INFO часто
    return {
      total: roots().querySelectorAll('[data-le]').length,
      loaded: Object.keys(patches).length, patched: health.applied || 0, orphans: orphans(),
      local: store.local, crypt: crypt.on, health: health, canWrite: unlocked,
      docKey: DOCKEY, inThisBrowser: window.BLOCKEDIT_LOCAL_COUNT()
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
    pickTheme();
    if (UI) { css(); buildUI(); bindOnce(); }
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
    return '.le-warn{position:fixed;bottom:0;left:0;right:0;z-index:9450;padding-bottom:calc(10px + env(safe-area-inset-bottom,0));display:flex;gap:12px;align-items:center;' +
      'justify-content:center;flex-wrap:wrap;background:#A8351C;color:#fff;font-family:sans-serif;' +
      'font-size:13px;font-weight:600;line-height:1.4;padding:10px 16px;text-align:center}' +
      '.le-warn button{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.5);color:#fff;' +
      'border-radius:999px;padding:6px 14px;font-family:inherit;font-size:12px;font-weight:700;' +
      'line-height:1;min-height:32px;cursor:pointer}' +
      '.le-warn button:focus-visible{outline:2px solid #fff;outline-offset:0;box-shadow:0 0 0 4px #0A0B0D}' +
      '@media(max-width:620px){.le-warn{font-size:12px;padding:8px 12px}}' +
      '@media print{.le-warn{position:static;background:none;color:#000;border-bottom:2px solid #000}.le-warn button{display:none}}';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
