/* ============================================================================
   theme.js - оформление модуля: токены, тема, общие примитивы.

   Зачем отдельный файл. Модуль встраивают в чужие проекты, и до этого файла
   он брал цвета прямо из переменных страницы-хозяина: --ink, --card, --line,
   --cta. Имена настолько ходовые, что совпадение почти неизбежно. На тёмной
   странице ИНТЕГРЫ хозяин объявил --ink: #071008, то есть почти чёрный, а
   модуль считал эту переменную цветом СВОЕГО текста. Заголовок «История
   версий» и даты версий рисовались чёрным по тёмно-серому, контраст 1.3:1,
   читать нечего. Панель выглядела сломанной, хотя ломала её страница.

   Отсюда правило: у модуля своя палитра, все имена с префиксом --le-, ничего
   не наследуется по совпадению имён. Совпасть случайно с --le-surface-2 уже
   не получится, а намеренно переопределить можно, и это документированный
   способ подружить панель с брендом проекта.

   Как встроить в свой проект. Ничего не делать - панель нейтральная,
   графитовая на тёмном фоне и белая на светлом, тема определяется сама по
   фактическому фону страницы. Если нужен свой акцент, объявите на :root:

     :root{ --le-accent:#c7ff39; --le-accent-ink:#071008 }

   Это единственные две переменные, которые проект вправе объявлять. Остальные
   служебные, их имена могут поменяться в следующей редакции модуля.

   --le-accent красит основное действие, фокус и активную версию.
   --le-accent-ink это текст на акценте, его контраст к акценту на вашей
   совести: проверьте, что он не ниже 4.5:1.

   Тема. data-le-theme на <html> ставится по яркости фактического фона, а не
   по prefers-color-scheme: страница может быть жёстко тёмной при светлой
   системе, и системная настройка тогда врёт. Значение можно задать руками,
   тогда измерение не перетирает выбор.
   ========================================================================== */
(function () {
  'use strict';
  if (window.LiveTheme) return;

  var STYLE_ID = 'le-theme';

  /* ---------- тема ---------- */

  // Яркость фактического фона под модулем. Поднимаемся по предкам, пока не
  // встретим непрозрачный цвет: у большинства обёрток фон прозрачный.
  function measure(sel) {
    var el = (sel && document.querySelector(sel)) || document.body;
    var c = '';
    while (el && !c) {
      var bg = getComputedStyle(el).backgroundColor;
      if (bg && bg !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(bg)) c = bg;
      el = el.parentElement;
    }
    if (!c) c = getComputedStyle(document.documentElement).backgroundColor || 'rgb(255,255,255)';
    var m = (c.match(/\d+(\.\d+)?/g) || [255, 255, 255]).slice(0, 3).map(Number);
    var lin = m.map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }

  function apply(sel) {
    var html = document.documentElement;
    if (html.getAttribute('data-le-theme-lock') !== '1') {
      html.setAttribute('data-le-theme', measure(sel) > 0.4 ? 'light' : 'dark');
    }
    inkForAccent();
  }

  // Яркость произвольного цвета через временный узел: значение переменной
  // приходит строкой в любом формате, который понимает CSS, и разбирать её
  // руками означает написать половину парсера цвета.
  var probe = null;
  function lum(css) {
    if (!probe) {
      probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden';
      (document.body || document.documentElement).appendChild(probe);
    }
    probe.style.color = '';
    probe.style.color = css;
    var c = getComputedStyle(probe).color;
    var m = (c.match(/\d+(\.\d+)?/g) || [0, 0, 0]).slice(0, 3).map(Number);
    var lin = m.map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }

  // Проект вправе объявить только --le-accent. Тогда чернила выбираем сами:
  // на светлом акценте чёрные, на тёмном белые. Раньше они брались из темы,
  // и лаймовый акцент на светлой теме давал белый текст по лайму, 1.18:1.
  function inkForAccent() {
    var html = document.documentElement;
    var a = getComputedStyle(html).getPropertyValue('--le-accent').trim();
    if (!a) { html.style.removeProperty('--le-accent-ink-auto'); return; }
    html.style.setProperty('--le-accent-ink-auto', lum(a) > 0.4 ? '#101114' : '#FFFFFF');
  }

  /* ---------- токены ---------- */

  // Шкала одна на оба модуля. Уровни поверхностей названы по глубине, а не по
  // роли: panel/card/field разъезжаются, как только элемент переезжает.
  var TOKENS = [
    // Публичные --le-accent и --le-accent-ink объявляет ПРОЕКТ. Свои значения
    // держим под другими именами и читаем через fallback:
    //   var(--le-accent, var(--le-accent-auto))
    // Иначе не работает совсем: и наш :root, и :root проекта имеют одну
    // специфичность, побеждает тот, чей лист ниже, а наш лист добавляется
    // скриптом и всегда оказывается ниже. Проект объявлял лаймовый акцент,
    // а панель оставалась серой, и понять почему по разметке было нельзя.
    'html{--le-a:var(--le-accent,var(--le-accent-auto));',
    '--le-a-ink:var(--le-accent-ink,var(--le-accent-ink-auto))}',
    ':root{',
    '--le-surface:#131417;',        // подложка панели, глубже карточки
    '--le-surface-2:#212329;',      // карточка: на тёмной теме светлее подложки
    '--le-surface-3:#26282E;',      // кнопка, поле ввода
    '--le-line:#34373F;',           // разделитель
    '--le-edge:#6D717B;',           // граница кнопки и поля: 3.8:1 к панели, 3.2:1 к карточке, 3.0:1 к заливке кнопки
    '--le-text:#F2F3F5;',           // основной текст, 16.6:1 к панели
    '--le-text-2:#A9ADB6;',         // вторичный текст, 8.2:1 к панели
    '--le-text-3:#8B909A;',         // подписи, 5.7:1 к панели и 4.9:1 к карточке
    '--le-accent-auto:#E8EAEE;',    // нейтральный по умолчанию, проект вправе заменить
    '--le-accent-ink-auto:#16171A;',
    '--le-ok:#63C07A;',
    '--le-ok-ink:#08130B;',
    '--le-bad:#F08A67;',
    '--le-alarm:#A8351C;',
    '--le-alarm-ink:#FFFFFF;',
    '--le-shadow:0 24px 60px rgba(0,0,0,.5);',
    '--le-radius:14px;',
    '--le-radius-s:10px;',
    '--le-ease:cubic-bezier(.22,.61,.36,1)',
    '}',
    // Светлая тема это не инверсия: на белом та же шкала даёт грязь, поэтому
    // значения подобраны отдельно и проверены по контрасту так же.
    ':root[data-le-theme="light"]{',
    '--le-surface:#F3F4F7;',
    '--le-surface-2:#FFFFFF;',
    '--le-surface-3:#E7EAEF;',
    '--le-line:#D6DAE1;',
    '--le-edge:#7D848E;',           // 3.4:1 к панели, 3.8:1 к карточке, 3.1:1 к заливке
    '--le-text:#16181D;',           // 16.2:1 к панели
    '--le-text-2:#4E545E;',         // 7.6:1 к карточке
    '--le-text-3:#666C76;',         // 4.8:1 к панели и 5.3:1 к карточке
    '--le-accent-auto:#1F2126;',
    '--le-accent-ink-auto:#FFFFFF;',
    '--le-ok:#1B6B2C;',
    '--le-ok-ink:#FFFFFF;',
    '--le-bad:#A8351C;',
    '--le-shadow:0 24px 60px rgba(20,22,28,.16)',
    '}',
    // Только для чтения с экрана. В печати панелей нет, а баннер печатается
    // чёрно-белым: цветные плашки на бумаге не читаются.
    '@media print{:root{--le-surface:#fff;--le-surface-2:#fff;--le-surface-3:#fff;' +
      '--le-line:#c9c9c9;--le-edge:#8a8a8a;--le-text:#000;--le-text-2:#333;--le-text-3:#555;' +
      '--le-a:#000;--le-a-ink:#fff;--le-ok:#000;--le-ok-ink:#fff;--le-bad:#000;--le-shadow:none}}',

    /* ---------- примитивы, общие для панели, тулбара и баннера ---------- */

    // Шрифт. Раньше здесь стоял шорткат вида font:600 12px/1 inherit. Он
    // невалиден: в шорткате font-family не может быть ключевым словом inherit,
    // поэтому браузер отбрасывал объявление целиком вместе с размером и весом.
    // Кнопки и заголовки модуля наследовали типографику страницы, и на
    // ИНТЕГРЕ заголовок панели выезжал под clamp() хозяйского h2. Только
    // длинная запись.
    '.le-ui{font-family:inherit;font-size:13px;line-height:1.45;color:var(--le-text);' +
      '-webkit-font-smoothing:antialiased}',
    '.le-ui *{box-sizing:border-box}',
    // Атрибут hidden обязан гасить элемент. Правило .le-b{display:inline-flex}
    // лежит в авторском листе и по каскаду сильнее браузерного [hidden],
    // поэтому скрытые кнопки «Войти» и «Забрать правки» оставались на экране.
    '.le-ui [hidden]{display:none!important}',
    '.le-ui h1,.le-ui h2,.le-ui h3,.le-ui p,.le-ui ul,.le-ui li{margin:0;padding:0;font-family:inherit}',
    '.le-ui ul{list-style:none}',

    // Кнопка. Три вида одной формы: тихая, основная, опасная. Минимальная
    // высота 32 px это не эстетика, а размер цели указателя.
    '.le-b{display:inline-flex;align-items:center;justify-content:center;gap:6px;',
    'background:var(--le-surface-3);border:1px solid var(--le-edge);color:var(--le-text);',
    'border-radius:999px;padding:0 13px;min-height:32px;font-family:inherit;font-size:12px;',
    'font-weight:600;line-height:1;white-space:nowrap;cursor:pointer;',
    'transition:border-color .15s var(--le-ease),background .15s var(--le-ease)}',
    '.le-b:hover{border-color:var(--le-text-2)}',
    '.le-b[disabled]{cursor:not-allowed;background:transparent;border-style:dashed;',
    'border-color:var(--le-edge);color:var(--le-text-2)}',
    '.le-b-main[disabled]{background:transparent;color:var(--le-text-2)}',
    '.le-b-main{background:var(--le-a);border-color:var(--le-a);color:var(--le-a-ink)}',
    '.le-b-main:hover{border-color:var(--le-a);filter:brightness(1.08)}',
    '.le-b-bad{color:var(--le-bad)}.le-b-bad:hover{border-color:var(--le-bad)}',
    '.le-b-icon{padding:0;width:32px}',
    '.le-b svg{width:14px;height:14px;flex:none}',

    // Поле ввода
    '.le-in{background:var(--le-surface-2);border:1px solid var(--le-edge);border-radius:var(--le-radius-s);',
    'color:var(--le-text);font-family:inherit;font-size:13px;line-height:1.3;padding:9px 12px;min-height:32px}',
    '.le-in::placeholder{color:var(--le-text-3)}',
    '.le-in:focus{border-color:var(--le-text-2);outline:none}',

    // Кольцо фокуса двухцветное и НЕ зависит от акцента проекта. Пока оно
    // рисовалось акцентом, на баннере просмотра версии кольцо совпадало с
    // фоном баннера один в один, контраст 1.0:1, и человек с клавиатуры не
    // видел, на какой из двух кнопок стоит: «Вернуть эту» откатывает документ.
    // Белое кольцо вплотную и тёмное сразу за ним: на любой подложке видно
    // хотя бы одно из двух.
    '.le-ui :focus-visible,.le-focus:focus-visible{outline:2px solid #FFFFFF;outline-offset:0;',
    'box-shadow:0 0 0 4px #0A0B0D;border-radius:999px}',
    // Обратная пара там, где подложка сама тёмная почти до черноты.
    ':root[data-le-theme="light"] .le-ui :focus-visible{outline-color:#0A0B0D;box-shadow:0 0 0 4px #FFFFFF}',

    '.le-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
    '@media (prefers-reduced-motion:reduce){.le-ui,.le-ui *{transition:none!important;animation:none!important}}'
  ].join('');

  function mount() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = TOKENS;
    (document.head || document.documentElement).appendChild(s);
  }

  mount();

  window.LiveTheme = { apply: apply, mount: mount, measure: measure, luminance: lum };
})();
