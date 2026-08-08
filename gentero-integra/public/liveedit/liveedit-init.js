/* ============================================================================
   liveedit-init.js - загрузчик правки блоков и истории версий (одна строка).

   Встройка в любой проект:
     <script src="https://oliverjone01-dev.github.io/t1/smm/liveedit/liveedit-init.js"
             data-doc="имя-проекта" defer></script>

   Параметры (data-атрибуты тега script):
     data-doc       - ключ документа. Разные значения = разные истории. По
                      умолчанию путь страницы.
     data-root      - корневой селектор правимой области. По умолчанию #doc,
                      если такого узла нет, берётся body.
     data-selector  - что считать блоком. По умолчанию заголовки, абзацы,
                      пункты списков, ячейки таблиц и всё с data-edit.
     data-code      - код для ЛОКАЛЬНОГО режима. На сервере не используется:
                      там право писать проверяет Supabase по логину, а код в
                      разметке публичной страницы ничего не защищает.
     data-storage   - 'local' (только этот браузер) или не задавать (Supabase).
     data-auto      - авто-снимок версии каждые N правок, 0 выключает. По умолчанию 8.
     data-always    - '1', чтобы показывать панели всегда. По умолчанию панели
                      появляются только при ?edit=1 в адресе.
     data-crypt     - 'wait', если ключ шифрования придёт позже от страницы
                      (так работает зашифрованный документ ИНТЕГРА: гейт
                      расшифровал тело и передал свой CryptoKey через
                      window.LIVEEDIT_KEY).

   Страница-хост может дождаться готовности патчей до первой отрисовки:
     window.LIVEEDIT_READY  - Promise, резолвится, когда патчи наложены или
                              стало ясно, что их не будет.

   Доработка: правьте модули и поднимайте CORE_VERSION, кэш сбросится во всех
   проектах сразу. Сам загрузчик кэшируется хостингом, поэтому его имя менять
   нельзя, а всё версионируемое лежит в ядрах.
   ========================================================================== */
(function () {
  'use strict';
  var CORE_VERSION = '2';

  // общий бэкенд, тот же проект, что у модуля комментариев
  var SUPABASE = {
    type: 'supabase',
    url: 'https://hyryostkfwkcvfkqmpel.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cnlvc3RrZndrY3Zma3FtcGVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTIyMzYsImV4cCI6MjA5NzE2ODIzNn0.lz4BUgv8WeEUbGS2tr5Wcu2HGoKH2urL-cXVSHHc5oQ'
  };

  var me = document.currentScript;
  if (!me) { var ss = document.getElementsByTagName('script'); me = ss[ss.length - 1]; }
  var base = me.src.replace(/[^\/]*$/, '');
  var d = me.dataset || {};

  var docKey = d.doc || (location.pathname.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'page');
  var storage = (d.storage === 'local' || /[?&]store=local(&|$)/.test(location.search)) ? 'local' : SUPABASE;
  var showUI = d.always === '1' || /[?&]edit=1(&|$)/.test(location.search);

  window.BLOCKEDIT = {
    docKey: docKey,
    storage: storage,
    root: d.root || '#doc',
    selector: d.selector || undefined,
    code: d.code || '',
    ui: showUI
  };

  window.VERSIONS = {
    docKey: docKey,
    storage: storage,
    ui: showUI,
    autoEvery: d.auto ? parseInt(d.auto, 10) : 8,
    getState: function () { return window.BLOCKEDIT_STATE ? window.BLOCKEDIT_STATE() : { v: 1, blocks: {} }; },
    setState: function (s, o) {
      if (o && o.preview) return window.BLOCKEDIT_PREVIEW(s);
      return window.BLOCKEDIT_APPLY(s);
    }
  };

  // Готовность патчей. Хост ждёт её перед первой отрисовкой, иначе зритель
  // увидит шаблонный текст и его подмену на глазах.
  var resolveReady, readyDone = false;
  window.LIVEEDIT_READY = new Promise(function (r) { resolveReady = r; });
  function ready() { if (!readyDone) { readyDone = true; resolveReady(); } }
  setTimeout(ready, 4000);          // сеть могла умереть, показ ждать не будет

  // Страница с шифрованием отдаёт ключ сюда, когда пользователь ввёл пароль.
  // Ключ может прийти раньше, чем догрузятся ядра, поэтому держим его у себя,
  // а ядра при старте сами забирают его из window.BLOCKEDIT.crypt.
  window.LIVEEDIT_KEY = function (cryptoKey) {
    if (!window.LiveCrypt) {         // crypt.js ещё не приехал
      window.__leKeyPending = cryptoKey;
      return window.LIVEEDIT_READY;
    }
    var c = window.LiveCrypt.fromKey(cryptoKey);
    window.BLOCKEDIT.crypt = c;
    window.VERSIONS.crypt = c;
    var jobs = [];
    if (window.BLOCKEDIT_SETCRYPT) jobs.push(window.BLOCKEDIT_SETCRYPT(c));
    if (window.VERSIONS_SETCRYPT) jobs.push(window.VERSIONS_SETCRYPT(c));
    Promise.all(jobs).then(ready, ready);
    return window.LIVEEDIT_READY;
  };

  var files = ['crypt.js', 'store.js', 'auth.js', 'blockedit.js', 'versions.js'];
  (function next(i) {
    if (i >= files.length) {
      if (d.crypt !== 'wait') ready();       // без шифрования ядра грузят патчи сами
      return;
    }
    var s = document.createElement('script');
    s.src = base + files[i] + '?v=' + CORE_VERSION;
    s.onload = function () {
      if (files[i] === 'crypt.js') {
        if (d.crypt !== 'wait') {
          window.BLOCKEDIT.crypt = window.LiveCrypt.off;
          window.VERSIONS.crypt = window.LiveCrypt.off;
        } else if (window.__leKeyPending) {   // пароль ввели быстрее, чем грузились ядра
          var c = window.LiveCrypt.fromKey(window.__leKeyPending);
          window.BLOCKEDIT.crypt = c;
          window.VERSIONS.crypt = c;
        }
      }
      next(i + 1);
    };
    // Обрыв одного файла не должен молча обезоруживать остальные.
    s.onerror = function () {
      console.error('liveedit: не загрузился ' + files[i]);
      if (files[i] === 'crypt.js' || files[i] === 'store.js') { ready(); return; }
      next(i + 1);
    };
    document.head.appendChild(s);
  })(0);

  // Ядра уже стартовали и могли сами загрузить патчи: снимаем ожидание,
  // как только blockedit отчитался о первой загрузке.
  var poll = setInterval(function () {
    if (!window.BLOCKEDIT_INFO) return;
    var i = window.BLOCKEDIT_INFO();
    if (i.health && (i.health.ok || i.health.err)) { clearInterval(poll); ready(); }
  }, 120);
  setTimeout(function () { clearInterval(poll); }, 5000);
})();
