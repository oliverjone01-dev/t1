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
    panel.className = 'ver-panel';
    panel.id = 'ver-panel';
    panel.setAttribute('aria-labelledby', 'ver-t');
    panel.innerHTML =
      '<div class="ver-h"><h2 class="ver-t" id="ver-t">История версий</h2>' +
      '<button type="button" class="ver-x" aria-label="Закрыть историю версий">&times;</button></div>' +
      '<div class="ver-new"><input id="ver-label" aria-label="Подпись версии, необязательно" ' +
      'placeholder="подпись версии, необязательно" maxlength="80">' +
      '<button type="button" class="ver-primary" id="ver-save">Сохранить версию</button></div>' +
      '<div class="ver-list" id="ver-list"></div>' +
      '<div class="ver-tools"><button type="button" class="ver-mini" id="ver-export">Выгрузить копию</button>' +
      '<button type="button" class="ver-mini" id="ver-login" hidden>Войти, чтобы сохранять</button>' +
      '<button type="button" class="ver-mini" id="ver-import" hidden>Забрать правки из этого браузера</button>' +
      '<p class="ver-diag" id="ver-diag"></p></div>' +
      '<div class="ver-f" id="ver-f" role="status" aria-live="polite" aria-atomic="true"></div>';
    document.body.appendChild(panel);
    list = panel.querySelector('#ver-list');
    // Закрытая панель обязана уйти и из порядка табуляции, и из дерева
    // доступности: иначе Tab с любой страницы уходит в невидимые кнопки,
    // включая «Вернуть», которая меняет документ.
    panel.inert = true;

    banner = document.createElement('div');
    banner.className = 'ver-banner';
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
    list.innerHTML = '<ul class="ver-ul">' + rows.map(function (r, i) {
      var d = cur ? diff(r.state, cur).length : 0;
      var t = esc(fmt(r.created_at));
      var pv = previewing === r.id;
      return '<li class="ver-i' + (pv ? ' on' : '') + '" data-id="' + esc(r.id) + '"' +
        (pv ? ' aria-current="true"' : '') + '>' +
        '<div class="ver-i-h"><time datetime="' + esc(r.created_at) + '">' + t + '</time>' +
        (i === 0 ? '<span class="ver-tag">последняя</span>' : '') +
        (pv ? '<span class="ver-tag ver-tag-pv">на экране</span>' : '') + '</div>' +
        (r.label ? '<p class="ver-lb">' + esc(r.label) + '</p>' : '') +
        '<p class="ver-meta">' + esc(r.author || 'без подписи') + ' · блоков: ' + count(r.state) +
        (d ? ' · отличий от текущей: ' + d : ' · совпадает с текущей') + '</p>' +
        '<div class="ver-a">' +
        '<button type="button" data-a="view" aria-pressed="' + (pv ? 'true' : 'false') +
          '" aria-label="Показать версию от ' + t + '">Показать</button>' +
        '<button type="button" data-a="diff" aria-expanded="false" aria-controls="ver-d-' + esc(r.id) +
          '" aria-label="Что изменилось в версии от ' + t + '">Что изменилось</button>' +
        '<button type="button" data-a="back" aria-label="Вернуть версию от ' + t + '">Вернуть</button>' +
        '<button type="button" data-a="del" class="ver-del" aria-label="Удалить версию от ' + t + '">Удалить</button>' +
        '</div><div class="ver-d" id="ver-d-' + esc(r.id) + '" hidden></div></li>';
    }).join('') + '</ul>' +
      (hidden ? '<p class="ver-empty">Строк, не открывшихся этим ключом: ' + hidden + '.</p>' : '') +
      (legacy ? '<p class="ver-empty">Снимков в старом формате: ' + legacy + '. Читаются и откатываются как обычно.</p>' : '') +
      (more ? '<button type="button" class="ver-mini" data-a="more">Показать более старые</button>' : '');
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
      banner.className = 'ver-banner show';
      banner.inert = false;
      banner.innerHTML = '<span>Просмотр версии от ' + esc(fmt(r.created_at)) +
        '. Это только показ, на сервере ничего не изменилось, правка на время просмотра выключена.</span>' +
        '<button type="button" data-a="restore">Вернуть эту</button>' +
        '<button type="button" data-a="exit">К текущей</button>';
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
        banner.className = 'ver-banner';
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
    banner.className = 'ver-banner';
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
    var s = document.createElement('style');
    s.textContent = [
      // дубль на случай, если versions.js подключён без blockedit.js;
      // тему ставит blockedit через data-le-theme, здесь только значения
      ':root{--le-ok:#6BBF7B;--le-bad:#E8805F;--le-ring:var(--cta,#E3BD72);--le-edge:#6A6E78}',
      ':root[data-le-theme="light"]{--le-ok:#1B6B2C;--le-bad:#A83810;--le-ring:#8A6A1E;--le-edge:#767A84}',
      '.le-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
      '.ver-panel{position:fixed;top:0;right:-460px;width:440px;max-width:100vw;height:100dvh;z-index:9500;background:var(--card,#1E2025);border-left:1px solid var(--line,#2E3036);display:flex;flex-direction:column;font-family:inherit;box-shadow:-20px 0 60px rgba(0,0,0,.45);transition:right .3s cubic-bezier(.22,.61,.36,1)}',
      '.ver-panel.open{right:0;visibility:visible;transition:right .3s cubic-bezier(.22,.61,.36,1)}',
      // фолбэк для браузеров без inert: убирает из порядка табуляции
      '.ver-panel:not(.open){visibility:hidden;transition:right .3s cubic-bezier(.22,.61,.36,1),visibility 0s .3s}',
      '.ver-banner:not(.show){visibility:hidden}',
      '.ver-shift .le-tb{right:456px}',
      '.ver-ul{list-style:none;margin:0;padding:0}',
      '.ver-t{font:800 16px/1.2 inherit;margin:0;color:var(--ink,#F3F2EF)}',
      '.ver-tools{padding:0 20px 14px}',
      '.ver-diag{color:var(--ink2,#B4B6B8);font-size:11.5px;line-height:1.5;margin:10px 0 0}',
      '.ver-mini{margin:8px 0 0;background:var(--card2,#26282E);border:1px solid var(--le-edge,#6A6E78);color:var(--ink,#F3F2EF);border-radius:999px;padding:8px 14px;font:600 12px/1 inherit;cursor:pointer}',
      '.ver-mini:hover{border-color:var(--le-ring,#E3BD72)}',
      '.ver-tag-pv{background:var(--le-ok,#6BBF7B)}',
      '.ver-h{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--line,#2E3036);color:var(--ink,#F3F2EF);font-size:16px}',
      '.ver-x{background:none;border:none;color:var(--ink2,#B4B6B8);font-size:26px;line-height:1;cursor:pointer;padding:0;min-width:32px;min-height:32px;display:inline-flex;align-items:center;justify-content:center}',
      '.ver-x:hover{color:var(--ink,#F3F2EF)}',
      '.ver-new{display:flex;gap:8px;padding:14px 20px;border-bottom:1px solid var(--line,#2E3036)}',
      '.ver-new input{flex:1;min-width:0;background:var(--bg2,#191B20);border:1px solid var(--le-edge,#6A6E78);border-radius:13px;color:var(--ink,#F3F2EF);font-family:inherit;font-size:13px;padding:10px 12px}',
      '.ver-new input:focus{border-color:var(--le-ring,#E3BD72);outline:none;box-shadow:0 0 0 3px rgba(227,189,114,.28)}',
      '.ver-primary{background:var(--cta,#E3BD72);color:var(--cta-ink,#1A1408);border:1px solid var(--cta,#E3BD72);border-radius:999px;padding:10px 16px;font:700 12.5px/1 inherit;cursor:pointer;white-space:nowrap}',
      '.ver-list{flex:1;overflow:auto;padding:12px 16px 20px}',
      '.ver-i{border:1px solid var(--line,#2E3036);border-radius:16px;padding:14px;margin-bottom:10px;background:var(--bg2,#191B20)}',
      '.ver-i.on{border-color:var(--le-ring,#E3BD72);box-shadow:inset 3px 0 0 var(--le-ok,#6BBF7B)}',
      '.ver-i-h{display:flex;align-items:center;gap:8px}',
      '.ver-i time{color:var(--ink,#F3F2EF);font-size:13.5px;font-weight:700}',
      '.ver-tag{font-size:11px;color:var(--cta-ink,#1A1408);background:var(--cta,#E3BD72);border-radius:999px;padding:2px 8px;font-weight:700}',
      '.ver-lb{color:var(--ink,#F3F2EF);font-size:13.5px;margin:6px 0 0}',
      '.ver-meta{color:var(--ink2,#B4B6B8);font-size:12px;margin:5px 0 0;line-height:1.45}',
      '.ver-a{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}',
      '.ver-a button{background:var(--card2,#26282E);border:1px solid var(--le-edge,#6A6E78);color:var(--ink,#F3F2EF);border-radius:999px;padding:7px 12px;min-height:26px;font:600 12px/1 inherit;cursor:pointer}',
      '.ver-a button:hover{border-color:var(--cta,#E3BD72)}',
      '.ver-a .ver-del{color:var(--le-bad,#E8805F)}.ver-a .ver-del:hover{border-color:var(--le-bad,#E8805F)}',
      '.ver-d{margin-top:10px;border-top:1px solid var(--line,#2E3036);padding-top:10px}',
      '.ver-dr{font-size:12px;line-height:1.5;margin-bottom:9px;color:var(--ink2,#B4B6B8)}',
      '.ver-dr b{display:block;color:var(--ink,#F3F2EF);font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}',
      '.ver-dr .was{display:block;color:var(--le-bad,#E8805F)}.ver-dr .now{display:block;color:var(--le-ok,#6BBF7B)}',
      '.ver-empty{color:var(--ink2,#B4B6B8);font-size:13px;line-height:1.55;padding:8px 2px}',
      '.ver-f{padding:0 20px;max-height:0;overflow:hidden;color:var(--ink2,#B4B6B8);font-size:12.5px;transition:.2s}',
      '.ver-f.show{max-height:60px;padding:12px 20px;border-top:1px solid var(--line,#2E3036)}.ver-f.bad{color:var(--le-bad,#E8805F)}',
      '.ver-banner{position:fixed;left:50%;transform:translate(-50%,-140%);top:12px;z-index:9700;display:flex;align-items:center;gap:10px;background:var(--cta,#E3BD72);color:var(--cta-ink,#1A1408);border-radius:999px;padding:9px 10px 9px 18px;font:600 12.5px/1.35 inherit;box-shadow:0 12px 34px rgba(0,0,0,.45);max-width:min(94vw,760px);transition:transform .25s}',
      '.ver-banner.show{transform:translate(-50%,0)}',
      '.ver-banner button{background:rgba(0,0,0,.16);border:1px solid rgba(0,0,0,.22);color:inherit;border-radius:999px;padding:6px 13px;font:700 12px/1 inherit;cursor:pointer;white-space:nowrap}',
      '.ver-banner button:hover{background:rgba(0,0,0,.26)}',
      '.ver-panel :focus-visible,.ver-banner :focus-visible,.ver-open:focus-visible{outline:2px solid var(--le-ring,#E3BD72);outline-offset:2px}',
      '@media print{.ver-panel,.ver-open{display:none}.ver-banner{position:static;display:block;transform:none;max-width:none;box-shadow:none;border-radius:0;margin:0 0 12px}.ver-banner:not(.show){display:none}.ver-banner button{display:none}}',
      '@media(max-width:620px){.ver-panel{right:-100%;width:100%}.ver-panel.open{right:0}.ver-shift .le-tb{display:none}.ver-banner{flex-wrap:wrap;border-radius:18px;padding:12px 14px}}',
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
    banner.className = 'ver-banner';
    banner.inert = true;
    render();
    note('просмотр версии закрыт: документ перерисован');
  };

  function init() {
    if (CFG.ui === false) return;   // зритель документа истории не видит
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
