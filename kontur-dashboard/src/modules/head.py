# -*- coding: utf-8 -*-
# Шапка документа. Вид целиком из Контур DS 1.5 (kontur-ds/ в корне репозитория):
# src/build.py вставляет tokens.css и kit.css вместо меток /*TOKENS*/ и /*KIT*/.
# Tailwind больше не подключается: экранам хватает кита и короткого слоя ниже.
# ApexCharts закреплён хэшем (SRI): хэш снят с npm-пакета apexcharts@3.54.1, тот же файл
# лежит на cdnjs; kontur-snapshot.yml перед тестами сверяет хэш файла с cdnjs.
HEAD = r'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F6F7F9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F1216" media="(prefers-color-scheme: dark)">
<meta name="robots" content="noindex,nofollow">
<title>Контур: SEO, GEO, Директ</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&display=swap">
<style id="ks-tokens">
/*TOKENS*/
</style>
<style id="ks-kit">
/*KIT*/
</style>
<style id="kontur-local">
/*LOCAL*/
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/apexcharts/3.54.1/apexcharts.min.js" integrity="sha384-KNaFJ+EK516RuHsoycvreec5pD7BkTKJEkjMrVSQWu9KGTl7En4dhIDv7t1DFJ+g" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
</head>
'''

# Локальный слой. Только раскладка и типографика экранов, все значения из токенов:
# ни одного своего цвета, размера шрифта мельче 11 пикселей и прозрачности на тексте.
LOCAL_CSS = r'''
/* блок с примером JSON прокручивается сам, а не тянет за собой всю страницу */
pre{ overflow-x:auto; max-width:100%; }
.ks-view{ min-width:0; }

/* раскладка внутри карточек */
.flex{ display:flex; } .inline-flex{ display:inline-flex; }
.flex-1{ flex:1 1 0%; min-width:0; } .shrink-0{ flex-shrink:0; }
.items-center{ align-items:center; } .items-start{ align-items:flex-start; } .justify-center{ justify-content:center; }
.gap-1\.5{ gap:var(--sp-1-5); } .gap-2{ gap:var(--sp-2); } .gap-2\.5{ gap:var(--sp-2-5); }
.space-y-1\.5 > * + *{ margin-top:var(--sp-1-5); } .space-y-2 > * + *{ margin-top:var(--sp-2); }
.space-y-2\.5 > * + *{ margin-top:var(--sp-2-5); } .space-y-3 > * + *{ margin-top:var(--sp-3); }
.mt-\[2px\]{ margin-top:var(--sp-0-5); } .mt-1{ margin-top:var(--sp-1); } .mt-3{ margin-top:var(--sp-3); }
.mt-4{ margin-top:var(--gap-stack); } .mb-1{ margin-bottom:var(--sp-1); } .mb-4{ margin-bottom:var(--gap-stack); }
.p-3{ padding:var(--sp-3); } .px-3{ padding-left:var(--sp-3); padding-right:var(--sp-3); }
.py-1\.5{ padding-top:var(--sp-1-5); padding-bottom:var(--sp-1-5); }
.pt-1{ padding-top:var(--sp-1); } .pt-3{ padding-top:var(--sp-3); } .pl-5{ padding-left:var(--sp-5); }
.w-5{ width:20px; } .h-5{ height:20px; } .w-6{ width:24px; } .h-6{ height:24px; }
.max-w-3xl{ max-width:48rem; } .overflow-x-auto{ overflow-x:auto; }
.break-words{ overflow-wrap:anywhere; } .break-all{ word-break:break-all; }
.list-decimal{ list-style:decimal; }
.rounded-md{ border-radius:var(--r-md); } .rounded-lg{ border-radius:var(--r-md); }
.border{ border:1px solid var(--border); } .border-t{ border-top:1px solid var(--border); }
.bdr{ border-color:var(--border); }
.soft{ background:var(--surface-2); }

/* типографика: четыре ступени кита, пол 11 пикселей */
.t-micro{ font-size:var(--fs-micro); } .t-cap{ font-size:var(--fs-caption); }
.t-small{ font-size:var(--fs-small); } .t-body{ font-size:var(--fs-body); }
.font-medium{ font-weight:var(--fw-medium); } .font-semibold{ font-weight:var(--fw-semi); } .font-bold{ font-weight:var(--fw-bold); }
.leading-tight{ line-height:var(--lh-tight); } .leading-snug{ line-height:var(--lh-snug); } .leading-relaxed{ line-height:var(--lh-body); }
.hd{ color:var(--text-strong); }
.num{ font-variant-numeric:tabular-nums; }
.ok-i{ color:var(--ok); } .crit-i{ color:var(--crit); }

/* Экран это стопка кита: блоки идут через --gap-stack и поднимаются по очереди
   (.ks-fade > .ks-stack). Старые отступы блоков верхнего уровня гасятся, иначе
   расстояние удваивается или пропадает там, где его никто не поставил. */
.scr > .mt-4, .scr > .mb-4, .scr > .ks-page-head{ margin-top:0; margin-bottom:0; }

/* Бейдж раздела в меню («данные» или «нет»): в ките у его обёртки flex:0, и на
   ширине меню 248 бейдж уезжал за край под стрелку. Держим его по содержимому. */
.ks-nav-item > .ks-lbl:has(> .ks-badge){ flex:0 0 auto !important; }

/* Источник у плитки бывает путём файла без пробелов: переносим где угодно,
   иначе на телефоне он вылезает за плитку. */
.ks-tile-src{ overflow-wrap:anywhere; }

/* между ячейками таблицы и знаком класса цифры */
.ks-table .ks-kind{ margin-left:var(--sp-1); }

/* окно пароля: те же поверхности и поля, что у приложения */
.gate{ position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center;
  padding:var(--sp-4); background:var(--bg); color:var(--text); font-family:var(--font-sans); }
.gate-box{ width:min(380px, 100%); }
.gate-box .ks-card-title{ margin-bottom:var(--sp-2); }
.gate-box p{ margin:0 0 var(--sp-3); font-size:var(--fs-body); line-height:var(--lh-body); color:var(--text-muted); }
.gate-form{ display:flex; flex-direction:column; gap:var(--sp-2-5); }
.gate-err{ display:none; color:var(--crit); font-size:var(--fs-small); }

@media print{
  .ks-sidebar, .ks-topbar, .ks-noprint{ display:none !important; }
  .ks-card{ break-inside:avoid; box-shadow:none !important; }
}
'''
