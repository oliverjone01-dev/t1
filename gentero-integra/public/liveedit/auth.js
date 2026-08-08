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

  function post(path, body) {
    return fetch(CFG.url.replace(/\/$/, '') + '/auth/v1/' + path, {
      method: 'POST',
      headers: { 'apikey': CFG.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error_description || j.msg || j.message || ('вход не прошёл, ' + r.status));
        return j;
      });
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

  var timer = null;
  function autoRefresh() {
    clearInterval(timer);
    // Токен живёт час, встреча идёт дольше. Без продления на 61-й минуте
    // сохранение вернёт 401 и правка потеряется посреди показа.
    timer = setInterval(function () { LiveAuth.ensure(); }, 10 * 60 * 1000);
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
      return post('token?grant_type=password', { email: email, password: password })
        .then(take)
        .then(function (u) { autoRefresh(); return u; });
    },

    // Токен живёт час. Продлеваем молча, чтобы правка в середине встречи не отвалилась.
    ensure: function () {
      if (!CFG || !state.refresh) return Promise.resolve(false);
      if (state.exp > Date.now() / 1000 + 60) return Promise.resolve(true);
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

  window.LiveAuth = LiveAuth;
})();
