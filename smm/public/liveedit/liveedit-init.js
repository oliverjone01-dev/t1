/* ============================================================================
   liveedit-init.js - загрузчик правки блоков и истории версий (одна строка).

   Встройка в любой проект:
     <script src="https://oliverjone01-dev.github.io/t1/smm/liveedit/liveedit-init.js"
             data-doc="имя-проекта" data-code="1234" defer></script>

   Параметры (data-атрибуты тега script):
     data-doc       - ключ документа. Разные значения = разные истории. По
                      умолчанию путь страницы.
     data-root      - корневой селектор правимой области. По умолчанию #doc,
                      если такого узла нет, берётся body.
     data-selector  - что считать блоком. По умолчанию заголовки, абзацы,
                      пункты списков, ячейки таблиц и всё с data-edit.
     data-code      - код редактора. Без него правку не включить.
     data-storage   - 'local' (только этот браузер) или не задавать (Supabase).
     data-auto      - авто-снимок версии каждые N правок, 0 выключает. По умолчанию 8.
     data-always    - '1', чтобы показывать панели всегда. По умолчанию панели
                      появляются только при ?edit=1 в адресе, чтобы обычный
                      зритель документа их не видел.
     data-crypt     - 'wait', если ключ шифрования придёт позже от страницы
                      (так работает зашифрованный документ ИНТЕГРА: гейт
                      расшифровал тело и передал свой CryptoKey сюда через
                      window.LIVEEDIT_KEY). Не задавать, если шифрования нет.

   Доработка: правьте blockedit.js / versions.js / store.js и поднимайте
   CORE_VERSION ниже, чтобы кэш сбросился во всех проектах сразу.
   ========================================================================== */
(function () {
  'use strict';
  var CORE_VERSION = '1';

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

  // Страница с шифрованием отдаёт ключ сюда, когда пользователь ввёл пароль.
  // До этого момента модули ничего не читают и не пишут.
  window.LIVEEDIT_KEY = function (cryptoKey) {
    var c = window.LiveCrypt.fromKey(cryptoKey);
    window.BLOCKEDIT.crypt = c;
    window.VERSIONS.crypt = c;
    if (window.BLOCKEDIT_SETCRYPT) window.BLOCKEDIT_SETCRYPT(c);
    if (window.VERSIONS_SETCRYPT) window.VERSIONS_SETCRYPT(c);
  };

  var files = ['crypt.js', 'store.js', 'blockedit.js', 'versions.js'];
  (function next(i) {
    if (i >= files.length) return;
    var s = document.createElement('script');
    s.src = base + files[i] + '?v=' + CORE_VERSION;
    s.onload = function () {
      if (files[i] === 'crypt.js' && d.crypt !== 'wait') {
        window.BLOCKEDIT.crypt = window.LiveCrypt.off;
        window.VERSIONS.crypt = window.LiveCrypt.off;
      }
      next(i + 1);
    };
    s.onerror = function () { console.error('liveedit: не загрузился ' + files[i]); };
    document.head.appendChild(s);
  })(0);
})();
