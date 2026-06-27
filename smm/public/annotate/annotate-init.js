/* ============================================================================
   annotate-init.js - загрузчик модуля комментирования (одна строка для встройки).

   Встройка в любой проект ОДНОЙ строкой:
     <script src="https://oliverjone01-dev.github.io/t1/smm/annotate/annotate-init.js"
             data-page="имя-проекта" data-sections=".slide" defer></script>

   Параметры (data-атрибуты тега script):
     data-page      - уникальный ключ страницы (отдельная ветка комментариев). По
                      умолчанию = путь страницы.
     data-sections  - CSS-селектор блоков, к которым привязываются выделения.
                      По умолчанию [data-annotate-section].
     data-storage   - 'local' (комментарии только в этом браузере) или не задавать
                      (по умолчанию общее облако Supabase, зашито ниже).
     data-poll      - период опроса чужих комментариев, мс (по умолчанию 6000).

   Доработка: правьте annotate.js (ядро) в этой же папке и поднимайте CORE_VERSION
   ниже, чтобы сбросить кэш у всех проектов сразу. Загрузчик сам находит ядро
   рядом с собой, поэтому путь подключения может быть любым (относительный/абсолютный).
   ========================================================================== */
(function () {
  'use strict';
  var CORE_VERSION = '8'; // ++ при правке annotate.js, чтобы обновилось у всех

  // общий бэкенд (anon-ключ публичный по дизайну, доступ ограничивают политики RLS)
  var SUPABASE = {
    type: 'supabase',
    url: 'https://hyryostkfwkcvfkqmpel.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cnlvc3RrZndrY3Zma3FtcGVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTIyMzYsImV4cCI6MjA5NzE2ODIzNn0.lz4BUgv8WeEUbGS2tr5Wcu2HGoKH2urL-cXVSHHc5oQ'
  };

  var me = document.currentScript;
  if (!me) { var ss = document.getElementsByTagName('script'); me = ss[ss.length - 1]; }
  var base = me.src.replace(/[^\/]*$/, '');   // папка самого загрузчика (абсолютный URL)
  var d = me.dataset || {};

  window.ANNOTATE = {
    pageKey: d.page || (location.pathname.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'page'),
    sectionSelector: d.sections || '[data-annotate-section]',
    pollMs: d.poll ? parseInt(d.poll, 10) : 6000,
    storage: (d.storage === 'local') ? 'local' : SUPABASE
  };

  var core = document.createElement('script');
  core.src = base + 'annotate.js?v=' + CORE_VERSION;
  core.defer = true;
  document.head.appendChild(core);
})();
