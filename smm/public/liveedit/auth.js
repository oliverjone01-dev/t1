/* ============================================================================
   auth.js - вход редактора через Supabase Auth.

   Зачем он есть. Раньше право на правку решал браузер: код лежал в атрибуте
   data-code прямо в HTML. На публичном GitHub Pages это не защита вообще -
   код видно в исходнике страницы, а значит любой, кому дали ссылку на
   документ, мог переписать его для всех остальных. Право записи обязано
   проверяться на сервере, поэтому запись в doc_blocks и doc_versions закрыта
   политикой RLS "auth.uid() is not null", а этот файл получает и хранит токен.

   Чтение остаётся анонимным: зритель документа должен видеть правки, а текст
   в базе всё равно зашифрован.

     LiveAuth.init({url, key})        - подключить проект и поднять токен из хранилища
     LiveAuth.signIn(email, password) - Promise<user>
     LiveAuth.signOut()
     LiveAuth.headers()               - заголовки для REST: токен, если вошли, иначе anon
     LiveAuth.user                    - {id, email} или null
     LiveAuth.can()                   - можно ли писать

   Токен живёт в sessionStorage: закрыл вкладку - вышел. Это осознанно, доступ
   на запись не должен переживать показ на чужом экране.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = null;
  var K = 'liveedit:auth';
  var state = { token: null, refresh: null, exp: 0, user: null };

  function save() {
    try {
      if (state.token) sessionStorage.setItem(K, JSON.stringify(state));
      else sessionStorage.removeItem(K);
    } catch (e) { }
  }
  function restore() {
    try {
      var s = JSON.parse(sessionStorage.getItem(K) || 'null');
      if (s && s.token && s.exp > Date.now() / 1000 + 30) state = s;
    } catch (e) { }
  }

  // Таймаут обязателен: без него форма входа висит на «Проверяю...» вечно.
  function post(path, body, ms) {
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 12000);
    return fetch(CFG.url.replace(/\/$/, '') + '/auth/v1/' + path, {
      method: 'POST',
      headers: { 'apikey': CFG.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      clearTimeout(t);
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error_description || j.msg || j.message || ('вход не прошёл, ' + r.status));
        return j;
      });
    }).catch(function (e) {
      clearTimeout(t);
      throw (e.name === 'AbortError') ? new Error('сервер входа не ответил') : e;
    });
  }

  function take(j) {
    state.token = j.access_token;
    state.refresh = j.refresh_token;
    state.exp = Math.floor(Date.now() / 1000) + (j.expires_in || 3600);
    state.user = j.user ? { id: j.user.id, email: j.user.email } : null;
    save();
    return state.user;
  }

  var TICK = 10 * 60 * 1000;      // как часто проверяем
  var SLACK = 15 * 60;            // за сколько до конца продлеваем
  var timer = null;
  function autoRefresh() {
    clearInterval(timer);
    // Токен живёт час, встреча идёт дольше. Порог продления обязан быть БОЛЬШЕ
    // интервала тика, иначе между двумя проверками остаётся окно с уже мёртвым
    // токеном, и правка в нём молча улетает в 401.
    timer = setInterval(function () { LiveAuth.ensure(); }, TICK);
  }

  var LiveAuth = {
    get user() { return state.user; },
    can: function () { return !!state.token && state.exp > Date.now() / 1000; },
    ready: function () { return !!CFG; },

    init: function (cfg) {
      CFG = cfg;
      restore();
      if (state.refresh) { LiveAuth.ensure(); autoRefresh(); }
      return LiveAuth;
    },

    signIn: function (email, password) {
      if (!CFG) return Promise.reject(new Error('LiveAuth.init не вызван'));
      return post('token?grant_type=password', { email: email, password: password }, 12000)
        .then(take)
        .then(function (u) { autoRefresh(); return u; });
    },

    // Токен живёт час. Продлеваем молча, чтобы правка в середине встречи не отвалилась.
    ensure: function () {
      if (!CFG || !state.refresh) return Promise.resolve(false);
      if (state.exp > Date.now() / 1000 + SLACK) return Promise.resolve(true);
      return post('token?grant_type=refresh_token', { refresh_token: state.refresh })
        .then(function (j) { take(j); return true; })
        .catch(function () { LiveAuth.signOut(); return false; });
    },

    signOut: function () {
      state = { token: null, refresh: null, exp: 0, user: null };
      clearInterval(timer);
      save();
    },

    headers: function () {
      var h = { 'apikey': CFG ? CFG.key : '', 'Content-Type': 'application/json' };
      h.Authorization = 'Bearer ' + (LiveAuth.can() ? state.token : (CFG ? CFG.key : ''));
      return h;
    }
  };

  /* ---------- форма входа ----------
     Живёт здесь, а не в blockedit.js: модулю версий она нужна ровно так же,
     а раньше он остался вообще без входа и все его записи отлетали с 401. */

  LiveAuth.prompt = function (opts) {
    opts = opts || {};
    var srv = opts.server !== false && !!CFG;
    return new Promise(function (done) {
      var ov = document.createElement('div');
      ov.className = 'le-ov';
      ov.innerHTML = '<div class="le-modal" role="dialog" aria-modal="true" aria-labelledby="le-mt">' +
        '<h2 id="le-mt">' + (srv ? 'Вход редактора' : 'Код редактора') + '</h2>' +
        '<p>' + (srv
          ? 'Правка сохраняется на сервер, поэтому нужен ваш логин. Доступ действует до закрытия вкладки.'
          : 'Правка сохраняется только в этот браузер.') + '</p>' +
        '<form id="le-f">' +
        (srv ? '<label for="le-em">Почта</label><input id="le-em" type="email" autocomplete="username" required>' : '') +
        '<label for="le-pw">' + (srv ? 'Пароль' : 'Код') + '</label>' +
        '<input id="le-pw" type="password" autocomplete="current-password" required>' +
        '<p class="le-err" id="le-er" role="status" aria-live="polite"></p>' +
        '<div class="le-row"><button type="button" class="le-ghost" id="le-cancel">Отмена</button>' +
        '<button type="submit" class="le-primary" id="le-go">Войти</button></div>' +
        '</form></div>';
      document.body.appendChild(ov);
      var back = document.activeElement;
      var er = ov.querySelector('#le-er');
      (ov.querySelector('#le-em') || ov.querySelector('#le-pw')).focus();

      function close(ok) {
        ov.remove();
        document.removeEventListener('keydown', keys, true);
        if (back && back.focus) back.focus();
        done(!!ok);
      }
      function keys(ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(false); return; }
        if (ev.key !== 'Tab') return;
        var f = ov.querySelectorAll('input,button'), a = f[0], z = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); z.focus(); }
        else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus(); }
      }
      document.addEventListener('keydown', keys, true);
      ov.querySelector('#le-cancel').addEventListener('click', function () { close(false); });

      ov.querySelector('#le-f').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var pw = ov.querySelector('#le-pw').value;
        if (!srv) {
          if (pw.trim() !== (opts.code || '')) { er.textContent = 'Код не подошёл.'; return; }
          close(true);
          return;
        }
        er.textContent = 'Проверяю...';
        LiveAuth.signIn(ov.querySelector('#le-em').value.trim(), pw)
          .then(function () { close(true); })
          .catch(function (e) { er.textContent = e.message; });
      });
    });
  };

  window.LiveAuth = LiveAuth;
})();
