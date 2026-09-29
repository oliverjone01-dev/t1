# ФЕНИКС iter2: мутанты своей выдумки. Исходники op-gm только копируются (shutil.copytree), не меняются.
import shutil, sys, os
BASE = '/tmp/claude-0/-home-user-t1/16fce438-701e-5124-a7d4-75100c05e8b9/scratchpad/opgm/op-gm-automation/src'
OUT = '/tmp/claude-0/-home-user-t1/16fce438-701e-5124-a7d4-75100c05e8b9/scratchpad/feniks-iter2/v'
AUTHOR_TOOLS = '/tmp/claude-0/-home-user-t1/16fce438-701e-5124-a7d4-75100c05e8b9/scratchpad/opgm-tools/variants'

def mk(name):
    d = os.path.join(OUT, name)
    if os.path.exists(d): shutil.rmtree(d)
    shutil.copytree(BASE, d)
    return d

def sub(path, pairs):
    s = open(path, encoding='utf8').read()
    for a, b in pairs:
        n = s.count(a)
        assert n == 1, (path, a[:60], n)
        s = s.replace(a, b)
    open(path, 'w', encoding='utf8').write(s)

def app(path, text):
    open(path, 'a', encoding='utf8').write(text)

# F0: копия байт в байт (контроль на моих входах)
mk('f-same')

# F1: число меняется только в панели деталей (кнопка «все N» у «Вопрос или телефон без ответа»)
d = mk('f-drawer1')
sub(d + '/opgm.js', [("'>все ' + X.length + ' в «Все диалоги»", "'>все ' + (X.length + (metric === 'quest' ? 1 : 0)) + ' в «Все диалоги»")])

# F2: округление долей вниз вместо округления
d = mk('f-share-floor')
sub(d + '/opgm.js', [("function share(a, b){ return b ? Math.round(a * 1000 / b) / 10 : null; }",
                      "function share(a, b){ return b ? Math.floor(a * 1000 / b) / 10 : null; }")])

# F3: строка источника (W2 в объёме: «строка источника») меняет местами время выгрузки кабинетов
d = mk('f-cabswap-src')
sub(d + '/opgm.js', [("function srcLine(){ return 'Авито API · ' + CABS.map(c => c + ' ' + fD(EXP[c])).join(', ')",
                      "function srcLine(){ return 'Авито API · ' + CABS.map((c, i) => c + ' ' + fD(EXP[CABS[CABS.length - 1 - i]])).join(', ')")])

# F4: подсказка дельты (W4 переписывает подсказки) меняет местами «было» и «стало»
d = mk('f-tip-swap')
sub(d + '/opgm.js', [("const title = 'было ' + fmt(was) + ' за прошлые ' + OP.days + ' дн, стало ' + fmt(now);",
                      "const title = 'было ' + fmt(now) + ' за прошлые ' + OP.days + ' дн, стало ' + fmt(was);")])

# F5: кожа W1, которая делает числа нечитаемыми, не трогая DOM
d = mk('f-hide-css')
app(d + '/opgm.css', "\n/* стенд ФЕНИКСА: кожа прячет числа */\n.ks-tile-value{ opacity:.2; }\n.ks-delta .ks-num{ opacity:0; }\n@media (max-width: 600px){ #view .ks-table td.is-num{ font-size:0; } }\n")

# F6: фильтры «Все диалоги» перестают работать (разметка формы переименована, обработчики не цепляются)
d = mk('f-filter-dead')
sub(d + '/opgm.js', [("['prob','ad','flag','kind','sort'].forEach(k => on('f-' + k, 'change'",
                      "['prob','ad','flag','kind','sort'].forEach(k => on('fx-' + k, 'change'")])

# F7: подписи оси графиков в 10 раз больше (текст графика в снимок не входит)
d = mk('f-chart-x10')
sub(d + '/opgm.js', [("formatter:x => NF(Math.round(x)) } } }, false, false); }",
                      "formatter:x => NF(Math.round(x * 10)) } } }, false, false); }")])

# F8: герой W2 берёт число не из «всего ответить», а из стопки «Клиент ждёт ответа»
d = mk('f-hero-src')
sub(d + '/opgm.js', [("""    + '<div class="ks-stack">' + fresh()
    + '<div class="ks-row"><span class="op-muted">Клиент писал за</span>""",
"""    + '<div class="ks-stack"><div class="ks-hero op-hero">Ответить сейчас: ' + stacks[1].L.length + '</div>' + fresh()
    + '<div class="ks-row"><span class="op-muted">Клиент писал за</span>""")])

# F9: К1 - имя кабинета снято, цвет переехал из инлайн-стиля в класс (типичная чистка при слое токенов W1)
d = mk('f-cab-class')
sub(d + '/opgm.js', [("function cabTag(c){ return '<span class=\"op-cab\" style=\"--slot:var(--cat-' + CABSLOT[c] + ')\">' + E(c) + '</span>'; }",
                      "function cabTag(c){ return '<span class=\"op-cab op-cab--' + CABSLOT[c] + '\"></span>'; }")])
app(d + '/opgm.css', "\n/* стенд ФЕНИКСА: цвет кабинета классом */\n.op-cab--1{ --slot:var(--cat-1); }\n.op-cab--2{ --slot:var(--cat-2); }\n")

# F10: Д1 «вшит октябрь»: ключ месяца без года остаётся, октябрь дописан руками, 2025 отсекается фильтром года
d = mk('f-d1hard')
sub(d + '/opgm.js', [
 ("const MON = { '04':'апр', '05':'май', '06':'июн', '07':'июл', '08':'авг', '09':'сен' };",
  "const MON = { '04':'апр', '05':'май', '06':'июн', '07':'июл', '08':'авг', '09':'сен', '10':'окт' };"),
])
s = open(d + '/opgm.js', encoding='utf8').read()
k0 = s.count("mons = Object.keys(MON), cats = mons.map(m => MON[m] + (m === '09' ? ' (до 22)' : ''));")
s = s.replace("mons = Object.keys(MON), cats = mons.map(m => MON[m] + (m === '09' ? ' (до 22)' : ''));", "mons = Object.keys(MON), cats = mons.map(m => MON[m] + (m === '10' ? ' (до ' + fDay(EXPORT_TS).slice(0, 2) + ')' : ''));")
print('d1hard mons:', k0)
n1 = s.count("sub:'Минут · сентябрь неполный, до 22.09 · весь ряд'"); n2 = s.count("sub:'Весь ряд · сентябрь до 22.09'")
s = s.replace("sub:'Минут · сентябрь неполный, до 22.09 · весь ряд'", "sub:'Минут · октябрь неполный, до ' + fDay(EXPORT_TS) + ' · весь ряд'")
s = s.replace("sub:'Весь ряд · сентябрь до 22.09'", "sub:'Весь ряд · октябрь до ' + fDay(EXPORT_TS)")
s = s.replace("function monOf(c){ return iso(c.t).slice(5,7); }", "function monOf(c){ return iso(c.t).slice(0,4) === '2026' ? iso(c.t).slice(5,7) : 'x'; }")
s = s.replace("E(monOf(c)) + '.2026 › '", "E(iso(c.t).slice(5,7) + '.' + iso(c.t).slice(0,4)) + ' › '")
open(d + '/opgm.js', 'w', encoding='utf8').write(s)
print('d1hard подписи:', n1, n2)

# варианты автора (для прогона на моих входах): копии из его папки variants
for v in ['same', 'mutant', 'hero', 'hero-bad', 'rename', 'skin', 'd1fix', 'dotonly']:
    src = os.path.join(AUTHOR_TOOLS, v); dst = os.path.join(OUT, 'a-' + v)
    if os.path.exists(dst): shutil.rmtree(dst)
    shutil.copytree(src, dst)
print('готово:', sorted(os.listdir(OUT)))
