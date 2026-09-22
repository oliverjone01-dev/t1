---
name: kontur-design-system
description: Дизайн-система Контур DS для рабочих интерфейсов с цифрами - дашборды, трекеры, отчёты, админки. Токены, компоненты, графики, светлая и тёмная тема, адаптивность от телефона до монитора, конверт цифры, сторож. Не для лендингов и брендовых материалов.
---

# Контур DS

Дизайн-система рабочих интерфейсов, где работают с цифрами: дашборды, трекеры, отчёты,
панели управления, внутренние инструменты. Выросла из дашборда «Контур» (SEO, GEO и
Директ по проектам GENGROUP) и проверена на нём: 52 экрана, две темы, живые данные.
Версия 1.2: работает от складного телефона до монитора.

**HARD RULE:** никаких длинных тире (символ U+2014) ни в интерфейсе, ни в коде, ни в комментариях.
Только дефис или перестроить фразу.

## Когда применять

- Дашборд, отчёт, трекер, админка, калькулятор, внутренний инструмент
- Любой экран, где главное это цифры, их динамика и решения по ним
- Артефакт Claude, страница на GitHub Pages, локальный HTML, React или Vue
- Любое устройство: телефон, планшет, ноутбук, монитор; мышь и палец

## Когда НЕ применять

- Лендинги, КП, презентации, каталоги, соцсети: там гайды брендов
  (gengroup-brand, valonti-brand, turbium-webdis-v1)
- Если в проекте уже есть своя дизайн-система: применяй её, Контур DS только
  закрывает пробелы

## Порядок работы

1. **Найти пакет.** Если в репозитории есть папка `kontur-ds/`, подключи её файлы как есть:
   `tokens/tokens.css`, `kit/kit.css`, `kit/icons.js`, `kit/kit.js`, `kit/charts.js`.
   Стартовый каркас `templates/starter.html`, полное описание `DESIGN_SYSTEM.md`.
   Проект на shadcn/ui или Tailwind v4: после `tokens.css` подключи `tokens/shadcn.css`.
   В странице обязательно `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`,
   шрифт `https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&display=swap`,
   меню `KS.shell.init({ sidebar, backdrop, menu })`, фильтры шапки в `.ks-topbar-tools`.
   Пакета нет: токены и стили ниже переносятся в проект дословно, без правок значений.
2. **Данные в конверт.** Каждая цифра `{v, k, s, at, n}` до того, как попадёт на экран.
3. **Собрать экран по композиции** из раздела «Экран».
4. **Графики только пресетами** или по правилам из раздела «Графики».
5. **Проверить.** Если есть пакет: `python3 kontur-ds/tools/check_ds.py страница.html --live`
   (ключ `--live` меряет реальный контраст каждого текста в браузере, обе темы, 1280 и 390;
   нужен Playwright). Второе мнение: `npx impeccable detect страница.html`. Пакета нет:
   пройти чек-лист в конце вручную.
6. **Посмотреть обе темы глазами** на 390, 768 и 1440 пикселях; на телефоне открыть меню и панель деталей.

## Пять правил

1. **Деньги первыми.** На каждом экране строка про рубли. Цифры нет: строка говорит почему.
2. **Цифра в конверте.** Значение, класс ДАННЫЕ/ГИПОТЕЗА/ДЕМО, источник, дата. Выгрузки нет:
   `v:null` и ДЕМО. Правдоподобное число вместо прочерка запрещено.
3. **Сравнение важнее абсолюта.** Каждая плитка с дельтой за период. Первый экран отвечает,
   стало лучше или хуже.
4. **Цвет вычислен.** Контраст и различимость палитры считаются, а не оцениваются на глаз.
5. **Провал виден.** Разрыв в ряду, скачок, совпавшие выгрузки выводятся на экран, не подчищаются.

## Токены

Единственный источник значений. Все пары «текст на поверхности» проверены по WCAG на
странице, карточке и подложке. Категориальная палитра графиков проверена валидатором
dataviz в обеих темах. Менять значения можно только с повторной проверкой.

```css
/* ==========================================================================
   Контур DS · токены
   Единственный источник значений. Компоненты берут цвет, размер и время
   только отсюда. Каждая пара «текст на поверхности» проверена по WCAG,
   каждая палитра графиков проверена validate_palette.mjs в своей теме.

   Три состояния темы:
     - html[data-theme="dark"]  явный выбор тёмной
     - html[data-theme="light"] явный выбор светлой
     - без атрибута             следуем системе через prefers-color-scheme
   Для совместимости класс html.dark работает как data-theme="dark".
   ========================================================================== */

:root{
  /* ---------- шрифты ---------- */
  /* На Mac и iPhone системный SF (Display на крупном, Text на мелком включаются сами).
     У остальных Golos Text: гротеск с кириллицей и табличными цифрами. SF нельзя
     вложить файлом, лицензия Apple разрешает его только для макетов. DM Sans убран:
     в нём нет табличных цифр, столбцы чисел не выравнивались. */
  --font-sans: -apple-system, BlinkMacSystemFont, "Golos Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  /* моноширинный только для кода и имён токенов; цифры набираются --font-sans с табличными цифрами */
  --font-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;

  /* ---------- шкала текста: восемь ролей, а не девять близких размеров ---------- */
  --fs-badge:  11px;     /* бейджи класса и статуса, капс и жирный; меньше 11px функциональный текст не бывает */
  --fs-micro:  11px;     /* строка источника, подписи осей */
  --fs-caption:12px;     /* подпись плитки, подзаголовок карточки */
  --fs-small:  12.5px;   /* таблицы, текст во врезках */
  --fs-body:   13px;     /* основной текст в карточках */
  --fs-base:   14px;     /* заголовок карточки, базовый размер страницы */
  --fs-h2:     16px;     /* заголовок раздела внутри экрана */
  --fs-h1:     19px;     /* заголовок экрана */
  --fs-hero:   clamp(19px, 17.35px + 0.42vw, 22px); /* значение на плитке: 19px на телефоне 390, 22px от 1100 */

  --lh-tight: 1.2;
  --lh-snug:  1.4;
  --lh-body:  1.55;

  --fw-regular: 400;
  --fw-medium:  500;
  --fw-semi:    600;
  --fw-bold:    700;

  --tracking-hero: -0.03em;
  --tracking-num:  -0.01em;
  --tracking-caps:  0.04em;

  /* ---------- отступы: шаг 4 пикселя, половинки только 2, 6, 10, 14 ---------- */
  --sp-0-5: 2px;  --sp-1: 4px;   --sp-1-5: 6px;  --sp-2: 8px;
  --sp-2-5: 10px; --sp-3: 12px;  --sp-3-5: 14px; --sp-4: 16px;
  --sp-5: 20px;   --sp-6: 24px;  --sp-8: 32px;   --sp-10: 40px;

  /* ---------- радиусы ---------- */
  --r-xs: 4px;     /* бейдж */
  --r-sm: 6px;     /* мелкая кнопка, чип */
  --r-md: 8px;     /* кнопка, поле, пункт меню, тонированный квадрат иконки */
  --r-lg: 10px;    /* карточка, врезка, выдвижная панель */
  --r-full: 999px; /* полоса прогресса, точка */

  /* ---------- движение ---------- */
  --ease-std: cubic-bezier(.4,0,.2,1);
  --ease-out: cubic-bezier(.2,.8,.2,1);   /* вход: панель, экран */
  --ease-in:  cubic-bezier(.4,0,1,1);     /* выход: закрытие панели; пружины и отскоки запрещены */
  --dur-fast:  160ms;  /* наведение на пункт меню, кнопку */
  --dur-base:  250ms;  /* подъём карточки, поворот стрелки */
  --dur-slow:  300ms;  /* раскрытие аккордеона, выезд панели */
  --dur-enter: 420ms;  /* появление экрана */
  --dur-chart: 520ms;  /* анимация графика */

  /* ---------- каркас ---------- */
  --sidebar-w: 258px;
  --sidebar-w-collapsed: 72px;
  --topbar-h: 58px;
  --content-pad: 24px;
  --content-pad-sm: 16px;
  --drawer-w: 560px;
  --content-max: 1480px;

  /* касание: минимальная цель пальца (Apple HIG 44 pt) */
  --tap: 44px;
  --tap-sm: 36px;
  /* точки перелома (в медиазапросах переменные не работают, значения записаны числами):
     sm 640 телефон/планшет, md 768, lg 1024 меню у края, xl 1280, 2xl 1536 */

  --z-topbar: 20; --z-backdrop: 30; --z-sidebar: 40; --z-drawer: 50; --z-toast: 60;

}

/* ================= СВЕТЛАЯ ТЕМА (по умолчанию) =================
   Действует на корень и на любой контейнер с data-theme="light": так светлый
   блок можно вложить в тёмную страницу, а витрину показать в двух темах рядом. */
:root, [data-theme="light"]{
  color-scheme: light;

  --bg:        #F4F6FA;   /* фон страницы */
  --surface:   #FFFFFF;   /* карточка */
  --surface-2: #F4F6FA;   /* поднятый слой, наведение, мягкая подложка */
  --surface-3: #F4F6FA;   /* поле ввода, код */
  --overlay:   rgba(255,255,255,.86);  /* шапка поверх контента */
  --backdrop:  rgba(15,20,30,.40);

  --border:        #E4E8EF;
  --border-strong: #CBD2DE;
  --divider:       #F1F3F7;   /* строки таблицы */

  /* текст: четыре ступени, все проверены на странице, карточке и подложке */
  --text-strong: #2A3547;   /* 11.4:1 на странице */
  --text:        #45536B;   /*  7.2:1 */
  --text-muted:  #5F6B80;   /*  5.0:1, минимум для мелкого текста */
  --text-faint:  #7F889A;   /*  3.3:1, НЕ для чтения: выключенное и значки-указатели */
  --text-link:   #3561C9;   /*  5.2:1 */
  --primary-foreground: #FFFFFF;

  /* интерактив */
  --primary:       #3561C9;  /* белый текст на нём 5.7:1 */
  --primary-hover: #2A4FA8;
  --primary-soft:  rgba(53,97,201,.10);
  --primary-ink:   #3561C9;  /* активный пункт меню */
  --focus:        #3561C9;  /* 5.7:1 к карточке */

  /* статус: зарезервирован, никогда не цвет серии */
  --ok:      #0E754E;  --ok-soft:      rgba(14,117,78,.10);
  --warn:    #855A00;  --warn-soft:    rgba(133,90,0,.12);
  --serious: #A44C17;  --serious-soft: rgba(164,76,23,.10);
  --crit:    #B3261E;  --crit-soft:    rgba(179,38,30,.10);
  --neutral: #5C677B;  --neutral-soft: rgba(92,103,123,.10);
  --info:    #3560C7;  --info-soft:    rgba(53,96,199,.10);

  /* графики: категориальные, фиксированный порядок, никогда по кругу */
  --cat-1: #7B3BC4;  --cat-2: #00806A;  --cat-3: #3561C9;  --cat-4: #A87400;  --cat-5: #0F7CB8;
  /* последовательная шкала, один тон, светлее к темнее */
  --seq-1: #96B2EB;  --seq-2: #6F93E0;  --seq-3: #4A71CB;  --seq-4: #2E52AB;  --seq-5: #1C3D82;
  /* расходящаяся пара */
  --div-warm: #A85A00;  --div-cool: #3561C9;  --div-mid: #9AA4B4;
  /* служебное графиков */
  --grid:     #EFF2F7;
  --axis:     #5F6B80;
  --neutral-bar: #C3CBD9;   /* «остальные» при выделении одного столбца */
  --track:    rgba(0,0,0,.055);

  --sh-hover: 0 6px 24px rgba(42,53,71,.09);
  --sh-pop:   0 12px 32px rgba(15,20,30,.16);
  --sh-drawer:-12px 0 40px rgba(15,20,30,.14);

  --scroll-thumb: #C9D1DE;
}

/* ================= ТЁМНАЯ ТЕМА ================= */
/* Фон на ступень темнее тёмного интерфейса Claude (#151515, светлота OKLCH 0,196): 0,181.
   Цветность поверхностей 0,008-0,016 по OKLCH, тон 258: синий как отлив, не как цвет. */
[data-theme="dark"], :root.dark{
  color-scheme: dark;

  --bg:        #0F1216;   /* на ступень темнее тёмного Claude (#151515), еле заметный синий */
  --surface:   #171A1F;
  --surface-2: #1F2227;
  --surface-3: #131619;
  --overlay:   rgba(15,18,22,.88);
  --backdrop:  rgba(0,0,0,.55);

  --border:        #2A2E34;
  --border-strong: #3B4149;
  --divider:       #21252A;

  --text-strong: #E9EBEF;   /* 14.6:1 на карточке */
  --text:        #BAC0C9;   /*  9.5:1 */
  --text-muted:  #989FAA;   /*  6.5:1 */
  --text-faint:  #727984;   /*  4.0:1, НЕ для чтения */
  --text-link:   #8FB0FF;   /*  8.2:1 */
  --primary-foreground: #0A0C0E;

  --primary:       #5D8AFF;  /* тёмный текст на нём 6.1:1 */
  --primary-hover: #7FA2FF;
  --primary-soft:  rgba(93,138,255,.15);
  --primary-ink:   #93B2FF;
  --focus:        #8FB0FF;

  --ok:      #37D39B;  --ok-soft:      rgba(55,211,155,.14);
  --warn:    #E0A82E;  --warn-soft:    rgba(224,168,46,.14);
  --serious: #F0873F;  --serious-soft: rgba(240,135,63,.12);
  --crit:    #FF6B6B;  --crit-soft:    rgba(255,107,107,.14);
  --neutral: #959CA8;  --neutral-soft: rgba(149,156,168,.12);
  --info:    #8FB0FF;  --info-soft:    rgba(143,176,255,.14);

  --cat-1: #8A5FE9;  --cat-2: #00AD81;  --cat-3: #5D8AFF;  --cat-4: #CE7F00;  --cat-5: #009EEC;
  --seq-1: #33507F;  --seq-2: #3E6BC0;  --seq-3: #5081E4;  --seq-4: #6E96FF;  --seq-5: #A6C0FF;
  --div-warm: #C57E14;  --div-cool: #5D8AFF;  --div-mid: #64748B;
  --grid:     #24272C;
  --axis:     #989FAA;
  --neutral-bar: #444952;
  --track:    rgba(255,255,255,.08);

  --sh-hover: 0 10px 30px rgba(0,0,0,.55);
  --sh-pop:   0 14px 36px rgba(0,0,0,.60);
  --sh-drawer:-14px 0 44px rgba(0,0,0,.55);

  --scroll-thumb: #373C43;
}

/* Системная тема, когда пользователь ничего не выбирал явно */
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]):not(.light){
    color-scheme: dark;
    --bg:#0F1216; --surface:#171A1F; --surface-2:#1F2227; --surface-3:#131619;
    --overlay:rgba(15,18,22,.88); --backdrop:rgba(0,0,0,.55);
    --border:#2A2E34; --border-strong:#3B4149; --divider:#21252A;
    --text-strong:#E9EBEF; --text:#BAC0C9; --text-muted:#989FAA; --text-faint:#727984; --text-link:#8FB0FF; --primary-foreground:#0A0C0E;
    --primary:#5D8AFF; --primary-hover:#7FA2FF; --primary-soft:rgba(93,138,255,.15); --primary-ink:#93B2FF; --focus:#8FB0FF;
    --ok:#37D39B; --ok-soft:rgba(55,211,155,.14); --warn:#E0A82E; --warn-soft:rgba(224,168,46,.14);
    --serious:#F0873F; --serious-soft:rgba(240,135,63,.12); --crit:#FF6B6B; --crit-soft:rgba(255,107,107,.14);
    --neutral:#959CA8; --neutral-soft:rgba(149,156,168,.12); --info:#8FB0FF; --info-soft:rgba(143,176,255,.14);
    --cat-1:#8A5FE9; --cat-2:#00AD81; --cat-3:#5D8AFF; --cat-4:#CE7F00; --cat-5:#009EEC;
    --seq-1:#33507F; --seq-2:#3E6BC0; --seq-3:#5081E4; --seq-4:#6E96FF; --seq-5:#A6C0FF;
    --div-warm:#C57E14; --div-cool:#5D8AFF; --div-mid:#64748B;
    --grid:#24272C; --axis:#989FAA; --neutral-bar:#444952; --track:rgba(255,255,255,.08);
    --sh-hover:0 10px 30px rgba(0,0,0,.55); --sh-pop:0 14px 36px rgba(0,0,0,.60); --sh-drawer:-14px 0 44px rgba(0,0,0,.55);
    --scroll-thumb:#373C43;
  }
}

/* Тот, кто просил больше контраста (настройка системы), получает его */
@media (prefers-contrast: more){
  :root, [data-theme]{ --text-muted: var(--text); --border: var(--border-strong); }
}

/* Тот, кто просил меньше движения, получает его меньше */
@media (prefers-reduced-motion: reduce){
  :root{ --dur-fast:0ms; --dur-base:0ms; --dur-slow:0ms; --dur-enter:0ms; --dur-chart:0ms; }
}
```

### Что важно в токенах

- **Текст четырьмя ступенями, прозрачность на тексте запрещена.** `opacity-55` на светлой
  карточке даёт 2,26:1, `opacity-40` даёт 1,77:1. Нужно 4,5:1. Подписи, источники, даты:
  `--text-muted`. Самая бледная ступень `--text-faint` для чтения не годится вовсе: только
  выключенное и значки-указатели (стрелка меню). Плейсхолдер, «нет», «одна точка», пустой
  график: `--text-muted`.
- **Пол шрифта 11px** для любого функционального текста: бейдж, ось, источник. Абзац не
  мельче 12px. Значение плитки `--fs-hero` плавное: `clamp(19px, 17.35px + 0.42vw, 22px)`,
  19 на телефоне, 22 от 1100 пикселей (формула utopia.fyi). Остальные размеры фиксированы:
  плотному интерфейсу плавающий текст мешает.
- **Движение.** Вход `--ease-out`, выход `--ease-in`, остальное `--ease-std`. Пружины и
  отскоки запрещены. Анимируются только `transform`, `opacity`, `grid-template-rows`;
  ширина, высота и отступы нет: это перерасчёт раскладки на каждом кадре.
- **Бейдж проверен на двух слоях.** Статус на своей подложке поверх карточки и поверх
  `--surface-2` (строка при наведении, секция панели): оба не ниже 4,5:1.
- **Палитра интерфейса не равна палитре графиков.** Синий `#5D87FF` и голубой `#49BEFF`
  при обычном зрении различаются на ΔE 14,4 при пороге 15. Графики красятся только `--cat-1..5`
  в фиксированном порядке: фиолетовый, бирюзовый, синий, янтарный, голубой.
- **Статусные цвета зарезервированы.** `--ok --warn --serious --crit` никогда не цвет серии.
- **Тема на любом контейнере.** `[data-theme="dark"]` можно вложить в светлую страницу.
  Вложенный блок обязан заново взять `color: var(--text)`.
- **Тёмная тема от Claude.** Фон `#0F1216` на ступень темнее тёмного интерфейса Claude
  (`#151515`): светлота OKLCH 0,181 против 0,196, синий еле заметен (цветность 0,008-0,016,
  тон 258). Карточка `#171A1F`, поднятый слой `#1F2227`, граница `#2A2E34`. Не затемнять
  до чёрного и не подсинивать сильнее: так хотел владелец.
- **Шрифт.** На Mac и iPhone системный SF, у остальных Golos Text (Google Fonts). SF нельзя
  вкладывать файлом: лицензия Apple только для макетов. DM Sans не брать: в нём нет
  табличных цифр. Цифры в столбик идут шрифтом интерфейса с `tabular-nums`, моноширинный
  `--font-mono` только для кода.

## Компоненты: стили

Префикс `ks-` не конфликтует ни с Tailwind, ни с чужими стилями.

```css
/* ==========================================================================
   Контур DS · компоненты
   Всё на токенах из tokens.css. Tailwind не нужен: префикс ks- не конфликтует
   ни с Tailwind, ни с чужими стилями, если кит подключают в существующий проект.
   ========================================================================== */

/* ---------- основа ---------- */
*,*::before,*::after{ box-sizing:border-box; }
html,body{ margin:0; background:var(--bg); }
/* Закрытая панель деталей стоит за правым краем. Без clip она раздвигает страницу
   и на телефоне появляется прокрутка вбок. clip, в отличие от hidden, не ломает sticky. */
html{ overflow-x:clip; -webkit-text-size-adjust:100%; text-size-adjust:100%; }
/* открыта панель или меню на телефоне: страница под ними не прокручивается */
html.ks-lock, html.ks-lock body{ overflow:hidden; }
body{
  font-family:var(--font-sans); font-size:var(--fs-base); line-height:var(--lh-snug);
  color:var(--text); -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
}
/* касание: без серой вспышки и без задержки двойного тапа */
button, a, select, [role="button"], [data-drill]{ -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
:focus-visible{ outline:2px solid var(--focus); outline-offset:2px; border-radius:var(--r-sm); }
::-webkit-scrollbar{ width:7px; height:7px; }
::-webkit-scrollbar-thumb{ background:var(--scroll-thumb); border-radius:4px; }
::selection{ background:var(--primary-soft); }
[hidden]{ display:none !important; }
/* Вложенный блок со своей темой обязан заново взять цвет текста и фона:
   унаследованный color уже вычислен по теме родителя. */
[data-theme]{ color:var(--text); }
.ks-theme-pane{ background:var(--bg); color:var(--text); }

/* ---------- типографика ---------- */
.ks-h1{ font-size:var(--fs-h1); font-weight:var(--fw-bold); color:var(--text-strong); line-height:var(--lh-tight); margin:0; }
.ks-h2{ font-size:var(--fs-h2); font-weight:var(--fw-semi); color:var(--text-strong); line-height:var(--lh-tight); margin:0; }
.ks-strong{ color:var(--text-strong); }
.ks-muted{ color:var(--text-muted); }
.ks-faint{ color:var(--text-muted); } /* историческое имя: тихий, но читаемый текст */
.ks-link{ color:var(--text-link); text-decoration:none; }
.ks-link:hover{ text-decoration:underline; text-underline-offset:2px; }
/* Цифры, которые выравниваются в столбик: таблицы, оси, дельты */
.ks-num{ font-family:var(--font-sans); font-variant-numeric:tabular-nums; letter-spacing:var(--tracking-num); }
/* Крупное одиночное число: пропорциональные цифры, тот же гротеск, что и везде */
.ks-hero{ font-family:var(--font-sans); font-variant-numeric:proportional-nums; letter-spacing:var(--tracking-hero); }
.ks-mono{ font-family:var(--font-mono); }
.ks-caps{ text-transform:uppercase; letter-spacing:var(--tracking-caps); }
.ks-sr-only{ position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

/* ---------- каркас приложения ---------- */
.ks-app{ min-height:100vh; min-height:100dvh; display:flex; }
.ks-sidebar{
  width:var(--sidebar-w); flex-shrink:0; height:100vh; height:100dvh; position:sticky; top:env(safe-area-inset-top, 0px);
  display:flex; flex-direction:column; background:var(--surface); border-right:1px solid var(--border);
  transition:transform var(--dur-slow) var(--ease-std); /* ширину не анимируем: сворачивание мгновенное, без перерасчёта раскладки */
  z-index:var(--z-sidebar);
}
.ks-sidebar.is-collapsed{ width:var(--sidebar-w-collapsed); }
.ks-sidebar.is-collapsed .ks-lbl{ display:none; }
.ks-brand{ min-height:var(--topbar-h); display:flex; align-items:center; gap:var(--sp-2-5); padding:var(--sp-2) var(--sp-4); border-bottom:1px solid var(--border); flex-shrink:0; }
.ks-brand-mark{ width:32px; height:32px; border-radius:var(--r-md); display:grid; place-items:center; color:#fff; background:linear-gradient(135deg,var(--cat-3),var(--cat-1)); flex-shrink:0; }
.ks-brand-name{ font-weight:var(--fw-bold); color:var(--text-strong); font-size:var(--fs-base); line-height:1.1; }
.ks-brand-sub{ font-size:var(--fs-micro); color:var(--text-muted); }
.ks-sidebar-foot{ padding:var(--sp-3); border-top:1px solid var(--border); font-size:var(--fs-micro); color:var(--text-muted); line-height:var(--lh-snug); flex-shrink:0; }

.ks-main{ flex:1; min-width:0; }
.ks-topbar{
  height:var(--topbar-h); position:sticky; top:env(safe-area-inset-top, 0px); z-index:var(--z-topbar);
  display:flex; align-items:center; gap:var(--sp-2);
  padding:0 max(var(--sp-4), env(safe-area-inset-right, 0px)) 0 max(var(--sp-4), env(safe-area-inset-left, 0px));
  background:var(--overlay); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  border-bottom:1px solid var(--border); min-width:0; overflow:hidden;
}
.ks-topbar-spacer{ flex:1; }
/* фильтры шапки: на узком экране едут вбок пальцем, а не обрезаются */
.ks-topbar-tools{ display:flex; align-items:center; gap:var(--sp-2); min-width:0; overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
.ks-topbar-tools::-webkit-scrollbar{ display:none; }
/* не влезает: край тает, чтобы было видно, что лента едет дальше (класс ставит KS.shell) */
.ks-topbar-tools.is-overflow{ -webkit-mask-image:linear-gradient(to right, black calc(100% - 28px), transparent); mask-image:linear-gradient(to right, black calc(100% - 28px), transparent); }
.ks-topbar-tools.is-overflow.is-end{ -webkit-mask-image:linear-gradient(to right, transparent, black 28px); mask-image:linear-gradient(to right, transparent, black 28px); }
.ks-menu-btn{ flex-shrink:0; }
.ks-stamp{ font-size:var(--fs-micro); color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ks-view{ padding:var(--content-pad); padding-bottom:calc(var(--content-pad) + env(safe-area-inset-bottom, 0px)); max-width:var(--content-max); min-width:0; }
/* сетки подстраиваются под ширину своего контейнера, а не окна: тот же блок верно
   ложится и в полный экран, и в панель деталей, и в половину витрины */
.ks-view, .ks-theme-pane, .ks-drawer-body, .ks-cq{ container-type:inline-size; }
.ks-backdrop{ position:fixed; inset:0; background:var(--backdrop); z-index:var(--z-backdrop); }

@media (max-width:1023px){
  /* меню уезжает за край и выезжает поверх по кнопке в шапке */
  .ks-sidebar{ position:fixed; left:0; top:0; width:min(300px, 86vw); transform:translateX(-100%);
    padding-top:env(safe-area-inset-top, 0px); padding-bottom:env(safe-area-inset-bottom, 0px); overscroll-behavior:contain; }
  .ks-sidebar.is-open{ transform:none; box-shadow:var(--sh-pop); }
  .ks-sidebar.is-collapsed{ width:min(300px, 86vw); }
  .ks-sidebar.is-collapsed .ks-lbl{ display:revert; }
  .ks-view{ padding:var(--content-pad-sm); padding-bottom:calc(var(--content-pad-sm) + env(safe-area-inset-bottom, 0px));
    padding-left:max(var(--content-pad-sm), env(safe-area-inset-left, 0px)); padding-right:max(var(--content-pad-sm), env(safe-area-inset-right, 0px)); }
  .ks-hide-md{ display:none !important; }
}
@media (min-width:1024px){ .ks-show-md{ display:none !important; } }
@media (max-width:639px){ .ks-hide-sm{ display:none !important; } .ks-h1{ font-size:var(--fs-h2); } }

/* ---------- сетки ---------- */
.ks-stack{ display:flex; flex-direction:column; gap:var(--sp-4); }
.ks-row{ display:flex; align-items:center; gap:var(--sp-2); flex-wrap:wrap; }
.ks-grid-kpi{ display:grid; gap:var(--sp-4); grid-template-columns:repeat(2,minmax(0,1fr)); }
.ks-grid-2  { display:grid; gap:var(--sp-4); grid-template-columns:minmax(0,1fr); }
.ks-grid-3  { display:grid; gap:var(--sp-4); grid-template-columns:minmax(0,1fr); }
/* ширина контейнера: до 300 одна плитка в ряд, от 680 четыре, графики парами от 720, тройкой от 1080 */
@container (max-width:300px){ .ks-grid-kpi{ grid-template-columns:minmax(0,1fr); } }
@container (max-width:479px){ .ks-grid-kpi{ gap:var(--sp-3); } }
@container (min-width:680px){ .ks-grid-kpi{ grid-template-columns:repeat(4,minmax(0,1fr)); } }
@container (min-width:720px){ .ks-grid-2{ grid-template-columns:repeat(2,minmax(0,1fr)); } .ks-grid-3{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
@container (min-width:1080px){ .ks-grid-3{ grid-template-columns:repeat(3,minmax(0,1fr)); } .ks-span-2{ grid-column:span 2; } }
/* браузер без контейнерных запросов (Safari до 16): те же правила по ширине окна */
@supports not (container-type:inline-size){
  @media (min-width:1024px){ .ks-grid-kpi{ grid-template-columns:repeat(4,minmax(0,1fr)); } .ks-grid-2{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
  @media (min-width:1280px){ .ks-grid-3{ grid-template-columns:repeat(3,minmax(0,1fr)); } .ks-span-2{ grid-column:span 2; } }
}

/* ---------- навигация ---------- */
.ks-nav{ flex:1; overflow-y:auto; padding:var(--sp-2-5); display:flex; flex-direction:column; gap:3px; }
.ks-nav-item{
  width:100%; display:flex; align-items:center; gap:var(--sp-2-5); padding:var(--sp-2) var(--sp-3);
  border:0; background:none; border-radius:var(--r-md); cursor:pointer; text-align:left;
  font:inherit; font-size:var(--fs-body); color:var(--text);
  transition:background var(--dur-fast), color var(--dur-fast);
}
.ks-nav-item:hover{ background:var(--surface-2); }
.ks-nav-item.is-active{ background:var(--primary-soft); color:var(--primary-ink); font-weight:var(--fw-semi); }
.ks-nav-item .ks-ic{ opacity:.85; flex-shrink:0; }
.ks-nav-item .ks-lbl{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ks-nav-sub{ display:grid; grid-template-rows:0fr; transition:grid-template-rows var(--dur-slow) var(--ease-std); }
.ks-nav-sub.is-open{ grid-template-rows:1fr; }
.ks-nav-sub-in{ min-height:0; overflow:hidden; display:flex; flex-direction:column; gap:2px; visibility:hidden; transition:visibility 0s linear var(--dur-slow); }
.ks-nav-sub.is-open .ks-nav-sub-in{ visibility:visible; transition:visibility 0s; } /* свёрнутые пункты не ловят Tab */
.ks-nav-sub .ks-nav-item{ padding-left:38px; font-size:var(--fs-small); padding-top:7px; padding-bottom:7px; }
.ks-chev{ transition:transform var(--dur-base); color:var(--text-faint); flex-shrink:0; }
.ks-chev.is-open{ transform:rotate(90deg); }

/* ---------- шапка экрана ---------- */
.ks-page-head{ margin-bottom:var(--sp-4); }
.ks-page-head .ks-row{ margin-bottom:var(--sp-1); }
.ks-page-sub{ font-size:var(--fs-body); max-width:48rem; line-height:var(--lh-snug); margin:0; color:var(--text); }
.ks-page-src{ font-size:var(--fs-micro); color:var(--text-muted); margin-top:var(--sp-1); }
/* Строка про деньги: на каждом экране, пунктирная рамка, иконка кошелька */
.ks-lead{
  margin-top:var(--sp-3); display:flex; gap:var(--sp-2); align-items:flex-start;
  padding:var(--sp-2) var(--sp-3); border:1px dashed var(--border-strong); border-radius:var(--r-md);
  font-size:var(--fs-small); color:var(--text);
}
.ks-lead .ks-ic{ color:var(--text-muted); margin-top:2px; flex-shrink:0; }

/* ---------- карточка ---------- */
.ks-card{
  background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg);
  padding:var(--sp-4); min-width:0;
  transition:box-shadow var(--dur-base), transform var(--dur-base), border-color var(--dur-base);
}
.ks-card.is-interactive{ cursor:pointer; }
@media (hover:hover){ .ks-card.is-interactive:hover, .ks-card.is-lift:hover{ box-shadow:var(--sh-hover); transform:translateY(-2px); border-color:var(--border-strong); } }
.ks-card.is-interactive:active{ border-color:var(--border-strong); }
.ks-card-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:var(--sp-3); margin-bottom:var(--sp-3); }
.ks-card-title{ font-size:var(--fs-base); font-weight:var(--fw-semi); color:var(--text-strong); line-height:var(--lh-tight); }
.ks-card-sub{ font-size:var(--fs-caption); color:var(--text-muted); margin-top:2px; line-height:var(--lh-snug); }
.ks-card-actions{ display:flex; align-items:center; gap:var(--sp-1-5); flex-shrink:0; }

/* ---------- плитка показателя ---------- */
.ks-tile{ background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); padding:var(--sp-3-5); min-width:0;
  transition:box-shadow var(--dur-base), transform var(--dur-base), border-color var(--dur-base); }
.ks-tile.is-interactive{ cursor:pointer; }
@media (hover:hover){ .ks-tile.is-interactive:hover{ box-shadow:var(--sh-hover); transform:translateY(-2px); border-color:var(--border-strong); } }
/* на касании отклик нажатием, иначе после тапа плитка залипает приподнятой */
.ks-tile.is-interactive:active{ border-color:var(--border-strong); background:var(--surface-2); }
.ks-tile-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:var(--sp-2); }
/* Иконка в тонированном квадрате: цвет слота 12-14% прозрачности, иконка тем же цветом */
.ks-tile-icon{ width:36px; height:36px; border-radius:var(--r-md); display:grid; place-items:center; flex-shrink:0;
  color:var(--slot, var(--cat-3)); background:color-mix(in oklab, var(--slot, var(--cat-3)) 14%, transparent); }
.ks-tile-value{ margin-top:var(--sp-2-5); font-size:var(--fs-hero); font-weight:var(--fw-bold); color:var(--text-strong); line-height:1; }
.ks-tile-label{ font-size:var(--fs-caption); margin-top:var(--sp-1-5); line-height:var(--lh-tight); color:var(--text); }
.ks-tile-src{ font-size:var(--fs-micro); margin-top:var(--sp-1); color:var(--text-muted); line-height:var(--lh-tight); }
.ks-tile-empty{ color:var(--text-muted); }

/* ---------- дельта ---------- */
.ks-delta{ font-size:var(--fs-caption); font-weight:var(--fw-semi); white-space:nowrap; display:inline-flex; gap:3px; align-items:baseline; margin-top:var(--sp-1); }
.ks-delta.is-good{ color:var(--ok); }
.ks-delta.is-bad { color:var(--crit); }
.ks-delta.is-flat{ color:var(--text-muted); }
.ks-delta.is-na  { color:var(--text-muted); font-weight:var(--fw-regular); }

/* ---------- бейдж ---------- */
.ks-badge{ display:inline-flex; align-items:center; font-size:var(--fs-badge); font-weight:var(--fw-bold);
  letter-spacing:var(--tracking-caps); text-transform:uppercase; padding:1px 5px; border-radius:var(--r-xs);
  line-height:1.5; vertical-align:middle; white-space:nowrap; }
.ks-badge--ok     { color:var(--ok);      background:var(--ok-soft); }
.ks-badge--warn   { color:var(--warn);    background:var(--warn-soft); }
.ks-badge--serious{ color:var(--serious); background:var(--serious-soft); }
.ks-badge--crit   { color:var(--crit);    background:var(--crit-soft); }
.ks-badge--neutral{ color:var(--neutral); background:var(--neutral-soft); }
.ks-badge--info   { color:var(--info);    background:var(--info-soft); }

/* ---------- таблица ---------- */
.ks-table-wrap{ overflow-x:auto; -webkit-overflow-scrolling:touch; container-type:inline-size; }
.ks-table{ width:100%; border-collapse:collapse; font-size:var(--fs-small); }
.ks-table th{ text-align:left; font-weight:var(--fw-semi); padding:7px 10px; border-bottom:1px solid var(--border); color:var(--text-strong); white-space:nowrap; }
.ks-table td{ padding:7px 10px; border-bottom:1px solid var(--divider); color:var(--text); }
.ks-table .is-num{ text-align:right; font-variant-numeric:tabular-nums; letter-spacing:var(--tracking-num); }
.ks-table tfoot td{ font-weight:var(--fw-semi); color:var(--text-strong); border-bottom:0; }
.ks-table tr.is-interactive{ cursor:pointer; }
@media (hover:hover){ .ks-table tr.is-interactive:hover td{ background:var(--surface-2); } }
.ks-table tr.is-interactive:active td{ background:var(--surface-2); }
.ks-empty{ color:var(--text-muted); }
/* таблица с классом ks-table--stack на ширине до 520 превращается в карточки:
   первая колонка это заголовок строки, остальные идут парами «подпись: значение» */
@container (max-width:520px){
  .ks-table--stack thead{ position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
  .ks-table--stack, .ks-table--stack tbody, .ks-table--stack tfoot{ display:block; }
  .ks-table--stack tr{ display:block; padding:var(--sp-2-5) 0; border-bottom:1px solid var(--divider); }
  .ks-table--stack td{ display:flex; justify-content:space-between; align-items:baseline; gap:var(--sp-3); border:0; padding:3px 0; text-align:right; }
  .ks-table--stack td::before{ content:attr(data-label); color:var(--text-muted); text-align:left; font-weight:var(--fw-regular); }
  .ks-table--stack td:first-child{ font-weight:var(--fw-semi); color:var(--text-strong); text-align:left; }
  .ks-table--stack td:first-child::before{ content:none; }
  .ks-table--stack tfoot tr{ border-bottom:0; }
}

/* ---------- полосы ---------- */
.ks-bars{ display:flex; flex-direction:column; gap:var(--sp-2-5); }
.ks-bar-head{ display:flex; justify-content:space-between; gap:var(--sp-2); font-size:var(--fs-small); margin-bottom:var(--sp-1); }
.ks-bar-name{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ks-bar-value{ font-variant-numeric:tabular-nums; font-weight:var(--fw-semi); color:var(--text-strong); }
.ks-bar-track{ height:7px; border-radius:var(--r-full); background:var(--track); overflow:hidden; }
.ks-bar-fill{ height:100%; border-radius:var(--r-full); background:var(--slot, var(--cat-3)); transform-origin:left center; animation:ks-grow var(--dur-slow) var(--ease-out) both; }
@keyframes ks-grow{ from{ transform:scaleX(0); } }

/* ---------- врезка ---------- */
.ks-note{ display:flex; gap:var(--sp-2-5); padding:var(--sp-3-5); border:1px solid; border-radius:var(--r-lg); }
.ks-note-ic{ flex-shrink:0; margin-top:1px; color:var(--tone); }
.ks-note-title{ font-weight:var(--fw-semi); font-size:var(--fs-body); color:var(--text-strong); margin-bottom:2px; }
.ks-note-body{ font-size:var(--fs-small); line-height:var(--lh-snug); color:var(--text); }
.ks-note--ok  { --tone:var(--ok);      border-color:color-mix(in oklab, var(--ok) 28%, transparent);      background:color-mix(in oklab, var(--ok) 5%, transparent); }
.ks-note--warn{ --tone:var(--warn);    border-color:color-mix(in oklab, var(--warn) 30%, transparent);    background:color-mix(in oklab, var(--warn) 6%, transparent); }
.ks-note--crit{ --tone:var(--crit);    border-color:color-mix(in oklab, var(--crit) 28%, transparent);    background:color-mix(in oklab, var(--crit) 5%, transparent); }
.ks-note--info{ --tone:var(--serious); border-color:color-mix(in oklab, var(--serious) 26%, transparent); background:color-mix(in oklab, var(--serious) 5%, transparent); }

/* ---------- следующий шаг ---------- */
.ks-action-title{ display:flex; align-items:center; gap:var(--sp-2); font-weight:var(--fw-semi); font-size:var(--fs-body); color:var(--text-strong); margin-bottom:var(--sp-2); }
.ks-action-what{ font-size:var(--fs-body); line-height:var(--lh-snug); margin-bottom:var(--sp-2-5); }
.ks-action-meta{ display:flex; flex-wrap:wrap; gap:var(--sp-1) var(--sp-5); font-size:var(--fs-small); }
.ks-action-meta dt{ color:var(--text-muted); }
.ks-action-meta dd{ margin:0; font-weight:var(--fw-semi); color:var(--text-strong); }
.ks-action-crit{ font-size:var(--fs-small); margin-top:var(--sp-2); padding-top:var(--sp-2); border-top:1px solid var(--border); }

/* ---------- нумерованные шаги и чек-лист ---------- */
.ks-steps{ display:flex; flex-direction:column; gap:var(--sp-2-5); margin:0; padding:0; list-style:none; }
.ks-step{ display:flex; gap:var(--sp-2-5); align-items:flex-start; font-size:var(--fs-small); }
.ks-step-n{ width:24px; height:24px; border-radius:var(--r-sm); flex-shrink:0; display:grid; place-items:center;
  font-size:var(--fs-micro); font-variant-numeric:tabular-nums; font-weight:var(--fw-bold); color:var(--text-strong);
  background:color-mix(in oklab, var(--slot, var(--seq-2)) 30%, transparent); }
.ks-step-title{ font-weight:var(--fw-medium); color:var(--text-strong); }
.ks-step-sub{ color:var(--text-muted); line-height:var(--lh-tight); }
.ks-check{ display:flex; gap:var(--sp-2); font-size:var(--fs-small); line-height:var(--lh-snug); }
.ks-check .ks-ic{ flex-shrink:0; margin-top:2px; }
.ks-check--ok   .ks-ic{ color:var(--ok); }
.ks-check--warn .ks-ic{ color:var(--warn); }
.ks-check--crit .ks-ic{ color:var(--crit); }

/* ---------- кнопки и поля ---------- */
.ks-btn{
  display:inline-flex; align-items:center; justify-content:center; gap:var(--sp-2);
  height:34px; padding:0 var(--sp-3-5); border-radius:var(--r-md); border:1px solid transparent;
  font:inherit; font-size:var(--fs-body); font-weight:var(--fw-semi); cursor:pointer; white-space:nowrap;
  transition:background var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast);
}
.ks-btn--primary  { background:var(--primary); color:var(--primary-foreground); }
.ks-btn--primary:hover{ background:var(--primary-hover); }
.ks-btn--secondary{ background:var(--surface); color:var(--text-strong); border-color:var(--border-strong); }
.ks-btn--secondary:hover{ background:var(--surface-2); }
.ks-btn--ghost    { background:transparent; color:var(--text); }
.ks-btn--ghost:hover{ background:var(--surface-2); }
.ks-btn--sm{ height:26px; padding:0 var(--sp-2); font-size:var(--fs-caption); font-weight:var(--fw-medium); border-radius:var(--r-sm); }
.ks-btn--icon{ width:32px; height:32px; padding:0; }
.ks-btn:disabled{ opacity:.5; cursor:not-allowed; }

/* Сегментный переключатель: проекты, режимы */
.ks-seg{ display:inline-flex; gap:2px; padding:3px; border-radius:var(--r-md); background:var(--surface-2); flex-shrink:0; }
.ks-seg button{ border:0; background:none; font:inherit; font-size:var(--fs-small); font-weight:var(--fw-medium);
  padding:4px 10px; border-radius:var(--r-sm); cursor:pointer; color:var(--text-muted); white-space:nowrap;
  transition:background var(--dur-fast), color var(--dur-fast); }
.ks-seg button[aria-pressed="true"]{ background:var(--surface); color:var(--text-strong); box-shadow:0 1px 2px rgba(0,0,0,.08); }

.ks-select{ font:inherit; font-size:var(--fs-small); padding:6px 28px 6px 10px; border-radius:var(--r-md);
  border:0; background:var(--surface-2); color:var(--text-strong); cursor:pointer; appearance:none;
  background-image:linear-gradient(45deg,transparent 50%,var(--text-muted) 50%),linear-gradient(135deg,var(--text-muted) 50%,transparent 50%);
  background-position:calc(100% - 14px) 50%, calc(100% - 9px) 50%; background-size:5px 5px; background-repeat:no-repeat; }

.ks-field{ display:flex; flex-direction:column; gap:var(--sp-1); }
.ks-field-label{ font-size:var(--fs-small); color:var(--text-strong); display:flex; gap:var(--sp-1-5); align-items:center; }
.ks-field-hint{ font-size:var(--fs-micro); color:var(--text-muted); }
.ks-input{ width:100%; font:inherit; font-variant-numeric:tabular-nums; font-size:var(--fs-body); padding:6px 9px; border-radius:var(--r-md);
  border:1px solid var(--border); background:var(--surface-3); color:var(--text-strong); }
.ks-input::placeholder{ color:var(--text-muted); }
.ks-input:focus{ outline:2px solid var(--focus); outline-offset:-1px; }

/* ---------- касание ---------- */
@media (pointer:coarse){
  .ks-btn{ height:var(--tap); }
  .ks-btn--sm{ height:var(--tap-sm); }
  .ks-btn--icon{ width:var(--tap); height:var(--tap); }
  .ks-nav-item{ min-height:var(--tap); }
  .ks-seg button{ min-height:var(--tap-sm); padding-inline:var(--sp-3); }
  /* поле мельче 16 пикселей Safari на iPhone увеличивает вместе со страницей при фокусе */
  .ks-select, .ks-input{ font-size:16px; min-height:var(--tap); }
  .ks-table tr.is-interactive td{ padding-top:11px; padding-bottom:11px; }
}

/* ---------- выдвижная панель деталей ---------- */
.ks-drawer{
  position:fixed; top:0; right:0; bottom:0; width:min(var(--drawer-w),100vw); z-index:var(--z-drawer);
  padding-top:env(safe-area-inset-top, 0px); padding-bottom:env(safe-area-inset-bottom, 0px);
  background:var(--surface); border-left:1px solid var(--border); box-shadow:var(--sh-drawer);
  display:flex; flex-direction:column; transform:translateX(100%);
  /* закрытая панель невидима и недоступна с клавиатуры, видимость гасится после выезда */
  visibility:hidden; pointer-events:none;
  transition:transform var(--dur-slow) var(--ease-std), visibility 0s linear var(--dur-slow);
}
.ks-drawer.is-open{ transform:none; visibility:visible; pointer-events:auto;
  transition:transform var(--dur-slow) var(--ease-std), visibility 0s; }
.ks-drawer-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:var(--sp-3); padding:var(--sp-4); border-bottom:1px solid var(--border); }
.ks-drawer-body{ flex:1; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; padding:var(--sp-4);
  padding-bottom:calc(var(--sp-4) + env(safe-area-inset-bottom, 0px)); display:flex; flex-direction:column; gap:var(--sp-4); }
@media (max-width:639px){ .ks-drawer{ width:100vw; border-left:0; } .ks-drawer-head{ padding:var(--sp-3) var(--sp-4); } }

/* ---------- графики ---------- */
.ks-chart{ min-height:var(--h, 260px); }
.apexcharts-tooltip{ border-radius:var(--r-md) !important; border:none !important; box-shadow:var(--sh-pop) !important; }
.apexcharts-legend-text{ color:inherit !important; }

/* ---------- появление экрана ---------- */
.ks-fade{ animation:ks-fade var(--dur-enter) ease both; }
@keyframes ks-fade{ from{ opacity:0; transform:translateY(7px); } to{ opacity:1; transform:none; } }

/* ---------- высокая контрастность Windows ---------- */
@media (forced-colors: active){
  .ks-badge, .ks-card, .ks-tile, .ks-note, .ks-btn{ border:1px solid CanvasText; }
  .ks-bar-fill{ background:Highlight; }
}

/* ---------- печать ---------- */
@media print{
  .ks-sidebar,.ks-topbar,.ks-noprint{ display:none !important; }
  html,body{ background:#fff !important; color:#000 !important; }
  .ks-card,.ks-tile,.ks-note{ break-inside:avoid; box-shadow:none !important; border-color:#ccc !important; }
  .ks-view{ padding:0 !important; }
}
```

## Компоненты: разметка и поведение

**Шапка экрана.** `h1.ks-h1` + бейджи источника и приоритета, `p.ks-page-sub` одна фраза,
на какой вопрос экран отвечает, `.ks-page-src` мелкий приглушённый источник, `.ks-lead` строка
про деньги в пунктирной рамке с иконкой кошелька. Строка про деньги обязательна.

**Плитка показателя** `.ks-tile`: сверху квадрат иконки 36×36 `.ks-tile-icon` (цвет слота
через `--slot:var(--cat-N)`, фон 14% через color-mix) и бейдж класса справа; затем значение
`.ks-tile-value.ks-hero` 19-22 пикселя (плавно); дельта `.ks-delta`; подпись `.ks-tile-label`; источник
и дата `.ks-tile-src`. Четыре состояния: ДАННЫЕ, ГИПОТЕЗА, ДЕМО (вместо значения «нет»
цветом muted), одна точка (вместо дельты «одна точка»). Кликабельная плитка:
`.is-interactive role="button" tabindex="0" data-drill="ключ"`. Ряд: `.ks-grid-kpi`.

**Дельта** `.ks-delta.is-good|is-bad|is-flat|is-na`: стрелка, абсолютное изменение,
процент. Цвет по смыслу, а не по знаку: для позиции, CPL, отказов меньше значит лучше.
В title: было на дату, стало на дату, отрезком раньше.

**Бейдж** `.ks-badge.ks-badge--ok|warn|serious|crit|neutral|info`. Класс цифры:
ДАННЫЕ ok, ГИПОТЕЗА warn, ДЕМО crit.

**Карточка** `.ks-card` > `.ks-card-head` (`.ks-card-title`, `.ks-card-sub`, `.ks-card-actions`).
У каждого графика таблица-двойник: кнопка «таблица» в `.ks-card-actions`
(`aria-expanded`, `aria-controls`), под графиком скрытый блок с `.ks-table`.

**Таблица** `.ks-table-wrap > table.ks-table`, числовые ячейки `.is-num` (вправо, табличные
цифры), пустое значение прочерком `.ks-empty`. `.ks-table--stack` (или `KS.table(..., { stack:true })`,
само при четырёх колонках и больше) на контейнере уже 520 превращает строки в карточки:
первая колонка заголовок, остальные парами «подпись: значение» из `data-label`.

**Полосы** `.ks-bars`: один ряд, один цвет. Раскраска по величине запрещена.

**Врезка** `.ks-note.ks-note--ok|warn|crit|info`: иконка, `.ks-note-title`, `.ks-note-body`.
crit получает `role="alert"`. Объясняет, что значит цифра и что делать.

**Вердикт**: врезка с заголовком «Стало лучше / Стало хуже / Разнонаправленно за N дней»,
по каждой метрике было, стало, изменение, отрезком раньше. Метрики с одной точкой
в вердикт не входят и названы отдельно.

**Следующий шаг**: что, кто, когда, критерий «идём дальше». Без исполнителя и даты не
рисуется, вместо него предупреждение.

**Кнопки** `.ks-btn--primary` одна на экран, `--secondary`, `--ghost`, `--sm`, `--icon`
(с `aria-label`). Сегмент `.ks-seg` с `aria-pressed`. Поле `.ks-field > .ks-input`
с табличными цифрами и бейджем класса в подписи; на касании 16 пикселей.

**Меню** `.ks-nav`: два уровня, аккордеон `.ks-nav-sub.is-open`, стрелка `.ks-chev.is-open`.
Бейдж группы считается функцией на каждой отрисовке. Активный пункт `aria-current="page"`.

**Панель деталей** (проваливание в виджет) `.ks-drawer`: справа 560 пикселей, на телефоне
во весь экран, под ней `.ks-backdrop`. Четыре обязательных блока по порядку: из чего
сложилась цифра, как менялась (график и таблица), откуда взята (метод, класс, дата, чего
не даёт), что делать. Нет разложения: панель открывается с объяснением, чего не хватает.
Закрывается Esc, кликом мимо, крестиком; фокус возвращается. Открывается мышью, Enter,
пробелом. Один уровень: панель из панели не открывается.

## Ключевой код

Если пакета нет, бери эти куски дословно: в каждом уже исправлена ошибка, найденная
тестами.

### Иконки: система координат 20×20

`viewBox="0 0 20 20"`, штрих 1.7, круглые концы, `stroke="currentColor"`, `aria-hidden="true"`.
В исходном дашборде стоял 24×24 при путях в 20×20: иконки были мельче на пятую часть
и смещены.

Имена Lucide понимаются: `ic('trending-up')` рисует то же, что `ic('up')`. Недостающую иконку
бери из lucide.dev (лицензия ISC) как есть, в её сетке 24: `KS.icons.add('truck', '<path d="..."/>', 24)`.
Штрих пересчитывается по сетке, толщина на экране совпадает с родными. Один набор на весь
интерфейс: смешивать Lucide с Phosphor или эмодзи нельзя.

```js
/* ==========================================================================
   Контур DS · иконки
   Контурные, штрих 1.7, скругления круглые. Система координат 20×20: все пути
   рисованы в ней, поэтому viewBox="0 0 20 20". В Контуре стоял 24×24, из-за
   чего иконки были мельче на пятую часть и смещены к левому верхнему углу.
   Цвет наследуется от текста: currentColor.
   ========================================================================== */
(function(g){
const P = {
  /* разделы */
  grid:'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z',
  chart:'M3 16l4-5 3 3 4-6 3 4',
  search:'M9 3a6 6 0 1 0 0 12A6 6 0 0 0 9 3zM17 17l-3.7-3.7',
  doc:'M5 2h7l3 3v13H5zM12 2v3h3',
  layers:'M10 2.5 2.5 6.5 10 10.5l7.5-4zM2.5 10.5 10 14.5l7.5-4M2.5 14 10 18l7.5-4',
  ai:'M10 2.5 12 7l4.5 2-4.5 2-2 4.5L8 11l-4.5-2L8 7zM16 14l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z',
  mega:'M3 8v4l9 4V4zM12 7.5a2.5 2.5 0 0 1 0 5M3 12v3.5h2.5',
  link:'M8.5 11.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1M11.5 8.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1',
  globe:'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM2 10h16M10 2c2 2.4 3 5 3 8s-1 5.6-3 8c-2-2.4-3-5-3-8s1-5.6 3-8z',
  wallet:'M3 6a2 2 0 0 1 2-2h9v3M3 6v9a2 2 0 0 0 2 2h11V7H5a2 2 0 0 1-2-1zM14 11h1.5',
  pen:'M13.5 3.5 16.5 6.5 7 16H4v-3zM12 5l3 3',
  gear:'M10 6.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zM10 1.8l1 2 2.2-.5 1 1.9 2.2.6-.5 2.2 1.5 1.7-1.5 1.7.5 2.2-2.2.6-1 1.9-2.2-.5-1 2-1-2-2.2.5-1-1.9-2.2-.6.5-2.2L1.6 10l1.5-1.7-.5-2.2 2.2-.6 1-1.9 2.2.5z',
  cmp:'M10 3v14M5 7 2.5 12h5zM15 7l-2.5 5h5zM5 7l5-1.5M15 7l-5-1.5',
  plug:'M7 3v4M13 3v4M5 7h10v3a5 5 0 0 1-10 0zM10 15v3',
  /* сущности */
  users:'M7 9a2.6 2.6 0 1 0 0-5.2A2.6 2.6 0 0 0 7 9zM2.5 16c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2M13.5 8.4a2.2 2.2 0 1 0 0-4.4M14 11.9c2 .3 3.5 1.9 3.5 4.1',
  tag:'M9.5 2.5H3v6.5l8 8 6.5-6.5-8-8zM6 6h.01',
  target:'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  db:'M10 2.5c3.6 0 6.5 1.1 6.5 2.5S13.6 7.5 10 7.5 3.5 6.4 3.5 5 6.4 2.5 10 2.5zM3.5 5v10c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V5M3.5 10c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5',
  bolt:'M11 2 4 11h5l-1 7 7-9h-5z',
  eye:'M1.8 10S4.7 4.8 10 4.8 18.2 10 18.2 10 15.3 15.2 10 15.2 1.8 10 1.8 10zM10 12.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
  clock:'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM10 5.5V10l3 1.8',
  key:'M12.5 3a4.5 4.5 0 0 0-4.3 5.8L3 14v3h3v-2h2v-2h1.7l.5-.5A4.5 4.5 0 1 0 12.5 3zm1.2 3.3h.01',
  list:'M4 6h12M4 10h12M4 14h8',
  tree:'M10 3v4M10 7H5v3M10 7h5v3M3 10h4v3H3zM8 10h4v3H8zM13 10h4v3h-4z',
  /* динамика и статус */
  up:'M4 13l5-5 3 3 4-5',
  loss:'M3 6l5 5 3-3 6 6M17 14v-4h-4',
  'arrow-up':'M10 16V4M5 9l5-5 5 5',
  'arrow-down':'M10 4v12M5 11l5 5 5-5',
  warn:'M10 3 2.5 16.5h15zM10 8v3.5M10 14h.01',
  check:'M4 10.5 8 14l8-8.5',
  info:'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM10 9v5M10 6h.01',
  bulb:'M7.5 15h5M8 17.5h4M10 2.5a5 5 0 0 0-3 9v1.5h6V11.5a5 5 0 0 0-3-9z',
  /* интерфейс */
  menu:'M3 5h14M3 10h14M3 15h14',
  x:'M5 5l10 10M15 5 5 15',
  chev:'M8 5l5 5-5 5',
  'chev-down':'M5 8l5 5 5-5',
  external:'M11 3h6v6M17 3l-8 8M14 11v5H4V6h5',
  filter:'M3 4h14l-5.5 6.5V16l-3 1.5v-7z',
  calendar:'M4 5h12v12H4zM4 9h12M8 3v4M12 3v4',
  download:'M10 3v10M6 9l4 4 4-4M4 17h12',
  sun:'M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M16 4l-1.4 1.4M5.4 14.6 4 16',
  moon:'M17 11.2A7 7 0 1 1 8.8 3a5.5 5.5 0 0 0 8.2 8.2z',
  quote:'M4 5h5v5H6.5v3H4zM11 5h5v5h-2.5v3H11z'
};
/* Имена Lucide (lucide.dev, лицензия ISC): агенты знают их лучше других наборов,
   поэтому ic('trending-up') и ic('up') рисуют одно и то же. */
const ALIAS = {
  'layout-grid':'grid', 'chart-line':'chart', 'file-text':'doc', 'sparkles':'ai', 'megaphone':'mega', 'pencil':'pen',
  'settings':'gear', 'scale':'cmp', 'plug':'plug', 'database':'db', 'zap':'bolt', 'network':'tree', 'list':'list',
  'trending-up':'up', 'trending-down':'loss', 'triangle-alert':'warn', 'lightbulb':'bulb', 'chevron-right':'chev',
  'chevron-down':'chev-down', 'external-link':'external', 'funnel':'filter', 'circle-help':'info'
};
const BOX = {};
/* Недостающую иконку берём из Lucide как есть, в её сетке 24x24:
   KS.icons.add('truck', '<path d="..."/><circle cx="7" cy="18" r="2"/>', 24)
   Штрих пересчитывается по сетке, поэтому на экране толщина совпадает с родными иконками. */
function add(name, inner, box){ P[name] = inner; if(box && box !== 20) BOX[name] = box; }
/* ic('chart')  ic('warn', 15)  ic('check', 14, 'ks-ic my-class')  ic('trending-up') */
function ic(name, size, cls){
  const s = size || 17, key = P[name] ? name : (ALIAS[name] || name), box = BOX[key] || 20;
  const d = typeof P[key] === 'string' ? P[key] : P.grid, inner = d.charAt(0) === '<' ? d : '<path d="' + d + '"/>';
  return '<svg class="' + (cls || 'ks-ic') + '" width="' + s + '" height="' + s + '" viewBox="0 0 ' + box + ' ' + box + '" fill="none" '
    + 'stroke="currentColor" stroke-width="' + (1.7 * box / 20).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + inner + '</svg>';
}
g.KS = g.KS || {};
g.KS.icons = P;
/* служебные поля не перечисляются: Object.keys(KS.icons) это только иконки */
Object.defineProperty(P, 'add', { value:add, enumerable:false });
Object.defineProperty(P, 'alias', { value:ALIAS, enumerable:false });
g.KS.ic = ic;
})(window);
```

### Каркас на телефоне и планшете

```js
/* ---------------- каркас: меню ----------------
   KS.shell.init({ sidebar:'#sb', backdrop:'#bd', menu:'#menu' })
   До 1024 пикселей меню уезжает за край и выезжает поверх по кнопке, закрывается
   кликом мимо, Esc, выбором пункта; страница под ним не прокручивается.
   На широком экране та же кнопка сворачивает меню в полосу иконок. */
KS.shell = (function(){
  const S = { sb:null, bd:null, btn:null };
  const $ = x => typeof x === 'string' ? document.querySelector(x) : x;
  const narrow = () => matchMedia('(max-width:1023px)').matches;
  S.isOpen = () => !!(S.sb && S.sb.classList.contains('is-open'));
  S.open = () => { if(!S.sb) return; S.sb.classList.add('is-open'); if(S.bd) S.bd.hidden = false;
    document.documentElement.classList.add('ks-lock'); if(S.btn) S.btn.setAttribute('aria-expanded', 'true');
    const f = S.sb.querySelector('.ks-nav-item.is-active, .ks-nav-item'); if(f) f.focus(); };
  S.close = () => { if(!S.sb || !S.isOpen()) return; S.sb.classList.remove('is-open'); if(S.bd) S.bd.hidden = true;
    const d = document.getElementById('ks-drawer'); if(!(d && d.classList.contains('is-open'))) document.documentElement.classList.remove('ks-lock');
    if(S.btn){ S.btn.setAttribute('aria-expanded', 'false'); S.btn.focus(); } };
  S.toggle = () => { if(narrow()) (S.isOpen() ? S.close() : S.open()); else if(S.sb) S.sb.classList.toggle('is-collapsed'); };
  S.init = function({ sidebar, backdrop, menu } = {}){
    S.sb = $(sidebar); S.bd = $(backdrop); S.btn = $(menu);
    if(S.btn){ S.btn.classList.add('ks-menu-btn'); if(!S.btn.innerHTML.trim()) S.btn.innerHTML = ic('menu', 18);
      S.btn.setAttribute('aria-expanded', 'false'); if(S.sb && S.sb.id) S.btn.setAttribute('aria-controls', S.sb.id);
      S.btn.addEventListener('click', S.toggle); }
    if(S.bd) S.bd.addEventListener('click', S.close);
    document.addEventListener('keydown', e => { if(e.key === 'Escape' && S.isOpen()) S.close(); });
    /* выбрали пункт на телефоне: меню закрывается само */
    if(S.sb) S.sb.addEventListener('click', e => { if(narrow() && e.target.closest('[data-view]')) S.close(); });
    /* повернули экран или расширили окно: открытое поверх меню не должно остаться висеть */
    matchMedia('(max-width:1023px)').addEventListener('change', () => { S.close(); if(S.sb) S.sb.classList.remove('is-collapsed'); });
    /* лента фильтров шапки: отмечаем, что она не влезла и где её край */
    document.querySelectorAll('.ks-topbar-tools').forEach(t => {
      const upd = () => { const over = t.scrollWidth > t.clientWidth + 1;
        t.classList.toggle('is-overflow', over); t.classList.toggle('is-end', over && t.scrollLeft + t.clientWidth >= t.scrollWidth - 2); };
      t.addEventListener('scroll', upd, { passive:true });
      if(window.ResizeObserver) new ResizeObserver(upd).observe(t); else window.addEventListener('resize', upd);
      if(window.MutationObserver) new MutationObserver(upd).observe(t, { childList:true, subtree:true });
      upd();
    });
    return S;
  };
  return S;
})();
```

Разметка: `<div id="bd" class="ks-backdrop" hidden></div>`, меню `<aside id="sb" class="ks-sidebar">`,
в шапке `<button id="menu" class="ks-btn ks-btn--ghost ks-btn--icon" aria-label="Меню">`, затем
`<div class="ks-topbar-tools">` с сегментом и периодом, `.ks-topbar-spacer`, метка `.ks-stamp.ks-hide-sm`,
кнопка темы.

### Таблица с карточками на узком

```js
/* ---------------- таблица ----------------
   cols: [['Заголовок'], ['Число', true]] второй элемент true значит «числовая, вправо».
   stack: на узком контейнере строки становятся карточками «подпись: значение».
   По умолчанию включается сам, если колонок четыре и больше: три колонки на телефоне
   ещё помещаются строкой. Роли ARIA сохраняют таблицу для экранного диктора, когда
   строки меняют раскладку. */
KS.table = function(cols, rows, { foot, interactive, stack } = {}){
  const st = stack == null ? cols.length >= 4 : !!stack;
  const r = st ? ' role="row"' : '';
  const cell = (c, i, tag) => '<' + tag + (st ? ' role="cell"' : '') + ' data-label="' + esc(cols[i] ? cols[i][0] : '') + '"'
    + (cols[i] && cols[i][1] ? ' class="is-num"' : '') + '>' + (c == null ? '<span class="ks-empty">-</span>' : c) + '</' + tag + '>';
  return '<div class="ks-table-wrap"><table class="ks-table' + (st ? ' ks-table--stack" role="table' : '') + '"><thead><tr' + r + '>'
    + cols.map(c => '<th' + (st ? ' role="columnheader"' : '') + (c[1] ? ' class="is-num"' : '') + ' scope="col">' + esc(c[0]) + '</th>').join('')
    + '</tr></thead><tbody>'
    + rows.map(row => '<tr' + r + (interactive ? ' class="is-interactive" tabindex="0"' : '') + '>' + row.map((c, i) => cell(c, i, 'td')).join('') + '</tr>').join('')
    + '</tbody>' + (foot ? '<tfoot><tr' + r + '>' + foot.map((c, i) => cell(c, i, 'td')).join('') + '</tr></tfoot>' : '')
    + '</table></div>';
};
```

### Конверт цифры

```js
/* ---------------- Протокол 9: конверт цифры ----------------
   Любое значение на экране приезжает в конверте. Выгрузки нет, значит v:null
   и класс ДЕМО. Правдоподобное число вместо null запрещено. */
const KIND = {
  'ДАННЫЕ':   { tone:'ok',   hint:'Есть источник и дата съёма. Можно показывать как факт.' },
  'ГИПОТЕЗА': { tone:'warn', hint:'Бенчмарк или оценка. В план идёт только пессимистичный сценарий.' },
  'ДЕМО':     { tone:'crit', hint:'Заглушка. Выгрузки нет, значение не показывается.' }
};
KS.F = (v, k, s, at, n) => ({ v, k, s: s || '', at: at || '', n: n || '' });
KS.KIND = KIND;

function badge(text, tone, title){
  return '<span class="ks-badge ks-badge--' + (tone || 'neutral') + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(text) + '</span>';
}
function kind(k){ const m = KIND[k]; return m ? badge(k, m.tone, m.hint) : ''; }
/* Значение с источником и датой, приклеенными к самой цифре через title */
function val(f, fmt){
  if(!f || typeof f !== 'object') return esc(f);
  const t = [f.k, f.s, f.at ? 'снято ' + ruDate(f.at) : '', f.n].filter(Boolean).join(' · ');
  const shown = f.v == null ? '<span class="ks-empty">нет</span>' : (fmt ? fmt(f.v) : nf(f.v));
  return '<span title="' + esc(t) + '">' + shown + '</span>';
}
function src(f){
  if(!f || typeof f !== 'object') return '';
  const s = f.s || (f.k === 'ДЕМО' ? 'выгрузки нет, поле ждёт подключения' : 'источник не указан');
  return '<div class="ks-tile-src">' + esc(s) + (f.at ? '<br>снято ' + esc(ruDate(f.at)) : '') + '</div>';
}
KS.badge = badge; KS.kind = kind; KS.val = val; KS.src = src;
```

### Динамика, дельта, вердикт, разрывы, скачки

```js
const dOf = s => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
const S = KS.series = {};
/* Текущий отрезок и предыдущий такой же длины */
S.slice = function(series, days){
  if(!series || !series.length) return { cur:[], prev:[], from:null, to:null, full:false };
  const to = dOf(series[series.length - 1].date);
  const from = new Date(to); from.setUTCDate(from.getUTCDate() - days);
  const pfrom = new Date(from); pfrom.setUTCDate(pfrom.getUTCDate() - days);
  const inR = (d, a, b) => { const x = dOf(d); return x > a && x <= b; };
  return { cur: series.filter(r => inR(r.date, from, to)), prev: series.filter(r => inR(r.date, pfrom, from)),
           from, to, full: dOf(series[0].date) <= from };
};
/* Дельта считается по точкам именно этой метрики. Одна точка значит «сравнивать не с чем»,
   а не «ноль изменений»: ноль это утверждение, его нельзя делать без второй точки. */
S.dyn = function(series, field, days){
  const s = S.slice(series, days);
  const pts = s.cur.filter(r => r[field] != null);
  const prevPts = s.prev.filter(r => r[field] != null);
  const now = pts.length ? pts[pts.length - 1][field] : null;
  const was = pts.length ? pts[0][field] : null;
  const prev = prevPts.length ? prevPts[prevPts.length - 1][field] : null;
  const one = pts.length < 2;
  const abs = (!one && now != null && was != null) ? now - was : null;
  return { now, was, prev, abs, one, points: pts.length,
           rel: (abs != null && was) ? abs / was : null,
           vsPrev: (now != null && prev != null) ? now - prev : null,
           from: pts.length ? pts[0].date : null, to: pts.length ? pts[pts.length - 1].date : null, full: s.full };
};
/* goodUp=false для метрик, где меньше значит лучше: позиция в выдаче, CPL, отказы */
S.tone = (abs, goodUp) => abs == null || abs === 0 ? 'flat' : ((abs > 0) === (goodUp !== false) ? 'good' : 'bad');
KS.delta = function(d, goodUp){
  if(d.one && d.now != null) return '<div class="ks-delta is-na" title="в периоде по этой метрике одна точка">одна точка</div>';
  if(d.abs == null) return '<div class="ks-delta is-na">нет ряда</div>';
  if(d.abs === 0) return '<div class="ks-delta is-flat">без изменений</div>';
  const t = S.tone(d.abs, goodUp);
  const rel = d.rel == null ? '' : ' ' + (d.rel > 0 ? '+' : '') + (d.rel * 100).toFixed(Math.abs(d.rel) < 0.1 ? 1 : 0).replace('.', ',') + '%';
  const title = 'было ' + nf(d.was) + ' на ' + ruDate(d.from) + ', стало ' + nf(d.now) + ' на ' + ruDate(d.to)
    + (d.vsPrev != null ? '; отрезком раньше ' + nf(d.prev) : '');
  return '<div class="ks-delta is-' + t + '" title="' + esc(title) + '">' + ic(d.abs > 0 ? 'arrow-up' : 'arrow-down', 12)
    + '<span class="ks-num">' + (d.abs > 0 ? '+' : '') + nf(d.abs) + rel + '</span></div>';
};
/* Вердикт одной строкой: «Стало лучше», «Стало хуже», «Разнонаправленно» */
KS.verdict = function(series, fields, days, label){
  const rows = fields.map(([f, name, goodUp]) => [name, S.dyn(series, f, days), goodUp]).filter(r => r[1].abs != null);
  const single = fields.map(([f, name]) => [name, S.dyn(series, f, days)]).filter(r => r[1].one && r[1].now != null);
  if(!rows.length) return KS.note('Сравнить не с чем', 'За период ' + esc(label || '') + ' в ряду нет двух точек. Возьми период шире или дождись следующего съёма.', 'warn');
  const good = rows.filter(r => S.tone(r[1].abs, r[2]) === 'good').length;
  const bad  = rows.filter(r => S.tone(r[1].abs, r[2]) === 'bad').length;
  const body = rows.map(([n, d, gu]) => {
    const t = S.tone(d.abs, gu), col = t === 'good' ? 'var(--ok)' : t === 'bad' ? 'var(--crit)' : 'var(--text-muted)';
    return '<div class="ks-row" style="gap:var(--sp-2);align-items:baseline"><span class="ks-strong" style="font-weight:500">' + esc(n) + ':</span>'
      + '<span class="ks-num">' + nf(d.was) + ' на ' + ruDate(d.from) + '</span><span class="ks-muted">до</span>'
      + '<span class="ks-num ks-strong" style="font-weight:600">' + nf(d.now) + ' на ' + ruDate(d.to) + '</span>'
      + '<span class="ks-num" style="font-weight:600;color:' + col + '">' + (d.abs > 0 ? '+' : '') + nf(d.abs) + '</span>'
      + (d.vsPrev != null ? '<span class="ks-muted" style="font-size:var(--fs-caption)">отрезком раньше ' + nf(d.prev) + '</span>' : '') + '</div>';
  }).join('');
  const head = bad === 0 ? 'Стало лучше' : good === 0 ? 'Стало хуже' : 'Разнонаправленно';
  const tone = bad === 0 ? 'ok' : good === 0 ? 'crit' : 'warn';
  const tail = single.length ? ' По метрикам «' + single.map(r => esc(r[0])).join('», «') + '» в периоде одна точка, они в вердикт не входят.' : '';
  return KS.note(head + (label ? ' за ' + label : ''), '<div class="ks-stack" style="gap:var(--sp-1-5);margin-top:var(--sp-1)">' + body + '</div>'
    + '<div class="ks-muted" style="margin-top:var(--sp-2)">Точек в периоде: ' + S.slice(series, days).cur.length + '.' + tail + '</div>', tone);
};
/* Разрывы в ряду: пропущенный съём не восстанавливается, прятать его нельзя */
S.gaps = function(series, maxDays){
  const out = [], lim = maxDays || 8;
  for(let i = 1; i < series.length; i++){
    const dd = (dOf(series[i].date) - dOf(series[i - 1].date)) / 86400000;
    if(dd > lim) out.push({ from: series[i - 1].date, to: series[i].date, days: Math.round(dd) });
  }
  return out;
};
/* Скачок между соседними точками выше порога: либо новость, либо смена методики у источника */
S.anomalies = function(series, field, relLimit){
  const lim = relLimit || 0.4, out = []; let prev = null;
  for(const r of series){
    if(r[field] == null) continue;
    if(prev && prev.v){ const rel = (r[field] - prev.v) / prev.v; if(Math.abs(rel) >= lim) out.push({ from: prev.d, to: r.date, was: prev.v, now: r[field], rel }); }
    prev = { d: r.date, v: r[field] };
  }
  return out;
};
KS.anomalyNote = function(series, field, label){
  const a = S.anomalies(series, field); if(!a.length) return '';
  const x = a[a.length - 1];
  return KS.note('Резкий скачок в ряду: ' + label, 'С ' + ruDate(x.from) + ' по ' + ruDate(x.to) + ' значение изменилось с ' + nf(x.was) + ' на ' + nf(x.now)
    + ' (' + (x.rel > 0 ? '+' : '') + Math.round(x.rel * 100) + '%). Прежде чем показывать это как факт, проверь у источника, не менялась ли методика. '
    + 'Скачок оставлен в ряду как есть: подчищать данные ради ровного графика нельзя.', 'warn');
};
```

### Панель деталей

Делегирование кликов ставится при загрузке, а не при первом открытии: иначе первый клик
по плитке некому поймать.

```js
const D = KS.drawer = { providers:{}, last:null };
D.register = (key, fn) => { D.providers[key] = fn; };
D.ensure = function(){
  if(document.getElementById('ks-drawer')) return;
  const bd = document.createElement('div'); bd.id = 'ks-drawer-bd'; bd.className = 'ks-backdrop'; bd.hidden = true;
  bd.addEventListener('click', () => D.close());
  const el = document.createElement('aside'); el.id = 'ks-drawer'; el.className = 'ks-drawer';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'ks-drawer-title'); el.tabIndex = -1;
  document.body.append(bd, el);
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && el.classList.contains('is-open')) D.close(); });
  /* Любой элемент с data-drill открывает панель: мышью, Enter или пробелом */
  document.addEventListener('click', e => { const t = e.target.closest('[data-drill]'); if(t && !e.target.closest('button,a,input,select')) D.open(t.dataset.drill, t); });
  document.addEventListener('keydown', e => { const t = e.target.closest && e.target.closest('[data-drill]');
    if(t && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); D.open(t.dataset.drill, t); } });
};
/* Делегирование кликов ставится сразу при загрузке, а не при первом открытии:
   иначе первый клик по плитке некому поймать и панель не откроется никогда. */
if(document.readyState !== 'loading') D.ensure(); else document.addEventListener('DOMContentLoaded', D.ensure);

D.open = function(key, origin){
  D.ensure();
  const p = D.providers[key];
  const c = p ? p() : { title: key, missing: true };
  const el = document.getElementById('ks-drawer');
  const blocks = c.missing
    ? KS.note('Деталей для этого показателя нет', 'Выгрузка, из которой он раскладывается, не подключена. ' + esc(c.need || 'Какой метод нужен, описано в регламенте проекта.'), 'warn')
    : [ KS.card({ title:'Из чего сложилась цифра', body: c.compose || KS.note('Разложения нет', esc(c.composeMissing || 'Источник не отдаёт составляющие.'), 'warn') }),
        KS.card({ title:'Как менялась', body: c.trend || '<div class="ks-muted">Ряда нет.</div>', table: c.trendTable }),
        KS.card({ title:'Откуда взята', body: c.source || '<div class="ks-muted">Источник не указан.</div>' }),
        c.action ? KS.action(c.action) : KS.note('Следующий шаг не назначен', 'Нет исполнителя или даты.', 'warn') ].join('');
  el.innerHTML = '<div class="ks-drawer-head"><div><div class="ks-row">' + '<h2 class="ks-h2" id="ks-drawer-title">' + esc(c.title) + '</h2>' + (c.kind ? kind(c.kind) : '') + '</div>'
    + (c.sub ? '<div class="ks-card-sub">' + esc(c.sub) + '</div>' : '') + '</div>'
    + '<button type="button" class="ks-btn ks-btn--ghost ks-btn--icon" aria-label="Закрыть" onclick="KS.drawer.close()">' + ic('x', 18) + '</button></div>'
    + '<div class="ks-drawer-body">' + blocks + '</div>';
  document.getElementById('ks-drawer-bd').hidden = false;
  el.classList.add('is-open'); D.last = origin || null; el.focus();
  document.documentElement.classList.add('ks-lock');
  if(c.afterOpen) requestAnimationFrame(c.afterOpen);
  if(KS.route) KS.route.set({ drill: key });
};
D.close = function(){
  const el = document.getElementById('ks-drawer'); if(!el) return;
  el.classList.remove('is-open'); document.getElementById('ks-drawer-bd').hidden = true;
  if(!(KS.shell && KS.shell.isOpen && KS.shell.isOpen())) document.documentElement.classList.remove('ks-lock');
  /* графики панели уничтожаем вместе с её содержимым, иначе они живут в закрытой панели */
  setTimeout(() => { if(!el.classList.contains('is-open')){ el.innerHTML = ''; if(KS.charts) KS.charts.prune(); } }, 320);
  if(D.last && D.last.focus) D.last.focus();
  if(KS.route) KS.route.set({ drill: null });
};
```

### Маршрут в адресе

```js
/* ---------------- маршрут в адресе ----------------
   Формат #проект.экран.период.показатель, например #gg.dyn-sum.30.top10
   Разделитель точка, а не слэш: в артефакте Claude до location.hash доходят только
   буквы, цифры и символы . _ ~ -. Ссылка со слэшами там молча теряется.
   Поэтому идентификаторы экранов и показателей не должны содержать точку. */
const R = KS.route = { sep:'.', onChange:null };
R.parse = function(){
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const parts = raw.includes('/') ? raw.split('/') : raw.split(R.sep);   /* старые ссылки со слэшем тоже читаем */
  const [project, view, period, drill] = parts;
  return { project: project || null, view: view || null, period: period || null, drill: drill || null };
};
/* Состояние берётся из адреса в момент загрузки кита. Если сначала что-то перерисует
   страницу и перепишет адрес, присланная ссылка на раскрытый показатель потеряется. */
R.state = R.parse();
R.set = function(patch){
  Object.assign(R.state, patch);
  const s = R.state, parts = [s.project, s.view, s.period, s.drill];
  while(parts.length && !parts[parts.length - 1]) parts.pop();
  const h = parts.length ? '#' + parts.map(x => x || '').join(R.sep) : '';
  if(location.hash !== h){ try{ history.replaceState(null, '', h || location.pathname + location.search); }catch(e){} }
};
```

**Порядок старта:** сначала `KS.route.parse()`, потом `KS.theme.init()`, потом отрисовка.
Смена темы перерисовывает экран и переписывает адрес, присланная ссылка иначе теряется.

### Тема

```js
/* ---------------- тема: система, светлая, тёмная ----------------
   Хост (например, просмотрщик артефактов Claude) может сам поставить data-theme
   на корень по выбору зрителя. Пока человек не переключил тему внутри страницы,
   кит этот выбор не трогает: иначе страница перебьёт настройку зрителя. */
const T = KS.theme = {};
T.get = () => document.documentElement.getAttribute('data-theme') || 'system';
T.isDark = () => { const t = T.get(); return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); };
T.emit = () => document.dispatchEvent(new CustomEvent('ks:theme', { detail:{ mode:T.get(), dark:T.isDark() } }));
T.set = function(mode, opts){
  const r = document.documentElement;
  if(mode === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', mode);
  r.classList.toggle('dark', T.isDark());
  if(!opts || opts.persist !== false){ try{ localStorage.setItem('ks-theme', mode); }catch(e){} }
  T.emit();
};
T.toggle = () => T.set(T.isDark() ? 'light' : 'dark');
T.init = function(){
  let m = null; try{ m = localStorage.getItem('ks-theme'); }catch(e){}
  if(m === 'light' || m === 'dark') T.set(m, { persist:false });
  else document.documentElement.classList.toggle('dark', T.isDark());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if(T.get() === 'system'){ document.documentElement.classList.toggle('dark', T.isDark()); T.emit(); } });
  /* хост сменил data-theme сам: перерисовать графики под новую тему */
  new MutationObserver(() => { document.documentElement.classList.toggle('dark', T.isDark()); T.emit(); })
    .observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
};
T.icon = () => ic(T.isDark() ? 'sun' : 'moon', 17);
```

### Графики: основа

Цвета читаются из CSS-переменных контейнера графика. Hex в коде графиков запрещён.

```js
C._el = null;
const v = name => getComputedStyle(C._el || document.documentElement).getPropertyValue(name).trim();
const at = id => { C._el = document.getElementById(id); return C._el; };
C.cat = i => v('--cat-' + (((i - 1) % 5) + 1));      /* слот 1..5 */
C.seq = i => v('--seq-' + Math.max(1, Math.min(5, i)));
C.ink = () => v('--axis');
C.inkStrong = () => v('--text-strong');
C.surface = () => v('--surface');
C.neutral = () => v('--neutral-bar');
C.dark = () => { const box = C._el && C._el.closest('[data-theme]');
  if(box) return box.getAttribute('data-theme') === 'dark';
  return KS.theme ? KS.theme.isDark() : matchMedia('(prefers-color-scheme: dark)').matches; };
const nf = x => KS.fmt ? KS.fmt.nf(x) : String(x);

/* на телефоне у дат вида 20.08.2026 отрезается год: пять подписей помещаются в строку */
C.shortDate = v => typeof v === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(v) ? v.slice(0, 5) : v;
C.base = function(h, type){
  return {
    chart:{ type, height:h, fontFamily:v('--font-sans') || '-apple-system, BlinkMacSystemFont, Golos Text, sans-serif', foreColor:C.ink(),
            toolbar:{ show:false }, parentHeightOffset:0,
            animations:{ enabled:!matchMedia('(prefers-reduced-motion: reduce)').matches, easing:'easeinout', speed:520 } },
    grid:{ borderColor:v('--grid'), strokeDashArray:0, padding:{ left:14, right:18, top:0, bottom:12 } },
    dataLabels:{ enabled:false },
    legend:{ show:false },
    stroke:{ width:2, lineCap:'round', curve:'straight' },
    tooltip:{ theme:C.dark() ? 'dark' : 'light', style:{ fontSize:'12px' } },
    xaxis:{ axisBorder:{ show:false }, axisTicks:{ show:false }, labels:{ style:{ fontSize:'11px' } } },
    yaxis:{ labels:{ style:{ fontSize:'11px' }, formatter: x => nf(Math.round(x)) } },
    states:{ hover:{ filter:{ type:'lighten', value:.06 } } },
    /* телефон: ниже, меньше подписей по оси, уже поля; значения из ширины окна */
    responsive:[{ breakpoint:640, options:{ chart:{ height:Math.round(h * 0.84) }, xaxis:{ tickAmount:4, labels:{ formatter:C.shortDate } }, grid:{ padding:{ left:6, right:10, top:0, bottom:8 } } } }]
  };
};
C.legend = () => ({ show:true, position:'top', horizontalAlign:'left', fontSize:'12px', markers:{ width:9, height:9, radius:3 }, itemMargin:{ horizontal:8 } });
C.pad = function(arr, share){
  const x = arr.filter(n => n != null); if(!x.length) return {};
  const mn = Math.min(...x), mx = Math.max(...x), span = Math.max(1, mx - mn), k = share == null ? 0.18 : share;
  return { min: mn - span * k, max: mx + span * k };
};
C.dateAxis = cats => ({ categories:cats, axisBorder:{ show:false }, axisTicks:{ show:false }, tickAmount:Math.min(6, Math.max(2, cats.length)),
  labels:{ style:{ fontSize:'11px' }, rotate:-38, hideOverlappingLabels:true } });
/* Пустой ряд в ApexCharts даёт размеры NaN и пустую рамку. Вместо этого пишем,
   чего не хватает: график без данных должен выглядеть как отсутствие данных. */
C.empty = function(el, text){
  if(C.inst[el.id]){ try{ C.inst[el.id].destroy(); }catch(e){} delete C.inst[el.id]; }
  el.innerHTML = '<div style="height:100%;min-height:inherit;display:grid;place-items:center;text-align:center;'
    + 'color:var(--text-muted);font-size:var(--fs-small);border:1px dashed var(--border);border-radius:var(--r-md);padding:var(--sp-4)">'
    + (text || 'Данных за период нет') + '</div>';
  return null;
};
const hasData = opt => {
  const s = opt.series; if(!s || !s.length) return false;
  if(typeof s[0] === 'number') return s.some(x => x != null && x !== 0);
  return s.some(x => (x.data || []).some(p => p != null && (typeof p !== 'object' || p.y != null)));
};
C.render = function(id, opt){
  C.prune();
  const el = document.getElementById(id); if(!el) return null;
  if(!hasData(opt)) return C.empty(el, opt.emptyText);
  if(!g.ApexCharts) return C.empty(el, 'Библиотека графиков не загрузилась');
  if(C.inst[id]){ try{ C.inst[id].destroy(); }catch(e){} }
  C.inst[id] = new g.ApexCharts(el, opt); C.inst[id].render(); return C.inst[id];
};
C.destroyAll = () => { Object.values(C.inst).forEach(c => { try{ c.destroy(); }catch(e){} }); C.inst = {}; };
/* Экран перерисовали через innerHTML: контейнеры графиков исчезли, а экземпляры
   ApexCharts остались и продолжают слушать resize окна. На следующем изменении
   размера они рисуют в оторванный от документа узел шириной ноль: отсюда SVG с
   размерами NaN и утечка памяти. Чистим всё, чей контейнер больше не в документе. */
C.prune = function(){
  for(const [id, c] of Object.entries(C.inst)){
    const el = document.getElementById(id);
    if(!el || !el.isConnected || !el.querySelector('.apexcharts-canvas')){ try{ c.destroy(); }catch(e){} delete C.inst[id]; }
  }
};
```

## Графики: правила

| Задача | Форма |
|---|---|
| один ряд по времени | линия, подпись только на последней точке |
| два-три ряда одной природы | линии с легендой; `logarithmic` если различаются на порядки |
| ряды разной величины | индекс: каждый ряд к 100 на старте периода. **Двух осей Y нет никогда** |
| сравнение категорий | горизонтальные полосы, одна серия, число за торцом |
| выделить одного | столбцы: наш `--cat-3`, остальные `--neutral-bar` |
| доля целого | пончик до пяти долей, проценты в легенде, итог в центре; подписи на секторах нет: белое на цветном проваливает контраст |
| матрица | тепловая карта на `--seq-1..5`, классы в легенде |
| одна доля | кольцо |

Правила: одна серия без легенды, две и больше с легендой; категориальные цвета в
фиксированном порядке, максимум пять; сетка сплошная; `curve:'straight'`, сглаживание
рисует несуществующие провалы; ряд из трёх и меньше точек получает маркеры; ось с полями
18% размаха; пустой ряд не отдаётся в ApexCharts, вместо него пустая область с текстом;
подписи дат повёрнуты на 38°, не больше шести; у каждого графика таблица-двойник.

Телефон (окно до 640): высота графика 84%, четыре подписи оси, даты `20.08.2026` без года
(`C.shortDate`); это уже в `C.base` через `responsive`.

Техника: несколько отрисовок в одном кадре сводить в одну (`cancelAnimationFrame` +
`requestAnimationFrame`); после замены экрана через `innerHTML` вызывать `prune()`,
иначе старые экземпляры слушают resize и рисуют в оторванный узел.

## Экран

Сверху вниз:

1. Шапка со строкой про деньги
2. Вердикт «стало лучше или хуже», если экран про динамику
3. Четыре плитки с дельтами
4. Два графика рядом, у каждого таблица-двойник
5. Врезки: что значат цифры, где аномалии
6. Следующий шаг с исполнителем и датой
7. «Что смотреть»: три правила чтения экрана; «Метод и его границы»: запрос, параметры,
   частота съёма, чего метод не даёт

Период выбирается один раз в шапке (7, 30, 90 дней, весь ряд) и действует на все экраны.
Каркас: меню 258 (свёрнутое 72), шапка 58, поле 24 и 16 на узком. До 1024 пикселей меню
уезжает за край и выезжает поверх (`KS.shell`).

## Адаптивность

Каркас меняется по ширине окна, сетки внутри по ширине своего контейнера (`.ks-view`,
`.ks-theme-pane`, `.ks-drawer-body`, `.ks-table-wrap`, `.ks-cq`).

| Окно | Устройство | Что меняется |
|---|---|---|
| до 340 | складной телефон | плитки по одной, когда контейнер уже 300 |
| 340-639 | телефон | меню за краем по кнопке; фильтры шапки лентой вбок с тающим краем; заголовок экрана 16; панель деталей во весь экран; таблицы от 4 колонок карточками; графики ниже, даты без года |
| 640-1023 | планшет | меню за краем; плитки по 2, по 4 от контейнера 680; графики парами от 720 |
| 1024-1279 | ноутбук | меню у края 258, кнопка сворачивает в полосу 72 |
| от 1280 | монитор | графики тройками от контейнера 1080, поле 24, ширина до 1480 |

Касание (`@media (pointer:coarse)`): кнопки, пункты меню, значки 44 (`--tap`), мелкие
кнопки и сегменты 36 (`--tap-sm`), поля и списки 16 (иначе iPhone увеличивает страницу при
фокусе). Подъём по наведению только в `@media (hover:hover)`, на касании отклик `:active`.
Безопасные зоны `env(safe-area-inset-*)` в шапке, меню, панели и поле экрана; высота
`100dvh`; открытые меню или панель блокируют прокрутку страницы (`html.ks-lock`);
`<meta name="theme-color">` для обеих тем; `prefers-contrast: more` и `forced-colors`
поддержаны.

Проверка: 360, 390, 768, 1024, 1440 в обеих темах; нет прокрутки вбок, меню выезжает и
закрывается Esc, панель на телефоне во весь экран, на iPhone кнопка 44 и поле 16.

## Среды

**Артефакт Claude.** Внешние файлы блокируются: токены, стили и скрипты кита вставлять
внутрь страницы. Разрешены Google Fonts (Golos Text) и cdnjs (ApexCharts 3.54.1). `window.print()`
не работает: кнопку «Печать» не ставить. До `location.hash` доходят только буквы, цифры
и `. _ ~ -`: маршрут через точку. Хост сам ставит `data-theme`, не перебивать его.
Отступ шапки с учётом `env(safe-area-inset-top)`.

**Pages и локальный файл.** Файлы ссылками, печать работает.

**Tailwind v3.** Пресет `kontur-ds/tokens/tailwind.preset.js`, цвета ссылаются на переменные.

**shadcn/ui и Tailwind v4.** `tokens/shadcn.css` после `tokens.css`: имена shadcn
(`--background`, `--card`, `--muted-foreground`, `--ring`, `--chart-1..5`, `--sidebar-*`)
указывают на токены Контура, блок `@theme inline` даёт утилиты `bg-background` и так далее.
`--primary`, `--primary-foreground`, `--border` у Контура совпадают с shadcn по смыслу.
Тёмная тема и через `data-theme="dark"`, и через `.dark` на корне. Мост объявлен на каждом
`[data-theme]`: иначе вложенная тёмная панель унаследует светлые значения корня.

**React, Vue.** Переносятся классы `ks-*`, токены и логика конверта и динамики.

## Раскладка без прокрутки вбок

- Дорожки сетки только `minmax(0,1fr)`, не `1fr`.
- Строка элементов с прокруткой внутри флекс-колонки: `min-width:0` на ней и на родителе.
- Широкие таблицы в `.ks-table-wrap`, код в своём контейнере с `overflow-x:auto`.
- `html{overflow-x:clip}` только страховка: на корне clip работает как hidden, и
  scrollIntoView всё равно утащит страницу вбок. Источник переполнения чинить по месту.

## Запреты

| Код | Что | Почему |
|---|---|---|
| TOKENS | текст, бейдж, кнопка, фокус ниже контраста | бейджи «гипотеза» и «серьёзно» уже были ниже 4,5:1 |
| PALETTE | палитра графиков не проходит валидатор | синий с голубым неразличимы |
| HEX | цвет в компоненте или графике мимо токенов | тема меняется, цвет остаётся |
| OPACITY | текст приглушён прозрачностью | 2,26:1 вместо 4,5:1 |
| DUALAXIS | две оси Y | выдуманная корреляция |
| CVD | `#5D87FF` и `#49BEFF` соседями | неразличимы при дейтеранопии |
| EMDASH | длинное тире | только дефис |
| ENVELOPE | ДАННЫЕ без источника или даты, `null` как ДАННЫЕ | заглушка рядом с фактом |
| LAYOUTANIM | `transition` по ширине, высоте, отступам | перерасчёт раскладки каждый кадр |
| BOUNCE | `cubic-bezier` с параметром вне 0..1 | пружина выглядит устаревшей и мешает читать |
| FONTFLOOR | текст мельче 11px в токенах, CSS, подписях графиков | было 9,5 и 10,5 |
| FAINTTEXT | `--text-faint` на тексте для чтения | 3,3:1 на светлой |
| SYNC | копии тёмной темы разъехались | разные цвета у зрителей с атрибутом и без |
| CONTRAST | с `--live`: реальный текст на реальном фоне ниже WCAG | ловит то, что не видно в токенах: подложку поверх подложки, подписи на плашках |
| VIEWPORT | у страницы нет `meta viewport` | телефон показывает уменьшенную копию десктопа |
| HOVERLIFT | подъём в `:hover` вне `@media (hover:hover)` | на касании плитка залипает |
| MONONUM | цифры в столбик моноширинным | в 1.2 цифры шрифтом интерфейса с табличными цифрами |

Вид: капс только в коротких метках до трёх слов; карточку в карточку не вкладывать;
плашку с иконкой над заголовком и абзацем (шаблон карточек-фич с лендингов) не ставить,
плитка показателя не в счёт: там плашка в одной строке с бейджем класса; мигающих точек нет.

Смысл: не выводить оценку трафика там, где есть настоящая аналитика; не сглаживать скачки
в рядах; не смешивать брендовые рекламные кампании с остальными в одной средней; ни одна
рекламная кампания не запускается и не пополняется без подтверждения владельца, что бы ни
показывал экран.

## Чек-лист приёмки

- [ ] Шапка со строкой про деньги на каждом экране
- [ ] Каждая цифра в конверте, ДЕМО не притворяется данными
- [ ] Дельта на каждой плитке, период из шапки действует на все экраны
- [ ] У каждого графика таблица-двойник
- [ ] Двух осей Y нет, цвета графиков только `--cat`, `--seq`, `--div`
- [ ] Прозрачности на тексте нет
- [ ] Следующий шаг с исполнителем и датой
- [ ] Панель деталей открывается мышью, Enter и ссылкой, закрывается Esc
- [ ] Обе темы на 360, 390, 768 и 1440 просмотрены глазами, прокрутки вбок нет
- [ ] На телефоне меню выезжает и закрывается, фильтры шапки едут вбок, кнопки 44, поля 16
- [ ] Ни одного длинного тире
- [ ] Если есть пакет: `check_ds.py страница.html --live` зелёный
- [ ] `npx impeccable detect` без замечаний, кроме известных ложных: контраст внутри
      вложенной темы (детектор не видит фон `[data-theme]`) и 11px в строках источника

## Внешние ресурсы: что взято, что нет

Взято и встроено: Impeccable (правила LAYOUTANIM, BOUNCE, FONTFLOOR, FAINTTEXT и второе
мнение перед сдачей), whocanuse (автомат `contrast_live.mjs` вместо ручной проверки),
Lucide (имена и источник недостающих иконок), shadcn/ui (мост имён), utopia.fyi (плавное
значение плитки), easings.net (три кривые, без пружин).

Для рабочих интерфейсов не брать: Dribbble и Awwwards как образец дашборда (выдуманные
данные, нечитаемые графики), анимированные блоки reactbits, фоны haikei, сгенерированные
картинки. Это инструменты лендингов, там действуют гайды брендов. Шрифты не с Google Fonts
(например Fontshare) в артефакт Claude не загрузятся: только вложить файлом. SF берётся
только системным стеком, файлом его вкладывать нельзя.
