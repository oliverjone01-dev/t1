# Итерация 2: мутации кода блока 7 в песочнице sb2 (e30d0c1). Правка -> vitest двух файлов -> откат.
import subprocess, pathlib
SB = pathlib.Path("/tmp/claude-0/-home-user-t1/bf8da627-8182-59b8-a23c-b2eb02fe1be2/scratchpad/feniks-flow/sb2/analytics-mvp")
VT = "/root/.npm/_npx/69c381f8ad94b576/node_modules/.bin/vitest"
DL = SB / "src/scripts/ym/derive-lib.ts"
RP = SB / "src/scripts/ym/report-page-ym.ts"
M = [
    ("N0 без мутации", DL, "", ""),
    ("N1 (M5) граница accTo в реестре", DL, "for (const r of netting) {\n    const d = String(r.d || \"\"); if (!d || d > accTo) continue;", "for (const r of netting) {\n    const d = String(r.d || \"\"); if (!d || d >= accTo) continue;"),
    ("N2 (M6) flBad без К выплате", RP, "if(Math.abs(da)>1||Math.abs(dm)>1)flBad=", "if(Math.abs(da)>1)flBad="),
    ("N3 (M7) flChk без условия ns", RP, "flChk:grand&&fl.all.ns===0&&Math.abs(fl.all.chk)", "flChk:grand&&Math.abs(fl.all.chk)"),
    ("N4 округление amt1 снято (G3)", DL, "x[1]! += Math.round(t.amt);", "x[1]! += t.amt;"),
    ("N5 доставлен/не доставлен местами (G4)", DL, "x[delivered.has(ord) ? 8 : 9]! += a;", "x[delivered.has(ord) ? 9 : 8]! += a;"),
    ("N6 инвариант кабинетов выключен (G5)", RP, "return Math.abs(fl.mir[k]+fl.fur[k]-fl.all[k])>1;", "return false;"),
    ("N7 порог взноса 0.9 -> 0.5", RP, "return c>0&&d>=0.9*c&&d<=c+1;", "return c>0&&d>=0.5*c&&d<=c+1;"),
    ("N8 позже = кампании, а не взнос", RP, "var later=-(cover(a[3],d1)?d1:(d1===0&&byDep?a[3]:0))||0;", "var later=-(cover(a[3],d1)?a[3]:(d1===0&&byDep?a[3]:0))||0;"),
    ("N9 последний месяц без допущения", RP, "var later=-(cover(a[3],d1)?d1:(d1===0&&byDep?a[3]:0))||0;", "var later=-(cover(a[3],d1)?d1:0)||0;"),
    ("N10 без взноса этого месяца", RP, "exp=a[2]+later+d0;", "exp=a[2]+later;"),
    ("N11 звёздочка с >=", RP, "t.fl.to>REPY.flowMeta.lastPo", "t.fl.to>=REPY.flowMeta.lastPo"),
    ("N12 нет строки «не сверен»", RP, "  t.push('<b class=\"rp-warn\">«Перевёл на счёт» с банковской выпиской не сверен</b> - это данные Маркета, а не поступления на расчётный счёт.');\n", ""),
    ("N13 порог красной пометки 100 -> 1e9", RP, "return r&&(Math.abs(r.mir.res)>100||Math.abs(r.fur.res)>100);", "return r&&(Math.abs(r.mir.res)>1e9||Math.abs(r.fur.res)>1e9);"),
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
