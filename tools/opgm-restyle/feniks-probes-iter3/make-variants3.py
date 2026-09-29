# ФЕНИКС iter3: новые мутанты тех же классов (видимость, перестановка, К1, Д1, частичный снимок, фильтры и графики, слои поверх).
# Исходники op-gm только копируются (shutil.copytree), не меняются. Ни один мутант не взят из make-variants.py iter2.
import shutil, os
SP = '/tmp/claude-0/-home-user-t1/16fce438-701e-5124-a7d4-75100c05e8b9/scratchpad'
BASE = SP + '/opgm/op-gm-automation/src'
D1FIX = '/home/user/t1/tools/opgm-restyle/variants/d1fix'   # эталонная правка Д1 автора (только чтение)
OUT = SP + '/feniks-iter3/v'

def mk(name, base=BASE):
    d = os.path.join(OUT, name)
    if os.path.exists(d): shutil.rmtree(d)
    shutil.copytree(base, d)
    return d

def sub(path, pairs):
    s = open(path, encoding='utf8').read()
    for a, b in pairs:
        n = s.count(a)
        assert n == 1, (path, a[:70], n)
        s = s.replace(a, b)
    open(path, 'w', encoding='utf8').write(s)

def app(path, text):
    open(path, 'a', encoding='utf8').write(text)

# V3-1 видимость: шесть способов сделать число нечитаемым, каждый на своём классе узлов
d = mk('f3-vis')
app(d + '/opgm.css', '''
/* ФЕНИКС iter3 f3-vis */
.ks-tile-value{ -webkit-text-fill-color: transparent }
.ks-num{ filter: opacity(0) }
.op-count b{ display:inline-block; transform: scale(.05); transform-origin: left center }
.ks-strong{ display:inline-block; height:0; overflow:hidden; vertical-align:bottom }
.ks-bar-value{ position:relative; left:-10000px }
@media (min-width:600px) and (max-width:1279px){ .ks-table tbody td{ opacity:.1 } }
''')

# V3-2 перестановка внутри ячейки: «Пропущено входящих» «2 из 10» -> «10 из 2»
d = mk('f3-cellswap')
sub(d + '/opgm.js', [("NF(r.miss) + ' <span class=\"ks-muted\">из ' + NF(r.inn + r.miss) + '</span>'",
                      "NF(r.inn + r.miss) + ' <span class=\"ks-muted\">из ' + NF(r.miss) + '</span>'")])

# V3-3 фильтры в контексте: «Проблема» мертва при выбранном кабинете; «Отметка» игнорируется при выбранной проблеме; «Порядок» сломан
d = mk('f3-filter-ctx')
sub(d + '/opgm.js', [
    ("if(f.prob !== 'all') L = L.filter(c => c.p.includes(f.prob));", "if(f.prob !== 'all' && OP.cab === 'all') L = L.filter(c => c.p.includes(f.prob));"),
    ("if(FL[f.flag]) L = L.filter(FL[f.flag]);", "if(FL[f.flag] && f.prob === 'all') L = L.filter(FL[f.flag]);"),
    ("L = L.slice().sort(SORT[f.sort] || SORT.recent);", "L = L.slice().sort(SORT.recent);")])

# V3-4 график против таблицы-двойника: на графике «Обращений в неделю» данные кабинетов переставлены, легенда, оси, таблица прежние
d = mk('f3-chart-swap')
sub(d + '/opgm.js', [("job(() => floor0(KS.charts.multi('ch-cnt', { cats, series:cntS, h:260 })));",
    "job(() => floor0(KS.charts.multi('ch-cnt', { cats, series:cntS.length === 2 ? [Object.assign({}, cntS[0], { data:cntS[1].data }), Object.assign({}, cntS[1], { data:cntS[0].data })] : cntS, h:260 })));")])

# V3-5 слои поверх: плитки и карточки с деталями не кликаются мышью и пальцем (панель открывается только через API)
d = mk('f3-drill-click')
app(d + '/opgm.css', '''
/* ФЕНИКС iter3 f3-drill-click */
.ks-tile[data-drill], .ks-card[data-drill]{ pointer-events:none }
''')

# V3-6 частичный снимок по времени: срок «Сегодня» считается от часов браузера, а не от EXPORT_TS (на стенде часы = выгрузка)
d = mk('f3-today-now')
sub(d + '/opgm.js', [("const since = OP.today === 'all' ? 0 : EXPORT_TS - OP.today * DAY;",
    "const since = OP.today === 'all' ? 0 : Math.max(Math.floor(Date.now() / 1000), EXPORT_TS) - OP.today * DAY;")])

# V3-7 частичный снимок по ошибкам: ошибка страницы в каждом состоянии, числа не тронуты
d = mk('f3-err')
app(d + '/opgm.js', "\n/* ФЕНИКС iter3 f3-err */\nsetTimeout(() => { throw new Error('f3-err: ошибка страницы после отрисовки'); }, 0);\n")

# V3-8 К1: цвет тега кабинета инвертирован против плиток и графиков (имя рядом есть); панель деталей без имени кабинета
d = mk('f3-cab-swap')
sub(d + '/opgm.js', [
    ("'<span class=\"op-cab\" style=\"--slot:var(--cat-' + CABSLOT[c] + ')\">'", "'<span class=\"op-cab\" style=\"--slot:var(--cat-' + (3 - CABSLOT[c]) + ')\">'"),
    ("return { title:M.t + ' · ' + cab, kind:'ДАННЫЕ'", "return { title:M.t, kind:'ДАННЫЕ'")])

# V3-9 Д1 от часов браузера: правка автора d1fix, но граница месяцев и «до DD» от Date.now()
d = mk('f3-d1now', D1FIX)
sub(d + '/opgm.js', [
    ("function monKeys(){ const out = [], end = iso(EXPORT_TS).slice(0, 7);", "const NOWTS = () => Math.max(Math.floor(Date.now() / 1000), EXPORT_TS);\nfunction monKeys(){ const out = [], end = iso(NOWTS()).slice(0, 7);"),
    ("function monCats(ks){ const end = iso(EXPORT_TS).slice(0, 7); return ks.map(k => MONN[k.slice(5)] + (k === end ? ' (до ' + iso(EXPORT_TS).slice(8, 10) + ')' : '')); }",
     "function monCats(ks){ const end = iso(NOWTS()).slice(0, 7); return ks.map(k => MONN[k.slice(5)] + (k === end ? ' (до ' + iso(NOWTS()).slice(8, 10) + ')' : '')); }")])

# V3-10 Д1 ключ без года: подписи строк из EXPORT_TS (как d1fix), чаты раньше 2026-04 отсечены, но сумма по месяцу без года
d = mk('f3-d1noyear', D1FIX)
T0 = "Math.floor(Date.parse('2026-04-01T00:00:00+03:00') / 1000)"
sub(d + '/opgm.js', [
    ("const L = sel({ cab }).filter(c => monOf(c) === m);", "const L = sel({ cab }).filter(c => c.t >= " + T0 + " && monOf(c).slice(5) === m.slice(5));"),
    ("sent(sel({ cab, kind:'all' }).filter(c => monOf(c) === m))", "sent(sel({ cab, kind:'all' }).filter(c => c.t >= " + T0 + " && monOf(c).slice(5) === m.slice(5)))")])

print('варианты:', sorted(os.listdir(OUT)))
