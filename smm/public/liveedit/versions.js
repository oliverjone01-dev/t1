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

  var crypt = CFG.crypt || (window.LiveCrypt ? window.LiveCrypt.off : null);
  var store = window.LiveStore.versions({ docKey: DOCKEY, storage: CFG.storage });

  var rows = [];            // {id,label,author,created_at,state}
  var touched = 0;
  var previewing = null;    // id версии в режиме просмотра
  var liveState = null;     // состояние до входа в просмотр
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
  function plain(html) {
    var b = document.createElement('div');
    b.innerHTML = html || '';
    return (b.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function count(state) {
    return state && state.blocks ? Object.keys(state.blocks).length : 0;
  }

  /* ---------- хранилище ---------- */

  function load() {
    return store.list().then(function (raw) {
      return Promise.all(raw.map(function (r) {
        return crypt.decrypt(r.snapshot)
          .then(function (j) { r.state = JSON.parse(j); return r; })
          .catch(function () { r.state = null; return r; });     // не наш ключ
      }));
    }).then(function (out) {
      rows = out.filter(function (r) { return r.state; });
      render();
      return rows;
    }).catch(function (e) {
      console.warn('versions: список не загрузился', e);
    });
  }

  function snap(label, silent) {
    if (!CFG.getState) return Promise.resolve();
    var st = CFG.getState();
    if (rows.length && JSON.stringify(rows[0].state) === JSON.stringify(st)) {
      if (!silent) note('состояние не менялось, версия не нужна');
      return Promise.resolve();
    }
    return crypt.encrypt(JSON.stringify(st)).then(function (p) {
      return store.add({ label: label || null, snapshot: p, crypt: !!crypt.on, author: author() });
    }).then(function (r) {
      touched = 0;
      r = r || {};
      rows.unshift({ id: r.id, label: label || null, author: author(), created_at: r.created_at || new Date().toISOString(), state: st });
      render();
      if (!silent) note('версия сохранена');
    }).catch(function (e) { note('версия не сохранилась: ' + e.message, true); });
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

    panel = document.createElement('aside');
    panel.className = 'ver-panel';
    panel.setAttribute('aria-label', 'История версий');
    panel.innerHTML =
      '<div class="ver-h"><b>История версий</b><button type="button" class="ver-x" aria-label="Закрыть">&times;</button></div>' +
      '<div class="ver-new"><input id="ver-label" placeholder="подпись версии, необязательно" maxlength="80">' +
      '<button type="button" class="ver-primary" id="ver-save">Сохранить версию</button></div>' +
      '<div class="ver-list" id="ver-list"></div>' +
      '<div class="ver-f" id="ver-f"></div>';
    document.body.appendChild(panel);
    list = panel.querySelector('#ver-list');

    banner = document.createElement('div');
    banner.className = 'ver-banner';
    document.body.appendChild(banner);

    btn.addEventListener('click', function () { toggle(); });
    panel.querySelector('.ver-x').addEventListener('click', function () { toggle(false); });
    panel.querySelector('#ver-save').addEventListener('click', function () {
      var i = panel.querySelector('#ver-label');
      snap(i.value.trim() || null);
      i.value = '';
    });
    list.addEventListener('click', onListClick);
    banner.addEventListener('click', onBannerClick);
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (previewing) { exitPreview(); return; }
      if (panel.classList.contains('open')) toggle(false);
    });
  }

  function toggle(force) {
    var on = force == null ? !panel.classList.contains('open') : force;
    panel.classList.toggle('open', on);
    // открытая панель иначе накрывает собой тулбар в правом нижнем углу
    document.documentElement.classList.toggle('ver-shift', on);
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) load();
  }

  function note(t, bad) {
    var f = panel && panel.querySelector('#ver-f');
    if (!f) return;
    f.textContent = t;
    f.className = 'ver-f show' + (bad ? ' bad' : '');
    clearTimeout(note.t);
    note.t = setTimeout(function () { f.className = 'ver-f'; }, 3000);
  }

  function render() {
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<p class="ver-empty">Версий пока нет. Правки сохраняются сразу, а версия это точка, к которой можно вернуться.</p>';
      return;
    }
    var cur = CFG.getState ? CFG.getState() : null;
    list.innerHTML = rows.map(function (r, i) {
      var d = cur ? diff(r.state, cur).length : 0;
      return '<article class="ver-i' + (previewing === r.id ? ' on' : '') + '" data-id="' + esc(r.id) + '">' +
        '<div class="ver-i-h"><time>' + esc(fmt(r.created_at)) + '</time>' +
        (i === 0 ? '<span class="ver-tag">последняя</span>' : '') + '</div>' +
        (r.label ? '<p class="ver-lb">' + esc(r.label) + '</p>' : '') +
        '<p class="ver-meta">' + esc(r.author || 'без подписи') + ' · блоков: ' + count(r.state) +
        (d ? ' · отличий от текущей: ' + d : ' · совпадает с текущей') + '</p>' +
        '<div class="ver-a">' +
        '<button type="button" data-a="view">Показать</button>' +
        '<button type="button" data-a="diff">Что изменилось</button>' +
        '<button type="button" data-a="back">Вернуть</button>' +
        '<button type="button" data-a="del" class="ver-del" aria-label="Удалить версию">Удалить</button>' +
        '</div><div class="ver-d" hidden></div></article>';
    }).join('');
  }

  function rowById(id) {
    return rows.filter(function (r) { return String(r.id) === String(id); })[0];
  }

  function onListClick(ev) {
    var b = ev.target.closest && ev.target.closest('button[data-a]');
    if (!b) return;
    var art = b.closest('.ver-i'), r = rowById(art.getAttribute('data-id'));
    if (!r) return;
    var a = b.getAttribute('data-a');

    if (a === 'view') {
      if (!previewing) liveState = CFG.getState();
      previewing = r.id;
      CFG.setState(r.state, { preview: true });
      banner.className = 'ver-banner show';
      banner.innerHTML = '<span>Просмотр версии от ' + esc(fmt(r.created_at)) +
        '. Это только показ, на сервере ничего не изменилось.</span>' +
        '<button type="button" data-a="restore">Вернуть эту</button>' +
        '<button type="button" data-a="exit">К текущей</button>';
      render();
    } else if (a === 'diff') {
      var box = art.querySelector('.ver-d');
      if (!box.hidden) { box.hidden = true; return; }
      var base = previewing ? liveState : CFG.getState();
      var d = diff(r.state, base);
      box.innerHTML = d.length ? d.map(function (x) {
        var t = x.kind === 'added' ? 'в этой версии не было' :
          x.kind === 'removed' ? 'сейчас нет' : 'изменено';
        return '<div class="ver-dr ' + x.kind + '"><b>' + esc(t) + '</b>' +
          (x.was ? '<span class="was">' + esc(x.was.slice(0, 160)) + '</span>' : '') +
          (x.now ? '<span class="now">' + esc(x.now.slice(0, 160)) + '</span>' : '') + '</div>';
      }).join('') : '<p class="ver-empty">Отличий нет.</p>';
      box.hidden = false;
    } else if (a === 'back') {
      restore(r);
    } else if (a === 'del') {
      if (!confirm('Удалить эту версию? Содержимое документа не изменится.')) return;
      store.drop(r.id).then(function () {
        rows = rows.filter(function (x) { return x !== r; });
        render();
        note('версия удалена');
      });
    }
  }

  function restore(r) {
    if (!confirm('Вернуть документ к версии от ' + fmt(r.created_at) + '?\nТекущее состояние сначала сохранится отдельной версией.')) return;
    snap('перед откатом', true).then(function () {
      previewing = null;
      banner.className = 'ver-banner';
      return CFG.setState(r.state, { preview: false });
    }).then(function () {
      note('документ вернулся к версии от ' + fmt(r.created_at));
      render();
    });
  }

  function exitPreview() {
    if (!previewing) return;
    previewing = null;
    banner.className = 'ver-banner';
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
      '.ver-panel{position:fixed;top:0;right:-460px;width:440px;max-width:100vw;height:100dvh;z-index:9500;background:var(--card,#1E2025);border-left:1px solid var(--line,#2E3036);display:flex;flex-direction:column;font-family:inherit;box-shadow:-20px 0 60px rgba(0,0,0,.45);transition:right .3s cubic-bezier(.22,.61,.36,1)}',
      '.ver-panel.open{right:0}',
      '.ver-shift .le-tb{right:456px}',
      '.ver-h{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--line,#2E3036);color:var(--ink,#F3F2EF);font-size:16px}',
      '.ver-x{background:none;border:none;color:var(--ink2,#B4B6B8);font-size:26px;line-height:1;cursor:pointer;padding:0 4px}',
      '.ver-x:hover{color:var(--ink,#F3F2EF)}',
      '.ver-new{display:flex;gap:8px;padding:14px 20px;border-bottom:1px solid var(--line,#2E3036)}',
      '.ver-new input{flex:1;min-width:0;background:var(--bg2,#191B20);border:1px solid var(--line2,#3C3F47);border-radius:13px;color:var(--ink,#F3F2EF);font-family:inherit;font-size:13px;padding:10px 12px}',
      '.ver-new input:focus{border-color:var(--cta,#E3BD72);outline:none;box-shadow:0 0 0 3px rgba(227,189,114,.28)}',
      '.ver-primary{background:var(--cta,#E3BD72);color:var(--cta-ink,#1A1408);border:1px solid var(--cta,#E3BD72);border-radius:999px;padding:10px 16px;font:700 12.5px/1 inherit;cursor:pointer;white-space:nowrap}',
      '.ver-list{flex:1;overflow:auto;padding:12px 16px 20px}',
      '.ver-i{border:1px solid var(--line,#2E3036);border-radius:16px;padding:14px;margin-bottom:10px;background:var(--bg2,#191B20)}',
      '.ver-i.on{border-color:var(--cta,#E3BD72)}',
      '.ver-i-h{display:flex;align-items:center;gap:8px}',
      '.ver-i time{color:var(--ink,#F3F2EF);font-size:13.5px;font-weight:700}',
      '.ver-tag{font-size:11px;color:var(--cta-ink,#1A1408);background:var(--cta,#E3BD72);border-radius:999px;padding:2px 8px;font-weight:700}',
      '.ver-lb{color:var(--ink,#F3F2EF);font-size:13.5px;margin:6px 0 0}',
      '.ver-meta{color:var(--ink2,#B4B6B8);font-size:12px;margin:5px 0 0;line-height:1.45}',
      '.ver-a{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}',
      '.ver-a button{background:var(--card2,#26282E);border:1px solid var(--line2,#3C3F47);color:var(--ink,#F3F2EF);border-radius:999px;padding:6px 12px;font:600 12px/1 inherit;cursor:pointer}',
      '.ver-a button:hover{border-color:var(--cta,#E3BD72)}',
      '.ver-a .ver-del{color:#E8805F}.ver-a .ver-del:hover{border-color:#E8805F}',
      '.ver-d{margin-top:10px;border-top:1px solid var(--line,#2E3036);padding-top:10px}',
      '.ver-dr{font-size:12px;line-height:1.5;margin-bottom:9px;color:var(--ink2,#B4B6B8)}',
      '.ver-dr b{display:block;color:var(--ink,#F3F2EF);font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}',
      '.ver-dr .was{display:block;color:#E8805F}.ver-dr .now{display:block;color:#6BBF7B}',
      '.ver-empty{color:var(--ink2,#B4B6B8);font-size:13px;line-height:1.55;padding:8px 2px}',
      '.ver-f{padding:0 20px;max-height:0;overflow:hidden;color:var(--ink2,#B4B6B8);font-size:12.5px;transition:.2s}',
      '.ver-f.show{max-height:60px;padding:12px 20px;border-top:1px solid var(--line,#2E3036)}.ver-f.bad{color:#E8805F}',
      '.ver-banner{position:fixed;left:50%;transform:translate(-50%,-140%);top:12px;z-index:9700;display:flex;align-items:center;gap:10px;background:var(--cta,#E3BD72);color:var(--cta-ink,#1A1408);border-radius:999px;padding:9px 10px 9px 18px;font:600 12.5px/1.35 inherit;box-shadow:0 12px 34px rgba(0,0,0,.45);max-width:min(94vw,760px);transition:transform .25s}',
      '.ver-banner.show{transform:translate(-50%,0)}',
      '.ver-banner button{background:rgba(0,0,0,.16);border:1px solid rgba(0,0,0,.22);color:inherit;border-radius:999px;padding:6px 13px;font:700 12px/1 inherit;cursor:pointer;white-space:nowrap}',
      '.ver-banner button:hover{background:rgba(0,0,0,.26)}',
      '.ver-panel :focus-visible,.ver-banner :focus-visible,.ver-open:focus-visible{outline:2px solid var(--cta,#E3BD72);outline-offset:2px}',
      '@media print{.ver-panel,.ver-banner,.ver-open{display:none}}',
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
  window.VERSIONS_FLUSH = function () { if (touched) snap('авто', true); };
  window.VERSIONS_SETCRYPT = function (c) { crypt = c; return load(); };
  window.VERSIONS_RELOAD = load;

  function init() {
    if (CFG.ui === false) return;   // зритель документа истории не видит
    css();
    build();
    if (!crypt.on) load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
