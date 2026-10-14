# Итерация 3: мутации кода блока 7 в песочнице sb3 (9fe9714). Правка -> vitest двух файлов -> откат.
import subprocess, pathlib
SB = pathlib.Path("/tmp/claude-0/-home-user-t1/bf8da627-8182-59b8-a23c-b2eb02fe1be2/scratchpad/feniks-flow/sb3/analytics-mvp")
VT = "/root/.npm/_npx/69c381f8ad94b576/node_modules/.bin/vitest"
DL = SB / "src/scripts/ym/derive-lib.ts"
RP = SB / "src/scripts/ym/report-page-ym.ts"
M = [
    ("P0 без мутации", DL, "", ""),
    ("N1 граница accTo в реестре (> на >=)", DL, "for (const r of netting) {\n    const d = String(r.d || \"\"); if (!d || d > accTo) continue;", "for (const r of netting) {\n    const d = String(r.d || \"\"); if (!d || d >= accTo) continue;"),
    ("N8 позже = кампании, а не взнос", RP, "var later=-(cover(a[3],d1)?d1:(d1===0&&byDep?a[3]:0))||0;", "var later=-(cover(a[3],d1)?a[3]:(d1===0&&byDep?a[3]:0))||0;"),
    ("N9 последний месяц без допущения", RP, "var later=-(cover(a[3],d1)?d1:(d1===0&&byDep?a[3]:0))||0;", "var later=-(cover(a[3],d1)?d1:0)||0;"),
    ("N12 нет строки «не сверен»", RP, "  t.push('<b class=\"rp-warn\">«Перевёл на счёт» с банковской выпиской не сверен</b> - это данные Маркета, а не поступления на расчётный счёт.');\n", ""),
    ("N13 порог плашки 100 -> 1e9", RP, "return r&&(Math.abs(r.mir.res)>100||Math.abs(r.fur.res)>100);", "return r&&(Math.abs(r.mir.res)>1e9||Math.abs(r.fur.res)>1e9);"),
    ("P1 компенсации не вычитаются из Списал", RP, "x.fee=x.amt1-x.acc1-x.oth;", "x.fee=x.amt1-x.acc1;"),
    ("P2 «прочее» не копится в oth", DL, "if (kind === \"other\") x[11]! += a;", ""),
    ("P3 сборы по заказам в «без заказа»", DL, "else if (ord) x[12]! += a;", ""),
    ("P4 перенос: допуск 10% -> 100%", RP, "tol=0.1*Math.max(Math.abs(a),Math.abs(b));", "tol=1*Math.max(Math.abs(a),Math.abs(b));"),
    ("P5 перенос без проверки знака", RP, "if(y&&a*b<0&&(", "if(y&&("),
    ("P6 порог остатка в rpyActRes 100 -> 1e9", RP, "if(Math.abs(a)<=100)return;", "if(Math.abs(a)<=1e9)return;"),
    ("P7 звёздочка только по первому кабинету", RP, "[REPY.cab.mir,REPY.cab.fur].some(function(b){return !!L[b]&&t.fl.to>L[b];})", "[REPY.cab.mir].some(function(b){return !!L[b]&&t.fl.to>L[b];})"),
    ("P8 пометка о замороженных статусах убрана", RP, "if(fz.length)t.push(", "if(false)t.push("),
    ("P9 1-е число: знак удержания", RP, "s-=r[4];", "s+=r[4];"),
]
orig = {DL: DL.read_text(encoding="utf-8"), RP: RP.read_text(encoding="utf-8")}
for name, f, a, b in M:
    src = orig[f]
    if a:
        if src.count(a) != 1:
            print(name, "SKIP: шаблон найден", src.count(a), "раз"); continue
        f.write_text(src.replace(a, b), encoding="utf-8")
    p = subprocess.run([VT, "run", "src/scripts/ym/derive-lib.test.ts", "src/scripts/ym/report-page-ym.test.ts"], cwd=SB, capture_output=True, text=True, timeout=300)
    f.write_text(src, encoding="utf-8")
    tail = [l.strip() for l in (p.stdout + p.stderr).splitlines() if l.strip().startswith("Tests")]
    print(name, "->", "УБИТ" if p.returncode else "ЖИВ", "|", " / ".join(tail))
for f, s in orig.items():
    assert f.read_text(encoding="utf-8") == s
print("откат проверен")
