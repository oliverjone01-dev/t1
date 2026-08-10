/* ============================================================================
   versions.js - история версий документа с откатом, по образцу Google Docs.

   Модуль ничего не знает о конкретном проекте. Он умеет одно: снять снимок
   состояния, показать список снимков в своей панели, дать сравнить и вернуть.
   Что считать состоянием - решает хост через две функции.

   Конфиг: window.VERSIONS = {
     docKey,                       // ключ документа, отдельная история
     storage,                      // 'local' | {type:'supabase', url, key}
     crypt,                        // объект LiveCrypt, необязателен
     author,                       // подпись, иначе спросит один раз
     getState: function(){...},    // -> любой JSON-сериализуемый объект
     setState: function(s, opts){} // opts.preview = true: только показать
     autoEvery                     // авто-снимок каждые N правок (0 = выключить)
   }

   Публичные хуки:
     window.VERSIONS_SNAP(label)   - снять версию программно
     window.VERSIONS_TOUCH()       - «была правка», для авто-снимков
     window.VERSIONS_FLUSH()       - снять версию, если есть несохранённые правки
     window.VERSIONS_SETCRYPT(c)   - отдать ключ, когда он появился
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.VERSIONS || {};
  var DOCKEY = CFG.docKey || (location.pathname.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'page');
  var AUTO = CFG.autoEvery == null ? 8 : CFG.autoEvery;

  if (!window.LiveCrypt || !window.LiveStore) {
    console.error('versions: не загрузились crypt.js или store.js, история выключена');
    return;
  }
  var crypt = CFG.crypt || window.LiveCrypt.off;
  var storeCfg = { docKey: DOCKEY, storage: CFG.storage, crypt: crypt };
  var store = window.LiveStore.versions(storeCfg);

  var rows = [];            // {id,label,author,created_at,state}
  var touched = 0;
  var previewing = null;    // id версии в режиме просмотра
  var liveState = null;     // состояние до входа в просмотр
  var offset = 0, more = false, hidden = 0, legacy = 0;
  var altCrypts = [];

  // Перебор ключей прошлых сборок для одного снимка.
  function altOpen(r) {
    var i = 0;
    function step() {
      if (i >= altCrypts.length) { r.state = null; return r; }
      var c = altCrypts[i++];
      return c.decrypt(r.snapshot, DOCKEY + '|version')
        .catch(function () { return c.decrypt(r.snapshot); })
        .then(function (j) { r.state = JSON.parse(j); r.legacy = true; return r; })
        .catch(step);
    }
    return Promise.resolve().then(step);
  }
  var panel, list, banner, btn;

  function author() {
    var a = CFG.author || localStorage.getItem('liveedit:author') || '';
    if (a) return a;
    a = (prompt('Как подписывать версии?', '') || '').trim().slice(0, 40);
    if (a) localStorage.setItem('liveedit:author', a);
    return a || 'без подписи';
  }

  function fmt(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return iso || '';
    var D = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][d.getDay()];
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() +
      ', ' + D + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  // Русское склонение по числу. Без него панель писала «отличий: 1» и
  // «блоков: 2», и строка читалась как машинный лог, а не как предложение.
  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  // «Давно ли» словами. Дата отвечает на вопрос «когда», но на вопрос
  // «успела ли она устареть» по дате приходится считать в уме.
  function ago(iso) {
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 0) return '';
    if (m < 2) return 'только что';
    if (m < 60) return m + ' ' + plural(m, 'минуту', 'минуты', 'минут') + ' назад';
    var h = Math.round(m / 60);
    if (h < 24) return h + ' ' + plural(h, 'час', 'часа', 'часов') + ' назад';
    var d = Math.round(h / 24);
    if (d === 1) return 'вчера';
    if (d < 8) return d + ' ' + plural(d, 'день', 'дня', 'дней') + ' назад';
    return '';                       // дальше точная дата информативнее
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // Разбор в inert-документе: сюда приходит содержимое базы, а в отсоединённом
  // узле живого документа <img onerror> в Chrome выполняется.
  function plain(html) {
    var d = document.implementation.createHTMLDocument('');
    var b = d.createElement('div');
    b.innerHTML = html || '';
    return (b.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function count(state) {
    return state && state.blocks ? Object.keys(state.blocks).length : 0;
  }

  /* ---------- хранилище ---------- */

  var PAGE = 40;

  // append = дозагрузка следующей страницы. Без неё историю можно погасить,
  // навалив в таблицу мусорных строк со свежей датой: они вытеснят настоящие
  // версии из выборки, а панель напишет «версий пока нет».
  function load(append) {
    if (!append) { offset = 0; hidden = 0; }
    return store.list(offset, PAGE).then(function (raw) {
      more = raw.length === PAGE;
      offset += raw.length;
      return Promise.all(raw.map(function (r) {
        return crypt.decrypt(r.snapshot, DOCKEY + '|version')
          .then(function (j) { r.state = JSON.parse(j); return r; })
          // снимки, снятые до привязки шифра к слоту, открываются без неё
          .catch(function () {
            return crypt.decrypt(r.snapshot)
              .then(function (j) { r.state = JSON.parse(j); r.legacy = true; return r; })
              .catch(function () { return altOpen(r); });   // ключ прошлой сборки
          });
      }));
    }).then(function (out) {
      var good = out.filter(function (r) { return r.state; });
      hidden += out.length - good.length;
      legacy = good.filter(function (r) { return r.legacy; }).length;
      rows = append ? rows.concat(good) : good;
      render();
      return rows;
    }).catch(function (e) {
      console.warn('versions: список не загрузился', e);
      note('история не загрузилась: ' + (e.message || e), true);
    });
  }

  function snap(label, silent) {
    if (!CFG.getState) return Promise.resolve();
    var st = CFG.getState();
    if (rows.length && JSON.stringify(rows[0].state) === JSON.stringify(st)) {
      if (!silent) note('состояние не менялось, версия не нужна');
      return Promise.resolve();
    }
    return crypt.encrypt(JSON.stringify(st), DOCKEY + '|version').then(function (p) {
      return store.add({ label: label || null, snapshot: p, crypt: !!crypt.on, author: author() });
    }).then(function (r) {
      touched = 0;
      r = r || {};
      rows.unshift({ id: r.id, label: label || null, author: author(), created_at: r.created_at || new Date().toISOString(), state: st });
      render();
      if (r.__trimmed) note('версия сохранена, самых старых убрано: ' + r.__trimmed);
      else if (!silent) note('версия сохранена');
      return r;
    }).catch(function (e) {
      note('версия НЕ сохранилась: ' + e.message, true);
      throw e;                       // откат не должен идти дальше без предохранителя
    });
  }

  /* ---------- сравнение ---------- */

  function diff(a, b) {
    var A = (a && a.blocks) || {}, B = (b && b.blocks) || {}, out = [];
    var ids = {};
    Object.keys(A).forEach(function (k) { ids[k] = 1; });
    Object.keys(B).forEach(function (k) { ids[k] = 1; });
    Object.keys(ids).forEach(function (id) {
      if (A[id] === B[id]) return;
      out.push({
        id: id,
        kind: A[id] == null ? 'added' : (B[id] == null ? 'removed' : 'changed'),
        was: plain(A[id]), now: plain(B[id])
      });
    });
    return out;
  }

  /* ---------- панель ---------- */

  function build() {
    var wrap = document.querySelector('.le-tb') || (function () {
      var t = document.createElement('div');
      t.className = 'le-tb';
      document.body.appendChild(t);
      return t;
    })();

    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'le-btn ver-open';
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 8v5l3 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 5v4h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg><span>Версии</span>';
    wrap.appendChild(btn);

    btn.setAttribute('aria-controls', 'ver-panel');

    panel = document.createElement('aside');
    panel.className = 'ver-panel le-ui';
    panel.id = 'ver-panel';
    panel.setAttribute('aria-labelledby', 'ver-t');
    panel.innerHTML =
      '<div class="ver-h"><h2 class="ver-t" id="ver-t">История версий</h2>' +
      '<span class="ver-n" id="ver-n"></span>' +
      '<button type="button" class="le-b le-b-icon ver-x" aria-label="Закрыть историю версий">' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>' +
      '<div class="ver-new"><input id="ver-label" class="le-in" aria-label="Подпись версии, необязательно" ' +
      'placeholder="подпись версии, необязательно" maxlength="80">' +
      '<button type="button" class="le-b le-b-main" id="ver-save">Сохранить</button></div>' +
      '<div class="ver-list" id="ver-list"></div>' +
      '<div class="ver-tools"><button type="button" class="le-b" id="ver-export">Выгрузить копию</button>' +
      '<button type="button" class="le-b" id="ver-login" hidden>Войти, чтобы сохранять</button>' +
      '<button type="button" class="le-b" id="ver-import" hidden>Забрать правки из браузера</button>' +
      '<p class="ver-diag" id="ver-diag"></p></div>' +
      '<div class="ver-f" id="ver-f" role="status" aria-live="polite" aria-atomic="true"></div>';
    document.body.appendChild(panel);
    list = panel.querySelector('#ver-list');
    // Закрытая панель обязана уйти и из порядка табуляции, и из дерева
    // доступности: иначе Tab с любой страницы уходит в невидимые кнопки,
    // включая «Вернуть», которая меняет документ.
    panel.inert = true;

    banner = document.createElement('div');
    banner.className = 'ver-banner le-ui';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'assertive');   // под баннером только что подменился весь текст
    banner.inert = true;
    document.body.appendChild(banner);

    btn.addEventListener('click', function () { toggle(); });
    panel.querySelector('.ver-x').addEventListener('click', function () { toggle(false); });
    panel.querySelector('#ver-save').addEventListener('click', function () {
      var i = panel.querySelector('#ver-label');
      snap(i.value.trim() || null);
      i.value = '';
    });
    panel.querySelector('#ver-export').addEventListener('click', exportAll);
    panel.querySelector('#ver-import').addEventListener('click', function () {
      if (!window.BLOCKEDIT_IMPORT_LOCAL) return;
      note('переношу...');
      window.BLOCKEDIT_IMPORT_LOCAL().then(function (r) {
        note('перенесено на сервер: ' + r.ok + ' из ' + r.total);
        paintAuth();
      }).catch(function (e) { note('перенести не вышло: ' + e.message, true); });
    });
    panel.querySelector('#ver-login').addEventListener('click', function () {
      if (!window.LiveAuth) return;
      window.LiveAuth.prompt({ server: true }).then(function (ok) {
        if (ok) { paintAuth(); note('вошли, теперь можно сохранять версии'); }
      });
    });
    paintAuth();
    list.addEventListener('click', onListClick);
    banner.addEventListener('click', onBannerClick);
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (previewing) { exitPreview(); return; }
      if (panel.classList.contains('open')) toggle(false);
    });
  }

  // Модуль версий подключают и отдельно от редактора блоков. Тогда войти
  // больше негде, а без входа сервер отклоняет любую запись.
  function paintAuth() {
    if (!panel) return;
    var need = (storeCfg.storage && storeCfg.storage !== 'local' && storeCfg.storage.url)
      ? !(window.LiveAuth && window.LiveAuth.can()) : false;
    var b = panel.querySelector('#ver-login');
    if (b) b.hidden = !need;
    var s = panel.querySelector('#ver-save');
    if (s) s.disabled = need;

    // Диагностика простыми словами. Правки, сделанные в режиме ?store=local,
    // лежат в браузере и на сервере не появляются, а понять это по экрану
    // было невозможно.
    var d = panel.querySelector('#ver-diag');
    var imp = panel.querySelector('#ver-import');
    if (!d || !window.BLOCKEDIT_INFO) return;
    var i = window.BLOCKEDIT_INFO();
    var parts = ['документ: ' + i.docKey];
    parts.push(i.local ? 'режим: только этот браузер' : 'режим: сервер');
    parts.push('правок применено: ' + i.patched);
    if (i.inThisBrowser) parts.push('правок лежит в этом браузере: ' + i.inThisBrowser);
    d.textContent = parts.join(' · ');
    if (imp) imp.hidden = !(i.inThisBrowser && !i.local && !need);
  }

  function toggle(force) {
    var on = force == null ? !panel.classList.contains('open') : force;
    // фокус увести до inert, иначе он провалится в body
    if (!on && panel.contains(document.activeElement)) btn.focus();
    panel.classList.toggle('open', on);
    panel.inert = !on;
    // открытая панель иначе накрывает собой тулбар в правом нижнем углу
    document.documentElement.classList.toggle('ver-shift', on);
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) {
      paintAuth();
      load();
      (panel.querySelector('#ver-label') || panel.querySelector('.ver-x')).focus();
    }
  }

  function note(t, bad) {
    var f = panel && panel.querySelector('#ver-f');
    if (!f) return;
    f.textContent = '';
    f.className = 'ver-f show' + (bad ? ' bad' : '');
    requestAnimationFrame(function () { f.textContent = t; });
    clearTimeout(note.t);
    note.t = setTimeout(function () { f.className = 'ver-f'; f.textContent = ''; }, 4000);
  }

  // Копия расшифрованного состояния и всей загруженной истории одним файлом.
  function exportAll() {
    var dump = {
      docKey: DOCKEY, at: new Date().toISOString(),
      current: window.BLOCKEDIT_EXPORT ? window.BLOCKEDIT_EXPORT() : (CFG.getState ? CFG.getState() : null),
      versions: rows.map(function (r) {
        return { id: r.id, label: r.label, author: r.author, created_at: r.created_at, state: r.state };
      })
    };
    var b = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = DOCKEY + '-' + dump.at.slice(0, 19).replace(/[:T]/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    note('копия выгружена: ' + rows.length + ' версий. Храните её вне Supabase');
  }

  function render() {
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<p class="ver-empty">Версий пока нет. Правки сохраняются сразу, а версия это точка, к которой можно вернуться.</p>';
      return;
    }
    var cur = CFG.getState ? CFG.getState() : null;
    // render перерисовывает список целиком, поэтому фокус надо вернуть на ту же
    // кнопку той же версии, иначе Tab уезжает в начало документа
    var act = document.activeElement, keep = null;
    if (act && list.contains(act) && act.closest('[data-id]')) {
      keep = [act.closest('[data-id]').getAttribute('data-id'), act.getAttribute('data-a')];
    }
    var n = panel && panel.querySelector('#ver-n');
    if (n) n.textContent = rows.length + ' ' + plural(rows.length, 'версия', 'версии', 'версий');

    list.innerHTML = '<ul class="ver-ul">' + rows.map(function (r, i) {
      var d = cur ? diff(r.state, cur).length : 0;
      var t = esc(fmt(r.created_at));
      var rel = ago(r.created_at);
      var pv = previewing === r.id;
      var b = count(r.state);
      return '<li class="ver-i' + (pv ? ' on' : '') + '" data-id="' + esc(r.id) + '"' +
        (pv ? ' aria-current="true"' : '') + '>' +
        '<div class="ver-i-top"><time datetime="' + esc(r.created_at) + '">' + t + '</time>' +
        (rel ? '<span class="ver-ago">' + esc(rel) + '</span>' : '') +
        (pv ? '<span class="ver-tag ver-tag-pv">на экране</span>'
            : (i === 0 ? '<span class="ver-tag">последняя</span>' : '')) + '</div>' +
        (r.label ? '<p class="ver-lb">' + esc(r.label) + '</p>' : '') +
        '<p class="ver-meta"><span>' + esc(r.author || 'без подписи') + '</span>' +
        '<span><b>' + b + '</b> ' + plural(b, 'блок', 'блока', 'блоков') + '</span>' +
        (d ? '<span><b>' + d + '</b> ' + plural(d, 'отличие', 'отличия', 'отличий') + ' от текущей</span>'
           : '<span class="same">совпадает с текущей</span>') + '</p>' +
        '<div class="ver-a">' +
        '<button type="button" class="le-b" data-a="view" aria-pressed="' + (pv ? 'true' : 'false') +
          '" aria-label="Показать версию от ' + t + '">Показать</button>' +
        '<button type="button" class="le-b" data-a="diff" aria-expanded="false" aria-controls="ver-d-' + esc(r.id) +
          '" aria-label="Что изменилось в версии от ' + t + '">Изменения</button>' +
        '<button type="button" class="le-b" data-a="back" aria-label="Вернуть версию от ' + t + '">Вернуть</button>' +
        // Удаление необратимо, поэтому оно отжато от остальных кнопок и
        // подписано только для чтения с экрана: подпись словом рядом с
        // «Вернуть» провоцирует промах.
        '<button type="button" class="le-b le-b-icon le-b-bad ver-del" data-a="del" title="Удалить версию"' +
          ' aria-label="Удалить версию от ' + t + '">' +
          '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2m-7 0 1 12h8l1-12"' +
          ' stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '</div><div class="ver-d" id="ver-d-' + esc(r.id) + '" hidden></div></li>';
    }).join('') + '</ul>' +
      (hidden ? '<p class="ver-empty">Строк, не открывшихся этим ключом: ' + hidden + '.</p>' : '') +
      (legacy ? '<p class="ver-empty">Снимков в старом формате: ' + legacy + '. Читаются и откатываются как обычно.</p>' : '') +
      (more ? '<button type="button" class="le-b" data-a="more">Показать более старые</button>' : '');
    if (keep) {
      var f = list.querySelector('[data-id="' + keep[0] + '"] [data-a="' + keep[1] + '"]');
      if (f) f.focus();
    }
  }

  function rowById(id) {
    return rows.filter(function (r) { return String(r.id) === String(id); })[0];
  }

  function onListClick(ev) {
    var b = ev.target.closest && ev.target.closest('button[data-a]');
    if (!b) return;
    if (b.getAttribute('data-a') === 'more') { load(true); return; }
    var art = b.closest('.ver-i'), r = art && rowById(art.getAttribute('data-id'));
    if (!r) return;
    var a = b.getAttribute('data-a');

    if (a === 'view') {
      if (!previewing) liveState = CFG.getState();
      previewing = r.id;
      CFG.setState(r.state, { preview: true });
      banner.className = 'ver-banner le-ui show';
      banner.inert = false;
      banner.innerHTML = '<span>Просмотр версии от ' + esc(fmt(r.created_at)) +
        '. Это только показ, на сервере ничего не изменилось, правка на время просмотра выключена.</span>' +
        '<button type="button" class="le-b" data-a="restore">Вернуть эту</button>' +
        '<button type="button" class="le-b" data-a="exit">К текущей</button>';
      render();
    } else if (a === 'diff') {
      var box = art.querySelector('.ver-d');
      if (!box.hidden) { box.hidden = true; b.setAttribute('aria-expanded', 'false'); return; }
      var base = previewing ? liveState : CFG.getState();
      var d = diff(r.state, base);
      box.innerHTML = d.length ? d.map(function (x) {
        var t = x.kind === 'added' ? 'в этой версии не было' :
          x.kind === 'removed' ? 'сейчас нет' : 'изменено';
        // «было» и «стало» различать одним цветом нельзя
        return '<div class="ver-dr ' + x.kind + '"><b>' + esc(t) + '</b>' +
          (x.was ? '<span class="was"><i class="le-sr">было: </i>' + esc(x.was.slice(0, 160)) + '</span>' : '') +
          (x.now ? '<span class="now"><i class="le-sr">стало: </i>' + esc(x.now.slice(0, 160)) + '</span>' : '') + '</div>';
      }).join('') : '<p class="ver-empty">Отличий нет.</p>';
      box.hidden = false;
      b.setAttribute('aria-expanded', 'true');
    } else if (a === 'back') {
      restore(r);
    } else if (a === 'del') {
      if (!confirm('Удалить эту версию? Содержимое документа не изменится.')) return;
      store.drop(r.id).then(function () {
        rows = rows.filter(function (x) { return x !== r; });
        render();
        note('версия удалена');
      }).catch(function (e) { note('версия НЕ удалена: ' + e.message, true); });
    }
  }

  function restore(r) {
    // Карта в этой вкладке могла устареть: пока она лежала открытой, кто-то
    // мог править документ. Откат из устаревшей карты стёр бы чужие правки,
    // поэтому сначала перечитываем сервер и показываем расхождение.
    var fresh = window.BLOCKEDIT_RELOAD ? window.BLOCKEDIT_RELOAD() : Promise.resolve();
    fresh.then(function () {
      var now = CFG.getState();
      var lost = diff(r.state, now).length;
      if (!confirm('Вернуть документ к версии от ' + fmt(r.created_at) + '?\n' +
        'Отличий от текущего состояния: ' + lost + '. Текущее состояние сначала сохранится отдельной версией.')) return;
      return snap('перед откатом', true).then(function () {
        previewing = null;
        banner.className = 'ver-banner le-ui';
        banner.inert = true;
        return CFG.setState(r.state, { preview: false });
      }).then(function () {
        note('документ вернулся к версии от ' + fmt(r.created_at));
        render();
      });
    }).catch(function (e) {
      note('откат отменён: ' + (e.message || e), true);
    });
  }

  function exitPreview() {
    if (!previewing) return;
    previewing = null;
    banner.className = 'ver-banner le-ui';
    banner.inert = true;
    if (liveState) CFG.setState(liveState, { preview: true });
    render();
  }

  function onBannerClick(ev) {
    var b = ev.target.closest && ev.target.closest('button[data-a]');
    if (!b) return;
    if (b.getAttribute('data-a') === 'exit') exitPreview();
    else { var r = rowById(previewing); if (r) restore(r); }
  }

  /* ---------- стили ---------- */

  function css() {
    if (document.getElementById('le-versions-css')) return;
    var s = document.createElement('style');
    s.id = 'le-versions-css';
    // Все цвета и типографика приходят из theme.js. Собственных значений тут
    // нет намеренно: цвет, объявленный по месту, переживает смену темы и
    // разъезжается с остальным модулем при первой же правке.
    s.textContent = [
      // Ширина панели одна на панель и на сдвиг тулбара. Раньше 440 и 456
      // лежали в разных правилах, и правка одной оставляла щель.
      ':root{--le-panel-w:min(440px,100vw)}',

      '.ver-panel{position:fixed;top:0;right:0;width:var(--le-panel-w);height:100dvh;z-index:9500;',
      'background:var(--le-surface);border-left:1px solid var(--le-line);display:flex;flex-direction:column;',
      'box-shadow:var(--le-shadow);transform:translateX(101%);transition:transform .3s var(--le-ease)}',
      '.ver-panel.open{transform:none;visibility:visible;transition:transform .3s var(--le-ease)}',
      // фолбэк для браузеров без inert: убирает из порядка табуляции
      '.ver-panel:not(.open){visibility:hidden;transition:transform .3s var(--le-ease),visibility 0s .3s}',
      '.ver-shift .le-tb{right:calc(var(--le-panel-w) + 16px)}',

      /* ---------- шапка ---------- */

      // Заголовок и счётчик в одну строку: панель узкая, вертикаль дороже
      // горизонтали. Крестик у края, куда идёт большой палец.
      '.ver-h{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--le-line)}',
      '.ver-panel .ver-t{flex:1;min-width:0;font-size:14px;font-weight:700;line-height:1.2;color:var(--le-text)}',
      '.ver-panel .ver-n{font-size:11.5px;font-weight:600;color:var(--le-text-3);white-space:nowrap}',

      /* ---------- сохранение версии ---------- */

      '.ver-new{display:flex;gap:8px;padding:12px 16px;border-bottom:1px solid var(--le-line)}',
      '.ver-new .le-in{flex:1;min-width:0}',

      /* ---------- список ---------- */

      '.ver-list{flex:1;overflow:auto;overscroll-behavior:contain;padding:10px 12px 16px}',
      '.ver-i{border:1px solid var(--le-line);border-radius:var(--le-radius);padding:12px 12px 11px;',
      'margin-bottom:10px;background:var(--le-surface-2)}',
      '.ver-i:last-child{margin-bottom:0}',
      // Версия на экране помечена полосой у корешка, а не заливкой: заливка
      // спорит с подсветкой самой правки в документе.
      '.ver-i.on{border-color:var(--le-ok);box-shadow:inset 3px 0 0 var(--le-ok)}',

      // Верхняя строка карточки. Дата это заголовок версии, поэтому она
      // первая и самая контрастная. Относительный возраст рядом отвечает на
      // вопрос «давно ли», ради которого иначе пришлось бы считать в уме.
      '.ver-i-top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
      '.ver-panel .ver-i time{font-size:13px;font-weight:700;color:var(--le-text);font-variant-numeric:tabular-nums}',
      '.ver-panel .ver-ago{font-size:11.5px;color:var(--le-text-3)}',
      '.ver-tag{margin-left:auto;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;',
      'color:var(--le-a-ink);background:var(--le-a);border-radius:999px;padding:3px 8px;white-space:nowrap}',
      '.ver-tag-pv{background:var(--le-ok);color:#08130B}',
      ':root[data-le-theme="light"] .ver-tag-pv{color:#fff}',

      '.ver-panel .ver-lb{margin-top:7px;font-size:13px;line-height:1.4;color:var(--le-text)}',

      // Цифры карточки. Число отдельно от подписи: так строка сканируется
      // взглядом за один заход, а не читается как предложение.
      '.ver-panel .ver-meta{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:8px;',
      'font-size:11.5px;line-height:1.3;color:var(--le-text-3)}',
      '.ver-meta b{font-weight:700;color:var(--le-text-2);font-variant-numeric:tabular-nums}',
      '.ver-meta .same{color:var(--le-ok)}',

      // Действия. Три текстовые кнопки помещаются в одну строку при ширине
      // панели 440; удаление отжато вправо и сделано значком, чтобы опасное
      // действие не стояло вплотную к «Вернуть» и не ломало строку переносом.
      '.ver-a{display:flex;align-items:center;gap:6px;margin-top:10px}',
      '.ver-a .ver-del{margin-left:auto}',
      '.ver-a .le-b[aria-pressed="true"]{background:var(--le-a);border-color:var(--le-a);color:var(--le-a-ink)}',

      /* ---------- сравнение ---------- */

      '.ver-d{margin-top:10px;border-top:1px solid var(--le-line);padding-top:10px}',
      '.ver-dr{font-size:11.5px;line-height:1.5;margin-bottom:8px;color:var(--le-text-2)}',
      '.ver-dr:last-child{margin-bottom:0}',
      '.ver-panel .ver-dr b{display:block;margin-bottom:3px;font-size:10px;font-weight:700;',
      'letter-spacing:.07em;text-transform:uppercase;color:var(--le-text-3)}',
      // Было и стало различаются не только цветом: на монохромном экране и
      // при дальтонизме остаётся вертикальная черта у края строки.
      '.ver-dr .was,.ver-dr .now{display:block;padding-left:9px;border-left:2px solid currentColor}',
      '.ver-dr .was{color:var(--le-bad)}',
      '.ver-dr .now{color:var(--le-ok);margin-top:3px}',

      /* ---------- служебное ---------- */

      '.ver-panel .ver-empty{padding:10px 4px;font-size:12.5px;line-height:1.55;color:var(--le-text-3)}',
      '.ver-tools{padding:12px 16px 14px;border-top:1px solid var(--le-line);display:flex;flex-wrap:wrap;gap:6px}',
      '.ver-panel .ver-diag{flex-basis:100%;margin-top:4px;font-size:11px;line-height:1.5;color:var(--le-text-3)}',
      '.ver-f{max-height:0;overflow:hidden;padding:0 16px;font-size:12px;color:var(--le-text-2);transition:.2s var(--le-ease)}',
      '.ver-f.show{max-height:72px;padding:10px 16px;border-top:1px solid var(--le-line)}',
      '.ver-f.bad{color:var(--le-bad)}',

      /* ---------- баннер просмотра версии ---------- */

      // Баннер сообщает, что на экране НЕ текущий документ. Это состояние
      // опаснее всего молча пропустить, поэтому он на акценте и по центру.
      '.ver-banner{position:fixed;left:50%;top:12px;z-index:9700;display:flex;align-items:center;gap:10px;',
      'background:var(--le-a);color:var(--le-a-ink);border-radius:999px;padding:8px 10px 8px 16px;',
      'font-family:inherit;font-size:12px;font-weight:600;line-height:1.35;box-shadow:var(--le-shadow);',
      'max-width:min(94vw,760px);transform:translate(-50%,-160%);transition:transform .25s var(--le-ease)}',
      '.ver-banner.show{transform:translate(-50%,0)}',
      '.ver-banner:not(.show){visibility:hidden}',
      '.ver-banner .le-b{background:rgba(0,0,0,.14);border-color:rgba(0,0,0,.2);color:inherit}',
      '.ver-banner .le-b:hover{background:rgba(0,0,0,.24);border-color:rgba(0,0,0,.32)}',

      /* ---------- печать и узкий экран ---------- */

      '@media print{.ver-panel,.ver-open{display:none}',
      '.ver-banner{position:static;display:block;transform:none;max-width:none;box-shadow:none;',
      'border-radius:0;margin:0 0 12px;border-bottom:2px solid #000}',
      '.ver-banner:not(.show){display:none}.ver-banner .le-b{display:none}}',
      '@media(max-width:620px){:root{--le-panel-w:100vw}.ver-shift .le-tb{display:none}',
      '.ver-banner{flex-wrap:wrap;border-radius:16px;padding:12px 14px}',
      // На узком экране три кнопки в строку не помещаются, и вместо переноса
      // в непредсказуемом месте раскладываем сеткой.
      '.ver-a{display:grid;grid-template-columns:1fr 1fr auto;gap:6px}',
      '.ver-a .le-b{width:100%}.ver-a .ver-del{margin-left:0;width:32px}}',
      '@media (prefers-reduced-motion:reduce){.ver-panel,.ver-banner,.ver-f{transition:none!important}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ---------- публичное ---------- */

  window.VERSIONS_SNAP = function (label) { return snap(label); };
  window.VERSIONS_TOUCH = function () {
    touched++;
    if (AUTO && touched >= AUTO) snap('авто', true);
  };
  window.VERSIONS_FLUSH = function () { if (touched) return snap('авто', true); };
  window.VERSIONS_SETCRYPT = function (c) {
    crypt = c;
    storeCfg.crypt = c;
    return panel ? load() : Promise.resolve();
  };
  window.VERSIONS_RELOAD = function () { return load(); };
  // blockedit спрашивает это перед началом правки: в режиме просмотра в DOM
  // лежит старый текст, и запись оттуда молча откатила бы блок
  window.VERSIONS_PREVIEWING = function () { return !!previewing; };
  window.VERSIONS_EXPORT = exportAll;
  // снимки, снятые под ключом прошлой сборки, тоже надо уметь открыть
  window.VERSIONS_ALTKEYS = function (crypts) {
    altCrypts = crypts || [];
    return panel ? load() : Promise.resolve();
  };
  window.VERSIONS_PAINTAUTH = function () { paintAuth(); };
  // Гейт перерисовал документ: превью к новому DOM не относится.
  window.VERSIONS_EXITPREVIEW = function () {
    if (!previewing) return;
    previewing = null;
    liveState = null;
    banner.className = 'ver-banner le-ui';
    banner.inert = true;
    render();
    note('просмотр версии закрыт: документ перерисован');
  };

  function init() {
    if (CFG.ui === false) return;   // зритель документа истории не видит
    // Модуль версий подключают и без редактора блоков. Тогда тему выбирать
    // больше некому, и панель на светлой странице пришла бы тёмной.
    if (window.LiveTheme) window.LiveTheme.apply(CFG.root || '#doc');
    css();
    // LiveAuth поднимаем сами: раньше его инициализировал только blockedit.js,
    // и при отдельной встройке модуля версий все записи отлетали с 401
    if (window.LiveAuth && CFG.storage && CFG.storage.url && !window.LiveAuth.ready()) {
      window.LiveAuth.init({ url: CFG.storage.url, key: CFG.storage.key });
    }
    build();
    // Пока ждём ключ, историю не тянем: без него все строки всё равно уйдут в
    // «не открылись», а готовность гейта ждала бы лишний запрос, к правильности
    // текста на экране отношения не имеющий.
    if (!(CFG.awaitKey && !crypt.on)) load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
