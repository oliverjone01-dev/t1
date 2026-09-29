#!/bin/sh
# Варианты кода для проверки numsnap. Исходники op-gm-automation только копируются, не меняются.
set -e
HERE=$(cd "$(dirname "$0")" && pwd); SRC="${OP:-$HERE/../..}/src"; [ -f "$SRC/opgm.js" ] || { echo "ОШИБКА: OP=<op-gm-automation> не задан (нет $SRC/opgm.js)"; exit 2; }
mk(){ rm -rf "$HERE/$1"; cp -r "$SRC" "$HERE/$1"; }
# одинаковая сборка: байт в байт
mk same
# мутант: одно число нарочно (плитка «Не ответили вообще» у NEW-B на 1 больше)
mk mutant
python3 - "$HERE/mutant/opgm.js" <<'PY'
import sys; p=sys.argv[1]; s=open(p,encoding='utf8').read()
a="f:env(cur.noresp, cab, cur.n), slot:CABSLOT[cab], icon:'warn', drill:'noresp-'"
assert s.count(a)==1; open(p,'w',encoding='utf8').write(s.replace(a,"f:env(cur.noresp + (cab === 'NEW-B' ? 1 : 0), cab, cur.n), slot:CABSLOT[cab], icon:'warn', drill:'noresp-'"))
PY
# W2: герой «Ответить сейчас: N», N уже есть на экране («всего ответить»)
mk hero
python3 - "$HERE/hero/opgm.js" <<'PY'
import sys; p=sys.argv[1]; s=open(p,encoding='utf8').read()
a="""    + '<div class="ks-stack">' + fresh()
    + '<div class="ks-row"><span class="op-muted">Клиент писал за</span>"""
assert s.count(a)==1; open(p,'w',encoding='utf8').write(s.replace(a,"""    + '<div class="ks-stack"><div class="ks-hero op-hero">Ответить сейчас: ' + total + '</div>' + fresh()
    + '<div class="ks-row"><span class="op-muted">Клиент писал за</span>"""))
PY
# отрицательный контроль: герой с числом, которого на экране нет
mk hero-bad
python3 - "$HERE/hero-bad/opgm.js" <<'PY'
import sys; p=sys.argv[1]; s=open(p,encoding='utf8').read()
a="""    + '<div class="ks-stack">' + fresh()
    + '<div class="ks-row"><span class="op-muted">Клиент писал за</span>"""
assert s.count(a)==1; open(p,'w',encoding='utf8').write(s.replace(a,"""    + '<div class="ks-stack"><div class="ks-hero op-hero">Ответить сейчас: ' + (total + 1) + '</div>' + fresh()
    + '<div class="ks-row"><span class="op-muted">Клиент писал за</span>"""))
PY
# §5 плана: переименования подписей, числа те же
mk rename
python3 - "$HERE/rename/opgm.js" <<'PY'
import sys; p=sys.argv[1]; s=open(p,encoding='utf8').read()
for a,b in [("' п.п.'","' пункта'"),("отрезком раньше: нет","до этого: мало данных"),("Медиана первого ответа","Обычно ждут первого ответа")]:
    assert a in s, a; s=s.replace(a,b)
open(p,'w',encoding='utf8').write(s)
PY
# W1 кожа: контейнер 1200, поле 24, радиус карточки 16, только CSS
mk skin
cat >> "$HERE/skin/opgm.css" <<'CSS'
/* стенд: имитация W1 */
#view > .ks-fade{ max-width:1200px; margin:0 auto; padding:0 24px; box-sizing:border-box; }
#view .ks-card{ border-radius:16px; }
CSS
echo "варианты: same mutant hero hero-bad rename skin"
# Д1 (только чтобы доказать, что d1check и numsnap не пустые; это не код Д-пакета)
mk d1fix
python3 - "$HERE/d1fix/opgm.js" <<'PY'
import sys; p=sys.argv[1]; s=open(p,encoding='utf8').read()
R=[
("const MON = { '04':'апр', '05':'май', '06':'июн', '07':'июл', '08':'авг', '09':'сен' };",
 "const MONN = { '01':'янв', '02':'фев', '03':'мар', '04':'апр', '05':'май', '06':'июн', '07':'июл', '08':'авг', '09':'сен', '10':'окт', '11':'ноя', '12':'дек' };\nfunction monKeys(){ const out = [], end = iso(EXPORT_TS).slice(0, 7); let y = 2026, m = 4; for(;;){ const k = y + '-' + String(m).padStart(2, '0'); out.push(k); if(k >= end || out.length > 36) break; m++; if(m > 12){ m = 1; y++; } } return out; }\nfunction monCats(ks){ const end = iso(EXPORT_TS).slice(0, 7); return ks.map(k => MONN[k.slice(5)] + (k === end ? ' (до ' + iso(EXPORT_TS).slice(8, 10) + ')' : '')); }"),
("function monOf(c){ return iso(c.t).slice(5,7); }", "function monOf(c){ return iso(c.t).slice(0,7); }"),
("mons = Object.keys(MON), cats = mons.map(m => MON[m] + (m === '09' ? ' (до 22)' : ''));", "mons = monKeys(), cats = monCats(mons);"),
("sub:'Минут · сентябрь неполный, до 22.09 · весь ряд'", "sub:'Минут · последний месяц неполный, до ' + fDay(EXPORT_TS) + ' · весь ряд'"),
("sub:'Весь ряд · сентябрь до 22.09'", "sub:'Весь ряд · последний месяц до ' + fDay(EXPORT_TS)"),
("E(monOf(c)) + '.2026 › '", "E(monOf(c).slice(5) + '.' + monOf(c).slice(0, 4)) + ' › '"),
]
for a,b in R:
    n=s.count(a); assert n>=1, a; s=s.replace(a,b)
open(p,'w',encoding='utf8').write(s)
PY
echo "вариант d1fix"
# отрицательный контроль К1: тег кабинета только точкой цвета, без имени
mk dotonly
python3 - "$HERE/dotonly/opgm.js" <<'PY'
import sys; p=sys.argv[1]; s=open(p,encoding='utf8').read()
a="function cabTag(c){ return '<span class=\"op-cab\" style=\"--slot:var(--cat-' + CABSLOT[c] + ')\">' + E(c) + '</span>'; }"
assert s.count(a)==1; open(p,'w',encoding='utf8').write(s.replace(a,"function cabTag(c){ return '<span class=\"op-cab\" style=\"--slot:var(--cat-' + CABSLOT[c] + ')\"></span>'; }"))
PY
echo "вариант dotonly"
