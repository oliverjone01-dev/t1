#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сторож, который всегда зелёный, бесполезен. С ключом --live проверяет и живой слой (1.5.1). Подсовываем ему испорченные версии,
каждая обязана быть поймана. Файлы восстанавливаются после каждого случая."""
import subprocess, sys, shutil, re
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
TOK, KIT, CH = HERE/'tokens'/'tokens.css', HERE/'kit'/'kit.js', HERE/'kit'/'charts.js'
KCSS = HERE/'kit'/'kit.css'
EM = '\u2014'
PAGE = HERE/'tools'/'_tamper_page.html'
CASES = [
 ('приглушённый текст провалил контраст', TOK, lambda s: s.replace('--text-muted:  #5A616C;', '--text-muted:  #A9B1BF;', 1)),
 ('тёмный текст провалил контраст',       TOK, lambda s: s.replace('--text:        #BAC0C9;', '--text:        #3A3F47;', 1)),
 ('бейдж внимания провалил контраст',      TOK, lambda s: s.replace('--warn:    #855A00;', '--warn:    #C99A2E;', 1)),
 ('кнопка: текст на акценте',              TOK, lambda s: s.replace('--primary:       #3561C9;', '--primary:       #9DB6F0;', 1)),
 ('палитра: синий рядом с голубым',        TOK, lambda s: s.replace('--cat-2: #00806A;', '--cat-2: #2F74D0;', 1)),
 ('hex в компонентах',                     KIT, lambda s: s.replace("return '<span class=\"ks-badge ks-badge--'", "return '<span style=\"color:#FF00AA\" class=\"ks-badge ks-badge--'", 1)),
 ('hex в графиках',                        CH,  lambda s: s.replace("colors:[C.cat(slot || 3)]", "colors:['#FF00AA']", 1)),
 ('две оси Y',                             CH,  lambda s: s.replace("yaxis:{ min:lo, max:hi,", "yaxis:[{ min:lo, max:hi,", 1)),
 ('длинное тире',                          KIT, lambda s: s.replace('Следующий шаг', 'Следующий ' + EM + ' шаг', 1)),
 ('бейдж на поднятом слое',                TOK, lambda s: s.replace('--ok:      #0D7049;', '--ok:      #0F7A52;', 1)),
 ('анимация ширины',                       KCSS, lambda s: s.replace('.ks-chev{ transition:transform', '.ks-chev{ transition:width', 1)),
 ('пружинящая кривая',                     TOK, lambda s: s.replace('--ease-out: cubic-bezier(.2,.8,.2,1);', '--ease-out: cubic-bezier(.34,1.56,.64,1);', 1)),
 ('шрифт мельче 11px в токенах',           TOK, lambda s: s.replace('--fs-micro:  11px;', '--fs-micro:  10px;', 1)),
 ('шрифт мельче 11px в графике',           CH,  lambda s: s.replace("labels:{ style:{ fontSize:'11px' }, rotate:-38", "labels:{ style:{ fontSize:'9px' }, rotate:-38", 1)),
 ('копии тёмной темы разъехались',         TOK, lambda s: s.replace('--neutral:#959CA8; --neutral-soft', '--neutral:#8C93A0; --neutral-soft', 1)),
 ('подъём по наведению на касании',        KCSS, lambda s: s.replace('@media (hover:hover){ .ks-tile.is-interactive:hover{ background-color:var(--surface-2); } }', '.ks-tile.is-interactive:hover{ background-color:var(--surface-2); transform:translateY(-2px); }', 1)),
 ('цветная полоса сбоку',                  KCSS, lambda s: s.replace('.ks-note--warn{ --tone:var(--warn); }', '.ks-note--warn{ --tone:var(--warn); border-left:3px solid var(--warn); }', 1)),
 ('бейдж капсом',                          KCSS, lambda s: s.replace('padding:2px 7px; border-radius:var(--r-sm); line-height:1.35;', 'padding:2px 7px; text-transform:uppercase; border-radius:var(--r-sm); line-height:1.35;', 1)),
 ('градиент на знаке бренда',              KCSS, lambda s: s.replace('color:var(--surface); background:var(--text-strong); flex-shrink:0; }', 'color:var(--surface); background:linear-gradient(135deg,var(--cat-3),var(--cat-1)); flex-shrink:0; }', 1)),
 ('цифры моноширинным',                    KCSS, lambda s: s.replace('.ks-num{ font-family:var(--font-sans);', '.ks-num{ font-family:var(--font-mono);', 1)),
 ('бледный текст для чтения',              KCSS, lambda s: s.replace('.ks-empty{ color:var(--text-muted); }', '.ks-empty{ color:var(--text-faint); }', 1)),
 ('пульсирующая плитка',                   KCSS, lambda s: s.replace('.ks-tile.is-interactive{ cursor:pointer; }', '.ks-tile.is-interactive{ cursor:pointer; animation:ks-rise 2s ease infinite; }', 1)),
 ('компакт уменьшил цель пальца',          TOK, lambda s: s.replace('  --nav-y: 5px;\n  --topbar-h: 52px;', '  --nav-y: 5px; --tap: 32px;\n  --topbar-h: 52px;', 1)),
 ('текст на основной кнопке',              TOK, lambda s: s.replace('--action-foreground: #FFFFFF;', '--action-foreground: #3A404A;', 1)),
 ('переход без «меньше движения»',         KCSS, lambda s: s.replace('  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*){ animation:none !important; }\n', '', 1)),
]
# Подмены на странице проекта: (название, содержимое, тип файла, код правила, который обязан сработать).
# 1.5.1: сюда вошли 54 обхода из первой пробы ФЕНИКСА на ОП ГМ, 35 из второй и 26 своих вариантов по тем же классам. Четыре узких блока
# без контекста (.bar без заголовка и без привязки к краю) статика не решает: по CSS полоса неотличима от столбика
# графика. Они проверяются живым слоем в отрисовке (LIVE_CASES).
PAGE_CASES = [
 ('ФЕНИКС-2 N1 цвет полосы в правиле состояния (transparent -> is-active)', '<style>.op-nav a{ border-left:3px solid transparent; } .op-nav a.is-active{ border-left-color:var(--primary); }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС-2 N2 нейтральная рамка, цвет в is-warn', '<style>.op-card{ border-left:3px solid var(--border); } .op-card.is-warn{ border-left-color:var(--warn); }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС-2 N3 вложенный CSS: полоса у родителя до вложенного правила', '<style>.op-card{ border-left:3px solid var(--warn); &:hover{ background:var(--surface-2); } }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС-2 N4 вложенный CSS: полоса у родителя после вложенного правила', '<style>.op-card{ &:hover{ background:var(--surface-2); } border-left:3px solid var(--warn); }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС-2 N5 ::before с inset:0 auto 0 0', '<style>.q{ position:relative; } .q::before{ content:""; position:absolute; inset:0 auto 0 0; width:3px; background:var(--warn); }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС-2 N6 el.style.cssText в JS', "row.style.cssText = 'border-left:3px solid var(--warn)';\n", 'js', 'SIDESTRIPE'),
 ('ФЕНИКС-2 N7 setAttribute(style) в JS', "row.setAttribute('style', 'border-left:3px solid var(--warn)');\n", 'js', 'SIDESTRIPE'),
 ('ФЕНИКС-2 N8 createElement(style).textContent в JS', "const st = document.createElement('style'); st.textContent = '.q{ border-left:3px solid var(--warn); }'; document.head.appendChild(st);\n", 'js', 'SIDESTRIPE'),
 ('ФЕНИКС-2 N9 insertRule в JS', "document.styleSheets[0].insertRule('.q{ border-left:3px solid var(--warn); }');\n", 'js', 'SIDESTRIPE'),
 ('ФЕНИКС-2 N10 край градиента к цвету поверхности, не к transparent', '<style>.q{ background:linear-gradient(90deg, var(--warn) 4px, var(--surface) 4px); }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС-2 N11 полоса размером фона (градиент 3px x 100%)', '<style>.q{ background:linear-gradient(var(--warn),var(--warn)) left / 3px 100% no-repeat; }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС-2 N12 border-inline + обнулённый конец', '<style>.q{ border-inline:3px solid var(--warn); border-inline-end:0; }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС-2 N14 вложенный CSS: капс у родителя', '<style>.op-badge{ text-transform:uppercase; &.is-new{ color:var(--ok); } }</style>', 'html', 'CAPSBADGE'),
 ('ФЕНИКС-2 N15 исключение по слову input в любом месте селектора', '<style>.op-field input + .op-status{ text-transform:uppercase; }</style>', 'html', 'CAPSBADGE'),
 ('ФЕНИКС-2 N16 el.style.cssText капс', "badge.style.cssText = 'text-transform:uppercase';\n", 'js', 'CAPSBADGE'),
 ('ФЕНИКС-2 N17 createElement(style) капс', "const st = document.createElement('style'); st.textContent = '.op-badge{ text-transform:uppercase; }';\n", 'js', 'CAPSBADGE'),
 ('ФЕНИКС-2 N18 второй animate бесконечный (первый конечный)', '<script>a.animate([{opacity:0},{opacity:1}],{duration:200,iterations:1}); dot.animate([{transform:"scale(1)"},{transform:"scale(1.3)"}],{duration:900,iterations:Infinity});</script>', 'html', 'LOOPANIM'),
 ('ФЕНИКС-2 N19 createElement(style) с infinite', "const st = document.createElement('style'); st.textContent = '.dot{ animation:op-pulse 1s infinite; }';\n", 'js', 'LOOPANIM'),
 ('ФЕНИКС-2 N20 вложенный CSS: infinite у родителя после вложенного', '<style>.op-live{ &::before{ content:""; } animation:op-pulse 1s infinite; }</style>', 'html', 'LOOPANIM'),
 ('ФЕНИКС-2 N21 iterations: 1e9', 'dot.animate([{opacity:1},{opacity:.3}],{duration:900,iterations:1e9});\n', 'js', 'LOOPANIM'),
 ('ФЕНИКС-2 N22 свой @keyframes ks-spin как пульс у .op-sync-dot', '<style>.op-sync-dot{ animation:ks-spin 1s ease infinite; } @keyframes ks-spin{ 50%{ opacity:.2; } }</style>', 'html', 'LOOPANIM'),
 ('ФЕНИКС-2 N23 rgb() с альфой через слэш (CSS Color 4)', '<style>.op-sub{ color:rgb(17 24 39 / .6); }</style>', 'html', 'OPACITY'),
 ('ФЕНИКС-2 N24 color-mix(..., transparent) как в самом ките', '<style>.op-sub{ color:color-mix(in oklab, var(--text) 60%, transparent); }</style>', 'html', 'OPACITY'),
 ('ФЕНИКС-2 N25 hsl() с альфой через слэш', '<style>.op-sub{ color:hsl(220 13% 18% / 60%); }</style>', 'html', 'OPACITY'),
 ('ФЕНИКС-2 N26 исключение по :disabled внутри :not()', '<style>.op-btn:not(:disabled) .op-meta{ opacity:.6; }</style>', 'html', 'OPACITY'),
 ('ФЕНИКС-2 N27 исключение по svg в соседнем селекторе', '<style>.op-stat svg + b{ opacity:.6; }</style>', 'html', 'OPACITY'),
 ('ФЕНИКС-2 N28 el.style.cssText opacity', "hint.style.cssText = 'opacity:.55';\n", 'js', 'OPACITY'),
 ('ФЕНИКС-2 N29 вложенный CSS: opacity у родителя', '<style>.op-hint{ opacity:.55; &:hover{ opacity:1; } }</style>', 'html', 'OPACITY'),
 ('ФЕНИКС-2 N30 относительный цвет rgb(from var(--text) r g b / .6)', '<style>.op-sub{ color:rgb(from var(--text) r g b / .6); }</style>', 'html', 'OPACITY'),
 ('ФЕНИКС-2 N32 вложенный CSS: [data-density=compact]{ .op-btn{height:28px} }', '<style>[data-density="compact"]{ .op-btn{ height:28px; } }</style>', 'html', 'DENSITYTAP'),
 ('ФЕНИКС-2 N33 svg-знак внутри ссылки .op-brand (класс на обёртке)', '<a class="op-brand" href="#"><svg width="28" height="28"><defs><linearGradient id="g"><stop offset="0" stop-color="#3561C9"/><stop offset="1" stop-color="#00806A"/></linearGradient></defs><rect width="28" height="28" rx="6" fill="url(#g)"/></svg></a>', 'html', 'GRADMARK'),
 ('ФЕНИКС-2 N34 вложенный CSS: градиент у родителя', '<style>.op-logo{ background:linear-gradient(135deg,var(--cat-1),var(--cat-3)); &:hover{ filter:brightness(1.1); } }</style>', 'html', 'GRADMARK'),
 ('ФЕНИКС-2 N35 длинное тире CSS-экранированием content:"\\2014"', '<style>.op-sep::before{ content:"\\2014"; }</style>', 'html', 'EMDASH'),
 ('ФЕНИКС-2 N36 String.fromCharCode(8212)', 'sep.textContent = String.fromCharCode(8212);\n', 'js', 'EMDASH'),
 ('ФЕНИКС-2 N37 цвет мимо токенов rgb() (docstring HEX: «цвет мимо токенов»)', '<style>.x{ color:rgb(255 0 170); }</style>', 'html', 'HEX'),
 ('страница без viewport', '<!doctype html><html><head><title>x</title></head><body>телефон</body></html>', 'html', 'VIEWPORT'),
 ('прозрачность на тексте', '<div class="opacity-55">подпись</div>', 'html', 'OPACITY'),
 ('ДАННЫЕ без источника', '<script>\nconst DB = {"x":{"v":1,"k":"ДАННЫЕ","s":"","at":"2026-09-01"}};\n</script>', 'html', 'ENVELOPE'),
 ('пустое значение как ДАННЫЕ', '<script>\nconst DB = {"x":{"v":null,"k":"ДАННЫЕ","s":"api","at":"2026-09-01"}};\n</script>', 'html', 'ENVELOPE'),
 ('неизвестный класс', '<script>\nconst DB = {"x":{"v":1,"k":"ПРИМЕРНО","s":"api","at":"2026-09-01"}};\n</script>', 'html', 'ENVELOPE'),
 ('синий и голубой соседями', '<script>opt={colors:["#5D87FF","#49BEFF"]}</script>', 'html', 'CVD'),
 ('полоса через алиас цвета', '<style>.x .q{ border-left:3px solid var(--accent); }</style>', 'html', 'SIDESTRIPE'),
 ('полоса узким блоком-span', '<style>.sec .bar{ width:3px; height:17px; background:var(--primary); }</style>', 'html', 'SIDESTRIPE'),
 ('полоса тенью inset', '<style>.q{ box-shadow: inset 3px 0 0 var(--primary); }</style>', 'html', 'SIDESTRIPE'),
 ('полоса раздельными свойствами', '<style>.q{ border-left-width:3px; border-left-style:solid; border-left-color:var(--crit); }</style>', 'html', 'SIDESTRIPE'),
 ('полоса справа', '<style>.q{ border-right:4px solid var(--warn); }</style>', 'html', 'SIDESTRIPE'),
 ('своя плашка капсом', '<style>.op-chip{ text-transform:uppercase; }</style>', 'html', 'CAPSBADGE'),
 ('статус капсом', '<style>.ks-status.x{ text-transform:uppercase; }</style>', 'html', 'CAPSBADGE'),
 ('градиент на своём логотипе', '<style>.op-logo{ background:linear-gradient(90deg,var(--primary),var(--cat-1)); }</style>', 'html', 'GRADMARK'),
 ('бесконечный цикл через animate', '<script>document.body.animate([{opacity:1},{opacity:.4}],{duration:900,iterations:Infinity});</script>', 'html', 'LOOPANIM'),
 ('бесконечный цикл строкой в JS', '<script>const h = \'<i style="animation:op-pulse 1s infinite"></i>\';</script>', 'html', 'LOOPANIM'),
 ('прозрачность текста в CSS', '<style>.op-hint{ opacity:.55; }</style>', 'html', 'OPACITY'),
 ('прозрачность во встроенном стиле', '<p style="opacity:.6">подпись</p>', 'html', 'OPACITY'),
 ('свой компакт уменьшил кнопку', '<style>[data-density="compact"] .op-btn{ min-height:var(--ctl-h-sm); }</style>', 'html', 'DENSITYTAP'),
 ('ФЕНИКС S1 цвет опущен (currentColor по умолчанию)', '<style>.q{ color:var(--crit); border-left:3px solid; }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S2 именованный цвет', '<style>.q{ border-left:3px solid orange; }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S3 ширина в rem', '<style>.q{ border-left:.25rem solid var(--warn); }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S4 ширина словом thick', '<style>.q{ border-left:thick solid var(--warn); }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S5 ::before top:0 bottom:0 width:3px', '<style>.q{ position:relative; } .q::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--primary); }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S8 градиентом в фоне', '<style>.q{ background:linear-gradient(90deg, var(--warn) 3px, transparent 3px); }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S9 внешняя тень -3px 0 0', '<style>.q{ box-shadow:-3px 0 0 var(--warn); }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S10 inset в конце', '<style>.q{ box-shadow:3px 0 0 var(--warn) inset; }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S11 inset с двумя длинами', '<style>.q{ box-shadow:inset 3px 0 var(--warn); }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S12 встроенный style= в HTML', '<div style="border-left:3px solid var(--warn)">текст</div>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S13 el.style.borderLeft в JS', "row.style.borderLeft = '3px solid var(--warn)';\n", 'js', 'SIDESTRIPE'),
 ('ФЕНИКС S14 border-width 0 0 0 3px', '<style>.q{ border-style:solid; border-color:var(--warn); border-width:0 0 0 3px; }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S15 border + обнуление трёх сторон', '<style>.q{ border:3px solid var(--warn); border-top:0; border-right:0; border-bottom:0; }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S16 через свою переменную', '<style>.q{ --s:3px solid var(--warn); border-left:var(--s); }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S17 currentcolor строчными', '<style>.q{ color:var(--crit); border-left:3px solid currentcolor; }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S20 нейтральный токен перекрашен', '<style>.op{ --border-strong:var(--warn); } .op .q{ border-left:3px solid var(--border-strong); }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС S21 полоса в @media', '<style>@media (min-width:640px){ .q{ border-left:3px solid var(--warn); } }</style>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС C1 метка .op-label', '<style>.op-label{ text-transform:uppercase; letter-spacing:.06em; }</style>', 'html', 'CAPSBADGE'),
 ('ФЕНИКС C2 флажок статуса .op-flag', '<style>.op-flag{ text-transform:uppercase; }</style>', 'html', 'CAPSBADGE'),
 ('ФЕНИКС C3 font-variant-caps у бейджа', '<style>.ks-badge.x{ font-variant-caps:all-small-caps; }</style>', 'html', 'CAPSBADGE'),
 ('ФЕНИКС C4 встроенный style= у бейджа', '<span class="ks-badge" style="text-transform:uppercase">новый</span>', 'html', 'CAPSBADGE'),
 ('ФЕНИКС C5 кикер легаси .ph-kicker', '<style>.ph-kicker{ text-transform:uppercase; letter-spacing:.12em; }</style>', 'html', 'CAPSBADGE'),
 ('ФЕНИКС G1 знак .op-emblem', '<style>.op-emblem{ background:linear-gradient(135deg,var(--cat-3),var(--cat-1)); }</style>', 'html', 'GRADMARK'),
 ('ФЕНИКС G2 svg-логотип с linearGradient', '<svg class="op-logo" width="28" height="28"><defs><linearGradient id="g"><stop offset="0" stop-color="#3561C9"/><stop offset="1" stop-color="#00806A"/></linearGradient></defs><rect width="28" height="28" rx="6" fill="url(#g)"/></svg>', 'html', 'GRADMARK'),
 ('ФЕНИКС L1 animation-iteration-count 9999', '<style>.dot{ animation:op-pulse 1s 9999; }</style>', 'html', 'LOOPANIM'),
 ('ФЕНИКС L2 SMIL repeatCount=indefinite', '<svg width="8" height="8"><circle cx="4" cy="4" r="4"><animate attributeName="opacity" values="1;.3;1" dur="1s" repeatCount="indefinite"/></circle></svg>', 'html', 'LOOPANIM'),
 ('ФЕНИКС L3 el.style.animation = ... infinite (JS)', "dot.style.animation = 'op-pulse 1s infinite';\n", 'js', 'LOOPANIM'),
 ('ФЕНИКС L4 animationIterationCount (JS)', "dot.style.animationIterationCount = 'infinite';\n", 'js', 'LOOPANIM'),
 ('ФЕНИКС L5 iterations: Number.POSITIVE_INFINITY', "dot.animate([{transform:'scale(1)'},{transform:'scale(1.4)'}], {duration:900, iterations:Number.POSITIVE_INFINITY});\n", 'js', 'LOOPANIM'),
 ('ФЕНИКС L6 чужая точка на ks-shimmer', '<style>.op-live-dot{ animation:ks-shimmer 1.2s ease infinite; }</style>', 'html', 'LOOPANIM'),
 ('ФЕНИКС L7 infinite через переменную', '<style>.dot{ --n:infinite; animation:op-pulse 1s var(--n); }</style>', 'html', 'LOOPANIM'),
 ('ФЕНИКС L8 INFINITE заглавными', '<style>.dot{ animation:op-pulse 1s INFINITE; }</style>', 'html', 'LOOPANIM'),
 ('ФЕНИКС L9 мигание таймером setInterval', "setInterval(() => dot.classList.toggle('is-on'), 600);\n", 'js', 'LOOPANIM'),
 ('ФЕНИКС O1 проценты 55%', '<style>.op-hint{ opacity:55%; }</style>', 'html', 'OPACITY'),
 ('ФЕНИКС O2 filter:opacity(.55)', '<style>.op-hint{ filter:opacity(.55); }</style>', 'html', 'OPACITY'),
 ('ФЕНИКС O3 подпись графика .op-chart-note', '<style>.op-chart-note{ opacity:.55; }</style>', 'html', 'OPACITY'),
 ('ФЕНИКС O4 подпись у значка .op-icon-label', '<style>.op-icon-label{ opacity:.5; }</style>', 'html', 'OPACITY'),
 ('ФЕНИКС O5 CSS строкой в .js', "document.head.insertAdjacentHTML('beforeend', '<style>.op-hint{ opacity:.55; }</style>');\n", 'js', 'OPACITY'),
 ('ФЕНИКС O6 встроенный style= в процентах', '<p style="opacity:60%">подпись</p>', 'html', 'OPACITY'),
 ('ФЕНИКС O7 opacity через calc/var', '<style>.op-hint{ --o:.55; opacity:var(--o); }</style>', 'html', 'OPACITY'),
 ('ФЕНИКС O8 плейсхолдер поля бледный', '<style>.op-field::placeholder{ opacity:.4; }</style>', 'html', 'OPACITY'),
 ('ФЕНИКС O9 el.style.opacity в JS', "hint.style.opacity = '.55';\n", 'js', 'OPACITY'),
 ('ФЕНИКС D1 проект переопределил --tap в compact', '<style>[data-density="compact"]{ --tap:32px; --tap-sm:28px; }</style>', 'html', 'DENSITYTAP'),
 ('ФЕНИКС D2 атрибут без кавычек', '<style>[data-density=compact] .op-btn{ min-height:28px; }</style>', 'html', 'DENSITYTAP'),
 ('ФЕНИКС D3 атрибут в одинарных кавычках', "<style>[data-density='compact'] .op-btn{ height:28px; }</style>", 'html', 'DENSITYTAP'),
 ('ФЕНИКС D4 max-height', '<style>[data-density="compact"] .op-btn{ max-height:28px; overflow:hidden; }</style>', 'html', 'DENSITYTAP'),
 ('ФЕНИКС D5 кнопка вне словаря .op-toggle', '<style>[data-density="compact"] .op-toggle{ height:28px; }</style>', 'html', 'DENSITYTAP'),
 ('ФЕНИКС D6 ссылка-кнопка очереди .op-q a', '<style>[data-density="compact"] .op-q a{ min-height:28px; }</style>', 'html', 'DENSITYTAP'),
 ('ФЕНИКС D7 :root переопределил --tap', '<style>:root{ --tap:32px; }</style>', 'html', 'DENSITYTAP'),
 ('ФЕНИКС H1 hex на странице проекта (docstring: «в компоненте или странице»)', '<style>.x{ color:#FF00AA; }</style>', 'html', 'HEX'),
 ('ФЕНИКС E1 длинное тире сущностью &mdash;', '<p>было &mdash; стало</p>', 'html', 'EMDASH'),
 ('ФЕНИКС E2 длинное тире \\u2014 в JS', "el.textContent = 'было \\u2014 стало';\n", 'js', 'EMDASH'),
 ('ФЕНИКС X1 полоса между /* и */ в тексте страницы', '<p>/*</p><style>.q{ border-left:3px solid var(--warn); }</style><p>*/</p>', 'html', 'SIDESTRIPE'),
 ('ФЕНИКС X2 полоса в <style> до слова tokens', '<style>.q{ border-left:3px solid var(--warn); }</style><p>Цвета берутся из tokens.css</p><style>.z{ color:var(--text); }</style>', 'html', 'SIDESTRIPE'),
 ('свой логические длинные свойства', '<style>.q{ border-inline-start-width:3px; border-inline-start-style:solid; border-inline-start-color:red; }</style>', 'html', 'SIDESTRIPE'),
 ('свой color-mix', '<style>.q{ border-left:3px solid color-mix(in oklab, var(--warn) 80%, black); }</style>', 'html', 'SIDESTRIPE'),
 ('свой hsl и rem в длинных', '<style>.q{ border-left-width:.2rem; border-left-style:solid; border-left-color:hsl(10 80% 50%); }</style>', 'html', 'SIDESTRIPE'),
 ('свой несколько теней', '<style>.q{ box-shadow: 0 1px 2px rgba(0,0,0,.1), inset 4px 0 0 0 var(--ok); }</style>', 'html', 'SIDESTRIPE'),
 ('свой ::after справа', '<style>.q::after{ content:""; position:absolute; right:0; top:0; bottom:0; width:2px; background-color:var(--crit); }</style>', 'html', 'SIDESTRIPE'),
 ('свой вложенный CSS &::before', '<style>.q{ position:relative; &::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--info); } }</style>', 'html', 'SIDESTRIPE'),
 ('свой Object.assign(el.style)', "Object.assign(row.style, { borderLeft:'3px solid var(--crit)' });\n", 'js', 'SIDESTRIPE'),
 ('свой !important', '<style>.q{ border-left:3px solid var(--warn) !important; }</style>', 'html', 'SIDESTRIPE'),
 ('свой ширина em', '<style>.q{ border-left:.25em solid var(--ok); }</style>', 'html', 'SIDESTRIPE'),
 ('свой setProperty', "row.style.setProperty('border-left', '4px solid var(--warn)');\n", 'js', 'SIDESTRIPE'),
 ('свой UPPERCASE заглавными', '<style>.op-tag2{ text-transform:UPPERCASE; }</style>', 'html', 'CAPSBADGE'),
 ('свой капс с !important', '<style>.op-note-title{ text-transform:uppercase !important; }</style>', 'html', 'CAPSBADGE'),
 ('свой font-variant: small-caps', '<style>.op-h{ font-variant:small-caps; }</style>', 'html', 'CAPSBADGE'),
 ('свой conic-gradient у знака', '<style>.ks-brand-mark{ background-image:conic-gradient(var(--cat-1), var(--cat-3)); }</style>', 'html', 'GRADMARK'),
 ('свой градиент в монограмме', '<style>.op-monogram{ background:radial-gradient(var(--cat-2), var(--cat-4)); }</style>', 'html', 'GRADMARK'),
 ('свой infinite alternate', '<style>.d{ animation:pulse 2s ease-in-out infinite alternate; }</style>', 'html', 'LOOPANIM'),
 ('свой список анимаций', '<style>.d{ animation:none, blink 1s steps(2) infinite; }</style>', 'html', 'LOOPANIM'),
 ('свой repeat: -1 (GSAP)', "gsap.to('.dot', { opacity:.3, repeat:-1, yoyo:true });\n", 'js', 'LOOPANIM'),
 ('свой iteration-count 1000', '<style>.d{ animation-name:x; animation-iteration-count:1000; }</style>', 'html', 'LOOPANIM'),
 ('свой !important', '<style>.op-sub{ opacity:.6 !important; }</style>', 'html', 'OPACITY'),
 ('свой полупрозрачный цвет текста rgba', '<style>.op-sub{ color:rgba(20,20,20,.55); }</style>', 'html', 'OPACITY'),
 ('свой hex с альфой', '<style>.op-sub{ color:#14141488; }</style>', 'html', 'OPACITY'),
 ('свой Object.assign opacity', "Object.assign(hint.style, { opacity:'.5' });\n", 'js', 'OPACITY'),
 ('свой html[data-density] button', '<style>html[data-density="compact"] button{ height:30px; }</style>', 'html', 'DENSITYTAP'),
 ('свой ссылка-кнопка a.op-more', "<style>[data-density='compact'] a.op-more{ min-height:24px; }</style>", 'html', 'DENSITYTAP'),
 ('свой --tap-sm в своём классе', '<style>.op-panel{ --tap-sm:30px; }</style>', 'html', 'DENSITYTAP'),
 # 1.5.2: цвет мимо токенов в разметке, собранной скриптом, и атрибутами разметки
 ('1.5.2 hex через константу в шаблоне', "const c = '#d00';\nel.innerHTML = `<span style=\"color:${c}\">x</span>`;\n", 'js', 'HEX'),
 ('1.5.2 hex в style без кавычек', "el.innerHTML = '<span style=color:#d00>x</span>';\n", 'js', 'HEX'),
 ('1.5.2 hex с экранированными кавычками', 'el.innerHTML = "<span style=\\"color:#d00\\">x</span>";\n', 'js', 'HEX'),
 ('1.5.2 fill в SVG из скрипта', "el.innerHTML = '<svg><rect fill=\"#d00\"/></svg>';\n", 'js', 'HEX'),
 ('1.5.2 fill в SVG разметки', '<svg><rect fill="#d00" width="4" height="4"/></svg>', 'html', 'HEX'),
 ('1.5.2 атрибут color', '<font color="#d00">x</font>', 'html', 'HEX'),
 ('1.5.2 bgcolor из скрипта', "el.innerHTML = '<td bgcolor=\"#d00\">x</td>';\n", 'js', 'HEX'),
 ('1.5.2 el.style через константу', "const C = '#d00';\nel.style.color = C;\n", 'js', 'HEX'),
 ('1.5.2 stroke rgb() в SVG', '<svg><path stroke="rgb(200,0,0)" d="M0 0L4 4"/></svg>', 'html', 'HEX'),
 # выключатель: без причины, с правилом, которое не выключается, у предка вместо самого правила
 ('1.5.2 выключатель без причины', '<style>.op-rail{ border-left:3px solid var(--primary); --ks-allow:SIDESTRIPE; }</style>', 'html', 'ALLOW'),
 ('1.5.2 выключатель для контраста', '<style>.op-rail{ border-left:3px solid var(--primary); --ks-allow:"CONTRAST: хочу серый текст"; }</style>', 'html', 'ALLOW'),
 ('1.5.2 выключатель у соседа с тем же классом (ФЕНИКС P1a)', '<span class="op-tag" style="--ks-allow:\'HEX: служебная метка тега\'; color:var(--text)">a</span><span class="op-tag" style="color:#b00020">b</span>', 'html', 'HEX'),
 ('1.5.2 выключатель на body из JS (ФЕНИКС P2)', "document.body.style.setProperty('--ks-allow', 'HEX: служебная пометка страницы');\nb.style.color = '#b00020';\n", 'js', 'HEX'),
 ('1.5.2 setAttribute fill', "el.setAttribute('fill', '#d00');\n", 'js', 'HEX'),
 ('1.5.2 атрибут заглавными FILL', '<svg><rect FILL="#D00" width="4" height="4"/></svg>', 'html', 'HEX'),
 ('1.5.2 выключатель у предка не действует', '<style>.op-tl{ --ks-allow:"SIDESTRIPE: весь блок целиком"; } .op-tl .op-rail{ border-left:3px solid var(--primary); }</style>', 'html', 'SIDESTRIPE'),
]
# Законные приёмы: сторож обязан молчать. Сторож, который кричит на всё, так же бесполезен.
CLEAN_CASES = [
 ('ФЕНИКС-2 F1 гистограмма flex-столбцами 4x24 (без inline-block)', '<style>.op-bars{ display:flex; align-items:flex-end; gap:2px; } .op-bars i{ width:4px; height:24px; background:var(--cat-1); }</style>', 'html'),
 ('ФЕНИКС-2 F2 линия «сегодня» на шкале трекера', '<style>.op-tl{ position:relative; } .op-tl-now{ position:absolute; top:0; bottom:0; left:42%; width:2px; background:var(--crit); }</style>', 'html'),
 ('ФЕНИКС-2 F3 ручка ширины столбца, подсветка по наведению', '<style>.op-col-resize{ position:absolute; top:0; bottom:0; right:0; width:4px; cursor:col-resize; } .op-col-resize:hover{ background:var(--primary); }</style>', 'html'),
 ('ФЕНИКС-2 F4 фишка компакта 40px (у кита фишка 36)', '<style>[data-density="compact"] .op-chip{ height:40px; }</style>', 'html'),
 ('ФЕНИКС-2 F5 бегунок прокрутки 4px', '<style>.op-list::-webkit-scrollbar-thumb{ width:4px; min-height:24px; background:var(--text-faint); border-radius:4px; }</style>', 'html'),
 ('ФЕНИКС-2 F6 столбики спарклайна в ячейке таблицы flex', '<style>.op-spark-bars{ display:flex; gap:1px; height:20px; align-items:flex-end; } .op-spark-bars span{ width:3px; min-height:16px; background:var(--cat-2); }</style>', 'html'),
 ('нейтральная линия у цитаты', '<style>.quote{ border-left:2px solid var(--border-strong); padding-left:var(--sp-3); }</style>', 'html'),
 ('тонкая линия под шапкой таблицы', '<style>.t th{ box-shadow:inset 0 -1px 0 var(--border); }</style>', 'html'),
 ('выключенная кнопка', '<style>.op-btn:disabled{ opacity:.5; }</style>', 'html'),
 ('фигура svg приглушена', '<style>.op-spark path.is-gap{ opacity:.5; }</style>', 'html'),
 ('короткая метка .ks-caps', '<style>.ks-caps{ text-transform:uppercase; }</style>', 'html'),
 ('вращение загрузки', '<style>.op-load{ animation:ks-spin 900ms linear infinite; }</style>', 'html'),
 ('компакт держит цель пальца', '<style>[data-density="compact"] .op-btn{ min-height:var(--tap-sm); }</style>', 'html'),
 ('конечная анимация через animate', '<script>el.animate([{opacity:0},{opacity:1}],{duration:200});</script>', 'html'),
 ('ключевые кадры появления', '<style>@keyframes op-in{ from{ opacity:0; } to{ opacity:1; } }</style>', 'html'),
 ('ФЕНИКС F1 конечное затухание до .4 в <script> страницы', '<script>el.animate([{opacity:1},{opacity:.4}],{duration:200});</script>', 'html'),
 ('ФЕНИКС F2 настройки ApexCharts fill.opacity в <script> страницы', "<script>C.render('x',{ chart:{type:'area'}, fill:{ opacity:.85 } });</script>", 'html'),
 ('ФЕНИКС F3 гистограмма-спарк столбцами 4x24', '<style>.op-hist i{ display:inline-block; width:4px; height:24px; background:var(--cat-1); }</style>', 'html'),
 ('ФЕНИКС F4 маркер легенды 3x12', '<style>.op-legend .sw{ display:inline-block; width:3px; height:12px; background:var(--cat-2); }</style>', 'html'),
 ('ФЕНИКС F5 документация цитирует запрет', '<p>Нельзя: <code>animation: op-pulse 1s infinite</code>, так мигают точки.</p>', 'html'),
 ('ФЕНИКС F6 разделитель в шапке 1x20 нейтральный', '<style>.sep{ width:1px; height:20px; background:var(--border); }</style>', 'html'),
 ('ФЕНИКС F7 выключенная строка aria-disabled', '<style>.op-row[aria-disabled="true"]{ opacity:.5; }</style>', 'html'),
 ('ФЕНИКС F8 js-файл с fill.opacity', 'const o = { fill:{ opacity:.85 } };\n', 'js'),
 ('ФЕНИКС F9 transition по opacity', '<style>.op-hint{ transition:opacity .2s; }</style>', 'html'),
 ('ФЕНИКС F10 плашка-заглушка стоп-кадр opacity 0/1', '<style>.op-tip{ opacity:0; } .op-tip.is-on{ opacity:1; }</style>', 'html'),
 ('свой нейтральная рамка слева 3px', '<style>.op-quote{ border-left:3px solid var(--border-strong); }</style>', 'html'),
 ('свой столбик прогресса inline-block', '<style>.op-prog i{ display:inline-block; width:3px; height:40px; background:var(--cat-1); }</style>', 'html'),
 ('свой кольцо фокуса тенью', '<style>.op-btn:focus-visible{ box-shadow:0 0 0 3px var(--primary-soft); }</style>', 'html'),
 ('свой тень карточки', '<style>.op-card{ box-shadow:0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1); }</style>', 'html'),
 ('свой kbd капсом', '<style>.op-help kbd{ text-transform:uppercase; }</style>', 'html'),
 ('свой ks-spin у загрузки', '<style>.op-loading-icon{ animation:ks-spin 1s linear infinite; }</style>', 'html'),
 ('свой строка таблицы в компакте', '<style>[data-density="compact"] .op-row{ height:32px; }</style>', 'html'),
 ('свой кнопка в компакте height:auto', '<style>[data-density="compact"] .op-btn{ height:auto; padding-block:2px; }</style>', 'html'),
 ('свой появление тоста 0 и 1', '<style>.op-toast{ transition:opacity .2s; } .op-toast.is-out{ opacity:0; }</style>', 'html'),
 ('свой updateOptions fill.opacity', 'chart.updateOptions({ fill:{ opacity:.3 } });\n', 'js'),
 ('свой правило в тексте <code>', '<p>Нельзя: <code>border-left:3px solid var(--warn)</code></p>', 'html'),
 ('свой градиент на аватаре', '<style>.op-avatar{ background:linear-gradient(135deg,var(--cat-1),var(--cat-2)); }</style>', 'html'),
 ('1.5.2 рельс таймлайна с выключателем и причиной', '<style>.op-rail{ border-left:3px solid var(--primary); --ks-allow:"SIDESTRIPE: рельс таймлайна событий"; }</style>', 'html'),
 ('1.5.2 токен в разметке из скрипта', "el.innerHTML = `<span style=\"color:var(--danger)\">x</span>`;\n", 'js'),
 ('1.5.2 якорь #fff1 и хеш адреса', "location.hash = '#abc';\nel.innerHTML = '<a href=\"#fff1\">x</a>';\n", 'js'),
 ('1.5.2 mask-icon в link', '<link rel="mask-icon" href="x.svg" color="#5bbad5">', 'html'),
 ('1.5.2 data-color не атрибут цвета', '<div data-color="#abc">x</div>', 'html'),
 ('1.5.2 url(#id) через константу', "const ID = 'fade';\nel.innerHTML = `<rect fill=\"url(#${ID})\"/>`;\n", 'js'),
 ('1.5.2 экранированный style fill:url(#fade)', 'el.innerHTML = "<rect style=\\"fill:url(#fade)\\"/>";\n', 'js'),
 ('1.5.2 i<n в коде рядом с color', "for (let i = 0; i<n; i++) { state.color = '#abc'; }\n", 'js'),
 ('1.5.2 fill с выключателем в том же теге', '<svg><rect fill="#d00" style="--ks-allow:\'HEX: цвет логотипа партнёра\'" width="4" height="4"/></svg>', 'html'),
 ('1.5.2 псевдоэлемент, выключатель на его элементе', '<style>.op-ev{ position:relative; --ks-allow:"SIDESTRIPE: рельс у подписи события"; } .op-ev::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--primary); }</style>', 'html'),
 ('1.5.2 svg-значок fill currentColor', '<svg><path fill="currentColor" stroke="none" d="M0 0L4 4"/></svg>', 'html'),
]
EXPECT = {'приглушённый текст провалил контраст': 'TOKENS', 'тёмный текст провалил контраст': 'TOKENS', 'бейдж внимания провалил контраст': 'TOKENS', 'кнопка: текст на акценте': 'TOKENS', 'палитра: синий рядом с голубым': 'PALETTE', 'hex в компонентах': 'HEX', 'hex в графиках': 'HEX', 'две оси Y': 'DUALAXIS', 'длинное тире': 'EMDASH', 'бейдж на поднятом слое': 'TOKENS', 'анимация ширины': 'LAYOUTANIM', 'пружинящая кривая': 'BOUNCE', 'шрифт мельче 11px в токенах': 'FONTFLOOR', 'шрифт мельче 11px в графике': 'FONTFLOOR', 'копии тёмной темы разъехались': 'SYNC', 'подъём по наведению на касании': 'HOVERLIFT', 'цветная полоса сбоку': 'SIDESTRIPE', 'бейдж капсом': 'CAPSBADGE', 'градиент на знаке бренда': 'GRADMARK', 'цифры моноширинным': 'MONONUM', 'бледный текст для чтения': 'FAINTTEXT', 'пульсирующая плитка': 'LOOPANIM', 'компакт уменьшил цель пальца': 'DENSITYTAP', 'текст на основной кнопке': 'TOKENS', 'переход без «меньше движения»': 'VTMOTION'}
def run(extra=None):
    cmd = [sys.executable, str(HERE/'tools'/'check_ds.py')] + ([str(extra)] if extra else [])
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode, [l.strip() for l in r.stdout.splitlines() if l.strip().startswith('[')]
def codes(lines): return {re.match(r'\[([A-Z]+)\]', l).group(1) for l in lines if re.match(r'\[([A-Z]+)\]', l)}
PAGE_JS = HERE/'tools'/'_tamper_page.js'
def page_file(content, kind):
    if kind == 'js': PAGE_JS.write_text(content, encoding='utf-8'); return PAGE_JS
    page = content if content.startswith('<!doctype') else '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + content + '</body></html>'
    PAGE.write_text(page, encoding='utf-8'); return PAGE
caught = total = 0
for name, path, f in CASES:
    total += 1; bak = path.read_text(encoding='utf-8'); new = f(bak)
    if new == bak: print(f'  ПОДМЕНА НЕ ПРОИЗОШЛА: {name}'); continue
    path.write_text(new, encoding='utf-8')
    try:
        code, lines = run(); want = EXPECT[name]
        if want in codes(lines): caught += 1; print(f'  поймано: {name:36s} -> [{want}]')
        else: print(f'  ПРОСКОЧИЛО: {name} (ждали [{want}], сработало {sorted(codes(lines))})')
    finally: path.write_text(bak, encoding='utf-8')
for name, content, kind, want in PAGE_CASES:
    total += 1
    f = page_file(content, kind)
    try:
        code, lines = run(f)
        if want in codes(lines): caught += 1; print(f'  поймано: {name:52s} -> [{want}]')
        else: print(f'  ПРОСКОЧИЛО: {name} (ждали [{want}], сработало {sorted(codes(lines))})')
    finally: f.unlink()
false_alarm = 0
for name, content, kind in CLEAN_CASES:
    f = page_file(content, kind)
    try:
        code, lines = run(f)
        if code: false_alarm += 1; print(f'  ЛОЖНАЯ ТРЕВОГА: {name:40s} -> {lines[0] if lines else ""}')
        else: print(f'  молчит, как надо: {name}')
    finally: f.unlink()
# 1.5.1: живой слой (--live). Нарушения, которых нет в тексте страницы, но есть в отрисовке: стиль из внешнего
# файла, цикл с iterations = 1/0, прозрачность через вычисленное имя свойства, мелкая кнопка из внешнего файла.
live_caught = live_total = live_fa = 0
if '--live' in sys.argv:
    ext = HERE/'tools'/'_tamper_ext.css'
    ext.write_text('.q{ border-left:3px solid var(--warn); } .t{ text-transform:uppercase; } .b{ height:26px; }', encoding='utf-8')
    base = '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../tokens/tokens.css"><link rel="stylesheet" href="../kit/kit.css"><link rel="stylesheet" href="_tamper_ext.css"></head><body>'
    LIVE_CASES = [
     ('полоса из внешнего файла', '<div class="q">текст</div>', 'SIDESTRIPE'),
     ('капс из внешнего файла', '<span class="t">новый</span>', 'CAPSBADGE'),
     ('цикл iterations = 1/0', '<i id="d">.</i><script>const n = 1/0; document.getElementById("d").animate([{transform:"scale(1)"},{transform:"scale(1.3)"}],{duration:900,iterations:n});</script>', 'LOOPANIM'),
     ('прозрачность вычисленным свойством', '<p id="h">подпись</p><script>document.getElementById("h").style["opac" + "ity"] = ".5";</script>', 'OPACITY'),
     ('мелкая кнопка из внешнего файла', '<button class="b">ок</button>', 'DENSITYTAP'),
     ('узкий блок на всю высоту рядом с текстом', '<div style="display:flex;gap:8px"><i style="width:3px;height:100%;min-height:40px;background:var(--primary)"></i><p>строка отчёта</p></div>', 'SIDESTRIPE'),
     ('узкий блок растянут во флексе', '<div style="display:flex;gap:8px;min-height:40px"><i style="width:3px;align-self:stretch;background:var(--primary)"></i><p>строка</p></div>', 'SIDESTRIPE'),
     ('цвет узкого блока из соседнего правила', '<style>.bar{ width:3px; height:24px; } .bar.is-hot{ background:var(--crit); }</style><div style="display:flex;gap:8px"><i class="bar is-hot"></i><span>заявка</span></div>', 'SIDESTRIPE'),
     ('узкий блок min-height', '<div style="display:flex;gap:8px"><i style="width:3px;min-height:24px;background:var(--primary)"></i><span>текст</span></div>', 'SIDESTRIPE'),
     ('узкий блок логическими размерами рядом с текстом', '<div style="display:flex;gap:8px;block-size:40px"><i style="inline-size:3px;block-size:100%;background:var(--warn)"></i><span>текст</span></div>', 'SIDESTRIPE'),
     ('компакт уменьшил кнопку полями, без высоты', '<style>[data-density="compact"] .op-btn{ padding:2px 6px; font-size:12px; line-height:1; }</style><button class="op-btn">ок</button>', 'DENSITYTAP'),
     ('1.5.2 выключатель у родителя не действует', '<style>.tlw{ --ks-allow:"SIDESTRIPE: весь блок целиком"; }</style><div class="tlw"><div style="position:relative;padding-left:14px">Событие<i style="position:absolute;left:0;top:0;width:3px;height:40px;background:var(--primary)"></i></div></div>', 'SIDESTRIPE'),
     ('1.5.2 выключатель без причины', '<div style="position:relative;padding-left:14px">Событие<i style="position:absolute;left:0;top:0;width:3px;height:40px;background:var(--primary);--ks-allow:SIDESTRIPE"></i></div>', 'ALLOW'),
     ('1.5.2 выключатель у соседа, полоса у второго', '<style>.ev{ position:relative; padding-left:14px; margin:8px; } .ev i{ position:absolute; left:0; top:0; width:3px; height:40px; background:var(--primary); }</style><div class="ev"><i style="--ks-allow:\'SIDESTRIPE: рельс таймлайна событий\'"></i>Первое</div><div class="ev"><i></i>Второе</div>', 'SIDESTRIPE'),
     ('1.5.2 страница подменяет функцию выключателя (ФЕНИКС P5)', '<div style="position:relative;padding-left:14px">Событие<i style="position:absolute;left:0;top:0;width:3px;height:40px;background:var(--primary)"></i></div><script>window.__ksAllow = () => ({ codes: ["SIDESTRIPE"], why: "подмена со страницы" });</script>', 'SIDESTRIPE'),
     ('1.5.2 мелкая цель без выключателя', '<span role="button" tabindex="0" style="display:inline-block;width:28px;height:28px">x</span>', 'DENSITYTAP'),
     ('полоса у элемента aria-hidden', '<div style="display:flex;gap:8px"><i aria-hidden="true" style="width:3px;height:24px;background:var(--warn)"></i><span>текст</span></div>', 'SIDESTRIPE'),
    ]
    LIVE_CLEAN = [
     ('столбики данных', '<div style="display:flex;gap:2px;align-items:end"><i style="width:4px;height:20px;background:var(--cat-1)"></i><i style="width:4px;height:30px;background:var(--cat-1)"></i><i style="width:4px;height:24px;background:var(--cat-1)"></i></div>'),
     ('рамка вокруг выбранной карточки', '<div class="ks-card" style="border:2px solid var(--primary)"><div class="ks-card-title">выбрана</div></div>'),
     ('ручка ширины столбца', '<div style="position:relative;padding:8px">Заголовок<i style="position:absolute;right:0;top:0;bottom:0;width:4px;background:var(--primary);cursor:col-resize"></i></div>'),
     ('ссылка в строке текста', '<p>Подробнее <a href="#x">здесь</a> в отчёте.</p>'),
     ('1.5.2 рельс с выключателем и причиной', '<div style="position:relative;padding-left:14px">Событие<i style="position:absolute;left:0;top:0;width:3px;height:40px;background:var(--primary);--ks-allow:\'SIDESTRIPE: рельс таймлайна событий\'"></i></div>'),
     ('1.5.2 псевдоэлемент, выключатель на его элементе', '<style>.ev2{ position:relative; padding-left:14px; --ks-allow:"SIDESTRIPE: рельс у подписи события"; } .ev2::before{ content:""; position:absolute; left:0; top:0; width:3px; height:40px; background:var(--primary); }</style><div class="ev2">Событие</div>'),
     ('1.5.2 выключатель на самом ::before', '<style>.ev3{ position:relative; padding-left:14px; } .ev3::before{ content:""; position:absolute; left:0; top:0; width:3px; height:40px; background:var(--primary); --ks-allow:"SIDESTRIPE: рельс у подписи события"; }</style><div class="ev3">Событие</div>'),
     ('1.5.2 вложенный элемент того же класса с выключателем', '<style>.ev4{ position:relative; padding-left:14px; margin:6px; } .ev4 > i{ position:absolute; left:0; top:0; width:3px; height:40px; background:var(--primary); --ks-allow:"SIDESTRIPE: рельс таймлайна событий"; }</style><div class="ev4"><i></i>Внешнее<div class="ev4"><i></i>Вложенное</div></div>'),
     ('1.5.2 кнопка-значок с выключателем и причиной', '<span role="button" tabindex="0" style="display:inline-block;width:28px;height:28px;--ks-allow:\'DENSITYTAP: кнопка-значок в плотной таблице\'">x</span>'),
    ]
    for name, body, want in LIVE_CASES:
        live_total += 1
        PAGE.write_text(base + body + '</body></html>', encoding='utf-8')
        try:
            r = subprocess.run([sys.executable, str(HERE/'tools'/'check_ds.py'), '--live', str(PAGE)], capture_output=True, text=True)
            c = codes([l.strip() for l in r.stdout.splitlines() if l.strip().startswith('[')])
            if want in c: live_caught += 1; print(f'  живьём поймано: {name:40s} -> [{want}]')
            else: print(f'  ЖИВЬЁМ ПРОСКОЧИЛО: {name} (ждали [{want}], сработало {sorted(c)})')
        finally: PAGE.unlink()
    for name, body in LIVE_CLEAN:
        PAGE.write_text(base + body + '</body></html>', encoding='utf-8')
        try:
            r = subprocess.run([sys.executable, str(HERE/'tools'/'check_ds.py'), '--live', str(PAGE)], capture_output=True, text=True)
            fa = int(r.returncode != 0); live_fa += fa
            print(f'  живьём {name}: ' + ('ЛОЖНАЯ ТРЕВОГА ' + r.stdout.strip().splitlines()[-1] if fa else 'молчит, как надо'))
        finally: PAGE.unlink()
    # 1.5.2: страница в папке с '#' и пробелом в имени открывается, живой слой проверяет её, а не падает
    import tempfile, os
    with tempfile.TemporaryDirectory(prefix='ks #1 ') as hd:
        hp = Path(hd)/'стр #2.html'
        hp.write_text(base.replace('../tokens/', (HERE/'tokens').as_uri() + '/').replace('../kit/', (HERE/'kit').as_uri() + '/').replace('_tamper_ext.css', ext.as_uri()) + '<p>Чистая страница</p></body></html>', encoding='utf-8')
        r = subprocess.run([sys.executable, str(HERE/'tools'/'check_ds.py'), '--live', str(hp)], capture_output=True, text=True)
        fa = int(r.returncode != 0); live_fa += fa
        print('  живьём страница в папке с #: ' + ('ЛОЖНАЯ ТРЕВОГА ' + r.stdout.strip().splitlines()[-1] if fa else 'открылась и молчит, как надо'))
    # 1.5.2: страница не открылась (битая ссылка на файл): подсказка про путь, а не про Playwright
    with tempfile.TemporaryDirectory() as bd:
        lk = Path(bd)/'нет.html'; os.symlink(Path(bd)/'пропала.html', lk)
        r = subprocess.run([sys.executable, str(HERE/'tools'/'check_ds.py'), '--live', str(lk)], capture_output=True, text=True)
        live_total += 1
        if r.returncode != 0 and 'проверьте путь' in r.stdout: live_caught += 1; print('  живьём поймано: страница не открылась, подсказка про путь -> [LIVE]')
        else: print('  ЖИВЬЁМ ПРОСКОЧИЛО: подсказка при битом пути: ' + ' | '.join(l.strip() for l in r.stdout.splitlines() if 'LIVE' in l)[:200])
    # живой слой, который не запустился, обязан провалить проверку, а не сказать «чисто»
    with tempfile.TemporaryDirectory() as nob:
        PAGE.write_text(base + '<p>текст</p></body></html>', encoding='utf-8')
        env = {k: v for k, v in os.environ.items() if k != 'NODE_PATH'}; env['PLAYWRIGHT_BROWSERS_PATH'] = nob
        try:
            r = subprocess.run([sys.executable, str(HERE/'tools'/'check_ds.py'), '--live', str(PAGE)], capture_output=True, text=True, env=env)
            live_total += 1
            if r.returncode != 0 and '[LIVE]' in r.stdout: live_caught += 1; print('  живьём поймано: живой слой не запустился                -> [LIVE]')
            else: print('  ЖИВЬЁМ ПРОСКОЧИЛО: живой слой не запустился, а сторож сказал: ' + r.stdout.strip().splitlines()[-1])
        finally: PAGE.unlink()
    PAGE.write_text(base + '<div class="ks-card"><div class="ks-card-title">Чистая карточка</div><span class="ks-caps">метка</span><button class="ks-btn ks-btn--secondary">кнопка</button></div></body></html>', encoding='utf-8')
    try:
        r = subprocess.run([sys.executable, str(HERE/'tools'/'check_ds.py'), '--live', str(PAGE)], capture_output=True, text=True)
        live_fa += int(r.returncode != 0)
        print('  живьём чистая страница: ' + ('ЛОЖНАЯ ТРЕВОГА ' + r.stdout.strip().splitlines()[-1] if live_fa else 'молчит, как надо'))
    finally: PAGE.unlink(); ext.unlink()
code, _ = run()
print(f'\nитог: {caught} из {total}; ложных тревог {false_alarm} из {len(CLEAN_CASES)}' + (f'; живьём {live_caught} из {live_total}, ложных {live_fa}' if live_total else '') + f'; чистая система после восстановления: {"зелёная" if code == 0 else "КРАСНАЯ"}')
sys.exit(0 if caught == total and false_alarm == 0 and live_caught == live_total and live_fa == 0 and code == 0 else 1)
