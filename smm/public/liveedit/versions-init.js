/* ============================================================================
   versions-init.js - загрузчик ТОЛЬКО модуля версий, без редактора блоков.

   Нужен, когда состояние проекта хранит сам проект (форма, конструктор,
   настройки дашборда), а от истории требуется одно: снимать версии и
   возвращаться к ним.

     <script>window.VERSIONS_HOST = {
       getState: function(){ return {...}; },      // что сохранять
       setState: function(s, o){ ... }             // как применить, o.preview = только показать
     };</script>
     <script src=".../smm/liveedit/versions-init.js" data-doc="имя-проекта" defer></script>

   Параметры: data-doc, data-storage ('local' или Supabase по умолчанию),
   data-auto (авто-снимок каждые N вызовов VERSIONS_TOUCH, 0 выключает),
   data-crypt ('wait', если ключ придёт позже через window.LIVEEDIT_KEY),
   data-always ('1' - панель видна всегда; по умолчанию только при ?edit=1).
   Адрес страницы понимает ?edit=1 и ?store=local, как и liveedit-init.js.
   ========================================================================== */
(function () {
  'use strict';
  var CORE_VERSION = '2';

  var SUPABASE = {
    type: 'supabase',
    url: 'https://hyryostkfwkcvfkqmpel.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cnlvc3RrZndrY3Zma3FtcGVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTIyMzYsImV4cCI6MjA5NzE2ODIzNn0.lz4BUgv8WeEUbGS2tr5Wcu2HGoKH2urL-cXVSHHc5oQ'
  };

  var me = document.currentScript;
  if (!me) { var ss = document.getElementsByTagName('script'); me = ss[ss.length - 1]; }
  var base = me.src.replace(/[^\/]*$/, '');
  var d = me.dataset || {};
  var host = window.VERSIONS_HOST || {};

  if (!host.getState || !host.setState) {
    console.error('versions-init: задайте window.VERSIONS_HOST = {getState, setState} до подключения');
    return;
  }

  window.VERSIONS = {
    docKey: d.doc || (location.pathname.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'page'),
    storage: (d.storage === 'local' || /[?&]store=local(&|$)/.test(location.search)) ? 'local' : SUPABASE,
    // панель прячется от зрителя так же, как у liveedit-init: раньше отдельный
    // загрузчик ui не передавал, и история была видна всем
    ui: d.always === '1' || /[?&]edit=1(&|$)/.test(location.search),
    autoEvery: d.auto ? parseInt(d.auto, 10) : 8,
    getState: host.getState,
    setState: host.setState
  };

  window.LIVEEDIT_KEY = function (cryptoKey) {
    if (!window.LiveCrypt) { window.__leKeyPending = cryptoKey; return; }  // crypt.js ещё не приехал
    var c = window.LiveCrypt.fromKey(cryptoKey);
    window.VERSIONS.crypt = c;
    if (window.VERSIONS_SETCRYPT) window.VERSIONS_SETCRYPT(c);
  };

  var files = ['crypt.js', 'store.js', 'auth.js', 'versions.js'];
  (function next(i) {
    if (i >= files.length) return;
    var s = document.createElement('script');
    s.src = base + files[i] + '?v=' + CORE_VERSION;
    s.onload = function () {
      if (files[i] === 'crypt.js') {
        if (d.crypt !== 'wait') window.VERSIONS.crypt = window.LiveCrypt.off;
        else if (window.__leKeyPending) window.VERSIONS.crypt = window.LiveCrypt.fromKey(window.__leKeyPending);
      }
      next(i + 1);
    };
    s.onerror = function () {
      console.error('versions: не загрузился ' + files[i]);
      if (files[i] !== 'crypt.js' && files[i] !== 'store.js') next(i + 1);
    };
    document.head.appendChild(s);
  })(0);
})();
