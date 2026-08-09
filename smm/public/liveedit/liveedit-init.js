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
  var CORE_VERSION = '3';

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

  var awaitKey = d.crypt === 'wait';
  var pendingKey = null;

  window.BLOCKEDIT = {
    awaitKey: awaitKey,
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
  //
  // Отсчёт таймаута начинается НЕ с загрузки страницы: пароль печатают дольше
  // четырёх секунд, и таймер снимал бы ожидание раньше, чем ключ вообще придёт.
  // Пока ждём ключ, готовность не резолвится ничем, кроме самого ключа.
  // Потолок ожидания обязан быть НЕ меньше таймаута запроса к хранилищу
  // (8 с в store.js). Иначе остаётся окно, в котором экран уже снят, а ответ
  // ещё едет, и патчи лягут на глазах у зала. Если ответ пришёл после
  // потолка, модуль их не накладывает, а показывает плашку.
  var BUDGET = 9000;
  var resolveReady, readyDone = false, tooLate = false;
  window.LIVEEDIT_READY = new Promise(function (r) { resolveReady = r; });
  function ready(late) {
    if (readyDone) return;
    readyDone = true;
    if (late) tooLate = true;
    resolveReady();
  }
  function armTimeout() { setTimeout(function () { ready(true); }, BUDGET); }
  window.LIVEEDIT_TOOLATE = function () { return tooLate; };
  if (!awaitKey) armTimeout();

  // Страница с шифрованием отдаёт ключ сюда, когда пользователь ввёл пароль.
  // Ключ может прийти раньше, чем догрузятся ядра, поэтому держим его у себя,
  // а ядра при старте сами забирают его из window.BLOCKEDIT.crypt.
  window.LIVEEDIT_KEY = function (cryptoKey) {
    armTimeout();          // потолок ожидания отсчитывается от прихода ключа
    if (!window.LiveCrypt) {         // crypt.js ещё не приехал
      pendingKey = cryptoKey;
      return window.LIVEEDIT_READY;
    }
    applyKey(cryptoKey);
    return window.LIVEEDIT_READY;
  };

  // Ключ отдаём ядрам и ждём именно их промисы. Ожидание по таймеру давало бы
  // ровный четырёхсекундный экран даже там, где патчи легли за триста мс.
  function applyKey(cryptoKey) {
    var c = window.LiveCrypt.fromKey(cryptoKey);
    window.BLOCKEDIT.crypt = c;
    window.VERSIONS.crypt = c;
    var jobs = [];
    if (window.BLOCKEDIT_SETCRYPT) jobs.push(window.BLOCKEDIT_SETCRYPT(c));
    if (window.VERSIONS_SETCRYPT) jobs.push(window.VERSIONS_SETCRYPT(c));
    if (!jobs.length) return;        // ядра ещё грузятся, дозовём после onload
    Promise.all(jobs).then(function () { ready(false); }, function () { ready(false); });
  }

  var files = ['crypt.js', 'store.js', 'auth.js', 'blockedit.js', 'versions.js'];
  (function next(i) {
    if (i >= files.length) return;
    var s = document.createElement('script');
    s.src = base + files[i] + '?v=' + CORE_VERSION;
    s.onload = function () {
      if (files[i] === 'crypt.js') {
        if (!awaitKey) {
          window.BLOCKEDIT.crypt = window.LiveCrypt.off;
          window.VERSIONS.crypt = window.LiveCrypt.off;
        }
      }
      // пароль ввели быстрее, чем догрузились ядра: отдаём ключ, как только
      // появился тот, кому его отдавать
      if (pendingKey && window.LiveCrypt &&
          (files[i] === 'blockedit.js' || files[i] === 'versions.js')) {
        applyKey(pendingKey);
      }
      next(i + 1);
    };
    // Обрыв одного файла не должен молча обезоруживать остальные.
    // Обрыв ядра нельзя проглотить: плашку рисует blockedit.js, а если не
    // загрузился именно он, предупредить зрителя больше некому.
    s.onerror = function () {
      console.error('liveedit: не загрузился ' + files[i]);
      // Текст обязан соответствовать тому, что реально сломалось. Красная
      // полоса «на экране шаблонный текст» при живых патчах врёт зрителю
      // хуже, чем отсутствие полосы.
      warn(WHY[files[i]] || ('не открылся модуль ' + files[i]));
      if (files[i] === 'crypt.js' || files[i] === 'store.js') { ready(false); return; }
      next(i + 1);
    };
    document.head.appendChild(s);
  })(0);

  var WHY = {
    'crypt.js': 'правки не загрузились: не открылся модуль расшифровки. На экране шаблонный текст',
    'store.js': 'правки не загрузились: не открылся модуль хранилища. На экране шаблонный текст',
    'blockedit.js': 'правки не загрузились: не открылся редактор блоков. На экране шаблонный текст',
    'versions.js': 'история версий недоступна. Текст документа при этом в порядке',
    'auth.js': 'вход недоступен: правка только для чтения. Текст документа в порядке'
  };

  function warn(text) {
    if (document.querySelector('.le-warn[data-src="init"]')) return;
    var st = document.createElement('style');
    st.textContent = '.le-warn{position:fixed;top:0;left:0;right:0;z-index:9750;display:flex;gap:12px;' +
      'align-items:center;justify-content:center;flex-wrap:wrap;background:#A83810;color:#fff;' +
      'font:600 13px/1.4 sans-serif;padding:10px 16px;text-align:center}' +
      '.le-warn ~ .le-warn{position:static}' +
      'body:has(.le-warn){padding-top:0}' +
      '.le-warn button{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.5);color:#fff;' +
      'border-radius:999px;padding:6px 14px;font:700 12px/1 inherit;cursor:pointer}' +
      '@media print{.le-warn{position:static;background:none;color:#000;border-bottom:2px solid #000}}';
    document.head.appendChild(st);
    var w = document.createElement('div');
    w.className = 'le-warn';
    w.setAttribute('data-src', 'init');
    w.setAttribute('role', 'status');
    var sp = document.createElement('span');
    sp.textContent = text;
    var bt = document.createElement('button');
    bt.type = 'button';
    bt.textContent = 'Скрыть';
    bt.onclick = function () { w.remove(); };
    w.appendChild(sp); w.appendChild(bt);
    (document.body || document.documentElement).appendChild(w);
  }

  // Без ожидания ключа ядра грузят патчи сами: снимаем ожидание по их отчёту.
  if (!awaitKey) {
    var poll = setInterval(function () {
      if (!window.BLOCKEDIT_INFO) return;
      var h = window.BLOCKEDIT_INFO().health;
      if (h && (h.ok || h.err)) { clearInterval(poll); ready(false); }
    }, 120);
    setTimeout(function () { clearInterval(poll); }, BUDGET + 1000);
  }
})();
